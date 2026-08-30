import { Pool } from 'pg';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});

/**
 * Compatibility wrapper that allows existing Neon-style tagged-template
 * usage (`sql\`...\``) to work with standard pg Pool using parameterized
 * queries ($1, $2...). Every interpolation becomes a numbered parameter
 * in order of appearance.
 */
export async function sql<T = any>(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<T[]> {
  let text = '';
  for (let i = 0; i < strings.length; i++) {
    text += strings[i] ?? '';
    if (i < values.length) {
      text += `$${i + 1}`;
    }
  }
  const res = await pool.query(text, values as unknown[]);
  return (res.rows || []) as T[];
}

export async function sqlOne<T = any>(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<T | null> {
  const rows = await sql<T>(strings, ...values);
  return (rows && rows[0]) ? rows[0] : null;
}
