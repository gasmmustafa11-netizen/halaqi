import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { NotificationsProvider } from './components/common/NotificationsProvider';
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
import { AdminSystemView } from './components/admin/AdminSystemView';
import { VerificationRequestsView } from './components/admin/VerificationRequestsView';
import { ReportsPageView } from './components/admin/ReportsPageView';
import { SalonRegistrationView } from './components/salons/SalonRegistrationView';
import { UserProfileView } from './components/profile/UserProfileView';
import { PublicUserProfileView } from './components/profile/PublicUserProfileView';
import { TermsPrivacyView } from './components/legal/TermsPrivacyView';
import { BookingWizardModal } from './components/booking/BookingWizardModal';
import { AuthModal } from './components/auth/AuthModal';
import { SearchView } from './components/search/SearchView';
import { PostsView } from './components/posts/PostsView';
import { ReelsView } from './components/posts/ReelsView';
import { PostDetailView } from './components/posts/PostDetailView';
import { MessagesView } from './components/messaging/MessagesView';
import { DiscoverView } from './components/discover/DiscoverView';
import YourSalonView from './components/your-salon/YourSalonView';
import SupportCenterView from './components/support/SupportCenterView';
import {
  initPushNotifications,
  setPushNavigator,
  getActivePushToken,
} from './services/push';


function AppContent() {
  const { isRtl } = useLanguage();
  const { user, role, mySalon } = useAuth();
  const [currentView, setCurrentView] = useState<string>('explore');

  // Retap-to-refresh: bumping a view's tick remounts that section so it
  // reloads its data. Only the bottom-nav sections support refresh.
  const [refreshTick, setRefreshTick] = useState<Record<string, number>>({});
  const REFRESHABLE_VIEWS = new Set<string>([
    'explore',
    'posts',
    'register_salon',
    'salon_status',
    'salon_dashboard',
    'profile',
  ]);

  useEffect(() => {
    if (role === 'admin') {
      setCurrentView('admin');
    }
  }, [role]);

  // Mobile push: register device listeners once and wire deep-link navigation.
  useEffect(() => {
    setPushNavigator(handleNavigate);
    initPushNotifications();
    // initPushNotifications is safe on web (no-op) and idempotent enough for mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // (Re)associate the device token with the account once the user is known.
  useEffect(() => {
    if (user?.id) {
      const token = getActivePushToken();
      if (token) {
        api.registerPushToken(token, 'android');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);
  const [selectedSalon, setSelectedSalon] = useState<Salon | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedMessageUserId, setSelectedMessageUserId] = useState<string | null>(null);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  // FEATURE: dedicated Post Detail overlay opened directly from a notification.
  const [postDetail, setPostDetail] = useState<{
    postId: string;
    commentId?: string;
  } | null>(null);
  // Remembers the view the user was on before opening a public profile, so the
  // profile back button returns to the real previous screen instead of a
  // hardcoded destination.
  const prevProfileViewRef = useRef<string>('explore');
  const swipeRootRef = useRef<HTMLDivElement>(null);
  const swipeStartX = useRef<number | null>(null);
  const swipeStartY = useRef<number | null>(null);

  // Strict swipe order: HOME → POSTS → PHOTOS → REELS → MY BOOKINGS → JOIN AS A SALON → PROFILE
  const swipeSections = ['explore', 'posts', 'photos', 'reels', 'bookings', 'register_salon', 'profile'];

  // Helper to detect interactive elements
  const isInteractiveTarget = (target: HTMLElement | null): boolean => {
    if (!target) return false;
    const tag = target.tagName.toLowerCase();
    if (['button', 'a', 'input', 'textarea', 'select'].includes(tag)) return true;
    if (target.closest('button, a, input, textarea, select, [role="button"], [role="link"], [contenteditable="true"]')) {
      return true;
    }
    return false;
  };

  // Horizontal swipe navigation between main sections (mobile-friendly)
  useEffect(() => {
    const el = swipeRootRef.current;
    if (!el) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const target = e.target as HTMLElement | null;
      if (isInteractiveTarget(target)) {
        swipeStartX.current = null;
        swipeStartY.current = null;
        return;
      }
      swipeStartX.current = e.touches[0].clientX;
      swipeStartY.current = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.changedTouches.length !== 1 || swipeStartX.current === null || swipeStartY.current === null) return;
      const deltaX = e.changedTouches[0].clientX - swipeStartX.current;
      const deltaY = e.changedTouches[0].clientY - swipeStartY.current;
      // Only trigger on clear horizontal swipe with minimal vertical movement
      if (Math.abs(deltaX) > 70 && Math.abs(deltaX) > Math.abs(deltaY)) {
        const idx = swipeSections.indexOf(currentView);
        if (idx >= 0) {
          if (deltaX > 0 && idx < swipeSections.length - 1) {
            handleNavigate(swipeSections[idx + 1]);
          } else if (deltaX < 0 && idx > 0) {
            handleNavigate(swipeSections[idx - 1]);
          }
        }
      }
      swipeStartX.current = null;
      swipeStartY.current = null;
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [currentView]);
  const [allSalons, setAllSalons] = useState<Salon[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Loads the customer-facing salon list (Neon already excludes banned
  // salons). Re-callable so we can refresh after an admin ban/unban.
  const loadSalons = useCallback(async () => {
    const data = await api.getSalons({});
    setAllSalons(data);
  }, []);

  useEffect(() => {
    loadSalons();
  }, [loadSalons]);

  // FEATURE 5: when an admin bans/lifts a salon, refresh the customer-facing
  // salon cache so banned salons disappear from the map/feed immediately.
  useEffect(() => {
    const handler = () => loadSalons();
    window.addEventListener('halaqi:refresh-salons', handler);
    return () => window.removeEventListener('halaqi:refresh-salons', handler);
  }, [loadSalons]);

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
    // Retap-to-refresh: tapping the already-active bottom-nav item reloads
    // its data instead of doing nothing. We bump that view's tick (which is
    // wired into its React key) and skip the normal navigation side effects.
    if (view === currentView && REFRESHABLE_VIEWS.has(view)) {
      setRefreshTick((prev) => ({
        ...prev,
        [view]: (prev[view] || 0) + 1,
      }));

      return;
    }

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

    // Open a post in the dedicated in-app Post Detail overlay (from a
    // notification). The overlay sits above the current screen, so closing it
    // returns the user to the state they came from (e.g. Notifications).
    if (view.startsWith('postdetail:')) {
      const rest = view.slice('postdetail:'.length).trim();
      const [detailPostId, detailCommentId] = rest.split(':');
      if (detailPostId) {
        setPostDetail({ postId: detailPostId, commentId: detailCommentId || undefined });
        return;
      }
    }

    // Open user profile from search
    if (view.startsWith('user:')) {
      const userId = view.slice('user:'.length).trim();

      if (userId) {
        // Capture where we came from so the profile's back button can return.
        prevProfileViewRef.current = currentView;
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
    <div ref={swipeRootRef} className={`${currentView === 'your-salon' ? 'h-[100dvh] min-h-0' : 'min-h-screen'} bg-[#0A0A0A] text-white flex flex-col antialiased selection:bg-[#D4AF37] selection:text-black`}>
      {/* Top Bento Navigation Header — hidden inside Posts so its fixed sub-tabs don't overlap */}
      {currentView !== 'posts' && currentView !== 'reels' && currentView !== 'photos' && currentView !== 'your-salon' && (
        <Navbar
          currentView={currentView}
          onNavigate={handleNavigate}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      )}

      {/* Main Body Content with Bento Spacing */}
      <main className={`flex-1 min-h-0 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 ${currentView === 'your-salon' ? 'flex flex-col overflow-hidden pb-0' : 'pt-4 pb-20'}`}>
        {currentView === 'search' && (
          <SearchView onNavigate={handleNavigate} />
        )}

        {currentView === 'explore' && (
          <HomeExploreView
            key={`explore-${refreshTick.explore ?? 0}`}
            onSelectSalon={handleSelectSalon}
            onOpenMap={() => handleNavigate('map')}
            onOpenYourSalon={() => handleNavigate('your-salon')}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
        )}

        {currentView === 'posts' && (
        <PostsView
          key={`posts-${refreshTick.posts ?? 0}`}
          salons={allSalons}
          selectedPostId={selectedPostId}
          onSelectSalon={handleSelectSalon}
          onNavigate={handleNavigate}
        />
      )}

        {currentView === 'photos' && (
        <PostsView
          key={`photos-${refreshTick.posts ?? 0}`}
          salons={allSalons}
          selectedPostId={selectedPostId}
          onSelectSalon={handleSelectSalon}
          onNavigate={handleNavigate}
        />
      )}

        {currentView === 'reels' && (
          <ReelsView
            onBack={() => handleNavigate('posts')}
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

        {currentView === 'your-salon' && (
          <YourSalonView onBack={() => handleNavigate('explore')} onSelectSalonId={handleSelectSalonById} />
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

        {currentView === 'salon_dashboard' && mySalon?.status === 'approved' && (
          <SalonDashboardView key={`salon_dashboard-${refreshTick.salon_dashboard ?? 0}`} />
        )}

        {currentView === 'admin' && role === 'admin' && <AdminPanelView onNavigate={handleNavigate} />}

        {currentView === 'admin_system' && role === 'admin' && (
          <AdminSystemView onNavigate={handleNavigate} />
        )}

        {currentView === 'admin_verification' && role === 'admin' && (
          <VerificationRequestsView onBack={() => handleNavigate('admin_system')} />
        )}

        {currentView === 'admin_reports' && role === 'admin' && (
          <ReportsPageView onBack={() => handleNavigate('admin_system')} />
        )}

        {currentView === 'register_salon' && (
          <SalonRegistrationView
            key={`register_salon-${refreshTick.register_salon ?? 0}`}
            onSuccess={() => {
              handleNavigate('explore');
            }}
          />
        )}

        {currentView === 'salon_status' && (
          <SalonRegistrationView
            key={`salon_status-${refreshTick.salon_status ?? 0}`}
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
              onBack={() => {
                setSelectedUserId(null);
                handleNavigate(prevProfileViewRef.current || 'explore');
              }}
              onNavigate={handleNavigate}
            />
          )
        )}

        {currentView === 'profile' && (
          <UserProfileView
            key={`profile-${refreshTick.profile ?? 0}`}
            onNavigate={handleNavigate}
            onNavigateToRole={(r) => {
              if (r === 'salon_owner') handleNavigate('salon_dashboard');
              else if (r === 'admin') handleNavigate('admin');
              else handleNavigate('explore');
            }}
          />
        )}

        {currentView === 'messages' && (
          <MessagesView
            initialUserId={selectedMessageUserId}
            onNavigate={handleNavigate}
          />
        )}

        {currentView === 'discover' && (
          <DiscoverView onNavigate={handleNavigate} />
        )}

        {currentView === 'support' && (
          <SupportCenterView onNavigate={handleNavigate} />
        )}
      </main>

      {/* Footer */}
      {currentView !== 'your-salon' && <Footer onNavigate={handleNavigate} />}

      {/* Bento Bottom Navigation Bar */}
      {currentView !== 'your-salon' && <BottomNavBar currentView={currentView} onNavigate={handleNavigate} />}

      {/* Global Booking Flow Modal */}
      <BookingWizardModal onGoToBookings={() => handleNavigate('bookings')} />

      {/* FEATURE: Post Detail overlay opened directly from notifications */}
      {postDetail && (
        <PostDetailView
          postId={postDetail.postId}
          focusCommentId={postDetail.commentId}
          onClose={() => setPostDetail(null)}
        />
      )}

      {/* Global Auth Modal */}
      <AuthModal />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <NotificationsProvider>
          <BookingProvider>
            <AppContent />
          </BookingProvider>
        </NotificationsProvider>
      </LanguageProvider>
    </AuthProvider>
  );
}
