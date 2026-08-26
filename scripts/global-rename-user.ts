import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

const args = process.argv.slice(2);

function arg(name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

const userId = arg('--user-id');
const newName = arg('--new-name');
const apply = args.includes('--apply');

if (!process.env.DATABASE_URL) {
  throw new Error('❌ DATABASE_URL غير موجود.');
}

if (!userId || !newName?.trim()) {
  console.log(`
طريقة الاستخدام:

  npx tsx scripts/global-rename-user.ts --user-id USER_ID --new-name "الاسم الجديد"

للتطبيق الفعلي:
  npx tsx scripts/global-rename-user.ts --user-id USER_ID --new-name "الاسم الجديد" --apply
`);
  process.exit(1);
}

const cleanNewName = newName.trim();

const users = await sql`
  SELECT id, name, email, role
  FROM users
  WHERE id = ${userId}
  LIMIT 1
`;

if (!users.length) {
  throw new Error(`❌ المستخدم غير موجود: ${userId}`);
}

const user = users[0] as {
  id: string;
  name: string;
  email: string;
  role: string;
};

const oldName = String(user.name || '').trim();

if (!oldName) {
  throw new Error('❌ الاسم القديم فارغ.');
}

if (oldName === cleanNewName) {
  console.log('ℹ️ الاسم الجديد مطابق للاسم الحالي. لا يوجد تغيير.');
  process.exit(0);
}

console.log('==========================================');
console.log(' HALAQI GLOBAL USER RENAME');
console.log('==========================================');
console.log(`User ID : ${user.id}`);
console.log(`Email   : ${user.email}`);
console.log(`Old     : ${oldName}`);
console.log(`New     : ${cleanNewName}`);
console.log(`Mode    : ${apply ? 'APPLY' : 'PREVIEW'}`);
console.log('==========================================');
console.log();

type ColumnInfo = {
  table_name: string;
  column_name: string;
  data_type: string;
};

const textColumns = await sql`
  SELECT table_name, column_name, data_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND data_type IN ('text', 'character varying', 'character')
  ORDER BY table_name, ordinal_position
`;

const excludedTables = new Set([
  'audit_logs',
  'platform_settings',
]);

// الأعمدة التي تمثل محتوى اسم منسوخ/مخزن داخل record.
const nameColumnPattern =
  /(^name$|_name$|name_|author|creator|sender|actor|customer|owner|user_name|display_name)/i;

// الأعمدة التي نبحث فيها عن الاسم القديم كنص.
// لا نلمس أعمدة تقنية أو كلمات مرور.
const textContentPattern =
  /name|title|message|caption|description|text|content|reason|details|user_name|author_name|customer_name|sender_name|actor_name|owner_name|display_name/i;

const candidates: Array<{
  table: string;
  column: string;
  count: number;
  linked: boolean;
}> = [];

for (const c of textColumns as ColumnInfo[]) {
  if (excludedTables.has(c.table_name)) continue;

  if (!nameColumnPattern.test(c.column_name) && !textContentPattern.test(c.column_name)) {
    continue;
  }

  // نتأكد أن العمود يحتوي الاسم القديم.
  const rows = await sql.query(
    `SELECT COUNT(*)::int AS count
     FROM "${c.table_name}"
     WHERE "${c.column_name}"::text LIKE $1`,
    [`%${oldName}%`]
  );

  const count = Number(rows[0]?.count || 0);

  if (count > 0) {
    candidates.push({
      table: c.table_name,
      column: c.column_name,
      count,
      linked: false,
    });
  }
}

console.log('السجلات التي تحتوي الاسم القديم:');
console.log();

for (const item of candidates) {
  console.log(
    `- ${item.table}.${item.column}: ${item.count} سجل`
  );
}

if (!candidates.length) {
  console.log('ℹ️ لم يتم العثور على نصوص إضافية بالاسم القديم.');
}

console.log();
console.log(`📊 إجمالي الأعمدة المتأثرة: ${candidates.length}`);

if (!apply) {
  console.log();
  console.log('🔎 هذا PREVIEW فقط ولم يتم تغيير أي بيانات.');
  console.log();
  console.log('للتطبيق الفعلي استخدم نفس الأمر مع:');
  console.log('--apply');
  process.exit(0);
}

console.log();
console.log('⚠️ بدء التطبيق...');
console.log();

await sql`BEGIN`;

try {
  // 1) المصدر الأساسي
  await sql`
    UPDATE users
    SET name = ${cleanNewName}
    WHERE id = ${userId}
  `;

  let changedRows = 1;

  // 2) استبدال الاسم القديم في كل الحقول النصية التي ظهر فيها.
  // يستثني audit_logs حتى يبقى السجل التاريخي صحيحاً.
  for (const item of candidates) {
    const table = item.table;
    const column = item.column;

    const result = await sql.query(
      `UPDATE "${table}"
       SET "${column}" = REPLACE("${column}"::text, $1, $2)
       WHERE "${column}"::text LIKE $3
       RETURNING 1`,
      [oldName, cleanNewName, `%${oldName}%`]
    );

    changedRows += result.length;
  }

  await sql`COMMIT`;

  console.log('✅ تم تغيير الاسم عالمياً بنجاح.');
  console.log(`✅ الاسم القديم: ${oldName}`);
  console.log(`✅ الاسم الجديد: ${cleanNewName}`);
  console.log(`✅ السجلات المتأثرة تقريباً: ${changedRows}`);

} catch (error) {
  await sql`ROLLBACK`;
  console.error('❌ فشل التحديث. تم تنفيذ ROLLBACK ولم تُحفظ التغييرات.');
  console.error(error);
  process.exit(1);
}
