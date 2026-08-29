import { GoogleGenAI } from '@google/genai';
import { moderateContent } from './moderation';
import {
  ModerationCategory,
  ModerationDecision,
  ModerationAction,
  ModerationSeverity,
} from '../types';

export interface AiModerationInput {
  text?: string;
  imageUrl?: string; // Provided for context; not fetched by the model here.
  contentType: string;
  reportReason?: string;
}

export interface AiModerationResult {
  decision: ModerationDecision; // violation | clean | escalate
  detectedCategories: ModerationCategory[];
  severity: ModerationSeverity;
  confidence: number; // 0..1
  confidenceScores: Record<string, number>;
  action: ModerationAction;
  warnUser: boolean;
  reason: string;
  model: string;
}

const SEVERE_CATEGORIES = new Set<ModerationCategory>([
  'hate_sectarian',
  'incitement_violence',
  'threat_violence',
  'harassment_bullying',
  'sexual_inappropriate',
  'illegal_dangerous',
  'doxxing',
]);

const CATEGORY_TAXONOMY: ModerationCategory[] = [
  'hate_sectarian',
  'incitement_violence',
  'threat_violence',
  'harassment_bullying',
  'sexual_inappropriate',
  'scam_fraud',
  'spam',
  'impersonation',
  'illegal_dangerous',
  'doxxing',
  'policy_violation',
  'other',
];

function isValidCategory(c: string): c is ModerationCategory {
  return (CATEGORY_TAXONOMY as string[]).includes(c);
}

function escapeForPrompt(s: string): string {
  return s.replace(/"/g, "'").slice(0, 4000);
}

function buildPrompt(input: AiModerationInput, localBlocked: boolean): string {
  const hasImage = input.imageUrl ? 'نعم (صورة مرفقة — لا يمكن للنموذج فحصها هنا، اعتمد على النص والسياق)' : 'لا';
  return `أنت نظام ذكي لإدارة المحتوى في تطبيق اجتماعي عراقي اسمه "حلاقي".
مهمتك: تحليل بلاغ مستخدم حول محتوى، وتحديد إن كان المحتوى مخالفًا أم لا بناءً على المعنى والسياق، وليس فقط الكلمات الممنوعة.

الفئات المسموحة (استخدم هذه القيم تمامًا):
${CATEGORY_TAXONOMY.join(', ')}

قواعد اتخاذ القرار:
- "violation": المحتوى مخالف بوضوح.
- "clean": المحتوى سليم ولا مخالفة.
- "escalate": غير متأكد أو يحتاج مراجعة بشرية.

البيانات:
- نوع المحتوى: ${input.contentType}
- سبب البلاغ من المستخدم: ${input.reportReason || 'غير محدد'}
- هل يحتوي المحتوى على صورة: ${hasImage}
- نص المحتوى: """${escapeForPrompt(input.text || '')}"""

ملاحظة: فلتر النص المحلي ${localBlocked ? 'رصد محتوى مسيئًا' : 'لم يرصد محتوى مسيئًا'}.

أعد استجابة JSON فقط بالشكل التالي (بدون نص خارج الأقواس):
{
  "decision": "violation" | "clean" | "escalate",
  "categories": ["..."],
  "severity": "low" | "medium" | "high",
  "confidence": 0.0 إلى 1.0,
  "reason": "شرح موجز وموضوعي بالعربية للقرار"
}`;
}

function extractJson(raw: string): any | null {
  try {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end === -1) return null;
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

function localFallback(local: ReturnType<typeof moderateContent>): AiModerationResult {
  // No AI provider available: only act with high certainty on local profanity,
  // otherwise escalate to a human (safe default — never silently "clean").
  if (local.blocked) {
    const severe = local.severity === 'severe';
    const categories: ModerationCategory[] = severe ? ['harassment_bullying'] : ['policy_violation'];
    return {
      decision: 'violation',
      detectedCategories: categories,
      severity: severe ? 'high' : 'medium',
      confidence: severe ? 0.92 : 0.6,
      confidenceScores: { [categories[0]]: severe ? 0.92 : 0.6 },
      action: 'hide_content',
      warnUser: severe,
      reason: 'رصد المحتوى فلترًا محليًا للمحتوى المسيء (بدون ذكاء اصطناعي).',
      model: 'local-moderateContent',
    };
  }
  return {
    decision: 'escalate',
    detectedCategories: [],
    severity: 'low',
    confidence: 0.3,
    confidenceScores: {},
    action: 'escalate_to_admin',
    warnUser: false,
    reason: 'لا يتوفر مزود ذكاء اصطناعي؛ تم تحويل البلاغ للمراجعة اليدوية.',
    model: 'local-moderateContent',
  };
}

function applyDecisionEngine(parsed: any, local: ReturnType<typeof moderateContent>): AiModerationResult {
  let decision = String(parsed.decision || 'escalate') as ModerationDecision;
  const rawCats = Array.isArray(parsed.categories) ? parsed.categories.map(String) : [];
  const detectedCategories = rawCats.filter(isValidCategory);
  let severity = (['low', 'medium', 'high'].includes(parsed.severity) ? parsed.severity : 'medium') as ModerationSeverity;
  let confidence = typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5;

  // Local pre-filter strongly agrees on severe abuse → force high-confidence violation.
  if (local.blocked && local.severity === 'severe' && decision !== 'violation') {
    decision = 'violation';
    severity = 'high';
    confidence = Math.max(confidence, 0.95);
    if (!detectedCategories.length) detectedCategories.push('harassment_bullying');
  }

  const highConf = confidence >= 0.8;
  const confidenceScores: Record<string, number> = {};
  for (const c of detectedCategories) confidenceScores[c] = confidence;

  let action: ModerationAction = 'escalate_to_admin';
  let warnUser = false;

  if (decision === 'violation') {
    if (highConf && severity === 'high') {
      action = 'hide_content';
      warnUser = detectedCategories.some((c) => SEVERE_CATEGORIES.has(c));
    } else {
      decision = 'escalate';
      action = 'escalate_to_admin';
    }
  } else if (decision === 'clean') {
    if (highConf) {
      action = 'keep_content';
    } else {
      decision = 'escalate';
      action = 'escalate_to_admin';
    }
  } else {
    action = 'escalate_to_admin';
  }

  return {
    decision,
    detectedCategories,
    severity,
    confidence,
    confidenceScores,
    action,
    warnUser,
    reason: typeof parsed.reason === 'string' ? parsed.reason.slice(0, 1000) : 'تعذر تفسير القرار.',
    model: 'gemini-2.0-flash',
  };
}

export async function analyzeContent(input: AiModerationInput): Promise<AiModerationResult> {
  const text = (input.text || '').trim();
  const local = moderateContent(text);
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return localFallback(local);
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = buildPrompt(input, local.blocked);
    const result: any = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
    });
    const raw =
      result?.text ||
      result?.candidates?.[0]?.content?.parts?.[0]?.text ||
      '';
    const parsed = extractJson(raw);
    if (!parsed) {
      return {
        decision: 'escalate',
        detectedCategories: [],
        severity: 'low',
        confidence: 0.4,
        confidenceScores: {},
        action: 'escalate_to_admin',
        warnUser: false,
        reason: 'تعذر تحليل استجابة الذكاء الاصطناعي؛ تم التحويل للمراجعة اليدوية.',
        model: 'gemini-2.0-flash',
      };
    }
    return applyDecisionEngine(parsed, local);
  } catch (err: any) {
    // Never log secrets; only a safe message.
    console.error('[AI MODERATION ERROR]', err?.message || 'unknown');
    return {
      decision: 'escalate',
      detectedCategories: [],
      severity: 'low',
      confidence: 0.4,
      confidenceScores: {},
      action: 'escalate_to_admin',
      warnUser: false,
      reason: 'فشل تحليل الذكاء الاصطناعي؛ تم التحويل للمراجعة اليدوية.',
      model: 'gemini-2.0-flash',
    };
  }
}
