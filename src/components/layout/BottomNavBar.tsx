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

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#141414] border-t border-[#262626] h-16 flex items-center justify-around px-4 sm:px-8 shadow-2xl backdrop-blur-lg">
      {/* Home / Explore */}
      <button
        onClick={() => onNavigate('explore')}
        className={`flex flex-col items-center gap-1 cursor-pointer transition-colors ${
          currentView === 'explore' ? 'text-[#D4AF37]' : 'text-gray-400 hover:text-white'
        }`}
      >
        <Home className="w-5 h-5" />
        <span className="text-[10px] font-bold">{isRtl ? 'الرئيسية' : 'Home'}</span>
      </button>

        {/* Posts */}
        <button
          type="button"
          onClick={() => onNavigate('posts')}
          aria-label={isRtl ? 'المنشورات' : 'Posts'}
          className={`flex flex-col items-center gap-1 cursor-pointer transition-colors ${
            currentView === 'posts' ? 'text-[#D4AF37]' : 'text-gray-400 hover:text-white'
          }`}
        >
          <LayoutGrid className="w-5 h-5" />
          <span className="text-[10px] font-bold">
            {isRtl ? 'المنشورات' : 'Posts'}
          </span>
        </button>

      {/* Bookings */}
      <button
        onClick={() => onNavigate('bookings')}
        className={`flex flex-col items-center gap-1 cursor-pointer transition-colors relative ${
          currentView === 'bookings' ? 'text-[#D4AF37]' : 'text-gray-400 hover:text-white'
        }`}
      >
        <div className="relative">
          <Calendar className="w-5 h-5" />
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
        className={`flex flex-col items-center gap-1 cursor-pointer transition-colors ${
          currentView === 'register_salon' || currentView === 'salon_status'
            ? 'text-[#D4AF37]'
            : currentView === 'salon_dashboard'
            ? 'text-[#D4AF37]'
            : 'text-gray-400 hover:text-white'
        }`}
      >
        <Scissors className="w-5 h-5" />
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
        className={`flex flex-col items-center gap-1 cursor-pointer transition-colors ${
          currentView === 'profile' ? 'text-[#D4AF37]' : 'text-gray-400 hover:text-white'
        }`}
      >
        <User className="w-5 h-5" />
        <span className="text-[10px]">{t('profile')}</span>
      </button>
    </nav>
  );
};
