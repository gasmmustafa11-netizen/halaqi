import React, { useState, useEffect, useRef, useCallback, Suspense, lazy } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { MobileErrorBoundary } from './components/common/MobileErrorBoundary';
import { NotificationsProvider } from './components/common/NotificationsProvider';
import { BookingProvider, useBooking } from './context/BookingContext';
import { Salon } from './types';
import { api } from './services/api';
import { Navbar } from './components/layout/Navbar';
import { BottomNavBar } from './components/layout/BottomNavBar';
import { Footer } from './components/layout/Footer';
import { HomeExploreView } from './components/home/HomeExploreView';
const InteractiveSalonMap = lazy(() => import('./components/map/InteractiveSalonMap').then(m => ({ default: m.InteractiveSalonMap })));
import { SalonDetailView } from './components/salons/SalonDetailView';
import { MyBookingsView } from './components/bookings/MyBookingsView';
const SalonDashboardView = lazy(() => import('./components/salon-dashboard/SalonDashboardView').then(m => ({ default: m.SalonDashboardView })));
const AdminPanelView = lazy(() => import('./components/admin/AdminPanelView').then(m => ({ default: m.AdminPanelView })));
const AdminSystemView = lazy(() => import('./components/admin/AdminSystemView').then(m => ({ default: m.AdminSystemView })));
const ReportsPageView = lazy(() => import('./components/admin/ReportsPageView').then(m => ({ default: m.ReportsPageView })));
const VerificationRequestsView = lazy(() => import('./components/admin/VerificationRequestsView').then(m => ({ default: m.VerificationRequestsView })));
import { SalonRegistrationView } from './components/salons/SalonRegistrationView';
const UserProfileView = lazy(() => import('./components/profile/UserProfileView').then(m => ({ default: m.UserProfileView })));
const PublicUserProfileView = lazy(() => import('./components/profile/PublicUserProfileView').then(m => ({ default: m.PublicUserProfileView })));
const PostsView = lazy(() => import('./components/posts/PostsView').then(m => ({ default: m.PostsView })));
const ReelsView = lazy(() => import('./components/posts/ReelsView').then(m => ({ default: m.ReelsView })));
import { TermsPrivacyView } from './components/legal/TermsPrivacyView';
import { BookingWizardModal } from './components/booking/BookingWizardModal';
import { AuthModal } from './components/auth/AuthModal';
const SearchView = lazy(() => import('./components/search/SearchView').then(m => ({ default: m.SearchView })));
const SearchNearView = lazy(() => import('./components/search/SearchNearView').then(m => ({ default: m.SearchNearView })));
const PostDetailView = lazy(() => import('./components/posts/PostDetailView').then(m => ({ default: m.PostDetailView })));
import { MessagesView } from './components/messaging/MessagesView';
const DiscoverView = lazy(() => import('./components/discover/DiscoverView').then(m => ({ default: m.DiscoverView })));
import SupportCenterView from './components/support/SupportCenterView';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import { getCache, setCache } from './utils/simpleCache';
import { App as CapacitorApp } from '@capacitor/app';
import {
  initPushNotifications,
  setPushNavigator,
  getActivePushToken,
} from './services/push';


function AppContent() {
  const { isRtl } = useLanguage();
  const { user, role, mySalon } = useAuth();
  const online = useNetworkStatus();
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
    const cached = getCache('salons');
    if (cached) setAllSalons(cached);
    try {
      const data = await api.getSalons({});
      setAllSalons(data);
      setCache('salons', data);
    } catch {
      // keep cached data on failure
    }
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

  // Android back button: navigate back to explore or allow exit at root
  useEffect(() => {
    let listener: any;
    (async () => {
      listener = await CapacitorApp.addListener('backButton', () => {
        if (currentView !== 'explore') {
          handleNavigate('explore');
        } else {
          // At root: allow default Android exit by not calling preventDefault
        }
      });
    })();
    return () => {
      if (listener && listener.remove) listener.remove();
    };
  }, [currentView, handleNavigate]);

  return (
    <div ref={swipeRootRef} className="min-h-screen bg-[#0A0A0A] text-white flex flex-col antialiased selection:bg-[#D4AF37] selection:text-black">
      {/* Top Bento Navigation Header — hidden inside Posts so its fixed sub-tabs don't overlap */}
      {currentView !== 'posts' && currentView !== 'reels' && currentView !== 'photos' && (
        <Navbar
          currentView={currentView}
          onNavigate={handleNavigate}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      )}

      {!online && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-900/90 text-amber-100 text-xs text-center py-1">Poor network — showing cached content</div>
      )}
      {/* Main Body Content with Bento Spacing */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-24">
        {currentView === 'search_near' && (
          <Suspense fallback={<div className="flex min-h-[200px] items-center justify-center text-slate-400">Loading...</div>}>
          <SearchNearView onNavigate={handleNavigate} onSelectSalon={handleSelectSalon} />
          </Suspense>
        )}

        {currentView === 'search' && (
          <Suspense fallback={<div className="flex min-h-[200px] items-center justify-center text-slate-400">Loading...</div>}>
          <SearchView onNavigate={handleNavigate} />
          </Suspense>
        )}

        {currentView === 'explore' && (
          <HomeExploreView
            key={`explore-${refreshTick.explore ?? 0}`}
            onSelectSalon={handleSelectSalon}
            onOpenMap={() => handleNavigate('map')}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
        )}

        {currentView === 'posts' && (
        <Suspense fallback={<div className="flex min-h-[200px] items-center justify-center text-slate-400">Loading...</div>}>
        <PostsView
          key={`posts-${refreshTick.posts ?? 0}`}
          salons={allSalons}
          selectedPostId={selectedPostId}
          onSelectSalon={handleSelectSalon}
          onNavigate={handleNavigate}
        />
        </Suspense>
        )}

        {currentView === 'photos' && (
        <Suspense fallback={<div className="flex min-h-[200px] items-center justify-center text-slate-400">Loading...</div>}>
        <PostsView
          key={`photos-${refreshTick.posts ?? 0}`}
          salons={allSalons}
          selectedPostId={selectedPostId}
          onSelectSalon={handleSelectSalon}
          onNavigate={handleNavigate}
        />
        </Suspense>
      )}

        {currentView === 'reels' && (
          <Suspense fallback={<div className="flex min-h-[200px] items-center justify-center text-slate-400">Loading...</div>}>
          <ReelsView
            onBack={() => handleNavigate('posts')}
            onNavigate={handleNavigate}
          />
          </Suspense>
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

            <Suspense fallback={<div className="flex min-h-[200px] items-center justify-center text-slate-400">Loading...</div>}>
            <InteractiveSalonMap
              salons={allSalons}
              onSelectSalon={handleSelectSalon}
              selectedCity="all"
            />
            </Suspense>
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

        {currentView === 'salon_dashboard' && mySalon?.status === 'approved' && (
          <Suspense fallback={<div className="flex min-h-[200px] items-center justify-center text-slate-400">Loading...</div>}>
          <SalonDashboardView key={`salon_dashboard-${refreshTick.salon_dashboard ?? 0}`} />
          </Suspense>
        )}

        {currentView === 'admin' && role === 'admin' && (
          <Suspense fallback={<div className="flex min-h-[200px] items-center justify-center text-slate-400">Loading...</div>}>
          <AdminPanelView onNavigate={handleNavigate} />
          </Suspense>
        )}

        {currentView === 'admin_system' && role === 'admin' && (
          <Suspense fallback={<div className="flex min-h-[200px] items-center justify-center text-slate-400">Loading...</div>}>
          <AdminSystemView onNavigate={handleNavigate} />
          </Suspense>
        )}

        {currentView === 'admin_verification' && role === 'admin' && (
          <Suspense fallback={<div className="flex min-h-[200px] items-center justify-center text-slate-400">Loading...</div>}>
          <VerificationRequestsView onBack={() => handleNavigate('admin_system')} />
          </Suspense>
        )}

        {currentView === 'admin_reports' && role === 'admin' && (
          <Suspense fallback={<div className="flex min-h-[200px] items-center justify-center text-slate-400">Loading...</div>}>
          <ReportsPageView onBack={() => handleNavigate('admin_system')} />
          </Suspense>
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
          <Suspense fallback={<div className="flex min-h-[200px] items-center justify-center text-slate-400">Loading...</div>}>
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
          </Suspense>
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
          <Suspense fallback={<div className="flex min-h-[200px] items-center justify-center text-slate-400">Loading...</div>}>
          <DiscoverView onNavigate={handleNavigate} />
          </Suspense>
        )}

        {currentView === 'support' && (
          <SupportCenterView onNavigate={handleNavigate} />
        )}
      </main>

      {/* Footer */}
      <Footer onNavigate={handleNavigate} />

      {/* Bento Bottom Navigation Bar */}
      <BottomNavBar currentView={currentView} onNavigate={handleNavigate} />

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
    <MobileErrorBoundary>
      <AuthProvider>
        <LanguageProvider>
          <NotificationsProvider>
            <BookingProvider>
              <AppContent />
            </BookingProvider>
          </NotificationsProvider>
        </LanguageProvider>
      </AuthProvider>
    </MobileErrorBoundary>
  );
}
