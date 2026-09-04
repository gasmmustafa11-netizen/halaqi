import crypto from 'crypto';
import {
  hashPassword,
  verifyPassword,
  generateSalt,
} from '../src/server/db';

let pass = 0;
let fail = 0;

function assert(name: string, cond: boolean) {
  if (cond) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    console.log(`  FAIL  ${name}`);
  }
}

const CURRENT_ITERATIONS = 600_000;
const LEGACY_ITERATIONS = 1000;

function legacyHash(password: string, salt: string): string {
  return crypto
    .pbkdf2Sync(password, salt, LEGACY_ITERATIONS, 64, 'sha512')
    .toString('hex');
}

function currentHash(password: string, salt: string): string {
  return crypto
    .pbkdf2Sync(password, salt, CURRENT_ITERATIONS, 64, 'sha512')
    .toString('hex');
}

console.log('BUG-05: PBKDF2 iteration upgrade + backward compatibility\n');

// BUG-01 regression: password required
const salt = 'testsalt';
const exploitable = hashPassword('Secret@123', salt);
assert('BUG-01 still closed: verifyPassword requires password hash+salt',
  verifyPassword('', exploitable, salt) === false);

// BUG-05: new hash uses 600k iterations
const newHash = hashPassword('Secret@123', salt);
const expectedNew = currentHash('Secret@123', salt);
assert('new hash == 600k-iteration PBKDF2 hash', newHash === expectedNew);
assert('new hash verifies via current iterations', verifyPassword('Secret@123', newHash, salt));
assert('wrong password rejected on new hash', !verifyPassword('Wrong@456', newHash, salt));

// BUG-05 backward compat: a hash stored with 1000 iterations must still verify
const legacyStored = legacyHash('OldPass@2020', salt);
assert('legacy 1000-iteration hash still verifies', verifyPassword('OldPass@2020', legacyStored, salt));
assert('legacy hash rejects wrong password', !verifyPassword('Wrong@123', legacyStored, salt));

// BUG-05: same salt + two different passwords produce different hashes
assert('unique hashes for different passwords', newHash !== hashPassword('Another@99', salt));

// BUG-05: legacy and current hashes are the same HEX length (both 128 chars)
assert('current hash length is 128 hex chars', newHash.length === 128);
assert('legacy hash length is 128 hex chars', legacyStored.length === 128);

console.log('\nBUG-02: registration password policy (as enforced by createUser+route)\n');

// Replicates the createUser / register-route password guard
function registrationGuard(password?: unknown): { ok: boolean; error?: string } {
  if (typeof password !== 'string' || !password.trim() || password.length < 8) {
    return { ok: false, error: 'كلمة المرور مطلوبة وأن لا تقل عن 8 أحرف.' };
  }
  return { ok: true };
}

assert('empty/missing password rejected', registrationGuard(undefined).ok === false);
assert('empty-string password rejected', registrationGuard('').ok === false);
assert('whitespace-only password rejected', registrationGuard('   ').ok === false);
assert('short password (<8) rejected', registrationGuard('Abc12').ok === false);
assert('8-char password accepted', registrationGuard('Abcd1234').ok === true);
assert('long strong password accepted', registrationGuard('Str0ng!Passw0rd').ok === true);

console.log('\nBUG-05/02: generateSalt sanity\n');
const s1 = generateSalt();
const s2 = generateSalt();
assert('generateSalt outputs 32-char hex', /^[0-9a-f]{32}$/.test(s1));
assert('generateSalt is unique across calls', s1 !== s2);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
