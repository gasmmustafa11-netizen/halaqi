// Native Function Calling declarations for Gemini AI layer — Read-Only only
export const aiSalonToolDeclarations = [
  {
    name: 'search_salons',
    description: 'Search approved salons by keyword, area, city, or service name. Read-only.',
    parameters: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: 'Search keyword, salon name, or service' },
        location: { type: 'string', description: 'City or area filter' },
      },
    },
  },
  {
    name: 'get_salon',
    description: 'Get a specific salon by name or salonId. Read-only.',
    parameters: {
      type: 'object',
      properties: {
        salonId: { type: 'string', description: 'Exact salon id' },
        salonName: { type: 'string', description: 'Salon name hint' },
      },
    },
  },
  {
    name: 'search_services',
    description: 'Search services for a salon. Read-only.',
    parameters: {
      type: 'object',
      properties: {
        salonId: { type: 'string', description: 'Salon id' },
        keyword: { type: 'string', description: 'Service keyword' },
      },
    },
  },
  {
    name: 'get_salon_services',
    description: 'Get all services for a salon. Read-only.',
    parameters: {
      type: 'object',
      properties: {
        salonId: { type: 'string', description: 'Salon id' },
      },
      required: ['salonId'],
    },
  },
  {
    name: 'get_availability',
    description: 'Retrieve salon working hours and occupied/booked slots for a date. Read-only. Does not invent availability.',
    parameters: {
      type: 'object',
      properties: {
        salonId: { type: 'string', description: 'Salon id' },
        date: { type: 'string', description: 'Date YYYY-MM-DD' },
        barberId: { type: 'string', description: 'Optional barber id' },
      },
      required: ['salonId'],
    },
  },
];

// Executions happen server-side only; Gemini never sees DB code
export async function executeTool(
  name: string,
  params: any,
  dbModule: any,
  sqlImport?: any
): Promise<any> {
  const db = (dbModule as any)?.default || (dbModule as any)?.db;
  try {
    if (name === 'search_salons') {
      const all = (typeof db?.getApprovedSalonsFromNeon === 'function') ? await db.getApprovedSalonsFromNeon() : [];
      const source = (all || []).slice(0, 50);
      const normalizeArabic = (value: unknown) =>
        String(value || '')
          .toLowerCase()
          .normalize('NFKC')
          .replace(/[ًٌٍَُِّْـ]/g, '')
          .replace(/[أإآ]/g, 'ا')
          .replace(/ة/g, 'ه')
          .replace(/ى/g, 'ي')
          .replace(/ؤ/g, 'و')
          .replace(/ئ/g, 'ي')
          .replace(/\s+/g, ' ')
          .trim();

      const rawKeyword = normalizeArabic(params.keyword || params.name || '');
      const loc = normalizeArabic(params.location || '');

      // Remove generic search words so "صالون النجمة" can match DB name "النجمه".
      const kw = rawKeyword
        .replace(/\\bصالون\\b/g, ' ')
        .replace(/\\bصالونات\\b/g, ' ')
        .replace(/\\s+/g, ' ')
        .trim();

      const filtered = source.filter((s: any) => {
        const name = normalizeArabic(s.name || s.nameEn || '');
        const text = normalizeArabic(
          `${s.name || ''} ${s.nameEn || ''} ${s.city || ''} ${s.area || ''} ${s.services || ''}`
        );

        const keywordMatch =
          !kw ||
          name.includes(kw) ||
          kw.includes(name) ||
          text.includes(kw);

        const locationMatch = !loc || text.includes(loc);

        return keywordMatch && locationMatch;
      });
      return { salons: (filtered || []).slice(0, 5).map((s: any) => ({
        id: s.id,
        name: s.name || s.nameEn || '',
        type: s.type || 'صالون',
        city: s.city || '',
        area: s.area || '',
        services: s.services || '',
        startingPrice: s.startingPrice ? String(s.startingPrice) : null,
      })) };
    }
    if (name === 'get_salon') {
      const sid = params.salonId || null;
      let salon = null;
      if (sid && typeof db?.getSalonByIdFromNeon === 'function') salon = await db.getSalonByIdFromNeon(sid);
      if (!salon && params.salonName && typeof db?.getApprovedSalonsFromNeon === 'function') {
        const all = await db.getApprovedSalonsFromNeon();
        salon = (all || []).find((s: any) => (s.name || '').toString().toLowerCase().includes(String(params.salonName).toLowerCase()));
      }
      if (!salon) return { error: 'Salon not found' };
      return { salon: {
        id: salon.id,
        name: salon.name || salon.nameEn || '',
        type: salon.type || 'صالون',
        city: salon.city || '',
        area: salon.area || '',
        services: salon.services || '',
        workingHours: salon.working_hours || null,
        startingPrice: salon.startingPrice ? String(salon.startingPrice) : null,
      }};
    }
    if (name === 'search_services' || name === 'get_salon_services') {
      const sid = params.salonId || null;
      if (!sid) return { error: 'salonId required' };
      const { sql } = sqlImport ? await sqlImport() : await import('./lib/pg-compliant');
      const rows = await sql`SELECT name, price FROM services WHERE salon_id = ${sid} LIMIT 8`;
      return { services: (rows || []).map((r: any) => ({ name: r.name || '', price: r.price ? String(r.price) : null })) };
    }
    if (name === 'get_availability') {
      const sid = params.salonId || null;
      const date = params.date || '';
      if (!sid) return { error: 'salonId required' };
      // Read salon working hours
      let workingHours = null;
      try {
        if (typeof db?.getSalonByIdFromNeon === 'function') {
          const salon = await db.getSalonByIdFromNeon(sid);
          if (salon) workingHours = salon.working_hours || salon.workingHours || null;
        }
      } catch (e) { /* ignore */ }
      // Read occupied slots via existing DB method
      let occupiedSlots: string[] = [];
      try {
        if (typeof db?.getOccupiedSlots === 'function' && params.barberId && date) {
          occupiedSlots = db.getOccupiedSlots(params.barberId, date);
        } else if (sqlImport) {
          const { sql } = await sqlImport();
          const rows = await sql`SELECT timeSlot FROM bookings WHERE salon_id = ${sid} AND date = ${date} AND status = 'confirmed' LIMIT 20`;
          occupiedSlots = (rows || []).map((r: any) => r.timeSlot);
        }
      } catch (e) { /* ignore */ }
      return {
        salonId: sid,
        date,
        workingHours,
        occupiedSlots,
        note: 'Availability is not fully verifiable without checking working hours, barber schedules, and blocked times. No inventing available slots.',
      };
    }
    return { error: 'Unknown tool' };
  } catch (e: any) {
    return { error: 'Retrieval failed', message: e?.message || '' };
  }
}
