#!/bin/bash
set -e

echo "=============================================="
echo "Halaqi - Fix Remaining 2 TypeScript Errors"
echo "=============================================="

STAMP=$(date +%Y%m%d_%H%M%S)
cp src/server/db.ts "src/server/db.ts.backup_remaining_$STAMP"

python3 - <<'PY'
from pathlib import Path

p = Path("src/server/db.ts")
s = p.read_text()

# deleteSalonPost:
# Replace the invalid reference to undefined `salon`
# with the actual authorization check for the post owner.
s = s.replace(
"""      (requestingUser.role === 'salon_owner' && salon.status !== 'approved' || requestingUser.role === 'salon_owner' &&
                                 post.ownerId === requestingUser.id);""",
"""      (
        requestingUser.role === 'salon_owner' &&
        this.isApprovedSalonOwner(requestingUser.id, post.ownerId)
      );"""
)

# Same operation, allowing for the exact formatting currently in the file.
s = s.replace(
"""      (requestingUser.role === 'salon_owner' && salon.status !== 'approved' || requestingUser.role === 'salon_owner' &&
      post.ownerId === requestingUser.id);""",
"""      (
        requestingUser.role === 'salon_owner' &&
        this.isApprovedSalonOwner(requestingUser.id, post.ownerId)
      );"""
)

# deletePostComment:
# Replace invalid `salon` reference with the salon owner of the post.
s = s.replace(
"""      (requestingUser.role === 'salon_owner' && salon.status !== 'approved' ||
      requestingUser.role === 'salon_owner' &&
      post?.ownerId === requestingUser.id);""",
"""      (
        requestingUser.role === 'salon_owner' &&
        !!post?.ownerId &&
        this.isApprovedSalonOwner(requestingUser.id, post.ownerId)
      );"""
)

# More permissive direct replacement of the exact logical fragment.
s = s.replace(
"""(requestingUser.role === 'salon_owner' && salon.status !== 'approved' || requestingUser.role === 'salon_owner' &&
      post?.ownerId === requestingUser.id)""",
"""(
        requestingUser.role === 'salon_owner' &&
        !!post?.ownerId &&
        this.isApprovedSalonOwner(requestingUser.id, post.ownerId)
      )"""
)

p.write_text(s)
PY

echo "Checking remaining undefined salon references..."
grep -n "salon.status !== 'approved'" src/server/db.ts || true

echo ""
echo "Running TypeScript..."
npx tsc --noEmit

echo ""
echo "=============================================="
echo "SUCCESS"
echo "=============================================="
echo "All TypeScript errors are fixed."
