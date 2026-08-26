#!/bin/bash
set -e

echo "=============================================="
echo "Halaqi - Fix 2 remaining errors"
echo "=============================================="

STAMP=$(date +%Y%m%d_%H%M%S)
cp src/server/db.ts "src/server/db.ts.backup_2errors_$STAMP"

python3 - <<'PY'
from pathlib import Path

p = Path("src/server/db.ts")
s = p.read_text()

old1 = """const allowed =
      requestingUser.role === 'admin' ||
      (requestingUser.role === 'salon_owner' && salon.status !== 'approved' || requestingUser.role === 'salon_owner' &&
                                 post.ownerId === requestingUser.id);"""

new1 = """const allowed =
      requestingUser.role === 'admin' ||
      (
        requestingUser.role === 'salon_owner' &&
        this.isApprovedSalonOwner(requestingUser.id, post.salonId)
      );"""

old2 = """const allowed =
      requestingUser.role === 'admin' ||
      comment.userId === requestingUser.id ||
      (requestingUser.role === 'salon_owner' && salon.status !== 'approved' || requestingUser.role === 'salon_owner' &&
                                 post?.ownerId === requestingUser.id);"""

new2 = """const allowed =
      requestingUser.role === 'admin' ||
      comment.userId === requestingUser.id ||
      (
        requestingUser.role === 'salon_owner' &&
        !!post?.salonId &&
        this.isApprovedSalonOwner(requestingUser.id, post.salonId)
      );"""

if old1 not in s:
    raise SystemExit("ERROR: deleteSalonPost block not found")

if old2 not in s:
    raise SystemExit("ERROR: deletePostComment block not found")

s = s.replace(old1, new1, 1)
s = s.replace(old2, new2, 1)

p.write_text(s)
PY

echo "Checking..."

npx tsc --noEmit

echo ""
echo "=============================================="
echo "SUCCESS: TypeScript is clean"
echo "=============================================="
