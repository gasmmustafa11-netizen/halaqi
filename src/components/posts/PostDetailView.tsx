import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Heart, MessageCircle, Send } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { api } from '../../services/api';
import { notify } from '../../utils/notifications';
import { UserPost, PostComment } from '../../types';

interface PostDetailViewProps {
  postId: string;
  /** When provided, the matching comment is highlighted (e.g. from a notification). */
  focusCommentId?: string;
  onClose: () => void;
}

/**
 * FEATURE: dedicated, in-app Post Detail overlay opened directly from a
 * notification. Loads the exact target post immediately and displays its
 * content, image, likes and comments. A clear Back button returns the user to
 * the screen/state they came from (the overlay sits above it).
 */
export const PostDetailView: React.FC<PostDetailViewProps> = ({
  postId,
  focusCommentId,
  onClose,
}) => {
  const { user } = useAuth();
  const { isRtl } = useLanguage();

  const [post, setPost] = useState<UserPost | null>(null);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      setError('');
      const [postRes, commentsRes, likeRes] = await Promise.all([
        api.getUserPostById(postId),
        api.getUserPostComments(postId),
        api.getUserPostLikeStatus(postId),
      ]);

      if (!mounted) return;

      if (postRes.success && postRes.post) {
        setPost(postRes.post);
        setLikeCount(postRes.post.likeCount || 0);
      } else {
        setError(
          postRes.error || (isRtl ? 'تعذر تحميل المنشور.' : 'Could not load post.')
        );
      }

      setComments(Array.isArray(commentsRes.comments) ? commentsRes.comments : []);

      if (likeRes.success) {
        setLiked(Boolean(likeRes.liked));
        if (typeof likeRes.likeCount === 'number') setLikeCount(likeRes.likeCount);
      }

      setLoading(false);

      // Scroll the focused comment into view once comments are rendered.
      if (focusCommentId) {
        requestAnimationFrame(() => {
          const el = document.getElementById(`comment-${focusCommentId}`);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }
    })();

    return () => {
      mounted = false;
    };
  }, [postId, focusCommentId, isRtl]);

  const handleLike = async () => {
    const res = await api.toggleUserPostLike(postId);
    if (res.success) {
      setLiked(Boolean(res.liked));
      setLikeCount(
        typeof res.likeCount === 'number'
          ? res.likeCount
          : likeCount + (liked ? -1 : 1)
      );
    }
  };

  const handleAddComment = async () => {
    const text = commentText.trim();
    if (!text) return;

    setSubmittingComment(true);
    const res = await api.addUserPostComment(postId, text);
    setSubmittingComment(false);

    if (res.success && res.comment) {
      setComments((prev) => [...prev, res.comment as PostComment]);
      setCommentText('');
    } else {
      notify(
        res.error || (isRtl ? 'تعذر إضافة التعليق.' : 'Could not add comment.'),
        'error'
      );
    }
  };

  const BackIcon = isRtl ? ArrowRight : ArrowLeft;

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col bg-[#0A0A0A] text-white"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-white/[0.08] bg-[#0b0d12]/80 px-4 py-3 backdrop-blur-md">
        <button
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06] text-white hover:bg-white/10"
          aria-label={isRtl ? 'رجوع' : 'Back'}
        >
          <BackIcon className="h-5 w-5" />
        </button>
        <h2 className="text-base font-bold">
          {isRtl ? 'تفاصيل المنشور' : 'Post Details'}
        </h2>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <p className="px-4 py-10 text-center text-sm text-gray-400">
            {isRtl ? 'جارٍ التحميل...' : 'Loading...'}
          </p>
        )}

        {!loading && error && !post && (
          <p className="px-4 py-10 text-center text-sm text-red-400">{error}</p>
        )}

        {!loading && post && (
          <div className="mx-auto max-w-2xl">
            {/* Author */}
            <div className="flex items-center gap-3 px-4 py-4">
              {post.userAvatar ? (
                <img
                  src={post.userAvatar}
                  alt=""
                  className="h-11 w-11 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-sm font-bold">
                  {(post.userName || '؟').charAt(0)}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate font-bold">{post.userName || 'مستخدم'}</p>
                <p className="text-xs text-gray-400">
                  {new Date(post.createdAt).toLocaleString(
                    isRtl ? 'ar-IQ' : 'en-US'
                  )}
                </p>
              </div>
            </div>

            {/* Image */}
            {post.imageUrl && (
              <img
                src={post.imageUrl}
                alt=""
                className="max-h-[60vh] w-full bg-black object-contain"
              />
            )}

            {/* Caption */}
            {post.caption && (
              <p className="whitespace-pre-wrap px-4 py-3 text-[15px] leading-relaxed text-gray-100">
                {post.caption}
              </p>
            )}

            {/* Actions */}
            <div className="flex items-center gap-6 border-y border-white/[0.08] px-4 py-3">
              <button
                onClick={handleLike}
                className={`flex items-center gap-2 text-sm font-semibold transition-colors ${
                  liked ? 'text-red-400' : 'text-gray-300 hover:text-white'
                }`}
              >
                <Heart className={`h-5 w-5 ${liked ? 'fill-red-400' : ''}`} />
                {likeCount}
              </button>
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-300">
                <MessageCircle className="h-5 w-5" />
                {comments.length}
              </div>
            </div>

            {/* Comments */}
            <div className="px-4 py-4">
              <h3 className="mb-3 text-sm font-bold text-gray-300">
                {isRtl ? 'التعليقات' : 'Comments'}
              </h3>

              {comments.length === 0 ? (
                <p className="text-sm text-gray-500">
                  {isRtl ? 'لا توجد تعليقات بعد.' : 'No comments yet.'}
                </p>
              ) : (
                <ul className="space-y-3">
                  {comments.map((c) => {
                    const isFocused = c.id === focusCommentId;
                    return (
                      <li
                        id={`comment-${c.id}`}
                        key={c.id}
                        className={`flex items-start gap-3 rounded-xl p-3 ${
                          isFocused
                            ? 'bg-[#D4AF37]/10 ring-2 ring-[#D4AF37]'
                            : 'bg-white/[0.03]'
                        }`}
                      >
                        {c.userAvatar ? (
                          <img
                            src={c.userAvatar}
                            alt=""
                            className="h-9 w-9 shrink-0 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold">
                            {(c.userName || '؟').charAt(0)}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold">{c.userName}</p>
                          <p className="whitespace-pre-wrap break-words text-sm text-gray-200">
                            {c.comment}
                          </p>
                          <p className="mt-1 text-[10px] text-gray-500">
                            {new Date(c.createdAt).toLocaleString(
                              isRtl ? 'ar-IQ' : 'en-US'
                            )}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Comment composer (only when signed in) */}
      {user && !loading && post && (
        <div
          className={`flex items-center gap-2 border-t border-white/[0.08] bg-[#0b0d12]/80 px-4 py-3 backdrop-blur-md ${
            isRtl ? 'flex-row-reverse' : ''
          }`}
        >
          <input
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !submittingComment) handleAddComment();
            }}
            placeholder={isRtl ? 'اكتب تعليقاً...' : 'Write a comment...'}
            className="flex-1 rounded-full border border-white/15 bg-black/30 px-4 py-2.5 text-sm text-white outline-none focus:border-[#D4AF37]/60"
          />
          <button
            onClick={handleAddComment}
            disabled={submittingComment || !commentText.trim()}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#D4AF37] text-black transition-all hover:bg-[#B8962D] disabled:opacity-50"
            aria-label={isRtl ? 'إرسال' : 'Send'}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
};
