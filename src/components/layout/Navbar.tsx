import React, { useEffect, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { Notification as AppNotification } from '../../types';
import {
  Scissors,
  MapPin,
  Calendar,
  User,
  ShieldCheck,
  Globe,
  Store,
  LogOut,
  Sparkles,
  Search,
  Heart,
    Bell
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
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState<boolean>(false);


    const [isNotificationsOpen, setIsNotificationsOpen] = useState<boolean>(false);
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
const toggleLanguage = () => {
    setLanguage(language === 'ar' ? 'en' : 'ar');
  };

    const loadNotifications = async () => {
    if (!user?.id) {
      setNotifications([]);
      return [];
    }

    try {
      const items = await api.getNotifications(user.id);
      setNotifications(items);
      return items;
    } catch (error) {
      console.error('[NAVBAR NOTIFICATIONS]', error);
      return [];
    }
  };

  const openNotifications = async () => {
    setIsNotificationsOpen(true);
    setIsProfileDropdownOpen(false);

    try {
      const items = await loadNotifications();
      const unreadItems = items.filter((item) => !item.read);

      if (unreadItems.length > 0) {
        await Promise.all(
          unreadItems.map((item) =>
            api.markNotificationAsRead(item.id)
          )
        );

        setNotifications((current) =>
          current.map((item) => ({
            ...item,
            read: true,
          }))
        );
      }
    } catch (error) {
      console.error('[OPEN NOTIFICATIONS]', error);
    }
  };

  useEffect(() => {
      loadNotifications();

      if (!user?.id) return;

      const timer = setInterval(loadNotifications, 10000);

      return () => clearInterval(timer);
    }, [user?.id]);

    const unreadCount = notifications.filter((item) => !item.read).length;


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

            {/* Notifications */}
            {user && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    if (isNotificationsOpen) {
                    setIsNotificationsOpen(false);
                  } else {
                    openNotifications();
                  }
                  }}
                  title={isRtl ? 'الإشعارات' : 'Notifications'}
                  className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-[#262626] hover:bg-[#333] border border-[#333] text-[#D4AF37] transition-all"
                >
                  <Bell className="w-5 h-5" />

                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center border-2 border-[#141414]">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>

                {isNotificationsOpen && (
                  <div className="fixed inset-x-3 top-[76px] sm:absolute sm:right-0 sm:inset-x-auto sm:mt-2 w-auto sm:w-[360px] max-w-none bg-[#141414] border border-[#333] rounded-2xl shadow-2xl z-[100] overflow-hidden">
                    <div className="px-4 py-3 border-b border-[#262626]">
                      <p className="font-black text-white">
                        {isRtl ? 'الإشعارات' : 'Notifications'}
                      </p>
                    </div>

                    <div className="max-h-[65vh] sm:max-h-[420px] overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="px-5 py-10 text-center text-sm text-gray-500">
                          {isRtl ? 'لا توجد إشعارات' : 'No notifications'}
                        </div>
                      ) : (
                        notifications.map((notification) => (
                          <button
                            key={notification.id}
                            type="button"
                            onClick={async () => {
                              if (!notification.read) {
                                const ok = await api.markNotificationAsRead(notification.id);

                                if (ok) {
                                  setNotifications((current) =>
                                    current.map((item) =>
                                      item.id === notification.id
                                        ? { ...item, read: true }
                                        : item
                                    )
                                  );
                                }
                              }

                              setIsNotificationsOpen(false);

                              if (notification.link === '/bookings') {
                                onNavigate('bookings');
                              } else if (notification.link === '/profile') {
                                onNavigate('profile');
                              } else if (
                                notification.link?.startsWith('/admin/') &&
                                role === 'admin'
                              ) {
                                onNavigate('admin');
                              }
                            }}
                            className={`w-full text-start px-4 py-3 border-b border-[#262626] hover:bg-white/5 transition-colors ${
                              notification.read ? 'opacity-70' : 'bg-[#D4AF37]/5'
                            }`}
                          >
                            <p className="text-xs font-bold text-white">
                              {isRtl ? notification.title : notification.titleEn}
                            </p>

                            <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
                              {isRtl ? notification.message : notification.messageEn}
                            </p>

                            <p className="text-[9px] text-gray-600 mt-2">
                              {new Date(notification.createdAt).toLocaleString(
                                isRtl ? 'ar-IQ' : 'en-US'
                              )}
                            </p>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

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
                <div className="fixed left-3 right-3 top-[76px] sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-56 w-auto bg-[#141414] border border-[#262626] rounded-2xl p-2 shadow-2xl z-[100] text-xs space-y-1 animate-in fade-in zoom-in-95">
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
        </div>
      </div>
    </header>
  );
};
