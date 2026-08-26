#!/bin/bash
set -e

echo "=============================================="
echo "Halaqi - Neon Salon INSERT - Regex Fix"
echo "=============================================="

cp src/server/app.ts "src/server/app.ts.backup_neon_insert3_$(date +%Y%m%d_%H%M%S)"

python3 - <<'PY'
from pathlib import Path
import re

p = Path("src/server/app.ts")
s = p.read_text()

pattern = r"(\n\s*)db\.getState\(\)\.salons\.push\(newSalon\);"

replacement = r"""\1db.getState().salons.push(newSalon);

    // Persist the new salon in Neon.
    try {
      const savedSalon = await db.createSalonInNeon(newSalon);

      if (!savedSalon) {
        const memoryIndex = db.getState().salons.findIndex(
          (s) => s.id === newSalon.id
        );

        if (memoryIndex !== -1) {
          db.getState().salons.splice(memoryIndex, 1);
        }

        return res.status(500).json({
          success: false,
          error: 'تعذر حفظ طلب الصالون في قاعدة البيانات.',
        });
      }

      const memoryIndex = db.getState().salons.findIndex(
        (s) => s.id === newSalon.id
      );

      if (memoryIndex !== -1) {
        db.getState().salons[memoryIndex] = savedSalon;
      }

      console.log(
        `[SALON CREATE] Neon synchronized: ${savedSalon.id}`
      );
    } catch (error: any) {
      const memoryIndex = db.getState().salons.findIndex(
        (s) => s.id === newSalon.id
      );

      if (memoryIndex !== -1) {
        db.getState().salons.splice(memoryIndex, 1);
      }

      console.error(
        '[SALON CREATE] Neon INSERT failed:',
        error?.message || error
      );

      return res.status(500).json({
        success: false,
        error: 'تعذر حفظ طلب الصالون في قاعدة البيانات.',
      });
    }"""

matches = list(re.finditer(pattern, s))

if not matches:
    print("ERROR: newSalon insertion pattern not found")
    raise SystemExit(1)

if len(matches) > 1:
    print(f"WARNING: found {len(matches)} matches; using the first one")

s = re.sub(pattern, replacement, s, count=1)

p.write_text(s)
print("Neon persistence inserted successfully.")
PY

echo "===== VERIFY ====="
grep -n "createSalonInNeon" src/server/app.ts src/server/db.ts

echo "===== TYPESCRIPT ====="
npx tsc --noEmit

echo "=============================================="
echo "SUCCESS"
echo "=============================================="
