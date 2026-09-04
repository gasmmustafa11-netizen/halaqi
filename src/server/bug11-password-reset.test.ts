/* =========================================================
   BUG-11: Password Reset via Email OTP — pure-function tests
   Run:  npx tsx src/server/bug11-password-reset.test.ts
   ========================================================= */
import {
  generateOtp,
  hashOtp,
  OTP_TTL_MS,
  OTP_MAX_ATTEMPTS,
} from './db.js';
import {
  isEmailConfigured,
  sendOtpEmail,
} from './email.js';

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

/* =========================================================
   OTP generation
   ========================================================= */
console.log('\n--- BUG-11: OTP generation ---');

for (let i = 0; i < 5; i++) {
  const otp = generateOtp();
  assertEq(`OTP is 6 chars (run ${i + 1})`, otp.length, 6);
  assertEq(`OTP is numeric (run ${i + 1})`, /^\d{6}$/.test(otp), true);
}

// All OTPs should be unique in a batch
const otps = new Set(Array.from({ length: 10 }, () => generateOtp()));
check('10 OTPs are all unique', otps.size === 10);

/* =========================================================
   OTP hashing
   ========================================================= */
console.log('\n--- BUG-11: OTP hashing ---');

const hash1 = hashOtp('123456');
const hash2 = hashOtp('123456');
assertEq('hashOtp is deterministic (same input = same output)', hash1, hash2);

const hash3 = hashOtp('654321');
check('hashOtp differs for different input', hash1 !== hash3);

assertEq('hashOtp output is 64-char hex (SHA-256)', hash1.length, 64);
assertEq('hashOtp output is hex', /^[0-9a-f]{64}$/.test(hash1), true);

/* =========================================================
   Constants
   ========================================================= */
console.log('\n--- BUG-11: Constants ---');

assertEq('OTP_TTL_MS = 600000 (10 minutes)', OTP_TTL_MS, 600_000);
assertEq('OTP_MAX_ATTEMPTS = 5', OTP_MAX_ATTEMPTS, 5);

/* =========================================================
   Email configuration detection
   ========================================================= */
console.log('\n--- BUG-11: Email configuration ---');

// In test environment (no RESEND_API_KEY), should report unconfigured
const configured = isEmailConfigured();
assertEq('isEmailConfigured returns boolean', typeof configured, 'boolean');

/* =========================================================
   sendOtpEmail when unconfigured
   ========================================================= */
console.log('\n--- BUG-11: sendOtpEmail (unconfigured path) ---');

if (!configured) {
  const result = await sendOtpEmail('test@example.com', '000000');
  assertEq('sendOtpEmail returns ok:true when unconfigured', result.ok, true);
  assertEq('sendOtpEmail returns sent:false when unconfigured', result.sent, false);
  assertEq('sendOtpEmail reason=unconfigured', result.reason, 'unconfigured');
} else {
  check('Skipping unconfigured test (RESEND_API_KEY is set)', true);
}

/* =========================================================
   Summary
   ========================================================= */
console.log(`\n=== BUG-11 test results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
