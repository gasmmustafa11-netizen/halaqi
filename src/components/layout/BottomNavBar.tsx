import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import {
  Home,
  Calendar,
  Heart,
  User,
  Scissors,
  LayoutGrid
} from 'lucide-react';

interface BottomNavBarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  bookingCount?: number;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  currentView,
  onNavigate,
  bookingCount = 0,
}) => {
  const { t, isRtl } = useLanguage();
  const { user, openAuthModal, mySalon } = useAuth();

  const salonStatus = mySalon?.status ?? null;

  const itemClass = (active: boolean) =>
    `flex flex-col items-center justify-center gap-1 cursor-pointer transition-all duration-300 px-2.5 sm:px-4 py-1.5 rounded-full ${
      active
        ? 'text-[#D4AF37] bg-[#D4AF37]/[0.10] shadow-[0_0_16px_-2px_rgba(212,175,55,0.50)] ring-1 ring-[#D4AF37]/20'
        : 'text-gray-400 hover:text-gray-100'
    }`;

  const iconClass = (active: boolean) =>
    `w-5 h-5 transition-all duration-300 ${active ? 'scale-110' : ''}`;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex justify-center px-3 pb-3 sm:pb-4 pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-1 px-2 py-2 rounded-full bg-white/[0.06] backdrop-blur-2xl border border-white/[0.12] shadow-[0_8px_32px_rgba(0,0,0,0.6)] ring-1 ring-white/[0.05]">
        {/* Home / Explore */}
        <button
          onClick={() => onNavigate('explore')}
          className={itemClass(currentView === 'explore')}
        >
          <Home className={iconClass(currentView === 'explore')} />
          <span className="text-[10px] font-bold">{isRtl ? 'الرئيسية' : 'Home'}</span>
        </button>

        {/* Posts */}
        <button
          type="button"
          onClick={() => onNavigate('posts')}
          aria-label={isRtl ? 'المنشورات' : 'Posts'}
          className={itemClass(currentView === 'posts')}
        >
          <LayoutGrid className={iconClass(currentView === 'posts')} />
          <span className="text-[10px] font-bold">
            {isRtl ? 'المنشورات' : 'Posts'}
          </span>
        </button>

        {/* Bookings */}
        <button
          onClick={() => onNavigate('bookings')}
          className={`${itemClass(currentView === 'bookings')} relative`}
        >
          <div className="relative">
            <Calendar className={iconClass(currentView === 'bookings')} />
            {bookingCount > 0 && (
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-[#D4AF37] rounded-full " />
            )}
          </div>
          <span className="text-[10px]">{t('myBookings')}</span>
        </button>

        {/* Salon Button: 3-way conditional based on salon application status */}
        <button
          onClick={() => {
            if (salonStatus === 'approved') {
              onNavigate('salon_dashboard');
            } else if (salonStatus === 'pending') {
              onNavigate('salon_status');
            } else {
              onNavigate('register_salon');
            }
          }}
          className={itemClass(
            currentView === 'register_salon' ||
              currentView === 'salon_status' ||
              currentView === 'salon_dashboard'
          )}
        >
          <Scissors
            className={iconClass(
              currentView === 'register_salon' ||
                currentView === 'salon_status' ||
                currentView === 'salon_dashboard'
            )}
          />
          <span className="text-[10px]">
            {salonStatus === 'approved'
              ? (isRtl ? 'صالونك' : 'Your Salon')
              : salonStatus === 'pending'
              ? (isRtl ? 'قيد المراجعة' : 'Reviewing')
              : (isRtl ? 'انضم كصالون' : 'Join')
            }
          </span>
        </button>

        {/* Profile */}
        <button
          onClick={() => {
            if (user) {
              onNavigate('profile');
            } else {
              openAuthModal();
            }
          }}
          className={itemClass(currentView === 'profile')}
        >
          <User className={iconClass(currentView === 'profile')} />
          <span className="text-[10px]">{t('profile')}</span>
        </button>
      </div>
    </nav>
  );
};
