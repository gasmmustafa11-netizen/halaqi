import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { Scissors, MapPin, Phone, MessageCircle, ShieldCheck, Heart } from 'lucide-react';

interface FooterProps {
  onNavigate: (view: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  const { t, isRtl } = useLanguage();

  return (
    <footer className="w-full bg-[#0A0A0A] border-t border-[#262626] pt-12 pb-24 text-gray-400 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Brand Col */}
          <div className="space-y-3 bg-[#141414] border border-[#262626] p-5 rounded-2xl md:col-span-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#D4AF37] flex items-center justify-center text-black font-black text-sm">
                ح
              </div>
              <span className="text-lg font-black text-white" style={{ fontFamily: 'Georgia, serif' }}>
                HALAQI <span className="text-[#D4AF37]">|</span> حلاقي
              </span>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              المنصة الرائدة في العراق لحجز صالونات الحلاقة الرجالية ومراكز التجميل النسائية بأعلى معايير الرفاهية والجودة.
            </p>
          </div>

          {/* Quick Links Bento Box */}
          <div className="space-y-3 bg-[#141414] border border-[#262626] p-5 rounded-2xl">
            <h4 className="font-bold text-white text-sm">روابط سريعة</h4>
            <ul className="space-y-2">
              <li>
                <button onClick={() => onNavigate('explore')} className="hover:text-[#D4AF37] transition-colors">
                  استكشاف جميع الصالونات
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('map')} className="hover:text-[#D4AF37] transition-colors">
                  الخريطة التفاعلية والملاحة
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('bookings')} className="hover:text-[#D4AF37] transition-colors">
                  متابعة المواعيد والحجوزات
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('register_salon')} className="hover:text-[#D4AF37] transition-colors">
                  تسجيل صالون جديد
                </button>
              </li>
            </ul>
          </div>

          {/* Coverage Cities Bento Box */}
          <div className="space-y-3 bg-[#141414] border border-[#262626] p-5 rounded-2xl">
            <h4 className="font-bold text-white text-sm">المحافظات والمدن</h4>
            <div className="flex flex-wrap gap-1.5 text-[11px]">
              <span className="px-2 py-1 rounded-lg bg-[#262626] text-gray-200">بغداد</span>
              <span className="px-2 py-1 rounded-lg bg-[#262626] text-gray-200">أربيل</span>
              <span className="px-2 py-1 rounded-lg bg-[#262626] text-gray-200">البصرة</span>
              <span className="px-2 py-1 rounded-lg bg-[#262626] text-gray-200">الناصرية</span>
              <span className="px-2 py-1 rounded-lg bg-[#262626] text-gray-200">النجف</span>
              <span className="px-2 py-1 rounded-lg bg-[#262626] text-gray-200">كربلاء</span>
              <span className="px-2 py-1 rounded-lg bg-[#262626] text-gray-200">السليمانية</span>
            </div>
          </div>

          {/* Payment & Security Bento Box */}
          <div className="space-y-3 bg-[#141414] border border-[#262626] p-5 rounded-2xl">
            <h4 className="font-bold text-white text-sm">طرق الدفع والأمان</h4>
            <p className="text-[11px] text-gray-400">
              دفع آمن عند الوصول نقداً، أو عبر المحافظ الإلكترونية (زين كاش، كي كارد، ماستركارد).
            </p>
            <div className="flex items-center gap-2 text-[10px] text-[#D4AF37] pt-1">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>نظام حجز ذري يضمن عدم تضارب المواعيد</span>
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-[#262626] flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px]">
          <p>
  © 2026 جميع الحقوق محفوظة لمنصة حلاقي /{' '}
  <button
    onClick={() => onNavigate('terms_privacy')}
    className="text-[#D4AF37] hover:text-white transition-colors underline underline-offset-2"
  >
    الشروط والأحكام وسياسة الخصوصية
  </button>
</p>
          <div className="flex items-center gap-4">
            <span className="text-[#D4AF37] font-mono font-semibold">Baghdad, Iraq</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
