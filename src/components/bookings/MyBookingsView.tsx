import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Booking } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { useBooking } from '../../context/BookingContext';
import { api } from '../../services/api';
import {
  Calendar,
  Clock,
  User,
  Scissors,
  CheckCircle2,
  XCircle,
  Clock4,
  AlertTriangle,
  MessageCircle,
  Star,
  MapPin,
  RefreshCw,
  X
} from 'lucide-react';

interface MyBookingsViewProps {
  onSelectSalonId?: (salonId: string) => void;
}

export const MyBookingsView: React.FC<MyBookingsViewProps> = ({ onSelectSalonId }) => {
  const { t, isRtl } = useLanguage();
  const { user } = useAuth();
  const { openBookingWizard } = useBooking();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [activeFilter, setActiveFilter] = useState<'upcoming' | 'completed' | 'cancelled'>('upcoming');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Cancellation Modal State
  const [bookingToCancel, setBookingToCancel] = useState<Booking | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [isCancelling, setIsCancelling] = useState<boolean>(false);

  // Rating Modal State
  const [bookingToRate, setBookingToRate] = useState<Booking | null>(null);
  const [bookingQrToShow, setBookingQrToShow] = useState<Booking | null>(null);
  const [ratingStars, setRatingStars] = useState<number>(5);
  const [reviewComment, setReviewComment] = useState<string>('');
  const [isSubmittingRating, setIsSubmittingRating] = useState<boolean>(false);

  const loadBookings = async () => {
    setIsLoading(true);
    const list = await api.getBookings({ customerId: user?.id || 'user_cust_1' });
    setBookings(list);
    setIsLoading(false);
  };

  useEffect(() => {
    loadBookings();
  }, [user]);

  const handleConfirmCancel = async () => {
    if (!bookingToCancel) return;
    setIsCancelling(true);
    const res = await api.cancelBooking(bookingToCancel.id, cancelReason);
    setIsCancelling(false);
    if (res.success) {
      setBookingToCancel(null);
      setCancelReason('');
      await loadBookings();
    }
  };

  const handleConfirmRating = async () => {
    if (!bookingToRate || !reviewComment.trim()) return;
    setIsSubmittingRating(true);
    await api.submitReview({
      salonId: bookingToRate.salonId,
      bookingId: bookingToRate.id,
      customerId: user?.id || 'user_cust_1',
      customerName: user?.name || 'زبون حلاقي',
      rating: ratingStars,
      comment: reviewComment.trim(),
    });
    setIsSubmittingRating(false);
    setBookingToRate(null);
    setReviewComment('');
    await loadBookings();
  };

  const filteredBookings = bookings.filter((b) => {
    if (activeFilter === 'upcoming') return b.status === 'confirmed' || b.status === 'pending';
    if (activeFilter === 'completed') return b.status === 'completed';
    if (activeFilter === 'cancelled') return b.status === 'cancelled';
    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white flex items-center gap-2">
            <Calendar className="w-6 h-6 text-[#d4af37]" />
            {t('myBookings')}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {isRtl ? 'إدارة ومتابعة جميع مواعيدك وحجوزاتك الحالية والسابقة' : 'Manage and track your appointments'}
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-[#141721] border border-white/10 rounded-2xl">
          <button
            onClick={() => setActiveFilter('upcoming')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeFilter === 'upcoming'
                ? 'bg-[#d4af37] text-black shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            المواعيد القادمة ({bookings.filter((b) => b.status === 'confirmed' || b.status === 'pending').length})
          </button>

          <button
            onClick={() => setActiveFilter('completed')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeFilter === 'completed'
                ? 'bg-[#d4af37] text-black shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            المكتملة ({bookings.filter((b) => b.status === 'completed').length})
          </button>

          <button
            onClick={() => setActiveFilter('cancelled')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeFilter === 'cancelled'
                ? 'bg-[#d4af37] text-black shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            الملغاة ({bookings.filter((b) => b.status === 'cancelled').length})
          </button>
        </div>
      </div>

      {/* Bookings List */}
      {isLoading ? (
        <div className="py-16 text-center text-slate-400 text-sm">
          <div className="w-8 h-8 border-2 border-[#d4af37] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <span>جاري تحميل حجوزاتك...</span>
        </div>
      ) : filteredBookings.length === 0 ? (
        <div className="py-16 text-center p-8 rounded-3xl bg-[#141721] border border-white/10 space-y-4">
          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-slate-500 mx-auto">
            <Calendar className="w-8 h-8" />
          </div>
          <div>
            <h4 className="text-lg font-bold text-white">لا توجد حجوزات في هذه القائمة</h4>
            <p className="text-xs text-slate-400 mt-1">
              {activeFilter === 'upcoming'
                ? 'ليس لديك أي مواعيد قادمة حالياً. تصفح الصالونات واحجز موعدك بسهولة.'
                : 'لا توجد سجلات سابقة.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredBookings.map((b) => (
            <div
              key={b.id}
              className="p-5 rounded-3xl bg-[#141721] border border-[#d4af37]/20 shadow-xl space-y-4 relative overflow-hidden"
            >
              {/* Card Header with Booking Number & Status Badge */}
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-semibold">
                    {t('bookingNumber')}
                  </span>
                  <span className="font-mono font-bold text-sm text-[#d4af37]">
                    {b.bookingNumber}
                  </span>
                </div>

                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
                    b.status === 'confirmed'
                      ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/40'
                      : b.status === 'completed'
                      ? 'bg-sky-950/60 text-sky-300 border border-sky-500/40'
                      : 'bg-red-950/60 text-red-300 border border-red-500/40'
                  }`}
                >
                  {b.status === 'confirmed' && <CheckCircle2 className="w-3.5 h-3.5" />}
                  {b.status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5" />}
                  {b.status === 'cancelled' && <XCircle className="w-3.5 h-3.5" />}
                  {b.status === 'confirmed' ? t('confirmed') : b.status === 'completed' ? t('completed') : t('cancelled')}
                </span>
              </div>

              {/* Booking Core Info */}
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-start">
                  <span className="text-slate-400">الصالون:</span>
                  <span className="font-bold text-white text-end">{b.salonName}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-400">الخدمة:</span>
                  <span className="font-semibold text-slate-200">{b.serviceName}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-400">الحلاق / الخبير:</span>
                  <span className="font-bold text-[#d4af37]">{b.barberName}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-400">الموعد:</span>
                  <span className="font-mono font-bold text-white bg-white/5 px-2.5 py-1 rounded-lg">
                    {b.date} • {b.timeSlot}
                  </span>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-white/5">
                  <span className="text-slate-400">المبلغ الإجمالي:</span>
                  <span className="font-extrabold text-sm text-[#d4af37] font-mono">
                    {b.finalPrice.toLocaleString()} {t('iqd')}
                  </span>
                </div>
              </div>

              {/* Customer completion QR */}
        {b.status === 'confirmed' &&
          b.completionQrNonce &&
          b.completionQrExpiresAt &&
          new Date(b.completionQrExpiresAt).getTime() > Date.now() && (
            <button
              type="button"
              onClick={() => setBookingQrToShow(b)}
              className="w-full rounded-2xl border border-[#d4af37]/30 bg-[#d4af37]/10 hover:bg-[#d4af37]/15 p-3 text-[#d4af37] text-xs font-bold transition-colors"
            >
              عرض QR لإتمام الخدمة
            </button>
          )}

        {/* Action Buttons */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10">
                {/* Direct WhatsApp button to salon */}
                <a
                  href={`https://wa.me/${b.salonPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                    `مرحباً، أستفسر بخصوص حجز رقم ${b.bookingNumber} ليوم ${b.date} في ${b.salonName}.`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-2 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">واتساب</span>
                </a>

                <div className="flex items-center gap-2">
                  {/* Cancel Button (only for upcoming confirmed) */}
                  {(b.status === 'confirmed' || b.status === 'pending') && (
                    <button
                      onClick={() => setBookingToCancel(b)}
                      className="px-3 py-2 rounded-xl bg-red-950/40 hover:bg-red-900/50 border border-red-500/40 text-red-300 text-xs font-semibold transition-colors"
                    >
                      {t('cancelBooking')}
                    </button>
                  )}

                  {/* Rate Salon Button (for completed unrated bookings) */}
                  {b.status === 'completed' && !b.rated && (
                    <button
                      onClick={() => setBookingToRate(b)}
                      className="px-3.5 py-2 rounded-xl bg-[#d4af37]/20 hover:bg-[#d4af37]/30 text-[#d4af37] text-xs font-bold transition-colors flex items-center gap-1"
                    >
                      <Star className="w-3.5 h-3.5" />
                      <span>{t('rateSalon')}</span>
                    </button>
                  )}

                  {/* Re-book / View Salon */}
                  {onSelectSalonId && (
                    <button
                      onClick={() => onSelectSalonId(b.salonId)}
                      className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors"
                    >
                      {t('viewSalon')}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Cancellation Confirmation Dialog Modal */}
      {bookingToCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#141721] border border-red-500/30 rounded-3xl p-6 shadow-2xl space-y-4 text-slate-200">
            <div className="flex items-center gap-3 text-red-400">
              <div className="w-12 h-12 rounded-full bg-red-950/60 border border-red-500/40 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-white">تأكيد إلغاء الموعد</h3>
                <span className="text-xs font-mono text-[#d4af37]">{bookingToCancel.bookingNumber}</span>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              هل أنت متأكد من رغبتك في إلغاء حجز موعدك في <strong className="text-white">{bookingToCancel.salonName}</strong> يوم <strong className="text-white">{bookingToCancel.date}</strong> الساعة <strong className="text-white">{bookingToCancel.timeSlot}</strong>؟
            </p>

            <div className="space-y-1">
              <label className="text-xs text-slate-400">سبب الإلغاء (اختياري):</label>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="مثال: تغيير في جدول أعمالي"
                className="w-full bg-[#181b27] border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[#d4af37]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setBookingToCancel(null)}
                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-300"
              >
                تراجع
              </button>

              <button
                type="button"
                disabled={isCancelling}
                onClick={handleConfirmCancel}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all shadow-lg shadow-red-900/30"
              >
                {isCancelling ? 'جاري الإلغاء...' : 'نعم، إلغاء الموعد'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rate Salon Modal */}
      {bookingQrToShow && (
        <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-[#141721] border border-white/10 shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-white/10 flex items-center justify-between gap-3">
              <div>
                <h3 className="font-black text-white">
                  QR إتمام الخدمة
                </h3>
                <p className="text-[11px] text-slate-400 mt-1">
                  اعرض هذا الرمز لصاحب الصالون
                </p>
              </div>

              <button
                type="button"
                onClick={() => setBookingQrToShow(null)}
                className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 text-white"
              >
                <X className="w-4 h-4 mx-auto" />
              </button>
            </div>

            <div className="p-6 flex flex-col items-center gap-4">
              <div className="rounded-2xl bg-white p-4">
                <QRCodeSVG
                  value={`${bookingQrToShow.id}:${bookingQrToShow.completionQrNonce}`}
                  size={240}
                  level="H"
                  includeMargin
                />
              </div>

              <div className="text-center text-[11px] text-slate-400 leading-relaxed">
                <p>
                  هذا الرمز خاص بحجز:
                  <span className="text-[#d4af37] font-mono font-bold mx-1">
                    {bookingQrToShow.bookingNumber}
                  </span>
                </p>
                <p className="mt-1">
                  صالح حتى{' '}
                  {new Date(
                    bookingQrToShow.completionQrExpiresAt || ''
                  ).toLocaleString(isRtl ? 'ar-IQ' : 'en-US')}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setBookingQrToShow(null)}
                className="w-full px-4 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-bold"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {bookingToRate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#141721] border border-[#d4af37]/30 rounded-3xl p-6 shadow-2xl space-y-4 text-slate-200">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-white flex items-center gap-2">
                <Star className="w-5 h-5 text-[#d4af37]" />
                تقييم تجربة الصالون
              </h3>
              <button onClick={() => setBookingToRate(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              كيف كانت تجربتك في <strong className="text-white">{bookingToRate.salonName}</strong> مع الحلاق <strong className="text-[#d4af37]">{bookingToRate.barberName}</strong>؟
            </p>

            <div className="flex items-center justify-center gap-2 py-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRatingStars(star)}
                  className="p-1 text-amber-400 hover:scale-125 transition-transform"
                >
                  <Star
                    className={`w-8 h-8 ${star <= ratingStars ? 'fill-amber-400' : 'text-slate-600'}`}
                  />
                </button>
              ))}
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">تعليقك وتقييمك:</label>
              <textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="اكتب عن دقة الموعد، النظافة، وجودة التصفيف..."
                rows={3}
                className="w-full bg-[#181b27] border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#d4af37]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setBookingToRate(null)}
                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-300"
              >
                إلغاء
              </button>

              <button
                type="button"
                disabled={isSubmittingRating || !reviewComment.trim()}
                onClick={handleConfirmRating}
                className="px-6 py-2.5 rounded-xl bg-[#d4af37] hover:brightness-110 disabled:opacity-40 text-black text-xs font-bold transition-all"
              >
                {isSubmittingRating ? 'جاري الإرسال...' : 'إرسال التقييم'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
