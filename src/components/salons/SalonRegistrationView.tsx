import React, { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import {
  Store,
  MapPin,
  Phone,
  MessageCircle,
  Scissors,
  Sparkles,
  CheckCircle,
  DollarSign,
  ShieldCheck,
  Check
} from 'lucide-react';

interface SalonRegistrationViewProps {
  onSuccess: () => void;
}

export const SalonRegistrationView: React.FC<SalonRegistrationViewProps> = ({ onSuccess }) => {
  const { t, isRtl } = useLanguage();
  const { user, login } = useAuth();

  const [salonName, setSalonName] = useState<string>('');
  const [ownerName, setOwnerName] = useState<string>(user?.name || '');
  const [salonType, setSalonType] = useState<'men' | 'women' | 'unisex'>('men');
  const [city, setCity] = useState<string>('baghdad');
  const [area, setArea] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [salonLocation, setSalonLocation] = useState<{ lat: number; lng: number } | null>(null);
  const handleGetSalonLocation = () => { navigator.geolocation.getCurrentPosition((position) => { setSalonLocation({ lat: position.coords.latitude, lng: position.coords.longitude }); }, () => alert('تعذر تحديد الموقع. فعّل GPS وأعطِ التطبيق صلاحية الموقع.'), { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }); };
  const [phone, setPhone] = useState<string>(user?.phone || '+964 780 ');
  const [whatsapp, setWhatsapp] = useState<string>(user?.phone || '+964 780 ');
  const [startingPrice, setStartingPrice] = useState<number>(15000);
  const [description, setDescription] = useState<string>('');
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([
    'صالة VIP خاصة',
    'مشروبات وضيافة مجانية',
    'إنترنت مجاني سريع (Wi-Fi)',
  ]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);

  const toggleFeature = (feature: string) => {
    if (selectedFeatures.includes(feature)) {
      setSelectedFeatures(selectedFeatures.filter((f) => f !== feature));
    } else {
      setSelectedFeatures([...selectedFeatures, feature]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salonName.trim() || !address.trim() || !phone.trim()) return;

    setIsSubmitting(true);
    const newSalonData = {
      name: salonName.trim(),
      nameEn: salonName.trim(),
      ownerId: user?.id || `owner_${Date.now()}`,
      type: salonType,
      city,
      area: area.trim() || 'المركز',
      address: address.trim(),
      lat: salonLocation?.lat || 0,
      lng: salonLocation?.lng || 0,
      phone: phone.trim(),
      whatsapp: whatsapp.trim(),
      rating: 5.0,
      reviewCount: 0,
      startingPrice: Number(startingPrice) || 15000,
      coverImage:
        salonType === 'women'
          ? 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&auto=format&fit=crop&q=80'
          : 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800&auto=format&fit=crop&q=80',
      gallery: [],
      description: description.trim() || 'صالون راقٍ يقدم أفضل خدمات الحلاقة والتجميل بأعلى معايير النظافة والاحترافية.',
      isVerified: false,
      isFeatured: false,
      status: 'approved' as const,
      features: selectedFeatures,
      commissionRate: 10,
    };

    const res = await api.registerSalon(newSalonData);
    setIsSubmitting(false);

    if (res.success) {
      setIsSubmitted(true);
    }
  };

  if (isSubmitted) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-5 p-8 rounded-3xl bg-[#141721] border border-[#d4af37]/40 shadow-2xl animate-in zoom-in-95">
        <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center text-emerald-400 mx-auto">
          <CheckCircle className="w-12 h-12" />
        </div>

        <h3 className="text-2xl font-extrabold text-white">تم استلام طلب تسجيل صالونك بنجاح!</h3>
        <p className="text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
          أهلاً بك في شبكة حلاقي. تم تسجيل صالون <strong className="text-[#d4af37]">{salonName}</strong> بنجاح وتفعيله في المنصة للبدء باستقبال حجوزات الزبائن.
        </p>

        <button
          onClick={onSuccess}
          className="px-8 py-3 rounded-xl bg-[#d4af37] text-black font-bold text-sm hover:brightness-110 shadow-lg shadow-[#d4af37]/20 transition-all"
        >
          الانتقال للوحة تحكم الصالون
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-300 pb-16">
      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-[#141721] to-[#1a1e2b] border border-[#d4af37]/30 shadow-2xl space-y-2">
        <div className="flex items-center gap-2 text-[#d4af37]">
          <Store className="w-6 h-6" />
          <h2 className="text-2xl font-extrabold text-white">{t('joinAsSalon')}</h2>
        </div>
        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
          انضم إلى أكبر منصة حجز صالونات في العراق. ضاعف عدد زبائنك، ونظّم مواعيدك بسهولة بدون تضارب، وزد دخلك الشهري.
        </p>
      </div>

      {/* Registration Form */}
      <form onSubmit={handleSubmit} className="p-6 sm:p-8 rounded-3xl bg-[#141721] border border-white/10 space-y-6 shadow-xl">
        <button type="button" onClick={handleGetSalonLocation} className="w-full py-3 rounded-xl bg-[#d4af37] text-black font-bold">📍 تحديد موقع الصالون الحالي</button>
        {salonLocation && <p className="text-xs text-emerald-400">✓ تم تحديد موقع الصالون: {salonLocation.lat.toFixed(6)}, {salonLocation.lng.toFixed(6)}</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              اسم الصالون التجاري *
            </label>
            <input
              type="text"
              required
              value={salonName}
              onChange={(e) => setSalonName(e.target.value)}
              placeholder="مثال: صالون رويال باربر VIP"
              className="w-full bg-[#181b27] border border-white/10 rounded-xl p-3 text-xs sm:text-sm text-white focus:border-[#d4af37] outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              اسم المالك / المدير المسؤول *
            </label>
            <input
              type="text"
              required
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder="مثال: وسام الكوافير"
              className="w-full bg-[#181b27] border border-white/10 rounded-xl p-3 text-xs sm:text-sm text-white focus:border-[#d4af37] outline-none"
            />
          </div>
        </div>

        {/* Salon Type Selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-2">نوع الصالون *</label>
          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setSalonType('men')}
              className={`p-3 rounded-2xl border text-xs font-bold transition-all flex flex-col items-center gap-1.5 ${
                salonType === 'men'
                  ? 'bg-[#d4af37]/20 border-[#d4af37] text-[#d4af37]'
                  : 'bg-[#181b27] border-white/10 text-slate-400'
              }`}
            >
              <Scissors className="w-5 h-5" />
              <span>صالون رجالي</span>
            </button>

            <button
              type="button"
              onClick={() => setSalonType('women')}
              className={`p-3 rounded-2xl border text-xs font-bold transition-all flex flex-col items-center gap-1.5 ${
                salonType === 'women'
                  ? 'bg-pink-900/30 border-pink-400 text-pink-300'
                  : 'bg-[#181b27] border-white/10 text-slate-400'
              }`}
            >
              <Sparkles className="w-5 h-5" />
              <span>صالون نسائي / بيوتي سنتر</span>
            </button>

            <button
              type="button"
              onClick={() => setSalonType('unisex')}
              className={`p-3 rounded-2xl border text-xs font-bold transition-all flex flex-col items-center gap-1.5 ${
                salonType === 'unisex'
                  ? 'bg-[#d4af37]/20 border-[#d4af37] text-[#d4af37]'
                  : 'bg-[#181b27] border-white/10 text-slate-400'
              }`}
            >
              <Store className="w-5 h-5" />
              <span>شامل (رجالي + نسائي)</span>
            </button>
          </div>
        </div>

        {/* City & Area */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">المحافظة *</label>
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full bg-[#181b27] border border-white/10 rounded-xl p-3 text-xs sm:text-sm text-white focus:border-[#d4af37] outline-none"
            >
              <option value="baghdad">بغداد (العاصمة)</option>
              <option value="erbil">أربيل</option>
              <option value="basra">البصرة</option>
              <option value="nasiriyah">الناصرية (ذي قار)</option>
              <option value="najaf">النجف الأشرف</option>
              <option value="karbala">كربلاء المقدسة</option>
              <option value="sulaymaniyah">السليمانية</option>
              <option value="mosul">الموصل (نينوى)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">المنطقة / الحي *</label>
            <input
              type="text"
              required
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="مثال: المنصور، الكرادة، دريم سيتي..."
              className="w-full bg-[#181b27] border border-white/10 rounded-xl p-3 text-xs sm:text-sm text-white focus:border-[#d4af37] outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            العنوان التفصيلي ونقطة دالة *
          </label>
          <input
            type="text"
            required
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="مثال: شارع 14 رمضان، مجاور مول المنصور، الطابق الأول"
            className="w-full bg-[#181b27] border border-white/10 rounded-xl p-3 text-xs sm:text-sm text-white focus:border-[#d4af37] outline-none"
          />
        </div>

        {/* Contacts */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              رقم الهاتف للاتصال والحجوزات *
            </label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              dir="ltr"
              className="w-full bg-[#181b27] border border-white/10 rounded-xl p-3 text-xs sm:text-sm text-white focus:border-[#d4af37] outline-none text-start font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              رقم الواتساب لاستقبال التأكيدات *
            </label>
            <input
              type="tel"
              required
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              dir="ltr"
              className="w-full bg-[#181b27] border border-white/10 rounded-xl p-3 text-xs sm:text-sm text-white focus:border-[#d4af37] outline-none text-start font-mono"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            السعر المبدئي للخدمات (يبدأ من د.ع):
          </label>
          <input
            type="number"
            value={startingPrice}
            onChange={(e) => setStartingPrice(Number(e.target.value))}
            className="w-full bg-[#181b27] border border-white/10 rounded-xl p-3 text-xs sm:text-sm text-white font-mono"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            نبذة تعريفية عن الصالون
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="اكتب نبذة عن الصالون، سنوات الخبرة، والخدمات المميزة..."
            className="w-full bg-[#181b27] border border-white/10 rounded-xl p-3 text-xs sm:text-sm text-white focus:border-[#d4af37] outline-none"
          />
        </div>

        {/* Amenities Checkboxes */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-2">
            المميزات والخدمات الإضافية المتوفرة:
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              'صالة VIP خاصة',
              'مشروبات وضيافة مجانية',
              'إنترنت مجاني سريع (Wi-Fi)',
              'خدمة ركن السيارات (Valet Parking)',
              'مكيف هواء مركزي',
              'الدفع عبر زين كاش والماستركارد',
            ].map((f) => {
              const isChecked = selectedFeatures.includes(f);
              return (
                <div
                  key={f}
                  onClick={() => toggleFeature(f)}
                  className={`p-3 rounded-xl border cursor-pointer flex items-center gap-2 text-xs transition-all ${
                    isChecked
                      ? 'bg-[#d4af37]/20 border-[#d4af37] text-white'
                      : 'bg-[#181b27] border-white/5 text-slate-400'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded flex items-center justify-center border ${
                      isChecked ? 'bg-[#d4af37] border-[#d4af37] text-black' : 'border-white/20'
                    }`}
                  >
                    {isChecked && <Check className="w-3 h-3" />}
                  </div>
                  <span>{f}</span>
                </div>
              );
            })}
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#d4af37] to-[#aa820a] hover:brightness-110 text-black font-extrabold text-sm shadow-xl shadow-[#d4af37]/20 transition-all flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <span>جاري إرسال البيانات...</span>
          ) : (
            <>
              <ShieldCheck className="w-5 h-5" />
              <span>تقديم طلب التسجيل والانضمام</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};
