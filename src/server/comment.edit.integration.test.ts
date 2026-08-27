/* =========================================================
   Real end-to-end regression test for comment edit (PATCH
   /api/post-comments/:id). Talks to the actual Neon DB when
   DATABASE_URL is available; otherwise it skips gracefully so
   the suite still passes in DB-less environments.

   Run with: node node_modules/tsx/dist/cli.mjs src/server/comment.edit.integration.test.ts
   ========================================================= */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";
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

async function run() {
  if (!process.env.DATABASE_URL) {
    console.log("  skip - DATABASE_URL not set, skipping real DB edit test");
    console.log(`\n${passed} passed, ${failed} failed (skipped)`);
    return;
  }

  const sql = neon(process.env.DATABASE_URL!);
  const userRows = await sql`SELECT id, name, role, avatar FROM users LIMIT 1`;
  const postRows = await sql`SELECT id FROM user_posts LIMIT 1`;
  if (!userRows.length || !postRows.length) {
    console.log("  skip - no user/post in DB");
    console.log(`\n${passed} passed, ${failed} failed (skipped)`);
    return;
  }
  const u = userRows[0];
  const user: any = { id: u.id, name: u.name, role: u.role, avatar: u.avatar };
  const postId = postRows[0].id;

  const add = await db.addPostComment({ postId, comment: "integration original" }, user);
  check("add succeeds", add.success, true);
  if (!add.success || !add.comment) {
    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
  }
  const cid = add.comment.id;

  // Edit in place.
  const edit = await db.editPostComment(cid, user, "integration EDITED");
  check("edit succeeds", edit.success, true);
  check("edit returns same id", edit.comment?.id === cid, true);
  check("edit updates text", edit.comment?.comment === "integration EDITED", true);
  // Preserve reaction state / counts.
  check("edit preserves likes", Number(edit.comment?.likes) === 0, true);
  check("edit preserves dislikes", Number(edit.comment?.dislikes) === 0, true);

  const list = await db.getPostComments(postId, u.id);
  const found = list.find((c: any) => c.id === cid);
  check("db shows edited text", found?.comment === "integration EDITED", true);

  // Delete still works (regression guard).
  const del = await db.deletePostComment(cid, user);
  check("delete succeeds", del.success, true);
  const after = await db.getPostComments(postId, u.id);
  check("comment removed after delete", !after.find((c: any) => c.id === cid), true);

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run().catch((e) => {
  console.error("INTEGRATION TEST ERROR:", e);
  process.exit(1);
});
