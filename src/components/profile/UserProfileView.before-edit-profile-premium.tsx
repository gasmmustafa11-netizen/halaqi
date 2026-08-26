import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Share2,
  Settings,
  Grid3x3,
  Bookmark,
  Check,
  MapPin,
  Link as LinkIcon,
  Calendar,
  Heart,
  MessageCircle,
  Loader2,
    LogOut,
    Globe2,
    LockKeyhole,
    X,
} from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { api } from '../../services/api';

interface UserPost {
  id: string;
  salonId?: string;
  ownerId?: string;
  salonName?: string;
  imageUrl: string;
  caption?: string;
  createdAt?: string;
  updatedAt?: string;
  likeCount?: number;
  commentCount?: number;
}

const UserProfileView: React.FC = () => {
  const { user, logout } = useAuth();
    const { language, setLanguage } = useLanguage();

  const [activeTab, setActiveTab] = useState<'posts' | 'saved'>('posts');
  const [posts, setPosts] = useState<UserPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [postsError, setPostsError] = useState('');

  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const userId = user?.id;

  const [showSettings, setShowSettings] = useState(false);
    const [showEditProfile, setShowEditProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editCity, setEditCity] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const handleEditProfile = () => {
    setEditName((user as any)?.name || (user as any)?.fullName || '');
    setEditPhone((user as any)?.phone || '');
    setEditCity((user as any)?.city || '');
    setShowEditProfile(true);
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      alert('الاسم مطلوب.');
      return;
    }

    setSavingProfile(true);

    try {
      const result = await api.updateMyProfile({
        name: editName.trim(),
        phone: editPhone.trim() || undefined,
        city: editCity.trim() || undefined,
      });

      if (!result.success) {
        alert(result.error || 'تعذر تحديث الملف الشخصي.');
        return;
      }

      setShowEditProfile(false);

      // تحديث بيانات المستخدم الموجودة في AuthContext إذا كانت الدالة متوفرة.
      window.location.reload();
    } catch (error) {
      console.error('[EDIT PROFILE]', error);
      alert('حدث خطأ أثناء تحديث الملف الشخصي.');
    } finally {
      setSavingProfile(false);
    }
  };


  useEffect(() => {
    if (!userId) {
      setPosts([]);
      setLoadingPosts(false);
      return;
    }

    let mounted = true;

    async function loadProfileData() {
      setLoadingPosts(true);
      setPostsError('');

      const [postsResult, followResult] = await Promise.all([
        api.getUserPosts(userId),
        api.getFollowStatus(userId),
      ]);

      if (!mounted) return;

      if (postsResult.success) {
        setPosts(Array.isArray(postsResult.posts) ? postsResult.posts : []);
      } else {
        setPosts([]);
        setPostsError(postsResult.error || 'تعذر تحميل المنشورات.');
      }

      if (followResult.success) {
        setIsFollowing(Boolean(followResult.isFollowing));
        setFollowersCount(Number(followResult.followersCount || 0));
        setFollowingCount(Number(followResult.followingCount || 0));
      }

      setLoadingPosts(false);
    }

    loadProfileData();

    return () => {
      mounted = false;
    };
  }, [userId]);

  const handleProfileImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) return;

    /*
     * لا نرفع الصورة هنا بشكل وهمي.
     * نربط هذا لاحقًا مع نظام رفع الصور الموجود بالمشروع.
     */
    console.log('Profile image selected:', file.name);
  };

  const handleShare = async () => {
    const url = window.location.href;

    try {
      if (navigator.share) {
        await navigator.share({
          title: user?.name || 'حسابي في حلاقي',
          text: `شاهد ملف ${user?.name || 'هذا المستخدم'} على حلاقي`,
          url,
        });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        alert('تم نسخ رابط الملف الشخصي.');
      }
    } catch {
      // المستخدم ألغى المشاركة
    }
  };

  const handleFollow = async () => {
    if (!userId) return;

    const result = await api.toggleFollow(userId);

    if (!result.success) {
      alert(result.error || 'تعذر تحديث المتابعة.');
      return;
    }

    setIsFollowing(Boolean(result.isFollowing));
    setFollowersCount(Number(result.followersCount || 0));
    setFollowingCount(Number(result.followingCount || 0));
  };

  const profileName =
    user?.name ||
    (user as any)?.fullName ||
    'المستخدم';

  const profileAvatar =
    (user as any)?.avatar ||
    (user as any)?.profileImage ||
    null;

  const profileCity = (user as any)?.city || '';

  const joinedDate = (user as any)?.createdAt
    ? new Date((user as any).createdAt).toLocaleDateString('ar-IQ', {
        year: 'numeric',
        month: 'long',
      })
    : '';

  const roleLabel =
    (user as any)?.role === 'salon_owner'
      ? 'صاحب صالون'
      : (user as any)?.role === 'admin'
        ? 'مدير النظام'
        : 'عضو في حلاقي';

  const cityNames: Record<string, string> = {
    baghdad: 'بغداد',
    erbil: 'أربيل',
    basra: 'البصرة',
    nasiriyah: 'الناصرية',
    najaf: 'النجف',
    karbala: 'كربلاء',
    sulaymaniyah: 'السليمانية',
    mosul: 'الموصل',
    hilla: 'الحلة',
    kirkuk: 'كركوك',
  };

  return (
    <div
      className="min-h-screen bg-[#08090B] text-white pb-20"
      dir="rtl"
    >
      <div className="relative">
        {/* Cover */}
        <div className="h-32 bg-gradient-to-b from-[#D4AF37]/20 via-[#D4AF37]/10 to-transparent" />

        <div className="px-5 -mt-16">
          {/* Profile image */}
          <div className="flex justify-center mb-4">
            <div className="relative">
              <div className="w-32 h-32 rounded-full bg-gradient-to-br from-[#D4AF37] via-[#D4AF37]/80 to-[#D4AF37]/60 p-1 shadow-2xl shadow-[#D4AF37]/30">
                {profileAvatar ? (
                  <img
                    src={profileAvatar}
                    alt={profileName}
                    className="w-full h-full rounded-full object-cover border-4 border-[#08090B]"
                  />
                ) : (
                  <div className="w-full h-full rounded-full border-4 border-[#08090B] bg-[#171717] flex items-center justify-center text-5xl font-black text-[#D4AF37]">
                    {profileName.charAt(0)}
                  </div>
                )}
              </div>

              <button
                onClick={handleProfileImageClick}
                className="absolute bottom-0 right-0 w-10 h-10 bg-[#D4AF37] rounded-full flex items-center justify-center shadow-lg hover:bg-[#C5A028] transition-all"
              >
                <Camera size={18} className="text-[#08090B]" />
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          </div>

          {/* Name */}
          <div className="text-center mb-4">
            <div className="flex items-center justify-center gap-2 mb-1">
              <h1 className="text-2xl font-bold">
                {profileName}
              </h1>

              {(user as any)?.role === 'salon_owner' && (
                <div className="w-6 h-6 bg-[#D4AF37] rounded-full flex items-center justify-center">
                  <Check size={14} className="text-[#08090B]" />
                </div>
              )}
            </div>

            <p className="text-[#9CA3AF] text-sm">
              {roleLabel}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mb-6">
            <button
              onClick={handleEditProfile}
              className="flex-1 bg-[#D4AF37] text-[#08090B] py-3 rounded-xl font-semibold hover:bg-[#C5A028] transition-all shadow-lg shadow-[#D4AF37]/20"
            >
              تعديل الملف الشخصي
            </button>

            <button
              onClick={handleShare}
              className="w-12 h-12 bg-white/5 backdrop-blur-sm rounded-xl flex items-center justify-center hover:bg-white/10 transition-all border border-white/10"
            >
              <Share2 size={20} className="text-[#D4AF37]" />
            </button>

            <button
                type="button"
                onClick={() => setShowSettings(true)}
                aria-label={language === 'ar' ? 'الإعدادات' : 'Settings'}
                className="w-12 h-12 bg-white/5 backdrop-blur-sm rounded-xl flex items-center justify-center hover:bg-[#D4AF37]/10 hover:border-[#D4AF37]/30 transition-all border border-white/10"
              >
                <Settings size={20} className="text-[#D4AF37]" />
              </button>
          </div>

          {/* Stats - real data */}
          <div className="flex justify-around py-4 mb-6 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10">
            <div className="text-center">
              <p className="text-xl font-bold text-[#D4AF37]">
                {posts.length}
              </p>
              <p className="text-xs text-[#9CA3AF] mt-1">
                منشور
              </p>
            </div>

            <div className="w-px bg-white/10" />

            <div className="text-center">
              <p className="text-xl font-bold text-[#D4AF37]">
                {followersCount}
              </p>
              <p className="text-xs text-[#9CA3AF] mt-1">
                متابع
              </p>
            </div>

            <div className="w-px bg-white/10" />

            <div className="text-center">
              <p className="text-xl font-bold text-[#D4AF37]">
                {followingCount}
              </p>
              <p className="text-xs text-[#9CA3AF] mt-1">
                يتابع
              </p>
            </div>
          </div>

          {/* About */}
          <div className="mb-6">
            <p className="text-sm leading-relaxed text-[#E5E7EB]">
              {roleLabel}
              <br />
              {profileCity && (
                <>
                  <span className="inline-flex items-center gap-1.5">
                      <MapPin size={14} className="text-[#D4AF37]" />
                      {cityNames[profileCity] || profileCity}
                    </span>
                </>
              )}
            </p>

            {profileCity && (
              <div className="flex items-center gap-2 mt-3 text-[#D4AF37] text-sm">
                <MapPin size={16} />
                <span>
                  {cityNames[profileCity] || profileCity}
                </span>
              </div>
            )}

            {joinedDate && (
              <div className="flex items-center gap-2 mt-3 text-[#9CA3AF] text-sm">
                <Calendar size={16} />
                <span>عضو منذ {joinedDate}</span>
              </div>
            )}
          </div>

          {/* Follow status */}
          <div className="mb-6">
            <button
              onClick={handleFollow}
              className={`w-full py-3 rounded-xl font-bold transition-all ${
                isFollowing
                  ? 'bg-white/5 border border-white/10 text-white'
                  : 'bg-[#D4AF37] text-[#08090B]'
              }`}
            >
              {isFollowing ? 'إلغاء المتابعة' : 'متابعة'}
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-white/10 mb-6">
            <button
              onClick={() => setActiveTab('posts')}
              className={`flex-1 py-3 flex items-center justify-center gap-2 transition-all relative ${
                activeTab === 'posts'
                  ? 'text-[#D4AF37]'
                  : 'text-[#9CA3AF]'
              }`}
            >
              <Grid3x3 size={20} />
              <span className="font-semibold">المنشورات</span>

              {activeTab === 'posts' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#D4AF37]" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('saved')}
              className={`flex-1 py-3 flex items-center justify-center gap-2 transition-all relative ${
                activeTab === 'saved'
                  ? 'text-[#D4AF37]'
                  : 'text-[#9CA3AF]'
              }`}
            >
              <Bookmark size={20} />
              <span className="font-semibold">المحفوظات</span>

              {activeTab === 'saved' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#D4AF37]" />
              )}
            </button>
          </div>

          {/* Posts */}
          {activeTab === 'posts' && (
            <>
              {loadingPosts ? (
                <div className="py-16 flex justify-center">
                  <Loader2 className="w-8 h-8 text-[#D4AF37] animate-spin" />
                </div>
              ) : postsError ? (
                <div className="py-12 text-center text-sm text-red-400">
                  {postsError}
                </div>
              ) : posts.length === 0 ? (
                <div className="py-16 text-center">
                  <Grid3x3 className="w-10 h-10 mx-auto text-[#D4AF37] mb-3" />
                  <p className="text-white font-bold">
                    لا توجد منشورات بعد
                  </p>
                  <p className="text-sm text-[#9CA3AF] mt-2">
                    عندما ينشر المستخدم محتوى سيظهر هنا.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-1">
                  {posts.map((post) => (
                    <div
                      key={post.id}
                      className="aspect-square bg-white/5 rounded-lg overflow-hidden relative group cursor-pointer"
                    >
                      <img
                        src={post.imageUrl}
                        alt={post.caption || post.salonName || 'منشور'}
                        className="w-full h-full object-cover"
                      />

                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                        <div className="flex items-center gap-1 text-white">
                          <Heart size={16} />
                          <span className="font-semibold">
                            {Number(post.likeCount || 0)}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 text-white">
                          <MessageCircle size={16} />
                          <span className="font-semibold">
                            {Number(post.commentCount || 0)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Saved - intentionally not fake */}
          {activeTab === 'saved' && (
            <div className="py-16 text-center">
              <Bookmark className="w-10 h-10 mx-auto text-[#D4AF37] mb-3" />
              <p className="text-white font-bold">
                المحفوظات
              </p>
              <p className="text-sm text-[#9CA3AF] mt-2">
                نظام المنشورات المحفوظة سيتم ربطه بقاعدة البيانات بشكل مستقل.
              </p>
            </div>
          )}
        </div>
      </div>


      {showSettings && (
          <div
            className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-md px-4 py-6"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) {
                setShowSettings(false);
              }
            }}
          >
            <div
              dir={language === 'ar' ? 'rtl' : 'ltr'}
              className="relative w-full max-w-lg overflow-hidden rounded-[30px] border border-white/10 bg-[#0D0F14] shadow-[0_30px_100px_rgba(0,0,0,0.7)]"
            >
              <div className="absolute -top-24 -right-24 h-56 w-56 rounded-full bg-[#D4AF37]/10 blur-3xl pointer-events-none" />
              <div className="absolute -bottom-32 -left-24 h-64 w-64 rounded-full bg-violet-500/[0.06] blur-3xl pointer-events-none" />

              <div className="relative border-b border-white/[0.07] px-6 py-6">
                <div className="flex items-center justify-between gap-4">

                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#D4AF37]/20 bg-[#D4AF37]/10">
                      <Settings className="h-5 w-5 text-[#D4AF37]" />
                    </div>

                    <div>
                      <h2 className="text-xl font-black text-white">
                        {language === 'ar' ? 'الإعدادات' : 'Settings'}
                      </h2>

                      <p className="mt-1 text-xs text-slate-500">
                        {language === 'ar'
                          ? 'تحكم بتجربة حسابك في حلاقي'
                          : 'Control your Halaqi account experience'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowSettings(false)}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-400 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
                  >
                    <X size={18} />
                  </button>

                </div>
              </div>

              <div className="relative space-y-3 p-5 sm:p-6">

                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">

                  <div className="flex items-center gap-4">

                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-400/10">
                      <Globe2 className="h-5 w-5 text-violet-300" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-white">
                        {language === 'ar' ? 'لغة التطبيق' : 'App language'}
                      </p>

                      <p className="mt-1 text-[11px] leading-5 text-slate-500">
                        {language === 'ar'
                          ? 'غيّر لغة واجهة حلاقي مباشرة'
                          : 'Change the Halaqi interface language instantly'}
                      </p>
                    </div>

                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl border border-white/[0.06] bg-black/20 p-1">

                    <button
                      type="button"
                      onClick={() => setLanguage('ar')}
                      className={`rounded-lg px-4 py-2.5 text-xs font-black transition ${
                        language === 'ar'
                          ? 'bg-[#D4AF37] text-black shadow-lg shadow-[#D4AF37]/10'
                          : 'text-slate-400 hover:bg-white/[0.05] hover:text-white'
                      }`}
                    >
                      العربية
                    </button>

                    <button
                      type="button"
                      onClick={() => setLanguage('en')}
                      className={`rounded-lg px-4 py-2.5 text-xs font-black transition ${
                        language === 'en'
                          ? 'bg-[#D4AF37] text-black shadow-lg shadow-[#D4AF37]/10'
                          : 'text-slate-400 hover:bg-white/[0.05] hover:text-white'
                      }`}
                    >
                      English
                    </button>

                  </div>
                </div>

                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 opacity-70">

                  <div className="flex items-center gap-4">

                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-400/10">
                      <LockKeyhole className="h-5 w-5 text-blue-300" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-white">
                        {language === 'ar' ? 'كلمة المرور' : 'Password'}
                      </p>

                      <p className="mt-1 text-[11px] leading-5 text-slate-500">
                        {language === 'ar'
                          ? 'سيتم تفعيل تغيير كلمة المرور بعد ربط API الأمان.'
                          : 'Password changes will be enabled after the security API is connected.'}
                      </p>
                    </div>

                    <span className="shrink-0 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[10px] font-bold text-slate-500">
                      {language === 'ar' ? 'قريبًا' : 'Coming soon'}
                    </span>

                  </div>

                </div>

                <button
                  type="button"
                  onClick={() => {
                    const confirmed = window.confirm(
                      language === 'ar'
                        ? 'هل أنت متأكد من تسجيل الخروج من حسابك؟'
                        : 'Are you sure you want to sign out of your account?'
                    );

                    if (!confirmed) return;

                    setShowSettings(false);
                    logout();
                  }}
                  className="group flex w-full items-center gap-4 rounded-2xl border border-red-500/10 bg-red-500/[0.035] p-4 text-right transition-all hover:border-red-500/25 hover:bg-red-500/[0.07]"
                >

                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-500/10">
                    <LogOut className="h-5 w-5 text-red-400" />
                  </div>

                  <div className="flex-1">
                    <p className="text-sm font-bold text-white">
                      {language === 'ar' ? 'تسجيل الخروج' : 'Sign out'}
                    </p>

                    <p className="mt-1 text-[11px] text-slate-500">
                      {language === 'ar'
                        ? 'إنهاء جلسة الحساب الحالية'
                        : 'End the current account session'}
                    </p>
                  </div>

                </button>

                <div className="pt-2 text-center">
                  <p className="text-[10px] tracking-wide text-slate-600">
                    Halaqi · Account Settings
                  </p>
                </div>

              </div>
            </div>
          </div>
        )}

        {showEditProfile && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div
            className="w-full max-w-md bg-[#111214] border border-white/10 rounded-2xl p-5 shadow-2xl"
            dir="rtl"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">
                تعديل الملف الشخصي
              </h2>

              <button
                type="button"
                onClick={() => setShowEditProfile(false)}
                disabled={savingProfile}
                className="w-9 h-9 rounded-full bg-white/5 text-gray-300 hover:bg-white/10 transition-all"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  الاسم
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-[#D4AF37]"
                  placeholder="اكتب اسمك"
                  disabled={savingProfile}
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  رقم الهاتف
                </label>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-[#D4AF37]"
                  placeholder="رقم الهاتف"
                  disabled={savingProfile}
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  المدينة
                </label>
                <input
                  type="text"
                  value={editCity}
                  onChange={(e) => setEditCity(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-[#D4AF37]"
                  placeholder="المدينة"
                  disabled={savingProfile}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={savingProfile}
                  className="flex-1 py-3 rounded-xl bg-[#D4AF37] text-[#08090B] font-bold hover:bg-[#C5A028] transition-all disabled:opacity-50"
                >
                  {savingProfile ? 'جاري الحفظ...' : 'حفظ التغييرات'}
                </button>

                <button
                  type="button"
                  onClick={() => setShowEditProfile(false)}
                  disabled={savingProfile}
                  className="px-5 py-3 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all disabled:opacity-50"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }

        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
};

export default UserProfileView;

export { UserProfileView };
