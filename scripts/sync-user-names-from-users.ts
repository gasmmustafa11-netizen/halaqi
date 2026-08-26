import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error('❌ DATABASE_URL غير موجود.');
}

const sql = neon(process.env.DATABASE_URL);
const apply = process.argv.includes('--apply');

console.log('');
console.log('==============================================');
console.log(' HALAQI USER NAME SYNC');
console.log('==============================================');
console.log(`MODE: ${apply ? 'APPLY' : 'PREVIEW'}`);
console.log('');
console.log('المصدر الأساسي للاسم: users.name');
console.log('لن يتم تغيير أي user_id / customer_id / barber_id.');
console.log('');

type Check = {
  label: string;
  query: any;
};

const checks: Check[] = [
  {
    label: 'bookings.customer_name ← users.name بواسطة customer_id',
    query: sql`
      SELECT COUNT(*)::int AS count
      FROM bookings b
      JOIN users u ON u.id = b.customer_id
      WHERE b.customer_name IS DISTINCT FROM u.name
    `,
  },
  {
    label: 'bookings.barber_name ← users.name بواسطة barber_id',
    query: sql`
      SELECT COUNT(*)::int AS count
      FROM bookings b
      JOIN users u ON u.id = b.barber_id
      WHERE b.barber_name IS DISTINCT FROM u.name
    `,
  },
  {
    label: 'post_comments.user_name ← users.name بواسطة user_id',
    query: sql`
      SELECT COUNT(*)::int AS count
      FROM post_comments pc
      JOIN users u ON u.id = pc.user_id
      WHERE pc.user_name IS DISTINCT FROM u.name
    `,
  },
  {
    label: 'reviews.customer_name ← users.name بواسطة customer_id',
    query: sql`
      SELECT COUNT(*)::int AS count
      FROM reviews r
      JOIN users u ON u.id = r.customer_id
      WHERE r.customer_name IS DISTINCT FROM u.name
    `,
  },
];

console.log('🔎 فحص الاختلافات الحالية:');
console.log('');

let total = 0;

for (const check of checks) {
  const rows = await check.query;
  const count = Number(rows[0]?.count || 0);

  total += count;

  console.log(`- ${check.label}`);
  console.log(`  اختلافات تحتاج تحديث: ${count}`);
  console.log('');
}

console.log('----------------------------------------------');
console.log(`📊 إجمالي السجلات التي تحتاج مزامنة: ${total}`);
console.log('----------------------------------------------');
console.log('');

if (!apply) {
  console.log('🔎 PREVIEW فقط.');
  console.log('❌ لم يتم تعديل أي بيانات.');
  console.log('');
  console.log('إذا كانت الأرقام صحيحة، شغّل:');
  console.log('');
  console.log(
    'npx tsx scripts/sync-user-names-from-users.ts --apply'
  );
  console.log('');
  process.exit(0);
}

if (total === 0) {
  console.log('✅ كل الأسماء متزامنة أصلًا مع users.name.');
  process.exit(0);
}

console.log('⚠️ بدء المزامنة...');
console.log('');

try {
  await sql`BEGIN`;

  const bookingCustomer = await sql`
    UPDATE bookings b
    SET customer_name = u.name
    FROM users u
    WHERE u.id = b.customer_id
      AND b.customer_name IS DISTINCT FROM u.name
  `;

  console.log(
    `✅ bookings.customer_name تم تحديثها: ${bookingCustomer.length} نتيجة`
  );

  const bookingBarber = await sql`
    UPDATE bookings b
    SET barber_name = u.name
    FROM users u
    WHERE u.id = b.barber_id
      AND b.barber_name IS DISTINCT FROM u.name
  `;

  console.log(
    `✅ bookings.barber_name تم تحديثها: ${bookingBarber.length} نتيجة`
  );

  const comments = await sql`
    UPDATE post_comments pc
    SET user_name = u.name
    FROM users u
    WHERE u.id = pc.user_id
      AND pc.user_name IS DISTINCT FROM u.name
  `;

  console.log(
    `✅ post_comments.user_name تم تحديثها: ${comments.length} نتيجة`
  );

  const reviews = await sql`
    UPDATE reviews r
    SET customer_name = u.name
    FROM users u
    WHERE u.id = r.customer_id
      AND r.customer_name IS DISTINCT FROM u.name
  `;

  console.log(
    `✅ reviews.customer_name تم تحديثها: ${reviews.length} نتيجة`
  );

  await sql`COMMIT`;

  console.log('');
  console.log('==============================================');
  console.log('✅ تمت المزامنة بنجاح');
  console.log('==============================================');
  console.log('');
  console.log('الآن هذه البيانات تعتمد على users.name كمصدر للاسم.');
  console.log('الـIDs لم يتم تغييرها.');
  console.log('');

} catch (error) {
  try {
    await sql`ROLLBACK`;
  } catch {}

  console.error('');
  console.error('❌ حدث خطأ.');
  console.error('↩️ تم تنفيذ ROLLBACK ولم تُحفظ التغييرات.');
  console.error('');
  console.error(error);
  process.exit(1);
}
