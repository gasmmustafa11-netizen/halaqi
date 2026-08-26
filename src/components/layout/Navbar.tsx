import React, { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import {
  Scissors,
  MapPin,
  Calendar,
  User,
  ShieldCheck,
  Globe,
  Store,
  Menu,
  X,
  LogOut,
  Sparkles,
  Search,
  Heart,
  Download
} from 'lucide-react';

interface NavbarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onNavigate,
  searchQuery = '',
  onSearchChange,
}) => {
  const { t, language, setLanguage, isRtl } = useLanguage();
  const { user, role, logout, openAuthModal, switchRoleDemo } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState<boolean>(false);

  const toggleLanguage = () => {
    setLanguage(language === 'ar' ? 'en' : 'ar');
  };

  const navItems = [
    { id: 'explore', label: isRtl ? 'الرئيسية' : 'Home', icon: Scissors },
    { id: 'map', label: isRtl ? 'الخريطة' : 'Map', icon: MapPin },
    { id: 'bookings', label: t('myBookings'), icon: Calendar },
    { id: 'register_salon', label: t('joinAsSalon'), icon: Store },
  ];

  return (
    <header className="sticky top-0 z-40 w-full bg-[#141414] border-b border-[#262626] px-4 sm:px-6 lg:px-8 py-3 shadow-xl transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <div
          onClick={() => {
            onNavigate('explore');
            setIsMobileMenuOpen(false);
          }}
          className="flex items-center gap-3 cursor-pointer group shrink-0"
        >
          <div className="w-10 h-10 bg-[#D4AF37] rounded-xl flex items-center justify-center font-black text-black text-xl shadow-lg group-hover:scale-105 transition-transform">
            ح
          </div>

          <div className="flex flex-col">
            <span
              className="text-xl sm:text-2xl font-black text-white tracking-tight"
              style={{ fontFamily: 'Georgia, serif' }}
            >
              HALAQI <span className="text-[#D4AF37]">|</span> {isRtl ? 'حلاقي' : 'App'}
            </span>
            <span className="text-[10px] text-gray-400 font-sans -mt-1 hidden sm:inline">
              منصة حجز الصالونات في العراق
            </span>
          </div>
        </div>

        {/* Global Search Pill (Desktop) */}
        {onSearchChange && (
          <div className="hidden lg:flex flex-1 max-w-md mx-4">
            <div className="relative flex items-center bg-[#262626] rounded-full px-4 py-2 border border-[#333] w-full focus-within:border-[#D4AF37] transition-all">
              <Search className="w-4 h-4 text-[#D4AF37] ml-2 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  onSearchChange(e.target.value);
                  if (currentView !== 'explore') onNavigate('explore');
                }}
                placeholder={t('searchPlaceholder')}
                className="bg-transparent border-none outline-none text-xs sm:text-sm w-full text-white placeholder-gray-400 text-start"
              />
            </div>
          </div>
        )}

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-[#D4AF37] text-black shadow-md'
                    : 'text-gray-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}

          {/* Quick role views */}
          <button
            onClick={() => onNavigate('salon_dashboard')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
              currentView === 'salon_dashboard'
                ? 'bg-[#D4AF37] text-black shadow-md'
                : 'text-amber-300/80 hover:text-amber-200 hover:bg-white/5'
            }`}
          >
            <Store className="w-3.5 h-3.5" />
            <span>لوحة الصالون</span>
          </button>

          {role === 'admin' && (
            <button
              onClick={() => onNavigate('admin')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                currentView === 'admin'
                  ? 'bg-[#D4AF37] text-black shadow-md'
                  : 'text-red-400/80 hover:text-red-300 hover:bg-white/5'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>الإدارة</span>
            </button>
          )}
        </nav>

        {/* Right Section: Location Pill + User Controls */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Direct ZIP Source Code Download Button */}
          <a
            href="/api/download-project-zip"
            download="HALAQI-Android-Project.zip"
            title="تحميل كود المشروع الكامل (ZIP)"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#D4AF37]/10 hover:bg-[#D4AF37]/20 border border-[#D4AF37]/40 text-[#D4AF37] hover:text-white text-xs font-bold transition-all shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">تحميل كود المشروع ZIP</span>
            <span className="lg:hidden">ZIP</span>
          </a>

          {/* Current Location Badge */}
          <div className="hidden sm:flex flex-col items-end px-3 py-1 bg-[#262626]/60 rounded-xl border border-[#333]">
            <span className="text-[9px] text-gray-400 uppercase tracking-widest flex items-center gap-1">
              <MapPin className="w-2.5 h-2.5 text-[#D4AF37]" />
              الموقع الحالي
            </span>
            <span className="text-xs font-semibold text-white">بغداد، المنصور</span>
          </div>

          {/* Language Switcher */}
          <button
            onClick={toggleLanguage}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#262626] hover:bg-[#333] text-xs font-bold text-gray-200 transition-colors border border-[#333]"
            title="تبديل اللغة"
          >
            <Globe className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span className="font-mono">{language === 'ar' ? 'EN' : 'عربي'}</span>
          </button>

          {/* User Account / Profile */}
          {user ? (
            <div className="relative">
              <button
                onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                className="w-10 h-10 rounded-full border-2 border-[#D4AF37] bg-gray-800 flex items-center justify-center p-0.5 shadow-lg overflow-hidden hover:brightness-110 transition-all"
              >
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <span className="text-[#D4AF37] font-bold text-sm">
                    {user.name.charAt(0)}
                  </span>
                )}
              </button>

              {/* Dropdown Menu */}
              {isProfileDropdownOpen && (
                <div className="absolute left-0 sm:right-0 mt-2 w-56 bg-[#141414] border border-[#262626] rounded-2xl p-2 shadow-2xl z-50 text-xs space-y-1 animate-in fade-in zoom-in-95">
                  <div className="px-3 py-2 border-b border-[#262626]">
                    <p className="font-bold text-white truncate">{user.name}</p>
                    <p className="text-[10px] text-gray-400 font-mono" dir="ltr">
                      {user.phone}
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      onNavigate('profile');
                      setIsProfileDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    <User className="w-3.5 h-3.5 text-[#D4AF37]" />
                    <span>{t('profile')}</span>
                  </button>

                  <button
                    onClick={() => {
                      onNavigate('bookings');
                      setIsProfileDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    <Calendar className="w-3.5 h-3.5 text-sky-400" />
                    <span>{t('myBookings')}</span>
                  </button>

                  <div className="border-t border-[#262626] my-1" />

                  <button
                    onClick={() => {
                      logout();
                      setIsProfileDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-red-400 hover:bg-red-950/40 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>{t('logout')}</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={openAuthModal}
              className="px-4 py-2 rounded-xl bg-[#D4AF37] hover:bg-[#B8962D] text-black font-bold text-xs shadow-md transition-all flex items-center gap-1.5"
            >
              <User className="w-3.5 h-3.5" />
              <span>{t('login')}</span>
            </button>
          )}

          {/* Mobile Menu Hamburger Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 rounded-xl bg-[#262626] text-gray-300 hover:text-white"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-[#141414] border-t border-[#262626] mt-3 pt-3 px-2 pb-2 space-y-2 animate-in slide-in-from-top-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.id);
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  isActive ? 'bg-[#D4AF37] text-black shadow-md' : 'text-gray-300 hover:bg-white/5'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}

          <div className="pt-2 border-t border-[#262626] grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                onNavigate('salon_dashboard');
                setIsMobileMenuOpen(false);
              }}
              className="p-2.5 rounded-xl bg-[#262626] text-amber-300 text-xs font-bold flex items-center justify-center gap-1.5"
            >
              <Store className="w-3.5 h-3.5" />
              <span>لوحة الصالون</span>
            </button>

            <button
              onClick={() => {
                onNavigate('admin');
                setIsMobileMenuOpen(false);
              }}
              className="p-2.5 rounded-xl bg-[#262626] text-red-400 text-xs font-bold flex items-center justify-center gap-1.5"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>لوحة الإدارة</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
