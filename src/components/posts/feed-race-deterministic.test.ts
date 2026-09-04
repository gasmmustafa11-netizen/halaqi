import fs from 'fs';

function ok(name: string) { console.log(`  ok   - ${name}`); return true; }
function fail(name: string, err: any) { console.log(`  FAIL - ${name}: ${err}`); return false; }

const src = fs.readFileSync('src/components/posts/PostsView.tsx', 'utf8');

let passed = 0;
let failed = 0;

function check(n: string, cond: boolean, msg?: string) {
  if (cond) { ok(n); passed++; } else { fail(n, msg || 'false'); failed++; }
}

check('handleRefresh increments token', src.includes('++refreshToken.current'));
check('loadMore reads token (no increment)', src.includes('const myToken = refreshToken.current'));
check('loadMore does not increment token', !src.slice(src.indexOf('loadMore')).includes('++refreshToken.current'));
check('loadMore discards stale by token', src.includes('if (myToken !== refreshToken.current)'));
check('loadMore blocked by refreshing', src.includes('loadingMore || refreshing || !hasMore || !nextCursor'));
check('Observer disabled during refresh', src.includes('!hasMore || refreshing'));

console.log(`\n=== Race protection test: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
