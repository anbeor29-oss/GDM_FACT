#!/usr/bin/env node
/**
 * arranque-produccion.js — lo que corre Render antes de servir.
 *
 * POR QUÉ EXISTE
 * start:prod encadenaba todo con `&&`:
 *
 *   migrate-up && apply-cp-seed && fix-cp-swap && fix-cp-catalogos && bootstrap && server
 *
 * y los cinco scripts hacen process.exit(1) ante cualquier error. Resultado: si
 * un catálogo del SAT no sembraba —por el motivo que fuera— el servidor NUNCA
 * llegaba a escuchar, Render marcaba "Exited with status 1 while running your
 * code", y la facturación entera quedaba caída por un catálogo de apoyo.
 *
 * Eso confunde dos cosas de gravedad muy distinta:
 *
 *   · El ESQUEMA sí es requisito. Si las migraciones no aplican, el código
 *     habla con una base que no corresponde y puede corromper datos fiscales.
 *     Ahí sí hay que abortar.
 *
 *   · Los CATÁLOGOS del SAT y el bootstrap son datos de apoyo. Que falten
 *     empobrece la captura —un combo sale vacío— pero no impide emitir una
 *     factura ni pone en riesgo nada. Tumbar el servicio por eso es peor
 *     que el problema.
 *
 * Así que las migraciones abortan y lo demás avisa fuerte y sigue. El resumen
 * final deja por escrito qué pasó, que es justo el diagnóstico que faltaba
 * cuando el servicio se caía sin dejar rastro visible.
 */

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

/* ── 0. Variables de entorno desde un .env, si viene uno ──────────────────
 *
 * En Render las variables las inyecta el panel y aquí no hay nada que hacer.
 * En un hosting donde el despliegue es un .zip no hay panel equivalente: la
 * única forma de configurar el servidor es un archivo dentro del paquete. Sin
 * esto, poner PAC_PROVIDER=SW_SAPIEN en un .env no surtía ningún efecto —
 * dotenv sólo se cargaba en el script `dev`— y el backend arrancaba en modo
 * simulación creyendo estar configurado.
 *
 * dotenv NO pisa lo que ya exista en el entorno, así que Render sigue mandando
 * sobre cualquier .env que se colara en el repo. El orden importa: primero el
 * panel, después el archivo.
 *
 * Se avisa cuál se usó, porque "de dónde salió esta variable" es justo la
 * pregunta que uno se hace cuando el PAC no timbra.
 */
const rutaEnv = path.join(__dirname, '..', '.env');
if (fs.existsSync(rutaEnv)) {
  try {
    require('dotenv').config({ path: rutaEnv });
    console.log(`[arranque] variables leídas de ${rutaEnv} (el entorno del proceso tiene prioridad)`);
  } catch (e) {
    console.warn(`[arranque] hay un .env pero no se pudo leer: ${e.message}`);
  }
}

const dir = (f) => path.join(__dirname, f);

/** Corre un script hijo heredando la salida. Devuelve el código de salida. */
function correr(script) {
  const r = spawnSync(process.execPath, [dir(script)], { stdio: 'inherit' });
  if (r.error) {
    console.error(`[arranque] no se pudo ejecutar ${script}: ${r.error.message}`);
    return 1;
  }
  return r.status === null ? 1 : r.status;
}

function banner(lineas) {
  const barra = '═'.repeat(72);
  console.log(`\n${barra}\n${lineas.join('\n')}\n${barra}\n`);
}

/* ── 0b. Estado del PAC, dicho en el arranque ─────────────────────────────
 * El módulo pac.service ya avisa, pero lo hace al importarse, enterrado entre
 * migraciones. Aquí queda arriba y en una sola línea que se puede buscar. */
const pacListo =
  process.env.PAC_PROVIDER === 'SW_SAPIEN' && !!process.env.SW_SAPIEN_TOKEN;
console.log(
  pacListo
    ? `[arranque] PAC: SW_SAPIEN (${process.env.SW_SAPIEN_ENV || 'sandbox'}) — timbrado REAL`
    : `[arranque] PAC: MOCK — timbrado SIMULADO. ` +
      `PAC_PROVIDER="${process.env.PAC_PROVIDER || '(vacío)'}", ` +
      `SW_SAPIEN_TOKEN ${process.env.SW_SAPIEN_TOKEN ? 'presente' : 'AUSENTE'}`
);

/* ── 1. Migraciones: requisito. Si fallan, no se arranca. ────────────────── */
const codigoMigraciones = correr('migrate-up.js');
if (codigoMigraciones !== 0) {
  banner([
    '  ARRANQUE ABORTADO: las migraciones no se aplicaron.',
    '',
    '  Esto SÍ es motivo para no levantar: el código quedaría hablando con una',
    '  base que no corresponde a su esquema. El error concreto está en las',
    '  líneas de [migrate] de arriba.',
  ]);
  process.exit(1);
}

/* ── 2. Datos de apoyo: avisan y siguen. ────────────────────────────────── */
const opcionales = [
  ['apply-cp-seed.js',             'catálogos del SAT para Carta Porte'],
  ['fix-cp-swap.js',               'corrección de columnas invertidas en colonias'],
  ['fix-cp-catalogos-faltantes.js', 'catálogos CP que el seed deja incompletos'],
  ['bootstrap-env.js',             'alta inicial de empresa y administrador'],
];

const fallidos = [];
for (const [script, descripcion] of opcionales) {
  if (correr(script) !== 0) fallidos.push({ script, descripcion });
}

if (fallidos.length > 0) {
  banner([
    `  ${fallidos.length} paso(s) de datos NO se completaron. El servidor SÍ arranca.`,
    '',
    ...fallidos.map((f) => `    · ${f.script} — ${f.descripcion}`),
    '',
    '  Qué significa: se puede facturar y timbrar con normalidad. Lo que puede',
    '  fallar es la captura que depende de esos datos — por ejemplo, un catálogo',
    '  de Carta Porte que aparezca vacío al buscar una clave.',
    '',
    '  El error de cada paso quedó arriba, en sus propias líneas de log.',
    '  Se reintentan solos en el próximo arranque: todos son idempotentes.',
  ]);
} else {
  console.log('[arranque] migraciones y datos de apoyo, completos.');
}

/* ── 3. El servidor. Reemplaza este proceso para que las señales de Render
 *     (SIGTERM al redesplegar) lleguen directo a la app y cierre limpio. ─── */
const servidor = spawnSync(process.execPath, [path.join(__dirname, '..', 'dist', 'index.js')], {
  stdio: 'inherit',
});
process.exit(servidor.status === null ? 1 : servidor.status);
