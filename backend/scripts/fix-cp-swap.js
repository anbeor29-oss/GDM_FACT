#!/usr/bin/env node
/**
 * fix-cp-swap.js — corrige el bug del seed CP donde las columnas
 * codigo_postal ↔ descripcion (en sat_cp_colonia) y estado ↔ descripcion
 * (en sat_cp_municipio, sat_cp_localidad) llegaron INVERTIDAS del script
 * Python generate-carta-porte-seed.py de GDM_ALMACEN.
 *
 * IDEMPOTENTE: detecta si el swap ya se aplicó (verifica que la primera
 * fila tenga codigo_postal numérico de 5 dígitos). Si ya está bien, no-op.
 *
 * Se corre después de apply-cp-seed y antes de bootstrap-env en el
 * startCommand del blueprint V2.
 */
const { Client } = require('pg');

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error('[cp-swap] DATABASE_URL vacío'); process.exit(1); }
  const wantsSsl = process.env.DB_SSL === 'true' || /render\.com|oregon-postgres/.test(url);
  const client = new Client({
    connectionString: url,
    ssl: wantsSsl ? { rejectUnauthorized: false } : false,
  });
  await client.connect();

  // Check si ya está aplicado — si codigo_postal es numérico 5-dig, ya está bien.
  const check = await client.query(
    `SELECT COUNT(*) FILTER (WHERE codigo_postal ~ '^\\d{5}$') AS ok,
            COUNT(*) AS total
       FROM sat_cp_colonia`,
  );
  const { ok, total } = check.rows[0];
  if (Number(total) === 0) {
    console.log('[cp-swap] sat_cp_colonia vacío — asumiendo pre-seed, no-op.');
    await client.end(); return;
  }
  if (Number(ok) === Number(total)) {
    console.log(`[cp-swap] sat_cp_colonia OK (${total} filas con CP válido) — no-op.`);
    await client.end(); return;
  }

  console.log(`[cp-swap] Detectado bug de columnas invertidas (${total - ok}/${total} filas). Aplicando swap…`);

  try {
    await client.query('BEGIN');
    // sat_cp_colonia
    await client.query('ALTER TABLE sat_cp_colonia ADD COLUMN _tmp TEXT');
    await client.query('UPDATE sat_cp_colonia SET _tmp = codigo_postal');
    await client.query('UPDATE sat_cp_colonia SET codigo_postal = descripcion, descripcion = _tmp');
    await client.query('ALTER TABLE sat_cp_colonia DROP COLUMN _tmp');
    // sat_cp_municipio
    await client.query('ALTER TABLE sat_cp_municipio ADD COLUMN _tmp TEXT');
    await client.query('UPDATE sat_cp_municipio SET _tmp = estado');
    await client.query('UPDATE sat_cp_municipio SET estado = descripcion, descripcion = _tmp');
    await client.query('ALTER TABLE sat_cp_municipio DROP COLUMN _tmp');
    // sat_cp_localidad
    await client.query('ALTER TABLE sat_cp_localidad ADD COLUMN _tmp TEXT');
    await client.query('UPDATE sat_cp_localidad SET _tmp = estado');
    await client.query('UPDATE sat_cp_localidad SET estado = descripcion, descripcion = _tmp');
    await client.query('ALTER TABLE sat_cp_localidad DROP COLUMN _tmp');
    await client.query('COMMIT');
    console.log('[cp-swap] ✔ swap aplicado en las 3 tablas.');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[cp-swap] falló:', e.message);
    process.exit(1);
  }
  await client.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
