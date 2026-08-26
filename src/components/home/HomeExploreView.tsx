import React, { useState, useEffect } from 'react';
import { Salon } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { useBooking } from '../../context/BookingContext';
import { api } from '../../services/api';
import { InteractiveSalonMap } from '../map/InteractiveSalonMap';
import {
  Search,
  MapPin,
  Scissors,
  Sparkles,
  Star,
  ShieldCheck,
  Calendar,
  Layers,
  ChevronRight,
  ChevronLeft,
  Tag,
  Filter,
  Check,
  Map,
  Grid,
  TrendingUp,
  Clock,
  Compass
} from 'lucide-react';

interface HomeExploreViewProps {
  onSelectSalon: (salon: Salon) => void;
  onOpenMap: () => void;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
}

export const HomeExploreView: React.FC<HomeExploreViewProps> = ({
  onSelectSalon,
  onOpenMap,
  searchQuery = '',
  onSearchChange,
}) => {
  const { t, isRtl } = useLanguage();
  const { openBookingWizard } = useBooking();

  const [salons, setSalons] = useState<Salon[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [localSearch, setLocalSearch] = useState<string>(searchQuery);
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<'all' | 'men' | 'women'>('all');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'bento' | 'map'>('bento');

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const data = await api.getSalons({
          city: selectedCity,
          type: selectedType,
        });
        setSalons(data);
      console.log('SALONS IMAGES:', data.map(s => ({ name: s.name, coverImage: s.coverImage })));
      } catch (err) {
        console.error('HomeExploreView: failed to load salons', err);
        setSalons([]);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [selectedCity, selectedType]);

  const effectiveSearch = searchQuery || localSearch;

  const filteredSalons = salons.filter((s) => {
    if (selectedType !== 'all' && s.type !== selectedType) return false;
    if (!effectiveSearch.trim()) return true;
    const q = effectiveSearch.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.area.toLowerCase().includes(q) ||
      s.city.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q)
    );
  });

  const featuredSalons = salons.filter((s) => s.isFeatured);

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-300">
      {/* Bento Grid Top Showcase Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Main Bento Spotlight Tile (col-span-8) */}
        <div className="lg:col-span-8 bg-[#141414] rounded-2xl border border-[#262626] relative overflow-hidden group shadow-2xl min-h-[300px] sm:min-h-[360px] flex flex-col justify-between p-6 sm:p-8">
          {/* Subtle Map / Ambient Background */}
          <div className="absolute inset-0 opacity-25 bg-[url('https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=1200&auto=format&fit=crop&q=80')] bg-cover bg-center grayscale invert" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#141414]/80 to-transparent" />

          {/* Top Row Indicators */}
          <div className="relative z-10 flex items-center justify-between flex-wrap gap-2">
            <div className="bg-white text-black px-4 py-1.5 rounded-full font-bold shadow-lg text-xs flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-500 rounded-full " />
              <span>اكتشف {salons.length} صالوناً متاحاً في العراق</span>
            </div>

            <div className="flex items-center gap-2 bg-[#262626]/80 backdrop-blur-md px-3 py-1 rounded-full border border-[#333] text-[11px] text-gray-300">
              <MapPin className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>بغداد • أربيل • البصرة</span>
            </div>
          </div>

          {/* Radar Ping Target Center Accent */}
          <div className="hidden sm:block absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-80">
            <div className="relative">
              <div className="w-12 h-12 bg-[#D4AF37] rounded-full  absolute opacity-60" />
              <div className="w-12 h-12 bg-[#D4AF37]/30 backdrop-blur-sm rounded-full border-2 border-[#D4AF37] relative flex items-center justify-center shadow-2xl">
                <Scissors className="w-5 h-5 text-[#D4AF37]" />
              </div>
            </div>
          </div>

          {/* Bottom Row: Elite Salons Title & Map CTA */}
          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 pt-8">
            <div>
              <span className="text-[10px] text-[#D4AF37] font-bold uppercase tracking-widest block mb-1">
                Elite Salons • حلاقي
              </span>
              <h2 className="text-2xl sm:text-4xl font-extrabold text-white mb-1 tracking-tight" style={{ fontFamily: 'Georgia, serif' }}>
                صالونات النخبة
              </h2>
              <p className="text-gray-400 text-xs sm:text-sm max-w-md leading-relaxed">
                تصفح الصالونات الأعلى تقييماً مع إمكانية الحجز الفوري وتحديد المواعيد بدقة.
              </p>
            </div>

            <button
              onClick={onOpenMap}
              className="bg-[#D4AF37] hover:bg-[#B8962D] text-black px-6 py-3 rounded-xl font-extrabold text-xs sm:text-sm transition-all shadow-xl flex items-center gap-2 shrink-0 cursor-pointer"
            >
              <Compass className="w-4 h-4" />
              <span>عرض الخريطة التفاعلية</span>
            </button>
          </div>
        </div>

        {/* Side Bento Tiles (col-span-4) */}
        <div className="lg:col-span-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
          {/* Tile 1: Men's Salons */}
          <div
            onClick={() => setSelectedType(selectedType === 'men' ? 'all' : 'men')}
            className={`rounded-2xl p-6 flex flex-col justify-between cursor-pointer transition-all ${
              selectedType === 'men'
                ? 'bg-[#1c1c1c] border-2 border-[#D4AF37] shadow-[0_0_15px_rgba(212,175,55,0.2)]'
                : 'bg-[#141414] border border-[#262626] hover:border-[#D4AF37]'
            }`}
          >
            <div className="flex justify-between items-start mb-6">
              <div className="w-12 h-12 bg-gray-800 rounded-xl flex items-center justify-center border border-[#333]">
                <Scissors className="w-6 h-6 text-[#D4AF37]" />
              </div>
              <span className="text-[10px] bg-[#D4AF37]/20 text-[#D4AF37] px-2.5 py-1 rounded-md font-bold uppercase tracking-tighter">
                Premium Selection
              </span>
            </div>

            <div>
              <h3 className="text-xl font-extrabold text-white mb-1">صالونات رجالية</h3>
              <p className="text-gray-400 text-xs leading-relaxed">
                حلاقة ذقن، العناية بالبشرة، تدريج VIP، وستايل حديث
              </p>
            </div>
          </div>

          {/* Tile 2: Women's Luxury Centers */}
          <div
            onClick={() => setSelectedType(selectedType === 'women' ? 'all' : 'women')}
            className={`bento-gold rounded-2xl p-6 flex flex-col justify-between cursor-pointer transition-all ${
              selectedType === 'women'
                ? 'ring-2 ring-white shadow-2xl scale-[1.01]'
                : 'opacity-95 hover:opacity-100'
            }`}
          >
            <div className="flex justify-between items-start mb-6">
              <div className="w-12 h-12 bg-black text-[#D4AF37] rounded-xl flex items-center justify-center shadow-lg">
                <Sparkles className="w-6 h-6" />
              </div>
              <span className="text-[10px] bg-black/10 text-black px-2.5 py-1 rounded-md font-extrabold uppercase tracking-tighter">
                Luxury Care
              </span>
            </div>

            <div>
              <h3 className="text-xl font-extrabold text-black mb-1">صالونات نسائية</h3>
              <p className="text-black/80 text-xs leading-relaxed font-medium">
                ميك اب، باقات عرائس، عناية بالشعر والأظافر، وهيدرافيشل
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and City Selector Toolbar */}
      <div className="bg-[#141414] border border-[#262626] rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* City Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none text-xs">
          <span className="text-gray-400 font-semibold shrink-0">المحافظة:</span>
          {[
            { id: 'all', label: 'الكل' },
            { id: 'baghdad', label: 'بغداد' },
            { id: 'erbil', label: 'أربيل' },
            { id: 'basra', label: 'البصرة' },
            { id: 'najaf', label: 'النجف' },
            { id: 'karbala', label: 'كربلاء' },
          ].map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCity(c.id)}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-all shrink-0 cursor-pointer ${
                selectedCity === c.id
                  ? 'bg-[#D4AF37] text-black shadow-md'
                  : 'bg-[#262626] text-gray-300 hover:text-white'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* View Mode Toggle & Count */}
        <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
          <span className="text-xs text-gray-400 font-mono">
            {filteredSalons.length} صالون متاح
          </span>

          <div className="flex items-center p-1 bg-[#262626] rounded-xl border border-[#333] text-xs">
            <button
              onClick={() => setViewMode('bento')}
              className={`flex items-center gap-1 px-3 py-1 rounded-lg font-bold transition-all ${
                viewMode === 'bento' ? 'bg-[#D4AF37] text-black' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span>Bento</span>
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`flex items-center gap-1 px-3 py-1 rounded-lg font-bold transition-all ${
                viewMode === 'map' ? 'bg-[#D4AF37] text-black' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Map className="w-3.5 h-3.5" />
              <span>الخريطة</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content: Bento Salons Grid vs Interactive Map */}
      {viewMode === 'map' ? (
        <InteractiveSalonMap
          salons={filteredSalons}
          onSelectSalon={onSelectSalon}
          selectedCity={selectedCity}
        />
      ) : (
        <>
          {isLoading ? (
            <div className="py-20 text-center text-gray-400 text-sm">
              <div className="w-8 h-8 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <span>جاري تحميل الصالونات...</span>
            </div>
          ) : filteredSalons.length === 0 ? (
            <div className="py-16 text-center p-8 rounded-2xl bg-[#141414] border border-[#262626] space-y-3">
              <Scissors className="w-10 h-10 text-gray-600 mx-auto" />
              <h4 className="text-lg font-bold text-white">لم يتم العثور على صالونات مطابقة للبحث</h4>
              <p className="text-xs text-gray-400">
                يرجى تجربة تغيير المحافظة أو عبارة البحث في الأعلى.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSalons.map((s) => {
                const isVIP = s.isFeatured;
                return (
                  <div
                    key={s.id}
                    className={`bg-[#141414] rounded-2xl p-4 flex gap-4 transition-all cursor-pointer ${
                      isVIP
                        ? 'border border-[#D4AF37] shadow-[0_0_15px_rgba(212,175,55,0.2)] hover:bg-[#1a1a1a]'
                        : 'border border-[#262626] hover:border-[#D4AF37]/60 hover:bg-[#1a1a1a]'
                    }`}
                  >
                    {/* Thumbnail Image Box */}
                    <div
                      className="w-28 sm:w-32 h-36 bg-[#262626] rounded-xl flex-shrink-0 relative overflow-hidden group"
                      onClick={() => onSelectSalon(s)}
                    >
                      <img
                        src={s.coverImage}
                        alt={s.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-tr from-black/60 to-transparent" />

                      {/* Rating Chip */}
                      <div className="absolute top-2 left-2 bg-[#D4AF37] text-black text-[10px] px-1.5 py-0.5 rounded font-black flex items-center gap-0.5 shadow-md">
                        <Star className="w-2.5 h-2.5 fill-black" />
                        <span>{s.rating}</span>
                      </div>

                      {/* VIP Tag */}
                      {isVIP && (
                        <div className="absolute bottom-2 right-2 bg-black/80 text-[#D4AF37] border border-[#D4AF37]/50 text-[9px] px-1.5 py-0.5 rounded font-bold">
                          VIP
                        </div>
                      )}
                    </div>

                    {/* Salon Info and Action Controls */}
                    <div className="flex flex-col justify-between flex-1 py-0.5 min-w-0">
                      <div className="space-y-1">
                        <div className="flex justify-between items-start gap-2">
                          <h4
                            className="font-bold text-base text-white leading-tight truncate hover:text-[#D4AF37] transition-colors"
                            onClick={() => onSelectSalon(s)}
                          >
                            {s.name}
                          </h4>
                          <span className="text-[10px] text-emerald-400 shrink-0 flex items-center gap-1 font-semibold">
                            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                            مفتوح
                          </span>
                        </div>

                        <p className="text-xs text-gray-400 flex items-center gap-1 truncate">
                          <MapPin className="w-3 h-3 text-[#D4AF37] shrink-0" />
                          <span>{s.area}، {s.city}</span>
                        </p>

                        <p className="text-xs text-[#D4AF37] font-extrabold font-mono pt-1">
                          يبدأ من {s.startingPrice.toLocaleString()} {t('iqd')}
                        </p>
                      </div>

                      {/* Dual Action Buttons */}
                      <div className="flex items-center gap-2 pt-2">
                        <button
                          onClick={() => onSelectSalon(s)}
                          className="flex-1 bg-white/5 border border-white/10 text-xs py-2 rounded-lg hover:bg-white/10 text-gray-200 transition-colors font-semibold"
                        >
                          التفاصيل
                        </button>
                        <button
                          onClick={() => openBookingWizard(s)}
                          className="flex-1 bg-[#D4AF37] hover:bg-[#B8962D] text-black text-xs font-bold py-2 rounded-lg transition-colors shadow-md flex items-center justify-center gap-1"
                        >
                          <Calendar className="w-3 h-3" />
                          <span>حجز سريع</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Promo Offer Coupon Banner */}
      <div className="bg-[#141414] border border-[#262626] rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#D4AF37]/20 border border-[#D4AF37] flex items-center justify-center text-[#D4AF37] shrink-0">
            <Tag className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-white text-sm">عرض خاص لزبائن تطبيق حلاقي!</h4>
            <p className="text-xs text-gray-400">
              استخدم كود الخصم <strong className="text-[#D4AF37] font-mono">HALAQI10</strong> للحصول على خصم 10% على حجزك الأول.
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            if (salons.length > 0) openBookingWizard(salons[0]);
          }}
          className="bg-[#D4AF37] hover:bg-[#B8962D] text-black px-5 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all shrink-0"
        >
          احجز واستفد الآن
        </button>
      </div>
    </div>
  );
};
