const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);

(async () => {
  try {
    const userPostsCols = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'user_posts' ORDER BY ordinal_position`;
    console.log('=== user_posts columns ===');
    console.log(userPostsCols.map(c => c.column_name + ':' + c.data_type).join(', '));

    const idempCols = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'idempotency_keys' ORDER BY ordinal_position`;
    console.log('=== idempotency_keys columns ===');
    console.log(idempCols.map(c => c.column_name + ':' + c.data_type).join(', '));

    const exists = await sql`SELECT to_regclass('user_posts') as tbl`;
    console.log('=== user_posts exists ===');
    console.log('regclass:', exists[0].tbl);

    const media = await sql`SELECT DISTINCT media_type FROM user_posts LIMIT 10`;
    console.log('=== media_type values ===');
    console.log(media.map(m => m.media_type));

    const count = await sql`SELECT COUNT(*) as c FROM user_posts`;
    console.log('=== user_posts count ===');
    console.log('count:', count[0].c);

    const salonPosts = await sql`SELECT COUNT(*) as c FROM salon_posts`;
    console.log('=== salon_posts count ===');
    console.log('count:', salonPosts[0].c);
  } catch (e) {
    console.error('DB ERROR:', e.message || e);
  }
})();
