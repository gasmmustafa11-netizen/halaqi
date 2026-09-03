from pathlib import Path
from datetime import datetime
import shutil
import sys

print("=" * 70)
print("HALAQI — BOOKING STATE SERVER PATCH")
print("=" * 70)

ROOT = Path.cwd()
APP = ROOT / "src/server/app.ts"

if not APP.exists():
    print("[STOP] src/server/app.ts not found")
    sys.exit(1)

text = APP.read_text(encoding="utf-8")

timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
backup = APP.with_name(f"app.ts.booking-server-backup-{timestamp}")
shutil.copy2(APP, backup)

print(f"[BACKUP] {backup}")

# ------------------------------------------------------------
# PATCH 1:
# Booking authorization must compare against the authoritative
# resolved conversation state, not the raw request state.
# ------------------------------------------------------------

old1 = """              const previousState = conversationState || {};
"""

new1 = """              const previousState = resolvedState || {};
"""

count1 = text.count(old1)

if count1 != 1:
    print(
        f"[STOP] previousState pattern expected exactly 1 match, found {count1}"
    )
    print("[RESTORE] No changes written.")
    sys.exit(1)

text = text.replace(old1, new1, 1)
print("[OK] Booking guard now uses resolvedState")


# ------------------------------------------------------------
# PATCH 2:
# Explicitly return null when there is no pending question.
# This allows the UI to remove stale pendingQuestion state.
# ------------------------------------------------------------

old2 = """        pendingQuestion:
          needsClarification
            ? reply
            : undefined,
"""

new2 = """        pendingQuestion:
          needsClarification
            ? reply
            : null,
"""

count2 = text.count(old2)

if count2 != 1:
    print(
        f"[STOP] pendingQuestion pattern expected exactly 1 match, found {count2}"
    )
    print("[RESTORE] Restoring original app.ts from backup.")
    shutil.copy2(backup, APP)
    sys.exit(1)

text = text.replace(old2, new2, 1)
print("[OK] pendingQuestion cleanup now returns null")


# ------------------------------------------------------------
# WRITE
# ------------------------------------------------------------

APP.write_text(text, encoding="utf-8")

print()
print("=" * 70)
print("[SUCCESS] Server booking state patch completed")
print("=" * 70)
print()
print("Changed:")
print("  1. previousState -> resolvedState")
print("  2. pendingQuestion undefined -> null")
print()
print(f"Backup: {backup}")
print()
print("DO NOT DEPLOY YET.")
print("Next step:")
print("  git diff -- src/server/app.ts")
