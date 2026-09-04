import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { UserRole } from '../../types';
import {
  X,
  Phone,
  Lock,
  User,
  ShieldCheck,
  Building2,
  UserCheck,
  Mail,
  AlertCircle,
  KeyRound,
  CheckCircle2,
  Send,
} from 'lucide-react';

type ForgotStep = 1 | 2 | 3; // 1=email, 2=OTP, 3=new password

export const AuthModal: React.FC = () => {
  const {
    isAuthModalOpen, closeAuthModal,
    login, register,
    forgotPassword, verifyOtp, resetPassword,
    isLoading, authError,
  } = useAuth();
  const { t } = useLanguage();

  const [isRegisterMode, setIsRegisterMode] = useState<boolean>(false);
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [role, setRole] = useState<UserRole>('customer');
  const [localError, setLocalError] = useState<string | null>(null);
  const [username, setUsername] = useState<string>('');

  // Forgot password flow
  const [isForgotMode, setIsForgotMode] = useState<boolean>(false);
  const [forgotStep, setForgotStep] = useState<ForgotStep>(1);
  const [resetEmail, setResetEmail] = useState<string>('');
  const [resetOtp, setResetOtp] = useState<string>('');
  const [resetNewPassword, setResetNewPassword] = useState<string>('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState<string>('');
  const [forgotLoading, setForgotLoading] = useState<boolean>(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<boolean>(false);

  if (!isAuthModalOpen) return null;

  const resetForgotState = () => {
    setIsForgotMode(false);
    setForgotStep(1);
    setResetEmail('');
    setResetOtp('');
    setResetNewPassword('');
    setResetConfirmPassword('');
    setForgotLoading(false);
    setForgotError(null);
    setResetSuccess(false);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!phone.trim()) {
      setLocalError('يرجى إدخال البريد الإلكتروني أو رقم الهاتف');
      return;
    }
    const res = await login(phone, undefined, password);
    if (!res.success) {
      setLocalError(res.error || 'بيانات تسجيل الدخول غير صحيحة');
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!name.trim() || !phone.trim()) {
      setLocalError('يرجى ملء جميع الحقول المطلوبة');
      return;
    }
    if (username.trim() && !/^[a-zA-Z0-9_.]{3,30}$/.test(username.trim())) {
      setLocalError('اسم المستخدم يجب أن يتكون من 3 إلى 30 حرفاً (أحرف وأرقام و_ فقط)');
      return;
    }
    if (!password.trim() || password.trim().length < 8) {
      setLocalError('كلمة المرور مطلوبة وأن لا تقل عن 8 أحرف.');
      return;
    }
    if (password !== confirmPassword) {
      setLocalError('تأكيد كلمة المرور غير مطابق.');
      return;
    }
    const res = await register({
      name,
      email: email.trim() || undefined,
      phone,
      password,
      role: role === 'salon_owner' ? 'salon_owner' : 'customer',
      username: username.trim() || undefined,
    });
    if (!res.success) {
      setLocalError(res.error || 'فشل في إنشاء الحساب');
    }
  };

  // Step 1: send OTP
  const handleForgotStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);

    if (!resetEmail.trim() || !resetEmail.includes('@')) {
      setForgotError('يرجى إدخال بريد إلكتروني صحيح.');
      return;
    }

    setForgotLoading(true);
    try {
      const res = await forgotPassword(resetEmail.trim());
      setForgotLoading(false);
      if (res.success) {
        setForgotStep(2);
      } else {
        setForgotError(res.error || 'تعذر إرسال الرمز.');
      }
    } catch {
      setForgotLoading(false);
      setForgotError('حدث خطأ غير متوقع.');
    }
  };

  // Step 2: verify OTP
  const handleForgotStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);

    if (!resetOtp.trim() || resetOtp.trim().length < 6) {
      setForgotError('يرجى إدخال رمز التحقق المكون من 6 أرقام.');
      return;
    }

    setForgotLoading(true);
    try {
      const res = await verifyOtp(resetEmail.trim(), resetOtp.trim());
      setForgotLoading(false);
      if (res.success) {
        setForgotStep(3);
      } else {
        setForgotError(res.error || 'رمز التحقق غير صحيح.');
      }
    } catch {
      setForgotLoading(false);
      setForgotError('حدث خطأ غير متوقع.');
    }
  };

  // Step 3: reset password
  const handleForgotStep3 = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);

    if (!resetNewPassword.trim() || resetNewPassword.trim().length < 8) {
      setForgotError('كلمة المرور مطلوبة وأن لا تقل عن 8 أحرف.');
      return;
    }
    if (resetNewPassword !== resetConfirmPassword) {
      setForgotError('تأكيد كلمة المرور غير مطابق.');
      return;
    }

    setForgotLoading(true);
    try {
      const res = await resetPassword(
        resetEmail.trim(),
        resetOtp.trim(),
        resetNewPassword,
        resetConfirmPassword
      );
      setForgotLoading(false);
      if (res.success) {
        setResetSuccess(true);
      } else {
        setForgotError(res.error || 'تعذر إعادة تعيين كلمة المرور.');
      }
    } catch {
      setForgotLoading(false);
      setForgotError('حدث خطأ غير متوقع.');
    }
  };

  // ──────────────────────────────────────────────
  // FORGOT PASSWORD FLOW
  // ──────────────────────────────────────────────
  if (isForgotMode) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
        <div className="relative w-full max-w-md bg-[#141414] border border-[#262626] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          {/* Close */}
          <button
            onClick={resetForgotState}
            className="absolute top-4 left-4 sm:left-6 p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header */}
          <div className="text-center space-y-1">
            <div className="w-12 h-12 rounded-2xl bg-[#D4AF37]/10 border border-[#D4AF37]/40 flex items-center justify-center text-[#D4AF37] mx-auto font-black text-xl mb-2">
              <KeyRound className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white" style={{ fontFamily: 'Georgia, serif' }}>
              {resetSuccess ? 'تم بنجاح' : 'إعادة تعيين كلمة المرور'}
            </h3>
            {!resetSuccess && (
              <p className="text-xs text-gray-400">
                {forgotStep === 1 && 'أدخل بريدك الإلكتروني لاستلام رمز التحقق.'}
                {forgotStep === 2 && 'أدخل رمز التحقق المرسل إلى بريدك.'}
                {forgotStep === 3 && 'أدخل كلمة المرور الجديدة لحسابك.'}
              </p>
            )}
          </div>

          {/* Step progress indicator */}
          {!resetSuccess && (
            <div className="flex items-center justify-center gap-2 mb-2">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      s < forgotStep
                        ? 'bg-green-600 text-white'
                        : s === forgotStep
                        ? 'bg-[#D4AF37] text-black'
                        : 'bg-[#1A1A1A] text-gray-500 border border-[#333]'
                    }`}
                  >
                    {s < forgotStep ? <CheckCircle2 className="w-4 h-4" /> : s}
                  </div>
                  {s < 3 && <div className={`w-8 h-0.5 ${s < forgotStep ? 'bg-green-600' : 'bg-[#333]'}`} />}
                </div>
              ))}
            </div>
          )}

          {/* Error banner */}
          {forgotError && (
            <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{forgotError}</span>
            </div>
          )}

          {/* Success message after password reset */}
          {resetSuccess && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-green-950/60 border border-green-500/40 text-green-200 text-sm flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
                <span>تم تحديث كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول بالكلمة الجديدة.</span>
              </div>
              <button
                onClick={() => {
                  resetForgotState();
                  setPhone(resetEmail);
                }}
                className="w-full py-3 rounded-xl bg-[#D4AF37] hover:bg-[#c49f2e] text-black font-black text-xs shadow-lg shadow-[#D4AF37]/20 transition-all"
              >
                تسجيل الدخول
              </button>
            </div>
          )}

          {/* Step 1: Email */}
          {!resetSuccess && forgotStep === 1 && (
            <form onSubmit={handleForgotStep1} className="space-y-3">
              <div>
                <label className="block text-xs text-gray-300 mb-1">البريد الإلكتروني *</label>
                <div className="flex items-center bg-[#1A1A1A] border border-[#333] rounded-xl px-3 py-2.5">
                  <Mail className="w-4 h-4 text-gray-400 me-2 shrink-0" />
                  <input
                    type="email"
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="أدخل بريدك الإلكتروني"
                    dir="ltr"
                    className="w-full bg-transparent text-xs text-white outline-none text-start font-mono"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={forgotLoading}
                className="w-full py-3 rounded-xl bg-[#D4AF37] hover:bg-[#c49f2e] text-black font-black text-xs shadow-lg shadow-[#D4AF37]/20 transition-all flex items-center justify-center gap-2"
              >
                {forgotLoading ? (
                  <span>جاري الإرسال...</span>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>إرسال رمز التحقق</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={resetForgotState}
                className="w-full text-center text-xs text-gray-400 hover:text-white transition-colors mt-1"
              >
                العودة لتسجيل الدخول
              </button>
            </form>
          )}

          {/* Step 2: OTP */}
          {!resetSuccess && forgotStep === 2 && (
            <form onSubmit={handleForgotStep2} className="space-y-3">
              <div>
                <label className="block text-xs text-gray-300 mb-1">رمز التحقق *</label>
                <div className="flex items-center bg-[#1A1A1A] border border-[#333] rounded-xl px-3 py-2.5">
                  <KeyRound className="w-4 h-4 text-gray-400 me-2 shrink-0" />
                  <input
                    type="text"
                    required
                    value={resetOtp}
                    onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    maxLength={6}
                    dir="ltr"
                    className="w-full bg-transparent text-xs text-white outline-none text-start font-mono tracking-[6px]"
                    autoComplete="one-time-code"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={forgotLoading}
                className="w-full py-3 rounded-xl bg-[#D4AF37] hover:bg-[#c49f2e] text-black font-black text-xs shadow-lg shadow-[#D4AF37]/20 transition-all flex items-center justify-center gap-2"
              >
                {forgotLoading ? (
                  <span>جاري التحقق...</span>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>تحقق من الرمز</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => { setForgotStep(1); setResetOtp(''); setForgotError(null); }}
                className="w-full text-center text-xs text-gray-400 hover:text-white transition-colors mt-1"
              >
                العودة وإدخال بريد آخر
              </button>
            </form>
          )}

          {/* Step 3: New Password */}
          {!resetSuccess && forgotStep === 3 && (
            <form onSubmit={handleForgotStep3} className="space-y-3">
              <div>
                <label className="block text-xs text-gray-300 mb-1">كلمة المرور الجديدة * (8 أحرف على الأقل)</label>
                <div className="flex items-center bg-[#1A1A1A] border border-[#333] rounded-xl px-3 py-2.5">
                  <Lock className="w-4 h-4 text-gray-400 me-2 shrink-0" />
                  <input
                    type="password"
                    required
                    value={resetNewPassword}
                    onChange={(e) => setResetNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-transparent text-xs text-white outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-300 mb-1">تأكيد كلمة المرور الجديدة *</label>
                <div className="flex items-center bg-[#1A1A1A] border border-[#333] rounded-xl px-3 py-2.5">
                  <Lock className="w-4 h-4 text-gray-400 me-2 shrink-0" />
                  <input
                    type="password"
                    required
                    value={resetConfirmPassword}
                    onChange={(e) => setResetConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-transparent text-xs text-white outline-none"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={forgotLoading}
                className="w-full py-3 rounded-xl bg-[#D4AF37] hover:bg-[#c49f2e] text-black font-black text-xs shadow-lg shadow-[#D4AF37]/20 transition-all flex items-center justify-center gap-2"
              >
                {forgotLoading ? (
                  <span>جاري التحديث...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>تحديث كلمة المرور</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => { setForgotStep(2); setResetNewPassword(''); setResetConfirmPassword(''); setForgotError(null); }}
                className="w-full text-center text-xs text-gray-400 hover:text-white transition-colors mt-1"
              >
                العودة لإدخال رمز التحقق
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────
  // NORMAL LOGIN / REGISTER FLOW
  // ──────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-[#141414] border border-[#262626] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        {/* Close Button */}
        <button
          onClick={closeAuthModal}
          className="absolute top-4 left-4 sm:left-6 p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center space-y-1">
          <div className="w-12 h-12 rounded-2xl bg-[#D4AF37]/10 border border-[#D4AF37]/40 flex items-center justify-center text-[#D4AF37] mx-auto font-black text-xl mb-2">
            ح
          </div>
          <h3 className="text-xl font-bold text-white" style={{ fontFamily: 'Georgia, serif' }}>
            {isRegisterMode ? 'إنشاء حساب جديد آمن' : 'تسجيل الدخول إلى حلاقي'}
          </h3>
          <p className="text-xs text-gray-400">
            {isRegisterMode
              ? 'سجل حسابك للتمتع بحجز المواعيد وإدارة الصالونات بأمان كامل'
              : 'أدخل بريدك أو رقم هاتفك للوصول لحسابك وصلاحياتك'}
          </p>
        </div>

        {(localError || authError) && (
          <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{localError || authError}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={isRegisterMode ? handleRegisterSubmit : handleLoginSubmit} className="space-y-3">
          {isRegisterMode && (
            <>
              <div>
                <label className="block text-xs text-gray-300 mb-1">{t('fullName')} *</label>
                <div className="flex items-center bg-[#1A1A1A] border border-[#333] rounded-xl px-3 py-2.5">
                  <User className="w-4 h-4 text-gray-400 me-2 shrink-0" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="مثال: أحمد الموسوي"
                    className="w-full bg-transparent text-xs text-white outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-300 mb-1">نوع الحساب *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole('customer')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      role === 'customer'
                        ? 'bg-[#D4AF37] text-black border-[#D4AF37]'
                        : 'bg-[#1A1A1A] text-gray-300 border-[#333]'
                    }`}
                  >
                    زبون
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('salon_owner')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      role === 'salon_owner'
                        ? 'bg-[#D4AF37] text-black border-[#D4AF37]'
                        : 'bg-[#1A1A1A] text-gray-300 border-[#333]'
                    }`}
                  >
                    صاحب صالون
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-300 mb-1">اسم المستخدم (اختياري)</label>
                <div className="flex items-center bg-[#1A1A1A] border border-[#333] rounded-xl px-3 py-2.5">
                  <UserCheck className="w-4 h-4 text-gray-400 me-2 shrink-0" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="مثال: ahmed_2026"
                    className="w-full bg-transparent text-xs text-white outline-none"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs text-gray-300 mb-1">
              {isRegisterMode ? 'رقم الهاتف *' : 'البريد الإلكتروني أو رقم الهاتف *'}
            </label>
            <div className="flex items-center bg-[#1A1A1A] border border-[#333] rounded-xl px-3 py-2.5">
              {isRegisterMode ? (
                <Phone className="w-4 h-4 text-gray-400 me-2 shrink-0" />
              ) : (
                <Mail className="w-4 h-4 text-gray-400 me-2 shrink-0" />
              )}
              <input
                type="text"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={isRegisterMode ? "+964 780 123 4567" : "admin@halaqi.iq أو +964780..."}
                dir="ltr"
                className="w-full bg-transparent text-xs text-white outline-none text-start font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-300 mb-1">
              {t('password')} {isRegisterMode ? '(8 أحرف على الأقل)' : ''}
            </label>
            <div className="flex items-center bg-[#1A1A1A] border border-[#333] rounded-xl px-3 py-2.5">
              <Lock className="w-4 h-4 text-gray-400 me-2 shrink-0" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-transparent text-xs text-white outline-none"
              />
            </div>
            {/* Forgot password link — only in login mode */}
            {!isRegisterMode && (
              <button
                type="button"
                onClick={() => { setIsForgotMode(true); setForgotError(null); }}
                className="mt-1.5 text-xs text-[#D4AF37] hover:underline text-end block w-full"
              >
                نسيت كلمة المرور؟
              </button>
            )}
          </div>

          {isRegisterMode && (
            <div>
              <label className="block text-xs text-gray-300 mb-1">تأكيد كلمة المرور *</label>
              <div className="flex items-center bg-[#1A1A1A] border border-[#333] rounded-xl px-3 py-2.5">
                <Lock className="w-4 h-4 text-gray-400 me-2 shrink-0" />
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-transparent text-xs text-white outline-none"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 rounded-xl bg-[#D4AF37] hover:bg-[#c49f2e] text-black font-black text-xs shadow-lg shadow-[#D4AF37]/20 transition-all flex items-center justify-center gap-2 mt-4"
          >
            {isLoading ? (
              <span>جاري التحقق والتشفير...</span>
            ) : (
              <span>{isRegisterMode ? 'إنشاء حساب جديد' : 'تسجيل الدخول'}</span>
            )}
          </button>
        </form>

        {/* Switch Mode Toggle */}
        <div className="text-center text-xs text-gray-400">
          {isRegisterMode ? (
            <span>
              لديك حساب بالفعل؟{' '}
              <button
                onClick={() => setIsRegisterMode(false)}
                className="text-[#D4AF37] font-bold hover:underline"
              >
                تسجيل الدخول
              </button>
            </span>
          ) : (
            <span>
              ليس لديك حساب؟{' '}
              <button
                onClick={() => setIsRegisterMode(true)}
                className="text-[#D4AF37] font-bold hover:underline"
              >
                إنشاء حساب جديد
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
