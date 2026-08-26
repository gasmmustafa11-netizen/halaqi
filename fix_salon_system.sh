#!/usr/bin/env bash
set -euo pipefail

cd ~/downloads/halaqi

STAMP="$(date +%Y%m%d_%H%M%S)"

echo "=============================================="
echo " Halaqi - Salon System Fix"
echo "=============================================="

echo "[1/7] Creating backups..."

cp src/server/app.ts "src/server/app.ts.backup_salon_${STAMP}"
cp src/server/db.ts "src/server/db.ts.backup_salon_${STAMP}"

echo "Backups created:"
echo "  app.ts -> src/server/app.ts.backup_salon_${STAMP}"
echo "  db.ts  -> src/server/db.ts.backup_salon_${STAMP}"

echo "[2/7] Adding Neon owner lookup..."

python3 <<'PY'
from pathlib import Path

p = Path("src/server/db.ts")
text = p.read_text()

marker = """  // Neon salon operations
"""

if "async getSalonByOwnerFromNeon" not in text:
    if marker not in text:
        raise SystemExit("ERROR: Neon salon operations marker not found")

    addition = """  // Find an existing pending/approved salon directly in Neon.
  // This prevents duplicate requests even after refresh/restart.
  async getSalonByOwnerFromNeon(userId: string): Promise<Salon | undefined> {
    const rows = await sql`
      SELECT *
      FROM salons
      WHERE owner_id = ${userId}
        AND status IN ('pending', 'approved')
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (!rows.length) return undefined;

    const s: any = rows[0];

    return {
      id: s.id,
      name: s.name,
      nameEn: s.name_en,
      slug: s.slug,
      type: s.type,
      city: s.city,
      area: s.area,
      address: s.address,
      lat: Number(s.lat || 0),
      lng: Number(s.lng || 0),
      phone: s.phone,
      whatsapp: s.whatsapp,
      description: s.description,
      descriptionEn: s.description_en,
      rating: Number(s.rating || 0),
      reviewCount: Number(s.review_count || 0),
      startingPrice: Number(s.starting_price || 0),
      coverImage: s.cover_image,
      gallery: s.gallery || [],
      isVerified: s.is_verified ?? false,
      isFeatured: s.is_featured ?? false,
      status: s.status,
      ownerId: s.owner_id,
      workingHours: s.working_hours || defaultWorkingHours,
      features: s.features || [],
      createdAt: new Date(s.created_at).toISOString(),
    };
  }

"""

    text = text.replace(marker, marker + addition, 1)
    p.write_text(text)

    print("Added getSalonByOwnerFromNeon().")
else:
    print("getSalonByOwnerFromNeon() already exists - skipped.")

PY

echo "[3/7] Protecting POST /api/salons against duplicate requests..."

python3 <<'PY'
from pathlib import Path

p = Path("src/server/app.ts")
text = p.read_text()

start = text.find("app.post('/api/salons', requireAuth")
if start == -1:
    raise SystemExit("ERROR: POST /api/salons not found")

check_marker = """  const data = req.body;
  const ip = req.ip || '127.0.0.1';
"""

if check_marker not in text[start:start+1000]:
    raise SystemExit("ERROR: Could not locate /api/salons request body")

duplicate_block = """  const data = req.body;
  const ip = req.ip || '127.0.0.1';

  // ============================================================
  // DUPLICATE SALON REQUEST PROTECTION
  // ============================================================
  // Check memory first.
  const existingSalonMemory = db.getState().salons.find(
    (s) =>
      s.ownerId === req.user!.id &&
      (s.status === 'pending' || s.status === 'approved')
  );

  if (existingSalonMemory) {
    return res.status(409).json({
      success: false,
      duplicate: true,
      salon: existingSalonMemory,
      error:
        existingSalonMemory.status === 'approved'
          ? 'لديك صالون معتمد بالفعل ولا يمكنك تقديم طلب صالون جديد.'
          : 'لديك طلب صالون قيد المراجعة بالفعل. لا يمكنك إرسال طلب آخر.',
    });
  }

  // Check Neon too, so refresh/restart cannot bypass the protection.
  try {
    const existingSalonNeon =
      await db.getSalonByOwnerFromNeon(req.user!.id);

    if (existingSalonNeon) {
      // Keep memory synchronized if the salon exists in Neon.
      const existsInMemory = db
        .getState()
        .salons.some((s) => s.id === existingSalonNeon.id);

      if (!existsInMemory) {
        db.getState().salons.push(existingSalonNeon);
      }

      return res.status(409).json({
        success: false,
        duplicate: true,
        salon: existingSalonNeon,
        error:
          existingSalonNeon.status === 'approved'
            ? 'لديك صالون معتمد بالفعل ولا يمكنك تقديم طلب صالون جديد.'
            : 'لديك طلب صالون قيد المراجعة بالفعل. لا يمكنك إرسال طلب آخر.',
      });
    }
  } catch (error: any) {
    console.error(
      '[SALON DUPLICATE CHECK] Neon check failed:',
      error?.message || error
    );
  }
"""

old = """  const data = req.body;
  const ip = req.ip || '127.0.0.1';
"""

pos = text.find(old, start)

if pos == -1:
    raise SystemExit("ERROR: POST /api/salons body marker not found")

text = text[:pos] + duplicate_block + text[pos+len(old):]

p.write_text(text)

print("Duplicate protection added.")
PY

echo "[4/7] Making admin approval persistent in Neon..."

python3 <<'PY'
from pathlib import Path

p = Path("src/server/app.ts")
text = p.read_text()

# Locate admin status endpoint.
endpoint = text.find(
    "app.put('/api/admin/salons/:id/status'"
)

if endpoint == -1:
    raise SystemExit("ERROR: Admin salon status endpoint not found")

# Locate the existing isVerified line after the endpoint.
needle = """  if (typeof isVerified === 'boolean') salon.isVerified = isVerified;
"""

pos = text.find(needle, endpoint)

if pos == -1:
    raise SystemExit(
        "ERROR: Could not find isVerified line in admin status endpoint"
    )

sync_block = """  // ============================================================
  // PERSIST SALON STATUS IN NEON
  // ============================================================
  // The old code changed only the in-memory object.
  // That caused approval to disappear after refresh/restart.
  if (status) {
    try {
      const savedSalon =
        await db.updateSalonStatusInNeon(
          salon.id,
          status,
          typeof isVerified === 'boolean'
            ? isVerified
            : undefined
        );

      if (!savedSalon) {
        console.error(
          `[SALON APPROVAL] Salon ${salon.id} was not found in Neon`
        );

        return res.status(500).json({
          success: false,
          error: 'تعذر حفظ حالة الصالون في قاعدة البيانات.',
        });
      }

      // Keep memory synchronized with the Neon result.
      salon.status = savedSalon.status;
      salon.isVerified = savedSalon.isVerified;

      console.log(
        `[SALON APPROVAL] Neon synchronized: ${salon.id} -> ${salon.status}`
      );
    } catch (error: any) {
      console.error(
        '[SALON APPROVAL] Neon synchronization failed:',
        error?.message || error
      );

      return res.status(500).json({
        success: false,
        error: 'تعذر حفظ حالة الصالون في قاعدة البيانات.',
      });
    }
  }

"""

# Avoid duplicate insertion if script is run twice.
if "PERSIST SALON STATUS IN NEON" not in text:
    text = text[:pos] + sync_block + text[pos:]
    p.write_text(text)
    print("Neon status synchronization added.")
else:
    print("Neon status synchronization already exists - skipped.")

PY

echo "[5/7] Fixing owner approval notification..."

python3 <<'PY'
from pathlib import Path

p = Path("src/server/app.ts")
text = p.read_text()

old = """      db.createNotification({
        userId: owner.id,
        title,
        titleEn,
        message,
        messageEn,
        type: notificationType,
        link: '/profile',
      });
"""

new = """      try {
        await db.createNotification({
          userId: owner.id,
          title,
          titleEn,
          message,
          messageEn,
          type: notificationType,
          link: '/profile',
          salonId: salon.id,
        });

        console.log(
          `[SALON NOTIFICATION] ${notificationType} sent to owner ${owner.id} for salon ${salon.id}`
        );
      } catch (error: any) {
        console.error(
          `[SALON NOTIFICATION] Failed for owner ${owner.id}:`,
          error?.message || error
        );
      }
"""

if old in text:
    text = text.replace(old, new, 1)
    p.write_text(text)
    print("Owner notification fixed.")
elif "[SALON NOTIFICATION] Failed for owner" in text:
    print("Owner notification already fixed - skipped.")
else:
    raise SystemExit(
        "ERROR: Could not find salon owner notification block"
    )

PY

echo "[6/7] Adding a database-level duplicate protection comment/check helper..."

python3 <<'PY'
from pathlib import Path

p = Path("src/server/db.ts")
text = p.read_text()

marker = """  // Getters
"""

addition = """  // Returns true when the owner already has a pending/approved salon.
  hasActiveSalonForOwner(userId: string): boolean {
    return this.state.salons.some(
      (salon) =>
        salon.ownerId === userId &&
        (salon.status === 'pending' || salon.status === 'approved')
    );
  }

"""

if "hasActiveSalonForOwner(userId: string)" not in text:
    if marker not in text:
        raise SystemExit("ERROR: DB getters marker not found")

    text = text.replace(marker, addition + marker, 1)
    p.write_text(text)
    print("DB helper added.")
else:
    print("DB helper already exists - skipped.")

PY

echo "[7/7] Checking source..."

echo
echo "---- app.ts checks ----"
grep -n "getSalonByOwnerFromNeon" src/server/app.ts || true
grep -n "PERSIST SALON STATUS IN NEON" src/server/app.ts || true
grep -n "SALON NOTIFICATION" src/server/app.ts || true

echo
echo "---- db.ts checks ----"
grep -n "getSalonByOwnerFromNeon" src/server/db.ts || true
grep -n "hasActiveSalonForOwner" src/server/db.ts || true
grep -n "updateSalonStatusInNeon" src/server/db.ts || true

echo
echo "---- TypeScript check ----"

if [ -f tsconfig.json ]; then
  if command -v npx >/dev/null 2>&1; then
    npx tsc --noEmit
  else
    echo "WARNING: npx is not available."
  fi
else
  echo "WARNING: tsconfig.json not found."
fi

echo
echo "=============================================="
echo " FIX FINISHED"
echo "=============================================="
echo
echo "Backups:"
echo "src/server/app.ts.backup_salon_${STAMP}"
echo "src/server/db.ts.backup_salon_${STAMP}"
echo
echo "اختبر الآن:"
echo "1) صاحب الصالون يقدم طلب واحد."
echo "2) يعمل Refresh ويحاول التقديم مرة ثانية."
echo "3) يجب أن يرفض السيرفر الطلب الثاني."
echo "4) الأدمن يوافق على الصالون."
echo "5) اعمل Refresh للرئيسية."
echo "6) يجب أن يبقى الصالون منشورًا."
echo "7) افتح إشعارات صاحب الصالون."
echo "8) يجب أن يظهر إشعار الموافقة."
echo
