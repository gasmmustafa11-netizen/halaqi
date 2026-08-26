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
  AlertCircle
} from 'lucide-react';

export const AuthModal: React.FC = () => {
  const { isAuthModalOpen, closeAuthModal, login, register, isLoading, authError } = useAuth();
  const { t } = useLanguage();

  const [isRegisterMode, setIsRegisterMode] = useState<boolean>(false);
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [role, setRole] = useState<UserRole>('customer');
  const [localError, setLocalError] = useState<string | null>(null);

  if (!isAuthModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (isRegisterMode) {
      if (!name.trim() || !phone.trim()) {
        setLocalError('يرجى ملء جميع الحقول المطلوبة');
        return;
      }
      const res = await register({
        name,
        email: email.trim() || undefined,
        phone,
        password: password || undefined,
        role: role === 'salon_owner' ? 'salon_owner' : 'customer',
      });
      if (!res.success) {
        setLocalError(res.error || 'فشل في إنشاء الحساب');
      }
    } else {
      if (!phone.trim()) {
        setLocalError('يرجى إدخال البريد الإلكتروني أو رقم الهاتف');
        return;
      }
      const res = await login(phone, undefined, password);
      if (!res.success) {
        setLocalError(res.error || 'بيانات تسجيل الدخول غير صحيحة');
      }
    }
  };

  const handleQuickDemo = async (demoRole: UserRole) => {
    setLocalError(null);
    if (demoRole === 'customer') {
      await login('ahmed@halaqi.iq', 'customer', 'Customer@2026!');
    } else if (demoRole === 'salon_owner') {
      await login('wissam@royalbarber.iq', 'salon_owner', 'Owner@Royal2026!');
    } else if (demoRole === 'admin') {
      await login('admin@halaqi.iq', 'admin', 'Admin@Halaqi2026!');
    }
  };

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

        {/* Fast Demo Switcher */}
        <div className="p-3 rounded-2xl bg-[#1A1A1A] border border-[#262626] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-gray-400 font-semibold flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-[#D4AF37]" />
              دخول سريع للأدوار المحمية:
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 text-[11px]">
            <button
              type="button"
              onClick={() => handleQuickDemo('customer')}
              className="py-2 px-2 rounded-xl bg-[#262626] hover:bg-[#D4AF37]/20 text-gray-200 hover:text-[#D4AF37] font-bold transition-all border border-[#333] hover:border-[#D4AF37]/40 flex flex-col items-center gap-0.5"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>زبون</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickDemo('salon_owner')}
              className="py-2 px-2 rounded-xl bg-[#262626] hover:bg-[#D4AF37]/20 text-gray-200 hover:text-[#D4AF37] font-bold transition-all border border-[#333] hover:border-[#D4AF37]/40 flex flex-col items-center gap-0.5"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>صاحب صالون</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickDemo('admin')}
              className="py-2 px-2 rounded-xl bg-[#262626] hover:bg-[#D4AF37]/20 text-gray-200 hover:text-[#D4AF37] font-bold transition-all border border-[#333] hover:border-[#D4AF37]/40 flex flex-col items-center gap-0.5"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>مدير المنصة</span>
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
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
              {t('password')} {isRegisterMode ? '(مطلوبة للحساب المحمي)' : ''}
            </label>
            <div className="flex items-center bg-[#1A1A1A] border border-[#333] rounded-xl px-3 py-2.5">
              <Lock className="w-4 h-4 text-gray-400 me-2 shrink-0" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-transparent text-xs text-white outline-none"
              />
            </div>
          </div>

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
