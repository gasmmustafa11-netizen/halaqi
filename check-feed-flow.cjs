const pg = require('pg');
const sqlClient = new pg.Client({ connectionString: process.env.DATABASE_URL });
(async () => {
  await sqlClient.connect();
  try {
    // Step 1: DB user_posts count
    const countRes = await sqlClient.query('SELECT COUNT(*) as c FROM user_posts');
    console.log('DB user_posts count:', countRes.rows[0].c);

    // Step 2: Check columns of user_posts
    const cols = await sqlClient.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'user_posts' ORDER BY ordinal_position`);
    const colNames = cols.rows.map(r => r.column_name);
    console.log('user_posts columns:', colNames.join(', '));

    // Step 3: Check if media_type exists
    console.log('media_type present:', colNames.includes('media_type'));
    console.log('duration present:', colNames.includes('duration'));

    // Step 4: Check idempotency_keys columns
    const idempCols = await sqlClient.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'idempotency_keys' ORDER BY ordinal_position`);
    console.log('idempotency_keys columns:', idempCols.rows.map(r => r.column_name).join(', '));

    // Step 5: Check if user_posts table has is_hidden and hidden_reason
    console.log('is_hidden present:', colNames.includes('is_hidden'));

    // Step 6: Try a simple SELECT mimicking getUnifiedPostsFeed (no viewer, no cursor)
    // We'll run a simplified version of the SQL
    const feedSQL = `
      SELECT up.id, 'user' AS post_type, up.user_id, up.image_url, up.caption, up.created_at, up.like_count, up.comment_count, up.media_type, up.duration
      FROM user_posts up
      WHERE up.is_hidden IS DISTINCT FROM true
      ORDER BY up.created_at DESC, up.id DESC
      LIMIT 6
    `;
    try {
      const feedRes = await sqlClient.query(feedSQL);
      console.log('Simplified feed query returned:', feedRes.rows.length, 'posts');
      if (feedRes.rows.length > 0) {
        console.log('First post:', feedRes.rows[0].id, feedRes.rows[0].post_type);
      }
    } catch (e) {
      console.error('Simplified feed query FAILED:', e.message);
    }

    // Step 7: Check salon_posts
    const salonRes = await sqlClient.query(`SELECT COUNT(*) as c FROM salon_posts`);
    console.log('salon_posts count:', salonRes.rows[0].c);
  } catch (e) {
    console.error('DB ERROR:', e.message);
  } finally {
    await sqlClient.end();
  }
})();
