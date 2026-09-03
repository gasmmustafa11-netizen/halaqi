#!/usr/bin/env python3

from pathlib import Path
from datetime import datetime
import shutil
import sys

ROOT = Path.cwd()

APP = ROOT / "src/server/app.ts"
UI = ROOT / "src/components/your-salon/YourSalonView.tsx"

if not APP.exists():
    print(f"[ERROR] Missing: {APP}")
    sys.exit(1)

if not UI.exists():
    print(f"[ERROR] Missing: {UI}")
    sys.exit(1)


def backup(path):
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_path = path.with_name(
        f"{path.name}.booking-state-backup-{stamp}"
    )
    shutil.copy2(path, backup_path)
    print(f"[BACKUP] {backup_path}")
    return backup_path


def replace_exact(text, old, new, label):
    count = text.count(old)

    if count != 1:
        print(
            f"[STOP] {label}: expected exactly 1 match, found {count}"
        )
        sys.exit(1)

    return text.replace(old, new, 1)


print("=" * 70)
print("HALAQI — BOOKING CONVERSATION STATE FIX")
print("=" * 70)

backup(APP)
backup(UI)

app = APP.read_text(encoding="utf-8")
ui = UI.read_text(encoding="utf-8")


# ============================================================
# 1. SERVER:
#    Replace booking comparison against raw conversationState
#    with comparison against authoritative resolvedState.
# ============================================================

old_booking_guard = """              const previousState = conversationState || {};

              const bookingMatchesConfirmedState =
                name === 'create_booking' &&
                String(args.salonId || '').trim() === String(previousState.salonId || '').trim() &&
                String(args.serviceId || '').trim() === String(previousState.serviceId || '').trim() &&
                String(args.date || '').trim() === String(previousState.date || '').trim() &&
                String(args.timeSlot || '').trim() === String(previousState.time || '').trim();

              const res = await executeTool(
                name,
                args,
                dbModule,
                async () => await import('./lib/pg-compliant'),
                {
                  user: req.user,
                  allowBooking:
                    !!req.user &&
                    explicitBookingConfirm &&
                    bookingMatchesConfirmedState &&
                    !!previousState.salonId &&
                    !!previousState.serviceId &&
                    !!previousState.date &&
                    !!previousState.time,
                }
              );"""

new_booking_guard = """              // The client sends conversationState from the previous
              // confirmed summary turn. resolvedState is the server-authoritative
              // copy and may also contain entities resolved by tools during this
              // request. Never require create_booking to match stale raw input
              // state when the server has already resolved the same booking data.

              const previousState =
                conversationState &&
                typeof conversationState === 'object'
                  ? conversationState
                  : {};

              const bookingState =
                resolvedState &&
                typeof resolvedState === 'object'
                  ? resolvedState
                  : previousState;

              const normalizeBookingValue = (value: unknown) =>
                String(value ?? '').trim();

              const bookingMatchesConfirmedState =
                name === 'create_booking' &&
                normalizeBookingValue(args.salonId) ===
                  normalizeBookingValue(bookingState.salonId) &&
                normalizeBookingValue(args.serviceId) ===
                  normalizeBookingValue(bookingState.serviceId) &&
                normalizeBookingValue(args.date) ===
                  normalizeBookingValue(bookingState.date) &&
                normalizeBookingValue(args.timeSlot) ===
                  normalizeBookingValue(bookingState.time);

              const bookingStateComplete =
                !!normalizeBookingValue(bookingState.salonId) &&
                !!normalizeBookingValue(bookingState.serviceId) &&
                !!normalizeBookingValue(bookingState.date) &&
                !!normalizeBookingValue(bookingState.time);

              console.log(
                '[AI BOOKING STATE]',
                JSON.stringify({
                  explicitBookingConfirm,
                  authenticated: !!req.user,
                  salonId: bookingState.salonId || null,
                  serviceId: bookingState.serviceId || null,
                  date: bookingState.date || null,
                  time: bookingState.time || null,
                  toolSalonId: args.salonId || null,
                  toolServiceId: args.serviceId || null,
                  toolDate: args.date || null,
                  toolTimeSlot: args.timeSlot || null,
                  bookingMatchesConfirmedState,
                  bookingStateComplete,
                })
              );

              const res = await executeTool(
                name,
                args,
                dbModule,
                async () => await import('./lib/pg-compliant'),
                {
                  user: req.user,
                  allowBooking:
                    !!req.user &&
                    explicitBookingConfirm &&
                    bookingMatchesConfirmedState &&
                    bookingStateComplete,
                }
              );"""

app = replace_exact(
    app,
    old_booking_guard,
    new_booking_guard,
    "server booking guard"
)

print("[OK] Server booking guard repaired")


# ============================================================
# 2. SERVER:
#    Clear stale pendingQuestion when there is no clarification.
#
#    Previously `pendingQuestion: undefined` disappears from JSON,
#    allowing the React merge to preserve the old question.
# ============================================================

old_pending = """        pendingQuestion:
          needsClarification
            ? reply
            : undefined,"""

new_pending = """        pendingQuestion:
          needsClarification
            ? reply
            : null,"""

app = replace_exact(
    app,
    old_pending,
    new_pending,
    "server pendingQuestion cleanup"
)

print("[OK] Server pendingQuestion cleanup repaired")


# ============================================================
# 3. UI:
#    Replace the first duplicated conversationState update with
#    one authoritative update.
# ============================================================

old_first_update = """      // Keep the server-authoritative booking state across turns.
      if (data?.conversationState) {
        setConversationState(prev => ({
          ...prev,
          ...Object.fromEntries(
            Object.entries(data.conversationState).filter(
              ([, value]) =>
                value !== undefined &&
                value !== null &&
                value !== ''
            )
          )
        }));
      }
      const aiMsg: Msg = {"""

new_first_update = """      // Keep exactly one authoritative conversationState update.
      // null values are allowed here so the server can explicitly clear
      // stale fields such as pendingQuestion.
      if (data?.conversationState) {
        setConversationState(prev => {
          const next = { ...prev };

          for (const [key, value] of Object.entries(data.conversationState)) {
            if (value === null) {
              delete (next as any)[key];
              continue;
            }

            if (value !== undefined && value !== '') {
              (next as any)[key] = value;
            }
          }

          return next;
        });
      }

      const aiMsg: Msg = {"""

ui = replace_exact(
    ui,
    old_first_update,
    new_first_update,
    "first UI conversationState update"
)

print("[OK] UI authoritative state update repaired")


# ============================================================
# 4. UI:
#    Remove the second duplicated conversationState update.
# ============================================================

old_second_update = """      if (data.conversationState && typeof data.conversationState === 'object') {
        setConversationState((prev) => ({
          ...prev,
          ...Object.fromEntries(
            Object.entries(data.conversationState).filter(
              ([, value]) =>
                value !== undefined &&
                value !== null &&
                value !== ''
            ),
          ),
        }));
      }
      // Detect booking request from AI or user context"""

new_second_update = """      // conversationState was already updated exactly once above.

      // Detect booking request from AI or user context"""

ui = replace_exact(
    ui,
    old_second_update,
    new_second_update,
    "duplicate UI conversationState update"
)

print("[OK] Duplicate UI state update removed")


# ============================================================
# 5. UI:
#    The old tryProcessBooking is intentionally a no-op.
#    Leave it intact because booking must remain server-authoritative.
# ============================================================

print("[OK] Client-side direct booking remains disabled")
print("[OK] Booking remains exclusively through authenticated create_booking")


# ============================================================
# WRITE
# ============================================================

APP.write_text(app, encoding="utf-8")
UI.write_text(ui, encoding="utf-8")

print()
print("=" * 70)
print("PATCH COMPLETE")
print("=" * 70)
print()
print("Changed:")
print("  1. create_booking authorization now uses resolvedState")
print("  2. Exact salon/service/date/time matching retained")
print("  3. Stale pendingQuestion can now be cleared")
print("  4. Duplicate React conversationState update removed")
print("  5. Added [AI BOOKING STATE] diagnostic logging")
print()
print("NEXT:")
print("  npm run lint")
print("  npm run build")
print()
print("Then test:")
print("  أحجز صالون الميار خدمة الصبغ في اليوم 9/4 الساعة 10:00")
print("  نعم")
print()
print("DO NOT deploy yet until lint/build pass.")
