/* =========================================================
   Phase-2 regression tests: BUG-04 (serverless rate-limit store),
   BUG-07/12 (password policy), BUG-13 (Iraqi phone normalization).
   Run:  npx tsx src/server/phase2-bugs.test.ts
   ========================================================= */
import { normalizePhone, phoneVariants } from './db.js';
import { NeonRateLimitStore } from './rateLimitStore.js';

let passed = 0;
let failed = 0;

function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    passed++;
    console.log(`  ok   - ${label}`);
  } else {
    failed++;
    console.error(`  FAIL - ${label}${detail ? ': ' + detail : ''}`);
  }
}

function assertEq(label: string, actual: unknown, expected: unknown) {
  const ok = actual === expected;
  check(label, ok, ok ? undefined : `got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
}

function assertIncludes(label: string, actual: string, needle: string) {
  check(label, actual.includes(needle), `got ${JSON.stringify(actual)}`);
}

/* =========================================================
   BUG-13: normalizePhone
   ========================================================= */
console.log('\n--- BUG-13: normalizePhone ---');

// Already canonical
assertEq('canonical +9647801234567', normalizePhone('+9647801234567'), '9647801234567');
assertEq('canonical 9647801234567', normalizePhone('9647801234567'), '9647801234567');

// With + prefix
assertEq('+ prefix → strip +', normalizePhone('+9647801234567'), '9647801234567');

// 11-digit national (07...) → strip leading 0, prepend 964
assertEq('07801234567 → 964...', normalizePhone('07801234567'), '9647801234567');
assertEq('07999999999', normalizePhone('07999999999'), '9647999999999');

// 10-digit without leading 0 (7...) → prepend 964
assertEq('7801234567 → 964...', normalizePhone('7801234567'), '9647801234567');

// 10-digit with leading 0 but not mobile prefix (05...) → 0+964 prefix form
assertEq('0567890123 → stripped to 567890123', normalizePhone('0567890123'), '964567890123');

// Extra spaces, dashes, etc. — strip non-digits after detecting prefix
assertEq('spaced 0780 123 4567', normalizePhone('0780 123 4567'), '9647801234567');
assertEq('dashed +964-780-123-4567', normalizePhone('+964-780-123-4567'), '9647801234567');

// Too short / unrecognized → falls back to trimmed raw (never corrupts)
assertEq('short 07', normalizePhone('07'), '07');
assertEq('unrecognized abc123', normalizePhone('abc123'), 'abc123');

// Empty string
assertEq('empty → empty', normalizePhone(''), '');

// Exactly 10 digits without 0 prefix (mobile: 7...)
assertEq('raw 10-digit mobile 7XXXXXXXXX', normalizePhone('7801234567'), '9647801234567');

/* =========================================================
   BUG-13: phoneVariants
   ========================================================= */
console.log('\n--- BUG-13: phoneVariants ---');

const v1 = phoneVariants('07801234567');
check('07801234567 includes canonical', v1.includes('9647801234567'));
check('07801234567 includes +964...', v1.includes('+9647801234567'));
check('07801234567 includes 07...', v1.includes('07801234567'));
check('07801234567 includes 7...', v1.includes('7801234567'));

const v2 = phoneVariants('+9647801234567');
check('+964... includes canonical', v2.includes('9647801234567'));
check('+964... includes +964', v2.includes('+9647801234567'));

const v3 = phoneVariants('7801234567');
check('7... includes canonical', v3.includes('9647801234567'));
check('7... includes 07801234567', v3.includes('07801234567'));

const v4 = phoneVariants('07');
check('short falls back to raw', v4.includes('07'));
check('short length 1', v4.length === 1);

/* =========================================================
   BUG-04: NeonRateLimitStore.increment — fake executor
   ========================================================= */
console.log('\n--- BUG-04: NeonRateLimitStore increment/reset window ---');

// In-memory table simulation
type Row = { key: string; hits: number; reset_at: Date };
const table = new Map<string, Row>();

function fakeSql(strings: TemplateStringsArray, ...values: any[]): Promise<any[]> {
  const joined = strings.join('?');
  const isInsert = joined.includes('INSERT INTO rate_limits');
  const isSelect = joined.includes('SELECT hits, reset_at');
  const isDelete = joined.includes('DELETE FROM rate_limits');
  const isUpdateHits = joined.includes('GREATEST(hits - 1, 0)');

  if (isDelete && joined.includes('WHERE')) {
    // values[0] = key
    table.delete(values[0] as string);
    return Promise.resolve([]);
  }
  if (isDelete && !joined.includes('WHERE')) {
    table.clear();
    return Promise.resolve([]);
  }
  if (isUpdateHits) {
    // values[0] = key
    const key = values[0] as string;
    const row = table.get(key);
    if (row) row.hits = Math.max(row.hits - 1, 0);
    return Promise.resolve([]);
  }
  if (isSelect) {
    // values[0] = key
    const key = values[0] as string;
    const row = table.get(key);
    if (!row) return Promise.resolve([]);
    return Promise.resolve([{ hits: row.hits, reset_at: row.reset_at }]);
  }
  if (isInsert) {
    // values[0] = key, values[1] = windowMs
    const key = values[0] as string;
    const windowMs = values[1] as number;
    const now = new Date();
    const existing = table.get(key);
    if (!existing || existing.reset_at <= now) {
      const row: Row = { key, hits: 1, reset_at: new Date(now.getTime() + windowMs) };
      table.set(key, row);
      return Promise.resolve([{ hits: row.hits, reset_at: row.reset_at }]);
    } else {
      existing.hits += 1;
      return Promise.resolve([{ hits: existing.hits, reset_at: existing.reset_at }]);
    }
  }
  return Promise.resolve([]);
}

const store = new NeonRateLimitStore('test:', fakeSql as any, { skipTableInit: true });

(async () => {
  console.log('  (async increment tests)');
  table.clear();

  // First hit: totalHits=1
  const r1 = await store.increment('a');
  assertEq('first hit totalHits=1', r1.totalHits, 1);
  check('first hit resetTime is future', r1.resetTime.getTime() > Date.now());

  // Second hit: totalHits=2
  const r2 = await store.increment('a');
  assertEq('second hit totalHits=2', r2.totalHits, 2);

  // Different key: independent counter
  const r3 = await store.increment('b');
  assertEq('different key totalHits=1', r3.totalHits, 1);

  // Simulate window expiry: set reset_at to past
  const row = table.get('test:a')!;
  row.reset_at = new Date(Date.now() - 1000);
  const r4 = await store.increment('a');
  assertEq('after expiry totalHits=1 (reset)', r4.totalHits, 1);

  // get
  const g1 = await store.get('a');
  check('get returns row', g1 !== undefined);

  const g2 = await store.get('nonexistent');
  check('get nonexistent returns undefined', g2 === undefined);

  // decrement
  await store.decrement('a');
  const g3 = await store.get('a');
  assertEq('after decrement', g3!.totalHits, 0);

  // resetKey
  await store.resetKey('a');
  const g4 = await store.get('a');
  check('after resetKey, gone', g4 === undefined);

  // resetAll
  await store.increment('x');
  await store.increment('y');
  await store.resetAll();
  const g5 = await store.get('x');
  const g6 = await store.get('y');
  check('after resetAll, x gone', g5 === undefined);
  check('after resetAll, y gone', g6 === undefined);

  /* =========================================================
     BUG-07/12: Password policy (server-side guard mirror)
     ========================================================= */
  console.log('\n--- BUG-07/12: Password policy guards ---');

  // The server validates: password must be provided and >= 8 chars.
  // We test the same guard logic here.
  function validatePassword(pw: string | undefined): string | null {
    if (!pw || !pw.trim()) return 'كلمة المرور مطلوبة وأن لا تقل عن 8 أحرف.';
    if (pw.trim().length < 8) return 'كلمة المرور مطلوبة وأن لا تقل عن 8 أحرف.';
    return null;
  }
  function validateConfirm(pw: string, confirm: string): boolean {
    return pw === confirm;
  }

  check('empty password rejected', validatePassword('') !== null);
  check('undefined password rejected', validatePassword(undefined) !== null);
  check('short password rejected', validatePassword('1234567') !== null);
  check('7-char rejected', validatePassword('abcdefg') !== null);
  check('8-char accepted', validatePassword('abcdefgh') === null);
  check('long password accepted', validatePassword('a'.repeat(100)) === null);
  check('spaces-only rejected', validatePassword('        ') !== null);

  check('confirm match', validateConfirm('abc12345', 'abc12345') === true);
  check('confirm mismatch', validateConfirm('abc12345', 'abc1234X') === false);

  /* =========================================================
     BUG-04: Rate limiter configuration checks
     ========================================================= */
  console.log('\n--- BUG-04: Rate limiter config checks ---');

  // Verify prefix isolation (different limiters use different prefixes)
  const storeA = new NeonRateLimitStore('login:');
  const storeB = new NeonRateLimitStore('register:');
  assertEq('login prefix', (storeA as any).dbPrefix, 'login:');
  assertEq('register prefix', (storeB as any).dbPrefix, 'register:');

  // fullKey prepends prefix
  const storeC = new NeonRateLimitStore('checkusername:');
  assertEq('fullKey prepends prefix', (storeC as any).fullKey('ip:1.2.3.4'), 'checkusername:ip:1.2.3.4');

  /* =========================================================
     Summary
     ========================================================= */
  console.log(`\n=== Phase-2 test results: ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
})();
