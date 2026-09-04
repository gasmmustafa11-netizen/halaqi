// Mirrors the exact intent-detection regexes added to src/server/app.ts so we
// can verify the search-vs-booking distinction without hitting Gemini/Neon.
/* eslint-disable */

function detect(appearance) {
  const searchTerm = String(appearance).trim();

  const wantsServices = /^(\s*)(خدمات|الخدمات|شو عندك|شنو عندك|اسعار|الأسعار|قايمة|القائمه|قائمة|شو الخدمات|الخدمات المتوفرة|عر[جي] لي الخدمات)/iu.test(searchTerm);
  const isBookingConfirm = /(?<![A-Za-z0-9\u0600-\u06FF])(?:نعم|اي|ايوه|إي|تمام|موافق|احجز|احجزلي|لا|مش|مابي|الغاء|يلغي)(?![A-Za-z0-9\u0600-\u06FF])/i.test(searchTerm);
  const hasInlineBookingDetail =
    /\d{1,2}[\/\-]\d{1,2}/.test(searchTerm) ||
    /\d{1,2}:\d{2}/.test(searchTerm) ||
    /صبغ|حلاقة|تشذيب|ماسك|كيراتين|حواجب|قص\b/i.test(searchTerm) ||
    wantsServices ||
    /الخدمات|شو عندك|شنو عندك/.test(searchTerm);
  const isGreeting = /^\s*(مرحبا|هلا|اهلا|سلام|السلام|صباح|مساء)/i.test(searchTerm);

  const bookingIntent =
    /(احجز|حجز|احجزي|حجزي|اريد\s+احجز|أريد\s+أحجز|اريد\s+الحجز|أريد\s+الحجز|ابي\s+احجز|ابغي\s+احجز|موعد|حجز\s+موعد|اريد\s+موعد|خل\s+احجز|يلا\s+احجز|احجزلي|احجز\s+لي)/iu.test(searchTerm) ||
    /احجز|حجز|موعد/i.test(searchTerm);

  const changeSalonRequested = (() => {
    const t = searchTerm;
    const isChangeSalonRequest = (s) =>
      /غير\s*(الصالون|صالون|سالون|هداك|هذا|هذاك|ذي)/i.test(s) ||
      /صالون\s*(ثاني|ثانية|تاني|آخر|اخر|ابدي|بديل)/i.test(s) ||
      /(ثاني|ثانية|تاني|آخر|اخر|ابدي)\s*صالون/i.test(s) ||
      /(بدل|بدّل|غيّر|غير|تبديل|تغيير|تغيّر)\s*صالون/i.test(s) ||
      /مو\s*(هذا|هذاك|ذاك|هاي|ذي)\s*(الصالون|صالون)/i.test(s) ||
      /(هذا|هذاك|هاي|ذا)\s*مو\s*الصالون/i.test(s) ||
      /لا[,،\s]+(اريد|أريد|ابي|ابغي|ابيي|وريد)[,،\s]+(غير|صالون\s*(ثاني|تاني|آخر|اخر))/i.test(s) ||
      /(اريد|أريد|ابي|ابغي|وريد)\s*غير\s*(الصالون|صالون)/i.test(s);
    return isChangeSalonRequest(t);
  })();

  const isSalonLookup =
    (changeSalonRequested) ||
    /(ابحث|ادور|دور|وريد|ابغي|ابي|عايز|لق[يي]|شوف|وين)\s*(لي)?\s*(عن)?\s*(صالون|سالون)/i.test(searchTerm) ||
    /(اريد|أريد|ابي|ابغي|وريد|عايز)\s+(صالون|سالون)/i.test(searchTerm) ||
    (!bookingIntent && !isBookingConfirm && !hasInlineBookingDetail && !isGreeting && searchTerm.split(/\s+/).filter(Boolean).length <= 4) ||
    /رويال|الميار|النجم|لاونج|بيوتي|باربر|اكبر|تاج|قائد|mİyar|miyar/i.test(searchTerm);

  // Would the orchestration fire search_salons?
  const orchestrationSearches =
    searchTerm && !isBookingConfirm && !bookingIntent && !hasInlineBookingDetail && !isGreeting && isSalonLookup;

  return { bookingIntent, changeSalonRequested, isSalonLookup, orchestrationSearches };
}

const cases = [
  // [input, expectSearch, label]
  ['ابحثلي عن صالون رجالي قريب', true, 'Test: ابحثلي عن صالون رجالي قريب (search)'],
  ['اريد صالون قريب', true, 'Test 1: اريد صالون قريب (search)'],
  ['اريد صالون ثاني', true, 'Test 6: اريد صالون ثاني (search)'],
  ['غير الصالون', true, 'Test 5: غير الصالون (change -> search)'],
  ['دورلي على صالون آخر', true, 'change/search: دورلي على صالون آخر'],
  ['اريد صالون الميار', true, 'search: اريد صالون الميار (plain salon request)'],
  ['اريد الحجز في صالون الميار', false, 'Test 2: اريد الحجز في صالون الميار (booking)'],
  ['احجز لي في صالون الميار', false, 'Test 3: احجز لي في صالون الميار (booking)'],
  ['اريد احجز خدمة صبغ في صالون حلاقة الميار', false, 'Test 4: اريد احجز خدمة صبغ في صالون حلاقة الميار (booking)'],
  ['احجزلي قص شعر', false, 'booking: احجزلي قص شعر'],
  ['اريد موعد', false, 'booking: اريد موعد'],
  ['اريد احجز', false, 'booking: اريد احجز'],
  ['نعم احجز', false, 'Test 9: نعم احجز (no search; confirm)'],
];

let failures = 0;
for (const [input, expectSearch, label] of cases) {
  const r = detect(input);
  const gotSearch = r.orchestrationSearches;
  const pass = gotSearch === expectSearch;
  if (!pass) failures++;
  console.log(`${pass ? 'PASS' : 'FAIL'} | ${label}\n     input=${JSON.stringify(input)}\n     expectSearch=${expectSearch} gotSearch=${gotSearch}\n     detail=${JSON.stringify(r)}`);
}

// ---- Groq-fallback looksLikeNewSearch mirror (adds change-salon to search) ----
function looksLikeNewSearch(rawU) {
  const bookingIntentGr = /(احجز|حجز|اريد\s+احجز|أريد\s+أحجز|احجزلي|احجز\s+لي|اريد\s+الحجز|أريد\s+الحجز|موعد)/iu.test(rawU);
  const changeSalonGr =
    /غير\s*(الصالون|صالون)/iu.test(rawU) ||
    /صالون\s*(ثاني|تاني|آخر|اخر|ابدي|بديل)/iu.test(rawU) ||
    /(ثاني|تاني|آخر|اخر|ابدي)\s*صالون/iu.test(rawU) ||
    /(بدل|بدّل|غيّر|غير|تبديل|تغيير|تغيّر)\s*صالون/iu.test(rawU) ||
    /(غير|ثاني|تاني|آخر|اخر|ابدي)\s*(الصالون|صالون)/iu.test(rawU) ||
    /مو\s*(هذا|هذاك|هاي|ذي)\s*الصالون/iu.test(rawU);
  return !bookingIntentGr && (
    changeSalonGr ||
    /(ابحث|ادور|دور|وريد|ابغي|ابي|شوف|وين)\s*(لي)?\s*(عن)?\s*(صالون|سالون)/iu.test(rawU) ||
    /(اريد|أريد|ابي|ابغي|وريد|عايز)\s+(صالون|سالون)/iu.test(rawU)
  );
}

const groqCases = [
  ['ابحثلي عن صالون رجالي قريب', true],
  ['اريد صالون قريب', true],
  ['اريد صالون ثاني', true],
  ['غير الصالون', true],
  ['دورلي على صالون آخر', true],
  ['اريد الحجز في صالون الميار', false],
  ['احجز لي في صالون الميار', false],
  ['اريد احجز خدمة صبغ في صالون حلاقة الميار', false],
  ['اريد موعد', false],
  ['نعم احجز', false],
];
let groqFail = 0;
for (const [inp, exp] of groqCases) {
  const got = looksLikeNewSearch(inp);
  const ok = got === exp;
  if (!ok) groqFail++;
  console.log(`${ok ? 'PASS' : 'FAIL'} | groq looksLikeNewSearch ${JSON.stringify(inp)} expectSearch=${exp} got=${got}`);
}

const allOk = failures === 0 && groqFail === 0;
console.log('\n=== RESULT:', allOk ? 'ALL PASS' : `${failures + groqFail} FAILED`, '===');
process.exit(allOk ? 0 : 1);
