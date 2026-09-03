#!/data/data/com.termux/files/usr/bin/python3

from pathlib import Path
from datetime import datetime
import shutil
import subprocess
import sys

ROOT = Path.cwd()

APP = ROOT / "src/server/app.ts"
UI  = ROOT / "src/components/your-salon/YourSalonView.tsx"
DB  = ROOT / "src/server/db.ts"

FILES = [APP, UI, DB]

print("=" * 70)
print("HALAQI AI — BOOKING ROOT FIX")
print("=" * 70)
print()

# ---------------------------------------------------------
# 0. Validate project
# ---------------------------------------------------------

if not (ROOT / "package.json").exists():
    raise SystemExit(
        "ERROR: package.json غير موجود.\n"
        "شغّل السكربت من جذر مشروع halaqi."
    )

missing = [str(f) for f in FILES if not f.exists()]
if missing:
    raise SystemExit(
        "ERROR: الملفات التالية غير موجودة:\n" +
        "\n".join(missing)
    )

# ---------------------------------------------------------
# 1. Read files
# ---------------------------------------------------------

original = {
    f: f.read_text(encoding="utf-8")
    for f in FILES
}

working = dict(original)

# ---------------------------------------------------------
# 2. Backup
# ---------------------------------------------------------

timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
backup = ROOT / f".halaqi-booking-root-fix-backup-{timestamp}"
backup.mkdir(parents=True, exist_ok=False)

for f in FILES:
    shutil.copy2(f, backup / f.name)

print(f"[BACKUP] {backup}")
print()

# ---------------------------------------------------------
# Helpers
# ---------------------------------------------------------

changed = []

def patch_file(path, old, new, label):
    global working

    text = working[path]
    count = text.count(old)

    if count != 1:
        raise RuntimeError(
            f"[{label}] expected exactly 1 match, found {count}"
        )

    working[path] = text.replace(old, new, 1)
    changed.append(label)
    print(f"[OK] {label}")


def patch_optional(path, old, new, label):
    text = working[path]
    count = text.count(old)

    if count == 0:
        print(f"[SKIP] {label} — pattern not present")
        return

    if count != 1:
        raise RuntimeError(
            f"[{label}] expected at most 1 match, found {count}"
        )

    working[path] = text.replace(old, new, 1)
    changed.append(label)
    print(f"[OK] {label}")


# ---------------------------------------------------------
# 3. UI FIX
#
# Critical bug:
# current user turn was sent separately from conversationHistory.
#
# This causes:
#
# user: "نعم"
#
# to reach the server without the immediately preceding
# booking confirmation context in history.
# ---------------------------------------------------------

patch_file(
    UI,

'''      const history = msgs.map((m) => ({ role: m.role, text: m.text }));
      const data = await aiSalonChat({ message: text, regionConsent: false, conversationHistory: history, conversationState });''',

'''      const history = [
        ...msgs.map((m) => ({ role: m.role, text: m.text })),
        { role: 'user', text },
      ].slice(-12);

      const data = await aiSalonChat({
        message: text,
        regionConsent: false,
        conversationHistory: history,
        conversationState,
      });''',

    "UI: current user turn included in conversation history"
)

# ---------------------------------------------------------
# 4. UI STATE FIX
#
# Old logic could infer/select cards[0].
# New logic accepts authoritative state returned by server.
# ---------------------------------------------------------

patch_file(
    UI,

'''      // Update conversation state from AI response (only when user explicitly selects or context already set)
      setConversationState((prev) => {
        const next = { ...prev };
        // Only resolve salon when user explicitly selected via card click (handled by onSelectSalonId prop) or when conversationState from server indicates a selected salon.
        // Never auto-assign cards[0] as selected salon just because it is first.
        if (data.cards && data.cards.length === 1 && !prev.salonId && data.cards[0].id && prev.salonName === (data.cards[0].name || '')) {
          // Only apply if conversation context already points to this salon name (clear disambiguation)
          next.salonId = data.cards[0].id;
          next.salonName = data.cards[0].name || prev.salonName;
          next.lastResolvedContext = `صالون مختار من السياق: ${data.cards[0].name || ''}`;
        }
        return next;
      });''',

'''      if (data.conversationState && typeof data.conversationState === 'object') {
        setConversationState((prev) => ({
          ...prev,
          ...Object.fromEntries(
            Object.entries(data.conversationState).filter(
              ([, value]) => value !== undefined && value !== null && value !== ''
            )
          ),
        }));
      }''',

    "UI: preserve authoritative conversation state"
)

# ---------------------------------------------------------
# 5. SERVER: Gemini history
#
# Convert:
#
# user      -> user
# assistant -> model
# ai        -> model
#
# Gemini requires model rather than assistant.
# ---------------------------------------------------------

patch_file(
    APP,

'''        const buildHistoryText = () => historyText || 'لا تاريخ';

        // First turn
        let turn = 1;''',

'''        const priorContents: any[] = history
          .map((h: any) => {
            const text = String(h?.text ?? h?.message ?? '').trim();
            if (!text) return null;

            return {
              role:
                h?.role === 'ai' || h?.role === 'assistant'
                  ? 'model'
                  : 'user',
              parts: [{ text }],
            };
          })
          .filter(Boolean);

        // First turn
        let turn = 1;''',

    "Gemini: convert previous conversation to valid contents"
)

# ---------------------------------------------------------
# 6. SERVER: include previous turns before current user turn
# ---------------------------------------------------------

patch_file(
    APP,

'''          if (turn === 1) {
            // Turn 1: original user message + tools.
            contents = [initialUserContent];
          } else {''',

'''          if (turn === 1) {
            // Keep all previous turns except the last user message,
            // because initialUserContent is the authoritative current turn.
            contents = [
              ...priorContents.slice(0, -1),
              initialUserContent,
            ];
          } else {''',

    "Gemini: preserve multi-turn booking context"
)

# ---------------------------------------------------------
# 7. SERVER: tool loop
# ---------------------------------------------------------

patch_file(
    APP,

'''        for (turn = 1; turn <= 3; turn++) {''',

'''        for (turn = 1; turn <= MAX_TOOL_TURNS; turn++) {''',

    "Gemini: use MAX_TOOL_TURNS instead of hard-coded 3"
)

# ---------------------------------------------------------
# 8. SERVER: authoritative resolved state
#
# State must survive even when Gemini's next JSON response
# omits some fields.
# ---------------------------------------------------------

patch_file(
    APP,

'''    let cards: any[] = [];
    let reply = '';
    let needsClarification = false;
    let entities: any = {};
    let intent = '';
    let cardsRequested = false;
    let firstTurnModelContent: any = null;''',

'''    let cards: any[] = [];
    let reply = '';
    let needsClarification = false;
    let entities: any = {};
    let intent = '';
    let cardsRequested = false;
    let firstTurnModelContent: any = null;

    // Authoritative state carried across turns.
    // Never destroy an already resolved booking field just
    // because the current Gemini JSON omitted it.
    const resolvedState: any = {
      ...(conversationState && typeof conversationState === 'object'
        ? conversationState
        : {}),
    };''',

    "Server: initialize authoritative resolvedState"
)

# ---------------------------------------------------------
# 9. SERVER: update resolvedState from tool results
# ---------------------------------------------------------

patch_file(
    APP,

'''              console.log(
                '[AI DEBUG] TOOL RESULT:',
                JSON.stringify(res, null, 2).slice(0, 20000)
              );

              responses.push({''',

'''              console.log(
                '[AI DEBUG] TOOL RESULT:',
                JSON.stringify(res, null, 2).slice(0, 20000)
              );

              // Tool results are authoritative for resolved booking entities.
              if (res?.salons?.length === 1) {
                const s = res.salons[0];

                if (s?.id) {
                  resolvedState.salonId = s.id;
                }

                if (s?.name) {
                  resolvedState.salonName = s.name;
                }
              }

              if (res?.salon?.id) {
                resolvedState.salonId = res.salon.id;
                resolvedState.salonName =
                  res.salon.name || resolvedState.salonName;
              }

              if (res?.services?.length === 1) {
                const svc = res.services[0];

                if (svc?.id) {
                  resolvedState.serviceId = svc.id;
                }

                if (svc?.name) {
                  resolvedState.serviceName = svc.name;
                }
              }

              if (res?.date) {
                resolvedState.date = String(res.date);
              }

              if (args?.date) {
                resolvedState.date = String(args.date);
              }

              if (args?.timeSlot) {
                resolvedState.time = String(args.timeSlot);
              }

              responses.push({''',

    "Server: persist booking entities returned by tools"
)

# ---------------------------------------------------------
# 10. SERVER: final conversation state
#
# IMPORTANT:
# entities override only when actually present.
# Otherwise resolvedState survives.
# ---------------------------------------------------------

patch_file(
    APP,

'''      conversationState: {
        intent,
        location: entities?.location,
        salonId: entities?.salonId,
        salonName: entities?.salonName,
        serviceId: entities?.serviceId,
        serviceName: entities?.serviceName,
        date: entities?.date,
        time: entities?.time,
        pendingQuestion: needsClarification ? reply : undefined,
        lastResolvedContext:
          entities?.salonName || entities?.serviceName
            ? `السياق الحالي: ${entities?.salonName || ''} ${entities?.serviceName || ''}`.trim()
            : undefined,
      },''',

'''      conversationState: {
        ...resolvedState,

        intent:
          intent ||
          resolvedState.intent,

        location:
          entities?.location ||
          resolvedState.location,

        salonId:
          entities?.salonId ||
          resolvedState.salonId,

        salonName:
          entities?.salonName ||
          resolvedState.salonName,

        serviceId:
          entities?.serviceId ||
          resolvedState.serviceId,

        serviceName:
          entities?.serviceName ||
          resolvedState.serviceName,

        date:
          entities?.date ||
          resolvedState.date,

        time:
          entities?.time ||
          resolvedState.time,

        pendingQuestion:
          needsClarification
            ? reply
            : undefined,

        lastResolvedContext:
          (
            entities?.salonName ||
            entities?.serviceName ||
            resolvedState.salonName ||
            resolvedState.serviceName
          )
            ? `السياق الحالي: ${
                entities?.salonName ||
                resolvedState.salonName ||
                ''
              } ${
                entities?.serviceName ||
                resolvedState.serviceName ||
                ''
              }`.trim()
            : resolvedState.lastResolvedContext,
      },''',

    "Server: never discard resolved booking state"
)

# ---------------------------------------------------------
# 11. DB: resource-level conflict protection
#
# If barberId exists:
#   same salon + same barber + same date + same time
#
# If no barber:
#   same salon + same date + same time + another salon-level booking
#
# This prevents duplicate salon-level bookings without
# incorrectly blocking a booking because another barber has
# the same time.
# ---------------------------------------------------------

patch_file(
    DB,

'''    // 5. Check double booking only when a specific barber exists.
    // A salon-level booking without a barber must not be blocked by barber slots.
    if (bookingData.barberId) {
      const conflict = this.state.bookings.find(
        (b) =>
          b.barberId === bookingData.barberId &&
          b.date === bookingData.date &&
          b.timeSlot === bookingData.timeSlot &&
          b.status !== 'cancelled'
      );

      if (conflict) {
        return {
          success: false,
          error: 'الموعد المحدد محجوز بالفعل لهذا الحلاق. يرجى اختيار موعد أو حلاق آخر.',
        };
      }
    }''',

'''    // 5. Check conflicts at the same resource level.
    //
    // With a barber:
    //   salon + barber + date + time
    //
    // Without a barber:
    //   salon + date + time + another salon-level booking
    //
    // Cancelled bookings do not block the slot.
    const conflict = this.state.bookings.find(
      (b) =>
        b.salonId === bookingData.salonId &&
        b.date === bookingData.date &&
        b.timeSlot === bookingData.timeSlot &&
        b.status !== 'cancelled' &&
        (
          bookingData.barberId
            ? b.barberId === bookingData.barberId
            : !b.barberId
        )
    );

    if (conflict) {
      return {
        success: false,
        error: bookingData.barberId
          ? 'الموعد المحدد محجوز بالفعل لهذا الحلاق. يرجى اختيار موعد أو حلاق آخر.'
          : 'الموعد المحدد محجوز بالفعل لهذا الصالون. يرجى اختيار موعد آخر.',
      };
    }''',

    "DB: resource-level booking conflict protection"
)

# ---------------------------------------------------------
# 12. Safety checks before writing
# ---------------------------------------------------------

print()
print("-" * 70)
print("VALIDATING PATCH")
print("-" * 70)

required_markers = [
    (
        APP,
        "const resolvedState: any",
        "resolvedState exists"
    ),
    (
        APP,
        "for (turn = 1; turn <= MAX_TOOL_TURNS; turn++)",
        "MAX_TOOL_TURNS loop"
    ),
    (
        APP,
        "contents = [",
        "Gemini conversation contents"
    ),
    (
        UI,
        "{ role: 'user', text }",
        "current user turn"
    ),
    (
        UI,
        "data.conversationState",
        "authoritative UI state"
    ),
    (
        DB,
        "b.salonId === bookingData.salonId",
        "salon-level conflict check"
    ),
]

for path, marker, label in required_markers:
    if marker not in working[path]:
        raise RuntimeError(
            f"VALIDATION FAILED: {label}"
        )

print("[OK] All structural validations passed.")

# ---------------------------------------------------------
# 13. Write files atomically
# ---------------------------------------------------------

try:
    for f in FILES:
        tmp = f.with_suffix(f.suffix + ".halaqi.tmp")
        tmp.write_text(working[f], encoding="utf-8")
        tmp.replace(f)

except Exception as e:
    print()
    print("[ERROR] Write failed:", e)
    print("Restoring backup...")

    for f in FILES:
        shutil.copy2(backup / f.name, f)

    raise SystemExit(1)

# ---------------------------------------------------------
# 14. Build
# ---------------------------------------------------------

print()
print("=" * 70)
print("RUNNING npm run build")
print("=" * 70)
print()

result = subprocess.run(
    ["npm", "run", "build"],
    cwd=ROOT
)

if result.returncode != 0:
    print()
    print("=" * 70)
    print("BUILD FAILED")
    print("=" * 70)
    print()
    print("Restoring original files from backup...")

    for f in FILES:
        shutil.copy2(backup / f.name, f)

    print("[RESTORED]")
    print()
    print("Backup:", backup)
    raise SystemExit(result.returncode)

# ---------------------------------------------------------
# 15. Final report
# ---------------------------------------------------------

print()
print("=" * 70)
print("HALAQI BOOKING ROOT FIX COMPLETE")
print("=" * 70)
print()
print(f"Patched files: {len(changed)}")
for item in changed:
    print("  [OK]", item)

print()
print("BUILD: OK")
print()
print("Backup:")
print(backup)
print()
print("IMPORTANT:")
print("لم يتم نشر المشروع تلقائياً.")
print("اختبر الحجز أولاً ثم نفذ git diff و git status.")
print()
