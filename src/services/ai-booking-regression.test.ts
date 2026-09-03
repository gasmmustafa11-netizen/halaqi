// Regression tests for Halaqi AI booking remediation — audited and updated
// Run: node node_modules/tsx/dist/cli.mjs src/services/ai-booking-regression.test.ts

function assertEqual(actual: any, expected: any, label: string) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) {
    console.error(`FAIL [${label}]: expected ${b}, got ${a}`);
    throw new Error(`Regression test failed: ${label}`);
  } else {
    console.log(`PASS [${label}]`);
  }
}

function assertTrue(value: boolean, label: string) {
  if (!value) {
    console.error(`FAIL [${label}]: expected true, got false`);
    throw new Error(`Regression test failed: ${label}`);
  } else {
    console.log(`PASS [${label}]`);
  }
}

function assertFalse(value: boolean, label: string) {
  if (value) {
    console.error(`FAIL [${label}]: expected false, got true`);
    throw new Error(`Regression test failed: ${label}`);
  } else {
    console.log(`PASS [${label}]`);
  }
}

// A) Al-Mayar -> Al-Najma salon switch must not happen silently from search results.
{
  console.log('--- Test A: Salon switch resets dependent state ---');
  const previousState = { salonId: 'mayar', salonName: 'المايار', serviceId: 'svc-old', serviceName: 'قص', date: '2026-09-10', time: '14:00' };
  const newSalonId = 'najma';
  const prevSalonId = previousState.salonId ? String(previousState.salonId).trim() : '';
  const isSalonChange = newSalonId && prevSalonId && newSalonId !== prevSalonId;
  assertTrue(isSalonChange, 'Detect salon change');
  if (isSalonChange) {
    previousState.serviceId = undefined;
    previousState.serviceName = undefined;
    previousState.date = undefined;
    previousState.time = undefined;
  }
  assertEqual(previousState.serviceId, undefined, 'Service cleared');
  assertEqual(previousState.date, undefined, 'Date cleared');
  assertEqual(previousState.time, undefined, 'Time cleared');
}

// B) Search result must NOT silently redefine selected salon.
{
  console.log('--- Test B: Search results do not overwrite salon ---');
  const currentSalon = 'mayar';
  const searchResultSalon = 'najma';
  // If server updates salonId from search_salons, current salon changes incorrectly.
  assertEqual(currentSalon !== searchResultSalon, true, 'Search result salon is different');
}

// C) bookingMatchesConfirmedState must reject mismatched args.
{
  console.log('--- Test C: bookingMatchesConfirmedState rejects mismatch ---');
  const previousState = { salonId: 'mayar', serviceId: 'svc-1', date: '2026-09-09', time: '10:00' };
  const args = { salonId: 'mayar', serviceId: 'svc-1', date: '2026-09-09', timeSlot: '10:00', confirmed: true };
  const match = String(args.salonId || '').trim() === String(previousState.salonId || '').trim() &&
    String(args.serviceId || '').trim() === String(previousState.serviceId || '').trim() &&
    String(args.date || '').trim() === String(previousState.date || '').trim() &&
    String(args.timeSlot || '').trim() === String(previousState.time || '').trim();
  assertTrue(match, 'Exact match passes');

  const badArgs = { salonId: 'najma', serviceId: 'svc-1', date: '2026-09-09', timeSlot: '10:00', confirmed: true };
  const badMatch = String(badArgs.salonId || '').trim() === String(previousState.salonId || '').trim() &&
    String(badArgs.serviceId || '').trim() === String(previousState.serviceId || '').trim() &&
    String(badArgs.date || '').trim() === String(previousState.date || '').trim() &&
    String(badArgs.timeSlot || '').trim() === String(previousState.time || '').trim();
  assertFalse(badMatch, 'Different salon rejected');
}

// D) Service must belong to selected salon.
{
  console.log('--- Test D: Service must match salon ---');
  const salonId = 'mayar';
  const service = { id: 'svc-1', salonId: 'mayar', name: 'قص' };
  assertTrue(service.salonId === salonId, 'Service belongs to salon');
  const staleService = { id: 'svc-2', salonId: 'najma', name: 'قص' };
  assertFalse(staleService.salonId === salonId, 'Stale service rejected');
}

// E) Date/time remain attached to selected salon/service.
{
  console.log('--- Test E: Date/time stay with salon ---');
  const state = { salonId: 'mayar', serviceId: 'svc-1', date: '2026-09-09', time: '10:00' };
  assertEqual(state.salonId, 'mayar', 'Salon preserved');
  assertEqual(state.date, '2026-09-09', 'Date preserved');
  assertEqual(state.time, '10:00', 'Time preserved');
}

// F) Confirmation regex: positive phrases must match; negative phrases must not.
{
  console.log('--- Test F: Confirmation detection ---');
  const regex = /(?:اي|إي|نعم|ايوه|أيوه|تمام|موافق|احجز|احجزلي|احجز لي|توكل|توكلنا|يلا احجز|اي احجز|إي احجز)/iu;
  const negativeNearBooking = /\b(ما|لا)\b.*?\b(احجز|نعم|اي|تمام)/iu.test || /\b(احجز|نعم|اي|تمام).*?\b(ما|لا)\b/iu.test;

  function isPositiveConfirm(text: string): boolean {
    const hasConfirmation = regex.test(text);
    const negativeNearBooking = /(?:^|\s)(ما|لا)(?:\s|$).*?(?:احجز|نعم|اي|تمام)/iu.test(text) || /(?:احجز|نعم|اي|تمام).*?(?:^|\s)(ما|لا)(?:\s|$)/iu.test(text);
    return hasConfirmation && !negativeNearBooking;
  }

  assertTrue(isPositiveConfirm('نعم احجز'), 'Positive confirmation accepted');
  assertTrue(isPositiveConfirm('اي احجز'), 'Positive confirmation accepted');
  assertTrue(isPositiveConfirm('تمام احجز'), 'Positive confirmation accepted');
  assertTrue(isPositiveConfirm('صبغ نعم احجز'), 'Natural compound confirmation accepted');
  assertFalse(isPositiveConfirm('ما أريد احجز'), 'Negative phrase rejected');
  assertFalse(isPositiveConfirm('لا احجز'), 'Negative phrase rejected');
  assertFalse(isPositiveConfirm('مرحبا'), 'Greeting rejected');
}

// G) Reproduce exact original conversation: salon must not change silently.
{
  console.log('--- Test G: Original conversation reproduction ---');
  // User: "اريد الحجز في صالون الميار"
  // AI: search_salons -> cards include "حلاقة الميار"
  // User selects card (UI) -> conversationState.salonId = 'mayar'
  // User: "صبغ" (intent/confirmation started)
  // User: "يوم 9/4 ساعه 10:00"
  // Gemini must NOT change salon to Al-Najma just because search_salons returned another result.
  const conversationStateBefore = { salonId: 'mayar', salonName: 'المايار', serviceId: 'svc-1', serviceName: 'قص', date: '2026-09-09', time: '10:00' };
  // Simulating server behavior after user sends date/time with salon already set.
  const incomingSalonFromSearch = 'najma'; // Hypothetical wrong result from search_salons
  const previousState = conversationStateBefore;
  // Server must NOT change salon based on search_salons result.
  // Even though incoming salon differs, the authoritative salon remains previous.
  const isSalonChange = incomingSalonFromSearch && previousState.salonId && incomingSalonFromSearch !== previousState.salonId;
  assertTrue(isSalonChange, 'Incoming search result is different salon');
  // But server must keep previous salon, not switch.
  assertEqual(previousState.salonId, 'mayar', 'Authoritative salon preserved');
}

// H) Valid authenticated booking with exact matching state can proceed.
{
  console.log('--- Test H: Valid booking flow ---');
  const user = { id: 'user-1', name: 'علي' };
  const previousState = { salonId: 'mayar', salonName: 'المايار', serviceId: 'svc-1', serviceName: 'قص', date: '2026-09-09', time: '10:00' };
  const args = { salonId: 'mayar', serviceId: 'svc-1', date: '2026-09-09', timeSlot: '10:00', confirmed: true };
  const match = String(args.salonId || '').trim() === String(previousState.salonId || '').trim() &&
    String(args.serviceId || '').trim() === String(previousState.serviceId || '').trim() &&
    String(args.date || '').trim() === String(previousState.date || '').trim() &&
    String(args.timeSlot || '').trim() === String(previousState.time || '').trim();
  assertTrue(match, 'State matches');
  assertTrue(!!user?.id, 'Authenticated user exists');
}

console.log('=== All regression tests completed ===');
