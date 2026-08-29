import React, { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { api } from '../../services/api';
import { ModerationContentType, ModerationCategory } from '../../types';
import { Flag, X, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';

const REASONS: { value: ModerationCategory; ar: string; en: string }[] = [
  { value: 'hate_sectarian', ar: 'كراهية أو طائفية', en: 'Hate / sectarian' },
  { value: 'incitement_violence', ar: 'تحريض على العنف', en: 'Incitement to violence' },
  { value: 'threat_violence', ar: 'تهديد وعنف', en: 'Threat / violence' },
  { value: 'harassment_bullying', ar: 'تنمر أو تحرش', en: 'Harassment / bullying' },
  { value: 'sexual_inappropriate', ar: 'محتوى جنسي', en: 'Sexual / inappropriate' },
  { value: 'scam_fraud', ar: 'احتيال أو خداع', en: 'Scam / fraud' },
  { value: 'spam', ar: 'سبام', en: 'Spam' },
  { value: 'impersonation', ar: 'انتحال شخصية', en: 'Impersonation' },
  { value: 'illegal_dangerous', ar: 'محتوى غير قانوني', en: 'Illegal / dangerous' },
  { value: 'doxxing', ar: 'نشر معلومات حساسة', en: 'Doxxing' },
  { value: 'policy_violation', ar: 'مخالفة سياسات حلاقي', en: 'Policy violation' },
  { value: 'other', ar: 'أخرى', en: 'Other' },
];

const ReportContentButton: React.FC<{
  contentType: ModerationContentType;
  contentId: string;
  text?: string;
  asMenuItem?: boolean;
  onTrigger?: () => void;
}> = ({ contentType, contentId, text, asMenuItem, onTrigger }) => {
  const { language, isRtl } = useLanguage();
  const ar = language === 'ar';
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ModerationCategory | ''>('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setReason('');
    setDetails('');
    setError('');
    setDone(false);
  };

  const submit = async () => {
    if (!reason) {
      setError(ar ? 'الرجاء اختيار سبب.' : 'Please choose a reason.');
      return;
    }
    setSubmitting(true);
    const res = await api.createContentReport({ contentType, contentId, reason, details: details || undefined });
    setSubmitting(false);
    if (res.success) {
      setDone(true);
    } else {
      setError(res.error || (ar ? 'تعذر إرسال البلاغ.' : 'Could not send the report.'));
    }
  };

  const trigger = () => {
    onTrigger?.();
    setOpen(true);
  };

  if (asMenuItem) {
    return (
      <>
        <button
          type="button"
          role="menuitem"
          onClick={trigger}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-amber-300 transition-colors hover:bg-white/[0.08] active:bg-white/[0.10]"
        >
          <Flag className="h-[18px] w-[18px]" />
          {ar ? 'إبلاغ' : 'Report'}
        </button>
        {open && (
          <ReportModal
            ar={ar}
            isRtl={isRtl}
            done={done}
            reason={reason}
            details={details}
            submitting={submitting}
            error={error}
            setReason={setReason}
            setDetails={setDetails}
            submit={submit}
            onClose={() => { setOpen(false); reset(); }}
          />
        )}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={trigger}
        className="flex flex-col items-center gap-1 rounded-full bg-black/30 p-2 text-white backdrop-blur-xl transition active:scale-90"
        aria-label={ar ? 'إبلاغ' : 'Report'}
      >
        <Flag className="h-6 w-6" />
        <span className="text-[11px] font-bold">{ar ? 'بلاغ' : 'Report'}</span>
      </button>
      {open && (
        <ReportModal
          ar={ar}
          isRtl={isRtl}
          done={done}
          reason={reason}
          details={details}
          submitting={submitting}
          error={error}
          setReason={setReason}
          setDetails={setDetails}
          submit={submit}
          onClose={() => { setOpen(false); reset(); }}
        />
      )}
    </>
  );
};

const ReportModal: React.FC<{
  ar: boolean;
  isRtl: boolean;
  done: boolean;
  reason: ModerationCategory | '';
  details: string;
  submitting: boolean;
  error: string;
  setReason: (r: ModerationCategory) => void;
  setDetails: (d: string) => void;
  submit: () => void;
  onClose: () => void;
}> = ({ ar, isRtl, done, reason, details, submitting, error, setReason, setDetails, submit, onClose }) => (
  <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 p-4 sm:items-center" onClick={onClose}>
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="w-full max-w-md overflow-hidden rounded-[24px] border border-white/[0.12] bg-[#0D0F14] p-4 shadow-[0_8px_32px_rgba(0,0,0,0.6)] ring-1 ring-white/[0.05] backdrop-blur-2xl"
      onClick={(e) => e.stopPropagation()}
    >
      {done ? (
        <div className="space-y-3 py-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15">
            <Flag className="h-6 w-6 text-emerald-300" />
          </div>
          <p className="text-sm font-bold text-white">{ar ? 'تم إرسال بلاغك' : 'Your report was sent'}</p>
          <p className="text-xs text-slate-400">{ar ? 'سيتمت مراجعته بواسطة نظام الذكاء الاصطناعي أو فريق الدعم.' : 'It will be reviewed by the AI system or our team.'}</p>
          <button onClick={onClose} className="mt-2 rounded-xl bg-[#D4AF37] px-5 py-2 text-sm font-bold text-black">
            {ar ? 'حسنًا' : 'OK'}
          </button>
        </div>
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-black text-white">{ar ? 'الإبلاغ عن المحتوى' : 'Report content'}</h3>
            <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-slate-300">
              <X size={16} />
            </button>
          </div>

          <p className="mb-2 text-xs font-bold text-slate-400">{ar ? 'سبب البلاغ' : 'Reason'}</p>
          <div className="grid max-h-56 grid-cols-1 gap-1.5 overflow-y-auto scrollbar-hide sm:grid-cols-2">
            {REASONS.map((r) => (
              <button
                key={r.value}
                onClick={() => setReason(r.value)}
                className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${
                  reason === r.value ? 'border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#D4AF37]' : 'border-white/10 text-slate-300 hover:text-white'
                }`}
              >
                {ar ? r.ar : r.en}
              </button>
            ))}
          </div>

          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            rows={2}
            placeholder={ar ? 'تفاصيل إضافية (اختياري)' : 'Additional details (optional)'}
            className="mt-3 w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-[#D4AF37]/40"
          />

          {error && <p className="mt-1 text-xs text-red-400">{error}</p>}

          <div className="mt-3 flex gap-2">
            <button
              onClick={submit}
              disabled={submitting}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#D4AF37] px-4 py-2.5 text-sm font-bold text-black transition hover:bg-[#e6c049] disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flag size={15} />}
              {ar ? 'إرسال البلاغ' : 'Send report'}
            </button>
            <button onClick={onClose} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-slate-400 transition hover:text-white">
              {ar ? 'إلغاء' : 'Cancel'}
            </button>
          </div>
        </>
      )}
    </div>
  </div>
);

export default ReportContentButton;
