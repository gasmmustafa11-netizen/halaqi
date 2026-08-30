import React, { useRef, useState } from 'react';
import { ShieldCheck, UploadCloud, X, FileText, Check } from 'lucide-react';

import { useLanguage } from '../../context/LanguageContext';

/**
 * Halaqi Verified Subscription
 * ------------------------------------------------------------------
 * A self-contained verification application modal that lives inside the
 * existing Halaqi Settings experience.
 *
 * IMPORTANT (intentionally disabled service):
 *  - The submission button is always disabled and shows "قريباً".
 *  - Clicking it performs NO action: no submit, no save, no charge,
 *    no verification request is created.
 *  - There is NO payment gateway and NO verified badge is granted.
 *  - No fake approval or verification logic exists.
 *
 * This structure is prepared so real subscriptions can be activated later:
 *   Personal Account = $5 / month
 *   Salon            = $10 / month
 */

export type VerifiedAccountType = 'personal' | 'salon';

export const VERIFIED_SUBSCRIPTION_PRICING: Record<
  VerifiedAccountType,
  { monthlyUsd: number; labelAr: string; labelEn: string }
> = {
  personal: {
    monthlyUsd: 5,
    labelAr: 'حساب شخصي',
    labelEn: 'Personal Account',
  },
  salon: {
    monthlyUsd: 10,
    labelAr: 'صالون',
    labelEn: 'Salon',
  },
};

interface HalaqiVerifiedSubscriptionProps {
  open: boolean;
  onClose: () => void;
}

const HalaqiVerifiedSubscription: React.FC<HalaqiVerifiedSubscriptionProps> = ({
  open,
  onClose,
}) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';

  const [accountType, setAccountType] = useState<VerifiedAccountType>('personal');

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [reason, setReason] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
  };

  // Intentionally a no-op. The service is not available yet.
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Service unavailable — do nothing (no submit, save, charge, or request).
  };

  const inputClass =
    'w-full rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3 text-sm font-medium text-white outline-none transition-all placeholder:text-slate-600 focus:border-[#D4AF37]/50 focus:bg-black/30 focus:ring-2 focus:ring-[#D4AF37]/10';

  return (
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center bg-black/80 backdrop-blur-md px-4 py-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        dir={isRtl ? 'rtl' : 'ltr'}
        className="relative flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-[30px] border border-white/10 bg-[#0D0F14] shadow-[0_30px_100px_rgba(0,0,0,0.72)]"
      >
        {/* Ambient luxury glow */}
        <div className="pointer-events-none absolute -top-24 -right-24 h-56 w-56 rounded-full bg-[#D4AF37]/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-24 h-64 w-64 rounded-full bg-violet-500/[0.06] blur-3xl" />

        {/* Header */}
        <div className="relative border-b border-white/[0.07] px-6 py-6 sm:px-7">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#D4AF37]/20 bg-[#D4AF37]/10">
                <ShieldCheck className="h-5 w-5 text-[#D4AF37]" />
              </div>

              <div className="min-w-0">
                <h2 className="text-xl font-black tracking-tight text-white">
                  {isRtl ? 'اشتراك حلاقي الموثّق' : 'Halaqi Verified Subscription'}
                </h2>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {isRtl
                    ? 'قدّم طلب توثيق حسابك في حلاقي'
                    : 'Apply for account verification on Halaqi'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label={isRtl ? 'إغلاق' : 'Close'}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-400 transition-all hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable form body */}
        <div className="relative flex-1 space-y-5 overflow-y-auto p-5 sm:p-7">
          {/* Unavailable banner */}
          <div className="flex items-start gap-3 rounded-2xl border border-[#D4AF37]/20 bg-[#D4AF37]/[0.06] p-4">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#D4AF37]" />
            <p className="text-[12px] leading-6 text-[#E9D9A6]">
              {isRtl
                ? 'خدمة اشتراك حلاقي الموثّق ستتوفّر قريباً. يمكنك الاطلاع على النموذج، لكن الإرسال معطّل في الوقت الحالي.'
                : 'Halaqi Verified Subscription will be available soon. You can review the form, but submission is currently disabled.'}
            </p>
          </div>

          {/* Account type selection */}
          <div>
            <p className="mb-3 text-sm font-bold text-white">
              {isRtl ? 'نوع الحساب' : 'Account type'}
            </p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(['personal', 'salon'] as VerifiedAccountType[]).map((type) => {
                const active = accountType === type;
                const price = VERIFIED_SUBSCRIPTION_PRICING[type];
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setAccountType(type)}
                    className={`group flex flex-col items-start gap-2 rounded-2xl border p-4 text-right transition-all ${
                      active
                        ? 'border-[#D4AF37]/50 bg-[#D4AF37]/[0.07]'
                        : 'border-white/[0.07] bg-white/[0.025] hover:border-[#D4AF37]/25 hover:bg-[#D4AF37]/[0.05]'
                    }`}
                  >
                    <div className="flex w-full items-center justify-between gap-2">
                      <span className="text-sm font-bold text-white">
                        {isRtl ? price.labelAr : price.labelEn}
                      </span>
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                          active
                            ? 'border-[#D4AF37] bg-[#D4AF37] text-black'
                            : 'border-white/20 bg-transparent text-transparent'
                        }`}
                      >
                        <Check size={12} strokeWidth={3} />
                      </span>
                    </div>

                    <span className="text-[12px] font-semibold text-[#D4AF37]">
                      ${price.monthlyUsd}
                      <span className="text-slate-500">
                        {' '}
                        {isRtl ? '/ شهر' : '/ month'}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Full Name */}
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 transition-all focus-within:border-[#D4AF37]/30 focus-within:bg-white/[0.035]">
            <label
              htmlFor="verified-fullname"
              className="mb-2 block text-sm font-bold text-white"
            >
              {isRtl ? 'الاسم الكامل' : 'Full Name'}
            </label>
            <input
              id="verified-fullname"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={isRtl ? 'اكتب اسمك الكامل' : 'Enter your full name'}
              className={inputClass}
            />
          </div>

          {/* Username / Account ID */}
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 transition-all focus-within:border-[#D4AF37]/30 focus-within:bg-white/[0.035]">
            <label
              htmlFor="verified-username"
              className="mb-2 block text-sm font-bold text-white"
            >
              {isRtl ? 'اسم المستخدم / معرّف الحساب' : 'Username / Account ID'}
            </label>
            <input
              id="verified-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              dir="ltr"
              placeholder="@username"
              className={inputClass}
            />
          </div>

          {/* Identity / document upload */}
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 transition-all focus-within:border-[#D4AF37]/30 focus-within:bg-white/[0.035]">
            <label className="mb-2 block text-sm font-bold text-white">
              {isRtl ? 'إثبات الهوية / المستند' : 'Identity / document'}
            </label>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-black/20 px-4 py-6 text-center transition-all hover:border-[#D4AF37]/40 hover:bg-black/30"
            >
              {selectedFile ? (
                <>
                  <FileText className="h-6 w-6 text-[#D4AF37]" />
                  <span className="max-w-full truncate text-sm font-medium text-white">
                    {selectedFile.name}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {isRtl ? 'اضغط لتغيير المستند' : 'Tap to change the document'}
                  </span>
                </>
              ) : (
                <>
                  <UploadCloud className="h-6 w-6 text-slate-400" />
                  <span className="text-sm font-medium text-slate-300">
                    {isRtl ? 'ارفع صورة من الهوية أو المستند' : 'Upload identity or document'}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {isRtl ? 'PDF، JPG، PNG' : 'PDF, JPG, PNG'}
                  </span>
                </>
              )}
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Reason for requesting verification */}
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 transition-all focus-within:border-[#D4AF37]/30 focus-within:bg-white/[0.035]">
            <label
              htmlFor="verified-reason"
              className="mb-2 block text-sm font-bold text-white"
            >
              {isRtl ? 'سبب طلب التوثيق' : 'Reason for requesting verification'}
            </label>
            <textarea
              id="verified-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder={
                isRtl
                  ? 'اشرح لماذا ترغب في توثيق حسابك'
                  : 'Explain why you want your account verified'
              }
              className={`${inputClass} resize-none`}
            />
          </div>

          {/* Additional information */}
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 transition-all focus-within:border-[#D4AF37]/30 focus-within:bg-white/[0.035]">
            <label
              htmlFor="verified-additional"
              className="mb-2 block text-sm font-bold text-white"
            >
              {isRtl ? 'معلومات إضافية' : 'Additional information'}
            </label>
            <textarea
              id="verified-additional"
              value={additionalInfo}
              onChange={(e) => setAdditionalInfo(e.target.value)}
              rows={3}
              placeholder={
                isRtl
                  ? 'أي تفاصيل إضافية تدعم طلبك (اختياري)'
                  : 'Any extra details supporting your request (optional)'
              }
              className={`${inputClass} resize-none`}
            />
          </div>

          {/* Disabled submit — always shows "قريباً", performs no action */}
          <button
            type="button"
            disabled
            onClick={handleSubmit}
            className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-sm font-black text-slate-500 opacity-70"
          >
            {isRtl ? 'قريباً' : 'قريباً'}
          </button>

          <p className="text-center text-[11px] leading-5 text-slate-600">
            {isRtl
              ? 'هلاقي · خدمة الاشتراك الموثّق قريباً'
              : 'Halaqi · Verified Subscription coming soon'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default HalaqiVerifiedSubscription;
