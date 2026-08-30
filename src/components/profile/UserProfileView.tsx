import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Share2,
    Settings,
    Moon,
    Sun,
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
    UserRound,
    Phone,
    Save,
    Play,
    LifeBuoy,
    ShieldCheck,
} from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { api } from '../../services/api';
import { deactivatePush } from '../../services/push';
import { compressImageToDataUrl } from '../../utils/compressImage';
import { CaptionText } from '../posts/CaptionText';
import { ImageViewer } from '../common/ImageViewer';
import VerifiedBadge from '../common/VerifiedBadge';
import { notify, confirmDialog } from '../../utils/notifications';
import { getTheme, setTheme } from '../../utils/theme';
import HalaqiVerifiedSubscription from './HalaqiVerifiedSubscription';

interface UserProfileViewProps {
  onNavigate?: (view: string) => void;
}

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


const UserProfileView: React.FC<UserProfileViewProps> = ({ onNavigate }) => {
  const { user, logout, refreshUser } = useAuth();
    const { isRtl, language, setLanguage } = useLanguage();

  const [activeTab, setActiveTab] = useState<'posts' | 'saved'>('posts');
  const [posts, setPosts] = useState<UserPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [postsError, setPostsError] = useState('');

  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  // FEATURE 3: followers / following list viewer
  const [listKind, setListKind] = useState<'followers' | 'following' | null>(null);
  const [listUsers, setListUsers] = useState<any[]>([]);
  const [listLoading, setListLoading] = useState(false);

  const openFollowersList = async (kind: 'followers' | 'following') => {
    setListKind(kind);
    setListLoading(true);
    setListUsers([]);
    const res =
      kind === 'followers'
        ? await api.getFollowers(userId)
        : await api.getFollowing(userId);
    if (res.success) setListUsers(res.users || []);
    setListLoading(false);
  };

  // FEATURE 4: image lightbox for posted images
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  // FEATURE: track the opened post so the owner can delete their own photo.
  const [viewerPost, setViewerPost] = useState<UserPost | null>(null);
  // FEATURE: distinguish Reels (video) from images in the viewer.
  const [viewerIsVideo, setViewerIsVideo] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const postFileInputRef = useRef<HTMLInputElement>(null);

  const handleCreatePostClick = () => {
    postFileInputRef.current?.click();
  };

  // ===== Post Composer state =====
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerFile, setComposerFile] = useState<File | null>(null);
  const [composerPreview, setComposerPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionResults, setMentionResults] = useState<
    Array<{ id: string; name: string; avatar?: string }>
  >([]);
  const [hashtagInput, setHashtagInput] = useState('');
  const captionRef = useRef<HTMLTextAreaElement>(null);

  const DRAFT_KEY = 'halaqi_post_draft';

  // Restore text-only draft (never the image/base64).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d?.caption) setCaption(d.caption);
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Persist text-only draft.
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ caption }));
    } catch {
      /* ignore */
    }
  }, [caption]);

  // Mention search reusing the existing /api/search users endpoint.
  useEffect(() => {
    const q = mentionQuery.trim();
    if (!q) {
      setMentionResults([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      const res = await api.search(q);
      if (!cancelled) setMentionResults(res.users.slice(0, 5));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [mentionQuery]);

  const detectedHashtags = Array.from(
    new Set((caption.match(/#[\p{L}\p{N}_]+/gu) || []) as string[])
  );
  const detectedMentions = Array.from(
    new Set((caption.match(/@[\p{N}\p{L}_]+/gu) || []) as string[])
  );

  const insertAtCursor = (text: string) => {
    const el = captionRef.current;
    if (!el) {
      setCaption((c) => c + text);
      return;
    }
    const start = el.selectionStart ?? caption.length;
    const end = el.selectionEnd ?? caption.length;
    const next = caption.slice(0, start) + text + caption.slice(end);
    setCaption(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + text.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const addHashtag = () => {
    const t = hashtagInput.trim().replace(/^#/, '');
    if (!t) return;
    setCaption((c) => (c ? c + ' ' : '') + '#' + t);
    setHashtagInput('');
  };

  const removeToken = (token: string) => {
    try {
      const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      setCaption((c) =>
        c
          .replace(new RegExp(escaped, 'gu'), '')
          .replace(/\s+/g, ' ')
          .trim()
      );
    } catch {
      /* ignore */
    }
  };

  const handleSuggestCaption = async () => {
    setSuggesting(true);
    try {
      const res = await api.suggestCaption(caption);
      if (res.success && res.caption) {
        setCaption(res.caption);
      } else {
        notify(res.error || 'تعذر اقتراح تعليق.', 'error');
      }
    } catch {
      notify('تعذر اقتراح تعليق.', 'error');
    } finally {
      setSuggesting(false);
    }
  };

  const handlePostImageSelected = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;

    setComposerFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setComposerPreview(
        typeof reader.result === 'string' ? reader.result : null
      );
    };
    reader.readAsDataURL(file);
    setComposerOpen(true);
  };

  const handlePublish = async () => {
    if (!composerFile) return;
    setPublishing(true);
    try {
      const compressed = await compressImageToDataUrl(composerFile, {
        maxDimension: 1080,
        quality: 0.8,
      });

      const upload = await api.uploadImage(compressed);

      if (!upload.success || !upload.imageUrl) {
        notify(upload.error || 'تعذر رفع الصورة.', 'error');
        return;
      }

      const result = await api.createUserPost({
        imageUrl: upload.imageUrl,
        caption,
      });

      if (!result.success) {
        notify(result.error || 'تعذر نشر الصورة.', 'error');
        return;
      }

      notify('تم نشر الصورة بنجاح.', 'success');
      setComposerOpen(false);
      setComposerFile(null);
      setComposerPreview(null);
      setCaption('');
      setShowPreview(false);
      setMentionQuery('');
      setMentionResults([]);
      localStorage.removeItem(DRAFT_KEY);
      setPosts((current) => [result.post, ...current]);
    } catch (error) {
      console.error('[CREATE USER POST]', error);
      notify('حدث خطأ أثناء نشر الصورة.', 'error');
    } finally {
      setPublishing(false);
    }
  };

  const userId = user?.id;

  const [showSettings, setShowSettings] = useState(false);
  const [showVerifiedSubscription, setShowVerifiedSubscription] = useState(false);
    const [showEditProfile, setShowEditProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editBio, setEditBio] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const handleEditProfile = () => {
    setEditName((user as any)?.name || (user as any)?.fullName || '');
    setEditPhone((user as any)?.phone || '');
    setEditCity((user as any)?.city || '');
    setEditBio((user as any)?.bio || '');
    setShowEditProfile(true);
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      notify('الاسم مطلوب.', 'warning');
      return;
    }

    setSavingProfile(true);

    try {
      const result = await api.updateMyProfile({
        name: editName.trim(),
        phone: editPhone.trim() || undefined,
        city: editCity.trim() || undefined,
        bio: editBio.trim() || undefined,
      });

      if (!result.success) {
        notify(result.error || 'تعذر تحديث الملف الشخصي.', 'error');
        return;
      }

      setShowEditProfile(false);

      // تحديث بيانات المستخدم الموجودة في AuthContext إذا كانت الدالة متوفرة.
      await refreshUser();
    } catch (error) {
      console.error('[EDIT PROFILE]', error);
      notify('حدث خطأ أثناء تحديث الملف الشخصي.', 'error');
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

      const postsResult = await api.getUserPosts(userId);

      if (!mounted) return;

      if (postsResult.success) {
        setPosts(Array.isArray(postsResult.posts) ? postsResult.posts : []);
      } else {
        setPosts([]);
        setPostsError(postsResult.error || 'تعذر تحميل المنشورات.');
      }

      // FEATURE 3: own/admin profile must show real follower counts from the
      // user_follows source of truth (previously these stayed at 0).
      try {
        const status = await api.getFollowStatus(userId);
        if (status.success && mounted) {
          setFollowersCount(status.followersCount);
          setFollowingCount(status.followingCount);
        }
      } catch {
        /* keep defaults */
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        const upload = await api.uploadImage(dataUrl);
        if (!upload.success || !upload.imageUrl) {
          notify(upload.error || 'تعذر رفع الصورة الشخصية.', 'error');
          return;
        }
        const update = await api.updateMyAvatar(upload.imageUrl);
        if (update.success) {
          notify('تم تحديث الصورة الشخصية.', 'success');
          await refreshUser();
        } else {
          notify(update.error || 'تعذر حفظ الصورة الشخصية.', 'error');
        }
      };
      reader.onerror = () => {
        notify('تعذر قراءة الملف.', 'error');
      };
    } catch (err) {
      console.error('[PROFILE AVATAR UPLOAD]', err);
      notify('حدث خطأ أثناء رفع الصورة.', 'error');
    }
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
        notify('تم نسخ رابط الملف الشخصي.', 'success');
      }
    } catch {
      // المستخدم ألغى المشاركة
    }
  };

  // FEATURE: permanently delete one of the user's own published photos.
  // Confirmation uses the in-app Halaqi modal (never a native dialog), and the
  // backend enforces ownership. Profile/gallery state is refreshed on success.
  const handleDeletePost = async (postId: string) => {
    const confirmed = await confirmDialog({
      message: isRtl
        ? 'هل تريد حذف هذه الصورة نهائياً؟ لا يمكن التراجع.'
        : 'Delete this photo permanently? This cannot be undone.',
      danger: true,
      confirmText: isRtl ? 'حذف' : 'Delete',
      cancelText: isRtl ? 'إلغاء' : 'Cancel',
    });
    if (!confirmed) return;

    try {
      const res = await api.deleteUserPost(postId);
      if (res.success) {
        setPosts((prev) => prev.filter((p) => p.id !== postId));
        setViewerUrl(null);
        setViewerPost(null);
        notify(isRtl ? 'تم حذف الصورة بنجاح.' : 'Photo deleted.', 'success');
      } else {
        notify(
          res.error || (isRtl ? 'تعذر حذف الصورة.' : 'Could not delete photo.'),
          'error'
        );
      }
    } catch {
      notify(isRtl ? 'تعذر حذف الصورة.' : 'Could not delete photo.', 'error');
    }
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
              {(user as any)?.isVerified && <VerifiedBadge />}

                              {(user as any)?.role === 'admin' && (
                                <p className="text-black text-[11px] font-medium text-center mt-1">
                                  المؤسس
                                </p>
                              )}

              {(user as any)?.role === 'salon_owner' && (
                <div className="w-6 h-6 bg-[#D4AF37] rounded-full flex items-center justify-center">
                  <Check size={14} className="text-[#08090B]" />
                </div>
              )}
            </div>
            {(user as any)?.username && (
              <p className="text-xs text-[#D4AF37]/80 font-medium mt-0.5">@{(user as any).username}</p>
            )}
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

            <button
              type="button"
              onClick={() => openFollowersList('followers')}
              className="text-center cursor-pointer hover:opacity-80 transition-opacity"
            >
              <p className="text-xl font-bold text-[#D4AF37]">
                {followersCount}
              </p>
              <p className="text-xs text-[#9CA3AF] mt-1">
                متابع
              </p>
            </button>

            <div className="w-px bg-white/10" />

            <button
              type="button"
              onClick={() => openFollowersList('following')}
              className="text-center cursor-pointer hover:opacity-80 transition-opacity"
            >
              <p className="text-xl font-bold text-[#D4AF37]">
                {followingCount}
              </p>
              <p className="text-xs text-[#9CA3AF] mt-1">
                يتابع
              </p>
            </button>
          </div>

          {/* Bio / Intro */}
          {(user as any)?.bio && (
            <div className="mb-4 px-1">
              <p className="text-sm text-gray-200 leading-relaxed break-words">{(user as any).bio}</p>
            </div>
          )}

          {/* About */}
          <div className="mb-6">
            <p className="text-sm leading-relaxed text-[#E5E7EB]">
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

          {/* Publish */}
          <div className="mb-6">
            <button
              type="button"
              onClick={handleCreatePostClick}
              className="group relative w-full overflow-hidden rounded-2xl border border-[#D4AF37]/30 bg-white/[0.04] px-5 py-3.5 text-white shadow-[0_8px_30px_rgba(0,0,0,0.35)] backdrop-blur-2xl transition-all duration-300 hover:border-[#D4AF37]/60 hover:bg-[#D4AF37]/[0.08] hover:shadow-[0_0_30px_rgba(212,175,55,0.12)] active:scale-[0.99]"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-[#D4AF37]/[0.08] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <span className="relative flex items-center justify-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 text-[#D4AF37] shadow-[0_0_18px_rgba(212,175,55,0.08)]">
                  <span className="text-xl leading-none">+</span>
                </span>
                <span className="text-sm font-black tracking-wide">
                  {language === 'ar' ? 'نشر منشور' : 'Create Post'}
                </span>
              </span>
            </button>
          </div>

          <input
            ref={postFileInputRef}
            type="file"
            accept="image/*"

            onChange={handlePostImageSelected}
            className="hidden"
          />

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
                      onClick={() => {
                        if (!post.imageUrl) return;
                        setViewerPost(post);
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

                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-400/10">
                      <Sun className="h-5 w-5 text-amber-300" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-white">
                        {language === 'ar' ? 'المظهر' : 'Appearance'}
                      </p>
                      <p className="mt-1 text-[11px] leading-5 text-slate-500">
                        {language === 'ar' ? 'داكن / فاتح' : 'Dark / Light'}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl border border-white/[0.06] bg-black/20 p-1">
                    <button
                      type="button"
                      onClick={() => setTheme('dark')}
                      className={`rounded-lg px-4 py-2.5 text-xs font-black transition ${getTheme() === 'dark' ? 'bg-[#D4AF37] text-black shadow-lg shadow-[#D4AF37]/10' : 'text-slate-400 hover:bg-white/[0.05] hover:text-white'}`}
                    >
                      {language === 'ar' ? 'داكن' : 'Dark'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setTheme('light')}
                      className={`rounded-lg px-4 py-2.5 text-xs font-black transition ${getTheme() === 'light' ? 'bg-[#D4AF37] text-black shadow-lg shadow-[#D4AF37]/10' : 'text-slate-400 hover:bg-white/[0.05] hover:text-white'}`}
                    >
                      {language === 'ar' ? 'فاتح' : 'Light'}
                    </button>
                  </div>
                </div>

                  <button
                    type="button"
                    onClick={() => {
                      setShowSettings(false);
                      onNavigate?.('map');
                    }}
                    className="group flex w-full items-center gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 text-right transition-all hover:border-[#D4AF37]/25 hover:bg-[#D4AF37]/[0.05]"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#D4AF37]/10">
                      <MapPin className="h-5 w-5 text-[#D4AF37]" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-white">
                        {language === 'ar' ? 'الخريطة' : 'Map'}
                      </p>

                      <p className="mt-1 text-[11px] leading-5 text-slate-500">
                        {language === 'ar'
                          ? 'استعرض مواقع الصالونات على الخريطة'
                          : 'Explore salon locations on the map'}
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowSettings(false);
                      onNavigate?.('support');
                    }}
                    className="group flex w-full items-center gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 text-right transition-all hover:border-[#D4AF37]/25 hover:bg-[#D4AF37]/[0.05]"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#D4AF37]/10">
                      <LifeBuoy className="h-5 w-5 text-[#D4AF37]" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-white">
                        {language === 'ar' ? 'بريد الدعم' : 'Support Mail'}
                      </p>

                      <p className="mt-1 text-[11px] leading-5 text-slate-500">
                        {language === 'ar'
                          ? 'تواصل مع فريق الدعم وأرسل طلباتك وبلاغاتك'
                          : 'Contact support and manage your tickets'}
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowVerifiedSubscription(true);
                    }}
                    className="group flex w-full items-center gap-4 rounded-2xl border border-[#D4AF37]/20 bg-[#D4AF37]/[0.06] p-4 text-right transition-all hover:border-[#D4AF37]/40 hover:bg-[#D4AF37]/[0.1]"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#D4AF37]/10">
                      <ShieldCheck className="h-5 w-5 text-[#D4AF37]" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-white">
                        {language === 'ar' ? 'اشتراك حلاقي الموثّق' : 'Halaqi Verified Subscription'}
                      </p>

                      <p className="mt-1 text-[11px] leading-5 text-slate-400">
                        {language === 'ar'
                          ? 'قدّم طلب توثيق حسابك — قريباً'
                          : 'Apply for account verification — coming soon'}
                      </p>
                    </div>

                    <span className="shrink-0 rounded-lg border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-2.5 py-1.5 text-[10px] font-bold text-[#D4AF37]">
                      {language === 'ar' ? 'قريباً' : 'Soon'}
                    </span>
                  </button>

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
                  onClick={async () => {
                    const confirmed = await confirmDialog({
                      message:
                        language === 'ar'
                          ? 'هل أنت متأكد من تسجيل الخروج من حسابك؟'
                          : 'Are you sure you want to sign out of your account?',
                      danger: true,
                    });

                    if (!confirmed) return;

                    setShowSettings(false);
                    // Stop further push notifications to this device before
                    // clearing the session (non-blocking, safe on web).
                    await deactivatePush();
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

        <HalaqiVerifiedSubscription
          open={showVerifiedSubscription}
          onClose={() => setShowVerifiedSubscription(false)}
        />

        {showEditProfile && (
          <div
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-md px-4 py-6"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget && !savingProfile) {
                setShowEditProfile(false);
              }
            }}
          >
            <div
              dir={language === 'ar' ? 'rtl' : 'ltr'}
              className="relative w-full max-w-lg overflow-hidden rounded-[30px] border border-white/10 bg-[#0D0F14] shadow-[0_30px_100px_rgba(0,0,0,0.72)]"
            >

              {/* Ambient luxury glow */}
              <div className="pointer-events-none absolute -top-28 -right-24 h-64 w-64 rounded-full bg-[#D4AF37]/10 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-32 -left-24 h-72 w-72 rounded-full bg-violet-500/[0.055] blur-3xl" />

              {/* Header */}
              <div className="relative border-b border-white/[0.07] px-6 py-6 sm:px-7">

                <div className="flex items-center justify-between gap-4">

                  <div className="flex items-center gap-4">

                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#D4AF37]/20 bg-[#D4AF37]/10">
                      <UserRound className="h-5 w-5 text-[#D4AF37]" />
                    </div>

                    <div className="min-w-0">
                      <h2 className="text-xl font-black tracking-tight text-white">
                        {language === 'ar'
                          ? 'تعديل الملف الشخصي'
                          : 'Edit profile'}
                      </h2>

                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {language === 'ar'
                          ? 'حدّث معلوماتك الشخصية واحفظ التغييرات مباشرة'
                          : 'Update your personal information and save your changes'}
                      </p>
                    </div>

                  </div>

                  <button
                    type="button"
                    onClick={() => setShowEditProfile(false)}
                    disabled={savingProfile}
                    aria-label={language === 'ar' ? 'إغلاق' : 'Close'}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-400 transition-all hover:border-white/20 hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <X size={18} />
                  </button>

                </div>
              </div>

              {/* Form */}
              <div className="relative space-y-4 p-5 sm:p-7">

                {/* Name */}
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 transition-all focus-within:border-[#D4AF37]/30 focus-within:bg-white/[0.035]">

                  <div className="mb-3 flex items-center gap-3">

                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#D4AF37]/10">
                      <UserRound className="h-4 w-4 text-[#D4AF37]" />
                    </div>

                    <div>
                      <label
                        htmlFor="edit-profile-name"
                        className="block text-sm font-bold text-white"
                      >
                        {language === 'ar' ? 'الاسم' : 'Name'}
                      </label>

                      <p className="mt-0.5 text-[10px] text-slate-500">
                        {language === 'ar'
                          ? 'الاسم الظاهر في ملفك'
                          : 'Your public profile name'}
                      </p>
                    </div>

                  </div>

                  <input
                    id="edit-profile-name"
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    disabled={savingProfile}
                    autoComplete="name"
                    placeholder={
                      language === 'ar'
                        ? 'اكتب اسمك'
                        : 'Enter your name'
                    }
                    className="w-full rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3 text-sm font-medium text-white outline-none transition-all placeholder:text-slate-600 focus:border-[#D4AF37]/50 focus:bg-black/30 focus:ring-2 focus:ring-[#D4AF37]/10 disabled:cursor-not-allowed disabled:opacity-50"
                  />

                </div>

                {/* Phone */}
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 transition-all focus-within:border-[#D4AF37]/30 focus-within:bg-white/[0.035]">

                  <div className="mb-3 flex items-center gap-3">

                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-400/10">
                      <Phone className="h-4 w-4 text-blue-300" />
                    </div>

                    <div>
                      <label
                        htmlFor="edit-profile-phone"
                        className="block text-sm font-bold text-white"
                      >
                        {language === 'ar'
                          ? 'رقم الهاتف'
                          : 'Phone number'}
                      </label>

                      <p className="mt-0.5 text-[10px] text-slate-500">
                        {language === 'ar'
                          ? 'رقم التواصل المرتبط بحسابك'
                          : 'Phone number linked to your account'}
                      </p>
                    </div>

                  </div>

                  <input
                    id="edit-profile-phone"
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    disabled={savingProfile}
                    autoComplete="tel"
                    dir="ltr"
                    placeholder={
                      language === 'ar'
                        ? 'رقم الهاتف'
                        : 'Phone number'
                    }
                    className="w-full rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3 text-sm font-medium text-white outline-none transition-all placeholder:text-slate-600 focus:border-[#D4AF37]/50 focus:bg-black/30 focus:ring-2 focus:ring-[#D4AF37]/10 disabled:cursor-not-allowed disabled:opacity-50"
                  />

                </div>

                {/* City */}
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 transition-all focus-within:border-[#D4AF37]/30 focus-within:bg-white/[0.035]">

                  <div className="mb-3 flex items-center gap-3">

                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-400/10">
                      <MapPin className="h-4 w-4 text-emerald-300" />
                    </div>

                    <div>
                      <label
                        htmlFor="edit-profile-city"
                        className="block text-sm font-bold text-white"
                      >
                        {language === 'ar'
                          ? 'المدينة'
                          : 'City'}
                      </label>

                      <p className="mt-0.5 text-[10px] text-slate-500">
                        {language === 'ar'
                          ? 'موقعك الظاهر في الملف الشخصي'
                          : 'Your profile location'}
                      </p>
                    </div>

                  </div>

                  <input
                    id="edit-profile-city"
                    type="text"
                    value={editCity}
                    onChange={(e) => setEditCity(e.target.value)}
                    disabled={savingProfile}
                    autoComplete="address-level2"
                    placeholder={
                      language === 'ar'
                        ? 'اكتب مدينتك'
                        : 'Enter your city'
                    }
                    className="w-full rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3 text-sm font-medium text-white outline-none transition-all placeholder:text-slate-600 focus:border-[#D4AF37]/50 focus:bg-black/30 focus:ring-2 focus:ring-[#D4AF37]/10 disabled:cursor-not-allowed disabled:opacity-50"
                  />

                </div>

                {/* Bio */}
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 transition-all focus-within:border-[#D4AF37]/30 focus-within:bg-white/[0.035]">
                  <label htmlFor="edit-profile-bio" className="block text-sm font-bold text-white mb-2">
                    {language === 'ar' ? 'الوصف الشخصي' : 'Bio'}
                  </label>
                  <textarea
                    id="edit-profile-bio"
                    value={editBio}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val.length <= 40) setEditBio(val);
                    }}
                    disabled={savingProfile}
                    maxLength={40}
                    rows={2}
                    placeholder={language === 'ar' ? 'أخبرنا عن نفسك (حتى 40 حرف)' : 'Tell us about yourself (up to 40 chars)'}
                    className="w-full rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3 text-sm font-medium text-white outline-none transition-all placeholder:text-slate-600 focus:border-[#D4AF37]/50 focus:bg-black/30 focus:ring-2 focus:ring-[#D4AF37]/10 resize-none disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px] text-slate-500">{editBio.length}/40</span>
                    {editBio.trim().length === 40 && (
                      <span className="text-[10px] text-[#D4AF37] font-semibold">{language === 'ar' ? 'تم الوصول للحد الأقصى' : 'Max reached'}</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row">

                  <button
                    type="button"
                    onClick={() => setShowEditProfile(false)}
                    disabled={savingProfile}
                    className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3.5 text-sm font-bold text-slate-300 transition-all hover:border-white/20 hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {language === 'ar'
                      ? 'إلغاء'
                      : 'Cancel'}
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveProfile}
                    disabled={savingProfile}
                    className="group flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#D4AF37] px-5 py-3.5 text-sm font-black text-[#08090B] shadow-lg shadow-[#D4AF37]/10 transition-all hover:bg-[#E1BF4A] hover:shadow-[#D4AF37]/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {savingProfile ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {language === 'ar'
                          ? 'جاري الحفظ...'
                          : 'Saving...'}
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 transition-transform group-hover:scale-110" />
                        {language === 'ar'
                          ? 'حفظ التغييرات'
                          : 'Save changes'}
                      </>
                    )}
                  </button>

                </div>

                {/* Footer */}
                <div className="pt-1 text-center">
                  <p className="text-[10px] tracking-wide text-slate-600">
                    Halaqi · Profile
                  </p>
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

      {composerOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => setComposerOpen(false)}
        >
          <div
            className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-white/[0.12] bg-white/[0.06] shadow-[0_8px_32px_rgba(0,0,0,0.6)] ring-1 ring-white/[0.05] backdrop-blur-2xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
            dir={isRtl ? 'rtl' : 'ltr'}
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 border-b border-white/[0.12] px-4 py-3">
              <h3 className="text-sm font-black text-white">
                {isRtl ? 'إنشاء منشور' : 'Create Post'}
              </h3>
              <button
                type="button"
                onClick={() => setComposerOpen(false)}
                className="text-lg text-slate-400 transition-colors hover:text-white"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 p-4">
              {/* Image preview */}
              {composerPreview && (
                <div className="overflow-hidden rounded-2xl border border-white/[0.12] bg-black/30">
                  <img
                    src={composerPreview}
                    alt="معاينة"
                    className="max-h-72 w-full object-contain"
                  />
                </div>
              )}

              {/* Caption */}
              <div>
                <textarea
                  ref={captionRef}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  dir="auto"
                  rows={3}
                  maxLength={500}
                  placeholder={
                    isRtl
                      ? 'اكتب شيئاً عن صورتك... مثال: مرحباً، أنا أحمد وهذه صورتي ✂️'
                      : 'Write something about your photo... e.g. Hi, I am Ahmed and this is my photo ✂️'
                  }
                  className="w-full resize-none rounded-2xl border border-white/[0.12] bg-white/[0.06] px-3 py-2.5 text-sm text-white outline-none transition-all placeholder:text-slate-500 focus:border-[#D4AF37]/40 focus:ring-1 focus:ring-[#D4AF37]/20"
                />
                <div className="mt-1 text-right text-[10px] text-slate-500">
                  {caption.length}/500
                </div>
              </div>

              {/* Quick emojis */}
              <div className="flex flex-wrap gap-2">
                {['✂️', '🔥', '❤️', '😎', '💈', '📸'].map((em) => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => insertAtCursor(em)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.12] bg-white/[0.06] text-lg transition-all hover:border-[#D4AF37]/40 hover:bg-[#D4AF37]/[0.08]"
                  >
                    {em}
                  </button>
                ))}
              </div>

              {/* Hashtags */}
              <div>
                <div className="flex items-center gap-2">
                  <input
                    value={hashtagInput}
                    onChange={(e) => setHashtagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addHashtag();
                      }
                    }}
                    dir="auto"
                    placeholder={isRtl ? 'أضف وسمًا مثل Ahmed' : 'Add hashtag e.g. Ahmed'}
                    className="flex-1 rounded-xl border border-white/[0.12] bg-white/[0.06] px-3 py-2 text-xs text-white outline-none placeholder:text-slate-500 focus:border-[#D4AF37]/40"
                  />
                  <button
                    type="button"
                    onClick={addHashtag}
                    className="rounded-xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-3 py-2 text-xs font-bold text-[#D4AF37]"
                  >
                    +
                  </button>
                </div>
                {detectedHashtags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {detectedHashtags.map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center gap-1 rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/[0.08] px-2.5 py-1 text-xs font-semibold text-[#D4AF37]"
                      >
                        {t}
                        <button
                          type="button"
                          onClick={() => removeToken(t)}
                          className="text-[#D4AF37]/70 hover:text-white"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Mentions */}
              <div>
                <input
                  value={mentionQuery}
                  onChange={(e) => setMentionQuery(e.target.value)}
                  dir="auto"
                  placeholder={isRtl ? 'اكتب @ للإشارة إلى شخص' : 'Type @ to mention someone'}
                  className="w-full rounded-xl border border-white/[0.12] bg-white/[0.06] px-3 py-2 text-xs text-white outline-none placeholder:text-slate-500 focus:border-[#D4AF37]/40"
                />
                {mentionResults.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {mentionResults.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          insertAtCursor('@' + u.name + ' ');
                          setMentionQuery('');
                          setMentionResults([]);
                        }}
                        className="flex w-full items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-2.5 py-2 text-start text-xs text-slate-200 transition-all hover:border-[#D4AF37]/30"
                      >
                        {u.avatar ? (
                          <img
                            src={u.avatar}
                            alt={u.name}
                            className="h-6 w-6 rounded-full object-cover"
                          />
                        ) : (
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#D4AF37]/20 text-[10px] font-bold text-[#D4AF37]">
                            {(u.name || '?').charAt(0)}
                          </span>
                        )}
                        <span className="truncate">{u.name}</span>
                      </button>
                    ))}
                  </div>
                )}
                {detectedMentions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {detectedMentions.map((m) => (
                      <span
                        key={m}
                        className="inline-flex items-center gap-1 rounded-full border border-sky-400/30 bg-sky-400/[0.08] px-2.5 py-1 text-xs font-semibold text-sky-400"
                      >
                        {m}
                        <button
                          type="button"
                          onClick={() => removeToken(m)}
                          className="text-sky-400/70 hover:text-white"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Suggest + Preview */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleSuggestCaption}
                  disabled={suggesting}
                  className="flex items-center gap-1.5 rounded-xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-3 py-2 text-xs font-bold text-[#D4AF37] transition-all hover:bg-[#D4AF37]/[0.16] disabled:opacity-50"
                >
                  {suggesting ? '...' : '✨ '}
                  {isRtl ? 'اقترح تعليقاً' : 'Suggest a caption'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPreview((v) => !v)}
                  className="flex items-center gap-1.5 rounded-xl border border-white/[0.12] bg-white/[0.06] px-3 py-2 text-xs font-bold text-slate-200 transition-all hover:border-[#D4AF37]/30"
                >
                  👁️ {isRtl ? 'معاينة' : 'Preview'}
                </button>
              </div>

              {/* Preview */}
              {showPreview && (
                <div className="rounded-2xl border border-white/[0.12] bg-white/[0.04] p-4">
                  {composerPreview && (
                    <img
                      src={composerPreview}
                      alt="معاينة"
                      className="mb-3 max-h-60 w-full rounded-xl object-cover"
                    />
                  )}
                  {caption.trim() ? (
                    <p
                      className="whitespace-pre-wrap text-sm leading-6 text-slate-200"
                      dir="auto"
                    >
                      <CaptionText
                        text={caption}
                        onHashtag={() => {}}
                        onMention={async (name) => {
                          const res = await api.search(name);
                          const u = res.users?.[0];
                          if (u && onNavigate) onNavigate(`user:${u.id}`);
                        }}
                      />
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500">
                      {isRtl ? 'لا يوجد تعليق بعد.' : 'No caption yet.'}
                    </p>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setComposerOpen(false)}
                  className="rounded-xl bg-white/5 px-4 py-2 text-xs text-slate-300"
                >
                  {isRtl ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={handlePublish}
                  disabled={publishing || !composerFile}
                  className="rounded-xl bg-[#D4AF37] px-5 py-2 text-xs font-black text-black shadow-[0_0_16px_-2px_rgba(212,175,55,0.5)] ring-1 ring-[#D4AF37]/20 transition-all hover:bg-[#e5c45b] disabled:opacity-40"
                >
                  {publishing
                    ? isRtl
                      ? 'جارٍ النشر...'
                      : 'Publishing...'
                    : isRtl
                      ? 'نشر'
                      : 'Publish'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FEATURE 3: Followers / Following list modal */}
      {listKind && (
        <div
          className="fixed inset-0 z-[120] flex items-end justify-center bg-black/60 p-4 sm:items-center"
          onClick={() => setListKind(null)}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-[24px] border border-white/[0.12] bg-white/[0.06] shadow-[0_8px_32px_rgba(0,0,0,0.6)] ring-1 ring-white/[0.05] backdrop-blur-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07]">
              <p className="text-sm font-black text-white">
                {listKind === 'followers'
                  ? (isRtl ? 'المتابعون' : 'Followers')
                  : (isRtl ? 'يتابع' : 'Following')}
              </p>
              <button
                type="button"
                onClick={() => setListKind(null)}
                className="w-8 h-8 rounded-full bg-white/5 text-gray-300 hover:bg-white/10 flex items-center justify-center"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              {listLoading ? (
                <p className="px-5 py-10 text-center text-xs text-gray-400">
                  {isRtl ? 'جارٍ التحميل...' : 'Loading...'}
                </p>
              ) : listUsers.length === 0 ? (
                <p className="px-5 py-10 text-center text-xs text-gray-400">
                  {isRtl ? 'لا يوجد' : 'Nothing here yet'}
                </p>
              ) : (
                listUsers.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      setListKind(null);
                      if (onNavigate) onNavigate(`user:${u.id}`);
                    }}
                    className="flex w-full items-center gap-3 px-5 py-3 text-start transition-colors hover:bg-white/[0.04]"
                  >
                    {u.avatar ? (
                      <img
                        src={u.avatar}
                        alt={u.name}
                        className="h-10 w-10 rounded-full object-cover border border-white/10"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-[#181818] border border-white/10 flex items-center justify-center text-sm font-black text-[#D4AF37]">
                        {(u.name || '؟').charAt(0)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-white">{u.name}</p>
                      {u.city && (
                        <p className="truncate text-[10px] text-gray-500">{u.city}</p>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <ImageViewer
        url={viewerUrl}
        video={viewerIsVideo}
        allowSave={!viewerIsVideo}
        allowDelete={Boolean(viewerPost && user && viewerPost.userId === user.id)}
        onDelete={
          viewerPost && user && viewerPost.userId === user.id
            ? () => handleDeletePost(viewerPost.id)
            : undefined
        }
        onClose={() => {
          setViewerUrl(null);
          setViewerPost(null);
          setViewerIsVideo(false);
        }}
      />
    </div>
  );
};

export default UserProfileView;

export { UserProfileView };
