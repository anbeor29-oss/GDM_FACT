#!/usr/bin/env node
/**
 * borrar-empresa.js — elimina una empresa y TODO lo que cuelga de ella.
 *
 * Uso:
 *   node scripts/borrar-empresa.js EKU9003173C9
 *   node scripts/borrar-empresa.js EKU9003173C9 --confirmar
 *
 * Sin --confirmar sólo cuenta lo que borraría y no toca nada.
 *
 * POR QUÉ NO ES UN `DELETE FROM companies`
 * Los datos de una empresa no viven en una tabla: viven en un árbol. Las
 * facturas cuelgan de la empresa, las partidas de la factura, los pagos de la
 * factura, los movimientos de inventario del producto. Un DELETE directo choca
 * con la primera llave foránea y no borra nada, o —peor, si algún día alguien
 * pone ON DELETE SET NULL para "arreglarlo"— deja partidas huérfanas que
 * reaparecen en los reportes sin dueño.
 *
 * Así que el árbol se descubre solo, leyendo information_schema, y se borra de
 * las hojas hacia la raíz. Descubrirlo en vez de escribir la lista a mano
 * importa: la lista se queda vieja al mes siguiente, cuando alguien agregue una
 * tabla y no se acuerde de este script.
 *
 * ES IRREVERSIBLE. Pensado para quitar la empresa de DEMOSTRACIÓN del PAC
 * (EKU9003173C9 — ESCUELA KEMPER URGATE, el RFC de pruebas de SW) de una base
 * que ya opera en real.
 */
const { Pool } = require('pg');

const RFC = (process.argv[2] || '').toUpperCase();
const CONFIRMADO = process.argv.includes('--confirmar');

if (!RFC) {
  console.error('Falta el RFC.  Uso: node scripts/borrar-empresa.js <RFC> [--confirmar]');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost')
    ? false
    : { rejectUnauthorized: false },
});

/** Llaves foráneas que apuntan a `tabla`: quién es hijo de quién. */
async function hijosDe(cli, tabla) {
  const r = await cli.query(
    `SELECT tc.table_name  AS tabla_hija,
            kcu.column_name AS col_hija,
            ccu.column_name AS col_padre
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON kcu.constraint_name = tc.constraint_name
       JOIN information_schema.constraint_column_usage ccu
         ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND ccu.table_name = $1
        AND tc.table_schema = 'public'`,
    [tabla]
  );
  return r.rows;
}

const borradas = [];

/**
 * Borra `tabla` donde `condicion` (SQL con $1 = id de la empresa), después de
 * borrar recursivamente a sus hijos.
 *
 * `visitadas` corta los ciclos. Los hay de verdad: una factura puede referirse a
 * otra factura (las notas de crédito relacionan la original), y sin este corte
 * el script se llamaría a sí mismo hasta reventar la pila.
 */
async function borrarEnCascada(cli, tabla, condicion, visitadas, id) {
  if (visitadas.has(tabla)) return;
  const propias = new Set(visitadas);
  propias.add(tabla);

  for (const h of await hijosDe(cli, tabla)) {
    if (propias.has(h.tabla_hija)) continue;
    await borrarEnCascada(
      cli,
      h.tabla_hija,
      `${h.col_hija} IN (SELECT ${h.col_padre} FROM ${tabla} WHERE ${condicion})`,
      propias,
      id
    );
  }

  const sql = `DELETE FROM ${tabla} WHERE ${condicion}`;
  if (CONFIRMADO) {
    const r = await cli.query(sql, [id]);
    if (r.rowCount) borradas.push(`${tabla}: ${r.rowCount}`);
  } else {
    const r = await cli.query(
      `SELECT COUNT(*)::int AS n FROM ${tabla} WHERE ${condicion}`,
      [id]
    );
    if (r.rows[0].n) borradas.push(`${tabla}: ${r.rows[0].n}`);
  }
}

(async () => {
  const cli = await pool.connect();
  try {
    const emp = await cli.query(
      `SELECT id, rfc, business_name FROM companies WHERE rfc = $1`,
      [RFC]
    );
    if (!emp.rows.length) {
      console.log(`No hay ninguna empresa con RFC ${RFC}. No hay nada que borrar.`);
      return;
    }
    const { id, business_name } = emp.rows[0];
    console.log(`Empresa: ${RFC} — ${business_name}`);
    console.log(CONFIRMADO ? 'MODO REAL: se va a borrar.\n' : 'SIMULACIÓN (agrega --confirmar para borrar de verdad).\n');

    /* Todo en UNA transacción: si algo falla a media cascada, una base con la
     * empresa a medio borrar sería peor que no haber empezado. */
    await cli.query('BEGIN');
    await borrarEnCascada(cli, 'companies', 'id = $1', new Set(), id);
    if (CONFIRMADO) {
      await cli.query('COMMIT');
    } else {
      await cli.query('ROLLBACK');
    }

    if (!borradas.length) {
      console.log('No se encontraron filas ligadas a esa empresa.');
    } else {
      console.log(CONFIRMADO ? 'Filas borradas:' : 'Filas que se borrarían:');
      for (const l of borradas) console.log('  ' + l);
    }
    if (!CONFIRMADO) console.log('\nNada se modificó. Vuelve a correrlo con --confirmar.');
  } catch (e) {
    try { await cli.query('ROLLBACK'); } catch {}
    console.error(`\nFalló y no se borró nada: ${e.message}`);
    process.exitCode = 1;
  } finally {
    cli.release();
    await pool.end();
  }
})();
