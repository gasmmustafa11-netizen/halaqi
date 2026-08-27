import React, { useEffect, useState, useCallback } from 'react';
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
  const { t, isRtl } = useLanguage();
  const { user, role, logout, openAuthModal, switchRoleDemo, mySalon } = useAuth();

  const salonStatus = mySalon?.status ?? null;
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState<boolean>(false);


    const [isNotificationsOpen, setIsNotificationsOpen] = useState<boolean>(false);
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const loadNotifications = async () => {
    if (!user?.id) {
      setNotifications([]);
      return [];
    }

    try {
      const items = await api.getNotifications(user.id);

      // حماية إضافية:
      // لا نعرض أي إشعار لا يخص المستخدم الحالي.
      const ownItems = items.filter(
        (item) => String(item.userId) === String(user.id)
      );

      // نحافظ على read=true الموجود في الواجهة
      // حتى لا يرجع الإشعار مؤقتاً إلى unread أثناء الـ polling.
      setNotifications((current) => {
        const currentReadIds = new Set(
          current
            .filter((item) => item.read)
            .map((item) => item.id)
        );

        return ownItems.map((item) => ({
          ...item,
          read: Boolean(item.read) || currentReadIds.has(item.id),
        }));
      });

      return ownItems;
    } catch (error) {
      console.error('[NAVBAR NOTIFICATIONS]', error);
      return [];
    }
  };

  const openNotifications = async () => {
    setIsNotificationsOpen(true);
    setIsProfileDropdownOpen(false);

    if (!user?.id) return;

    try {
      // نستخدم الحالة الحالية أولاً.
      // لا نعيد تحميل الإشعارات عدة مرات عند كل فتح.
      const unreadItems = notifications.filter(
        (item) => !item.read
      );

      if (unreadItems.length === 0) {
        return;
      }

      // تعليم الإشعارات غير المقروءة كمقروءة في السيرفر.
      const results = await Promise.all(
        unreadItems.map(async (item) => {
          const ok = await api.markNotificationAsRead(item.id);
          return {
            id: item.id,
            ok,
          };
        })
      );

      const successfullyReadIds = new Set(
        results
          .filter((result) => result.ok)
          .map((result) => result.id)
      );

      // تحديث الواجهة فقط للإشعارات التي أكد السيرفر قراءتها.
      if (successfullyReadIds.size > 0) {
        setNotifications((current) =>
          current.map((item) =>
            successfullyReadIds.has(item.id)
              ? { ...item, read: true }
              : item
          )
        );
      }
    } catch (error) {
      console.error('[OPEN NOTIFICATIONS]', error);
    }
  };

  useEffect(() => {
      loadNotifications();

      if (!user?.id) return;

      const timer = setInterval(loadNotifications, 15000);

      return () => clearInterval(timer);
    }, [user?.id]);

    const unreadCount = notifications.filter((item) => !item.read).length;

  const [messageUnread, setMessageUnread] = useState<number>(0);

  const loadMessageUnread = useCallback(async () => {
    if (!user?.id) {
      setMessageUnread(0);
      return;
    }
    try {
      const convs = await api.getConversations();
      const total = convs.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
      setMessageUnread(total);
    } catch {
      /* ignore transient failures */
    }
  }, [user?.id]);

  // Periodic refresh of the Messages unread badge.
  useEffect(() => {
    loadMessageUnread();
    if (!user?.id) return;
    const timer = setInterval(loadMessageUnread, 15000);
    return () => clearInterval(timer);
  }, [user?.id, loadMessageUnread]);

  // Immediate refresh when a conversation is read elsewhere (e.g. the
  // MessagesView marks messages read on open) so the badge updates
  // without waiting for the 15s poll.
  useEffect(() => {
    const handler = () => loadMessageUnread();
    window.addEventListener('halaqi:messages-unread-refresh', handler);
    return () =>
      window.removeEventListener('halaqi:messages-unread-refresh', handler);
  }, [loadMessageUnread]);


  const navItems = [
    { id: 'explore', label: isRtl ? 'الرئيسية' : 'Home', icon: Scissors },
    { id: 'map', label: isRtl ? 'الخريطة' : 'Map', icon: MapPin },
    { id: 'bookings', label: t('myBookings'), icon: Calendar },
    ...(salonStatus === 'approved'
      ? [{ id: 'salon_dashboard', label: isRtl ? 'صالونك' : 'Your Salon', icon: Store }]
      : salonStatus === 'pending'
      ? [{ id: 'salon_status', label: isRtl ? 'قيد المراجعة' : 'Under Review', icon: Store }]
      : [{ id: 'register_salon', label: t('joinAsSalon'), icon: Store }]
    ),
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
          {salonStatus === 'approved' && (
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
          )}

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

            {user && (
              <div>
                {/* Mobile Search */}
                <button
                  type="button"
                  onClick={() => onNavigate('search')}
                  title={isRtl ? 'البحث' : 'Search'}
                  className={`lg:hidden flex items-center justify-center w-10 h-10 rounded-xl border transition-all ${
                    currentView === 'search'
                      ? 'bg-[#D4AF37] text-black border-[#D4AF37]'
                      : 'bg-[#262626] text-[#D4AF37] border-[#333] hover:bg-[#333]'
                  }`}
                >
                  <Search className="w-5 h-5" />
                </button>
              </div>
            )}

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
                  <div className="fixed inset-x-3 top-[76px] sm:absolute sm:right-0 sm:inset-x-auto sm:mt-3 w-auto sm:w-[390px] max-w-[calc(100vw-1.5rem)] bg-[#111111]/95 backdrop-blur-xl border border-white/[0.08] rounded-[24px] shadow-[0_24px_80px_rgba(0,0,0,0.65)] z-[100] overflow-hidden ring-1 ring-[#D4AF37]/5">

                    {/* Header */}
                    <div className="px-5 py-4 border-b border-white/[0.07] bg-gradient-to-b from-white/[0.035] to-transparent">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="relative w-10 h-10 rounded-2xl bg-gradient-to-br from-[#D4AF37]/20 to-[#D4AF37]/5 border border-[#D4AF37]/20 flex items-center justify-center shadow-inner">
                            <span className="text-lg">♢</span>
                            {unreadCount > 0 && (
                              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[#D4AF37] ring-2 ring-[#111111] shadow-[0_0_12px_rgba(212,175,55,0.55)]" />
                            )}
                          </div>

                          <div>
                            <p className="text-[15px] font-black text-white tracking-tight">
                              {isRtl ? 'الإشعارات' : 'Notifications'}
                            </p>
                            <p className="text-[10px] text-gray-500 mt-0.5">
                              {unreadCount > 0
                                ? (isRtl ? `${unreadCount} إشعار غير مقروء` : `${unreadCount} unread`)
                                : (isRtl ? 'كل الإشعارات مقروءة' : 'All caught up')}
                            </p>
                          </div>
                        </div>

                        {unreadCount > 0 && (
                          <span className="shrink-0 px-2.5 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/20 text-[9px] font-black text-[#D4AF37]">
                            {unreadCount > 99 ? '99+' : unreadCount}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Notifications list */}
                    <div className="max-h-[65vh] sm:max-h-[430px] overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="px-6 py-14 text-center">
                          <div className="mx-auto w-14 h-14 rounded-2xl bg-white/[0.035] border border-white/[0.06] flex items-center justify-center mb-4">
                            <span className="text-xl text-gray-500">♢</span>
                          </div>
                          <p className="text-sm font-bold text-gray-300">
                            {isRtl ? 'لا توجد إشعارات' : 'No notifications'}
                          </p>
                          <p className="text-[10px] text-gray-600 mt-1.5">
                            {isRtl ? 'سنخبرك عندما يحدث شيء جديد' : 'We will let you know when something happens'}
                          </p>
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
                              } else if (
                                notification.link === '/posts' ||
                                notification.link?.startsWith('/posts?postId=')
                              ) {
                                const postId = notification.link.startsWith('/posts?postId=')
                                  ? new URLSearchParams(
                                      notification.link.split('?')[1] || ''
                                    ).get('postId')
                                  : null;

                                onNavigate(
                                  postId
                                    ? `posts:${postId}`
                                    : 'posts'
                                );
                              } else if (notification.link === '/profile') {
                                onNavigate('profile');
                              } else if (notification.link === '/messages') {
                                onNavigate('messages');
                              } else if (notification.link?.startsWith('/profile/')) {
                                const userId = notification.link.slice('/profile/'.length).trim();
                                if (userId) {
                                  onNavigate(`user:${userId}`);
                                }
                              } else if (
                                notification.link?.startsWith('/admin/') &&
                                role === 'admin'
                              ) {
                                onNavigate('admin');
                              }
                            }}
                            className={`group relative w-full text-start px-4 py-3.5 border-b border-white/[0.055] transition-all duration-200 hover:bg-white/[0.045] active:bg-white/[0.07] ${
                              notification.read ? 'opacity-70' : 'bg-[#D4AF37]/[0.035]'
                            }`}
                          >
                            {/* Unread indicator */}
                            {!notification.read && (
                              <span className="absolute top-4 right-3 w-1.5 h-1.5 rounded-full bg-[#D4AF37] shadow-[0_0_10px_rgba(212,175,55,0.7)]" />
                            )}

                            <div className="flex items-start gap-3">
                              {/* Notification icon */}
                              <div className={`shrink-0 w-10 h-10 rounded-[14px] flex items-center justify-center border transition-all duration-200 ${
                                notification.read
                                  ? 'bg-white/[0.035] border-white/[0.06] text-gray-500'
                                  : 'bg-gradient-to-br from-[#D4AF37]/20 to-[#D4AF37]/5 border-[#D4AF37]/20 text-[#D4AF37] shadow-[0_0_20px_rgba(212,175,55,0.08)]'
                              }`}>
                                <span className="text-sm">✦</span>
                              </div>

                              <div className="min-w-0 flex-1 pe-2">
                                <div className="flex items-center gap-2">
                                  <p className="text-[12px] font-black text-white truncate">
                                    {isRtl ? notification.title : notification.titleEn}
                                  </p>
                                </div>

                                <p className="text-[11px] text-gray-400 mt-1 leading-[1.65] line-clamp-2">
                                  {isRtl ? notification.message : notification.messageEn}
                                </p>

                                <p className="text-[9px] text-gray-600 mt-2.5">
                                  {new Date(notification.createdAt).toLocaleString(
                                    isRtl ? 'ar-IQ' : 'en-US',
                                    {
                                      day: 'numeric',
                                      month: 'short',
                                      hour: 'numeric',
                                      minute: '2-digit'
                                    }
                                  )}
                                </p>
                              </div>

                              {/* Arrow */}
                              <span className="shrink-0 self-center text-gray-700 group-hover:text-[#D4AF37] group-hover:translate-x-[-2px] transition-all text-sm">
                                {isRtl ? '‹' : '›'}
                              </span>
                            </div>
                          </button>
                        ))
                      )}
                    </div>

                    {/* Footer */}
                    {notifications.length > 0 && (
                      <div className="px-4 py-2.5 bg-white/[0.018] border-t border-white/[0.055]">
                        <p className="text-center text-[9px] text-gray-600">
                          {isRtl ? 'اضغط على الإشعار لعرض التفاصيل' : 'Tap a notification to view details'}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
             )}

            {/* Messages */}
            {user && (
              <button
                type="button"
                onClick={() => onNavigate('messages')}
                title={isRtl ? 'الرسائل' : 'Messages'}
                className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-[#262626] hover:bg-[#333] border border-[#333] text-[#D4AF37] transition-all"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="w-5 h-5"
                  aria-hidden="true"
                >
                  <path
                    d="M5 4h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H10l-4 3v-3H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"
                    fill="#D4AF37"
                  />
                  <circle cx="8.5" cy="9.5" r="1.1" fill="#141414" />
                  <circle cx="12" cy="9.5" r="1.1" fill="#141414" />
                  <circle cx="15.5" cy="9.5" r="1.1" fill="#141414" />
                </svg>
                {messageUnread > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center border-2 border-[#141414]">
                    {messageUnread > 99 ? '99+' : messageUnread}
                  </span>
                )}
              </button>
            )}

 {/* Current Location Badge */}
          <div className="hidden sm:flex flex-col items-end px-3 py-1 bg-[#262626]/60 rounded-xl border border-[#333]">
            <span className="text-[9px] text-gray-400 uppercase tracking-widest flex items-center gap-1">
              <MapPin className="w-2.5 h-2.5 text-[#D4AF37]" />
              الموقع الحالي
            </span>
            <span className="text-xs font-semibold text-white">بغداد، المنصور</span>
          </div>

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
