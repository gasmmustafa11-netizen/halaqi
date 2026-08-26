import { config } from 'dotenv';
config({ path: '.env' });
import { neon } from '@neondatabase/serverless';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('❌ DATABASE_URL غير موجود في البيئة.');
  }

  const sql = neon(databaseUrl);

  console.log('');
  console.log('==============================================');
  console.log('HALAQI NOTIFICATION ACTOR MIGRATION');
  console.log('==============================================');
  console.log('');

  console.log('🔎 فحص جدول notifications...');

  const tableCheck = await sql`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'notifications'
    ) AS exists;
  `;

  if (!tableCheck[0]?.exists) {
    throw new Error('❌ جدول notifications غير موجود.');
  }

  console.log('✅ جدول notifications موجود.');
  console.log('');

  console.log('🔎 فحص actor_user_id...');

  const columnCheck = await sql`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'notifications'
        AND column_name = 'actor_user_id'
    ) AS exists;
  `;

  if (columnCheck[0]?.exists) {
    console.log('ℹ️ actor_user_id موجود مسبقًا.');
  } else {
    console.log('➕ إضافة actor_user_id...');

    await sql`
      ALTER TABLE notifications
      ADD COLUMN actor_user_id TEXT;
    `;

    console.log('✅ تم إضافة actor_user_id بنجاح.');
  }

  console.log('');
  console.log('🔎 التحقق النهائي...');

  const verify = await sql`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'notifications'
      AND column_name = 'actor_user_id';
  `;

  if (!verify.length) {
    throw new Error('❌ فشل التحقق من إضافة العمود.');
  }

  console.log(`✅ العمود موجود: ${verify[0].column_name} (${verify[0].data_type})`);

  console.log('');
  console.log('==============================================');
  console.log('✅ MIGRATION COMPLETED');
  console.log('==============================================');
  console.log('');
  console.log('📌 notifications.actor_user_id تم تجهيزه.');
  console.log('📌 لم يتم تعديل user_id.');
  console.log('📌 لم يتم حذف أي إشعار.');
  console.log('📌 لم يتم تعديل أي إشعار قديم.');
  console.log('📌 الخطوة التالية ستكون تعديل db.ts.');
  console.log('');
}

main().catch((error) => {
  console.error('');
  console.error('❌ فشل تنفيذ migration.');
  console.error('');
  console.error(error?.message || error);
  process.exit(1);
});
