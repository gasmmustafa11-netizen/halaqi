/* =========================================================
   Multilingual Profanity / Toxicity Moderation
   ---------------------------------------------------------
   - Detects profanity, insults, harassment, hate speech and
     abusive language across major languages + Arabic dialects
     (MSA, Iraqi, Levantine, Gulf, Egyptian, Maghrebi) and a few
     European languages.
   - Normalizes obfuscation: spaces/separators between letters,
     leetspeak, Arabish numerals (7=ح, 3=ع, 8=ق, ...), repeated
     characters, diacritics, tatweel, alef/hamza variants, mixed
     scripts.
   - Context-aware: severity tiers + a harassment-context boost so
     a directed insult blocks while isolated mild words do not,
     reducing false positives.
   - Blocks clearly abusive content BEFORE it is saved.
   - Extensible: add a rule to MODERATION_RULES to update coverage.
========================================================= */

export type ModerationCategory =
  | 'profanity'
  | 'insult'
  | 'harassment'
  | 'hate'
  | 'abuse';

export interface ModerationRule {
  id: string;
  category: ModerationCategory;
  languages: string[]; // documentation / extensibility
  severity: 'severe' | 'high' | 'medium';
  terms: string[];
}

export interface ModerationResult {
  blocked: boolean;
  category?: ModerationCategory;
  severity?: string;
  reasons: string[];
  score: number;
  message: string;
}

// Polite, bilingual rejection shown to the user.
export const MODERATION_MESSAGE =
  'عذراً، يحتوي المحتوى على لغة غير لائقة أو مسيئة. يرجى تعديله وإعادة المحاولة. / ' +
  'Sorry, this content contains inappropriate or abusive language. Please edit it and try again.';

const SEVERITY_WEIGHT: Record<ModerationRule['severity'], number> = {
  severe: 10,
  high: 5,
  medium: 2,
};

const BLOCK_THRESHOLD = 3; // severe/high always block; mediums need reinforcement
const HARASSMENT_BOOST = 2; // directed insults get an extra push

// ---------------------------------------------------------------------------
// Extensible rule set. Terms are written in their common (chat) spelling;
// they are normalized at load time so obfuscated variants still match.
// ---------------------------------------------------------------------------
const MODERATION_RULES: ModerationRule[] = [
  // ---------------- Hate speech / severe slurs (block on match) ----------------
  {
    id: 'hate-en',
    category: 'hate',
    languages: ['en'],
    severity: 'severe',
    terms: [
      'nigger', 'nigga', 'faggot', 'fag', 'retard', 'kike', 'spic',
      'chink', 'wetback', 'towelhead', 'sandnigger', 'raghead',
    ],
  },
  {
    id: 'hate-ar',
    category: 'hate',
    languages: ['ar', 'iraqi', 'levantine', 'gulf', 'egyptian'],
    severity: 'severe',
    terms: [
      'قحبة', '8hba', '8hbah', // قحبة (whore)
      'شرموطة', 'sharmota',
      'خول', 'khwl', // خول (gay slur, Iraqi)
      'عرص', '3r9', '3rs',
      'منيوك', 'mnwk', 'mnook', // عراقي
      'متناك', 'mtnak',
      'عاهرة', 'عاهر',
      'زنجي',
    ],
  },

  // ---------------- Severe Iraqi/Arabic insults (block on match) ----------------
  {
    id: 'severe-ar-insult',
    category: 'hate',
    languages: ['ar', 'iraqi', 'levantine', 'gulf', 'egyptian'],
    severity: 'severe',
    terms: [
      // "كس امك" (your mother's vagina) and close Iraqi variants.
      // Terms are written run-together on purpose: the fuzzy matcher
      // injects [\W_]* between characters, so it also catches spaced,
      // dotted or otherwise separated obfuscations (كس امك / كس.امك / ك س امك).
      'كسامك', 'كسأمك',
      'ksamk', 'ksomak', 'ksomk', 'ksamak',
      'kosamk', 'kosomak', 'kosomk', 'kosamak',
      // "كس اختك" / "كسختك" family.
      'كساختك',
      'ksokhtak', 'kosokhtak', 'ksohtak',
    ],
  },

  // ---------------- Explicit profanity (high) ----------------
  {
    id: 'profanity-en',
    category: 'profanity',
    languages: ['en'],
    severity: 'high',
    terms: [
      'fuck', 'fucker', 'motherfucker', 'fucking', 'shit', 'bullshit',
      'bitch', 'ass', 'asshole', 'bastard', 'dick', 'pussy', 'cock',
      'cunt', 'whore', 'slut', 'piss', 'dipshit', 'shithead',
    ],
  },
  {
    id: 'profanity-ar',
    category: 'profanity',
    languages: ['ar', 'iraqi', 'levantine', 'gulf', 'egyptian'],
    severity: 'high',
    terms: [
      'خرا', 'خرة', 'khra', 'khara', 'khrah', 'khera', 'kharah',
      '5ra', '5rah', '5ara',
      'زق', 'zag',
      'مصخرة', 'mskhra',
      'حيوان', 'كلب', 'حمار', '7mar', '7mar',
      'نتن', 'ntn',
      'وسخ', 'wskh',
      'تبه', 'طبه', 'tbh', // لعنة عراقية
      'لعنة',
      'زنخ', 'zngkh',
    ],
  },
  {
    id: 'profanity-fr-es-de',
    category: 'profanity',
    languages: ['fr', 'es', 'de'],
    severity: 'high',
    terms: [
      'pute', 'puta', 'connard', 'cabron', 'cabrón', 'salope', 'salopa',
      'enculé', 'enculo', 'merde', 'mierda', 'hijo de puta', 'pendejo',
      'maricon', 'maricón', 'schlampe', 'arsch', 'ficken', 'hure', 'fils de pute',
    ],
  },

  // ---------------- Insults / abuse (medium, context-aware) ----------------
  {
    id: 'insult-en',
    category: 'insult',
    languages: ['en'],
    severity: 'medium',
    terms: [
      'stupid', 'idiot', 'dummy', 'moron', 'loser', 'ugly', 'trash',
      'garbage', 'pathetic', 'worthless', 'scum', 'jerk', 'freak',
      'coward', 'dumb', 'shitty', 'bitchy',
    ],
  },
  {
    id: 'insult-ar',
    category: 'insult',
    languages: ['ar', 'iraqi'],
    severity: 'medium',
    terms: [
      'غبي', 'ghby', 'حقير', 'hqyr', 'واطي', 'waty',
      'امك', 'omak', 'umak', // يا أمك (شتيمة عراقية)
      'يا خرا', 'جيف', 'jif',
      'بلد', 'bald', // بلد = وقح (عراقي)
      'سخيف', 'skhif',
    ],
  },
  {
    id: 'harassment-context',
    category: 'harassment',
    languages: ['ar', 'en', 'iraqi'],
    severity: 'medium',
    terms: [
      'اقتل', 'kill', 'اموت', 'tmwt', // threats
      'انت قذر', 'you are trash', 'get lost', 'اختفي',
    ],
  },
];

// ---------------------------------------------------------------------------
// Text normalization
// ---------------------------------------------------------------------------
function normalizeText(input: string): string {
  let s = input || '';

  // Strip invisible / zero-width characters.
  s = s.replace(/[​­‌‍⁠﻿]/g, '');

  // Decompose accents/diacritics (Arabic harakat, Latin accents) then drop them.
  s = s.normalize('NFKD').replace(/[̀-ͯ]/g, '');

  // Arabic-specific normalization.
  s = s.replace(/ـ/g, ''); // tatweel
  s = s.replace(/[إأآٱ]/g, 'ا');
  s = s.replace(/ى/g, 'ي');
  s = s.replace(/ؤ/g, 'و');
  s = s.replace(/ئ/g, 'ي');
  s = s.replace(/ة/g, 'ه'); // ة ⇄ ه obfuscation

  // Arabic-Indic digits → Western digits so Arabish rules apply.
  s = s.replace(/[٠-٩]/g, (d) =>
    String.fromCharCode(0x30 + (d.charCodeAt(0) - 0x0660))
  );

  // Arabish numerals → Arabic letters (Iraqi/Levantine chat).
  s = s
    .replace(/2/g, 'ا')
    .replace(/3/g, 'ع')
    .replace(/4/g, 'ش')
    .replace(/5/g, 'خ')
    .replace(/6/g, 'ط')
    .replace(/7/g, 'ح')
    .replace(/8/g, 'ق')
    .replace(/9/g, 'ص')
    .replace(/0/g, 'ة');

  // Latin leet (non-conflicting digits only).
  s = s.replace(/1/gi, 'i').replace(/@/gi, 'a').replace(/\$/gi, 's');

  s = s.toLowerCase();

  // Collapse 3+ repeated letters (defeats "shiiit", "fuuuck").
  s = s.replace(/(.)\1{2,}/g, '$1');

  return s;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Boundary that works for both Latin and Arabic scripts.
function boundary(inner: string): string {
  return `(?<![\\p{L}\\p{N}])(?:${inner})(?![\\p{L}\\p{N}])`;
}

interface CompiledRule {
  rule: ModerationRule;
  exact: RegExp;
  fuzzy: RegExp;
  weight: number;
}

const COMPILED: CompiledRule[] = MODERATION_RULES.map((rule) => {
  const weight = SEVERITY_WEIGHT[rule.severity];
  const exactParts = rule.terms.map((t) =>
    boundary(escapeRegex(normalizeText(t)))
  );
  const fuzzyParts = rule.terms.map((t) => {
    const norm = normalizeText(t);
    const chars = Array.from(norm)
      .map((c) => escapeRegex(c))
      .join('[^\\p{L}\\p{N}]*');
    return boundary(chars);
  });
  return {
    rule,
    weight,
    exact: new RegExp(exactParts.join('|'), 'giu'),
    fuzzy: new RegExp(fuzzyParts.join('|'), 'giu'),
  };
});

// Directed-at-someone signals (harassment context) raise medium-insult weight.
const HARASSMENT_CONTEXT = /(انت|أنت|يا\s|you|ya\s|u\s|ur\s|احب|يلعن)/iu;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export function moderateContent(text: string): ModerationResult {
  const result: ModerationResult = {
    blocked: false,
    reasons: [],
    score: 0,
    message: MODERATION_MESSAGE,
  };

  if (!text || !text.trim()) return result;

  const norm = normalizeText(text);
  const directed = HARASSMENT_CONTEXT.test(norm);

  let severeCategory: ModerationCategory | undefined;

  for (const c of COMPILED) {
    c.exact.lastIndex = 0;
    c.fuzzy.lastIndex = 0;
    const matched = c.exact.test(norm) || c.fuzzy.test(norm);
    if (!matched) continue;

    let w = c.weight;
    // A directed medium/insult term is more likely harassment.
    if (directed && c.rule.severity !== 'severe') w += HARASSMENT_BOOST;

    result.score += w;
    result.reasons.push(c.rule.category);

    if (c.rule.severity === 'severe') severeCategory = c.rule.category;
  }

  result.score = Math.round(result.score * 10) / 10;

  if (severeCategory) {
    result.blocked = true;
    result.category = severeCategory;
    result.severity = 'severe';
  } else if (result.score >= BLOCK_THRESHOLD) {
    result.blocked = true;
    result.category = result.reasons[0] as ModerationCategory;
    result.severity = result.score >= SEVERITY_WEIGHT.high ? 'high' : 'medium';
  }

  return result;
}
