/* =========================================================
   Regression + security tests for messaging media endpoints:
   - /api/messages/media (auth, MIME + size validation)
   - POST /api/messages (media URL authorization / not storing
     arbitrary third-party URLs)

   These tests exercise request validation only, so they run in
   any environment (no Neon / Supabase credentials required).

   Run with:
   node node_modules/tsx/dist/cli.mjs src/server/message.media.test.ts
   ========================================================= */
import "dotenv/config";
import app from "./app";
import { generateToken } from "./authMiddleware";
import { db } from "./db";

let passed = 0;
let failed = 0;

function check(label: string, actual: boolean, expected: boolean) {
  if (actual === expected) {
    passed++;
    console.log(`  ok   - ${label}`);
  } else {
    failed++;
    console.error(`  FAIL - ${label} (expected ${expected}, got ${actual})`);
  }
}

function authHeader(): string {
  // requireAuth reloads the user from Neon, so we must sign a token for a
  // real existing user (the first loaded user is fine for validation tests).
  const users = db.getState().users;
  const u = users[0];
  if (!u) {
    throw new Error("No users loaded from Neon; cannot build an auth token.");
  }
  const token = generateToken({
    id: u.id,
    email: u.email,
    role: u.role,
    salonId: (u as any).salonId,
  } as any);
  return `Bearer ${token}`;
}

// 1x1 transparent PNG (valid image payload, ~tiny)
const PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

async function run() {
  await new Promise<void>((resolve) => {
    const server = app.listen(0, () => resolve());
    (run as any)._server = server;
  });
  const server: any = (run as any)._server;
  const base = `http://127.0.0.1:${(server.address() as any).port}`;

  // 1) No auth -> 401
  {
    const res = await fetch(`${base}/api/messages/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "image", original: PNG_DATA_URL }),
    });
    check("media upload requires auth (401)", res.status === 401, true);
  }

  // 2) Invalid kind -> 400
  {
    const res = await fetch(`${base}/api/messages/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: authHeader() },
      body: JSON.stringify({ kind: "video", original: PNG_DATA_URL }),
    });
    check("media upload rejects invalid kind (400)", res.status === 400, true);
  }

  // 3) Disallowed MIME (text/plain) -> 400
  {
    const res = await fetch(`${base}/api/messages/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: authHeader() },
      body: JSON.stringify({
        kind: "image",
        original: "data:text/plain;base64,SGVsbG8=",
      }),
    });
    check("media upload rejects non-image MIME (400)", res.status === 400, true);
  }

  // 4) Valid image passes server-side validation (reaches storage step:
  //    either 201 if Supabase is configured, or 500 if not — but never
  //    400/401, which would mean validation wrongly rejected it).
  {
    const res = await fetch(`${base}/api/messages/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: authHeader() },
      body: JSON.stringify({ kind: "image", original: PNG_DATA_URL }),
    });
    check(
      "valid image passes validation (not 400/401)",
      res.status !== 400 && res.status !== 401,
      true
    );
  }

  // 5) POST /api/messages with media but no URL -> 400
  {
    const res = await fetch(`${base}/api/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: authHeader() },
      body: JSON.stringify({
        recipientId: "someone_else",
        type: "image",
      }),
    });
    check("media message requires a media URL (400)", res.status === 400, true);
  }

  // 6) POST /api/messages with a foreign/third-party URL -> 400 (no SSRF /
  //    arbitrary storage of external URLs)
  {
    const res = await fetch(`${base}/api/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: authHeader() },
      body: JSON.stringify({
        recipientId: "someone_else",
        type: "image",
        mediaUrl: "https://evil.example.com/malware.png",
      }),
    });
    check("media message rejects foreign URL (400)", res.status === 400, true);
  }

  // 7) Text message with empty body is still rejected (400)
  {
    const res = await fetch(`${base}/api/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: authHeader() },
      body: JSON.stringify({ recipientId: "someone_else", body: "   " }),
    });
    check("empty text message rejected (400)", res.status === 400, true);
  }

  server.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run().catch((e) => {
  console.error("MEDIA TEST ERROR:", e);
  process.exit(1);
});
