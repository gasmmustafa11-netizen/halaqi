import React, { useState, useEffect } from 'react';
import { useBooking, getTomorrowDate } from '../../context/BookingContext';
import { useLanguage } from '../../context/LanguageContext';
import { Service, Barber, PaymentMethod } from '../../types';
import { api } from '../../services/api';
import {
  X,
  Calendar,
  Clock,
  User,
  Scissors,
  CheckCircle,
  AlertCircle,
  Tag,
  CreditCard,
  Banknote,
  Smartphone,
  ChevronRight,
  ChevronLeft,
  Share2,
  Phone,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  MapPin,
  FileText
} from 'lucide-react';

interface BookingWizardModalProps {
  onGoToBookings?: () => void;
}

export const BookingWizardModal: React.FC<BookingWizardModalProps> = ({ onGoToBookings }) => {
  const {
    isBookingOpen,
    activeSalon,
    selectedService,
    selectedDate,
    selectedTimeSlot,
    customerName,
    customerPhone,
    customerNotes,
    paymentMethod,
    appliedCoupon,
    discountAmount,
    step,
    isLoading,
    error,
    confirmedBooking,
    occupiedSlots,
    closeBookingWizard,
    setStep,
    setSelectedService,
    setSelectedBarber,
    setSelectedDate,
    setSelectedTimeSlot,
    setCustomerName,
    setCustomerPhone,
    setCustomerNotes,
    setPaymentMethod,
    applyCouponCode,
    removeCoupon,
    fetchOccupiedSlots,
    confirmBooking,
    resetBookingState,
  } = useBooking();

  const { t, isRtl } = useLanguage();
  const [couponInput, setCouponInput] = useState<string>('');
  const [couponError, setCouponError] = useState<string | null>(null);
  const [realServices, setRealServices] = useState<Service[]>([]);
  const [isLoadingServices, setIsLoadingServices] = useState(false);

  // Generate 14 upcoming selectable days
  const upcomingDates = Array.from({ length: 14 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i + 1);
    const dateStr = d.toISOString().split('T')[0];
    const dayNameAr = new Intl.DateTimeFormat('ar-IQ', { weekday: 'short' }).format(d);
    const dayNameEn = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(d);
    const dayNumber = d.getDate();
    const monthNameAr = new Intl.DateTimeFormat('ar-IQ', { month: 'short' }).format(d);
    const monthNameEn = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(d);
    return {
      dateStr,
      dayName: isRtl ? dayNameAr : dayNameEn,
      dayNumber,
      monthName: isRtl ? monthNameAr : monthNameEn,
    };
  });

  // Generate standard 30-min time slots from 10:00 to 22:30
  const timeSlots = [
    '10:00', '10:30', '11:00', '11:30',
    '12:00', '12:30', '13:00', '13:30',
    '14:00', '14:30', '15:00', '15:30',
    '16:00', '16:30', '17:00', '17:30',
    '18:00', '18:30', '19:00', '19:30',
    '20:00', '20:30', '21:00', '21:30',
    '22:00', '22:30',
  ];


    // Load actual salon services from the Neon-backed API.
    useEffect(() => {
      if (!activeSalon?.id) {
        setRealServices([]);
        return;
      }

      let cancelled = false;

      const loadServices = async () => {
        setIsLoadingServices(true);

        try {
          const services = await api.getServices(activeSalon.id);

          if (!cancelled) {
            setRealServices(services);
          }
        } catch (error) {
          console.error('[BOOKING SERVICES] Failed to load:', error);

          if (!cancelled) {
            setRealServices([]);
          }
        } finally {
          if (!cancelled) {
            setIsLoadingServices(false);
          }
        }
      };

      loadServices();

      return () => {
        cancelled = true;
      };
    }, [activeSalon?.id]);

  if (!isBookingOpen || !activeSalon) return null;

  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) return;
    setCouponError(null);
    const ok = await applyCouponCode(couponInput.trim());
    if (!ok) {
      setCouponError(isRtl ? 'كود الخصم غير صالح أو لا ينطبق على هذه الخدمة' : 'Invalid promo code');
    } else {
      setCouponInput('');
    }
  };

  const handleCreateAppointment = async () => {
    await confirmBooking();
  };

  const totalRawPrice = selectedService?.price || 0;
  const finalPrice = Math.max(0, totalRawPrice - discountAmount);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-[#141721] border border-[#d4af37]/30 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header with Salon Info and Progress */}
        <div className="p-4 sm:p-5 border-b border-white/10 bg-[#0d0f14] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={activeSalon.coverImage}
              alt={activeSalon.name}
              className="w-12 h-12 rounded-xl object-cover border border-[#d4af37]/30 shrink-0"
            />
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-bold text-base sm:text-lg text-white">{activeSalon.name}</h3>
                {activeSalon.isVerified && (
                  <ShieldCheck className="w-4 h-4 text-[#d4af37]" />
                )}
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-[#d4af37]" />
                {activeSalon.area}، {activeSalon.city}
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              resetBookingState();
              closeBookingWizard();
            }}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Progress Pills (if not confirmed) */}
        {step <= 5 && (
          <div className="px-4 sm:px-6 py-3 bg-[#11131b] border-b border-white/5 flex items-center justify-between text-xs overflow-x-auto gap-2">
            {[
              { num: 1, step: 1, label: t('selectService') },
              { num: 2, step: 2, label: t('selectDate') },
              { num: 3, step: 3, label: t('selectTime') },
              { num: 4, step: 4, label: t('customerInfo') },
            ].map((st) => (
              <button
                key={st.num}
                onClick={() => {
                  if (st.step < step) setStep(st.step);
                }}
                disabled={st.step > step}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full whitespace-nowrap transition-all ${
                  step === st.step
                    ? 'bg-[#d4af37] text-black font-bold shadow-md'
                    : step > st.step
                    ? 'bg-[#d4af37]/20 text-[#d4af37] font-semibold cursor-pointer'
                    : 'text-slate-500 opacity-50 cursor-not-allowed'
                }`}
              >
                <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] bg-black/20">
                  {st.num}
                </span>
                <span className="hidden sm:inline">{st.label.replace(/^\d+\.\s*/, '')}</span>
              </button>
            ))}
          </div>
        )}

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 text-slate-200">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: Select Service */}
            {/* STEP 1: Select Service */}
            {step === 1 && (
              <div className="space-y-4">
                <h4 className="font-bold text-lg text-white flex items-center gap-2">
                  <Scissors className="w-5 h-5 text-[#d4af37]" />
                  {t('selectService')}
                </h4>

                <p className="text-xs text-slate-400">
                  {isRtl
                    ? 'اختر الخدمة المطلوبة لحجز موعد مع خبير التصفيف المناسب'
                    : 'Choose the service you want to book'}
                </p>

                <div className="grid grid-cols-1 gap-3">
                  {isLoadingServices ? (
                    <div className="p-6 text-center text-slate-400 text-sm">
                      {isRtl ? 'جاري تحميل الخدمات...' : 'Loading services...'}
                    </div>
                  ) : realServices.length === 0 ? (
                    <div className="p-6 text-center rounded-2xl border border-white/5 bg-[#181b27] text-slate-400 text-sm">
                      {isRtl
                        ? 'لا توجد خدمات متاحة لهذا الصالون حالياً.'
                        : 'No services are currently available for this salon.'}
                    </div>
                  ) : (
                    realServices.map((srv) => {
                      const isSelected = selectedService?.id === srv.id;

                      return (
                        <div
                          key={srv.id}
                          onClick={() => {
                            setSelectedService(srv);
                            setStep(2);
                          }}
                          className={`p-3.5 sm:p-4 rounded-2xl border cursor-pointer transition-all flex items-center justify-between gap-4 ${
                            isSelected
                              ? 'bg-[#d4af37]/15 border-[#d4af37] ring-1 ring-[#d4af37]'
                              : 'bg-[#181b27] border-white/5 hover:border-[#d4af37]/40 hover:bg-[#1f2333]'
                          }`}
                        >
                          <div className="space-y-1 min-w-0">
                            <h5 className="font-bold text-white text-sm sm:text-base">
                              {isRtl ? srv.name : (srv.nameEn || srv.name)}
                            </h5>

                            <p className="text-xs text-slate-400 line-clamp-1">
                              {srv.description || ''}
                            </p>

                            <div className="flex items-center gap-3 text-xs text-slate-300">
                              <span className="flex items-center gap-1 text-slate-400">
                                <Clock className="w-3.5 h-3.5 text-[#d4af37]" />
                                {srv.durationMinutes} {t('minutes')}
                              </span>
                            </div>
                          </div>

                          <div className="text-end shrink-0">
                            <span className="font-bold text-base sm:text-lg text-[#d4af37] block font-mono">
                              {Number(srv.price || 0).toLocaleString()} {t('iqd')}
                            </span>

                            <span className="text-[11px] text-slate-400 underline">
                              {isSelected ? 'محدد ✓' : 'اختيار'}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

          {/* STEP 2: Select Date */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-lg text-white flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-[#d4af37]" />
                  {t('selectDate')}
                </h4>
                <button
                  onClick={() => setStep(1)}
                  className="text-xs text-[#d4af37] hover:underline"
                >
                  {t('selectService')}
                </button>
              </div>

              <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                {upcomingDates.map((item) => {
                  const isSelected = selectedDate === item.dateStr;
                  return (
                    <button
                      key={item.dateStr}
                      onClick={() => {
                        setSelectedDate(item.dateStr);
                        setStep(3);
                      }}
                      className={`p-3 rounded-2xl border flex flex-col items-center justify-center transition-all ${
                        isSelected
                          ? 'bg-[#d4af37] text-black font-bold border-[#d4af37] shadow-lg shadow-[#d4af37]/20 scale-105'
                          : 'bg-[#181b27] border-white/5 hover:border-[#d4af37]/40 text-slate-200'
                      }`}
                    >
                      <span className={`text-[11px] ${isSelected ? 'text-black' : 'text-slate-400'}`}>
                        {item.dayName}
                      </span>
                      <span className="text-xl font-bold font-mono my-0.5">{item.dayNumber}</span>
                      <span className={`text-[10px] ${isSelected ? 'text-black' : 'text-slate-500'}`}>
                        {item.monthName}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 3: Select Time Slot (Atomic Concurrency Prevention) */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-lg text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-[#d4af37]" />
                  {t('selectTime')} ({selectedDate})
                </h4>
                <button
                  onClick={() => setStep(2)}
                  className="text-xs text-[#d4af37] hover:underline"
                >
                  تغيير التاريخ
                </button>
              </div>

              <p className="text-xs text-slate-400">
                {isRtl
                  ? 'المواعيد المتاحة محددة باللون الذهبي. المواعيد المحجوزة مسبقاً غير متاحة للاختيار منعاً للازدواجية.'
                  : 'Available time slots. Occupied slots are strictly locked to avoid double booking.'}
              </p>

              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 max-h-64 overflow-y-auto pr-1">
                {timeSlots.map((slot) => {
                  const isOccupied = occupiedSlots.includes(slot);
                  const isSelected = selectedTimeSlot === slot;

                  return (
                    <button
                      key={slot}
                      disabled={isOccupied}
                      onClick={() => {
                        setSelectedTimeSlot(slot);
                        setStep(4);
                      }}
                      className={`p-3 rounded-xl border text-center font-mono text-sm transition-all flex flex-col items-center justify-center ${
                        isOccupied
                          ? 'bg-red-950/20 border-red-900/30 text-slate-500 line-through opacity-40 cursor-not-allowed'
                          : isSelected
                          ? 'bg-[#d4af37] text-black font-bold border-[#d4af37] shadow-lg shadow-[#d4af37]/30 scale-105'
                          : 'bg-[#181b27] border-white/5 hover:border-[#d4af37]/50 text-slate-200 hover:bg-[#202534]'
                      }`}
                    >
                      <span className="font-bold">{slot}</span>
                      <span className={`text-[10px] ${isOccupied ? 'text-red-400' : isSelected ? 'text-black' : 'text-[#d4af37]'}`}>
                        {isOccupied ? t('occupied') : t('available')}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 4: Customer Details, Coupon & Payment Method */}
          {step === 4 && (
            <div className="space-y-4">
              <h4 className="font-bold text-lg text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#d4af37]" />
                {t('customerInfo')}
              </h4>

              {/* Summary of chosen service & appointment */}
              <div className="p-3.5 rounded-2xl bg-[#0e1017] border border-white/10 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">الخدمة:</span>
                  <span className="font-bold text-white">{selectedService?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">الموعد:</span>
                  <span className="font-bold text-white font-mono">
                    {selectedDate} • {selectedTimeSlot}
                  </span>
                </div>
                <div className="flex justify-between pt-1 border-t border-white/10">
                  <span className="text-slate-400">السعر الأساسي:</span>
                  <span className="font-bold text-white font-mono">
                    {totalRawPrice.toLocaleString()} {t('iqd')}
                  </span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-400">
                    <span>خصم الكوبون ({appliedCoupon?.code}):</span>
                    <span className="font-bold font-mono">
                      -{discountAmount.toLocaleString()} {t('iqd')}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold pt-1 border-t border-[#d4af37]/30 text-[#d4af37]">
                  <span>المبلغ النهائي:</span>
                  <span className="font-mono">{finalPrice.toLocaleString()} {t('iqd')}</span>
                </div>
              </div>

              {/* Customer Inputs */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {t('fullName')} *
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="مثال: أحمد الموسوي"
                    className="w-full bg-[#181b27] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#d4af37]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {t('phoneNumber')} *
                  </label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="+964 780 123 4567"
                    dir="ltr"
                    className="w-full bg-[#181b27] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#d4af37] text-start"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {t('notesOptional')}
                  </label>
                  <input
                    type="text"
                    value={customerNotes}
                    onChange={(e) => setCustomerNotes(e.target.value)}
                    placeholder="أي متطلبات خاصة أو استفسار للصالون..."
                    className="w-full bg-[#181b27] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#d4af37]"
                  />
                </div>

                {/* Coupon Box */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {t('applyCoupon')}
                  </label>
                  {appliedCoupon ? (
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-500/40 text-emerald-300 text-xs">
                      <span className="flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5" />
                        تم تفعيل كود {appliedCoupon.code} (خصم {appliedCoupon.discountPercent}%)
                      </span>
                      <button onClick={removeCoupon} className="text-red-400 hover:underline">
                        إزالة
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={couponInput}
                        onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                        placeholder={t('couponCodePlaceholder')}
                        className="flex-1 bg-[#181b27] border border-white/10 rounded-xl px-3 py-2 text-xs text-white uppercase focus:outline-none focus:border-[#d4af37]"
                      />
                      <button
                        type="button"
                        onClick={handleApplyCoupon}
                        className="px-4 py-2 rounded-xl bg-[#d4af37]/20 hover:bg-[#d4af37]/30 text-[#d4af37] text-xs font-bold transition-colors"
                      >
                        {t('applyCoupon')}
                      </button>
                    </div>
                  )}
                  {couponError && <p className="text-[11px] text-red-400 mt-1">{couponError}</p>}
                </div>

                {/* Payment Method */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    طريقة الدفع
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('cash')}
                      className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-semibold transition-all ${
                        paymentMethod === 'cash'
                          ? 'bg-[#d4af37]/20 border-[#d4af37] text-[#d4af37]'
                          : 'bg-[#181b27] border-white/5 text-slate-300'
                      }`}
                    >
                      <Banknote className="w-4 h-4 text-[#d4af37]" />
                      <span>{t('payOnArrival')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('zain_cash')}
                      className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-semibold transition-all ${
                        paymentMethod === 'zain_cash'
                          ? 'bg-[#d4af37]/20 border-[#d4af37] text-[#d4af37]'
                          : 'bg-[#181b27] border-white/5 text-slate-300'
                      }`}
                    >
                      <Smartphone className="w-4 h-4 text-rose-400" />
                      <span>{t('payZainCash')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('qi_card')}
                      className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-semibold transition-all ${
                        paymentMethod === 'qi_card'
                          ? 'bg-[#d4af37]/20 border-[#d4af37] text-[#d4af37]'
                          : 'bg-[#181b27] border-white/5 text-slate-300'
                      }`}
                    >
                      <CreditCard className="w-4 h-4 text-amber-400" />
                      <span>{t('payQiCard')}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: Booking Confirmed Screen */}
          {step === 5 && confirmedBooking && (
            <div className="py-4 text-center space-y-5 animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center text-emerald-400 mx-auto">
                <CheckCircle className="w-10 h-10" />
              </div>

              <div>
                <h4 className="text-xl sm:text-2xl font-bold text-white">{t('bookingSuccessTitle')}</h4>
                <p className="text-xs text-slate-400 mt-1">
                  {isRtl
                    ? 'تم تسجيل موعدك في النظام وإرسال إشعار فوري للصالون لترتيب استقبالك'
                    : 'Your appointment is registered and notified to the salon.'}
                </p>
              </div>

              {/* Digital Pass Receipt */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-b from-[#181b27] to-[#0f1118] border border-[#d4af37]/40 text-start space-y-3 shadow-xl max-w-md mx-auto">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div>
                    <span className="text-[11px] text-slate-400 block">{t('bookingNumber')}</span>
                    <span className="text-base sm:text-lg font-bold font-mono text-[#d4af37]">
                      {confirmedBooking.bookingNumber}
                    </span>
                  </div>
                  <div className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold">
                    {t('confirmed')}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400 block">الصالون:</span>
                    <span className="font-bold text-white">{confirmedBooking.salonName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">الخدمة:</span>
                    <span className="font-bold text-white">{confirmedBooking.serviceName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">الحلاق / الأخصائي:</span>
                    <span className="font-bold text-[#d4af37]">{confirmedBooking.barberName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">التاريخ والوقت:</span>
                    <span className="font-bold text-white font-mono">
                      {confirmedBooking.date} • {confirmedBooking.timeSlot}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">الزبون:</span>
                    <span className="font-bold text-white">{confirmedBooking.customerName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">المبلغ:</span>
                    <span className="font-bold text-[#d4af37] font-mono text-sm">
                      {confirmedBooking.finalPrice.toLocaleString()} {t('iqd')}
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-[#d4af37]" />
                    {confirmedBooking.salonAddress}
                  </span>
                </div>
              </div>

              {/* Direct WhatsApp Confirmation Link */}
              <div className="flex flex-wrap items-center justify-center gap-3">
                <a
                  href={`https://wa.me/${confirmedBooking.salonPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                    `مرحباً ${confirmedBooking.salonName}، قمت بحجز موعد عبر تطبيق حلاقي برقم ${confirmedBooking.bookingNumber} ليوم ${confirmedBooking.date} الساعة ${confirmedBooking.timeSlot} مع ${confirmedBooking.barberName}.`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 transition-all shadow-lg shadow-emerald-900/30"
                >
                  <MessageCircle className="w-4 h-4" />
                  {isRtl ? 'إرسال تأكيد عبر واتساب الصالون' : 'Send WhatsApp to Salon'}
                </a>

                {onGoToBookings && (
                  <button
                    onClick={() => {
                      closeBookingWizard();
                      onGoToBookings();
                    }}
                    className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs transition-colors"
                  >
                    {t('myBookings')}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer / Navigation Buttons */}
        {step <= 5 && (
          <div className="p-4 sm:p-5 border-t border-white/10 bg-[#0d0f14] flex items-center justify-between">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-300 transition-colors"
              >
                السابق
              </button>
            ) : (
              <div />
            )}

            {step < 5 ? (
              <button
                type="button"
                disabled={
                  (step === 1 && !selectedService) ||
                  (step === 2 && !selectedDate) ||
                  (step === 3 && !selectedTimeSlot)
                }
                onClick={() => setStep(step + 1)}
                className="px-6 py-2.5 rounded-xl bg-[#d4af37] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold text-black shadow-lg shadow-[#d4af37]/20 transition-all flex items-center gap-1.5"
              >
                التالي
                {isRtl ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            ) : (
              <button
                type="button"
                disabled={isLoading || !customerName.trim() || !customerPhone.trim()}
                onClick={handleCreateAppointment}
                className="px-8 py-3 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#aa820a] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-bold text-black shadow-xl shadow-[#d4af37]/30 transition-all flex items-center gap-2"
              >
                {isLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    <span>جاري تأكيد الحجز...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>تأكيد الموعد ({finalPrice.toLocaleString()} {t('iqd')})</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
