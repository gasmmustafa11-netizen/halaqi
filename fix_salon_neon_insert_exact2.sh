#!/bin/bash
set -e

echo "=============================================="
echo "Halaqi - Fix Salon Neon INSERT"
echo "=============================================="

cp src/server/app.ts "src/server/app.ts.backup_neon_insert2_$(date +%Y%m%d_%H%M%S)"

python3 - <<'PY'
from pathlib import Path

p = Path("src/server/app.ts")
s = p.read_text()

old = "    db.getState().salons.push(newSalon);\n"

new = """    // Persist salon in Neon before continuing.
    // Memory-only salons disappear after server restart.
    db.getState().salons.push(newSalon);

    try {
      const savedSalon = await db.createSalonInNeon(newSalon);

      if (!savedSalon) {
        const memoryIndex = db.getState().salons.findIndex(
          (s) => s.id === newSalon.id
        );

        if (memoryIndex !== -1) {
          db.getState().salons.splice(memoryIndex, 1);
        }

        console.error(
          `[SALON CREATE] Neon INSERT returned no salon: ${newSalon.id}`
        );

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
    }
"""

if old not in s:
    print("ERROR: target line not found")
    raise SystemExit(1)

s = s.replace(old, new, 1)
p.write_text(s)

print("Salon Neon persistence inserted successfully.")
PY

echo "===== VERIFY METHOD ====="
grep -n "createSalonInNeon" src/server/db.ts src/server/app.ts

echo "===== VERIFY POST ====="
sed -n '375,455p' src/server/app.ts

echo "===== TYPESCRIPT ====="
npx tsc --noEmit

echo "=============================================="
echo "SUCCESS"
echo "=============================================="
