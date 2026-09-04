/**
 * F-06: Feed pagination tests
 *
 * Validates:
 *  - Cursor is (created_at, id) in chronological order
 *  - SQL uses (created_at, id) < cursor with ORDER BY created_at DESC, id DESC
 *  - score/diversity is within-page only (does not change cursor boundary)
 *  - nextCursor computed from oldest chronological element
 *  - limit default 20
 *  - hasMore via limit+1 detection
 *  - app.ts reads cursor/limit and returns nextCursor/hasMore
 *  - api.ts passes cursor/limit and returns nextCursor/hasMore
 *  - PostsView has infinite scroll
 */

import fs from 'fs';

const results: { name: string; pass: boolean }[] = [];
function ok(name: string) { results.push({ name, pass: true }); console.log(`  ok   - ${name}`); }
function fail(name: string, err: any) { results.push({ name, pass: false }); console.log(`  FAIL - ${name}: ${err}`); }

// Helper: read db getUnifiedPostsFeed body
function dbFeedBody(): string {
  const src = fs.readFileSync('src/server/db.ts', 'utf8');
  const start = src.indexOf('async getUnifiedPostsFeed(');
  const end = src.indexOf('async createUserPost(', start);
  return src.slice(start, end !== -1 ? end : start + 3000);
}

// 1. Signature accepts cursor/limit
{
  const sig = dbFeedBody();
  if (sig.includes('opts?: { cursor?: string | null; limit?: number }')) {
    ok('getUnifiedPostsFeed accepts cursor/limit opts');
  } else {
    fail('getUnifiedPostsFeed accepts cursor/limit opts', 'opts not found');
  }
}

// 2. SQL uses (created_at, id) < cursor
{
  const body = dbFeedBody();
  if (body.includes('(sp.created_at, sp.id) < (') && body.includes('(up.created_at, up.id) < (')) {
    ok('SQL cursor uses (created_at, id) < ... on both tables');
  } else {
    fail('SQL cursor uses (created_at, id) < ... on both tables', 'cursor clause not found');
  }
}

// 3. ORDER BY created_at DESC, id DESC
{
  const body = dbFeedBody();
  if (body.includes('ORDER BY created_at DESC, id DESC')) {
    ok('SQL orders by created_at DESC, id DESC');
  } else {
    fail('SQL orders by created_at DESC, id DESC', 'order clause not found');
  }
}

// 4. limit default 20
{
  const body = dbFeedBody();
  if (body.includes('opts?.limit ?? 20')) {
    ok('limit defaults to 20');
  } else {
    fail('limit defaults to 20', '?? 20 not found');
  }
}

// 5. hasMore via limit+1
{
  const body = dbFeedBody();
  const hasLimitPlus = body.includes(`LIMIT ${'${limit + 1}'}`);
  const hasTrim = body.includes('fetchRows.length > limit');
  if (hasLimitPlus && hasTrim) {
    ok('hasMore detected via limit+1 fetch then trim');
  } else {
    fail('hasMore detected via limit+1 fetch then trim', `limitPlus=${hasLimitPlus}, trim=${hasTrim}`);
  }
}

// 6. nextCursor from oldest chronological element (fetchRows, not ranked)
{
  const body = dbFeedBody();
  // nextCursor must use fetchRows (chronological), NOT ranked (score/diversity reorder)
  const usesFetchRows = body.includes('fetchRows[fetchRows.length - 1]');
  const usesCreatedAtIso = body.includes('boundary.created_at');
  const notFromRanked = !body.includes('ranked[ranked');
  if (usesFetchRows && usesCreatedAtIso && notFromRanked) {
    ok('nextCursor derived from oldest chronological element (fetchRows), not ranked');
  } else {
    fail('nextCursor derived from oldest chronological element (fetchRows), not ranked', `fetchRows=${usesFetchRows}, iso=${usesCreatedAtIso}, notRanked=${notFromRanked}`);
  }
}

// 7. Returns { posts, nextCursor, hasMore }
{
  const body = dbFeedBody();
  if (body.includes('return { posts: clean, nextCursor, hasMore }')) {
    ok('Returns { posts, nextCursor, hasMore }');
  } else {
    fail('Returns { posts, nextCursor, hasMore }', 'return shape not found');
  }
}

// 8. app.ts reads cursor/limit query params
{
  const src = fs.readFileSync('src/server/app.ts', 'utf8');
  const routeIdx = src.indexOf("'/api/posts/feed'");
  const route = src.slice(routeIdx, routeIdx + 1500);
  if (route.includes("req.query.cursor") && route.includes("req.query.limit")) {
    ok('app.ts reads cursor and limit from query params');
  } else {
    fail('app.ts reads cursor and limit from query params', 'query params not found');
  }
}

// 9. app.ts returns nextCursor and hasMore
{
  const src = fs.readFileSync('src/server/app.ts', 'utf8');
  const routeIdx = src.indexOf("'/api/posts/feed'");
  const route = src.slice(routeIdx, routeIdx + 1500);
  if (route.includes('nextCursor: feed.nextCursor') && route.includes('hasMore: feed.hasMore')) {
    ok('app.ts returns nextCursor and hasMore');
  } else {
    fail('app.ts returns nextCursor and hasMore', 'response fields not found');
  }
}

// 10. api.ts passes cursor/limit and returns them
{
  const src = fs.readFileSync('src/services/api.ts', 'utf8');
  const fnIdx = src.indexOf('async getUnifiedPostsFeed(');
  const fn = src.slice(fnIdx, fnIdx + 1200);
  if (fn.includes('cursor?: string | null, limit: number = 20') &&
      fn.includes("params.set('limit'") && fn.includes("params.set('cursor'") &&
      fn.includes('nextCursor:') && fn.includes('hasMore:')) {
    ok('api.ts accepts cursor/limit and returns nextCursor/hasMore');
  } else {
    fail('api.ts accepts cursor/limit and returns nextCursor/hasMore', 'signature/params not found');
  }
}

// 11. PostsView has IntersectionObserver infinite scroll
{
  const src = fs.readFileSync('src/components/posts/PostsView.tsx', 'utf8');
  if (src.includes('IntersectionObserver') && src.includes('loadMore') && src.includes('sentinelRef')) {
    ok('PostsView implements IntersectionObserver infinite scroll');
  } else {
    fail('PostsView implements IntersectionObserver infinite scroll', 'observer not found');
  }
}

// 12. score/diversity are within-page (diversify operates on the already-limited posts)
{
  // Within the db function, `diversify(posts)` runs AFTER `posts` were trimmed to `limit`.
  // Verify LIMIT is applied before diversify and diversify never re-fetches or drops beyond page.
  const body = dbFeedBody();
  // The trim (slice to limit) happens on fetchRows before mapping to posts.
  // diversify(posts) reorders within posts (the page) only.
  if (body.includes('const ranked = diversify(posts)') && body.includes('fetchRows = fetchRows.slice(0, limit)')) {
    ok('score/diversity operate within the fetched page only (no cross-page cursor change)');
  } else {
    fail('score/diversity operate within the fetched page only (no cross-page cursor change)', 'not found');
  }
}

// ─── Summary ───
const passed = results.filter(r => r.pass).length;
const failed = results.filter(r => !r.pass).length;
console.log(`\n=== F-06 feed pagination test results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
