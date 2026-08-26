#!/usr/bin/env bash
set -e

echo "=============================================="
echo " Halaqi - Fix Salon Neon INSERT"
echo "=============================================="

APP="src/server/app.ts"
DB="src/server/db.ts"
TS="$(date +%Y%m%d_%H%M%S)"

echo "[1/5] Creating backups..."
cp "$APP" "$APP.backup_neon_insert_$TS"
cp "$DB" "$DB.backup_neon_insert_$TS"

echo "[2/5] Adding createSalonInNeon()..."

python3 - <<'PY'
from pathlib import Path

p = Path("src/server/db.ts")
s = p.read_text()

marker = "  async updateSalonStatusInNeon("

if "async createSalonInNeon(" in s:
    print("createSalonInNeon already exists - skipping.")
else:
    method = r'''  async createSalonInNeon(salon: Salon): Promise<Salon | undefined> {
    const rows = await sql`
      INSERT INTO salons (
        id,
        name,
        name_en,
        slug,
        type,
        city,
        area,
        address,
        lat,
        lng,
        phone,
        whatsapp,
        description,
        description_en,
        rating,
        review_count,
        starting_price,
        cover_image,
        gallery,
        is_verified,
        is_featured,
        status,
        owner_id,
        working_hours,
        features,
        created_at
      )
      VALUES (
        ${salon.id},
        ${salon.name},
        ${salon.nameEn},
        ${salon.slug},
        ${salon.type},
        ${salon.city},
        ${salon.area},
        ${salon.address},
        ${salon.lat},
        ${salon.lng},
        ${salon.phone},
        ${salon.whatsapp},
        ${salon.description},
        ${salon.descriptionEn},
        ${salon.rating},
        ${salon.reviewCount},
        ${salon.startingPrice},
        ${salon.coverImage},
        ${JSON.stringify(salon.gallery || [])}::jsonb,
        ${salon.isVerified},
        ${salon.isFeatured ?? false},
        ${salon.status},
        ${salon.ownerId},
        ${JSON.stringify(salon.workingHours || defaultWorkingHours)}::jsonb,
        ${JSON.stringify(salon.features || [])}::jsonb,
        ${salon.createdAt}
      )
      RETURNING *
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

'''

    if marker not in s:
        raise SystemExit("ERROR: updateSalonStatusInNeon marker not found")

    s = s.replace(marker, method + marker, 1)
    p.write_text(s)
    print("createSalonInNeon added.")

PY

echo "[3/5] Updating POST /api/salons..."

python3 - <<'PY'
from pathlib import Path

p = Path("src/server/app.ts")
s = p.read_text()

needle = "    db.getState().salons.push(newSalon);"

if needle not in s:
    raise SystemExit("ERROR: salon memory insertion line not found")

replacement = r'''    // Persist the new salon in Neon before returning success.
    // Memory is updated only after Neon confirms the INSERT.
    let persistedSalon;

    try {
      persistedSalon = await db.createSalonInNeon(newSalon as any);

      if (!persistedSalon) {
        console.error('[SALON CREATE] Neon INSERT returned no salon');
        return res.status(500).json({
          success: false,
          error: 'تعذر حفظ الصالون في قاعدة البيانات.',
        });
      }

      // Keep the in-memory state synchronized with Neon.
      const memoryIndex = db.getState().salons.findIndex(
        (s) => s.id === persistedSalon!.id
      );

      if (memoryIndex === -1) {
        db.getState().salons.push(persistedSalon);
      } else {
        db.getState().salons[memoryIndex] = persistedSalon;
      }

      console.log(
        `[SALON CREATE] Neon INSERT successful: ${persistedSalon.id}`
      );
    } catch (error: any) {
      console.error(
        '[SALON CREATE] Neon INSERT failed:',
        error?.message || error
      );

      return res.status(500).json({
        success: false,
        error: 'تعذر حفظ الصالون في قاعدة البيانات.',
      });
    }

    const savedSalon = persistedSalon;'''

s = s.replace(needle, replacement, 1)

# Change subsequent notification/audit/response references only inside the
# registration section by replacing the exact response at the end.
old_response = "    res.status(201).json({ success: true, salon: newSalon });"

if old_response in s:
    s = s.replace(
        old_response,
        "    res.status(201).json({ success: true, salon: savedSalon });",
        1
    )

p.write_text(s)
print("POST /api/salons updated.")

PY

echo "[4/5] TypeScript check..."
npx tsc --noEmit

echo "[5/5] Final verification..."

echo
echo "===== CREATE SALON NEON ====="
grep -n "createSalonInNeon" src/server/db.ts src/server/app.ts

echo
echo "===== SALON INSERT ====="
grep -n "INSERT INTO salons" src/server/db.ts

echo
echo "===== TYPESCRIPT ====="
echo "SUCCESS"

echo
echo "=============================================="
echo " FIX COMPLETED"
echo "=============================================="
echo "Backups:"
echo "$APP.backup_neon_insert_$TS"
echo "$DB.backup_neon_insert_$TS"
