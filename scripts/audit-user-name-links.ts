import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error('❌ DATABASE_URL غير موجود في البيئة.');
}

const sql = neon(process.env.DATABASE_URL);

type Column = {
  table_name: string;
  column_name: string;
  data_type: string;
};

const ID_PATTERNS = [
  /^user_id$/i,
  /^customer_id$/i,
  /^author_id$/i,
  /^sender_id$/i,
  /^actor_id$/i,
  /^owner_id$/i,
  /^creator_id$/i,
  /^barber_id$/i,
  /^reviewer_id$/i,
  /^commenter_id$/i,
];

const NAME_PATTERNS = [
  /^user_name$/i,
  /^customer_name$/i,
  /^author_name$/i,
  /^sender_name$/i,
  /^actor_name$/i,
  /^owner_name$/i,
  /^creator_name$/i,
  /^barber_name$/i,
  /^reviewer_name$/i,
  /^commenter_name$/i,
  /^display_name$/i,
];

function quoteIdentifier(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

console.log('');
console.log('==============================================');
console.log(' HALAQI USER NAME LINK AUDIT');
console.log('==============================================');
console.log('🔎 هذا السكربت READ-ONLY فقط.');
console.log('❌ لن يعدّل أو يحذف أي بيانات.');
console.log('');

const columns = await sql`
  SELECT
    table_name,
    column_name,
    data_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
  ORDER BY table_name, ordinal_position
`;

const allColumns = columns as Column[];

const tables = new Map<string, Set<string>>();

for (const column of allColumns) {
  if (!tables.has(column.table_name)) {
    tables.set(column.table_name, new Set());
  }

  tables.get(column.table_name)!.add(column.column_name);
}

type Finding = {
  table: string;
  idColumn: string;
  nameColumn: string;
  rowsWithBoth: number;
};

const findings: Finding[] = [];

for (const [table, columnSet] of tables.entries()) {
  const idColumns = [...columnSet].filter((column) =>
    ID_PATTERNS.some((pattern) => pattern.test(column))
  );

  const nameColumns = [...columnSet].filter((column) =>
    NAME_PATTERNS.some((pattern) => pattern.test(column))
  );

  for (const idColumn of idColumns) {
    for (const nameColumn of nameColumns) {
      const idValueColumn = quoteIdentifier(idColumn);
      const nameValueColumn = quoteIdentifier(nameColumn);
      const tableName = quoteIdentifier(table);

      try {
        const result = await sql.query(
          `
          SELECT COUNT(*)::int AS count
          FROM ${tableName}
          WHERE ${idValueColumn} IS NOT NULL
            AND ${nameValueColumn} IS NOT NULL
          `,
          []
        );

        const count = Number(result[0]?.count || 0);

        if (count > 0) {
          findings.push({
            table,
            idColumn,
            nameColumn,
            rowsWithBoth: count,
          });
        }
      } catch (error: any) {
        console.log(
          `⚠️ تعذر فحص ${table}.${idColumn}/${nameColumn}:`,
          error?.message || error
        );
      }
    }
  }
}

console.log('📋 الأماكن التي تخزن ID + NAME معًا:');
console.log('');

if (!findings.length) {
  console.log('✅ لم يتم العثور على أعمدة واضحة من هذا النوع.');
} else {
  for (const item of findings) {
    console.log(
      `- ${item.table}.${item.idColumn} + ${item.nameColumn} → ${item.rowsWithBoth} سجل`
    );
  }
}

console.log('');
console.log('==============================================');
console.log(`📊 إجمالي الحالات: ${findings.length}`);
console.log('==============================================');
console.log('');

console.log('🔍 فحص العلاقات الحقيقية مع users...');
console.log('');

type ForeignKey = {
  table_name: string;
  column_name: string;
  foreign_table: string;
  foreign_column: string;
};

const foreignKeys = await sql`
  SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table,
    ccu.column_name AS foreign_column
  FROM information_schema.table_constraints AS tc
  JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
   AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
   AND ccu.table_schema = tc.table_schema
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND ccu.table_name = 'users'
  ORDER BY tc.table_name, kcu.column_name
`;

const userForeignKeys = foreignKeys as ForeignKey[];

if (!userForeignKeys.length) {
  console.log('ℹ️ لا توجد Foreign Keys واضحة مرتبطة بجدول users.');
} else {
  for (const fk of userForeignKeys) {
    console.log(
      `- ${fk.table_name}.${fk.column_name} → users.${fk.foreign_column}`
    );
  }
}

console.log('');
console.log('==============================================');
console.log('✅ انتهى التدقيق');
console.log('==============================================');
console.log('');
console.log('الخطوة التالية: نستخدم هذه النتائج لإنشاء');
console.log('سكربت الإصلاح الذي يجعل users.name هو المصدر');
console.log('الوحيد للاسم، بدون تغيير user_id نفسه.');
console.log('');
