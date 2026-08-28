import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Heart,
  MessageCircle,
  Volume2,
  VolumeX,
  ArrowRight,
  ArrowLeft,
  X,
  Trash2,
  Plus,
  Loader2,
  Film,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { notify, confirmDialog } from '../../utils/notifications';
import { PostComment } from '../../types';

interface Reel {
  id: string;
  userId: string;
  userName?: string;
  userAvatar?: string;
  imageUrl?: string; // Holds the video URL for Reels
  caption: string;
  mediaType?: 'image' | 'video';
  duration?: number;
  likeCount: number;
  commentCount: number;
  liked?: boolean;
}

interface ReelsViewProps {
  onBack?: () => void;
}

const REEL_MAX_NORMAL = 60;
const REEL_MAX_PREMIUM = 120;

const ReelItem: React.FC<{
  reel: Reel;
  isRtl: boolean;
  muted: boolean;
  canDelete: boolean;
  onToggleMute: () => void;
  onOpenComments: (reel: Reel) => void;
  onDelete: (reel: Reel) => void;
}> = ({ reel, isRtl, muted, canDelete, onToggleMute, onOpenComments, onDelete }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [liked, setLiked] = useState<boolean>(Boolean(reel.liked));
  const [likeCount, setLikeCount] = useState<number>(Number(reel.likeCount) || 0);
  const [liking, setLiking] = useState(false);

  // Keep the element's muted property in sync (React's muted attr is unreliable).
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  // Autoplay when the reel is mostly visible; pause when it leaves.
  useEffect(() => {
    const el = containerRef.current;
    const video = videoRef.current;
    if (!el || !video) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
          video.muted = muted;
          video.play().catch(() => {
            /* Autoplay may be blocked; user can tap to play. */
          });
        } else {
          video.pause();
        }
      },
      { threshold: [0, 0.6, 1] }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [muted]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  };

  const handleLike = async () => {
    if (liking) return;
    setLiking(true);
    try {
      const res = await api.toggleUserPostLike(reel.id);
      if (res.success) {
        setLiked(Boolean(res.liked));
        setLikeCount(Number(res.likeCount) || 0);
      } else {
        notify(res.error || 'تعذر الإعجاب.', 'error');
      }
    } catch {
      notify('تعذر الإعجاب.', 'error');
    } finally {
      setLiking(false);
    }
  };

  return (
    <section
      ref={containerRef}
      className="relative h-[calc(100vh-260px)] w-full shrink-0 snap-start overflow-hidden bg-black"
    >
      <video
        ref={videoRef}
        src={reel.imageUrl}
        className="h-full w-full object-contain"
        playsInline
        loop
        muted={muted}
        preload="metadata"
        onClick={togglePlay}
      />

      {/* Top controls */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between p-3">
        <div className="pointer-events-auto">
          <button
            type="button"
            onClick={onToggleMute}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white backdrop-blur-xl"
            title={muted ? (isRtl ? 'تشغيل الصوت' : 'Unmute') : isRtl ? 'كتم' : 'Mute'}
          >
            {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </button>
        </div>
        {canDelete && (
          <div className="pointer-events-auto">
            <button
              type="button"
              onClick={() => onDelete(reel)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-rose-500/30 bg-rose-950/50 text-rose-300 backdrop-blur-xl"
              title={isRtl ? 'حذف الريل' : 'Delete Reel'}
            >
              <Trash2 className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>

      {/* Right action rail */}
      <div className="absolute bottom-20 right-3 flex flex-col items-center gap-5">
        <button
          type="button"
          onClick={handleLike}
          disabled={liking}
          className="flex flex-col items-center gap-1"
        >
          <span
            className={`flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-black/40 backdrop-blur-xl ${
              liked ? 'text-rose-500' : 'text-white'
            }`}
          >
            <Heart className={`h-6 w-6 ${liked ? 'fill-rose-500' : ''}`} />
          </span>
          <span className="text-xs font-bold text-white drop-shadow">
            {likeCount > 0 ? likeCount : ''}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onOpenComments(reel)}
          className="flex flex-col items-center gap-1"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-black/40 text-white backdrop-blur-xl">
            <MessageCircle className="h-6 w-6" />
          </span>
          <span className="text-xs font-bold text-white drop-shadow">
            {reel.commentCount > 0 ? reel.commentCount : ''}
          </span>
        </button>
      </div>

      {/* Author + caption */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-4 pb-5">
        <div className="flex items-center gap-2">
          {reel.userAvatar ? (
            <img
              src={reel.userAvatar}
              alt=""
              className="h-9 w-9 rounded-full border border-[#D4AF37]/40 object-cover"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#D4AF37]/15 text-sm font-bold text-[#D4AF37]">
              {(reel.userName || 'U').charAt(0)}
            </div>
          )}
          <span className="text-sm font-bold text-white drop-shadow">
            @{reel.userName || 'مستخدم'}
          </span>
        </div>
        {reel.caption ? (
          <p className="mt-2 line-clamp-3 text-sm leading-5 text-slate-200 drop-shadow">
            {reel.caption}
          </p>
        ) : null}
      </div>
    </section>
  );
};

export const ReelsView: React.FC<ReelsViewProps> = ({ onBack }) => {
  const { isRtl } = useLanguage();
  const { user, openAuthModal } = useAuth();

  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(true);

  // Comments modal
  const [commentsReel, setCommentsReel] = useState<Reel | null>(null);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentPosting, setCommentPosting] = useState(false);

  // Create Reel modal
  const [createOpen, setCreateOpen] = useState(false);
  const [createPreview, setCreatePreview] = useState<string | null>(null);
  const [createCaption, setCreateCaption] = useState('');
  const [createDuration, setCreateDuration] = useState(0);
  const [createUploading, setCreateUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadReels = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getReelsFeed();
      setReels(Array.isArray(res.posts) ? (res.posts as Reel[]) : []);
    } catch {
      setReels([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReels();
  }, [loadReels]);

  const openComments = async (reel: Reel) => {
    setCommentsReel(reel);
    setComments([]);
    setCommentText('');
    setCommentsLoading(true);
    try {
      const res = await api.getUserPostComments(reel.id);
      setComments(Array.isArray(res.comments) ? res.comments : []);
    } catch {
      setComments([]);
    } finally {
      setCommentsLoading(false);
    }
  };

  const postComment = async () => {
    if (!commentsReel) return;
    const text = commentText.trim();
    if (!text) return;
    setCommentPosting(true);
    try {
      const res = await api.addUserPostComment(commentsReel.id, text);
      if (res.success && res.comment) {
        setComments((prev) => [...prev, res.comment as PostComment]);
        setCommentText('');
        setCommentsReel((prev) =>
          prev ? { ...prev, commentCount: (prev.commentCount || 0) + 1 } : prev
        );
        setReels((prev) =>
          prev.map((r) =>
            r.id === commentsReel.id
              ? { ...r, commentCount: (r.commentCount || 0) + 1 }
              : r
          )
        );
      } else {
        notify(res.error || 'تعذر إضافة التعليق.', 'error');
      }
    } catch {
      notify('تعذر إضافة التعليق.', 'error');
    } finally {
      setCommentPosting(false);
    }
  };

  const handleDelete = async (reel: Reel) => {
    const confirmed = await confirmDialog({
      title: isRtl ? 'حذف الريل' : 'Delete Reel',
      message: isRtl
        ? 'هل أنت متأكد من حذف هذا الريل؟ لا يمكن التراجع.'
        : 'Delete this Reel permanently? This cannot be undone.',
      confirmText: isRtl ? 'حذف' : 'Delete',
      cancelText: isRtl ? 'إلغاء' : 'Cancel',
      danger: true,
    });
    if (!confirmed) return;
    try {
      const res = await api.deleteUserPost(reel.id);
      if (res.success) {
        setReels((prev) => prev.filter((r) => r.id !== reel.id));
        notify(isRtl ? 'تم حذف الريل.' : 'Reel deleted.', 'success');
      } else {
        notify(res.error || (isRtl ? 'تعذر حذف الريل.' : 'Could not delete Reel.'), 'error');
      }
    } catch {
      notify(isRtl ? 'تعذر حذف الريل.' : 'Could not delete Reel.', 'error');
    }
  };

  // ---- Create Reel flow ----
  const readDuration = (file: File): Promise<number> =>
    new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const vid = document.createElement('video');
      vid.preload = 'metadata';
      vid.onloadedmetadata = () => {
        const d = Number.isFinite(vid.duration) ? vid.duration : 0;
        URL.revokeObjectURL(url);
        resolve(d);
      };
      vid.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(0);
      };
      vid.src = url;
    });

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const allowed = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska', 'video/ogg'];
    if (!allowed.includes(file.type)) {
      notify(isRtl
          ? 'صيغة الفيديو غير مدعومة. استخدم MP4 أو WebM.'
          : 'Unsupported video format. Use MP4 or WebM.', 'error');
      return;
    }

    const limit = user?.isPremium ? REEL_MAX_PREMIUM : REEL_MAX_NORMAL;
    const duration = await readDuration(file);
    if (duration > limit) {
      notify(user?.isPremium
          ? isRtl
            ? 'مدة الريل تتجاوز الحد المسموح (120 ثانية للبريميوم).'
            : 'Reel exceeds the allowed length (120s for Premium).'
          : isRtl
          ? 'مدة الريل تتجاوز الحد المسموح (60 ثانية كحد أقصى).'
          : 'Reel exceeds the allowed length (max 60s).', 'error');
      return;
    }

    // Convert to base64 data URL and preview.
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setCreatePreview(dataUrl);
      setCreateDuration(Math.round(duration));
      setCreateCaption('');
      setCreateOpen(true);
    };
    reader.onerror = () => {
      notify(isRtl ? 'تعذر قراءة الفيديو.' : 'Could not read video.', 'error');
    };
    reader.readAsDataURL(file);
  };

  const submitReel = async () => {
    if (!createPreview) return;
    if (!user) {
      openAuthModal();
      return;
    }
    setCreateUploading(true);
    try {
      const upload = await api.uploadVideo(createPreview);
      if (!upload.success || !upload.videoUrl) {
        notify(upload.error || (isRtl ? 'تعذر رفع الفيديو.' : 'Could not upload video.'), 'error');
        return;
      }
      const create = await api.createUserPost({
        imageUrl: upload.videoUrl,
        caption: createCaption.trim(),
        mediaType: 'video',
        duration: createDuration,
      });
      if (create.success) {
        notify(isRtl ? 'تم نشر الريل.' : 'Reel published.', 'success');
        setCreateOpen(false);
        setCreatePreview(null);
        setCreateCaption('');
        setCreateDuration(0);
        loadReels();
      } else {
        notify(create.error || (isRtl ? 'تعذر نشر الريل.' : 'Could not publish Reel.'), 'error');
      }
    } catch {
      notify(isRtl ? 'تعذر نشر الريل.' : 'Could not publish Reel.', 'error');
    } finally {
      setCreateUploading(false);
    }
  };

  const BackIcon = isRtl ? ArrowLeft : ArrowRight;

  return (
    <div className="flex h-[calc(100vh-260px)] flex-col">
      {/* Reels header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-white backdrop-blur-xl"
              title={isRtl ? 'رجوع' : 'Back'}
            >
              <BackIcon className="h-5 w-5" />
            </button>
          )}
          <div className="flex items-center gap-2">
            <Film className="h-5 w-5 text-[#D4AF37]" />
            <span className="text-lg font-black text-white">
              {isRtl ? 'ريلز' : 'Reels'}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            if (!user) {
              openAuthModal();
              return;
            }
            fileInputRef.current?.click();
          }}
          className="flex items-center gap-1.5 rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/[0.08] px-3.5 py-2 text-sm font-bold text-[#D4AF37] backdrop-blur-xl"
        >
          <Plus className="h-4 w-4" />
          {isRtl ? 'ريل جديد' : 'New Reel'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime,video/*"
          className="hidden"
          onChange={onPickFile}
        />
      </div>

      {/* Vertical Reels feed */}
      {loading ? (
        <div className="flex flex-1 items-center justify-center rounded-[24px] border border-white/[0.12] bg-white/[0.06] backdrop-blur-2xl">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-[#D4AF37]" />
            <span className="text-xs text-slate-500">
              {isRtl ? 'جاري تحميل الريلز...' : 'Loading Reels...'}
            </span>
          </div>
        </div>
      ) : reels.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-[24px] border border-white/[0.12] bg-white/[0.06] px-6 py-16 text-center backdrop-blur-2xl">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#D4AF37]/15 bg-[#D4AF37]/[0.05]">
            <Film className="h-6 w-6 text-[#D4AF37]/70" />
          </div>
          <p className="text-sm font-semibold text-slate-300">
            {isRtl ? 'لا توجد ريلز بعد' : 'No Reels yet'}
          </p>
          <button
            type="button"
            onClick={() => {
              if (!user) {
                openAuthModal();
                return;
              }
              fileInputRef.current?.click();
            }}
            className="rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/[0.08] px-4 py-2 text-sm font-bold text-[#D4AF37]"
          >
            {isRtl ? 'انشر أول ريل' : 'Publish the first Reel'}
          </button>
        </div>
      ) : (
        <div className="flex-1 snap-y snap-mandatory overflow-y-auto rounded-[24px] border border-white/[0.12] bg-black">
          {reels.map((reel) => (
            <ReelItem
              key={reel.id}
              reel={reel}
              isRtl={isRtl}
              muted={muted}
              canDelete={Boolean(user && reel.userId === user.id)}
              onToggleMute={() => setMuted((m) => !m)}
              onOpenComments={openComments}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Comments modal (in-app, no native dialogs) */}
      {commentsReel && (
        <div className="fixed inset-0 z-[200] flex flex-col bg-[#0A0A0A]/95 backdrop-blur-2xl">
          <div className="flex items-center justify-between border-b border-white/[0.10] p-4">
            <span className="text-base font-bold text-white">
              {isRtl ? 'التعليقات' : 'Comments'}
            </span>
            <button
              type="button"
              onClick={() => setCommentsReel(null)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {commentsLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-[#D4AF37]" />
              </div>
            ) : comments.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-500">
                {isRtl ? 'لا توجد تعليقات بعد' : 'No comments yet'}
              </p>
            ) : (
              comments.map((c) => (
                <div
                  key={c.id}
                  className="rounded-2xl border border-white/[0.08] bg-white/[0.05] p-3"
                >
                  <div className="mb-1 flex items-center gap-2">
                    {c.userAvatar ? (
                      <img
                        src={c.userAvatar}
                        alt=""
                        className="h-7 w-7 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#D4AF37]/15 text-xs font-bold text-[#D4AF37]">
                        {(c.userName || 'U').charAt(0)}
                      </div>
                    )}
                    <span className="text-sm font-bold text-white">@{c.userName}</span>
                  </div>
                  <p className="text-sm leading-5 text-slate-200">{c.comment}</p>
                </div>
              ))
            )}
          </div>

          <div className="flex items-center gap-2 border-t border-white/[0.10] p-3">
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') postComment();
              }}
              placeholder={isRtl ? 'أضف تعليقاً...' : 'Add a comment...'}
              className="flex-1 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2.5 text-sm text-white outline-none placeholder:text-slate-500"
            />
            <button
              type="button"
              onClick={postComment}
              disabled={commentPosting || !commentText.trim()}
              className="rounded-full bg-[#D4AF37] px-4 py-2.5 text-sm font-bold text-black disabled:opacity-50"
            >
              {commentPosting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isRtl ? (
                'إرسال'
              ) : (
                'Send'
              )}
            </button>
          </div>
        </div>
      )}

      {/* Create Reel modal */}
      {createOpen && createPreview && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-md overflow-hidden rounded-[24px] border border-white/[0.12] bg-white/[0.06] p-4 shadow-[0_8px_32px_rgba(0,0,0,0.6)] ring-1 ring-white/[0.05] backdrop-blur-2xl">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-base font-bold text-white">
                {isRtl ? 'ريل جديد' : 'New Reel'}
              </span>
              <button
                type="button"
                onClick={() => {
                  setCreateOpen(false);
                  setCreatePreview(null);
                }}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-3 flex justify-center rounded-2xl bg-black">
              <video
                src={createPreview}
                className="max-h-72 w-full object-contain"
                controls
                muted
              />
            </div>

            <textarea
              value={createCaption}
              onChange={(e) => setCreateCaption(e.target.value)}
              rows={2}
              placeholder={isRtl ? 'اكتب وصفاً (اختياري)...' : 'Write a caption (optional)...'}
              className="mb-3 w-full resize-none rounded-2xl border border-white/15 bg-white/[0.06] px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500"
            />

            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-slate-500">
                {createDuration > 0
                  ? `${Math.floor(createDuration / 60)}:${String(Math.floor(createDuration % 60)).padStart(2, '0')}`
                  : ''}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCreateOpen(false);
                    setCreatePreview(null);
                  }}
                  className="rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-sm font-bold text-slate-200"
                >
                  {isRtl ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={submitReel}
                  disabled={createUploading}
                  className="flex items-center gap-1.5 rounded-full bg-[#D4AF37] px-4 py-2 text-sm font-bold text-black disabled:opacity-50"
                >
                  {createUploading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isRtl ? 'نشر' : 'Publish'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
