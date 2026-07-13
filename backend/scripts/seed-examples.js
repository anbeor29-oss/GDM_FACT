/**
 * seed-examples (CLI) — carga datos de ejemplo en UNA empresa (por RFC) para
 * demostrar el sistema (POS, facturación, inventario). Idempotente.
 *
 * JS plano (sin ts-node) para que corra igual en tu PowerShell local y en el
 * shell de Render. Reutiliza la lógica de scripts/example-data.js.
 *
 * Uso:
 *   npm run seed:examples -- EKU9003173C9
 *   (local: pon DATABASE_URL en backend/.env apuntando a la BD destino)
 */
const { Pool } = require('pg');
const { seedExamples } = require('./example-data');

function buildPool() {
  const url = process.env.DATABASE_URL;
  if (url) {
    return new Pool({
      connectionString: url,
      ssl: /render\.com|oregon-postgres/.test(url) ? { rejectUnauthorized: false } : undefined,
    });
  }
  return new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'app_user',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'cfdi_erp',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });
}

async function main() {
  const rfc = process.argv.slice(2).find((a) => !a.startsWith('--'));
  if (!rfc) {
    console.error('❌ Uso: npm run seed:examples -- <RFC>');
    process.exit(1);
  }
  const RFC = rfc.toUpperCase();
  const pool = buildPool();
  const c = await pool.connect();
  try {
    const compR = await c.query('SELECT id, business_name FROM companies WHERE rfc = $1', [RFC]);
    if (compR.rows.length === 0) {
      console.error(`❌ No existe empresa ${RFC}`);
      process.exit(1);
    }
    const companyId = compR.rows[0].id;
    console.log(`📦 Sembrando ejemplos en ${compR.rows[0].business_name} (${RFC})`);

    const { products, customers } = await seedExamples(c, companyId);
    console.log(`✅ Listo: ${products} productos y ${customers} clientes nuevos (los existentes se omiten).`);
  } finally {
    c.release();
    await pool.end();
  }
}

main().catch((e) => { console.error('❌ Error:', e.message); process.exit(1); });
