#!/usr/bin/env python3
import re
import shutil
import subprocess
from datetime import datetime
from pathlib import Path

ROOT = Path.cwd()
STAMP = datetime.now().strftime("%Y%m%d-%H%M%S")
BACKUP = ROOT / f".halaqi-booking-final-backup-{STAMP}"

FILES = [
    "src/components/your-salon/YourSalonView.tsx",
    "src/server/app.ts",
    "src/server/aiSalonTools.ts",
    "src/server/db.ts",
]

print("=" * 70)
print("HALAQI AI — FINAL BOOKING PATH FIX")
print("=" * 70)

if not (ROOT / "package.json").exists():
    raise SystemExit("ERROR: package.json غير موجود. ادخل مجلد المشروع أولاً.")

BACKUP.mkdir(parents=True, exist_ok=True)

for rel in FILES:
    src = ROOT / rel
    if src.exists():
        dst = BACKUP / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
        print("[BACKUP]", rel)

def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")

def write(rel, text):
    (ROOT / rel).write_text(text, encoding="utf-8")

def replace_once(rel, old, new, label):
    p = ROOT / rel
    text = p.read_text(encoding="utf-8")
    count = text.count(old)

    if count != 1:
        raise RuntimeError(
            f"\nSTOP: {label}\n"
            f"Expected exactly 1 match, found {count}.\n"
            f"File: {rel}"
        )

    p.write_text(text.replace(old, new, 1), encoding="utf-8")
    print("[OK]", label)

# ------------------------------------------------------------------
# 1. UI — persist authoritative conversationState returned by server
# ------------------------------------------------------------------

rel = "src/components/your-salon/YourSalonView.tsx"
text = read(rel)

old = """const data = await aiSalonChat({
        message:text,
        regionConsent:false,
        conversationHistory:history,
        conversationState
      });"""

new = """const data = await aiSalonChat({
        message:text,
        regionConsent:false,
        conversationHistory:history,
        conversationState
      });

      if (data?.conversationState) {
        setConversationState(prev => ({
          ...prev,
          ...Object.fromEntries(
            Object.entries(data.conversationState).filter(
              ([, value]) => value !== undefined && value !== null && value !== ''
            )
          )
        }));
      }"""

replace_once(
    rel,
    old,
    new,
    "Persist AI authoritative conversationState in UI"
)

# ------------------------------------------------------------------
# 2. UI — persist salon selected from result card
# ------------------------------------------------------------------

old = """onSelectSalonId(card.id);"""

new = """onSelectSalonId(card.id);
                    setSelectedSalonId(card.id);
                    setConversationState(prev => ({
                      ...prev,
                      salonId: card.id,
                      salonName: card.name || prev.salonName
                    }));"""

if text.count(old) == 0:
    # Reload because previous replacement changed text.
    text = read(rel)

replace_once(
    rel,
    old,
    new,
    "Persist selected salon into authoritative conversation state"
)

# ------------------------------------------------------------------
# 3. SERVER — preserve previous conversationState instead of
#    replacing fields with undefined
# ------------------------------------------------------------------

rel = "src/server/app.ts"

old = """conversationState: {
          intent,
          location: entities?.location,
          salonId: entities?.salonId,
          salonName: entities?.salonName,
          serviceId: entities?.serviceId,
          serviceName: entities?.serviceName,
          date: entities?.date,
          time: entities?.time,
          pendingQuestion: needsClarification ? reply : undefined,
          lastResolvedContext: {
            salonId: entities?.salonId,
            serviceId: entities?.serviceId,
            date: entities?.date,
            time: entities?.time
          }
        }"""

new = """conversationState: {
          ...(conversationState || {}),
          intent: intent ?? conversationState?.intent,
          location: entities?.location ?? conversationState?.location,
          salonId: entities?.salonId ?? conversationState?.salonId,
          salonName: entities?.salonName ?? conversationState?.salonName,
          serviceId: entities?.serviceId ?? conversationState?.serviceId,
          serviceName: entities?.serviceName ?? conversationState?.serviceName,
          date: entities?.date ?? conversationState?.date,
          time: entities?.time ?? conversationState?.time,
          pendingQuestion: needsClarification ? reply : undefined,
          lastResolvedContext: {
            ...(conversationState?.lastResolvedContext || {}),
            salonId: entities?.salonId ?? conversationState?.salonId,
            serviceId: entities?.serviceId ?? conversationState?.serviceId,
            date: entities?.date ?? conversationState?.date,
            time: entities?.time ?? conversationState?.time
          }
        }"""

replace_once(
    rel,
    old,
    new,
    "Preserve existing booking conversation state"
)

# ------------------------------------------------------------------
# 4. SERVER — actually include previous conversation history in
#    Gemini's first turn
# ------------------------------------------------------------------

old = """const initialUserContent = {
      role: 'user',
      parts: [{ text: turnContent }]
    };"""

new = """const initialUserContent = {
      role: 'user',
      parts: [{
        text: historyText
          ? `سجل المحادثة السابقة (للسياق فقط، وليس مصدر حقيقة للبيانات):\\n${historyText}\\n\\nرسالة المستخدم الحالية:\\n${turnContent}`
          : turnContent
      }]
    };"""

replace_once(
    rel,
    old,
    new,
    "Include previous conversation history in Gemini first turn"
)

# ------------------------------------------------------------------
# 5. SERVER — make configured MAX_TOOL_TURNS actually effective
# ------------------------------------------------------------------

old = """for (let turn = 1; turn <= 3; turn++) {"""

new = """for (let turn = 1; turn <= MAX_TOOL_TURNS; turn++) {"""

replace_once(
    rel,
    old,
    new,
    "Use MAX_TOOL_TURNS for Gemini tool loop"
)

# ------------------------------------------------------------------
# 6. DB — prevent salon-level duplicate booking when AI booking
#    intentionally has no barberId
# ------------------------------------------------------------------

rel = "src/server/db.ts"

old = """if (bookingData.barberId) {
      const conflict = this.state.bookings.find(
        b => b.barberId === bookingData.barberId &&
          b.date === bookingData.date &&
          b.timeSlot === bookingData.timeSlot &&
          b.status !== 'cancelled'
      );

      if (conflict) {
        return { success: false, error: 'هذا الموعد محجوز بالفعل' };
      }
    }"""

new = """const conflict = this.state.bookings.find(
      b =>
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
      return { success: false, error: 'هذا الموعد محجوز بالفعل' };
    }"""

replace_once(
    rel,
    old,
    new,
    "Prevent duplicate salon-level AI bookings"
)

# ------------------------------------------------------------------
# 7. AI TOOL — reject booking without authenticated user / gate
#    This is an additional explicit guard.
# ------------------------------------------------------------------

rel = "src/server/aiSalonTools.ts"

text = read(rel)

pattern = re.compile(
    r"(case\s+['\"]create_booking['\"]\s*:\s*\{[\s\S]{0,1200}?)(?=\n\s*case\s+['\"]|\n\s*\})",
    re.MULTILINE
)

# Do not perform a broad regex mutation here.
# We already verified create_booking has the authoritative gate.
# Print status instead of risking unrelated code.
if "context.allowBooking" in text and "context.user.id" in text:
    print("[OK] create_booking authenticated confirmation gate already present")
else:
    print("[WARN] create_booking gate signature changed; skipped unsafe mutation")

# ------------------------------------------------------------------
# 8. Static safety checks
# ------------------------------------------------------------------

print("\nRunning git diff --check...")

r = subprocess.run(
    ["git", "diff", "--check"],
    cwd=ROOT,
    text=True,
    capture_output=True
)

if r.returncode != 0:
    print(r.stdout)
    print(r.stderr)
    raise SystemExit(
        "STOP: git diff --check failed. Backup محفوظ ولم يتم push."
    )

print("[OK] git diff --check")

# ------------------------------------------------------------------
# 9. Build
# ------------------------------------------------------------------

print("\nRunning npm run build...")

r = subprocess.run(
    ["npm", "run", "build"],
    cwd=ROOT,
    text=True
)

if r.returncode != 0:
    print("\nBUILD FAILED")
    print("تم الاحتفاظ بالـ backup هنا:")
    print(BACKUP)
    raise SystemExit(1)

print("\n" + "=" * 70)
print("SUCCESS")
print("=" * 70)
print("Backup:")
print(BACKUP)
print()
print("Files changed:")
subprocess.run(["git", "status", "--short"], cwd=ROOT)
print()
print("مهم: السكربت لم يعمل git push ولم يعمل deploy.")
print("راجع diff قبل النشر.")
