#!/usr/bin/env node
/**
 * build-manual-icons.js — extrae los trazos de lucide para el manual en PDF.
 *
 * POR QUÉ EXISTE
 * El manual dibujaba sus iconos a mano, trazo por trazo, en manual-icons.js.
 * Funcionaban, pero eran una imitación: parecidos a los de la pantalla, no los
 * mismos. Cuando el usuario compara el manual con el sistema abierto al lado,
 * la diferencia se nota y resta confianza al documento.
 *
 * La página usa lucide-react. Este script lee esos mismos iconos de
 * node_modules y los vuelca como datos —la lista de primitivas de cada uno— en
 * manual-icons-lucide.js, que el generador del PDF dibuja con PDFKit.
 *
 * Se genera en vez de copiarse a mano por una razón: al actualizar lucide, los
 * iconos del manual se actualizan volviendo a correr esto. Copiados a mano,
 * quedarían congelados en la versión del día que se copiaron, y nadie se
 * acordaría de revisarlos.
 *
 * Uso:  node scripts/build-manual-icons.js
 */
const fs = require('fs');
const path = require('path');

/* Dónde vive lucide. Se busca en el frontend porque es su dependencia, no del
 * backend: el manual es lo único del backend que necesita estos trazos. */
const CANDIDATOS = [
  path.join(__dirname, '..', '..', 'frontend', 'node_modules', 'lucide-react', 'dist', 'esm', 'icons'),
  path.join(__dirname, '..', 'node_modules', 'lucide-react', 'dist', 'esm', 'icons'),
];
const DIR = CANDIDATOS.find((d) => fs.existsSync(d));
if (!DIR) {
  console.error('No se encontró lucide-react. Instala las dependencias del frontend primero.');
  process.exit(1);
}

/* Nombre en el manual → nombre del archivo en lucide.
 *
 * La izquierda son los nombres que ya usa generate-manual-v2.js; se conservan
 * para no tocar cada llamada. La derecha es el icono de lucide que la página
 * usa para ese mismo concepto, de modo que manual y pantalla coincidan. */
const MAPA = {
  home: 'home',
  receipt: 'receipt',
  truck: 'truck',
  box: 'box',
  users: 'users',
  inbox: 'inbox',
  chart: 'bar-chart-3',
  contract: 'file-signature',
  pdf: 'file-text',
  file: 'file-text',
  download: 'download',
  eye: 'eye',
  ship: 'ship',
  pencil: 'pencil',
  stamp: 'stamp',
  wallet: 'wallet',
  coins: 'coins',
  mail: 'mail',
  history: 'history',
  ban: 'ban',
  pin: 'map-pin',
  shield: 'shield-check',
  driver: 'user',
  building: 'building-2',
  // Los módulos que se agregaron a la página y no existían en el manual.
  scan: 'scan-text',
  upload: 'file-up',
  creditnote: 'file-minus-2',
  qr: 'qr-code',
  package: 'package-search',
  badge: 'badge-check',
  exchange: 'arrow-left-right',
  bank: 'landmark',
  key: 'key-round',
  clipboard: 'clipboard-check',
  send: 'send',
  book: 'book-open',
  check: 'check',
  rocket: 'rocket',
  star: 'star',
  zap: 'zap',
};

/** Extrae el arreglo de primitivas del módulo de un icono de lucide. */
function leerIcono(archivo) {
  const src = fs.readFileSync(path.join(DIR, archivo + '.js'), 'utf8');
  const i = src.indexOf('createLucideIcon(');
  if (i < 0) return null;
  const ini = src.indexOf('[', i);
  // Contar corchetes para tomar el arreglo completo, que está anidado.
  let nivel = 0, fin = -1;
  for (let k = ini; k < src.length; k++) {
    if (src[k] === '[') nivel++;
    else if (src[k] === ']') { nivel--; if (nivel === 0) { fin = k; break; } }
  }
  if (fin < 0) return null;
  const crudo = src.slice(ini, fin + 1);
  // El literal trae `key:` que no aporta nada al dibujo; se descarta para que
  // el archivo generado no pese el doble en datos inútiles.
  let arr;
  try { arr = eval(crudo); } catch (e) { return null; }
  return arr.map(([tag, attrs]) => {
    const a = { ...attrs };
    delete a.key;
    return [tag, a];
  });
}

const salida = {};
const faltantes = [];
for (const [nombre, archivo] of Object.entries(MAPA)) {
  if (!fs.existsSync(path.join(DIR, archivo + '.js'))) { faltantes.push(`${nombre} → ${archivo}`); continue; }
  const trazos = leerIcono(archivo);
  if (!trazos) { faltantes.push(`${nombre} (no se pudo leer)`); continue; }
  salida[nombre] = trazos;
}

const destino = path.join(__dirname, 'manual-icons-lucide.js');
fs.writeFileSync(destino,
  '/* ARCHIVO GENERADO — no editar a mano.\n' +
  ' * Se regenera con: node scripts/build-manual-icons.js\n' +
  ' * Trazos tomados de lucide-react, los mismos iconos que usa la página.\n' +
  ' * Sistema de coordenadas: viewBox de 24x24, trazo 2.\n' +
  ' */\n' +
  'module.exports = ' + JSON.stringify(salida, null, 1) + ';\n',
  'utf8');

console.log(`✔ ${Object.keys(salida).length} iconos escritos en manual-icons-lucide.js`);
if (faltantes.length) {
  console.log('  No encontrados (se seguirá usando el trazo dibujado a mano):');
  faltantes.forEach((f) => console.log('   · ' + f));
}
