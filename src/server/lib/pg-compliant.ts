import { Pool } from 'pg';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
  max: 1,
  min: 0,
  idleTimeoutMillis: 0,
  connectionTimeoutMillis: 3000,
  maxLifetime: 3000,
  keepAlive: false,
});

pool.on('error', (err: any) => {
  console.error('[PG POOL ERROR]', err?.message || err);
});

pool.on('connect', () => {
  // Silent: serverless instances connect briefly.
});

function isRetryableError(err: any): boolean {
  const msg = String(err?.message || err || '').toLowerCase();
  return (
    msg.includes('econnreset') ||
    msg.includes('connection terminated') ||
    msg.includes('tls') ||
    msg.includes('timeout') ||
    msg.includes('connection ended') ||
    msg.includes('connection lost')
  );
}

/**
 * Compatibility wrapper that allows existing Neon-style tagged-template
 * usage (`sql\`...\``) to work with standard pg Pool using parameterized
 * queries ($1, $2...). Every interpolation becomes a numbered parameter
 * in order of appearance. Retries on ECONNRESET / TLS disconnect.
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

  let lastErr: any;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const client = await pool.connect();
      try {
        const res = await client.query(text, values as unknown[]);
        return (res.rows || []) as T[];
      } finally {
        client.release(true);
      }
    } catch (err: any) {
      lastErr = err;
      if (!isRetryableError(err) || attempt === 2) {
        throw err;
      }
      // Short backoff before retry for serverless resilience
      await new Promise((r) => setTimeout(r, 150 * (attempt + 1)));
    }
  }
  throw lastErr;
}

export async function sqlOne<T = any>(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<T | null> {
  const rows = await sql<T>(strings, ...values);
  return (rows && rows[0]) ? rows[0] : null;
}
