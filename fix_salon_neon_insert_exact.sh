#!/bin/bash
set -e

echo "=============================================="
echo "Halaqi - Exact Neon Salon INSERT Fix"
echo "=============================================="

cp src/server/app.ts "src/server/app.ts.backup_neon_insert_$(date +%Y%m%d_%H%M%S)"

python3 - <<'PY'
from pathlib import Path

p = Path("src/server/app.ts")
s = p.read_text()

old = """    db.getState().salons.push(newSalon);

    // Notify all active admins about the new salon"""

new = """    // Persist the newly registered salon in Neon immediately.
    // This is required because the memory store is reloaded from Neon
    // after server restart, so memory-only salons would disappear.
    try {
      const savedSalon = await db.createSalonInNeon(newSalon);

      if (!savedSalon) {
        // Roll back the in-memory insertion if Neon persistence failed.
        const memoryIndex = db.getState().salons.findIndex(
          (s) => s.id === newSalon.id
        );
        if (memoryIndex !== -1) {
          db.getState().salons.splice(memoryIndex, 1);
        }

        console.error(
          `[SALON CREATE] Neon INSERT returned no salon for ${newSalon.id}`
        );

        return res.status(500).json({
          success: false,
          error: 'تعذر حفظ طلب الصالون في قاعدة البيانات.',
        });
      }

      // Keep the in-memory object synchronized with the persisted record.
      const memoryIndex = db.getState().salons.findIndex(
        (s) => s.id === newSalon.id
      );

      if (memoryIndex !== -1) {
        db.getState().salons[memoryIndex] = savedSalon;
      }

      console.log(
        `[SALON CREATE] Neon synchronized: ${savedSalon.id} -> ${savedSalon.status}`
      );
    } catch (error: any) {
      // Roll back memory if Neon INSERT fails.
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

    // Notify all active admins about the new salon"""

if old not in s:
    print("ERROR: exact POST insertion block not found")
    raise SystemExit(1)

s = s.replace(old, new, 1)
p.write_text(s)
print("POST /api/salons -> Neon persistence added.")
PY

echo "===== CHECK CREATE METHOD ====="
grep -n "createSalonInNeon" src/server/db.ts src/server/app.ts

echo "===== CHECK POST FLOW ====="
sed -n '390,465p' src/server/app.ts

echo "===== TYPESCRIPT ====="
npx tsc --noEmit

echo "=============================================="
echo "SUCCESS"
echo "=============================================="
