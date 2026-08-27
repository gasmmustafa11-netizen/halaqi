/* =========================================================
   Regression tests for Arabic/Iraqi profanity moderation.
   Run with:  npx tsx src/server/moderation.test.ts
   ========================================================= */
import { moderateContent, MODERATION_MESSAGE } from "./moderation";

let passed = 0;
let failed = 0;

function check(label: string, actual: boolean, expected: boolean) {
  if (actual === expected) {
    passed++;
    console.log(`  ok   - ${label}`);
  } else {
    failed++;
    console.error(
      `  FAIL - ${label} (expected blocked=${expected}, got blocked=${actual})`
    );
  }
}

function blocks(label: string, text: string) {
  check(label, moderateContent(text).blocked, true);
}

function allows(label: string, text: string) {
  check(label, moderateContent(text).blocked, false);
}

console.log("Profanity: 'خرا'");
blocks("exact خرا", "هذا خرا");
blocks("exact خرة", "يا خرة");
blocks("obfuscated خ.ر.ا", "محتوى خ.ر.ا هنا");
blocks("arabish khra", "this is khra");
blocks("arabish khara", "ما تسميه khara");
blocks("digit 5ra", "كلام 5ra ووقاحة");
blocks("digit 5rah", "5rah هذا");
blocks("tatweel خرا", "خرااا"); // repeated-letter collapse in normalize

console.log("Profanity: 'كس امك'");
blocks("exact spaced كس امك", "يا كس امك");
blocks("exact spaced كس أمك (hamza)", "يا كس أمك");
blocks("run-together كسامك", "كسامك");
blocks("dotted كس.امك", "انت كس.امك");
blocks("spaced-obfuscated ك س امك", "ك س امك");
blocks("arabish ks amk", "you are ks amk");
blocks("arabish ks.amk", "ks.amk");
blocks("arabish ksomak", "ksomak");
blocks("arabish kos omak", "kos omak");
blocks("arabish ksomk", "ksomk");
blocks("ksokhtak", "ksokhtak");
blocks("kosokhtak", "kosokhtak");

console.log("Profanity: 'عير' (Iraqi)");
blocks("exact عير", "هذا عير");
blocks("ya عير", "يا عير");
blocks("عيرك", "يا عيرك");
blocks("arabish 3yr", "this is 3yr");
blocks("arabish 3yrk", "3yrk");
blocks("arabish 3yry", "3yry");
blocks("dotted ع.ي.ر", "انت ع.ي.ر");
blocks("spaced ع ي ر", "ع ي ر");
blocks("tatweel عـير", "عـير");
blocks("separated ع-ي-ر", "ع-ي-ر");
allows("عيره/عيرة ambiguous", "جرعة عيرة دوائية");

console.log("False-positive guards (must NOT block):");
allows("كسول (lazy)", "هو شخص كسول جداً");
allows("خرافة (fable)", "هذه خرافة قديمة");
allows("خريف (autumn)", "في فصل الخريف");
allows("خريطة (map)", "خريطة المدينة");
allows("أمك alone (benign)", "أمك ذهبت إلى السوق");
allows("بعير (camel)", "رأيت بعيراً في الصحراء");
allows("معير (loan)", "سيارة معير من صديق");
allows("عيرة (unit)", "عيرة دواء مفيدة");
allows("تعير (lend)", "هل تعيرني كتابك");
allows("عاير (mock)", "لا تعايره أمام الناس");
allows("cross-word عمل يربح", "عمل يربح المال بصدق");
allows("class (english)", "this is a great class");
allows("ask me (english)", "please ask me later");
allows("music (english)", "i love music");
allows("clean greeting", "مرحبا كيف حالك اليوم");
allows("empty", "");
allows("ks in english words", "the desk and mask are here");

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error("MODERATION REGRESSION TESTS FAILED");
  process.exit(1);
}
console.log("All moderation regression tests passed.");

// Sanity: message is bilingual.
if (!MODERATION_MESSAGE.includes("عذراً") || !MODERATION_MESSAGE.includes("Sorry")) {
  console.error("MODERATION_MESSAGE missing bilingual text");
  process.exit(1);
}