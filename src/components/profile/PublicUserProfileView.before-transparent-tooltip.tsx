import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  CalendarDays,
  MapPin,
  Scissors,
  Share2,
  UserRound,
  Loader2,
} from 'lucide-react';
import { api } from '../../services/api';
import { UserRole } from '../../types';

interface PublicUser {
  id: string;
  name: string;
  avatar?: string | null;
  city?: string | null;
  role: UserRole;
  createdAt: string;
}

interface PublicUserProfileViewProps {
  userId: string;
  onBack: () => void;
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
}) => {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [salon, setSalon] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followLoading, setFollowLoading] = useState(false);

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
        alert(result.error || 'تعذر تحديث المتابعة.');
        return;
      }

      setIsFollowing(Boolean(result.isFollowing));
      setFollowersCount(Number(result.followersCount || 0));
      setFollowingCount(Number(result.followingCount || 0));
    } catch (followError) {
      console.error('[PUBLIC PROFILE FOLLOW]', followError);
      alert('تعذر تحديث المتابعة.');
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
        alert('تم نسخ رابط الملف الشخصي.');
      }
    } catch {
      // User cancelled share.
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
          العودة للبحث
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
  <div className="relative inline-flex items-center">
    <button
      type="button"
      onClick={() => {
        const el = document.getElementById('halaqi-admin-verified-info');
        if (el) el.classList.toggle('hidden');
      }}
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

    <div
      id="halaqi-admin-verified-info"
      className="hidden absolute top-7 right-0 z-50 w-max max-w-[260px] rounded-lg border border-white/10 bg-[#111111]/95 px-3 py-2 text-[11px] leading-5 text-gray-200 shadow-xl backdrop-blur-xl"
    >
      هذا الحساب موثّق رسميًا من حلاقي ويتمتع بمزايا خاصة.
    </div>
  </div>
)}

{user.role === 'salon_owner' && (
                  <span className="px-2.5 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#D4AF37] text-[10px] font-black">
                    موثّق كصاحب صالون
                  </span>
                )}
              </div>

              <p className="text-sm text-gray-400 mt-2">{roleLabel}</p>
            </div>

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
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-4 mt-8">
            <div className="rounded-2xl bg-[#171717] border border-white/5 p-4 text-center">
              <div className="text-xl font-black text-white">0</div>
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

      {/* Empty social area */}
      <section className="mt-5 rounded-[28px] bg-[#111111] border border-white/10 p-8 text-center">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-[#D4AF37]/10 flex items-center justify-center">
          <UserRound className="w-6 h-6 text-[#D4AF37]" />
        </div>

        <h2 className="text-lg font-black text-white mt-4">
          لا توجد منشورات بعد
        </h2>

        <p className="text-sm text-gray-500 mt-2">
          عندما يبدأ هذا المستخدم بنشر المحتوى سيظهر هنا.
        </p>
      </section>
    </div>
  );
};
