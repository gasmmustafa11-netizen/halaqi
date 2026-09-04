import pg from 'pg';
const { Client } = pg;

(async () => {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  try {
    // user_posts columns
    const userCols = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'user_posts' ORDER BY ordinal_position`);
    console.log('user_posts columns:', userCols.rows.map(r => r.column_name + ':' + r.data_type).join(', '));

    // idempotency_keys columns
    const idempCols = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'idempotency_keys' ORDER BY ordinal_position`);
    console.log('idempotency_keys columns:', idempCols.rows.map(r => r.column_name + ':' + r.data_type).join(', '));

    // Check if user_posts exists
    const exists = await client.query(`SELECT to_regclass('user_posts') as tbl`);
    console.log('user_posts regclass:', exists.rows[0].tbl);

    // Check media_type values
    const media = await client.query(`SELECT DISTINCT media_type FROM user_posts LIMIT 10`);
    console.log('media_type values:', media.rows.map(r => r.media_type));

    // Count user_posts
    const count = await client.query(`SELECT COUNT(*) as c FROM user_posts`);
    console.log('user_posts count:', count.rows[0].c);

    // Count salon_posts
    const salonCount = await client.query(`SELECT COUNT(*) as c FROM salon_posts`);
    console.log('salon_posts count:', salonCount.rows[0].c);
  } catch (e) {
    console.error('DB ERROR:', e.message || String(e));
  } finally {
    await client.end();
  }
})();
