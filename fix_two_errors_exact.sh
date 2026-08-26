#!/bin/bash
set -e

echo "=============================================="
echo "Halaqi - Exact Fix"
echo "=============================================="

STAMP=$(date +%Y%m%d_%H%M%S)
cp src/server/db.ts "src/server/db.ts.backup_exact_$STAMP"

python3 - <<'PY'
from pathlib import Path
import re

p = Path("src/server/db.ts")
s = p.read_text()

# Fix deleteSalonPost authorization condition only.
pattern1 = re.compile(
    r"""const allowed =\s*
\s*requestingUser\.role === 'admin' \|\|\s*
\s*\(requestingUser\.role === 'salon_owner' && salon\.status !== 'approved' \|\| requestingUser\.role === 'salon_owner' &&\s*
\s*post\.ownerId === requestingUser\.id\);""",
    re.MULTILINE
)

replacement1 = """const allowed =
      requestingUser.role === 'admin' ||
      (
        requestingUser.role === 'salon_owner' &&
        this.isApprovedSalonOwner(requestingUser.id, post.salonId)
      );"""

s, n1 = pattern1.subn(replacement1, s, count=1)

# Fix deletePostComment authorization condition only.
pattern2 = re.compile(
    r"""const allowed =\s*
\s*requestingUser\.role === 'admin' \|\|\s*
\s*comment\.userId === requestingUser\.id \|\|\s*
\s*\(requestingUser\.role === 'salon_owner' && salon\.status !== 'approved' \|\| requestingUser\.role === 'salon_owner' &&\s*
\s*post\?\.ownerId === requestingUser\.id\);""",
    re.MULTILINE
)

replacement2 = """const allowed =
      requestingUser.role === 'admin' ||
      comment.userId === requestingUser.id ||
      (
        requestingUser.role === 'salon_owner' &&
        !!post?.salonId &&
        this.isApprovedSalonOwner(requestingUser.id, post.salonId)
      );"""

s, n2 = pattern2.subn(replacement2, s, count=1)

print(f"deleteSalonPost fixed: {n1}")
print(f"deletePostComment fixed: {n2}")

if n1 != 1 or n2 != 1:
    raise SystemExit("ERROR: لم يتم العثور على أحد الشرطين. لم يتم حفظ التعديل.")

p.write_text(s)
PY

echo ""
echo "===== Remaining problematic references ====="
grep -n "salon.status !== 'approved'" src/server/db.ts || true

echo ""
echo "===== TypeScript check ====="
npx tsc --noEmit

echo ""
echo "=============================================="
echo "SUCCESS"
echo "=============================================="
