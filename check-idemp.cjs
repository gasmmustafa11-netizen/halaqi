const pg = require('pg');
const sql = new pg.Client({ connectionString: process.env.DATABASE_URL });
(async () => {
  await sql.connect();
  try {
    const checkTable = await sql.query(`SELECT to_regclass('idempotency_keys') as tbl`);
    console.log('idempotency_keys table exists:', checkTable.rows[0].tbl);
    if (checkTable.rows[0].tbl) {
      const cols = await sql.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'idempotency_keys' ORDER BY ordinal_position`);
      console.log('columns:', cols.rows.map(r => r.column_name));
    }
  } catch (e) {
    console.error('ERROR:', e.message);
  } finally {
    await sql.end();
  }
})();
