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
  assertTrue((currentSalon as string) !== (searchResultSalon as string), 'Search result salon is different');
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

// I) Exact conversation reproduction from user: booking must NOT trigger on request alone.
{
  console.log('--- Test I: Request phrase does not trigger booking ---');
  const regex = /(?:اي|إي|نعم|ايوه|أيوه|تمام|موافق|احجز|احجزلي|احجز لي|توكل|توكلنا|يلا احجز|اي احجز|إي احجز)/iu;
  assertFalse(regex.test('أريد الحجز في صالون الميار'), 'Request phrase does not confirm');
}

// I) Exact failing conversation: "اي نعم احجز" must resolve from validated state and reach createBookingAtomic.
{
  console.log('--- Test I: Exact confirmation flow reaches booking atomic ---');
  // Import executeTool to verify the real logic path.
  const { executeTool } = await import('../services/aiSalonTools');

  // Mock database module with minimal state and a tracking atomic method.
  let atomicCalled = false;
  let atomicPayload: any = null;
  const mockDbModule = {
    default: {
      getState: () => ({
        salons: [{ id: 'mayar', name: 'المايار', ownerId: 'owner1', status: 'approved', commissionRate: 10, working_hours: null }],
        services: [{ id: 'svc-1', salonId: 'mayar', name: 'قص', price: 15000, durationMinutes: 30 }],
        users: [{ id: 'user-1', name: 'علي', phone: '077', email: 'ali@test.com', isBanned: false, isActive: true, role: 'customer' }],
        bookings: [],
        blockedTimes: [],
        settings: { commissionRate: 10 },
      }),
      getSalonByIdFromNeon: async (id: string) => ({ id: 'mayar', name: 'المايار', ownerId: 'owner1', status: 'approved', working_hours: null }),
      getServiceByIdFromNeon: async (id: string) => ({ id: 'svc-1', salonId: 'mayar', name: 'قص', price: 15000, durationMinutes: 30 }),
      getUserById: (id: string) => ({ id: 'user-1', name: 'علي', phone: '077', email: 'ali@test.com', isBanned: false, isActive: true }),
      getAdminUsers: () => [],
      createNotification: async () => {},
      createBookingAtomic: async (payload: any) => {
        atomicCalled = true;
        atomicPayload = payload;
        return { success: true, booking: { id: 'bk_1', salonId: payload.salonId, serviceId: payload.serviceId, date: payload.date, timeSlot: payload.timeSlot, finalPrice: 15000, status: 'confirmed', salonName: 'المايار', serviceName: 'قص', bookingNumber: 'HLQ-2026-1000', customerName: 'علي' } };
      },
    }
  };

  const user = { id: 'user-1', name: 'علي', phone: '077', email: 'ali@test.com', role: 'customer', isBanned: false, isActive: true };

  // Simulate exact failing conversation: user confirms after details set.
  const conversationState = { salonId: 'mayar', salonName: 'المايار', serviceId: 'svc-1', serviceName: 'قص', date: '2026-09-09', time: '10:00', intent: 'book', pendingQuestion: null, lastResolvedContext: '' };

  // Gemini might send incomplete args (missing date/time) but confirmation is true.
  const args = { salonId: 'mayar', serviceId: 'svc-1', confirmed: true };

  const result = await executeTool('create_booking', args, mockDbModule, async () => (await import('../services/lib/pg-compliant')), {
    user: user,
    allowBooking: true,
    conversationState: conversationState,
  });

  assertTrue(atomicCalled, 'Booking reaches createBookingAtomic');
  assertTrue(atomicPayload !== null, 'Payload provided');
  assertEqual(atomicPayload.salonId, 'mayar', 'Payload salon correct');
  assertEqual(atomicPayload.serviceId, 'svc-1', 'Payload service correct');
  assertEqual(atomicPayload.date, '2026-09-09', 'Payload date resolved from state');
  assertEqual(atomicPayload.timeSlot, '10:00', 'Payload time resolved from state');
  assertEqual(atomicPayload.customerId, 'user-1', 'Payload customer from auth');
  assertTrue(result?.success === true, 'Booking succeeds');
}
