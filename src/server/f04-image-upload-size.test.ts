/**
 * F-04: Server-side image upload size limit tests
 *
 * Validates:
 *  - 25 MB limit enforced server-side
 *  - 413 status on oversized images
 *  - Size check before Buffer.from() (memory safety)
 *  - Video route unaffected
 *  - express.json 80mb unchanged
 *  - Arabic error message
 */

import fs from 'fs';

const results: { name: string; pass: boolean }[] = [];
function ok(name: string) { results.push({ name, pass: true }); console.log(`  ok   - ${name}`); }
function fail(name: string, err: any) { results.push({ name, pass: false }); console.log(`  FAIL - ${name}: ${err}`); }

// 1. app.ts has 25 MB limit
{
  const src = fs.readFileSync('src/server/app.ts', 'utf8');
  if (src.includes('25 * 1024 * 1024')) {
    ok('app.ts has 25 MB limit');
  } else {
    fail('app.ts has 25 MB limit', 'not found');
  }
}

// 2. app.ts returns 413 for oversized images
{
  const src = fs.readFileSync('src/server/app.ts', 'utf8');
  const imgUploadIdx = src.indexOf("'/api/uploads/image'");
  const imgSection = src.slice(imgUploadIdx, imgUploadIdx + 2000);
  if (imgSection.includes('413')) {
    ok('app.ts returns 413 for oversized images');
  } else {
    fail('app.ts returns 413 for oversized images', '413 not found in image route');
  }
}

// 3. Size check is BEFORE Buffer.from()
{
  const src = fs.readFileSync('src/server/app.ts', 'utf8');
  const imgUploadIdx = src.indexOf("'/api/uploads/image'");
  const imgSection = src.slice(imgUploadIdx, imgUploadIdx + 2000);
  const sizeCheckIdx = imgSection.indexOf('approxBytes');
  const bufferFromIdx = imgSection.indexOf('Buffer.from(match[2]');
  if (sizeCheckIdx !== -1 && bufferFromIdx !== -1 && sizeCheckIdx < bufferFromIdx) {
    ok('Size check is before Buffer.from()');
  } else {
    fail('Size check is before Buffer.from()', `sizeCheck=${sizeCheckIdx}, bufferFrom=${bufferFromIdx}`);
  }
}

// 4. Arabic error message is correct
{
  const src = fs.readFileSync('src/server/app.ts', 'utf8');
  if (src.includes('حجم الصورة كبير جداً. الحد الأقصى 25 ميجابايت.')) {
    ok('Arabic error message is correct');
  } else {
    fail('Arabic error message is correct', 'message not found');
  }
}

// 5. Video route is NOT affected (no 25MB limit in video route)
{
  const src = fs.readFileSync('src/server/app.ts', 'utf8');
  const videoIdx = src.indexOf("'/api/uploads/video'");
  const nextRouteIdx = src.indexOf("app.post(", videoIdx + 1);
  const videoSection = src.slice(videoIdx, nextRouteIdx !== -1 ? nextRouteIdx : videoIdx + 3000);
  if (!videoSection.includes('25 * 1024 * 1024')) {
    ok('Video route unaffected by 25MB limit');
  } else {
    fail('Video route unaffected by 25MB limit', '25MB limit found in video route');
  }
}

// 6. Video route still has its own 60MB limit
{
  const src = fs.readFileSync('src/server/app.ts', 'utf8');
  const videoIdx = src.indexOf("'/api/uploads/video'");
  const nextRouteIdx = src.indexOf("app.post(", videoIdx + 1);
  const videoSection = src.slice(videoIdx, nextRouteIdx !== -1 ? nextRouteIdx : videoIdx + 3000);
  if (videoSection.includes('60 * 1024 * 1024')) {
    ok('Video route retains 60 MB limit');
  } else {
    fail('Video route retains 60 MB limit', '60MB not found in video route');
  }
}

// 7. express.json 80mb unchanged
{
  const src = fs.readFileSync('src/server/app.ts', 'utf8');
  if (src.includes("express.json({ limit: '80mb' })")) {
    ok('express.json 80mb limit unchanged');
  } else {
    fail('express.json 80mb limit unchanged', '80mb not found');
  }
}

// 8. Size check uses approxBytes (base64 estimation, not raw string length)
{
  const src = fs.readFileSync('src/server/app.ts', 'utf8');
  const imgUploadIdx = src.indexOf("'/api/uploads/image'");
  const imgSection = src.slice(imgUploadIdx, imgUploadIdx + 2000);
  if (imgSection.includes('Math.floor') && imgSection.includes('* 3) / 4')) {
    ok('Size check uses base64 approximation formula');
  } else {
    fail('Size check uses base64 approximation formula', 'formula not found');
  }
}

// 9. Limit is 25 * 1024 * 1024 (exactly 25 MB)
{
  const src = fs.readFileSync('src/server/app.ts', 'utf8');
  const imgUploadIdx = src.indexOf("'/api/uploads/image'");
  const imgSection = src.slice(imgUploadIdx, imgUploadIdx + 2000);
  if (imgSection.includes('25 * 1024 * 1024') && !imgSection.includes('10 * 1024 * 1024')) {
    ok('Limit is exactly 25 MB (not 10 MB)');
  } else {
    fail('Limit is exactly 25 MB (not 10 MB)', 'wrong limit value');
  }
}

// 10. Size check is within /api/uploads/image handler (not global)
{
  const src = fs.readFileSync('src/server/app.ts', 'utf8');
  const imgUploadIdx = src.indexOf("'/api/uploads/image'");
  const videoIdx = src.indexOf("'/api/uploads/video'");
  const sizeCheckIdx = src.indexOf('approxBytes');
  if (sizeCheckIdx > imgUploadIdx && sizeCheckIdx < videoIdx) {
    ok('Size check is within image upload handler (not global)');
  } else {
    fail('Size check is within image upload handler (not global)', `position: ${sizeCheckIdx}`);
  }
}

// ─── Summary ───
const passed = results.filter(r => r.pass).length;
const failed = results.filter(r => !r.pass).length;
console.log(`\n=== F-04 image upload size limit test results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
