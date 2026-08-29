import React from 'react';
import { ShieldCheck, ArrowLeft, Info } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

interface VerificationRequestsViewProps {
  onBack: () => void;
}

export const VerificationRequestsView: React.FC<VerificationRequestsViewProps> = ({ onBack }) => {
  const { isRtl } = useLanguage();

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-16">
      <div className="p-6 rounded-3xl bg-[#141414] border border-[#262626] shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <button
            type="button"
            onClick={onBack}
            className="w-10 h-10 rounded-xl bg-[#262626] border border-[#333] flex items-center justify-center text-gray-300 hover:text-white hover:bg-[#333] transition-all"
            aria-label={isRtl ? 'رجوع' : 'Back'}
          >
            <ArrowLeft className={`w-5 h-5 ${isRtl ? '' : 'rotate-180'}`} />
          </button>
        </div>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] shadow-lg">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white">التوثيق</h2>
            <p className="text-xs text-gray-400">طلبات التحقق من الهوية والتحقق الأمني</p>
          </div>
        </div>

        <div className="rounded-2xl bg-[#1A1A1A] border border-[#262626] p-8 text-center">
          <Info className="w-8 h-8 text-[#D4AF37]/70 mx-auto mb-3" />
          <p className="text-sm font-bold text-white mb-1">نظام التوثيق قيد الربط</p>
          <p className="text-xs text-gray-500 leading-relaxed">
            سيتم عرض طلبات التوثيق والتحقق من الهوية هنا عند ربط نظام التوثيق بقاعدة البيانات المركزية.
          </p>
        </div>
      </div>
    </div>
  );
};
