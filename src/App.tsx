import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { BookingProvider, useBooking } from './context/BookingContext';
import { Salon } from './types';
import { api } from './services/api';
import { Navbar } from './components/layout/Navbar';
import { BottomNavBar } from './components/layout/BottomNavBar';
import { Footer } from './components/layout/Footer';
import { HomeExploreView } from './components/home/HomeExploreView';
import { InteractiveSalonMap } from './components/map/InteractiveSalonMap';
import { SalonDetailView } from './components/salons/SalonDetailView';
import { MyBookingsView } from './components/bookings/MyBookingsView';
import { SalonDashboardView } from './components/salon-dashboard/SalonDashboardView';
import { AdminPanelView } from './components/admin/AdminPanelView';
import { SalonRegistrationView } from './components/salons/SalonRegistrationView';
import { UserProfileView } from './components/profile/UserProfileView';
import { PublicUserProfileView } from './components/profile/PublicUserProfileView';
import { TermsPrivacyView } from './components/legal/TermsPrivacyView';
import { BookingWizardModal } from './components/booking/BookingWizardModal';
import { AuthModal } from './components/auth/AuthModal';
import { SearchView } from './components/search/SearchView';
import { PostsView } from './components/posts/PostsView';
import { MessagesView } from './components/messaging/MessagesView';


function AppContent() {
  const { isRtl } = useLanguage();
  const { user, role, mySalon } = useAuth();
  const [currentView, setCurrentView] = useState<string>('explore');

  useEffect(() => {
    if (role === 'admin') {
      setCurrentView('admin');
    }
  }, [role]);
  const [selectedSalon, setSelectedSalon] = useState<Salon | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedMessageUserId, setSelectedMessageUserId] = useState<string | null>(null);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [allSalons, setAllSalons] = useState<Salon[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    async function loadSalons() {
      const data = await api.getSalons({});
      setAllSalons(data);
    }
    loadSalons();
  }, []);

  const handleSelectSalon = (salon: Salon) => {
    setSelectedSalon(salon);
    setCurrentView('salon_detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectSalonById = async (salonId: string) => {
    const s = await api.getSalonById(salonId);
    if (s && s.salon) {
      handleSelectSalon(s.salon);
    }
  };

  const handleNavigate = (view: string) => {
    if (view === 'admin' && role !== 'admin') {
      return;
    }

    // Open salon from search
    if (view.startsWith('salon:')) {
      const salonId = view.slice('salon:'.length).trim();

      if (salonId) {
        handleSelectSalonById(salonId);
        return;
      }
    }

    // Open a specific post from a notification
    if (view.startsWith('posts:')) {
      const postId = view.slice('posts:'.length).trim();

      if (postId) {
        setSelectedPostId(postId);
        setCurrentView('posts');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
    }

    // Open user profile from search
    if (view.startsWith('user:')) {
      const userId = view.slice('user:'.length).trim();

      if (userId) {
        setSelectedUserId(userId);
        setCurrentView('user_profile');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
    }

    // Open an existing direct conversation with a specific user
    // (e.g. the "Message" button on a profile).
    if (view.startsWith('messages:')) {
      const uid = view.slice('messages:'.length).trim();

      if (uid) {
        setSelectedMessageUserId(uid);
        setCurrentView('messages');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
    }

    // Plain "messages" nav (navbar) clears any deep-linked conversation.
    if (view === 'messages') {
      setSelectedMessageUserId(null);
    }

    setCurrentView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col antialiased selection:bg-[#D4AF37] selection:text-black">
      {/* Top Bento Navigation Header */}
      <Navbar
        currentView={currentView}
        onNavigate={handleNavigate}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* Main Body Content with Bento Spacing */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-20">
        {currentView === 'search' && (
          <SearchView onNavigate={handleNavigate} />
        )}

        {currentView === 'explore' && (
          <HomeExploreView
            onSelectSalon={handleSelectSalon}
            onOpenMap={() => handleNavigate('map')}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
        )}

        {currentView === 'posts' && (
        <PostsView
          salons={allSalons}
          selectedPostId={selectedPostId}
          onSelectSalon={handleSelectSalon}
          onNavigate={handleNavigate}
        />
      )}

      {currentView === 'map' && (
          <div className="space-y-4">
            <div className="bg-[#141414] border border-[#262626] rounded-2xl p-5 flex items-center justify-between">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-white" style={{ fontFamily: 'Georgia, serif' }}>
                  الخريطة التفاعلية ومواقع الصالونات
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                  استكشف الصالونات القريبة منك مع تحديد المسافة بالـ GPS وفتح مسار الملاحة
                </p>
              </div>
              <button
                onClick={() => handleNavigate('explore')}
                className="bg-[#262626] hover:bg-[#333] text-gray-200 text-xs px-4 py-2 rounded-xl border border-[#333] transition-colors"
              >
                العودة للشبكة
              </button>
            </div>

            <InteractiveSalonMap
              salons={allSalons}
              onSelectSalon={handleSelectSalon}
              selectedCity="all"
            />
          </div>
        )}

        {currentView === 'salon_detail' && selectedSalon && (
          <SalonDetailView
            salon={selectedSalon}
            onBack={() => handleNavigate('explore')}
          />
        )}

        {currentView === 'bookings' && (
          <MyBookingsView onSelectSalonId={handleSelectSalonById} />
        )}

        {currentView === 'salon_dashboard' && mySalon?.status === 'approved' && <SalonDashboardView />}

        {currentView === 'admin' && role === 'admin' && <AdminPanelView />}

        {currentView === 'register_salon' && (
          <SalonRegistrationView
            onSuccess={() => {
              handleNavigate('explore');
            }}
          />
        )}

        {currentView === 'salon_status' && (
          <SalonRegistrationView
            onSuccess={() => {
              handleNavigate('explore');
            }}
          />
        )}

        {currentView === 'terms_privacy' && (
          <TermsPrivacyView onBack={() => handleNavigate('explore')} />
        )}

        {currentView === 'user_profile' && selectedUserId && (
          user && selectedUserId === user.id ? (
            <UserProfileView
              onNavigate={handleNavigate}
              onNavigateToRole={(r) => {
                if (r === 'salon_owner') handleNavigate('salon_dashboard');
                else if (r === 'admin') handleNavigate('admin');
                else handleNavigate('explore');
              }}
            />
          ) : (
            <PublicUserProfileView
              userId={selectedUserId}
              onBack={() => handleNavigate('search')}
              onNavigate={handleNavigate}
            />
          )
        )}

        {currentView === 'profile' && (
          <UserProfileView
            onNavigate={handleNavigate}
            onNavigateToRole={(r) => {
              if (r === 'salon_owner') handleNavigate('salon_dashboard');
              else if (r === 'admin') handleNavigate('admin');
              else handleNavigate('explore');
            }}
          />
        )}

        {currentView === 'messages' && (
          <MessagesView initialUserId={selectedMessageUserId} />
        )}
      </main>

      {/* Footer */}
      <Footer onNavigate={handleNavigate} />

      {/* Bento Bottom Navigation Bar */}
      <BottomNavBar currentView={currentView} onNavigate={handleNavigate} />

      {/* Global Booking Flow Modal */}
      <BookingWizardModal onGoToBookings={() => handleNavigate('bookings')} />

      {/* Global Auth Modal */}
      <AuthModal />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <BookingProvider>
          <AppContent />
        </BookingProvider>
      </LanguageProvider>
    </AuthProvider>
  );
}
