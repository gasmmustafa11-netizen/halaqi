import { config } from "dotenv";
config({ path: ".env.local" });
import app from "./app";
import { generateToken } from "./authMiddleware";
import { db } from "./db";

async function run() {
  console.log("SUPABASE_URL =", JSON.stringify(process.env.SUPABASE_URL));
  const server = app.listen(0);
  await new Promise<void>((r) => server.once("listening", () => r()));
  const port = (server.address() as any).port;
  const base = `http://127.0.0.1:${port}`;

  const u = db.getState().users[0];
  const token = generateToken({
    id: u.id,
    email: u.email,
    role: u.role,
    salonId: (u as any).salonId,
  } as any);
  const auth = `Bearer ${token}`;

  const PNG =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

  console.log("== upload image ==");
  const up = await fetch(`${base}/api/messages/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: auth },
    body: JSON.stringify({ kind: "image", original: PNG }),
  });
  const upJson = await up.json();
  console.log("status", up.status);
  console.log("body", JSON.stringify(upJson));

  if (upJson.url) {
    console.log("== fetch returned url ==");
    const head = await fetch(upJson.url, { method: "GET" });
    console.log("fetch status", head.status, head.headers.get("content-type"));
  }

  server.close();
}
run().catch((e) => {
  console.error(e);
  process.exit(1);
});
