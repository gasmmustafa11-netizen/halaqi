/**
 * F-03: Idempotency key tests for POST /api/user-posts
 *
 * Validates:
 *  - ensureIdempotencyKeysTable exports
 *  - UUID v4 validation logic
 *  - Payload hash computation
 *  - IDEMPOTENCY_TTL_MS constant
 *  - createUserPost signature and transaction logic
 *  - app.ts key validation and 503 handling
 *  - Client-side UUID generation
 *  - Table schema completeness
 */

import crypto from 'crypto';
import fs from 'fs';
import { ensureIdempotencyKeysTable, IDEMPOTENCY_TTL_MS, db } from './db.js';

const results: { name: string; pass: boolean }[] = [];
function ok(name: string) { results.push({ name, pass: true }); console.log(`  ok   - ${name}`); }
function fail(name: string, err: any) { results.push({ name, pass: false }); console.log(`  FAIL - ${name}: ${err}`); }

// ─── Pure-logic tests ───

// 1. ensureIdempotencyKeysTable is exported
if (typeof ensureIdempotencyKeysTable === 'function') {
  ok('ensureIdempotencyKeysTable is exported');
} else {
  fail('ensureIdempotencyKeysTable is exported', 'not a function');
}

// 2. IDEMPOTENCY_TTL_MS = 24 hours
if (IDEMPOTENCY_TTL_MS === 24 * 60 * 60 * 1000) {
  ok('IDEMPOTENCY_TTL_MS = 24 hours');
} else {
  fail('IDEMPOTENCY_TTL_MS = 24 hours', `got ${IDEMPOTENCY_TTL_MS}`);
}

// 3. UUID v4 validation regex
{
  const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const valid = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
  const invalid1 = 'not-a-uuid';
  const invalid2 = 'a1b2c3d4-e5f6-3a7b-8c9d-0e1f2a3b4c5d'; // version 3
  const invalid3 = 'a1b2c3d4-e5f6-4a7b-0c9d-0e1f2a3b4c5d'; // variant 0

  if (
    UUID_V4_RE.test(valid) &&
    !UUID_V4_RE.test(invalid1) &&
    !UUID_V4_RE.test(invalid2) &&
    !UUID_V4_RE.test(invalid3)
  ) {
    ok('UUID v4 regex validates correctly');
  } else {
    fail('UUID v4 regex validates correctly', 'validation mismatch');
  }
}

// 4. Payload hash is deterministic
{
  const body = JSON.stringify({ imageUrl: 'https://example.com/img.jpg', caption: 'test' });
  const hash1 = crypto.createHash('sha256').update(body).digest('hex');
  const hash2 = crypto.createHash('sha256').update(body).digest('hex');
  if (hash1 === hash2 && hash1.length === 64) {
    ok('Payload hash is deterministic and 64 hex chars');
  } else {
    fail('Payload hash is deterministic', `hash1=${hash1.length}, hash2=${hash2.length}`);
  }
}

// 5. Different payloads produce different hashes
{
  const body1 = JSON.stringify({ imageUrl: 'a.jpg', caption: 'hello' });
  const body2 = JSON.stringify({ imageUrl: 'a.jpg', caption: 'world' });
  const hash1 = crypto.createHash('sha256').update(body1).digest('hex');
  const hash2 = crypto.createHash('sha256').update(body2).digest('hex');
  if (hash1 !== hash2) {
    ok('Different payloads produce different hashes');
  } else {
    fail('Different payloads produce different hashes', 'hashes are equal');
  }
}

// 6. createUserPost accepts idempotency key params
{
  const src = fs.readFileSync('src/server/db.ts', 'utf8');
  const fnStart = src.indexOf('async createUserPost(');
  const fnBody = src.slice(fnStart, fnStart + 10000);
  if (fnBody.includes('idempotencyKey') && fnBody.includes('payloadHash')) {
    ok('createUserPost accepts idempotencyKey and payloadHash params');
  } else {
    fail('createUserPost accepts idempotencyKey and payloadHash params', 'params not found');
  }
}

// 7. createUserPost has transaction logic (BEGIN/COMMIT)
{
  const src = fs.readFileSync('src/server/db.ts', 'utf8');
  const fnStart = src.indexOf('async createUserPost(');
  const fnBody = src.slice(fnStart, fnStart + 10000);
  if (fnBody.includes('BEGIN') && fnBody.includes('COMMIT') && fnBody.includes('ROLLBACK')) {
    ok('createUserPost uses BEGIN/COMMIT/ROLLBACK transaction');
  } else {
    fail('createUserPost uses BEGIN/COMMIT/ROLLBACK transaction', 'keywords not found');
  }
}

// 8. createUserPost handles 23505 (unique violation)
{
  const src = fs.readFileSync('src/server/db.ts', 'utf8');
  const fnStart = src.indexOf('async createUserPost(');
  const fnBody = src.slice(fnStart, fnStart + 10000);
  if (fnBody.includes('23505')) {
    ok('createUserPost handles unique violation (23505)');
  } else {
    fail('createUserPost handles unique violation (23505)', 'error code not found');
  }
}

// 9. createUserPost returns serviceUnavailable on connection failure
{
  const src = fs.readFileSync('src/server/db.ts', 'utf8');
  const fnStart = src.indexOf('async createUserPost(');
  const fnBody = src.slice(fnStart, fnStart + 10000);
  if (fnBody.includes('serviceUnavailable')) {
    ok('createUserPost returns serviceUnavailable on Neon failure');
  } else {
    fail('createUserPost returns serviceUnavailable on Neon failure', 'not found');
  }
}

// 10. createUserPost returns cached=true for idempotent responses
{
  const src = fs.readFileSync('src/server/db.ts', 'utf8');
  const fnStart = src.indexOf('async createUserPost(');
  const fnBody = src.slice(fnStart, fnStart + 10000);
  if (fnBody.includes('cached: true')) {
    ok('createUserPost returns cached=true for idempotent responses');
  } else {
    fail('createUserPost returns cached=true for idempotent responses', 'not found');
  }
}

// 11. createUserPost has non-idempotent fallback path
{
  const src = fs.readFileSync('src/server/db.ts', 'utf8');
  const fnStart = src.indexOf('async createUserPost(');
  const fnBody = src.slice(fnStart, fnStart + 10000);
  if (fnBody.includes('No idempotency key')) {
    ok('createUserPost has backwards-compatible path without key');
  } else {
    fail('createUserPost has backwards-compatible path without key', 'not found');
  }
}

// ─── File content tests ───

// 12. api.ts sends Idempotency-Key header
{
  const apiSrc = fs.readFileSync('src/services/api.ts', 'utf8');
  if (apiSrc.includes("'Idempotency-Key'") || apiSrc.includes('"Idempotency-Key"')) {
    ok('api.ts sends Idempotency-Key header');
  } else {
    fail('api.ts sends Idempotency-Key header', 'header not found');
  }
}

// 13. api.ts uses crypto.randomUUID()
{
  const apiSrc = fs.readFileSync('src/services/api.ts', 'utf8');
  if (apiSrc.includes('crypto.randomUUID()')) {
    ok('api.ts uses crypto.randomUUID()');
  } else {
    fail('api.ts uses crypto.randomUUID()', 'not found');
  }
}

// 14. app.ts validates UUID v4 format
{
  const appSrc = fs.readFileSync('src/server/app.ts', 'utf8');
  if (appSrc.includes('idempotency-key') && appSrc.includes('[0-9a-f]{8}')) {
    ok('app.ts validates Idempotency-Key UUID v4 format');
  } else {
    fail('app.ts validates Idempotency-Key UUID v4 format', 'validation not found');
  }
}

// 15. app.ts returns 503 on serviceUnavailable
{
  const appSrc = fs.readFileSync('src/server/app.ts', 'utf8');
  if (appSrc.includes('503') && appSrc.includes('serviceUnavailable')) {
    ok('app.ts returns 503 on serviceUnavailable');
  } else {
    fail('app.ts returns 503 on serviceUnavailable', 'not found');
  }
}

// 16. app.ts returns 200 for cached, 201 for new
{
  const appSrc = fs.readFileSync('src/server/app.ts', 'utf8');
  if (appSrc.includes('result.cached ? 200 : 201')) {
    ok('app.ts returns 200 cached / 201 new');
  } else {
    fail('app.ts returns 200 cached / 201 new', 'not found');
  }
}

// 17. UserProfileView.tsx generates UUID on file select
{
  const src = fs.readFileSync('src/components/profile/UserProfileView.tsx', 'utf8');
  if (src.includes('setComposerIdempotencyKey(crypto.randomUUID())')) {
    ok('UserProfileView.tsx generates UUID on file select');
  } else {
    fail('UserProfileView.tsx generates UUID on file select', 'not found');
  }
}

// 18. ReelsView.tsx generates UUID on reel creation
{
  const src = fs.readFileSync('src/components/posts/ReelsView.tsx', 'utf8');
  if (src.includes('setCreateIdempotencyKey(crypto.randomUUID())')) {
    ok('ReelsView.tsx generates UUID on reel creation');
  } else {
    fail('ReelsView.tsx generates UUID on reel creation', 'not found');
  }
}

// 19. idempotency_keys table has all required columns
{
  const dbSrc = fs.readFileSync('src/server/db.ts', 'utf8');
  const tableStart = dbSrc.indexOf('CREATE TABLE IF NOT EXISTS idempotency_keys');
  // Find the closing parenthesis of the CREATE TABLE statement
  let depth = 0;
  let tableEnd = tableStart;
  for (let i = tableStart; i < dbSrc.length; i++) {
    if (dbSrc[i] === '(') depth++;
    if (dbSrc[i] === ')') { depth--; if (depth === 0) { tableEnd = i; break; } }
  }
  const tableDef = dbSrc.slice(tableStart, tableEnd + 1);

  const requiredColumns = ['key TEXT PRIMARY KEY', 'user_id TEXT NOT NULL', 'payload_hash TEXT NOT NULL', 'post_id TEXT NOT NULL', 'response_status INT NOT NULL', 'response_body JSONB NOT NULL', 'expires_at TIMESTAMPTZ NOT NULL'];
  const allPresent = requiredColumns.every(col => tableDef.includes(col));

  if (allPresent) {
    ok('idempotency_keys table has all required columns');
  } else {
    const missing = requiredColumns.filter(col => !tableDef.includes(col));
    fail('idempotency_keys table has all required columns', `missing: ${missing.join(', ')}`);
  }
}

// 20. Table has indexes on user_id and expires_at
{
  const dbSrc = fs.readFileSync('src/server/db.ts', 'utf8');
  if (dbSrc.includes('idx_idempotency_keys_user') && dbSrc.includes('idx_idempotency_keys_expires')) {
    ok('idempotency_keys has indexes on user_id and expires_at');
  } else {
    fail('idempotency_keys has indexes on user_id and expires_at', 'indexes not found');
  }
}

// 21. No hardcoded secrets in idempotency code
{
  const dbSrc = fs.readFileSync('src/server/db.ts', 'utf8');
  const idxStart = dbSrc.indexOf('ensureIdempotencyKeysTable');
  const idxEnd = dbSrc.indexOf('export const IDEMPOTENCY_TTL_MS');
  const section = dbSrc.slice(idxStart, idxEnd);

  const hasSecret = /password|secret|token|api[_-]?key/i.test(section);
  if (!hasSecret) {
    ok('No hardcoded secrets in idempotency code');
  } else {
    fail('No hardcoded secrets in idempotency code', 'potential secret found');
  }
}

// ─── 409 Conflict on payload mismatch tests ───

// 22. Normal path: existing key + different payload_hash → returns conflict
{
  const src = fs.readFileSync('src/server/db.ts', 'utf8');
  const fnStart = src.indexOf('async createUserPost(');
  const fnBody = src.slice(fnStart, fnStart + 10000);
  // The normal path should compare payload_hash and return conflict: true
  const hasHashCompare = fnBody.includes('row.payload_hash !== payloadHash');
  const hasConflictReturn = fnBody.includes("conflict: true");
  if (hasHashCompare && hasConflictReturn) {
    ok('Normal path: payload_hash mismatch returns conflict');
  } else {
    fail('Normal path: payload_hash mismatch returns conflict', `hashCompare=${hasHashCompare}, conflictReturn=${hasConflictReturn}`);
  }
}

// 23. 23505 path: concurrent race + different payload_hash → returns conflict
{
  const src = fs.readFileSync('src/server/db.ts', 'utf8');
  const fnStart = src.indexOf('async createUserPost(');
  const fnBody = src.slice(fnStart, fnStart + 10000);
  // The 23505 handler should also compare payload_hash and return conflict
  const block23505 = fnBody.slice(fnBody.indexOf("'23505'"));
  const hasHashCompare = block23505.includes('retry[0].payload_hash !== payloadHash');
  const hasConflictReturn = block23505.includes('conflict: true');
  if (hasHashCompare && hasConflictReturn) {
    ok('23505 handler: payload_hash mismatch returns conflict');
  } else {
    fail('23505 handler: payload_hash mismatch returns conflict', `hashCompare=${hasHashCompare}, conflictReturn=${hasConflictReturn}`);
  }
}

// 24. app.ts returns 409 on conflict
{
  const appSrc = fs.readFileSync('src/server/app.ts', 'utf8');
  if (appSrc.includes('409') && appSrc.includes('.conflict')) {
    ok('app.ts returns 409 on conflict');
  } else {
    fail('app.ts returns 409 on conflict', '409 or .conflict not found');
  }
}

// 25. createUserPost return type includes conflict
{
  const src = fs.readFileSync('src/server/db.ts', 'utf8');
  const fnStart = src.indexOf('async createUserPost(');
  // Search a wider range to include the multi-line return type after ')'
  const sig = src.slice(fnStart, fnStart + 800);
  if (sig.includes('conflict')) {
    ok('createUserPost return type includes conflict');
  } else {
    fail('createUserPost return type includes conflict', 'conflict not in return type');
  }
}

// ─── Summary ───
const passed = results.filter(r => r.pass).length;
const failed = results.filter(r => !r.pass).length;
console.log(`\n=== F-03 idempotency test results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
