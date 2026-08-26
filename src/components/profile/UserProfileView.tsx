import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { UserRole } from '../../types';
import { api } from '../../services/api';
import {
  User,
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
    Loader2
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
  const [isSaved, setIsSaved] = useState<boolean>(false);

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
      {/* Profile Header */}
      <div className="p-6 rounded-3xl bg-[#141721] border border-[#d4af37]/30 shadow-2xl flex flex-col sm:flex-row items-center sm:items-start gap-5">
          <div className="relative">
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="w-24 h-24 rounded-full object-cover border-2 border-[#d4af37] shadow-xl"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-[#181b27] border-2 border-[#d4af37] flex items-center justify-center text-3xl font-bold text-[#d4af37]">
                {user?.name?.charAt(0) || 'U'}
              </div>
            )}

            <label
              htmlFor="profile-avatar-upload"
              className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-[#d4af37] text-black border-2 border-[#141721] flex items-center justify-center shadow-lg cursor-pointer hover:scale-110 transition-transform"
              title="تغيير الصورة الشخصية"
            >
              {isUploadingAvatar ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 stroke-[3]" />
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

            <span className="absolute bottom-0 left-0 w-5 h-5 bg-emerald-500 border-2 border-[#141721] rounded-full" />

          {avatarError && (
            <p className="text-xs text-red-400 text-center sm:text-start">
              {avatarError}
            </p>
          )}
        </div>

        <div className="flex-1 text-center sm:text-start space-y-1">
          <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
            <h2 className="text-2xl font-extrabold text-white">{user?.name}</h2>
            <span
              className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold uppercase ${
                role === 'admin'
                  ? 'bg-red-950/80 text-red-300 border border-red-500/40'
                  : role === 'salon_owner'
                  ? 'bg-amber-950/80 text-amber-300 border border-amber-500/40'
                  : 'bg-sky-950/80 text-sky-300 border border-sky-500/40'
              }`}
            >
              {role === 'admin'
                ? 'مدير النظام (Admin)'
                : role === 'salon_owner'
                ? 'صاحب صالون (Salon Owner)'
                : 'زبون (Customer)'}
            </span>
          </div>

          <p className="text-xs text-slate-400 font-mono" dir="ltr">
            {user?.phone} {user?.email ? `• ${user.email}` : ''}
          </p>

          <p className="text-xs text-slate-500 pt-1">
            عضو في تطبيق حلاقي منذ يناير 2026
          </p>
        </div>

        <button
          onClick={logout}
          className="px-4 py-2 rounded-xl bg-red-950/40 hover:bg-red-900/50 text-red-300 border border-red-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors self-center sm:self-start"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>{t('logout')}</span>
        </button>
      </div>

      {/* Edit Profile Form */}
      <div className="p-6 rounded-3xl bg-[#141721] border border-white/10 space-y-4">
        <h3 className="font-bold text-white text-base flex items-center gap-2">
          <User className="w-4 h-4 text-[#d4af37]" />
          تعديل البيانات الشخصية
        </h3>

        {isSaved && (
          <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>تم حفظ البيانات بنجاح!</span>
          </div>
        )}

        <form onSubmit={handleSaveProfile} className="space-y-3">
          <div>
            <label className="block text-xs text-slate-300 mb-1">الاسم الكامل:</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#181b27] border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[#d4af37]"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-300 mb-1">رقم الهاتف:</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              dir="ltr"
              className="w-full bg-[#181b27] border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[#d4af37] text-start"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-300 mb-1">المحافظة / المدينة المفضلة:</label>
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full bg-[#181b27] border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[#d4af37]"
            >
              <option value="baghdad">بغداد (العاصمة)</option>
              <option value="erbil">أربيل</option>
              <option value="basra">البصرة</option>
              <option value="nasiriyah">الناصرية (ذي قار)</option>
              <option value="najaf">النجف الأشرف</option>
              <option value="karbala">كربلاء المقدسة</option>
              <option value="sulaymaniyah">السليمانية</option>
              <option value="mosul">الموصل (نينوى)</option>
            </select>
          </div>

          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-[#d4af37] text-black font-bold text-xs hover:brightness-110 transition-all"
          >
            حفظ التغييرات
          </button>
        </form>
      </div>

      {/* Language and App Settings */}
      <div className="p-6 rounded-3xl bg-[#141721] border border-white/10 space-y-4">
        <h3 className="font-bold text-white text-base flex items-center gap-2">
          <Globe className="w-4 h-4 text-[#d4af37]" />
          إعدادات اللغة والعرض
        </h3>

        <div className="flex items-center justify-between p-3 rounded-2xl bg-[#181b27] border border-white/5">
          <span className="text-xs text-slate-300">لغة التطبيق:</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLanguage('ar')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                language === 'ar' ? 'bg-[#d4af37] text-black' : 'bg-white/5 text-slate-400'
              }`}
            >
              العربية (RTL)
            </button>
            <button
              onClick={() => setLanguage('en')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                language === 'en' ? 'bg-[#d4af37] text-black' : 'bg-white/5 text-slate-400'
              }`}
            >
              English
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
