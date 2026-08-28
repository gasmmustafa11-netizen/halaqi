import React, { useState, useEffect } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Salon, Service, Barber, Booking, SalonPost, PostComment } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { notify, confirmDialog } from '../../utils/notifications';
import { compressImageToDataUrl } from '../../utils/compressImage';
import { Camera as CapacitorCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import {
  Calendar,
  Clock,
  User,
  Scissors,
  CheckCircle2,
  XCircle,
  Plus,
  Edit2,
  Trash2,
  DollarSign,
  TrendingUp,
  Star,
  Users,
  ShieldCheck,
  Phone,
  MessageCircle,
  Settings,
  Lock,
  Sparkles,
  AlertCircle,
  ScanLine
} from 'lucide-react';

export const SalonDashboardView: React.FC = () => {
  const { t, isRtl } = useLanguage();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<'calendar' | 'services' | 'staff' | 'availability' | 'profile' | 'posts'>('calendar');
  const [salon, setSalon] = useState<Salon | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [isQrScannerOpen, setIsQrScannerOpen] = useState<boolean>(false);
  const [qrScannerError, setQrScannerError] = useState<string>('');
  const qrScannerRef = React.useRef<Html5Qrcode | null>(null);
  const qrScannerElementId = 'halaqi-qr-reader';


  // New Service Modal
  const [isServiceModalOpen, setIsServiceModalOpen] = useState<boolean>(false);
  const [selectedPostImage, setSelectedPostImage] = useState<string | null>(null);
  const [salonPosts, setSalonPosts] = useState<SalonPost[]>([]);
  const [postLikeStatus, setPostLikeStatus] = useState<Record<string, boolean>>({});
  const [postComments, setPostComments] = useState<Record<string, PostComment[]>>({});
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});


  const [isPublishingPost, setIsPublishingPost] = useState<boolean>(false);
  const [editingService, setEditingService] = useState<Partial<Service> | null>(null);

  // New Staff Modal
  const [isStaffModalOpen, setIsStaffModalOpen] = useState<boolean>(false);
  const [editingStaff, setEditingStaff] = useState<Partial<Barber> | null>(null);

  // Block Time State
  const [blockedDate, setBlockedDate] = useState<string>('');
  const [blockedStartTime, setBlockedStartTime] = useState<string>('14:00');
  const [blockedEndTime, setBlockedEndTime] = useState<string>('16:00');
  const [blockedBarberId, setBlockedBarberId] = useState<string>('all');
  const [blockReason, setBlockReason] = useState<string>('');
  const [blockSuccess, setBlockSuccess] = useState<boolean>(false);

  const handleSelectPostImage = async () => {
    try {
      const photo = await CapacitorCamera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Photos,
      });

      if (photo.dataUrl) {
        setSelectedPostImage(photo.dataUrl);
      }
    } catch (error) {
      console.error('Image selection cancelled or failed:', error);
    }
  };

  const loadPostComments = async (postId: string) => {
    try {
      const comments = await api.getPostComments(postId);

      setPostComments((prev) => ({
        ...prev,
        [postId]: comments,
      }));
    } catch (error) {
      console.error('Load post comments error:', error);
    }
  };

  const handleTogglePostLike = async (post: SalonPost) => {
    try {
      const result = await api.togglePostLike(post.id);

      if (!result.success) {
        notify(result.error || 'تعذر تنفيذ الإعجاب.', 'error');
        return;
      }

      setPostLikeStatus((prev) => ({
        ...prev,
        [post.id]: result.liked ?? false,
      }));

      setSalonPosts((prev) =>
        prev.map((item) =>
          item.id === post.id
            ? { ...item, likeCount: result.likeCount ?? item.likeCount }
            : item
        )
      );
    } catch (error) {
      console.error('Toggle post like error:', error);
      notify('حدث خطأ أثناء تنفيذ الإعجاب.', 'error');
    }
  };

  const handleDeleteSalonPost = async (id: string) => {
    if (!(await confirmDialog({ message: 'هل أنت متأكد من حذف هذا المنشور؟', danger: true }))) return;

    try {
      const result = await api.deleteSalonPost(id);

      if (!result.success) {
        notify(result.error || 'تعذر حذف المنشور.', 'error');
        return;
      }

      setSalonPosts((prev) => prev.filter((post) => post.id !== id));
      notify('تم حذف المنشور بنجاح.', 'success');
    } catch (error) {
      console.error('Delete salon post error:', error);
      notify('حدث خطأ أثناء حذف المنشور.', 'error');
    }
  };

  const loadDashboardData = async () => {
    setIsLoading(true);
    // Only use a salon owned by the current user.
    // Salon owners can access the dashboard only after admin approval.
    const allSalons = await api.getSalons({ includePending: true });
    const mySalon = allSalons.find((s) => s.ownerId === user?.id);

    if (!mySalon || mySalon.status !== 'approved') {
      setSalon(null);
      setServices([]);
      setBarbers([]);
      setBookings([]);
      setSalonPosts([]);
      setIsLoading(false);
      return;
    }

    {
      setSalon(mySalon);
      const salonDetails = await api.getSalonById(mySalon.id);
      if (salonDetails) {
        setServices(salonDetails.services || []);
        setBarbers(salonDetails.barbers || []);
      }
      const salonBookings = await api.getBookings({ salonId: mySalon.id });
      setBookings(salonBookings);

      const posts = await api.getSalonPosts(mySalon.id);
      setSalonPosts(posts);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadDashboardData();
  }, [user?.id]);

  const stopQrScanner = async () => {
    try {
      if (qrScannerRef.current) {
        const scannerState = qrScannerRef.current.getState();

        if (scannerState !== undefined && scannerState !== 1) {
          await qrScannerRef.current.stop();
        }

        qrScannerRef.current.clear();
        qrScannerRef.current = null;
      }
    } catch (error) {
      console.error('[QR SCANNER] Stop failed:', error);
    }
  };

  const closeQrScanner = async () => {
    await stopQrScanner();
    setIsQrScannerOpen(false);
    setQrScannerError('');
  };

  const startQrScanner = async () => {
    setIsQrScannerOpen(true);
    setQrScannerError('');

    try {
      await new Promise((resolve) => setTimeout(resolve, 150));

      const scanner = new Html5Qrcode(qrScannerElementId);
      qrScannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1,
        },
        async (decodedText) => {
          await stopQrScanner();

          const separatorIndex = decodedText.indexOf(':');

          if (separatorIndex <= 0) {
            setQrScannerError('رمز QR غير صالح.');
            setIsQrScannerOpen(true);
            return;
          }

          const bookingId = decodedText.slice(0, separatorIndex);
          const qrNonce = decodedText.slice(separatorIndex + 1);

          if (!bookingId || !qrNonce) {
            setQrScannerError('رمز QR غير صالح.');
            setIsQrScannerOpen(true);
            return;
          }

          const result = await api.completeBookingByQr(
            bookingId,
            qrNonce
          );

          if (!result.success) {
            setQrScannerError(
              result.error || 'تعذر إكمال الخدمة عبر QR.'
            );
            setIsQrScannerOpen(true);
            return;
          }

          setIsQrScannerOpen(false);
          setQrScannerError('');
          await loadDashboardData();
          notify('تم تأكيد إتمام الخدمة بنجاح.', 'success');
        },
        () => {
          // Ignore normal frame-by-frame scan misses.
        }
      );
    } catch (error: any) {
      console.error('[QR SCANNER] Start failed:', error);

      setQrScannerError(
        error?.message ||
          'تعذر تشغيل الكاميرا. تأكد من السماح بالوصول إلى الكاميرا.'
      );
    }
  };

  useEffect(() => {
    return () => {
      void stopQrScanner();
    };
  }, []);

  const handleUpdateBookingStatus = async (bookingId: string, status: string) => {
    await api.updateBookingStatus(bookingId, status);
    await loadDashboardData();
  };

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingService?.name || !editingService?.price || !salon) return;

    try {
      if (editingService.id) {
        await api.updateService(editingService.id, editingService);
      } else {
        await api.createService({
          ...editingService,
          salonId: salon.id,
          category: editingService.category || 'haircut',
          categoryEn: editingService.category || 'haircut',
          price: Number(editingService.price),
          durationMinutes: Number(editingService.durationMinutes) || 30,
        });
      }
    } catch (err: any) {
      notify(err?.message || 'حدث خطأ أثناء حفظ الخدمة', 'error');
      return;
    }
    setIsServiceModalOpen(false);
    setEditingService(null);
    await loadDashboardData();
  };

  const handleDeleteService = async (id: string) => {
    if (await confirmDialog({ message: 'هل أنت متأكد من حذف هذه الخدمة؟', danger: true })) {
      await api.deleteService(id);
      await loadDashboardData();
    }
  };

  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff?.name || !salon) return;

    if (editingStaff.id) {
      await api.updateBarber(editingStaff.id, editingStaff);
    } else {
      await api.createBarber({
        ...editingStaff,
        salonId: salon.id,
        avatar:
          editingStaff.avatar ||
          'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
        specializations: editingStaff.specializations || ['قص شعر وتصفيف'],
      });
    }
    setIsStaffModalOpen(false);
    setEditingStaff(null);
    await loadDashboardData();
  };

  const handleDeleteStaff = async (id: string) => {
    if (await confirmDialog({ message: 'هل أنت متأكد من حذف هذا الحلاق؟', danger: true })) {
      await api.deleteBarber(id);
      await loadDashboardData();
    }
  };

  const handleCreateBlockTime = (e: React.FormEvent) => {
    e.preventDefault();
    setBlockSuccess(true);
    setTimeout(() => setBlockSuccess(false), 3000);
    setBlockReason('');
  };

  // Compute salon stats
  const todayBookingsCount = bookings.filter((b) => b.status === 'confirmed').length;
  const totalVolume = bookings
    .filter((b) => b.status !== 'cancelled')
    .reduce((sum, b) => sum + (b.salonPayout || b.price), 0);

  if (isLoading || !salon) {
    return (
      <div className="py-20 text-center text-slate-400">
        <div className="w-8 h-8 border-2 border-[#d4af37] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <span>جاري تحميل لوحة تحكم الصالون...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-16">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-[#141721] border border-[#d4af37]/30 shadow-2xl">
        <div className="flex items-center gap-4">
          <img
            src={salon.coverImage}
            alt={salon.name}
            className="w-16 h-16 rounded-2xl object-cover border border-[#d4af37]/40 shrink-0"
          />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-extrabold text-white">{salon.name}</h2>
              {salon.isVerified && (
                <span className="flex items-center gap-1 bg-[#d4af37]/20 border border-[#d4af37]/50 text-[#d4af37] text-xs px-2 py-0.5 rounded-full font-bold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  موثق
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              لوحة إدارة الحجوزات والخدمات والأسعار والموظفين
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setEditingService({});
              setIsServiceModalOpen(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-[#d4af37] hover:brightness-110 text-black font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-[#d4af37]/20"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة خدمة جديدة</span>
          </button>
        </div>
      </div>

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 sm:p-5 rounded-2xl bg-[#141721] border border-white/10 space-y-1">
          <span className="text-xs text-slate-400 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[#d4af37]" />
            حجوزات اليوم المؤكدة
          </span>
          <span className="text-2xl font-extrabold text-white font-mono block">
            {todayBookingsCount}
          </span>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-[#141721] border border-white/10 space-y-1">
          <span className="text-xs text-slate-400 flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            صافي مستحقات الصالون
          </span>
          <span className="text-2xl font-extrabold text-emerald-400 font-mono block">
            {totalVolume.toLocaleString()} <span className="text-xs">{t('iqd')}</span>
          </span>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-[#141721] border border-white/10 space-y-1">
          <span className="text-xs text-slate-400 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-sky-400" />
            طاقم الحلاقين النشطين
          </span>
          <span className="text-2xl font-extrabold text-white font-mono block">
            {barbers.length}
          </span>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-[#141721] border border-white/10 space-y-1">
          <span className="text-xs text-slate-400 flex items-center gap-1.5">
            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            متوسط التقييم العام
          </span>
          <span className="text-2xl font-extrabold text-amber-400 font-mono block">
            {salon.rating} <span className="text-xs text-slate-400">({salon.reviewCount})</span>
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-2 overflow-x-auto">
        {[
          { id: 'calendar', label: 'إدارة الحجوزات والمواعيد', icon: Calendar },
          { id: 'services', label: 'الخدمات والأسعار', icon: Scissors },
          { id: 'staff', label: 'طاقم العمل والخبراء', icon: Users },
          { id: 'availability', label: 'إغلاق المواعيد والعطل', icon: Lock },
          { id: 'profile', label: 'بيانات الصالون والموقع', icon: Settings },
                  { id: 'posts', label: 'منشورات الصالون', icon: Sparkles },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-[#d4af37] text-black shadow-md shadow-[#d4af37]/20'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: Appointments / Calendar */}
      {activeTab === 'calendar' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-white text-base">
              جدول المواعيد الواردة
            </h3>
          </div>

          <button
            type="button"
            onClick={startQrScanner}
            className="px-3 py-2 rounded-xl bg-[#d4af37] hover:bg-[#c9a52f] text-black font-bold text-xs sm:text-sm flex items-center gap-2 shadow-md"
          >
            <ScanLine className="w-4 h-4" />
            <span>مسح QR لإتمام الخدمة</span>
          </button>
        </div>
            <span className="text-xs text-slate-400 font-mono">
              إجمالي الحجوزات: {bookings.length}
            </span>
          </div>

          <div className="space-y-3">
            {bookings.length === 0 ? (
              <div className="p-8 text-center bg-[#141721] rounded-2xl border border-white/10 text-slate-400 text-sm">
                لا توجد حجوزات واردة حتى الآن.
              </div>
            ) : (
              bookings.map((b) => (
                <div
                  key={b.id}
                  className="p-4 sm:p-5 rounded-2xl bg-[#141721] border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[#d4af37]">
                        {b.bookingNumber}
                      </span>
                      <span className="text-white font-bold text-sm sm:text-base">
                        {b.customerName}
                      </span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          b.status === 'confirmed'
                            ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40'
                            : b.status === 'completed'
                            ? 'bg-sky-950/80 text-sky-300 border border-sky-500/40'
                            : 'bg-red-950/80 text-red-300 border border-red-500/40'
                        }`}
                      >
                        {b.status === 'confirmed' ? 'مؤكد' : b.status === 'completed' ? 'مكتمل' : 'ملغي'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-slate-400">
                      <div>
                        الخدمة: <strong className="text-white">{b.serviceName}</strong>
                      </div>
                      <div>
                        الحلاق: <strong className="text-[#d4af37]">{b.barberName}</strong>
                      </div>
                      <div>
                        الموعد:{' '}
                        <strong className="text-white font-mono">
                          {b.date} • {b.timeSlot}
                        </strong>
                      </div>
                    </div>

                    {b.notes && (
                      <p className="text-[11px] text-amber-200 bg-amber-950/20 border border-amber-500/20 p-1.5 rounded-lg">
                        ملاحظة الزبون: {b.notes}
                      </p>
                    )}
                  </div>

                  {/* Quick Status Modifiers */}
                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={`tel:${b.customerPhone}`}
                      className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs flex items-center gap-1"
                      title="اتصال بالزبون"
                    >
                      <Phone className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="font-mono text-xs">{b.customerPhone}</span>
                    </a>

                    {b.status === 'confirmed' && (
                      <>
                        <button
                          type="button"
                          onClick={startQrScanner}
                          className="px-3 py-1.5 rounded-xl bg-[#d4af37] hover:bg-[#c9a52f] text-black font-bold text-xs transition-colors flex items-center gap-1"
                        >
                          <ScanLine className="w-3.5 h-3.5" />
                          <span>مسح QR</span>
                        </button>
                        <button
                          onClick={() => handleUpdateBookingStatus(b.id, 'cancelled')}
                          className="px-3 py-1.5 rounded-xl bg-red-950/50 hover:bg-red-900/50 text-red-300 border border-red-500/30 text-xs transition-colors"
                        >
                          إلغاء
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {isQrScannerOpen && (
        <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl bg-[#141721] border border-white/10 shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-white/10 flex items-center justify-between gap-3">
              <div>
                <h3 className="font-black text-white">
                  مسح QR لإتمام الخدمة
                </h3>
                <p className="text-[11px] text-slate-400 mt-1">
                  وجّه الكاميرا إلى الرمز الموجود عند الزبون
                </p>
              </div>

              <button
                type="button"
                onClick={closeQrScanner}
                className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-4">
              <div
                id={qrScannerElementId}
                className="w-full min-h-[280px] rounded-2xl overflow-hidden bg-black"
              />

              {qrScannerError && (
                <div className="mt-3 p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs leading-relaxed">
                  {qrScannerError}
                </div>
              )}

              <button
                type="button"
                onClick={closeQrScanner}
                className="w-full mt-4 px-4 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-bold"
              >
                إغلاق الكاميرا
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Services Manager */}
      {activeTab === 'services' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-white text-base">قائمة الخدمات والأسعار</h3>
            <button
              onClick={() => {
                setEditingService({});
                setIsServiceModalOpen(true);
              }}
              className="px-3 py-1.5 rounded-xl bg-[#d4af37] text-black font-bold text-xs flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة خدمة</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {services.map((srv) => (
              <div
                key={srv.id}
                className="p-4 rounded-2xl bg-[#141721] border border-white/10 flex items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <h4 className="font-bold text-white text-sm">{srv.name}</h4>
                  <p className="text-xs text-slate-400">{srv.description}</p>
                  <div className="flex items-center gap-3 text-xs text-[#d4af37] font-semibold">
                    <span className="font-mono">{srv.price.toLocaleString()} د.ع</span>
                    <span>•</span>
                    <span>{srv.durationMinutes} دقيقة</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => {
                      setEditingService(srv);
                      setIsServiceModalOpen(true);
                    }}
                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteService(srv.id)}
                    className="p-2 rounded-lg bg-red-950/40 hover:bg-red-900/40 text-red-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: Staff Manager */}
      {activeTab === 'staff' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-white text-base">طاقم الحلاقين والخبراء</h3>
            <button
              onClick={() => {
                setEditingStaff({});
                setIsStaffModalOpen(true);
              }}
              className="px-3 py-1.5 rounded-xl bg-[#d4af37] text-black font-bold text-xs flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة حلاق</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {barbers.map((b) => (
              <div
                key={b.id}
                className="p-4 rounded-2xl bg-[#141721] border border-white/10 text-center space-y-3 relative"
              >
                <img
                  src={b.avatar}
                  alt={b.name}
                  className="w-16 h-16 rounded-full object-cover border-2 border-[#d4af37] mx-auto"
                />
                <div>
                  <h4 className="font-bold text-white text-sm">{b.name}</h4>
                  <p className="text-xs text-slate-400">{b.title}</p>
                  <span className="text-xs text-amber-400 font-bold mt-1 block">★ {b.rating}</span>
                </div>

                <div className="flex items-center justify-center gap-2 pt-2 border-t border-white/10">
                  <button
                    onClick={() => {
                      setEditingStaff(b);
                      setIsStaffModalOpen(true);
                    }}
                    className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-slate-300"
                  >
                    تعديل
                  </button>
                  <button
                    onClick={() => handleDeleteStaff(b.id)}
                    className="px-3 py-1 rounded-lg bg-red-950/40 text-xs text-red-400"
                  >
                    حذف
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: Blocked Times & Holidays */}
      {activeTab === 'availability' && (
        <div className="max-w-xl p-6 rounded-3xl bg-[#141721] border border-white/10 space-y-4">
          <h3 className="font-bold text-white text-base flex items-center gap-2">
            <Lock className="w-4 h-4 text-[#d4af37]" />
            إغلاق المواعيد أو تحديد فترات الراحة
          </h3>
          <p className="text-xs text-slate-400">
            يمكنك إغلاق يوم كامل، أو ساعات محددة لحلاق معين أو للصالون بالكامل لعدم استقبال حجوزات جديدة في تلك الفترة.
          </p>

          {blockSuccess && (
            <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs">
              تم إغلاق الموعد بنجاح ولن يظهر في خيارات الحجز للزبائن.
            </div>
          )}

          <form onSubmit={handleCreateBlockTime} className="space-y-3">
            <div>
              <label className="block text-xs text-slate-300 mb-1">اختر التاريخ:</label>
              <input
                type="date"
                required
                value={blockedDate}
                onChange={(e) => setBlockedDate(e.target.value)}
                className="w-full bg-[#181b27] border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[#d4af37]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-slate-300 mb-1">من الساعة:</label>
                <input
                  type="time"
                  value={blockedStartTime}
                  onChange={(e) => setBlockedStartTime(e.target.value)}
                  className="w-full bg-[#181b27] border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[#d4af37]"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">إلى الساعة:</label>
                <input
                  type="time"
                  value={blockedEndTime}
                  onChange={(e) => setBlockedEndTime(e.target.value)}
                  className="w-full bg-[#181b27] border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[#d4af37]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">الحلاق المعني:</label>
              <select
                value={blockedBarberId}
                onChange={(e) => setBlockedBarberId(e.target.value)}
                className="w-full bg-[#181b27] border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[#d4af37]"
              >
                <option value="all">كل طاقم الصالون (إغلاق عام)</option>
                {barbers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">السبب (اختياري):</label>
              <input
                type="text"
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="مثال: استراحة غداء / عطلة صيانة"
                className="w-full bg-[#181b27] border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[#d4af37]"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-[#d4af37] text-black font-bold text-xs hover:brightness-110 transition-all"
            >
              حفظ فترة الإغلاق
            </button>
          </form>
        </div>
      )}

      {/* TAB: Salon Posts */}
      {activeTab === 'posts' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-white text-base">منشورات الصالون</h3>
              <p className="text-xs text-slate-400 mt-1">انشر صور الصالون والخدمات والأعمال الجديدة</p>
            </div>
            <button
              type="button"
              onClick={handleSelectPostImage}
              className="px-4 py-2.5 rounded-xl bg-[#d4af37] text-black font-bold text-xs flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              اختيار صورة
            </button>
          </div>

          {selectedPostImage ? (
            <div className="p-4 rounded-2xl bg-[#141721] border border-white/10 space-y-3">
              <img
                src={selectedPostImage}
                alt="معاينة المنشور"
                className="w-full max-h-96 object-cover rounded-xl"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedPostImage(null)}
                  className="px-4 py-2 rounded-xl bg-white/5 text-xs text-slate-300"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={async () => {
                      if (!selectedPostImage || isPublishingPost) return;

                      setIsPublishingPost(true);

                      try {
                        const compressedImage = await compressImageToDataUrl(
                          selectedPostImage,
                          { maxDimension: 1080, quality: 0.8 }
                        );

                        const upload = await api.uploadImage(compressedImage);

                        if (!upload.success || !upload.imageUrl) {
                          notify(upload.error || 'تعذر رفع الصورة.', 'error');
                          return;
                        }

                        const result = await api.createSalonPost({
                          salonId: salon.id,
                          imageUrl: upload.imageUrl,
                          caption: '',
                        });

                        if (!result.success) {
                          notify(result.error || 'تعذر نشر الصورة.', 'error');
                          return;
                        }

                        notify('تم نشر الصورة بنجاح.', 'success');
                        setSelectedPostImage(null);
                      } catch (error) {
                        console.error('Publish post error:', error);
                        notify('حدث خطأ أثناء نشر الصورة.', 'error');
                      } finally {
                        setIsPublishingPost(false);
                      }
                    }}
                  className="px-5 py-2 rounded-xl bg-[#d4af37] text-black font-bold text-xs"
                >
                  متابعة النشر
                </button>
              </div>
            </div>
          ) : (
            <div className="p-10 rounded-2xl bg-[#141721] border border-dashed border-white/10 text-center text-slate-400 text-sm">
              اختر صورة من استديو الهاتف لبدء إنشاء منشور.
            </div>
          )}
        </div>
      )}

      {/* TAB 5: Profile & Settings */}
      {activeTab === 'profile' && (
        <div className="max-w-xl p-6 rounded-3xl bg-[#141721] border border-white/10 space-y-4">
          <h3 className="font-bold text-white text-base">تعديل بيانات الصالون</h3>

          <div className="space-y-3">
            <div>
              <label className="block text-xs text-slate-300 mb-1">اسم الصالون:</label>
              <input
                type="text"
                defaultValue={salon.name}
                className="w-full bg-[#181b27] border border-white/10 rounded-xl p-2.5 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">رقم الهاتف:</label>
              <input
                type="text"
                defaultValue={salon.phone}
                className="w-full bg-[#181b27] border border-white/10 rounded-xl p-2.5 text-xs text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">رقم الواتساب:</label>
              <input
                type="text"
                defaultValue={salon.whatsapp}
                className="w-full bg-[#181b27] border border-white/10 rounded-xl p-2.5 text-xs text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">العنوان التفصيلي:</label>
              <input
                type="text"
                defaultValue={salon.address}
                className="w-full bg-[#181b27] border border-white/10 rounded-xl p-2.5 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">الوصف:</label>
              <textarea
                defaultValue={salon.description}
                rows={3}
                className="w-full bg-[#181b27] border border-white/10 rounded-xl p-2.5 text-xs text-white"
              />
            </div>

            <button
              onClick={() => notify('تم حفظ التعديلات بنجاح!', 'success')}
              className="px-6 py-2.5 rounded-xl bg-[#d4af37] text-black font-bold text-xs"
            >
              حفظ التعديلات
            </button>
          </div>
        </div>
      )}

      {/* Service Modal */}
      {isServiceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <form
            onSubmit={handleSaveService}
            className="w-full max-w-md bg-[#141721] border border-[#d4af37]/30 rounded-3xl p-6 shadow-2xl space-y-4"
          >
            <h3 className="font-bold text-white text-base">
              {editingService?.id ? 'تعديل الخدمة' : 'إضافة خدمة جديدة'}
            </h3>

            <div>
              <label className="block text-xs text-slate-300 mb-1">اسم الخدمة:</label>
              <input
                type="text"
                required
                value={editingService?.name || ''}
                onChange={(e) => setEditingService({ ...editingService, name: e.target.value })}
                placeholder="مثال: قص شعر وتصفيف سشوار"
                className="w-full bg-[#181b27] border border-white/10 rounded-xl p-2.5 text-xs text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-slate-300 mb-1">السعر (د.ع):</label>
                <input
                  type="number"
                  required
                  value={editingService?.price || ''}
                  onChange={(e) => setEditingService({ ...editingService, price: Number(e.target.value) })}
                  placeholder="15000"
                  className="w-full bg-[#181b27] border border-white/10 rounded-xl p-2.5 text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">المدة (بالدقائق):</label>
                <input
                  type="number"
                  required
                  value={editingService?.durationMinutes || 30}
                  onChange={(e) => setEditingService({ ...editingService, durationMinutes: Number(e.target.value) })}
                  className="w-full bg-[#181b27] border border-white/10 rounded-xl p-2.5 text-xs text-white font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">وصف مختصر:</label>
              <input
                type="text"
                value={editingService?.description || ''}
                onChange={(e) => setEditingService({ ...editingService, description: e.target.value })}
                placeholder="وصف تفصيلي للخدمة والمنتجات المستخدمة..."
                className="w-full bg-[#181b27] border border-white/10 rounded-xl p-2.5 text-xs text-white"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setIsServiceModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-white/5 text-xs text-slate-300"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-[#d4af37] text-black font-bold text-xs"
              >
                حفظ الخدمة
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Staff Modal */}
      {isStaffModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <form
            onSubmit={handleSaveStaff}
            className="w-full max-w-md bg-[#141721] border border-[#d4af37]/30 rounded-3xl p-6 shadow-2xl space-y-4"
          >
            <h3 className="font-bold text-white text-base">
              {editingStaff?.id ? 'تعديل بيانات الحلاق' : 'إضافة حلاق جديد'}
            </h3>

            <div>
              <label className="block text-xs text-slate-300 mb-1">اسم الحلاق:</label>
              <input
                type="text"
                required
                value={editingStaff?.name || ''}
                onChange={(e) => setEditingStaff({ ...editingStaff, name: e.target.value })}
                placeholder="مثال: علي الكوافير"
                className="w-full bg-[#181b27] border border-white/10 rounded-xl p-2.5 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">المسمى المهني / التخصص:</label>
              <input
                type="text"
                value={editingStaff?.title || ''}
                onChange={(e) => setEditingStaff({ ...editingStaff, title: e.target.value })}
                placeholder="أخصائي قصات حديثة وتشذيب لحية"
                className="w-full bg-[#181b27] border border-white/10 rounded-xl p-2.5 text-xs text-white"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setIsStaffModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-white/5 text-xs text-slate-300"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-[#d4af37] text-black font-bold text-xs"
              >
                حفظ الحلاق
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
