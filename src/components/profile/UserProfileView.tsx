import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { UserRole } from '../../types';
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
  ShieldCheck
} from 'lucide-react';

interface UserProfileViewProps {
  onNavigateToRole?: (role: UserRole) => void;
}

export const UserProfileView: React.FC<UserProfileViewProps> = ({ onNavigateToRole }) => {
  const { user, role, logout, switchRoleDemo } = useAuth();
  const { t, language, setLanguage, isRtl } = useLanguage();

  const [name, setName] = useState<string>(user?.name || '');
  const [phone, setPhone] = useState<string>(user?.phone || '');
  const [city, setCity] = useState<string>(user?.city || 'baghdad');
  const [isSaved, setIsSaved] = useState<boolean>(false);

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
          <span className="absolute bottom-0 right-0 w-5 h-5 bg-emerald-500 border-2 border-[#141721] rounded-full" />
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

      {/* Role Switcher Sandbox for Instant Testing */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-[#181b27] to-[#141721] border border-[#d4af37]/25 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#d4af37]" />
          <h3 className="font-bold text-white text-sm">تبديل الأدوار للتجربة والمعاينة الفورية (Role Switcher)</h3>
        </div>
        <p className="text-xs text-slate-400">
          يمكنك التبديل بين حساب زبون، صاحب صالون، ومدير النظام لمعاينة جميع واجهات وصلاحيات المنصة بشكل حي.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
          <button
            onClick={() => switchRoleDemo('customer')}
            className={`p-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              role === 'customer'
                ? 'bg-[#d4af37] text-black border-[#d4af37]'
                : 'bg-white/5 border-white/10 text-slate-300 hover:text-white'
            }`}
          >
            <User className="w-4 h-4" />
            <span>حساب زبون (أحمد)</span>
          </button>

          <button
            onClick={() => {
              switchRoleDemo('salon_owner');
              if (onNavigateToRole) onNavigateToRole('salon_owner');
            }}
            className={`p-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              role === 'salon_owner'
                ? 'bg-[#d4af37] text-black border-[#d4af37]'
                : 'bg-white/5 border-white/10 text-slate-300 hover:text-white'
            }`}
          >
            <Scissors className="w-4 h-4" />
            <span>صاحب صالون (وسام - رويال)</span>
          </button>

          <button
            onClick={() => {
              switchRoleDemo('admin');
              if (onNavigateToRole) onNavigateToRole('admin');
            }}
            className={`p-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              role === 'admin'
                ? 'bg-[#d4af37] text-black border-[#d4af37]'
                : 'bg-white/5 border-white/10 text-slate-300 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>مدير النظام المركزي</span>
          </button>
        </div>
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
