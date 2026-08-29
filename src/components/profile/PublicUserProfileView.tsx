import React, { useEffect, useState, useRef } from 'react';
import {
  ArrowLeft,
  CalendarDays,
  MapPin,
  Scissors,
  Share2,
  UserRound,
  Loader2,
  MessageSquare,
  Heart,
  MessageCircle,
  MoreVertical,
  Play,
} from 'lucide-react';
import { api } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';
import { ImageViewer } from '../common/ImageViewer';
import { REPORT_REASONS } from '../../constants/reportReasons';
import { UserRole } from '../../types';
import { notify, confirmDialog } from '../../utils/notifications';

interface PublicUser {
  id: string;
  name: string;
  username?: string;
  avatar?: string | null;
  city?: string | null;
  role: UserRole;
  createdAt: string;
}

interface PublicUserProfileViewProps {
  userId: string;
  onBack: () => void;
  onNavigate?: (view: string) => void;
}

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

export const PublicUserProfileView: React.FC<PublicUserProfileViewProps> = ({
  userId,
  onBack,
  onNavigate,
}) => {
  const { isRtl } = useLanguage();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [salon, setSalon] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followLoading, setFollowLoading] = useState(false);
  const [showBadgeTooltip, setShowBadgeTooltip] = useState(false);
  const badgeRef = useRef<HTMLDivElement>(null);

  // FEATURE 4: posted images grid + lightbox
  const [posts, setPosts] = useState<any[]>([]);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerIsVideo, setViewerIsVideo] = useState(false);

  // FEATURE 6: block / report menu
  const [blockMenuOpen, setBlockMenuOpen] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Click-outside handler to close badge tooltip
  useEffect(() => {
    if (!showBadgeTooltip) return;

    function handleClickOutside(e: MouseEvent) {
      if (badgeRef.current && !badgeRef.current.contains(e.target as Node)) {
        setShowBadgeTooltip(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showBadgeTooltip]);

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      setLoading(true);
      setError('');

      const result = await api.getPublicUserProfile(userId);

      if (!mounted) return;

      if (!result.success || !result.user) {
        setError(result.error || 'تعذر تحميل الملف الشخصي.');
        setLoading(false);
        return;
      }

      setUser(result.user);
      setSalon(result.salon || null);

      // FEATURE 6: load current block state for this profile.
      try {
        const bs = await api.getBlockStatus(userId);
        if (bs.success) setIsBlocking(Boolean(bs.isBlocking));
      } catch (bsError) {
        console.error('[PUBLIC PROFILE BLOCK STATUS]', bsError);
      }

      // FEATURE 4: load the user's posted images for the profile grid.
      try {
        const postsResult = await api.getUserPosts(userId);
        if (mounted && postsResult.success) {
          setPosts(Array.isArray(postsResult.posts) ? postsResult.posts : []);
        }
      } catch (postsError) {
        console.error('[PUBLIC PROFILE POSTS]', postsError);
      }

      try {
        const followResult = await api.getFollowStatus(userId);

        if (followResult.success) {
          setIsFollowing(Boolean(followResult.isFollowing));
          setFollowersCount(Number(followResult.followersCount || 0));
          setFollowingCount(Number(followResult.followingCount || 0));
        }
      } catch (followError) {
        console.error('[PUBLIC PROFILE FOLLOW STATUS]', followError);
      }

      setLoading(false);
    }

    loadProfile();

    return () => {
      mounted = false;
    };
  }, [userId]);

  const handleFollow = async () => {
    if (followLoading) return;

    setFollowLoading(true);

    try {
      const result = await api.toggleFollow(userId);

      if (!result.success) {
        notify(result.error || 'تعذر تحديث المتابعة.', 'error');
        return;
      }

      setIsFollowing(Boolean(result.isFollowing));
      setFollowersCount(Number(result.followersCount || 0));
      setFollowingCount(Number(result.followingCount || 0));
    } catch (followError) {
      console.error('[PUBLIC PROFILE FOLLOW]', followError);
      notify('تعذر تحديث المتابعة.', 'error');
    } finally {
      setFollowLoading(false);
    }
  };

  const roleLabel =
    user?.role === 'salon_owner'
      ? 'صاحب صالون'
      : user?.role === 'admin'
      ? 'مدير النظام'
      : 'عضو في حلاقي';

  const joinedDate = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('ar-IQ', {
        year: 'numeric',
        month: 'long',
      })
    : '';

  const handleShare = async () => {
    const url = window.location.href;

    try {
      if (navigator.share) {
        await navigator.share({
          title: user?.name || 'حساب في حلاقي',
          text: `شاهد ملف ${user?.name || 'هذا المستخدم'} على حلاقي`,
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        notify('تم نسخ رابط الملف الشخصي.', 'success');
      }
    } catch {
      // User cancelled share.
    }
  };

  // FEATURE 6: block / unblock
  const handleBlock = async () => {
    if (actionLoading) return;
    if (!(await confirmDialog({ message: isRtl ? 'هل تريد حظر هذا المستخدم؟' : 'Block this user?', danger: true }))) return;
    setActionLoading(true);
    const res = await api.blockUser(userId);
    setActionLoading(false);
    if (res.success) {
      setIsBlocking(true);
    } else {
      notify(res.error || (isRtl ? 'تعذر الحظر' : 'Could not block'), 'error');
    }
  };

  const handleUnblock = async () => {
    if (actionLoading) return;
    setActionLoading(true);
    const res = await api.unblockUser(userId);
    setActionLoading(false);
    if (res.success) {
      setIsBlocking(false);
    } else {
      notify(res.error || (isRtl ? 'تعذر إلغاء الحظر' : 'Could not unblock'), 'error');
    }
  };

  // FEATURE 6: report
  const submitReport = async () => {
    if (!reportReason) {
      notify(isRtl ? 'اختر سبباً للبلاغ' : 'Choose a reason', 'warning');
      return;
    }
    setActionLoading(true);
    const res = await api.reportUser(userId, reportReason, reportDetails);
    setActionLoading(false);
    setReportOpen(false);
    setReportReason('');
    setReportDetails('');
    if (res.success) {
      notify(isRtl ? 'تم إرسال البلاغ' : 'Report sent', 'success');
    } else {
      notify(res.error || (isRtl ? 'تعذر الإرسال' : 'Could not send'), 'error');
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#D4AF37] animate-spin" />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center">
        <div className="w-20 h-20 mx-auto rounded-full bg-[#181818] border border-white/10 flex items-center justify-center">
          <UserRound className="w-8 h-8 text-gray-500" />
        </div>

        <h2 className="text-xl font-black text-white mt-5">
          تعذر فتح الملف الشخصي
        </h2>

        <p className="text-sm text-gray-500 mt-2">
          {error || 'المستخدم غير موجود.'}
        </p>

        <button
          onClick={onBack}
          className="mt-6 px-5 py-2.5 rounded-xl bg-[#D4AF37] text-black font-bold text-sm"
        >
          {isRtl ? 'رجوع' : 'Back'}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto pb-20 animate-in fade-in duration-300">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-xl bg-[#141414] border border-white/10 flex items-center justify-center hover:bg-[#202020] transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-white rtl:rotate-180" />
        </button>

        <div className="relative">
          <button
            onClick={() => setBlockMenuOpen((v) => !v)}
            className="w-10 h-10 rounded-xl bg-[#141414] border border-white/10 flex items-center justify-center hover:bg-[#202020] transition-colors"
            aria-label="المزيد"
          >
            <MoreVertical className="w-5 h-5 text-white" />
          </button>

          {blockMenuOpen && (
            <div
              className={`absolute ${isRtl ? 'left-0' : 'right-0'} mt-2 w-44 z-30 bg-white/[0.06] backdrop-blur-2xl border border-white/[0.12] rounded-2xl p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.6)] ring-1 ring-white/[0.05]`}
            >
              <button
                onClick={() => {
                  setBlockMenuOpen(false);
                  if (isBlocking) {
                    handleUnblock();
                  } else {
                    handleBlock();
                  }
                }}
                className="w-full text-start px-3 py-2 rounded-xl text-red-400 hover:bg-red-950/40 text-xs transition-colors"
              >
                {isBlocking
                  ? (isRtl ? 'إلغاء الحظر' : 'Unblock')
                  : (isRtl ? 'حظر' : 'Block')}
              </button>
              <button
                onClick={() => {
                  setBlockMenuOpen(false);
                  setReportOpen(true);
                }}
                className="w-full text-start px-3 py-2 rounded-xl text-gray-300 hover:bg-white/5 text-xs transition-colors"
              >
                {isRtl ? 'إبلاغ' : 'Report'}
              </button>
            </div>
          )}
        </div>

        <button
          onClick={handleShare}
          className="px-4 py-2.5 rounded-xl bg-[#141414] border border-white/10 text-white text-xs font-bold flex items-center gap-2 hover:bg-[#202020] transition-colors"
        >
          <Share2 className="w-4 h-4 text-[#D4AF37]" />
          مشاركة
        </button>
      </div>

      {/* Profile Hero */}
      <section className="relative overflow-hidden rounded-[32px] bg-[#111111] border border-white/10 shadow-2xl">
        <div className="h-36 sm:h-48 bg-gradient-to-br from-[#241f0d] via-[#151515] to-[#0A0A0A]" />

        <div className="px-5 sm:px-10 pb-8">
          <div className="-mt-16 sm:-mt-20 flex flex-col sm:flex-row sm:items-end gap-5">
            <div className="relative shrink-0">
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-32 h-32 sm:w-40 sm:h-40 rounded-full object-cover border-4 border-[#111111] ring-2 ring-[#D4AF37]/60 shadow-2xl"
                />
              ) : (
                <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full bg-[#181818] border-4 border-[#111111] ring-2 ring-[#D4AF37]/60 flex items-center justify-center text-5xl font-black text-[#D4AF37]">
                  {user.name.charAt(0)}
                </div>
              )}

              <span className="absolute bottom-3 right-3 w-5 h-5 rounded-full bg-emerald-500 border-4 border-[#111111]" />
            </div>

            <div className="flex-1 pt-1 sm:pb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-black text-white">
                  {user.name}
                </h1>
                {user.role === 'admin' && (
                  <p className="text-black text-[11px] font-medium text-center mt-1">
                    المؤسس
                  </p>
                )}

                {user.role === 'admin' && (
  <div ref={badgeRef} className="relative inline-flex items-center">
    <button
      type="button"
      onClick={() => setShowBadgeTooltip(prev => !prev)}
      aria-label="الحساب موثق"
      className="inline-flex items-center justify-center cursor-pointer"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <path
          fill="#1877F2"
          d="M12 1.2l2.1 1.4 2.5-.2 1.4 2.1 2.3.9-.2 2.5L21.4 12l-1.3 2.1.2 2.5-2.1 1.4-.9 2.3-2.5-.2L12 22.8l-2.1-1.4-2.5.2-1.4-2.1-2.3-.9.2-2.5L2.6 12l1.3-2.1-.2-2.5 2.1-1.4.9-2.3 2.5.2L12 1.2z"
        />
        <path
          d="M7.4 12.2l3 3L16.8 9"
          fill="none"
          stroke="#fff"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>

    {!showBadgeTooltip && (
      <div
        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-lg bg-white/[0.08] border border-white/20 text-[10px] text-white/70 whitespace-nowrap backdrop-blur-2xl pointer-events-none"
      >
        ✓ موثق رسمياً
      </div>
    )}

    {showBadgeTooltip && (
      <div
        className="fixed left-1/2 top-20 z-[9999] w-[calc(100vw-32px)] max-w-[300px] -translate-x-1/2 rounded-xl border border-white/20 bg-white/[0.08] px-3 py-2.5 text-center text-[11px] font-medium leading-5 text-white shadow-[0_12px_40px_rgba(0,0,0,0.25)] backdrop-blur-2xl"
      >
        هذا الحساب موثّق رسميًا من حلاقي ويتمتع بمزايا خاصة.
      </div>
    )}
  </div>
)}

{user.role === 'salon_owner' && (
                  <span className="px-2.5 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#D4AF37] text-[10px] font-black">
                    موثّق كصاحب صالون
                  </span>
                )}
              </div>

              {user.username && (
                <p className="text-xs text-[#D4AF37]/80 font-medium mt-0.5">@{user.username}</p>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleFollow}
                disabled={followLoading}
                className={`px-6 py-3 rounded-xl font-black text-sm transition-all ${
                  isFollowing
                    ? 'bg-white/5 border border-white/10 text-white'
                    : 'bg-[#D4AF37] text-black hover:brightness-110'
                } ${followLoading ? 'opacity-60 cursor-wait' : ''}`}
              >
                {followLoading
                  ? 'جارٍ التحديث...'
                  : isFollowing
                    ? 'إلغاء المتابعة'
                    : 'متابعة'}
              </button>

              <button
                type="button"
                onClick={() => onNavigate?.(`messages:${userId}`)}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-black text-sm bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all"
                title="إرسال رسالة"
              >
                <MessageSquare className="w-4 h-4 text-[#D4AF37]" />
                مراسلة
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-4 mt-8">
            <div className="rounded-2xl bg-[#171717] border border-white/5 p-4 text-center">
              <div className="text-xl font-black text-white">{posts.length}</div>
              <div className="text-[11px] text-gray-500 mt-1">منشور</div>
            </div>

            <div className="rounded-2xl bg-[#171717] border border-white/5 p-4 text-center">
              <div className="text-xl font-black text-white">{followersCount}</div>
              <div className="text-[11px] text-gray-500 mt-1">متابع</div>
            </div>

            <div className="rounded-2xl bg-[#171717] border border-white/5 p-4 text-center">
              <div className="text-xl font-black text-white">{followingCount}</div>
              <div className="text-[11px] text-gray-500 mt-1">يتابع</div>
            </div>
          </div>

          {/* Bio / Intro */}
          {(user as any)?.bio && (
            <div className="mt-4 px-1">
              <p className="text-sm text-gray-300 leading-relaxed break-words">{(user as any).bio}</p>
            </div>
          )}
        </div>
      </section>

      {/* About */}
      <section className="mt-5 rounded-[28px] bg-[#111111] border border-white/10 p-6">
        <h2 className="text-lg font-black text-white mb-5">عن الحساب</h2>

        <div className="grid sm:grid-cols-2 gap-3">
          {user.city && (
            <div className="flex items-center gap-3 rounded-2xl bg-[#171717] border border-white/5 p-4">
              <MapPin className="w-5 h-5 text-[#D4AF37]" />
              <div>
                <div className="text-[10px] text-gray-500">الموقع</div>
                <div className="text-sm text-white font-bold">
                  {cityNames[user.city] || user.city}
                </div>
              </div>
            </div>
          )}

          {joinedDate && (
            <div className="flex items-center gap-3 rounded-2xl bg-[#171717] border border-white/5 p-4">
              <CalendarDays className="w-5 h-5 text-[#D4AF37]" />
              <div>
                <div className="text-[10px] text-gray-500">عضو منذ</div>
                <div className="text-sm text-white font-bold">
                  {joinedDate}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Salon */}
      {salon && user.role === 'salon_owner' && (
        <section className="mt-5 rounded-[28px] bg-[#111111] border border-white/10 p-6">
          <div className="flex items-center gap-2 mb-5">
            <Scissors className="w-5 h-5 text-[#D4AF37]" />
            <h2 className="text-lg font-black text-white">
              الصالون المرتبط بالحساب
            </h2>
          </div>

          <div className="rounded-2xl bg-[#171717] border border-white/5 p-5">
            <h3 className="text-xl font-black text-white">
              {salon.name || 'صالون'}
            </h3>

            {salon.city && (
              <p className="text-sm text-gray-400 mt-2 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#D4AF37]" />
                {cityNames[salon.city] || salon.city}
              </p>
            )}
          </div>
        </section>
      )}

      {/* Posted images grid (FEATURE 4) */}
      <section className="mt-5 rounded-[28px] bg-[#111111] border border-white/10 p-6">
        <h2 className="text-lg font-black text-white mb-5">المنشورات</h2>

        {posts.length === 0 ? (
          <div className="text-center py-10">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-[#D4AF37]/10 flex items-center justify-center">
              <UserRound className="w-6 h-6 text-[#D4AF37]" />
            </div>
            <h2 className="text-lg font-black text-white mt-4">
              لا توجد منشورات بعد
            </h2>
            <p className="text-sm text-gray-500 mt-2">
              عندما يبدأ هذا المستخدم بنشر المحتوى سيظهر هنا.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1">
            {posts.map((post) => (
              <div
                key={post.id}
                onClick={() => {
                  if (!post.imageUrl) return;
                  if (post.mediaType === 'video') {
                    setViewerIsVideo(true);
                    setViewerUrl(`/api/reels/${post.id}/video`);
                  } else {
                    setViewerIsVideo(false);
                    setViewerUrl(post.imageUrl);
                  }
                }}
                className="aspect-square bg-white/5 rounded-lg overflow-hidden relative group cursor-pointer"
              >
                {post.mediaType === 'video' ? (
                  <video
                    src={`/api/reels/${post.id}/video`}
                    className="w-full h-full object-cover"
                    muted
                    loop
                    playsInline
                    preload="metadata"
                  />
                ) : (
                  <img
                    src={post.imageUrl}
                    alt={post.caption || post.salonName || 'منشور'}
                    className="w-full h-full object-cover"
                  />
                )}
                {post.mediaType === 'video' && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Play className="h-8 w-8 text-white drop-shadow" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                  <div className="flex items-center gap-1 text-white">
                    <Heart size={16} />
                    <span className="font-semibold">{Number(post.likeCount || 0)}</span>
                  </div>
                  <div className="flex items-center gap-1 text-white">
                    <MessageCircle size={16} />
                    <span className="font-semibold">{Number(post.commentCount || 0)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <ImageViewer
        url={viewerUrl}
        video={viewerIsVideo}
        allowSave={!viewerIsVideo}
        onClose={() => {
          setViewerUrl(null);
          setViewerIsVideo(false);
        }}
      />

      {/* FEATURE 6: Report dialog (glass) */}
      {reportOpen && (
        <div className="fixed inset-0 z-[130] flex items-end justify-center bg-black/60 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-[24px] border border-white/[0.12] bg-white/[0.06] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.6)] ring-1 ring-white/[0.05] backdrop-blur-2xl">
            <h3 className="text-base font-black text-white">
              {isRtl ? 'الإبلاغ عن المستخدم' : 'Report user'}
            </h3>
            <p className="text-xs text-gray-400 mt-1 mb-4">
              {isRtl ? 'اختر السبب واكتب تفاصيل إن وُجدت' : 'Choose a reason and add details if needed'}
            </p>

            <div className="grid grid-cols-2 gap-2">
              {REPORT_REASONS.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setReportReason(r.id)}
                  className={`px-3 py-2 rounded-xl text-xs border transition-all ${
                    reportReason === r.id
                      ? 'bg-[#D4AF37]/[0.12] text-[#D4AF37] border-[#D4AF37]/30'
                      : 'bg-white/[0.04] text-gray-300 border-white/[0.12] hover:bg-white/10'
                  }`}
                >
                  {isRtl ? r.ar : r.en}
                </button>
              ))}
            </div>

            <textarea
              value={reportDetails}
              onChange={(e) => setReportDetails(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder={isRtl ? 'تفاصيل (اختياري)' : 'Details (optional)'}
              className="mt-4 w-full rounded-xl bg-white/[0.04] border border-white/[0.12] px-3 py-2 text-xs text-white placeholder-gray-500 outline-none focus:border-[#D4AF37]/30"
            />

            <div className="flex gap-2 mt-5">
              <button
                onClick={submitReport}
                disabled={actionLoading}
                className="flex-1 py-2.5 rounded-full bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-all disabled:opacity-60"
              >
                {isRtl ? 'إرسال البلاغ' : 'Submit report'}
              </button>
              <button
                onClick={() => {
                  setReportOpen(false);
                  setReportReason('');
                  setReportDetails('');
                }}
                disabled={actionLoading}
                className="flex-1 py-2.5 rounded-full bg-white/[0.06] hover:bg-white/10 border border-white/[0.12] text-gray-300 text-xs transition-all"
              >
                {isRtl ? 'إلغاء' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
