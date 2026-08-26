import React, { useState, useEffect } from 'react';
import { Salon, Service, Barber, Review, SalonPost, PostComment } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { useBooking } from '../../context/BookingContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { getGoogleMapsNavigationUrl } from '../../utils/geo';
import {
  Star,
  MapPin,
  Phone,
  MessageCircle,
  Navigation,
  Clock,
  ShieldCheck,
  Check,
  Calendar,
  Share2,
  Heart,
  Scissors,
  Sparkles,
  Users,
  MessageSquare,
  ArrowRight,
  ArrowLeft,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface SalonDetailViewProps {
  salon: Salon;
  onBack: () => void;
}

interface SalonPostCardProps {
  post: SalonPost;
  liked: boolean;
  comments: PostComment[];
  user: any;
  onLike: () => void;
  onLoadComments: () => void;
  onAddComment: (comment: string) => void;
  loading: boolean;
}

const SalonPostCard: React.FC<SalonPostCardProps> = ({
  post,
  liked,
  comments,
  user,
  onLike,
  onLoadComments,
  onAddComment,
  loading,
}) => {
  const [comment, setComment] = useState('');
  const [commentsOpen, setCommentsOpen] = useState(false);

  const submitComment = () => {
    const text = comment.trim();
    if (!text || !user) return;

    onAddComment(text);
    setComment('');
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#11141d] shadow-xl">
      {/* Post Image */}
      <div className="relative aspect-square bg-black">
        <img
          src={post.imageUrl}
          alt={post.caption || 'Salon post'}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>

      {/* Post Content */}
      <div className="p-4">
        {post.caption && (
          <p className="text-sm text-slate-200 leading-6 mb-4">
            {post.caption}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-5">
          <button
            type="button"
            onClick={onLike}
            disabled={!user || loading}
            className="flex items-center gap-2 transition-transform active:scale-90 disabled:opacity-50"
            aria-label={liked ? 'إلغاء الإعجاب' : 'إعجاب'}
          >
            <Heart
              className={`w-7 h-7 transition-all ${
                liked
                  ? 'fill-white text-white scale-110'
                  : 'text-white'
              }`}
              strokeWidth={1.8}
            />

            <span className="text-sm font-bold text-slate-300">
              {post.likeCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              const next = !commentsOpen;
              setCommentsOpen(next);

              if (next) {
                onLoadComments();
              }
            }}
            className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors"
          >
            <MessageSquare className="w-6 h-6" />
            <span className="text-sm font-bold">
              {post.commentCount}
            </span>
          </button>
        </div>

        {/* Comments */}
        {commentsOpen && (
          <div className="mt-4 border-t border-white/10 pt-4 space-y-3">
            {comments.length > 0 ? (
              comments.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl bg-white/5 p-3"
                >
                  <p className="text-xs font-bold text-white mb-1">
                    {item.userName}
                  </p>
                  <p className="text-sm text-slate-300 leading-5">
                    {item.comment}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500 text-center">
                لا توجد تعليقات بعد
              </p>
            )}

            {user ? (
              <div className="flex gap-2 pt-2">
                <input
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      submitComment();
                    }
                  }}
                  placeholder="اكتب تعليقاً..."
                  className="flex-1 rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white outline-none focus:border-[#d4af37]"
                />

                <button
                  type="button"
                  onClick={submitComment}
                  disabled={!comment.trim()}
                  className="rounded-xl bg-[#d4af37] px-4 py-2 text-sm font-bold text-black disabled:opacity-40"
                >
                  إرسال
                </button>
              </div>
            ) : (
              <p className="text-xs text-slate-500 text-center pt-2">
                سجل الدخول حتى تتمكن من التعليق
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};


export const SalonDetailView: React.FC<SalonDetailViewProps> = ({ salon, onBack }) => {
  const { t, isRtl } = useLanguage();
  const { openBookingWizard } = useBooking();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<'services' | 'barbers' | 'reviews' | 'hours' | 'gallery'>('services');
  const [selectedServiceCategory, setSelectedServiceCategory] = useState<string>('all');
  const [services, setServices] = useState<Service[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [salonPosts, setSalonPosts] = useState<SalonPost[]>([]);
  const [postComments, setPostComments] = useState<Record<string, PostComment[]>>({});
  const [likedPosts, setLikedPosts] = useState<Record<string, boolean>>({});
  const [postLoading, setPostLoading] = useState(false);
  const [isFavorite, setIsFavorite] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  // Review Form
  const [newRating, setNewRating] = useState<number>(5);
  const [newComment, setNewComment] = useState<string>('');
  const [isSubmittingReview, setIsSubmittingReview] = useState<boolean>(false);
  const [reviewSuccess, setReviewSuccess] = useState<boolean>(false);

  useEffect(() => {
    async function loadData() {
      const data = await api.getSalonById(salon.id);
      if (data) {
        // Load live services directly from the Neon-backed API
        const liveServices = await api.getServices(salon.id);
        setServices(liveServices);
        setBarbers(data.barbers || []);
        setReviews(data.reviews || []);

        const posts = await api.getSalonPosts(salon.id);
        setSalonPosts(posts);

        const likeStatuses: Record<string, boolean> = {};
        for (const post of posts) {
          if (user) {
            const like = await api.getPostLikeStatus(post.id);
            likeStatuses[post.id] = !!like.liked;
          }
        }
        setLikedPosts(likeStatuses);
      }
      if (user) {
        const favs = await api.getFavorites(user.id);
        setIsFavorite(favs.salonIds.includes(salon.id));
      }
    }
    loadData();
  }, [salon.id, user]);

  const handleToggleFavorite = async () => {
    if (!user) return;
    const newState = await api.toggleFavorite(user.id, salon.id);
    setIsFavorite(newState);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: salon.name,
        text: `صالون ${salon.name} عبر تطبيق حلاقي`,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    setIsSubmittingReview(true);
    const res = await api.submitReview({
      salonId: salon.id,
      customerId: user?.id || `cust_${Date.now()}`,
      customerName: user?.name || 'زبون حلاقي',
      rating: newRating,
      comment: newComment.trim(),
    });
    setIsSubmittingReview(false);
    if (res.success && res.review) {
      setReviews([res.review, ...reviews]);
      setNewComment('');
      setReviewSuccess(true);
      setTimeout(() => setReviewSuccess(false), 3000);
    }
  };

  // Filter services by category
  const categories = ['all', ...Array.from(new Set(services.map((s) => s.category)))];
  const filteredServices =
    selectedServiceCategory === 'all'
      ? services
      : services.filter((s) => s.category === selectedServiceCategory);

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-16">
      {/* Back button & Action Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm font-semibold text-slate-300 hover:text-white bg-[#141721] hover:bg-[#1c202e] border border-white/10 px-4 py-2 rounded-xl transition-colors"
        >
          {isRtl ? <ArrowRight className="w-4 h-4 text-[#d4af37]" /> : <ArrowLeft className="w-4 h-4 text-[#d4af37]" />}
          <span>{isRtl ? 'العودة للصالونات' : 'Back to Salons'}</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleFavorite}
            className={`p-2.5 rounded-xl border transition-all ${
              isFavorite
                ? 'bg-rose-500/20 border-rose-500/50 text-rose-400'
                : 'bg-[#141721] border-white/10 text-slate-300 hover:text-white'
            }`}
            title={t('favorites')}
          >
            <Heart className={`w-4 h-4 ${isFavorite ? 'fill-rose-400' : ''}`} />
          </button>

          <button
            onClick={handleShare}
            className="p-2.5 rounded-xl bg-[#141721] border border-white/10 text-slate-300 hover:text-white transition-colors"
            title="مشاركة"
          >
            <Share2 className="w-4 h-4" />
          </button>
          {isCopied && <span className="text-xs text-emerald-400">تم نسخ الرابط!</span>}
        </div>
      </div>

      {/* Hero Cover Banner & Salon Bio */}
      <div className="relative rounded-3xl overflow-hidden border border-[#d4af37]/25 bg-[#141721] shadow-2xl">
        <div className="relative h-64 sm:h-80 w-full overflow-hidden">
          <img
            src={salon.coverImage}
            alt={salon.name}
            className="w-full h-full object-cover brightness-75"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#141721] via-[#141721]/50 to-transparent" />

          {/* Type Badge & Status */}
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold shadow-lg flex items-center gap-1.5 ${
                salon.type === 'women'
                  ? 'bg-pink-900/80 border border-pink-400 text-pink-200'
                  : 'bg-[#141721]/90 border border-[#d4af37] text-amber-200'
              }`}
            >
              {salon.type === 'women' ? <Sparkles className="w-3.5 h-3.5" /> : <Scissors className="w-3.5 h-3.5" />}
              {salon.type === 'women' ? t('womenSalons') : t('menSalons')}
            </span>

            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-950/90 border border-emerald-500/50 text-emerald-300">
              {t('openNow')}
            </span>
          </div>
        </div>

        {/* Floating Profile Info */}
        <div className="p-6 sm:p-8 -mt-16 sm:-mt-20 relative z-10 space-y-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl sm:text-4xl font-extrabold text-white">{salon.name}</h1>
                {salon.isVerified && (
                  <span className="flex items-center gap-1 bg-[#d4af37]/20 border border-[#d4af37]/50 text-[#d4af37] text-xs px-2.5 py-1 rounded-full font-bold">
                    <ShieldCheck className="w-4 h-4" />
                    {t('verifiedSalon')}
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-1.5 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-[#d4af37] shrink-0" />
                {salon.address}
              </p>
            </div>

            {/* Price & Immediate Book CTA */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="text-end">
                <span className="text-xs text-slate-400 block">{t('startingFrom')}</span>
                <span className="text-xl sm:text-2xl font-extrabold font-mono text-[#d4af37]">
                  {salon.startingPrice.toLocaleString()} {t('iqd')}
                </span>
              </div>
              <button
                onClick={() => openBookingWizard(salon)}
                className="px-6 py-3 rounded-2xl bg-gradient-to-r from-[#d4af37] to-[#aa820a] hover:brightness-110 text-black font-extrabold text-sm shadow-xl shadow-[#d4af37]/30 flex items-center gap-2 transition-all cursor-pointer"
              >
                <Calendar className="w-4 h-4" />
                {t('bookNow')}
              </button>
            </div>
          </div>

          {/* Ratings & Contact Quick Pills */}
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-white/10">
            {/* Rating pill */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-300 text-xs font-bold">
              <Star className="w-4 h-4 fill-amber-400" />
              <span>{salon.rating}</span>
              <span className="text-slate-400 font-normal">({salon.reviewCount} {isRtl ? 'تقييم' : 'reviews'})</span>
            </div>

            {/* Direct Call */}
            <a
              href={`tel:${salon.phone}`}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-semibold transition-colors"
            >
              <Phone className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t('callSalon')}</span>
            </a>

            {/* WhatsApp */}
            <a
              href={`https://wa.me/${salon.whatsapp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                `مرحباً صالون ${salon.name}، أتواصل معكم عبر تطبيق حلاقي.`
              )}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-950/50 hover:bg-emerald-900/50 border border-emerald-500/40 text-emerald-300 text-xs font-semibold transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>{t('chatWhatsApp')}</span>
            </a>

            {/* Directions in Google Maps */}
            <a
              href={getGoogleMapsNavigationUrl(salon.lat, salon.lng, salon.name)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-sky-950/50 hover:bg-sky-900/50 border border-sky-500/40 text-sky-300 text-xs font-semibold transition-colors"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>{t('openGoogleMaps')}</span>
            </a>
          </div>

          {/* Description */}
          <p className="text-sm text-slate-300 leading-relaxed max-w-4xl">
            {salon.description}
          </p>

          {/* Salon Features / Amenities */}
          <div className="flex flex-wrap gap-2 pt-2">
            {salon.features.map((f, i) => (
              <span
                key={i}
                className="px-3 py-1 rounded-lg bg-[#181b27] border border-white/10 text-xs text-slate-300 flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5 text-[#d4af37]" />
                {f}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-2 overflow-x-auto">
        {[
          { id: 'services', label: 'الخدمات والأسعار', icon: Scissors, count: services.length },
          { id: 'barbers', label: 'طاقم الحلاقين والخبراء', icon: Users, count: barbers.length },
          { id: 'reviews', label: 'التقييمات والآراء', icon: MessageSquare, count: reviews.length },
                  { id: 'posts', label: 'أحدث القصات', icon: Heart, count: salonPosts.length },
          { id: 'hours', label: 'ساعات العمل والموقع', icon: Clock },
          { id: 'gallery', label: 'معرض الصور', icon: Sparkles, count: salon.gallery.length },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#d4af37] text-black shadow-lg shadow-[#d4af37]/20'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                    isActive ? 'bg-black/20 text-black' : 'bg-white/10 text-slate-400'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: Services Catalog */}
      {activeTab === 'services' && (
        <div className="space-y-4">
          {/* Category Filter Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedServiceCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                  selectedServiceCategory === cat
                    ? 'bg-[#d4af37]/20 border border-[#d4af37] text-[#d4af37]'
                    : 'bg-[#141721] border border-white/10 text-slate-400 hover:text-white'
                }`}
              >
                {cat === 'all'
                  ? 'الكل'
                  : cat === 'haircut'
                  ? 'قص الشعر'
                  : cat === 'beard'
                  ? 'اللحية والذقن'
                  : cat === 'packages'
                  ? 'باقات VIP'
                  : cat === 'skincare'
                  ? 'العناية بالبشرة'
                  : cat === 'color'
                  ? 'الصبغات والمعالجات'
                  : cat === 'makeup'
                  ? 'مكياج وسهرات'
                  : cat === 'bridal'
                  ? 'عرائس'
                  : cat}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredServices.map((srv) => (
              <div
                key={srv.id}
                className="p-5 rounded-2xl bg-[#141721] border border-[#d4af37]/15 hover:border-[#d4af37]/40 transition-all flex flex-col justify-between gap-4 group"
              >
                <div className="flex gap-4">
                  {srv.image && (
                    <img
                      src={srv.image}
                      alt={srv.name}
                      className="w-20 h-20 rounded-xl object-cover border border-white/10 shrink-0"
                    />
                  )}
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-white text-base group-hover:text-[#d4af37] transition-colors">
                        {srv.name}
                      </h4>
                      {srv.isPopular && (
                        <span className="bg-[#d4af37]/20 text-[#d4af37] text-[10px] px-2 py-0.5 rounded-full font-bold">
                          الأكثر طلباً
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">{srv.description}</p>
                    <div className="flex items-center gap-2 text-xs text-slate-400 pt-1">
                      <Clock className="w-3.5 h-3.5 text-[#d4af37]" />
                      <span>{srv.durationMinutes} {t('minutes')}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-white/10">
                  <span className="font-extrabold text-lg text-[#d4af37] font-mono">
                    {srv.price.toLocaleString()} {t('iqd')}
                  </span>
                  <button
                    onClick={() => openBookingWizard(salon, srv)}
                    className="px-4 py-2 rounded-xl bg-[#d4af37]/20 hover:bg-[#d4af37] text-[#d4af37] hover:text-black font-bold text-xs transition-all flex items-center gap-1"
                  >
                    <span>احجز هذه الخدمة</span>
                    {isRtl ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: Barbers / Staff */}
      {activeTab === 'barbers' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {barbers.map((barber) => (
            <div
              key={barber.id}
              className="p-5 rounded-2xl bg-[#141721] border border-white/10 hover:border-[#d4af37]/40 transition-all flex flex-col items-center text-center space-y-3"
            >
              <div className="relative">
                <img
                  src={barber.avatar}
                  alt={barber.name}
                  className="w-24 h-24 rounded-full object-cover border-2 border-[#d4af37]"
                />
                <span className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-500 border-2 border-[#141721] rounded-full" />
              </div>

              <div>
                <h4 className="font-bold text-white text-base">{barber.name}</h4>
                <p className="text-xs text-slate-400">{barber.title}</p>
                <div className="flex items-center justify-center gap-2 mt-1.5 text-xs text-amber-400 font-bold">
                  <Star className="w-3.5 h-3.5 fill-amber-400" />
                  <span>{barber.rating}</span>
                  <span className="text-slate-400 font-normal">({barber.reviewCount} تقييم)</span>
                </div>
              </div>

              <div className="flex flex-wrap justify-center gap-1">
                {barber.specializations.map((spec, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded-md bg-white/5 text-[11px] text-slate-300"
                  >
                    {spec}
                  </span>
                ))}
              </div>

              <button
                onClick={() => openBookingWizard(salon, undefined, barber)}
                className="w-full py-2.5 rounded-xl bg-[#d4af37]/20 hover:bg-[#d4af37] text-[#d4af37] hover:text-black font-bold text-xs transition-all flex items-center justify-center gap-1.5 mt-2"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>حجز موعد مع {barber.name.split(' ')[0]}</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* TAB 3: Reviews */}
      {activeTab === 'reviews' && (
        <div className="space-y-6">
          {/* Write a Review Section */}
          <div className="p-5 rounded-2xl bg-[#141721] border border-[#d4af37]/20 space-y-4">
            <h4 className="font-bold text-white text-base flex items-center gap-2">
              <Star className="w-4 h-4 text-[#d4af37]" />
              {t('rateSalon')}
            </h4>

            {reviewSuccess && (
              <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs">
                شكراً لمشاركتك رأيك! تم نشر التقييم بنجاح.
              </div>
            )}

            <form onSubmit={handleSubmitReview} className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-300">التقييم:</span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      type="button"
                      key={star}
                      onClick={() => setNewRating(star)}
                      className="p-1 text-amber-400 hover:scale-125 transition-transform"
                    >
                      <Star
                        className={`w-6 h-6 ${star <= newRating ? 'fill-amber-400' : 'text-slate-600'}`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="اكتب تجربتك مع الصالون، الخدمة، والنظافة..."
                rows={3}
                className="w-full bg-[#181b27] border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#d4af37]"
              />

              <button
                type="submit"
                disabled={isSubmittingReview || !newComment.trim()}
                className="px-5 py-2 rounded-xl bg-[#d4af37] hover:brightness-110 disabled:opacity-40 text-black font-bold text-xs transition-all"
              >
                {isSubmittingReview ? 'جاري النشر...' : 'إرسال التقييم'}
              </button>
            </form>
          </div>

          {/* List of customer reviews */}
          <div className="space-y-3">
            {reviews.map((rev) => (
              <div key={rev.id} className="p-4 rounded-2xl bg-[#141721] border border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    {rev.customerAvatar ? (
                      <img
                        src={rev.customerAvatar}
                        alt={rev.customerName}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center font-bold text-xs text-slate-300">
                        {rev.customerName.charAt(0)}
                      </div>
                    )}
                    <div>
                      <h5 className="font-bold text-white text-xs">{rev.customerName}</h5>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {new Date(rev.createdAt).toLocaleDateString(isRtl ? 'ar-IQ' : 'en-US')}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-amber-400 text-xs font-bold">
                    <Star className="w-3.5 h-3.5 fill-amber-400" />
                    <span>{rev.rating}</span>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed pr-10">{rev.comment}</p>

                {rev.reply && (
                  <div className="ms-6 p-3 rounded-xl bg-[#1a1d29] border-r-2 border-[#d4af37] text-xs text-slate-300 space-y-1">
                    <span className="font-bold text-[#d4af37] text-[11px] block">رد الصالون:</span>
                    <p>{rev.reply}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: Salon Posts / Latest Styles */}
      {activeTab === 'posts' && (
        <div className="space-y-5">
          {salonPosts.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-[#11141d] p-10 text-center">
              <Heart className="w-10 h-10 mx-auto mb-3 text-slate-500" />
              <p className="text-slate-400 text-sm">
                لا توجد منشورات لهذا الصالون حالياً
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {salonPosts.map((post) => (
                <SalonPostCard
                  key={post.id}
                  post={post}
                  liked={!!likedPosts[post.id]}
                  comments={postComments[post.id] || []}
                  user={user}
                  onLike={async () => {
                    if (!user) return;

                    setPostLoading(true);

                    const result = await api.togglePostLike(post.id);

                    if (result.success) {
                      setLikedPosts((prev) => ({
                        ...prev,
                        [post.id]: !!result.liked,
                      }));

                      setSalonPosts((prev) =>
                        prev.map((p) =>
                          p.id === post.id
                            ? {
                                ...p,
                                likeCount: result.likeCount ?? p.likeCount,
                              }
                            : p
                        )
                      );
                    }

                    setPostLoading(false);
                  }}
                  onLoadComments={async () => {
                    const comments = await api.getPostComments(post.id);

                    setPostComments((prev) => ({
                      ...prev,
                      [post.id]: comments,
                    }));
                  }}
                  onAddComment={async (comment) => {
                    if (!user) return;

                    const result = await api.addPostComment(post.id, comment);

                    if (result.success && result.comment) {
                      setPostComments((prev) => ({
                        ...prev,
                        [post.id]: [
                          ...(prev[post.id] || []),
                          result.comment!,
                        ],
                      }));

                      setSalonPosts((prev) =>
                        prev.map((p) =>
                          p.id === post.id
                            ? {
                                ...p,
                                commentCount: p.commentCount + 1,
                              }
                            : p
                        )
                      );
                    }
                  }}
                  loading={postLoading}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: Working Hours & Location Map */}
      {activeTab === 'hours' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Working Hours Table */}
          <div className="p-5 rounded-2xl bg-[#141721] border border-white/10 space-y-4">
            <h4 className="font-bold text-white text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#d4af37]" />
              أوقات العمل الأسبوعية
            </h4>

            <div className="space-y-2 text-xs">
              {[
                { day: 'السبت', hours: '10:00 ص - 11:00 م' },
                { day: 'الأحد', hours: '10:00 ص - 11:00 م' },
                { day: 'الإثنين', hours: '10:00 ص - 11:00 م' },
                { day: 'الثلاثاء', hours: '10:00 ص - 11:00 م' },
                { day: 'الأربعاء', hours: '10:00 ص - 11:00 م' },
                { day: 'الخميس', hours: '10:00 ص - 12:00 منتصف الليل' },
                { day: 'الجمعة', hours: '02:00 م - 12:00 منتصف الليل' },
              ].map((h, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-2 border-b border-white/5 text-slate-300"
                >
                  <span className="font-semibold">{h.day}</span>
                  <span className="font-mono text-[#d4af37]">{h.hours}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Location & Navigation Card */}
          <div className="p-5 rounded-2xl bg-[#141721] border border-white/10 space-y-4">
            <h4 className="font-bold text-white text-base flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#d4af37]" />
              العنوان والملاحة
            </h4>
            <p className="text-xs text-slate-300">{salon.address}</p>

            <div className="p-4 rounded-xl bg-[#0e1017] border border-white/5 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">المدينة / المنطقة:</span>
                <span className="text-white font-bold">{salon.city} - {salon.area}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">الإحداثيات:</span>
                <span className="text-slate-300 font-mono">{salon.lat.toFixed(4)}, {salon.lng.toFixed(4)}</span>
              </div>
            </div>

            <a
              href={getGoogleMapsNavigationUrl(salon.lat, salon.lng, salon.name)}
              target="_blank"
              rel="noreferrer"
              className="w-full py-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-sky-900/30"
            >
              <Navigation className="w-4 h-4" />
              <span>فتح الاتجاهات في خرائط Google</span>
            </a>
          </div>
        </div>
      )}

      {/* TAB 5: Gallery */}
      {activeTab === 'gallery' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {salon.gallery.map((img, i) => (
            <div key={i} className="h-60 rounded-2xl overflow-hidden border border-white/10 group">
              <img
                src={img}
                alt={`${salon.name} ${i + 1}`}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
