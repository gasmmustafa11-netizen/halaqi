import React, {
  useEffect,
  useMemo,
  useState,
  useRef,
} from 'react';
import { notify } from '../../utils/notifications';
import {
  Heart,
  MessageCircle,
  Send,
  Loader2,
  ThumbsDown,
  Pencil,
  Trash2,
  Quote,
  ArrowLeft,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { CaptionText } from './CaptionText';
import { ReelsView } from './ReelsView';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { saveImage } from '../../utils/saveImage';
import { Salon, SalonPost, PostComment, UserPost } from '../../types';

interface PostsViewProps {
  salons: Salon[];
  selectedPostId?: string | null;
  onSelectSalon?: (salon: Salon) => void;
  onNavigate?: (view: string) => void;
}

/*
 * توجيه اللايكات والتعليقات حسب نوع المنشور:
 * salon -> /api/salon-posts، user -> /api/user-posts
 */
const getPostType = (post: any): 'salon' | 'user' =>
  post?.postType === 'user' ? 'user' : 'salon';

export const PostsView: React.FC<PostsViewProps> = ({
  salons,
  selectedPostId,
  onSelectSalon,
  onNavigate,
}) => {
  const { isRtl } = useLanguage();
  const { user, openAuthModal } = useAuth();

  const [posts, setPosts] = useState<SalonPost[]>([]);
  const [userPosts, setUserPosts] = useState<UserPost[]>([]);
  const [loading, setLoading] = useState(true);
  const hasLoadedPosts = React.useRef(false);
  const [likedPosts, setLikedPosts] = useState<Record<string, boolean>>({});
  const [comments, setComments] = useState<Record<string, PostComment[]>>({});
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [directPostLoading, setDirectPostLoading] = useState(false);

  // Posts section sub-tabs: image Posts feed vs Reels (video) feed.
  const [subTab, setSubTab] = useState<'posts' | 'reels'>('posts');

  // Comment edit / delete (owner only) via long-press.
  const [menuComment, setMenuComment] = useState<PostComment | null>(null);
  const [menuRect, setMenuRect] = useState<{
    top: number;
    left: number;
    bottom: number;
    right: number;
    width: number;
    height: number;
  } | null>(null);
  const [menuShown, setMenuShown] = useState(false);
  const [editingComment, setEditingComment] = useState<{
    id: string;
    postId: string;
    text: string;
  } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [commentActionError, setCommentActionError] = useState<string | null>(
    null
  );

  // FEATURE 1: Save Image / Dismiss Post
  // Dismissed posts are stored per-user (composite key `type:id` so user and
  // salon post ids never collide) and persisted in localStorage. Posts are
  // never deleted from the database — only hidden in the feed client-side.
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(new Set<string>());
  const [imageMenuPost, setImageMenuPost] = useState<any | null>(null);
  const [undoKey, setUndoKey] = useState<string | null>(null);
  const undoTimer = useRef<number | null>(null);

  const postKey = (post: any): string =>
    `${getPostType(post)}:${post?.id || ''}`;

  const dismissedStorageKey = user?.id
    ? `halaqi:dismissed:${user.id}`
    : null;

  // Hydrate dismissed set from localStorage when the user changes.
  useEffect(() => {
    if (!dismissedStorageKey) {
      setDismissedKeys(new Set<string>());
      return;
    }
    try {
      const raw = localStorage.getItem(dismissedStorageKey);
      const arr: string[] = raw ? (JSON.parse(raw) as string[]) : [];
      setDismissedKeys(new Set<string>(Array.isArray(arr) ? arr : []));
    } catch {
      setDismissedKeys(new Set<string>());
    }
  }, [dismissedStorageKey]);

  const persistDismissed = (next: Set<string>) => {
    if (!dismissedStorageKey) return;
    try {
      localStorage.setItem(
        dismissedStorageKey,
        JSON.stringify(Array.from(next))
      );
    } catch {
      /* storage unavailable — keep in-memory only */
    }
  };

  const dismissPost = (key: string) => {
    setDismissedKeys((current) => {
      if (current.has(key)) return current;
      const next = new Set<string>(current);
      next.add(key);
      persistDismissed(next);
      return next;
    });
    setImageMenuPost(null);
    setUndoKey(key);
    if (undoTimer.current) window.clearTimeout(undoTimer.current);
    undoTimer.current = window.setTimeout(() => setUndoKey(null), 5000);
  };

  const undoDismiss = (key: string) => {
    setDismissedKeys((current) => {
      if (!current.has(key)) return current;
      const next = new Set<string>(current);
      next.delete(key);
      persistDismissed(next);
      return next;
    });
    setUndoKey(null);
    if (undoTimer.current) window.clearTimeout(undoTimer.current);
  };

  const visiblePosts = useMemo(
    () => posts.filter((post) => !dismissedKeys.has(postKey(post))),
    [posts, dismissedKeys]
  );

  const longPressTimer = useRef<number | null>(null);

  const haptic = (ms = 12) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(ms);
      } catch {
        /* vibrate not supported */
      }
    }
  };

  const openMenu = (comment: PostComment, target: HTMLElement) => {
    const r = target.getBoundingClientRect();
    setMenuRect({
      top: r.top,
      left: r.left,
      bottom: r.bottom,
      right: r.right,
      width: r.width,
      height: r.height,
    });
    setMenuComment(comment);
    haptic();
  };

  const closeMenu = () => {
    setMenuShown(false);
    window.setTimeout(() => {
      setMenuComment(null);
      setMenuRect(null);
    }, 140);
  };


  const salonMap = useMemo(() => {
    return new Map(salons.map((salon) => [salon.id, salon]));
  }, [salons]);

  useEffect(() => {
    let cancelled = false;

    const loadPosts = async () => {
      if (!hasLoadedPosts.current) setLoading(true);

      try {
        const feedResult = await api.getUnifiedPostsFeed();

        if (cancelled) return;

        if (!feedResult.success) {
          console.error(
            '[PostsView] Unified Feed Error:',
            feedResult.error
          );

          setPosts([]);
          setUserPosts([]);
          return;
        }

        const merged = Array.isArray(feedResult.posts)
          ? feedResult.posts.map((post: any) => ({
              ...post,
              likeCount: Number(post.likeCount || 0),
              commentCount: Number(post.commentCount || 0),
            }))
          : [];

        merged.sort(
          (a: any, b: any) =>
            new Date(b.createdAt).getTime() -
            new Date(a.createdAt).getTime()
        );

        if (!cancelled) {
          setPosts(merged as SalonPost[]);

          setUserPosts(
            merged.filter(
              (post: any) => post.postType === 'user'
            ) as UserPost[]
          );
        }

        if (cancelled) return;

        /*
         * LIKE_STATUS_HYDRATION_V1
         *
         * حالة الإعجاب الحالية للمشاهد تُحمَّل من الـAPI مع الـFeed
         * (الحقل liked محسوب من post_likes في قاعدة البيانات
         * لكل منشور صالون ومستخدم).
         */
        if (!cancelled) {
          const hydratedLikes: Record<string, boolean> = {};

          merged.forEach((post: any) => {
            if (post.liked === true) {
              hydratedLikes[post.id] = true;
            }
          });

          setLikedPosts(hydratedLikes);
          hasLoadedPosts.current = true;
        }
      } catch (error) {
        console.error('Load posts error:', error);

        if (!cancelled) {
          setPosts([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    // DIRECT_POST_FEED_SKIP_V1_DISABLED
    // الـFeed يجب أن يعمل بشكل طبيعي دائماً.
    // إذا وُجد selectedPostId، يتم جلب المنشور المطلوب
    // بشكل مباشر من useEffect مستقل بدون تعطيل الـFeed.

    loadPosts();

    return () => {
      cancelled = true;
    };
  }, [salons]);

  /*
   * DIRECT_POST_LOAD_V1
   * إذا جاء المنشور من إشعار، نجلبه مباشرة بالـID.
   * لا نعتمد على تحميل Feed كامل حتى نصل إليه.
   */
  useEffect(() => {
    let cancelled = false;

    const loadDirectPost = async () => {
      if (!selectedPostId) return;

      setDirectPostLoading(true);

      try {
        // DIRECT_POST_LOAD_V2
        // نستخدم الـendpoint الموحد الذي يفرّق بين منشور مستخدم
        // ومنشور صالون ويعيد postType الصحيح.
        const result = await api.getUnifiedPostById(selectedPostId);

        if (cancelled) return;

        if (result.success && result.post) {
          const loadedPost: any = {
            likeCount: Number(result.post.likeCount || 0),
            commentCount: Number(result.post.commentCount || 0),
            ...result.post,
          };

          setUserPosts((current) => {
            if (loadedPost.postType !== 'user') return current;

            const exists = current.some(
              (item) => item.id === loadedPost.id
            );

            return exists
              ? current.map((item) =>
                  item.id === loadedPost.id ? loadedPost : item
                )
              : [loadedPost, ...current];
          });

          setPosts((current) => {
            const exists = current.some(
              (item) => item.id === loadedPost.id
            );

            return exists
              ? current.map((item) =>
                  item.id === loadedPost.id ? loadedPost : item
                )
              : [loadedPost, ...current];
          });

          // حالة الإعجاب تُحمَّل من قاعدة البيانات لا من حالة وهمية.
          try {
            const likeStatus = await api.getUnifiedPostLikeStatus(
              loadedPost.id,
              getPostType(loadedPost)
            );

            if (!cancelled && likeStatus.success) {
              setLikedPosts((current) => ({
                ...current,
                [loadedPost.id]: !!likeStatus.liked,
              }));
            }
          } catch (likeError) {
            console.error(
              '[DIRECT_POST_LIKE_STATUS]',
              likeError
            );
          }
        }
      } catch (error) {
        console.error('[DIRECT_POST_LOAD_V1]', error);
      } finally {
        if (!cancelled) {
          setDirectPostLoading(false);
        }
      }
    };

    loadDirectPost();

    return () => {
      cancelled = true;
    };
  }, [selectedPostId]);

  useEffect(() => {
    if (!selectedPostId || loading || posts.length === 0) return;

    let cancelled = false;
    let attempts = 0;

    const findAndFocusPost = () => {
      if (cancelled) return;

      const target = document.getElementById(`post-${selectedPostId}`);

      if (target) {
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });

        target.classList.add(
          'ring-2',
          'ring-[#D4AF37]',
          'border-[#D4AF37]',
          'shadow-[0_0_40px_rgba(212,175,55,0.25)]'
        );

        window.setTimeout(() => {
          if (!cancelled) {
            target.classList.remove(
              'ring-2',
              'ring-[#D4AF37]',
              'border-[#D4AF37]',
              'shadow-[0_0_40px_rgba(212,175,55,0.25)]'
            );
          }
        }, 3500);

        return;
      }

      attempts += 1;

      if (attempts < 20) {
        window.setTimeout(findAndFocusPost, 150);
      } else {
        console.warn(
          '[PostsView] المنشور المطلوب غير موجود في القائمة:',
          selectedPostId
        );
      }
    };

    const timer = window.setTimeout(findAndFocusPost, 100);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [selectedPostId, loading, posts, userPosts]);

  const handleLike = async (post: SalonPost) => {
    if (!user) {
      openAuthModal();
      return;
    }

    if (loadingAction) return;

    setLoadingAction(`like:${post.id}`);

    try {
      // LIKE_ROUTING_BY_POST_TYPE_V1
      const result = await api.toggleUnifiedPostLike(
        post.id,
        getPostType(post)
      );

      if (result.success) {
        setLikedPosts((prev) => ({
          ...prev,
          [post.id]: !!result.liked,
        }));

        setPosts((prev) =>
          prev.map((item) =>
            item.id === post.id
              ? {
                  ...item,
                  likeCount:
                    typeof result.likeCount === 'number'
                      ? result.likeCount
                      : item.likeCount,
                }
              : item
          )
        );
      }
    } catch (error) {
      console.error('Toggle post like error:', error);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleToggleComments = async (post: SalonPost) => {
    const isOpen = !!openComments[post.id];

    if (isOpen) {
      setOpenComments((prev) => ({
        ...prev,
        [post.id]: false,
      }));
      return;
    }

    if (!comments[post.id]) {
      setLoadingAction(`comments:${post.id}`);

      try {
        // COMMENT_ROUTING_BY_POST_TYPE_V1
        const result = await api.getUnifiedPostComments(
          post.id,
          getPostType(post),
          user?.id
        );

        setComments((prev) => ({
          ...prev,
          [post.id]: result,
        }));
      } catch (error) {
        console.error('Load post comments error:', error);
      } finally {
        setLoadingAction(null);
      }
    }

    setOpenComments((prev) => ({
      ...prev,
      [post.id]: true,
    }));
  };

  const handleAddComment = async (post: SalonPost) => {
    if (!user) {
      openAuthModal();
      return;
    }

    const text = (commentText[post.id] || '').trim();

    if (!text || loadingAction) return;

    setLoadingAction(`comment:${post.id}`);
    console.log('[COMMENT CLICK]', post.id, text);

    try {
      const result = await api.addUnifiedPostComment(
        post.id,
        getPostType(post),
        text
      );
      console.log('[COMMENT RESULT]', result);

      if (result.success && result.comment) {
        setComments((prev) => ({
          ...prev,
          [post.id]: [...(prev[post.id] || []), result.comment!],
        }));

        setPosts((prev) =>
          prev.map((item) =>
            item.id === post.id
              ? {
                  ...item,
                  commentCount: item.commentCount + 1,
                }
              : item
          )
        );

        setCommentText((prev) => ({
          ...prev,
          [post.id]: '',
        }));
      }
    } catch (error) {
      console.error('Add post comment error:', error);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleReact = async (
    postId: string,
    comment: PostComment,
    reaction: 'like' | 'dislike'
  ) => {
    if (!user) {
      openAuthModal();
      return;
    }

    const nextReaction: 'like' | 'dislike' | null =
      comment.myReaction === reaction ? null : reaction;

    const prev = {
      likes: comment.likes || 0,
      dislikes: comment.dislikes || 0,
      myReaction: comment.myReaction || null,
    };

    const compute = (
      base: { likes: number; dislikes: number; myReaction: 'like' | 'dislike' | null },
      reaction: 'like' | 'dislike' | null
    ) => {
      const next = { ...base };
      if (base.myReaction === 'like') next.likes -= 1;
      if (base.myReaction === 'dislike') next.dislikes -= 1;
      if (reaction === 'like') next.likes += 1;
      if (reaction === 'dislike') next.dislikes += 1;
      next.myReaction = reaction;
      return next;
    };

    const optimistic = compute(prev, nextReaction);

    // Optimistic update for immediate feedback.
    setComments((p) => ({
      ...p,
      [postId]: (p[postId] || []).map((c) =>
        c.id === comment.id ? { ...c, ...optimistic } : c
      ),
    }));

    try {
      const res = await api.reactToComment(comment.id, nextReaction);
      if (res.success) {
        setComments((p) => ({
          ...p,
          [postId]: (p[postId] || []).map((c) =>
            c.id === comment.id
              ? {
                  ...c,
                  likes: res.likes ?? optimistic.likes,
                  dislikes: res.dislikes ?? optimistic.dislikes,
                  myReaction: res.myReaction ?? optimistic.myReaction,
                }
              : c
          ),
        }));
      } else {
        // Revert on failure.
        setComments((p) => ({
          ...p,
          [postId]: (p[postId] || []).map((c) =>
            c.id === comment.id ? { ...c, ...prev } : c
          ),
        }));
      }
    } catch (error) {
      console.error('Comment reaction error:', error);
      setComments((p) => ({
        ...p,
        [postId]: (p[postId] || []).map((c) =>
          c.id === comment.id ? { ...c, ...prev } : c
        ),
      }));
    }
  };

  const getSalon = (post: SalonPost) => salonMap.get(post.salonId);

  // Subtle open animation for the action sheet (close is handled in closeMenu).
  useEffect(() => {
    if (menuComment) {
      const raf = requestAnimationFrame(() => setMenuShown(true));
      return () => cancelAnimationFrame(raf);
    }
    setMenuShown(false);
  }, [menuComment]);

  // ---- Long-press detection (owner only) to reveal Edit / Delete ----
  const startLongPress = (
    comment: PostComment,
    target: HTMLElement
  ) => {
    if (comment.userId !== user?.id) return;
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = window.setTimeout(() => {
      openMenu(comment, target);
    }, 450);
  };

  const clearLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleEditComment = async () => {
    if (!editingComment) return;
    const text = editingComment.text.trim();
    if (!text) return;

    setActionLoading(`edit:${editingComment.id}`);
    setCommentActionError(null);

    try {
      const res = await api.editUnifiedPostComment(
        editingComment.id,
        text
      );

      if (res.blocked) {
        setCommentActionError(res.error || 'تعذر تعديل التعليق.');
        return;
      }

      if (res.success && res.comment) {
        const postId = editingComment.postId;
        setComments((p) => ({
          ...p,
          [postId]: (p[postId] || []).map((c) =>
            c.id === editingComment.id
              ? { ...c, comment: res.comment!.comment }
              : c
          ),
        }));
        setEditingComment(null);
      } else {
        setCommentActionError(res.error || 'تعذر تعديل التعليق.');
      }
    } catch (error) {
      console.error('Edit comment error:', error);
      setCommentActionError('تعذر تعديل التعليق.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteComment = async (comment: PostComment) => {
    closeMenu();
    setActionLoading(`delete:${comment.id}`);

    try {
      const res = await api.deleteUnifiedPostComment(comment.id);

      if (res.success) {
        // Remove the comment immediately and update counts (no new comment).
        setComments((p) => ({
          ...p,
          [comment.postId]: (p[comment.postId] || []).filter(
            (c) => c.id !== comment.id
          ),
        }));
        setPosts((prev) =>
          prev.map((item) =>
            item.id === comment.postId
              ? { ...item, commentCount: Math.max(0, item.commentCount - 1) }
              : item
          )
        );
        setUserPosts((prev) =>
          prev.map((item) =>
            item.id === comment.postId
              ? { ...item, commentCount: Math.max(0, item.commentCount - 1) }
              : item
          )
        );
      } else {
        console.error('Delete comment error:', res.error);
      }
    } catch (error) {
      console.error('Delete comment error:', error);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <main
      dir={isRtl ? 'rtl' : 'ltr'}
      className="relative min-h-screen overflow-hidden bg-[#0A0A0A] pb-28 text-white"
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-80 w-80 rounded-full bg-[#D4AF37]/[0.06] blur-[100px]" />
        <div className="absolute -right-32 top-72 h-96 w-96 rounded-full bg-[#D4AF37]/[0.035] blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-white/[0.02] blur-[110px]" />
      </div>

      <div className="relative mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-7 overflow-hidden rounded-[24px] border border-white/[0.12] bg-white/[0.06] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.6)] ring-1 ring-white/[0.05] backdrop-blur-2xl sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[#D4AF37] shadow-[0_0_12px_rgba(212,175,55,0.8)]" />
                <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#D4AF37]/80">
                  {isRtl ? 'Halaqi • Live Feed' : 'Halaqi • Live Feed'}
                </span>
              </div>

              <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
                {isRtl ? 'المنشورات' : 'Posts'}
              </h1>

              <p className="mt-1.5 text-xs leading-5 text-slate-500 sm:text-sm">
                {isRtl
                  ? 'آخر إبداعات وتحديثات الصالونات'
                  : 'Latest updates and creations from salons'}
              </p>
            </div>

            <div className="hidden shrink-0 rounded-2xl border border-[#D4AF37]/15 bg-[#D4AF37]/[0.06] px-4 py-3 text-center sm:block">
              <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#D4AF37]/60">
                {isRtl ? 'Feed' : 'Feed'}
              </div>
              <div className="mt-0.5 text-lg font-black text-[#D4AF37]">
                {posts.length}
              </div>
            </div>
          </div>
        </header>

        {/* Posts / Reels sub-tab switcher (Reels is NOT a Bottom Nav item) */}
        <div className="fixed inset-x-0 top-0 z-40 flex items-center justify-between gap-2 bg-gradient-to-b from-black/80 to-transparent px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <button
            type="button"
            onClick={() => onNavigate?.('explore')}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white backdrop-blur-xl transition active:scale-95"
            aria-label={isRtl ? 'رجوع' : 'Back'}
          >
            <ArrowLeft className={`h-5 w-5 ${isRtl ? 'rotate-180' : ''}`} />
          </button>
          <div className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/[0.10] bg-white/[0.04] p-1.5 backdrop-blur-xl">
            {([
              { key: 'posts', label: isRtl ? 'المنشورات' : 'Posts' },
              { key: 'reels', label: isRtl ? 'ريلز' : 'Reels' },
            ] as const).map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setSubTab(t.key)}
                className={`flex-1 rounded-xl px-4 py-2 text-sm font-bold transition-all ${
                  subTab === t.key
                    ? 'bg-[#D4AF37] text-black shadow-[0_4px_20px_-4px_rgba(212,175,55,0.5)]'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="h-10 w-10" />
        </div>

        {subTab === 'reels' ? (
          <div className="fixed inset-0 z-50 bg-black">
            <ReelsView onBack={() => setSubTab('posts')} onNavigate={onNavigate} />
          </div>
        ) : (
          loading ? (
          <div className="flex min-h-[420px] items-center justify-center rounded-[24px] border border-white/[0.12] bg-white/[0.06] shadow-[0_8px_32px_rgba(0,0,0,0.6)] ring-1 ring-white/[0.05] backdrop-blur-2xl">
            <div className="flex flex-col items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#D4AF37]/20 bg-[#D4AF37]/[0.06] shadow-[0_0_40px_rgba(212,175,55,0.08)]">
                <Loader2 className="h-6 w-6 animate-spin text-[#D4AF37]" />
              </div>
              <span className="text-xs font-medium text-slate-500">
                {isRtl ? 'جاري تحميل المنشورات...' : 'Loading posts...'}
              </span>
            </div>
          </div>
        ) : posts.length === 0 ? (
          <div className="rounded-[24px] border border-white/[0.12] bg-white/[0.06] px-6 py-16 text-center shadow-[0_8px_32px_rgba(0,0,0,0.6)] ring-1 ring-white/[0.05] backdrop-blur-2xl">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#D4AF37]/15 bg-[#D4AF37]/[0.05]">
              <MessageCircle className="h-6 w-6 text-[#D4AF37]/70" />
            </div>
            <p className="text-sm font-semibold text-slate-300">
              {isRtl ? 'لا توجد منشورات حالياً' : 'There are no posts yet'}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              {isRtl
                ? 'ستظهر منشورات الصالونات هنا عند توفرها.'
                : 'Salon posts will appear here when available.'}
            </p>
          </div>
        ) : (
          <div className="fixed inset-0 z-30 h-[100dvh] overflow-y-auto snap-y snap-mandatory bg-black">
            {visiblePosts.map((post, postIndex) => {
              const salon = getSalon(post);

              // POSTS_IMAGE_LOADING_V4
              // أول صورتين تظهران بسرعة، والباقي Lazy لتخفيف الضغط
              // على الشبكة والـGPU عند فتح Posts.
              const isUserPost =
                'userId' in post && !('salonId' in post);
              const userPost = isUserPost ? (post as UserPost) : null;
              const isLiked = !!likedPosts[post.id];
              const isCommentsOpen = !!openComments[post.id];
              const postComments = comments[post.id] || [];
              const isLikeLoading = loadingAction === `like:${post.id}`;
              const isCommentsLoading =
                loadingAction === `comments:${post.id}`;
              const isCommentLoading =
                loadingAction === `comment:${post.id}`;

              return (
                <article
                  id={`post-${post.id}`}
                  key={post.id}
                  className="relative h-[100dvh] w-full snap-start overflow-hidden bg-black"
                >
                  <button
                    type="button"
                    className="absolute inset-x-0 top-[calc(max(0.75rem,env(safe-area-inset-top))+3rem)] z-20 flex w-full items-center gap-3 bg-gradient-to-b from-black/70 via-black/30 to-transparent px-4 pb-6 pt-[max(0.75rem,env(safe-area-inset-top))] text-start"
                    onClick={() => {
                      if (isUserPost && userPost?.userId) {
                        onNavigate?.(`user:${userPost.userId}`);
                      } else if (salon) {
                        onSelectSalon?.(salon);
                      }
                    }}
                  >
                      <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-2xl border border-white/[0.12] bg-white/[0.06] ring-1 ring-white/[0.05] shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
                      {isUserPost && userPost?.userAvatar ? (
                        <img
                          src={userPost.userAvatar}
                          alt={userPost.userName || 'User'}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : salon?.coverImage ? (
                        <img
                          src={salon.coverImage}
                          alt={post.salonName}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-[#D4AF37]/[0.06] text-sm font-black text-[#D4AF37]">
                          {(isUserPost
                            ? userPost?.userName
                            : post.salonName
                          )?.charAt(0) || 'U'}
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold text-white">
                        {isUserPost
                          ? userPost?.userName || 'مستخدم'
                          : post.salonName}
                      </div>

                      <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-500">
                        <span className="h-1 w-1 rounded-full bg-[#D4AF37]/70" />
                        {new Date(post.createdAt).toLocaleDateString(
                          isRtl ? 'ar-IQ' : 'en-US',
                          {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          }
                        )}
                      </div>
                    </div>

                      <div className="hidden shrink-0 rounded-xl border border-white/[0.12] bg-white/[0.06] px-2.5 py-2 sm:block">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-600">
                        {isUserPost
                          ? (isRtl ? 'الملف الشخصي' : 'PROFILE')
                          : (isRtl ? 'عرض الصالون' : 'VIEW')}
                      </span>
                    </div>
                  </button>

                  <div className="absolute inset-0 z-0 bg-black">
                    <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-black/20 via-transparent to-white/[0.025]" />
                      <div

                        className="POST_IMAGE_RENDER_V5_1 absolute inset-0 bg-black"

                        style={{ aspectRatio: '4 / 5' }}

                      >

                        {post.imageUrl ? (
                          <>
                            <div className="absolute inset-0 flex items-center justify-center bg-[#0b0b0b]">

                              <div className="h-8 w-8 animate-pulse rounded-full border border-[#D4AF37]/10 bg-[#D4AF37]/[0.03]" />

                            </div>

                            <img

                              src={post.imageUrl}

                              alt={post.caption || post.salonName || 'Halaqi post'}

                              className="relative z-[1] block h-full w-full cursor-pointer object-contain bg-black"

                              loading="lazy"

                              decoding="async"

                              onClick={(event) => {
                                event.stopPropagation();
                                setImageMenuPost(post);
                              }}

                              onError={(event) => {

                                event.currentTarget.style.opacity = '0';

                              }}

                            />
                          </>
                        ) : (
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#D4AF37]/[0.06] to-transparent px-6 text-center">
                            <Quote className="h-7 w-7 text-[#D4AF37]/40" />
                            <span className="text-xs text-slate-500">
                              {isRtl ? 'منشور نصي' : 'Text post'}
                            </span>
                          </div>
                        )}

                      </div>
                  </div>

                  <div className="absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-10">
                    {post.caption && (
                      <p className="mb-3 max-h-28 overflow-y-auto whitespace-pre-wrap text-sm leading-6 text-white [text-shadow:0_1px_8px_rgba(0,0,0,0.9)]" dir="auto">
                        <CaptionText text={post.caption} />
                      </p>
                    )}

                    <div className="flex shrink-0 flex-col items-center gap-5">
                      <div className="flex flex-col items-center gap-3">
                        <button
                          type="button"
                          onClick={() => handleLike(post)}
                          disabled={isLikeLoading}
                          className={`flex h-10 items-center gap-2 rounded-xl border px-3 text-xs font-bold transition-all ${
                            isLiked
                              ? 'border-red-400/20 bg-red-400/[0.08] text-red-300'
                              : 'border-white/[0.12] bg-white/[0.06] text-slate-400 hover:border-[#D4AF37]/20 hover:bg-[#D4AF37]/[0.05] hover:text-white'
                          }`}
                        >
                          <Heart
                            className={`h-4 w-4 ${
                              isLiked ? 'fill-current' : ''
                            }`}
                          />
                          <span>{post.likeCount}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleComments(post)}
                          className="flex h-10 items-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.06] px-3 text-xs font-bold text-slate-400 transition-all hover:border-[#D4AF37]/20 hover:bg-[#D4AF37]/[0.05] hover:text-white"
                        >
                          {isCommentsLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <MessageCircle className="h-4 w-4" />
                          )}
                          <span>{post.commentCount}</span>
                        </button>
                      </div>

                      <div className="hidden text-[9px] font-bold uppercase tracking-[0.16em] text-slate-600 sm:block">
                        HALAQI
                      </div>
                    </div>

                    {isCommentsOpen && (
                      <div className="absolute inset-x-0 bottom-0 z-40 max-h-[72%] overflow-y-auto rounded-t-3xl border-t border-white/10 bg-[#0b0b0f]/95 p-4 shadow-[0_8px_32px_rgba(0,0,0,0.6)] ring-1 ring-white/[0.05] backdrop-blur-2xl">
                        <div className="mb-3 flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-300">
                            {isRtl ? 'التعليقات' : 'Comments'}
                          </span>
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] text-slate-600">
                              {post.commentCount}
                            </span>
                            <button
                              type="button"
                              onClick={() => setOpenComments((o) => ({ ...o, [post.id]: false }))}
                              className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10"
                              aria-label={isRtl ? 'إغلاق' : 'Close'}
                            >
                              <ArrowLeft className={`h-4 w-4 ${isRtl ? '' : 'rotate-180'}`} />
                            </button>
                          </div>
                        </div>

                        <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
                          {postComments.length === 0 ? (
                              <div className="rounded-xl border border-white/[0.12] bg-white/[0.06] px-4 py-5 text-center">
                              <p className="text-xs text-slate-600">
                                {isRtl
                                  ? 'لا توجد تعليقات بعد'
                                  : 'No comments yet'}
                              </p>
                            </div>
                          ) : (
                            postComments.map((comment) => {
                              const isOwner = comment.userId === user?.id;
                              const isEditing =
                                editingComment?.id === comment.id;

                              return (
                              <div
                                key={comment.id}
                                className="flex gap-2.5"
                                onTouchStart={(event) =>
                                  startLongPress(comment, event.currentTarget as HTMLElement)
                                }
                                onTouchEnd={clearLongPress}
                                onTouchMove={clearLongPress}
                                onContextMenu={(event) => {
                                  event.preventDefault();
                                  if (isOwner)
                                    openMenu(comment, event.currentTarget as HTMLElement);
                                }}
                              >
                                <button
                                  type="button"
                                  onClick={() =>
                                    onNavigate?.(`user:${comment.userId}`)
                                  }
                                  className="h-8 w-8 shrink-0 overflow-hidden rounded-xl border border-white/[0.12] bg-white/[0.06] transition-all hover:border-[#D4AF37]/40"
                                >
                                  {comment.userAvatar ? (
                                    <img
                                      src={comment.userAvatar}
                                      alt={comment.userName}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center text-xs font-bold text-[#D4AF37]">
                                      {comment.userName?.charAt(0) || 'U'}
                                    </div>
                                  )}
                                </button>

                                {isEditing ? (
                                  <div className="min-w-0 flex-1 rounded-2xl border border-white/[0.12] bg-white/[0.06] px-3 py-2.5">
                                    <textarea
                                      value={editingComment?.text ?? ''}
                                      onChange={(event) =>
                                        setEditingComment((prev) =>
                                          prev
                                            ? { ...prev, text: event.target.value }
                                            : prev
                                        )
                                      }
                                      rows={2}
                                      placeholder={
                                        isRtl ? 'عدّل تعليقك...' : 'Edit your comment...'
                                      }
                                      className="w-full resize-none rounded-xl border border-white/[0.12] bg-white/[0.06] px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 transition-all focus:border-[#D4AF37]/40 focus:bg-white/[0.08] focus:ring-1 focus:ring-[#D4AF37]/20"
                                    />
                                    {commentActionError && (
                                      <p className="mt-1 text-xs text-rose-400">
                                        {commentActionError}
                                      </p>
                                    )}
                                    <div className="mt-2 flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={handleEditComment}
                                        disabled={
                                          actionLoading === `edit:${comment.id}`
                                        }
                                        className="flex items-center gap-1.5 rounded-xl bg-[#D4AF37] px-3 py-1.5 text-xs font-bold text-slate-900 transition-all hover:bg-[#e6c14d] disabled:opacity-60"
                                      >
                                        {actionLoading === `edit:${comment.id}` ? (
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : null}
                                        {isRtl ? 'حفظ' : 'Save'}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingComment(null);
                                          setCommentActionError(null);
                                        }}
                                        className="rounded-xl border border-white/[0.12] px-3 py-1.5 text-xs font-bold text-slate-300 transition-colors hover:text-slate-100"
                                      >
                                        {isRtl ? 'إلغاء' : 'Cancel'}
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="min-w-0 flex-1 rounded-2xl border border-white/[0.12] bg-white/[0.06] px-3 py-2.5">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onNavigate?.(`user:${comment.userId}`)
                                    }
                                    className="text-xs font-bold text-slate-200 transition-colors hover:text-[#D4AF37]"
                                  >
                                    {comment.userName}
                                  </button>
                                  <div className="mt-1 text-sm leading-5 text-slate-400">
                                    {comment.comment}
                                  </div>

                                  <div className="mt-2 flex items-center gap-4">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleReact(post.id, comment, 'like')
                                      }
                                      className={`flex items-center gap-1.5 text-xs transition-colors ${
                                        comment.myReaction === 'like'
                                          ? 'text-[#D4AF37]'
                                          : 'text-slate-400 hover:text-slate-200'
                                      }`}
                                      aria-pressed={comment.myReaction === 'like'}
                                    >
                                      <Heart
                                        className="h-5 w-5"
                                        fill={
                                          comment.myReaction === 'like'
                                            ? 'currentColor'
                                            : 'none'
                                        }
                                      />
                                      <span>{comment.likes || 0}</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleReact(post.id, comment, 'dislike')
                                      }
                                      className={`flex items-center gap-1.5 text-xs transition-colors ${
                                        comment.myReaction === 'dislike'
                                          ? 'text-rose-400'
                                          : 'text-slate-400 hover:text-slate-200'
                                      }`}
                                      aria-pressed={
                                        comment.myReaction === 'dislike'
                                      }
                                    >
                                      <ThumbsDown
                                        className="h-5 w-5"
                                        fill={
                                          comment.myReaction === 'dislike'
                                            ? 'currentColor'
                                            : 'none'
                                        }
                                      />
                                      <span>{comment.dislikes || 0}</span>
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                        </div>

                        <div className="mt-4 flex gap-2">
                          <input
                            value={commentText[post.id] || ''}
                            onChange={(event) =>
                              setCommentText((prev) => ({
                                ...prev,
                                [post.id]: event.target.value,
                              }))
                            }
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                event.preventDefault();
                                handleAddComment(post);
                              }
                            }}
                            placeholder={
                              isRtl
                                ? 'اكتب تعليقاً...'
                                : 'Write a comment...'
                            }
                            className="min-w-0 flex-1 rounded-xl border border-white/[0.12] bg-white/[0.06] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 transition-all focus:border-[#D4AF37]/40 focus:bg-white/[0.08] focus:ring-1 focus:ring-[#D4AF37]/20"
                          />

                          <button
                            type="button"
                            onClick={() => handleAddComment(post)}
                            disabled={
                              isCommentLoading ||
                              !(commentText[post.id] || '').trim()
                            }
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#D4AF37]/20 bg-[#D4AF37] text-black shadow-[0_0_16px_-2px_rgba(212,175,55,0.50)] ring-1 ring-[#D4AF37]/20 transition-all hover:bg-[#e5c45b] disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            {isCommentLoading ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Send className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ))}
      </div>

      {/* Owner-only premium Glassmorphism action sheet (Edit / Delete) */}
      {menuComment && menuRect && (
        <>
          {/* Dim backdrop + dismiss on outside tap */}
          <div
            className="fixed inset-0 z-[45] bg-black/40 backdrop-blur-[2px]"
            onClick={closeMenu}
          />
          {(() => {
            const MENU_W = 244;
            const MENU_H = 136;
            const vw =
              typeof window !== 'undefined' ? window.innerWidth : 360;
            const vh =
              typeof window !== 'undefined' ? window.innerHeight : 640;

            // Place above the comment when there is room, otherwise below.
            let top = menuRect.top - MENU_H - 8;
            if (top < 8) top = menuRect.bottom + 8;
            if (top + MENU_H > vh - 8) top = vh - MENU_H - 8;

            // Align to the comment's edge (RTL: right, LTR: left), clamp on-screen.
            let left = isRtl ? menuRect.right - MENU_W : menuRect.left;
            left = Math.max(8, Math.min(left, vw - MENU_W - 8));

            return (
              <div
                role="menu"
                aria-label={isRtl ? 'خيارات التعليق' : 'Comment options'}
                onClick={(event) => event.stopPropagation()}
                onContextMenu={(event) => event.preventDefault()}
                style={{
                  position: 'fixed',
                  top,
                  left,
                  width: MENU_W,
                  WebkitUserSelect: 'none',
                  userSelect: 'none',
                  WebkitTouchCallout: 'none',
                }}
                className={`z-[60] origin-top select-none overflow-hidden rounded-2xl border border-white/[0.10] bg-white/[0.07] p-1.5 shadow-[0_10px_40px_-8px_rgba(0,0,0,0.7),0_0_22px_-6px_rgba(212,175,55,0.30)] ring-1 ring-white/[0.06] backdrop-blur-2xl transition-all duration-150 ease-out ${
                  menuShown ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
                }`}
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    haptic();
                    setEditingComment({
                      id: menuComment.id,
                      postId: menuComment.postId,
                      text: menuComment.comment,
                    });
                    setCommentActionError(null);
                    closeMenu();
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-slate-100 transition-colors hover:bg-white/[0.08] active:bg-white/[0.10]"
                >
                  <Pencil className="h-[18px] w-[18px] text-[#D4AF37]" />
                  {isRtl ? 'تعديل' : 'Edit'}
                </button>

                <div className="my-0.5 h-px bg-white/[0.08]" />

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    haptic(18);
                    handleDeleteComment(menuComment);
                  }}
                  disabled={actionLoading === `delete:${menuComment.id}`}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-rose-400 transition-colors hover:bg-rose-500/[0.10] active:bg-rose-500/[0.14] disabled:opacity-60"
                >
                  <Trash2 className="h-[18px] w-[18px]" />
                  {actionLoading === `delete:${menuComment.id}`
                    ? isRtl
                      ? 'جارٍ الحذف...'
                      : 'Deleting...'
                    : isRtl
                      ? 'حذف'
                      : 'Delete'}
                </button>
              </div>
            );
          })()}
        </>
      )}

      {/* FEATURE 1: Save Image / Dismiss glass menu (opened by tapping a post image) */}
      {imageMenuPost && (
        <div
          className="fixed inset-0 z-[120] flex items-end justify-center bg-black/60 p-4 sm:items-center"
          onClick={() => setImageMenuPost(null)}
        >
          <div
            className="w-full max-w-sm overflow-hidden rounded-[24px] border border-white/[0.12] bg-white/[0.06] p-2 shadow-[0_8px_32px_rgba(0,0,0,0.6)] ring-1 ring-white/[0.05] backdrop-blur-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-3 py-2 text-center text-[10px] uppercase tracking-widest text-slate-500">
              {isRtl ? 'خيارات الصورة' : 'Image options'}
            </div>

            <button
              type="button"
              onClick={async () => {
                const url = imageMenuPost?.imageUrl;
                setImageMenuPost(null);
                if (!url) return;
                const res = await saveImage(url);
                if (!res.success && res.error) {
                  notify(res.error, 'error');
                }
              }}
              className="flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold text-[#D4AF37] transition-all hover:bg-[#D4AF37]/[0.08]"
            >
              {isRtl ? 'حفظ الصورة' : 'Save Image'}
            </button>

            <button
              type="button"
              onClick={() => dismissPost(postKey(imageMenuPost))}
              className="flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold text-red-400 transition-all hover:bg-red-950/40"
            >
              {isRtl ? 'إخفاء المنشور' : 'Dismiss'}
            </button>

            <button
              type="button"
              onClick={() => setImageMenuPost(null)}
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-xs font-bold text-slate-400 transition-all hover:bg-white/5"
            >
              {isRtl ? 'إلغاء' : 'Cancel'}
            </button>
          </div>
        </div>
      )}

      {/* FEATURE 1: Undo toast after dismissing a post */}
      {undoKey && (
        <div className="fixed bottom-24 left-1/2 z-[120] flex -translate-x-1/2 items-center gap-3 rounded-full border border-white/[0.12] bg-white/[0.08] px-5 py-3 text-xs text-white shadow-[0_8px_32px_rgba(0,0,0,0.6)] ring-1 ring-white/[0.05] backdrop-blur-2xl">
          <span>{isRtl ? 'تم إخفاء المنشور' : 'Post hidden'}</span>
          <button
            type="button"
            onClick={() => undoDismiss(undoKey)}
            className="font-black text-[#D4AF37]"
          >
            {isRtl ? 'تراجع' : 'Undo'}
          </button>
        </div>
      )}
    </main>
  );

};
