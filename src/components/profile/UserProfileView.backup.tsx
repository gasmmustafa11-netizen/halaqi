/* PREMIUM_PROFILE_MOTION */
import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { UserRole } from '../../types';
import { api } from '../../services/api';
import {
  User,
  Camera,
  Phone,
  Mail,
  MapPin,
  Shield,
  LogOut,
  Sparkles,
  Globe,
  Bell,
  CheckCircle2,
  Lock,
  Scissors,
  ShieldCheck,
    Plus,
    Loader2,
  Save
} from 'lucide-react';

interface UserProfileViewProps {
  onNavigateToRole?: (role: UserRole) => void;
}

export const UserProfileView: React.FC<UserProfileViewProps> = ({ onNavigateToRole }) => {
  const { user, role, logout, refreshUser } = useAuth();
  const { t, language, setLanguage, isRtl } = useLanguage();

  const [name, setName] = useState<string>(user?.name || '');
  const [phone, setPhone] = useState<string>(user?.phone || '');
  const [city, setCity] = useState<string>(user?.city || 'baghdad');
  const cityLabel: Record<string, string> = {
    baghdad: 'بغداد',
    erbil: 'أربيل',
    basra: 'البصرة',
    nasiriyah: 'الناصرية',
    najaf: 'النجف',
    karbala: 'كربلاء',
    sulaymaniyah: 'السليمانية',
    mosul: 'الموصل',
    hilla: 'الحلة',
    kirkuk: 'كركوك',
  };
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [activeSection, setActiveSection] = useState<'overview' | 'personal' | 'preferences'>('overview');
  const roleLabel =
    role === 'admin'
      ? 'مدير النظام'
      : role === 'salon_owner'
        ? 'صاحب صالون'
        : 'زبون';

  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState('');

  const handleAvatarChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarError('');

    if (!file.type.startsWith('image/')) {
      setAvatarError('يرجى اختيار صورة فقط.');
      e.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setAvatarError('حجم الصورة يجب أن يكون أقل من 5 ميغابايت.');
      e.target.value = '';
      return;
    }

    try {
      setIsUploadingAvatar(true);

      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('تعذر قراءة الصورة'));
        reader.readAsDataURL(file);
      });

      const compressedDataUrl = await new Promise<string>((resolve, reject) => {
        const img = new Image();

        img.onload = () => {
          const maxSize = 1200;
          const scale = Math.min(1, maxSize / Math.max(img.width, img.height));

          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('تعذر تجهيز الصورة'));
            return;
          }

          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          const result = canvas.toDataURL('image/jpeg', 0.8);
          resolve(result);
        };

        img.onerror = () => reject(new Error('تعذر معالجة الصورة'));
        img.src = dataUrl;
      });

      const upload = await api.uploadImage(compressedDataUrl);
      if (!upload.success || !upload.imageUrl) {
        throw new Error(upload.error || 'تعذر رفع الصورة');
      }

      const saved = await api.updateMyAvatar(upload.imageUrl);
      if (!saved.success) {
        throw new Error(saved.error || 'تعذر حفظ الصورة');
      }

      await refreshUser();
    } catch (error: any) {
      console.error('[AVATAR_UI] Failed:', error);
      setAvatarError(error?.message || 'تعذر حفظ الصورة الشخصية.');
    } finally {
      setIsUploadingAvatar(false);
      e.target.value = '';
    }
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-300 pb-16">
      {/* Premium Profile Hero */}
      <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[#10131A] p-6 sm:p-8 shadow-2xl">

        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-[#D4AF37]/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-violet-500/10 blur-3xl pointer-events-none" />

        <div className="relative flex flex-col md:flex-row items-center gap-6">

          <div className="relative shrink-0">
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="w-32 h-32 rounded-[28px] object-cover border border-[#D4AF37]/50 shadow-2xl"
              />
            ) : (
              <div className="w-32 h-32 rounded-[28px] flex items-center justify-center bg-[#181B23] border border-[#D4AF37]/50 text-5xl font-black text-[#D4AF37]">
                {user?.name?.charAt(0) || 'U'}
              </div>
            )}

            <label
              htmlFor="profile-avatar-upload"
              className="absolute -bottom-2 -right-2 w-11 h-11 rounded-2xl bg-[#D4AF37] text-black flex items-center justify-center cursor-pointer shadow-xl hover:scale-110 active:scale-95 transition-all duration-300 ease-out"
            >
              {isUploadingAvatar ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Camera className="w-5 h-5" />
              )}
            </label>

            <input
              id="profile-avatar-upload"
              type="file"
              accept="image/*"
              className="hidden"
              disabled={isUploadingAvatar}
              onChange={handleAvatarChange}
            />

            <span className="absolute -bottom-1 -left-1 w-5 h-5 rounded-full bg-emerald-500 border-4 border-[#10131A]" />
          </div>

          <div className="flex-1 text-center md:text-start min-w-0">

            <div className="flex flex-wrap justify-center md:justify-start gap-2 mb-3">
              <span className="px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/20 text-[#D4AF37] text-[10px] font-bold">
                {role === 'admin'
                  ? 'مدير النظام'
                  : role === 'salon_owner'
                    ? 'صاحب صالون'
                    : 'زبون'}
              </span>

              <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                ● الحساب نشط
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              {user?.name || 'المستخدم'}
            </h1>

            <p className="mt-2 text-sm text-slate-400">
              ملفك الشخصي في <span className="text-[#D4AF37] font-bold">حلاقي</span>
            </p>

            <div className="mt-5 flex flex-wrap justify-center md:justify-start gap-2">

              <div className="px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.07] text-xs text-slate-300">
                📱 <span dir="ltr">{user?.phone || 'لا يوجد'}</span>
              </div>

              {user?.email && (
                <div className="px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.07] text-xs text-slate-300">
                  ✉️ {user.email}
                </div>
              )}

            </div>
          </div>

          <button
            type="button"
            onClick={logout}
            className="px-4 py-2.5 rounded-2xl bg-white/[0.04] border border-white/10 text-slate-400 hover:text-red-300 hover:bg-red-500/10 hover:border-red-500/20 transition-all duration-300 ease-out"
          >
            <LogOut className="w-4 h-4 inline ml-2" />
            تسجيل الخروج
          </button>

        </div>
      </section>

      {/* Premium Navigation */}
      <div className="mt-5 rounded-[24px] border border-white/[0.07] bg-[#10131A] p-2 shadow-xl">
        <div className="flex gap-2 overflow-x-auto">

          <button
            type="button"
            onClick={() => setActiveSection('overview')}
            className={`min-w-[130px] flex-1 rounded-[18px] px-4 py-3 text-xs font-bold transition-all duration-300 ease-out duration-300 ${
              activeSection === 'overview'
                ? 'bg-[#D4AF37] text-black shadow-lg shadow-[#D4AF37]/10'
                : 'text-slate-400 hover:bg-white/[0.04] hover:text-white'
            }`}
          >
            نظرة عامة
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('personal')}
            className={`min-w-[130px] flex-1 rounded-[18px] px-4 py-3 text-xs font-bold transition-all duration-300 ease-out duration-300 ${
              activeSection === 'personal'
                ? 'bg-[#D4AF37] text-black shadow-lg shadow-[#D4AF37]/10'
                : 'text-slate-400 hover:bg-white/[0.04] hover:text-white'
            }`}
          >
            المعلومات الشخصية
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('preferences')}
            className={`min-w-[130px] flex-1 rounded-[18px] px-4 py-3 text-xs font-bold transition-all duration-300 ease-out duration-300 ${
              activeSection === 'preferences'
                ? 'bg-[#D4AF37] text-black shadow-lg shadow-[#D4AF37]/10'
                : 'text-slate-400 hover:bg-white/[0.04] hover:text-white'
            }`}
          >
            التفضيلات
          </button>

        </div>
      </div>

      {/* Premium Overview */}
      <section className="mt-5 space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

          <div className="group rounded-[24px] border border-white/[0.07] bg-[#10131A] p-5 transition-all duration-300 ease-out duration-300 hover:-translate-y-1 hover:border-[#D4AF37]/30 hover:shadow-xl">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#D4AF37]/10">
              <MapPin className="h-5 w-5 text-[#D4AF37]" />
            </div>
            <p className="text-[10px] font-bold text-slate-500">الموقع المفضل</p>
            <p className="mt-1 text-lg font-black text-white">
              {cityLabel[city] || city}
            </p>
          </div>

          <div className="group rounded-[24px] border border-white/[0.07] bg-[#10131A] p-5 transition-all duration-300 ease-out duration-300 hover:-translate-y-1 hover:border-emerald-400/25 hover:shadow-xl">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-400/10">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
            </div>
            <p className="text-[10px] font-bold text-slate-500">حالة الحساب</p>
            <p className="mt-1 text-lg font-black text-white">
              موثّق ونشط
            </p>
          </div>

          <div className="group rounded-[24px] border border-white/[0.07] bg-[#10131A] p-5 transition-all duration-300 ease-out duration-300 hover:-translate-y-1 hover:border-violet-400/25 hover:shadow-xl">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-400/10">
              <Sparkles className="h-5 w-5 text-violet-300" />
            </div>
            <p className="text-[10px] font-bold text-slate-500">نوع الحساب</p>
            <p className="mt-1 text-lg font-black text-white">
              {roleLabel}
            </p>
          </div>

        </div>

        <div className="relative overflow-hidden rounded-[28px] border border-[#D4AF37]/15 bg-gradient-to-br from-[#19150B] via-[#11131A] to-[#10131A] p-6 sm:p-8">

          <div className="absolute -right-20 -top-20 h-48 w-48 rounded-full bg-[#D4AF37]/10 blur-3xl pointer-events-none" />

          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">

            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[#D4AF37]/20 bg-[#D4AF37]/10">
              <Sparkles className="h-6 w-6 text-[#D4AF37]" />
            </div>

            <div className="flex-1">
              <h3 className="text-lg font-black text-white">
                ملفك الشخصي جاهز
              </h3>
              <p className="mt-1 text-xs leading-6 text-slate-400">
                حافظ على معلوماتك محدثة حتى تحصل على تجربة أفضل داخل منصة حلاقي.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setActiveSection('personal')}
              className="w-full rounded-2xl bg-[#D4AF37] px-5 py-3 text-xs font-black text-black transition-all duration-300 ease-out hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] sm:w-auto"
            >
              تعديل الملف
            </button>

          </div>
        </div>

      </section>

      {/* Premium Personal Information */}
      <section className="mt-5 overflow-hidden rounded-[28px] border border-white/[0.07] bg-[#10131A] shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-300">

        <div className="border-b border-white/[0.06] p-5 sm:p-7">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#D4AF37]/10">
              <User className="h-5 w-5 text-[#D4AF37]" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">المعلومات الشخصية</h2>
              <p className="mt-1 text-[11px] text-slate-500">حدّث بيانات حسابك بسهولة</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-5 p-5 sm:p-7">

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">

            <div>
              <label className="mb-2 block text-[11px] font-bold text-slate-400">
                الاسم الكامل
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="اكتب اسمك"
                  className="h-12 w-full rounded-2xl border border-white/[0.07] bg-[#171A22] pr-11 pl-4 text-sm text-white outline-none transition-all duration-300 ease-out placeholder:text-slate-600 focus:border-[#D4AF37]/50 focus:ring-4 focus:ring-[#D4AF37]/[0.06]"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-[11px] font-bold text-slate-400">
                رقم الهاتف
              </label>
              <div className="relative">
                <Phone className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  dir="ltr"
                  placeholder="07xxxxxxxxx"
                  className="h-12 w-full rounded-2xl border border-white/[0.07] bg-[#171A22] pr-11 pl-4 text-start text-sm text-white outline-none transition-all duration-300 ease-out placeholder:text-slate-600 focus:border-[#D4AF37]/50 focus:ring-4 focus:ring-[#D4AF37]/[0.06]"
                />
              </div>
            </div>

          </div>

          <div>
            <label className="mb-2 block text-[11px] font-bold text-slate-400">
              المدينة المفضلة
            </label>
            <div className="relative">
              <MapPin className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#D4AF37]" />
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="h-12 w-full appearance-none rounded-2xl border border-white/[0.07] bg-[#171A22] pr-11 pl-4 text-sm text-white outline-none transition-all duration-300 ease-out focus:border-[#D4AF37]/50 focus:ring-4 focus:ring-[#D4AF37]/[0.06]"
              >
                <option value="baghdad">بغداد</option>
                <option value="erbil">أربيل</option>
                <option value="basra">البصرة</option>
                <option value="nasiriyah">الناصرية</option>
                <option value="najaf">النجف</option>
                <option value="karbala">كربلاء</option>
                <option value="sulaymaniyah">السليمانية</option>
                <option value="mosul">الموصل</option>
              </select>
            </div>
          </div>

          {isSaved && (
            <div className="flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-xs font-bold text-emerald-300 animate-in fade-in">
              <CheckCircle2 className="h-4 w-4" />
              تم حفظ البيانات بنجاح
            </div>
          )}

          <div className="flex justify-end border-t border-white/[0.06] pt-5">
            <button
              type="submit"
              className="flex items-center gap-2 rounded-2xl bg-[#D4AF37] px-6 py-3 text-xs font-black text-black shadow-lg shadow-[#D4AF37]/10 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
            >
              <Save className="h-4 w-4" />
              حفظ التغييرات
            </button>
          </div>

        </form>
      </section>

      {/* Premium Preferences */}
      <section className="mt-5 overflow-hidden rounded-[28px] border border-white/[0.07] bg-[#10131A] shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-300">

        <div className="border-b border-white/[0.06] p-5 sm:p-7">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-400/10">
              <Globe className="h-5 w-5 text-violet-300" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">التفضيلات</h2>
              <p className="mt-1 text-[11px] text-slate-500">
                خصّص تجربة استخدام حلاقي حسب تفضيلاتك
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4 p-5 sm:p-7">

          <div className="flex flex-col gap-4 rounded-[22px] border border-white/[0.06] bg-[#171A22] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-black text-white">لغة التطبيق</p>
              <p className="mt-1 text-[11px] text-slate-500">
                اختر اللغة التي تناسبك
              </p>
            </div>

            <div className="flex w-full rounded-2xl border border-white/[0.06] bg-black/20 p-1 sm:w-auto">
              <button
                type="button"
                onClick={() => setLanguage('ar')}
                className={`flex-1 rounded-xl px-5 py-2.5 text-xs font-black transition-all duration-300 ease-out sm:flex-none ${
                  language === 'ar'
                    ? 'bg-[#D4AF37] text-black shadow-lg shadow-[#D4AF37]/10'
                    : 'text-slate-500 hover:bg-white/[0.04] hover:text-white'
                }`}
              >
                العربية
              </button>

              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`flex-1 rounded-xl px-5 py-2.5 text-xs font-black transition-all duration-300 ease-out sm:flex-none ${
                  language === 'en'
                    ? 'bg-[#D4AF37] text-black shadow-lg shadow-[#D4AF37]/10'
                    : 'text-slate-500 hover:bg-white/[0.04] hover:text-white'
                }`}
              >
                English
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-[22px] border border-[#D4AF37]/10 bg-gradient-to-r from-[#D4AF37]/[0.04] to-transparent p-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#D4AF37]/10">
              <Sparkles className="h-5 w-5 text-[#D4AF37]" />
            </div>

            <div>
              <p className="text-sm font-black text-white">تجربة حلاقي</p>
              <p className="mt-1 text-[11px] leading-5 text-slate-500">
                إعداداتك محفوظة وتطبّق مباشرة على واجهة المنصة.
              </p>
            </div>
          </div>

        </div>
      </section>
    </div>
  );
};
