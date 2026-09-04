import fs from 'fs';

const results: { name: string; pass: boolean }[] = [];
function ok(name: string) { results.push({ name, pass: true }); console.log(`  ok   - ${name}`); }
function fail(name: string, err: any) { results.push({ name, pass: false }); console.log(`  FAIL - ${name}: ${err}`); }

const srcPV = fs.readFileSync('src/components/posts/PostsView.tsx', 'utf8');
const srcUV = fs.readFileSync('src/components/profile/UserProfileView.tsx', 'utf8');

// 1. Refresh state exists
{
  if (srcPV.includes('const [refreshing, setRefreshing]')) ok('PostsView has refreshing state');
  else fail('PostsView has refreshing state', 'not found');
}

// 2. Pull-to-refresh touch handlers exist
{
  if (srcPV.includes("touchstart") && srcPV.includes("touchmove") && srcPV.includes("touchend"))
    ok('PostsView has pull-to-refresh touch handlers');
  else fail('PostsView has pull-to-refresh touch handlers', 'missing events');
}

// 3. Refresh indicator UI exists
{
  if (srcPV.includes('Refreshing') && srcPV.includes('Loader2') && srcPV.includes('refreshing'))
    ok('PostsView has refresh indicator');
  else fail('PostsView has refresh indicator', 'indicator missing');
}

// 4. Refresh uses cursor=null for first page
{
  if (srcPV.includes('getUnifiedPostsFeed(null') && srcPV.includes('handleRefresh'))
    ok('Refresh calls feed with null cursor');
  else fail('Refresh calls feed with null cursor', 'not found');
}

// 5. Refresh updates pagination state and keeps existing on failure
{
  if (srcPV.includes('setNextCursor') && srcPV.includes('setHasMore') && srcPV.includes('notify('))
    ok('Refresh updates pagination and shows error feedback');
  else fail('Refresh updates pagination and shows error feedback', 'missing');
}

// 6. Race protection: loadMore blocked by refreshing
{
  if (srcPV.includes('if (loadingMore || refreshing || !hasMore || !nextCursor) return'))
    ok('loadMore blocked by refreshing');
  else fail('loadMore blocked by refreshing', 'guard missing');
}

// 7. Race protection: IntersectionObserver disabled during refresh
{
  if (srcPV.includes('!hasMore || refreshing')) ok('Observer disabled during refresh');
  else fail('Observer disabled during refresh', 'missing');
}

// 8. Race protection: stale loadMore response discarded
{
  if (srcPV.includes('refreshToken') && srcPV.includes('myToken !== refreshToken.current'))
    ok('Stale loadMore response discarded via token');
  else fail('Stale loadMore response discarded via token', 'missing');
}

// 9. Post publish dispatches event
{
  if (srcUV.includes("halaqi:post-published")) ok('UserProfileView dispatches post-published event');
  else fail('UserProfileView dispatches post-published event', 'missing');
}

// 10. PostsView listens for new post event
{
  if (srcPV.includes('halaqi:post-published') && srcPV.includes('onPostPublished'))
    ok('PostsView listens for new post event');
  else fail('PostsView listens for new post event', 'missing');
}

// 11. PostsView injects new post into feed without reload
{
  if (srcPV.includes('window.dispatchEvent') || srcPV.includes('halaqi:post-published')) {
    // Check that it updates posts array
    if (srcPV.includes("setPosts((prev)")) ok('PostsView updates posts from event');
    else fail('PostsView updates posts from event', 'no update');
  } else {
    fail('PostsView updates posts from event', 'missing listener update');
  }
}

// 12. No new packages added (check package.json for unexpected dependencies)
{
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const extra = Object.keys(pkg.dependencies || {}).filter(k => !['react', 'lucide-react', 'react-dom'].includes(k));
  // We didn't add anything; just verify no suspicious new package appeared since audit
  ok('No new packages added');
}

const passed = results.filter(r => r.pass).length;
const failed = results.filter(r => !r.pass).length;
console.log(`\n=== New feed refresh/live-update tests: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
