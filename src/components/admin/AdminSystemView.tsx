import React from 'react';
import { ShieldCheck, AlertTriangle, ArrowLeft } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

interface AdminSystemViewProps {
  onNavigate: (view: string) => void;
}

export const AdminSystemView: React.FC<AdminSystemViewProps> = ({ onNavigate }) => {
  const { isRtl } = useLanguage();

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-16">
      {/* System Header */}
      <div className="p-6 rounded-3xl bg-[#141414] border border-[#262626] shadow-2xl">
        <div className="flex items-center gap-3 mb-2">
          <button
            type="button"
            onClick={() => onNavigate('admin')}
            className="w-10 h-10 rounded-xl bg-[#262626] border border-[#333] flex items-center justify-center text-gray-300 hover:text-white hover:bg-[#333] transition-all"
            aria-label={isRtl ? 'رجوع' : 'Back'}
          >
            <ArrowLeft className={`w-5 h-5 ${isRtl ? '' : 'rotate-180'}`} />
          </button>
        </div>
        <h2 className="text-2xl font-black text-white" style={{ fontFamily: 'Georgia, serif' }}>
          النظام
        </h2>
        <p className="text-xs text-gray-400 mt-2">
          إدارة التوثيق والبلاغات الأمنية
        </p>
      </div>

      {/* Two Main Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Verification Requests */}
        <button
          type="button"
          onClick={() => onNavigate('admin_verification')}
          className="group p-7 rounded-3xl bg-[#141414] border border-[#262626] hover:border-[#D4AF37]/40 hover:bg-[#181818] transition-all text-start shadow-xl"
        >
          <div className="w-14 h-14 rounded-2xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] mb-5 shadow-lg group-hover:scale-105 transition-transform">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h3 className="text-xl font-black text-white mb-2">التوثيق</h3>
          <p className="text-xs text-gray-400 leading-relaxed">
            مراجعة طلبات التوثيق والتحقق من الهوية. سيتم عرض الطلبات عند ربط نظام التوثيق.
          </p>
        </button>

        {/* Reports */}
        <button
          type="button"
          onClick={() => onNavigate('admin_reports')}
          className="group p-7 rounded-3xl bg-[#141414] border border-[#262626] hover:border-[#D4AF37]/40 hover:bg-[#181818] transition-all text-start shadow-xl"
        >
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-5 shadow-lg group-hover:scale-105 transition-transform">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h3 className="text-xl font-black text-white mb-2">البلاغات</h3>
          <p className="text-xs text-gray-400 leading-relaxed">
            إدارة البلاغات المقدمة من المستخدمين ومراجعة التفاصيل الأمنية.
          </p>
        </button>
      </div>
    </div>
  );
};
