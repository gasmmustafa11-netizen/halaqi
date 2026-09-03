#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
HALAQI AI — COMPLETE BOOKING SAFETY/FLOW FIX

Purpose:
- Fix the currently verified AI booking-path defects.
- Never blindly overwrite a file.
- Create a timestamped backup first.
- Abort if an expected structural pattern is ambiguous.
- Run git diff --check and npm run build.
- NEVER push or deploy automatically.

This script intentionally does NOT invent:
- working-hours schema
- slot duration
- barber scheduling rules
- unknown DB columns
"""

from pathlib import Path
from datetime import datetime
import shutil
import subprocess
import re
import sys

ROOT = Path.cwd()
STAMP = datetime.now().strftime("%Y%m%d-%H%M%S")
BACKUP = ROOT / f".halaqi-booking-complete-backup-{STAMP}"

TARGETS = [
    "src/components/your-salon/YourSalonView.tsx",
    "src/server/app.ts",
    "src/server/db.ts",
    "src/services/aiSalonTools.ts",
]

print("=" * 78)
print("HALAQI AI — COMPLETE BOOKING FIX")
print("=" * 78)
print()

if not (ROOT / "package.json").exists():
    sys.exit("ERROR: package.json غير موجود. شغّل السكربت من مجلد halaqi.")

# ---------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------

def backup_file(rel):
    src = ROOT / rel
    if not src.exists():
        return False

    dst = BACKUP / rel
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)
    print("[BACKUP]", rel)
    return True


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


def write(rel, text):
    (ROOT / rel).write_text(text, encoding="utf-8")


def replace_exact(rel, old, new, label):
    p = ROOT / rel
    text = p.read_text(encoding="utf-8")
    n = text.count(old)

    if n != 1:
        raise RuntimeError(
            f"\nSTOP — {label}\n"
            f"File: {rel}\n"
            f"Expected: exactly 1 occurrence\n"
            f"Found: {n}\n"
            f"No modification made for this operation."
        )

    p.write_text(text.replace(old, new, 1), encoding="utf-8")
    print("[OK]", label)


def replace_regex(rel, pattern, replacement, label, flags=re.MULTILINE):
    p = ROOT / rel
    text = p.read_text(encoding="utf-8")
    new, n = re.subn(pattern, replacement, text, count=1, flags=flags)

    if n != 1:
        raise RuntimeError(
            f"\nSTOP — {label}\n"
            f"File: {rel}\n"
            f"Regex match count: {n}\n"
            f"No modification made for this operation."
        )

    p.write_text(new, encoding="utf-8")
    print("[OK]", label)


def has(rel, needle):
    return needle in read(rel)


# ---------------------------------------------------------------------
# Backup
# ---------------------------------------------------------------------

for rel in TARGETS:
    backup_file(rel)

print()
print("Backup:", BACKUP)
print()

# =====================================================================
# 1. UI — preserve server conversationState
# =====================================================================

ui = "src/components/your-salon/YourSalonView.tsx"
ui_text = read(ui)

# Find the actual aiSalonChat call rather than relying on old formatting.
if "aiSalonChat({" not in ui_text:
    raise RuntimeError(
        "لم أجد aiSalonChat في YourSalonView.tsx — أوقف الإصلاح حتى لا نخمن."
    )

# If already fixed, don't touch.
if "data?.conversationState" in ui_text and "setConversationState(prev" in ui_text:
    print("[SKIP] UI conversationState persistence already present")
else:
    # Insert immediately after the closing call by targeting the known
    # semantic sequence: conversationState passed into aiSalonChat.
    pattern = re.compile(
        r"(const\s+data\s*=\s*await\s+aiSalonChat\s*\(\s*\{[\s\S]*?"
        r"conversationState[\s\S]*?\}\s*\);)"
    )

    match = pattern.search(ui_text)

    if not match:
        raise RuntimeError(
            "لم أستطع تحديد كتلة aiSalonChat الحالية بأمان."
        )

    insertion = r"""
      
      // Keep the server-authoritative booking state across turns.
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
      }"""

    ui_text = (
        ui_text[:match.end()]
        + insertion
        + ui_text[match.end():]
    )

    write(ui, ui_text)
    print("[OK] UI preserves server conversationState")

# =====================================================================
# 2. UI — persist selected salon into booking conversation state
# =====================================================================

ui_text = read(ui)

if (
    "salonId: card.id" in ui_text
    and "setSelectedSalonId(card.id)" in ui_text
):
    print("[SKIP] Selected salon already persisted")
else:
    # Find a card click/select handler containing onSelectSalonId(card.id)
    pattern = re.compile(
        r"(?P<indent>[ \t]*)onSelectSalonId\(\s*card\.id\s*\);"
    )

    m = pattern.search(ui_text)

    if not m:
        raise RuntimeError(
            "لم أجد onSelectSalonId(card.id) في YourSalonView.tsx. "
            "لن أخمن مكان اختيار الصالون."
        )

    indent = m.group("indent")

    replacement = (
        f"{indent}onSelectSalonId(card.id);\n"
        f"{indent}setSelectedSalonId(card.id);\n"
        f"{indent}setConversationState(prev => ({{\n"
        f"{indent}  ...prev,\n"
        f"{indent}  salonId: card.id,\n"
        f"{indent}  salonName: card.name || prev.salonName\n"
        f"{indent}}}));"
    )

    ui_text = ui_text[:m.start()] + replacement + ui_text[m.end():]
    write(ui, ui_text)
    print("[OK] Selected salon persisted into conversationState")

# =====================================================================
# 3. SERVER — merge conversation state, don't erase old fields
# =====================================================================

app = "src/server/app.ts"
app_text = read(app)

# Current code contains the exact returned conversationState structure.
# We replace only that object.
old_state_pattern = re.compile(
    r"conversationState:\s*\{\s*"
    r"intent,\s*"
    r"location:\s*entities\?\.location,\s*"
    r"salonId:\s*entities\?\.salonId,\s*"
    r"salonName:\s*entities\?\.salonName,\s*"
    r"serviceId:\s*entities\?\.serviceId,\s*"
    r"serviceName:\s*entities\?\.serviceName,\s*"
    r"date:\s*entities\?\.date,\s*"
    r"time:\s*entities\?\.time,\s*"
    r"pendingQuestion:\s*needsClarification\s*\?\s*reply\s*:\s*undefined,\s*"
    r"lastResolvedContext:\s*"
    r"entities\?\.salonName\s*\|\|\s*entities\?\.serviceName[\s\S]*?"
    r":\s*undefined,\s*"
    r"\},",
    re.MULTILINE
)

if "intent: intent ?? conversationState?.intent" in app_text:
    print("[SKIP] Server conversationState merge already present")
else:
    replacement = """conversationState: {
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
        lastResolvedContext:
          entities?.salonName ||
          entities?.serviceName ||
          conversationState?.lastResolvedContext
            ? `السياق الحالي: ${
                entities?.salonName ||
                conversationState?.salonName ||
                ''
              } ${
                entities?.serviceName ||
                conversationState?.serviceName ||
                ''
              }`.trim()
            : undefined,
      },"""

    new_app, n = old_state_pattern.subn(replacement, app_text, count=1)

    if n != 1:
        raise RuntimeError(
            "لم أجد conversationState الحالي بنفس البنية المتوقعة. "
            "لن أستبدله بالتخمين."
        )

    write(app, new_app)
    print("[OK] Server preserves previous conversationState")

# =====================================================================
# 4. GEMINI — use actual previous conversation in first turn
# =====================================================================

app_text = read(app)

if (
    "سجل المحادثة السابقة" in app_text
    and "historyText" in app_text
):
    print("[SKIP] Gemini previous history already included")
else:
    pattern = re.compile(
        r"const\s+initialUserContent\s*=\s*\{\s*"
        r"role:\s*['\"]user['\"],\s*"
        r"parts:\s*\[\{\s*text:\s*turnContent\s*\}\]\s*"
        r"\};"
    )

    replacement = """const initialUserContent = {
      role: 'user',
      parts: [{
        text: historyText
          ? `سجل المحادثة السابقة (للسياق فقط، وليس مصدر حقيقة للبيانات):\\n${historyText}\\n\\nرسالة المستخدم الحالية:\\n${turnContent}`
          : turnContent
      }]
    };"""

    new_app, n = pattern.subn(replacement, app_text, count=1)

    if n != 1:
        raise RuntimeError(
            "لم أجد initialUserContent الحالي بصيغة آمنة."
        )

    write(app, new_app)
    print("[OK] Gemini receives previous conversation context")

# =====================================================================
# 5. GEMINI — make MAX_TOOL_TURNS effective
# =====================================================================

app_text = read(app)

if "for (let turn = 1; turn <= MAX_TOOL_TURNS; turn++)" in app_text:
    print("[SKIP] Gemini tool loop already uses MAX_TOOL_TURNS")
else:
    old = "for (let turn = 1; turn <= 3; turn++) {"
    if old not in app_text:
        raise RuntimeError(
            "لم أجد حلقة Gemini الحالية <= 3. لن أخمن."
        )

    app_text = app_text.replace(
        old,
        "for (let turn = 1; turn <= MAX_TOOL_TURNS; turn++) {",
        1
    )

    write(app, app_text)
    print("[OK] Gemini tool loop now uses MAX_TOOL_TURNS")

# =====================================================================
# 6. GROQ — ensure fallback receives authenticated booking context
# =====================================================================

app_text = read(app)

# First inspect the function signature and call sites.
if "async function tryGroqFallback" not in app_text:
    raise RuntimeError(
        "tryGroqFallback غير موجود — لا يمكن توحيد مسار Groq بأمان."
    )

# Add optional context to function arguments if absent.
if "conversationState?: any;" not in app_text:
    sig_pattern = re.compile(
        r"(async function tryGroqFallback\(args:\s*\{\s*"
        r"userText:\s*string;\s*"
        r"systemInstruction:\s*string;\s*"
        r"dbModule:\s*any;\s*"
        r"cards\?:\s*any\[\];)"
    )

    sig_replacement = (
        r"\1\n"
        r"  conversationHistory?: any[];\n"
        r"  conversationState?: any;\n"
        r"  user?: any;\n"
    )

    new_app, n = sig_pattern.subn(
        sig_replacement,
        app_text,
        count=1
    )

    if n != 1:
        raise RuntimeError(
            "لم أستطع تعديل توقيع tryGroqFallback بأمان."
        )

    app_text = new_app
    write(app, app_text)
    print("[OK] Groq fallback accepts booking context")

# ---------------------------------------------------------------------
# Locate executeTool calls inside Groq.
# ---------------------------------------------------------------------

app_text = read(app)

if (
    "executeTool(name, argsParsed, args.dbModule, sqlImport, {" in app_text
    or "executeTool(name, argsParsed, args.dbModule, sqlImport, {" in app_text
):
    print("[SKIP] Groq executeTool context already appears present")
else:
    # Current source historically used:
    # executeTool(name,argsParsed,args.dbModule,sqlImport)
    #
    # Replace ONLY calls in tryGroqFallback by limiting the edit to that
    # function body.
    start = app_text.find("async function tryGroqFallback")
    if start < 0:
        raise RuntimeError("Groq fallback function not found.")

    end = app_text.find("// ---", start + 10)
    if end < 0:
        # Function ends before the AI route; use next known marker.
        end = app_text.find("// --- AI Salon", start + 10)

    if end < 0:
        # Safer: don't perform broad replacement.
        print("[WARN] Could not safely bound Groq function; skipped context mutation")
    else:
        groq_block = app_text[start:end]

        old_call = (
            "executeTool(name, argsParsed, args.dbModule, sqlImport)"
        )

        if old_call in groq_block:
            new_call = """executeTool(
              name,
              argsParsed,
              args.dbModule,
              sqlImport,
              {
                user: args.user,
                allowBooking:
                  !!args.user &&
                  argsParsed?.confirmed === true
              }
            )"""

            groq_block = groq_block.replace(
                old_call,
                new_call
            )

            app_text = (
                app_text[:start]
                + groq_block
                + app_text[end:]
            )

            write(app, app_text)
            print("[OK] Groq tool execution receives authenticated context")
        else:
            print("[WARN] Groq executeTool call format differs; skipped unsafe replacement")

# =====================================================================
# 7. DB — prevent salon-level duplicate bookings in application state
# =====================================================================

db = "src/server/db.ts"
db_text = read(db)

if (
    "b.salonId === bookingData.salonId" in db_text
    and "!b.barberId" in db_text
    and "bookingData.barberId" in db_text
):
    print("[SKIP] Salon-level duplicate protection already present")
else:
    pattern = re.compile(
        r"//\s*5\.\s*Check double booking only when a specific barber exists\."
        r"[\s\S]*?"
        r"if\s*\(bookingData\.barberId\)\s*\{[\s\S]*?"
        r"\n\s*\}",
        re.MULTILINE
    )

    replacement = """// 5. Prevent duplicate bookings.
    //
    // If a barber is explicitly selected, the slot belongs to that barber.
    // If no barber is selected (the AI booking path), the same salon/date/
    // time cannot be booked twice without a barber.
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
        error: 'الموعد المحدد محجوز بالفعل. يرجى اختيار موعد آخر.',
      };
    }"""

    new_db, n = pattern.subn(
        replacement,
        db_text,
        count=1
    )

    if n != 1:
        raise RuntimeError(
            "لم أجد فحص double-booking الحالي بنفس البنية. "
            "لن أعدل db.ts بالتخمين."
        )

    write(db, new_db)
    print("[OK] Application-level salon duplicate protection")

# =====================================================================
# 8. DB — validate basic date/time format before persistence
# =====================================================================

db_text = read(db)

marker = """// 6. Check if time is blocked by salon owner"""

if "BOOKING_DATE_TIME_INVALID" in db_text:
    print("[SKIP] Basic booking date/time validation already present")
else:
    if marker not in db_text:
        raise RuntimeError(
            "لم أجد موضع blocked-time validation في createBookingAtomic."
        )

    validation = """// 5.5 Validate booking date/time format before any persistence.
    // This is deliberately format-only: working-hours semantics are not
    // guessed here because the project's working_hours schema must remain
    // authoritative.
    const validDate =
      /^\\\\d{4}-\\\\d{2}-\\\\d{2}$/.test(String(bookingData.date || ''));

    const validTime =
      /^([01]\\\\d|2[0-3]):[0-5]\\\\d$/.test(
        String(bookingData.timeSlot || '')
      );

    if (!validDate || !validTime) {
      return {
        success: false,
        error: 'تاريخ أو وقت الحجز غير صالح.',
      };
    }

    """

    db_text = db_text.replace(
        marker,
        validation + marker,
        1
    )

    write(db, db_text)
    print("[OK] Basic booking date/time validation")

# =====================================================================
# 9. DB — make in-memory customer hydration failure explicit
# =====================================================================

db_text = read(db)

if "getUserByIdFromNeon(bookingData.customerId)" in db_text:
    print("[SKIP] Customer Neon fallback already present")
else:
    # Do NOT inject an unknown method. We only report the confirmed risk.
    print(
        "[WARN] createBookingAtomic still depends on in-memory customer state. "
        "No unsafe guessed DB method was injected."
    )

# =====================================================================
# 10. AI TOOL — strengthen create_booking input validation
# =====================================================================

tools = "src/services/aiSalonTools.ts"
tools_text = read(tools)

if "BOOKING_DATE_TIME_INVALID" in tools_text:
    print("[SKIP] AI tool date/time validation already present")
else:
    marker = """      // Sync authoritative salon/service data before booking."""

    if marker not in tools_text:
        raise RuntimeError(
            "لم أجد موضع authoritative salon/service sync في create_booking."
        )

    validation = """      // Strict input validation before any DB write.
      if (!/^\\\\d{4}-\\\\d{2}-\\\\d{2}$/.test(date) ||
          !/^([01]\\\\d|2[0-3]):[0-5]\\\\d$/.test(timeSlot)) {
        return {
          error: 'تاريخ أو وقت الحجز غير صالح.',
          code: 'BOOKING_DATE_TIME_INVALID',
        };
      }

"""

    tools_text = tools_text.replace(
        marker,
        validation + marker,
        1
    )

    write(tools, tools_text)
    print("[OK] AI create_booking validates date/time format")

# =====================================================================
# 11. AI TOOL — verify confirmation is exact boolean
# =====================================================================

tools_text = read(tools)

if "params.confirmed !== true" in tools_text:
    print("[OK] create_booking requires confirmed === true")
else:
    raise RuntimeError(
        "CRITICAL: create_booking no longer contains confirmed === true gate."
    )

# =====================================================================
# 12. AI TOOL — verify authenticated identity
# =====================================================================

if "context?.user?.id" in tools_text:
    print("[OK] create_booking requires authenticated user")
else:
    raise RuntimeError(
        "CRITICAL: authenticated-user gate not found in create_booking."
    )

# =====================================================================
# 13. Verify server-side allowBooking gate
# =====================================================================

app_text = read(app)

if "allowBooking:" in app_text and "explicitBookingConfirm" in app_text:
    print("[OK] Server explicit booking confirmation gate exists")
else:
    raise RuntimeError(
        "CRITICAL: server explicit confirmation gate not found."
    )

# =====================================================================
# 14. Verify source integrity / prohibited unsafe patterns
# =====================================================================

print()
print("=" * 78)
print("SAFETY CHECKS")
print("=" * 78)

checks = [
    (
        "create_booking authenticated gate",
        "context?.user?.id" in tools_text
    ),
    (
        "create_booking explicit confirmation",
        "params.confirmed !== true" in tools_text
    ),
    (
        "server allowBooking gate",
        "allowBooking:" in app_text
    ),
    (
        "date/time format validation",
        "BOOKING_DATE_TIME_INVALID" in tools_text
        or "validDate" in read(db)
    ),
]

failed = False

for name, ok in checks:
    print("[OK]" if ok else "[FAIL]", name)
    if not ok:
        failed = True

if failed:
    raise SystemExit(
        "\nSAFETY CHECK FAILED. Backup موجود، ولم يتم push/deploy."
    )

# =====================================================================
# 15. Git diff check
# =====================================================================

print()
print("Running git diff --check...")

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
        "\nSTOP: git diff --check failed.\n"
        f"Backup: {BACKUP}"
    )

print("[OK] git diff --check")

# =====================================================================
# 16. Build
# =====================================================================

print()
print("Running npm run build...")
print()

r = subprocess.run(
    ["npm", "run", "build"],
    cwd=ROOT
)

if r.returncode != 0:
    print()
    print("=" * 78)
    print("BUILD FAILED")
    print("=" * 78)
    print("Backup:", BACKUP)
    print("لم يتم push أو deploy.")
    raise SystemExit(1)

# =====================================================================
# 17. Final status
# =====================================================================

print()
print("=" * 78)
print("BOOKING FIX COMPLETED")
print("=" * 78)
print()
print("Backup:")
print(BACKUP)
print()
print("Changed files:")
subprocess.run(["git", "status", "--short"], cwd=ROOT)

print()
print("Diff summary:")
subprocess.run(["git", "diff", "--stat"], cwd=ROOT)

print()
print("=" * 78)
print("IMPORTANT")
print("=" * 78)
print("1) لم يتم git push.")
print("2) لم يتم deploy.")
print("3) لم يتم اختراع working-hours schema.")
print("4) لم يتم اختراع DB columns غير موجودة.")
print("5) إذا فشل أي structural check فالسكربت يتوقف بدل التخمين.")
print()
