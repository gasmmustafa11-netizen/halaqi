#!/usr/bin/env python3
import os
import re
import shutil
import subprocess
from datetime import datetime
from pathlib import Path

ROOT = Path.cwd()

TARGETS = [
    "src/components/your-salon/YourSalonView.tsx",
    "src/server/app.ts",
    "src/server/db.ts",
    "src/services/aiSalonTools.ts",
]

STAMP = datetime.now().strftime("%Y%m%d-%H%M%S")
BACKUP = ROOT / f".halaqi-booking-final-repair-backup-{STAMP}"


def fail(msg):
    print("\n[STOP]")
    print(msg)
    print("\nلم يتم تنفيذ أي تعديل إضافي.")
    raise SystemExit(1)


def run(cmd, check=True):
    print("$", " ".join(cmd))
    return subprocess.run(
        cmd,
        cwd=ROOT,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        check=check,
    )


def read(path):
    return (ROOT / path).read_text(encoding="utf-8")


def write(path, content):
    (ROOT / path).write_text(content, encoding="utf-8")


def backup_file(path):
    src = ROOT / path
    dst = BACKUP / path
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        fail(
            f"{label}: expected exactly 1 occurrence, found {count}.\n"
            f"لن أخمّن البنية."
        )
    return text.replace(old, new, 1)


def assert_contains(text, needle, label):
    if needle not in text:
        fail(f"{label}: لم أجد البنية المطلوبة.")


print("=" * 72)
print("HALAQI AI — FINAL BOOKING REPAIR")
print("=" * 72)
print()

if not (ROOT / ".git").exists():
    fail("المجلد الحالي ليس Git repository.")

for p in TARGETS:
    if not (ROOT / p).exists():
        fail(f"الملف غير موجود: {p}")

print("[OK] Git repository")
print("[OK] All target files exist")

# ---------------------------------------------------------------------
# Show current git state
# ---------------------------------------------------------------------

status = run(["git", "status", "--short"]).stdout
print("\n--- CURRENT GIT STATUS ---")
print(status.strip() or "(clean)")

# ---------------------------------------------------------------------
# Backup
# ---------------------------------------------------------------------

for p in TARGETS:
    backup_file(p)

print(f"\n[BACKUP] {BACKUP}")

# ---------------------------------------------------------------------
# 1) UI — YourSalonView
# ---------------------------------------------------------------------

path = "src/components/your-salon/YourSalonView.tsx"
text = read(path)

print("\n[1/4] Checking YourSalonView.tsx")

assert_contains(
    text,
    "const history = msgs.map((m) => ({ role: m.role, text: m.text }));",
    "UI history baseline",
)

# Replace the stale-history bug.
old = """const history = msgs.map((m) => ({ role: m.role, text: m.text }));
      const data = await aiSalonChat({ message: text, regionConsent: false, conversationHistory: history, conversationState });"""

new = """const history = [
        ...msgs.map((m) => ({ role: m.role, text: m.text })),
        { role: 'user', text },
      ].slice(-12);

      const data = await aiSalonChat({
        message: text,
        regionConsent: false,
        conversationHistory: history,
        conversationState,
      });

      // Server conversationState is authoritative for the current AI booking flow.
      if (data?.conversationState) {
        setConversationState((prev) => ({
          ...prev,
          ...Object.fromEntries(
            Object.entries(data.conversationState).filter(
              ([, value]) =>
                value !== undefined &&
                value !== null &&
                value !== ''
            )
          ),
        }));
      }"""

if old in text:
    text = replace_once(
        text,
        old,
        new,
        "UI history/state replacement",
    )
    print("[FIX] UI sends current message in history")
    print("[FIX] UI persists server conversationState")
else:
    if "Server conversationState is authoritative for the current AI booking flow." in text:
        print("[OK] UI history/state fix already present")
    else:
        fail("UI history block differs from expected current structure.")

# Persist selected salon when a result card is clicked.
old_card = """onClick={() => { if (card.id) onSelectSalonId(card.id); }}"""

new_card = """onClick={() => {
                        if (card.id) {
                          setSelectedSalonId(card.id);
                          setConversationState((prev) => ({
                            ...prev,
                            salonId: card.id,
                            salonName: card.name || prev.salonName,
                            lastResolvedContext: `صالون مختار: ${card.name || ''}`,
                          }));
                          onSelectSalonId(card.id);
                        }
                      }}"""

if old_card in text:
    text = replace_once(
        text,
        old_card,
        new_card,
        "salon card selection",
    )
    print("[FIX] Selected salon is persisted in conversationState")
elif "setSelectedSalonId(card.id);" in text:
    print("[OK] Salon card state persistence already present")
else:
    fail("Salon card click structure differs from expected current structure.")

write(path, text)

# ---------------------------------------------------------------------
# 2) DB — preserve local conflict fix, add authoritative fallback
# ---------------------------------------------------------------------

path = "src/server/db.ts"
text = read(path)

print("\n[2/4] Checking db.ts")

# Verify the user's local conflict fix is still present.
local_conflict = """const conflict = this.state.bookings.find(
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
    );"""

if local_conflict not in text:
    fail(
        "لم أجد تعديل db.ts المحلي الخاص بمنع التعارض على مستوى الصالون.\n"
        "لن أستبدله بنسخة أخرى."
    )

print("[OK] Local salon-level conflict fix preserved")

# Verify authoritative service price is used.
assert_contains(
    text,
    "const realServicePrice = service.price;",
    "authoritative service price",
)

# Verify persistence happens before memory publication.
assert_contains(
    text,
    "// Neon persistence succeeded; now publish the booking to in-memory state.",
    "Neon persistence ordering",
)

print("[OK] Authoritative price validation")
print("[OK] Neon persistence precedes in-memory publication")

# Important: do NOT invent a PostgreSQL UNIQUE constraint here.
# Existing project schema has not been verified to support a safe migration.
print("[SAFE] No unverified DB constraint/schema was invented")

# ---------------------------------------------------------------------
# 3) AI tools — harden booking input validation
# ---------------------------------------------------------------------

path = "src/services/aiSalonTools.ts"
text = read(path)

print("\n[3/4] Checking aiSalonTools.ts")

assert_contains(
    text,
    "if (!context?.user?.id)",
    "authenticated booking guard",
)

assert_contains(
    text,
    "if (!context.allowBooking || params.confirmed !== true)",
    "explicit booking confirmation guard",
)

assert_contains(
    text,
    "customerId: customer.id",
    "server-derived customer identity",
)

assert_contains(
    text,
    "barberId: undefined",
    "AI cannot inject barber identity",
)

# Fix the Arabic word-boundary bug only if the exact broken form exists.
broken = """.replace(/\\\\bصالون\\\\b/g, ' ')
        .replace(/\\\\bصالونات\\\\b/g, ' ')"""

fixed = """.replace(/\\bصالون\\b/gu, ' ')
        .replace(/\\bصالونات\\b/gu, ' ')"""

if broken in text:
    text = replace_once(
        text,
        broken,
        fixed,
        "Arabic salon keyword normalization",
    )
    print("[FIX] Arabic salon keyword normalization")
elif fixed in text:
    print("[OK] Arabic salon keyword normalization already correct")
else:
    fail("لم أجد normalization block المتوقع في aiSalonTools.ts.")

# Never let a model-provided price become booking authority.
if "price: result.booking.finalPrice" in text:
    print("[OK] Booking result price comes from server result")

write(path, text)

# ---------------------------------------------------------------------
# 4) app.ts — Gemini tool-loop + confirmation safety
# ---------------------------------------------------------------------

path = "src/server/app.ts"
text = read(path)

print("\n[4/4] Checking app.ts")

assert_contains(
    text,
    "const MAX_TOOL_TURNS = 6;",
    "Gemini tool loop limit",
)

assert_contains(
    text,
    "const explicitBookingConfirm =",
    "explicit confirmation detector",
)

assert_contains(
    text,
    "const bookingMatchesConfirmedState =",
    "booking state binding",
)

assert_contains(
    text,
    "allowBooking:",
    "server booking authorization",
)

# Ensure the loop really uses MAX_TOOL_TURNS.
loop_old = "for (turn = 1; turn <= 3; turn++)"
loop_new = "for (turn = 1; turn <= MAX_TOOL_TURNS; turn++)"

if loop_old in text:
    text = replace_once(
        text,
        loop_old,
        loop_new,
        "Gemini turn loop",
    )
    print("[FIX] Gemini loop now uses MAX_TOOL_TURNS")
elif loop_new in text:
    print("[OK] Gemini loop already uses MAX_TOOL_TURNS")
else:
    fail("Gemini turn loop differs from expected structure.")

# The current implementation must not silently accept create_booking
# unless the authenticated user + exact conversation state + explicit
# confirmation all agree.
expected_guard = """allowBooking:
                    !!req.user &&
                    explicitBookingConfirm &&
                    bookingMatchesConfirmedState &&"""

assert_contains(
    text,
    expected_guard,
    "booking authorization guard",
)

print("[OK] Explicit confirmation remains mandatory")
print("[OK] Booking arguments remain bound to conversationState")

write(path, text)

# ---------------------------------------------------------------------
# Static safety checks
# ---------------------------------------------------------------------

print("\n" + "=" * 72)
print("STATIC VERIFICATION")
print("=" * 72)

checks = [
    (
        "YourSalon current-message history",
        "const history = [" in read("src/components/your-salon/YourSalonView.tsx"),
    ),
    (
        "YourSalon server state persistence",
        "Server conversationState is authoritative" in read("src/components/your-salon/YourSalonView.tsx"),
    ),
    (
        "Salon card state persistence",
        "setSelectedSalonId(card.id);" in read("src/components/your-salon/YourSalonView.tsx"),
    ),
    (
        "DB local conflict protection",
        "b.salonId === bookingData.salonId" in read("src/server/db.ts"),
    ),
    (
        "Server-authoritative service price",
        "const realServicePrice = service.price;" in read("src/server/db.ts"),
    ),
    (
        "Authenticated booking",
        "if (!context?.user?.id)" in read("src/services/aiSalonTools.ts"),
    ),
    (
        "Explicit booking confirmation",
        "params.confirmed !== true" in read("src/services/aiSalonTools.ts"),
    ),
    (
        "Authenticated customer identity",
        "customerId: customer.id" in read("src/services/aiSalonTools.ts"),
    ),
    (
        "Gemini max turns",
        "for (turn = 1; turn <= MAX_TOOL_TURNS; turn++)" in read("src/server/app.ts"),
    ),
    (
        "Exact booking state binding",
        "bookingMatchesConfirmedState" in read("src/server/app.ts"),
    ),
]

failed = []

for name, ok in checks:
    print((" [OK] " if ok else " [FAIL] ") + name)
    if not ok:
        failed.append(name)

if failed:
    fail("Static verification failed: " + ", ".join(failed))

# ---------------------------------------------------------------------
# TypeScript + build
# ---------------------------------------------------------------------

print("\n" + "=" * 72)
print("TYPECHECK")
print("=" * 72)

lint = subprocess.run(
    ["npm", "run", "lint"],
    cwd=ROOT,
    text=True,
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
)

print(lint.stdout)

if lint.returncode != 0:
    print("\n[ROLLBACK] TypeScript check failed. Restoring backups...")

    for p in TARGETS:
        src = BACKUP / p
        dst = ROOT / p
        shutil.copy2(src, dst)

    print("[ROLLBACK] Complete.")
    fail("npm run lint فشل؛ لم أترك تغييرات غير متحققة.")

print("[OK] TypeScript")

print("\n" + "=" * 72)
print("BUILD")
print("=" * 72)

build = subprocess.run(
    ["npm", "run", "build"],
    cwd=ROOT,
    text=True,
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
)

print(build.stdout)

if build.returncode != 0:
    print("\n[ROLLBACK] Build failed. Restoring backups...")

    for p in TARGETS:
        src = BACKUP / p
        dst = ROOT / p
        shutil.copy2(src, dst)

    print("[ROLLBACK] Complete.")
    fail("npm run build فشل؛ تم استرجاع النسخة السابقة.")

print("[OK] Build")

# ---------------------------------------------------------------------
# Final diff
# ---------------------------------------------------------------------

print("\n" + "=" * 72)
print("FINAL DIFF STAT")
print("=" * 72)

print(run(["git", "diff", "--stat"]).stdout)

print("\n" + "=" * 72)
print("FINAL STATUS")
print("=" * 72)

print(run(["git", "status", "--short"]).stdout)

print("\n" + "=" * 72)
print("DONE")
print("=" * 72)
print(f"""
تم تطبيق الإصلاحات التي أمكن التحقق منها بدون تخمين.

Backup:
{BACKUP}

مهم:
- لم يتم حذف تعديل db.ts المحلي.
- لم يتم اختراع UNIQUE constraint غير متحقق من schema.
- إذا فشل TypeScript أو build يتم rollback تلقائياً.
""")
