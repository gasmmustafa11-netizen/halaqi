import React, { useState, useEffect } from 'react';
import { AlertTriangle, ArrowLeft, Clock, User, Shield } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { api } from '../../services/api';

interface ReportsPageProps {
  onBack: () => void;
}

export const ReportsPageView: React.FC<ReportsPageProps> = ({ onBack }) => {
  const { isRtl } = useLanguage();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.getAdminReports();
        setReports(res.success ? res.reports || [] : []);
      } catch {
        setReports([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

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
            <ArrowLeft className={`w-5 w-5 ${isRtl ? '' : 'rotate-180'}`} />
          </button>
        </div>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shadow-lg">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white">البلاغات</h2>
            <p className="text-xs text-gray-400">إدارة البلاغات المقدمة من المستخدمين ومراجعة التفاصيل الأمنية</p>
          </div>
        </div>

        {loading ? (
          <div className="p-10 text-center text-gray-400 rounded-2xl bg-[#1A1A1A] border border-[#262626]">
            جاري تحميل البلاغات...
          </div>
        ) : reports.length === 0 ? (
          <div className="rounded-2xl bg-[#1A1A1A] border border-[#262626] p-8 text-center">
            <Shield className="w-8 h-8 text-[#D4AF37]/70 mx-auto mb-3" />
            <p className="text-sm font-bold text-white mb-1">لا توجد بلاغات حالياً</p>
            <p className="text-xs text-gray-500 leading-relaxed">سيتم عرض البلاغات المقدمة من المستخدمين هنا عند ربط نظام البلاغات بقاعدة البيانات المركزية.</p>
          </div>
        ) : (
          <div className="rounded-2xl bg-[#1A1A1A] border border-[#262626] overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b border-white/10 text-gray-500 text-[11px]">
                  <th className="text-right p-4">المبلغ عنه</th>
                  <th className="text-right p-4">المبلّغ</th>
                  <th className="text-right p-4">السبب</th>
                  <th className="text-right p-4">التفاصيل</th>
                  <th className="text-right p-4">الحالة</th>
                  <th className="text-right p-4">التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r: any) => (
                  <tr key={r.id} className="border-b border-white/5">
                    <td className="p-4 text-white font-bold">{r.reportedName || '—'}</td>
                    <td className="p-4 text-gray-300 text-xs">{r.reporterName || '—'}</td>
                    <td className="p-4 text-xs text-[#D4AF37] font-semibold">{r.reason || '—'}</td>
                    <td className="p-4 text-xs text-gray-400 truncate max-w-xs">{r.details || '—'}</td>
                    <td className="p-4 text-xs text-gray-300">{r.status || '—'}</td>
                    <td className="p-4 text-[11px] text-gray-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {r.createdAt ? new Date(r.createdAt).toLocaleDateString('ar-IQ') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
