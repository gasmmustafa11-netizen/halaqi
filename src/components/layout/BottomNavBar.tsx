import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import {
  Home,
  MapPin,
  Calendar,
  Heart,
  User,
  Scissors
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
  const { user, openAuthModal } = useAuth();

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

      {/* Map */}
      <button
        onClick={() => onNavigate('map')}
        className={`flex flex-col items-center gap-1 cursor-pointer transition-colors ${
          currentView === 'map' ? 'text-[#D4AF37]' : 'text-gray-400 hover:text-white'
        }`}
      >
        <MapPin className="w-5 h-5" />
        <span className="text-[10px]">{isRtl ? 'الخريطة' : 'Map'}</span>
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

      {/* Join as Salon / Services */}
      <button
        onClick={() => onNavigate('register_salon')}
        className={`flex flex-col items-center gap-1 cursor-pointer transition-colors ${
          currentView === 'register_salon' ? 'text-[#D4AF37]' : 'text-gray-400 hover:text-white'
        }`}
      >
        <Scissors className="w-5 h-5" />
        <span className="text-[10px]">{isRtl ? 'انضم كصالون' : 'Join'}</span>
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
