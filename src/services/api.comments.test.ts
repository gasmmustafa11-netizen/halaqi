/* =========================================================
   Regression tests for comment edit / delete API support.
   Runs offline with a mocked global fetch (no DB needed).
   Run with: node node_modules/tsx/dist/cli.mjs src/services/api.comments.test.ts
   ========================================================= */
import { api } from "./api";

let passed = 0;
let failed = 0;

type Call = {
  url: string;
  method: string;
  body?: any;
};

let lastCall: Call | null = null;

// Minimal fetch mock: records the call and returns a canned JSON response.
(globalThis as any).fetch = async (url: string, options: any = {}) => {
  lastCall = {
    url,
    method: (options.method || "GET").toUpperCase(),
    body: options.body ? JSON.parse(options.body) : undefined,
  };

  const ok = url.includes("/post-comments/") ? true : true;
  return {
    ok,
    status: ok ? 200 : 400,
    json: async () => ({ success: true, comment: { id: "c1", comment: "edited" } }),
  } as any;
};

// Silence auth token (setAuthToken is optional; fetchWithAuth tolerates null).
(api as any).setAuthToken?.("test-token");

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
  // --- Edit ---
  lastCall = null;
  const editRes = await api.editUnifiedPostComment("c1", "تعديل التعليق");
  check("edit: returns success", editRes.success, true);
  check("edit: uses PATCH", lastCall?.method === "PATCH", true);
  check(
    "edit: hits /api/post-comments/c1",
    lastCall?.url === "/api/post-comments/c1",
    true
  );
  check(
    "edit: sends { comment } body",
    lastCall?.body && lastCall.body.comment === "تعديل التعليق",
    true
  );

  // --- Delete ---
  lastCall = null;
  const delRes = await api.deleteUnifiedPostComment("c1");
  check("delete: returns success", delRes.success, true);
  check("delete: uses DELETE", lastCall?.method === "DELETE", true);
  check(
    "delete: hits /api/post-comments/c1",
    lastCall?.url === "/api/post-comments/c1",
    true
  );

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.error("COMMENT API REGRESSION TESTS FAILED");
    process.exit(1);
  }
  console.log("All comment API regression tests passed.");
}

run();
