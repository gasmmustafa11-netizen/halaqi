import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { api } from '../../services/api';

interface DiscoverUser {
  id: string;
  name: string;
  avatar?: string;
  city?: string;
  interests: string[];
  sharedInterests: string[];
}

interface IncomingRequest {
  id: string;
  senderId: string;
  name: string;
  avatar?: string;
}

const INTEREST_OPTIONS: { id: string; ar: string; en: string }[] = [
  { id: 'haircare', ar: 'العناية بالشعر', en: 'Haircare' },
  { id: 'beard', ar: 'العناية باللحية', en: 'Beard' },
  { id: 'fashion', ar: 'الموضة', en: 'Fashion' },
  { id: 'fitness', ar: 'اللياقة', en: 'Fitness' },
  { id: 'football', ar: 'كرة القدم', en: 'Football' },
  { id: 'music', ar: 'الموسيقى', en: 'Music' },
  { id: 'gaming', ar: 'الألعاب', en: 'Gaming' },
  { id: 'tech', ar: 'التقنية', en: 'Tech' },
  { id: 'travel', ar: 'السفر', en: 'Travel' },
  { id: 'food', ar: 'الطبخ', en: 'Cooking' },
  { id: 'coffee', ar: 'القهوة', en: 'Coffee' },
  { id: 'reading', ar: 'القراءة', en: 'Reading' },
  { id: 'art', ar: 'الفن', en: 'Art' },
  { id: 'photography', ar: 'التصوير', en: 'Photography' },
  { id: 'cars', ar: 'السيارات', en: 'Cars' },
  { id: 'movies', ar: 'الأفلام', en: 'Movies' },
  { id: 'business', ar: 'الأعمال', en: 'Business' },
  { id: 'pets', ar: 'الحيوانات الأليفة', en: 'Pets' },
];

const REPORT_REASONS = [
  { id: 'spam', ar: 'رسائل مزعجة', en: 'Spam' },
  { id: 'fake', ar: 'حساب وهمي', en: 'Fake account' },
  { id: 'harassment', ar: 'تحرش أو إزعاج', en: 'Harassment' },
  { id: 'inappropriate', ar: 'محتوى غير لائق', en: 'Inappropriate content' },
  { id: 'other', ar: 'أخرى', en: 'Other' },
];

const glassCard =
  'bg-white/[0.06] backdrop-blur-2xl border border-white/[0.12] rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.6)] ring-1 ring-white/[0.05]';

export const DiscoverView: React.FC<{ onNavigate: (view: string) => void }> = ({ onNavigate }) => {
  const { user, openAuthModal } = useAuth();
  const { isRtl } = useLanguage();

  const [interests, setInterests] = useState<string[]>([]);
  const [recommendations, setRecommendations] = useState<DiscoverUser[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [actioning, setActioning] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportFor, setReportFor] = useState<DiscoverUser | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [requests, setRequests] = useState<IncomingRequest[]>([]);

  const interestLabel = (id: string) => INTEREST_OPTIONS.find((o) => o.id === id)?.[isRtl ? 'ar' : 'en'] || id;

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2600);
  };

  const loadInterests = useCallback(async () => {
    const res = await api.getMyInterests();
    if (res.success) setInterests(res.interests);
  }, []);

  const loadRecommendations = useCallback(async () => {
    setLoading(true);
    const res = await api.getDiscoverRecommendations(20);
    setLoading(false);
    if (res.success) {
      setRecommendations(res.users);
      setIndex(0);
    }
  }, []);

  const loadRequests = useCallback(async () => {
    const res = await api.getConnectionRequests();
    if (res.success) setRequests(res.requests);
  }, []);

  useEffect(() => {
    if (!user) return;
    loadInterests().then(() => {
      loadRecommendations();
      loadRequests();
    });
  }, [user, loadInterests, loadRecommendations, loadRequests]);

  const current = recommendations[index];

  const toggleDraft = (id: string) =>
    setDraft((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const startEditing = () => {
    setDraft(interests);
    setEditing(true);
  };

  const saveInterests = async () => {
    const res = await api.setMyInterests(draft);
    if (res.success) {
      setInterests(res.interests);
      setEditing(false);
      showToast(isRtl ? 'تم حفظ اهتماماتك' : 'Interests saved');
      loadRecommendations();
    } else {
      showToast(res.error || (isRtl ? 'تعذر الحفظ' : 'Could not save'));
    }
  };

  const next = () => setIndex((i) => Math.min(i + 1, recommendations.length));

  const connect = async (id: string) => {
    setActioning(true);
    setMenuOpen(false);
    const res = await api.sendConnectionRequest(id);
    setActioning(false);
    if (res.success) {
      showToast(isRtl ? 'تم إرسال طلب الاتصال ✨' : 'Connection request sent ✨');
      next();
    } else {
      showToast(res.error || (isRtl ? 'تعذر الإرسال' : 'Could not send'));
    }
  };

  const skip = () => {
    setMenuOpen(false);
    next();
  };

  const block = async (id: string) => {
    setMenuOpen(false);
    if (!window.confirm(isRtl ? 'هل تريد حظر هذا المستخدم؟' : 'Block this user?')) return;
    setActioning(true);
    const res = await api.blockUser(id);
    setActioning(false);
    if (res.success) {
      showToast(isRtl ? 'تم الحظر' : 'Blocked');
      setRecommendations((list) => list.filter((u) => u.id !== id));
      setIndex((i) => Math.max(0, Math.min(i, recommendations.length - 2)));
    } else {
      showToast(res.error || (isRtl ? 'تعذر الحظر' : 'Could not block'));
    }
  };

  const submitReport = async () => {
    if (!reportFor) return;
    if (!reportReason) {
      showToast(isRtl ? 'اختر سبباً للبلاغ' : 'Choose a reason');
      return;
    }
    setActioning(true);
    const res = await api.reportUser(reportFor.id, reportReason);
    setActioning(false);
    setReportFor(null);
    setReportReason('');
    if (res.success) {
      showToast(isRtl ? 'تم إرسال البلاغ' : 'Report sent');
      next();
    } else {
      showToast(res.error || (isRtl ? 'تعذر الإرسال' : 'Could not send'));
    }
  };

  const acceptReq = async (id: string) => {
    const res = await api.acceptConnectionRequest(id);
    if (res.success) {
      showToast(isRtl ? 'تم قبول الطلب — أنتما متصلان ✨' : 'Request accepted — you are connected ✨');
      setRequests((list) => list.filter((r) => r.id !== id));
    } else {
      showToast(res.error || (isRtl ? 'تعذر القبول' : 'Could not accept'));
    }
  };

  const declineReq = async (id: string) => {
    const res = await api.declineConnectionRequest(id);
    if (res.success) setRequests((list) => list.filter((r) => r.id !== id));
  };

  if (!user) {
    return (
      <div className={`max-w-2xl mx-auto px-1 ${isRtl ? 'text-right' : 'text-left'}`}>
        <div className={`${glassCard} p-8 sm:p-12 text-center`}>
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-[#D4AF37]/20 to-[#D4AF37]/5 border border-[#D4AF37]/20 flex items-center justify-center text-3xl mb-5">
            🧭
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white">
            {isRtl ? 'اكتشف أشخاصاً جدداً' : 'Discover new people'}
          </h2>
          <p className="text-sm text-gray-400 mt-2">
            {isRtl
              ? 'سجّل الدخول لاقتراح أشخاص يشاركونك اهتماماتك.'
              : 'Log in to get matched with people who share your interests.'}
          </p>
          <button
            onClick={openAuthModal}
            className="mt-6 px-6 py-3 rounded-full bg-[#D4AF37] hover:bg-[#B8962D] text-black font-bold text-sm shadow-[0_0_16px_-2px_rgba(212,175,55,0.5)] ring-1 ring-[#D4AF37]/20 transition-all"
          >
            {isRtl ? 'تسجيل الدخول' : 'Log in'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`max-w-2xl mx-auto px-1 space-y-5 ${isRtl ? 'text-right' : 'text-left'}`}>
      {/* Incoming connection requests */}
      {requests.length > 0 && (
        <div className={`${glassCard} p-4`}>
          <p className="text-xs text-gray-400 mb-3 font-bold uppercase tracking-widest">
            {isRtl ? 'طلبات الاتصال' : 'Connection requests'}
          </p>
          <div className="space-y-2">
            {requests.map((r) => (
              <div key={r.id} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-800 border border-white/10 overflow-hidden shrink-0">
                  {r.avatar ? (
                    <img src={r.avatar} alt={r.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="w-full h-full flex items-center justify-center text-[#D4AF37] font-bold">
                      {r.name.charAt(0)}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{r.name}</p>
                </div>
                <button
                  onClick={() => acceptReq(r.id)}
                  className="px-3 py-1.5 rounded-full bg-[#D4AF37] hover:bg-[#B8962D] text-black text-xs font-bold transition-all"
                >
                  {isRtl ? 'قبول' : 'Accept'}
                </button>
                <button
                  onClick={() => declineReq(r.id)}
                  className="px-3 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/10 border border-white/[0.12] text-gray-300 text-xs transition-all"
                >
                  {isRtl ? 'رفض' : 'Decline'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Intro + interests */}
      <div className={`${glassCard} p-5 sm:p-7`}>
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#D4AF37]/20 to-[#D4AF37]/5 border border-[#D4AF37]/20 flex items-center justify-center text-2xl shrink-0 shadow-[0_0_20px_-4px_rgba(212,175,55,0.4)]">
            🧭
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg sm:text-xl font-black text-white">
              {isRtl ? 'اكتشف شخصاً لا تعرفه' : 'Meet someone you don’t know'}
            </h1>
            <p className="text-xs sm:text-sm text-gray-400 mt-1">
              {isRtl
                ? 'نقترح عليك أشخاصاً يشاركونك اهتماماتك. الاتصال يتم فقط عند قبول الطرفين.'
                : 'We recommend people who share your interests. A connection forms only when both of you accept.'}
            </p>
          </div>
        </div>

        <div className="mt-5">
          {editing ? (
            <div>
              <p className="text-xs text-gray-400 mb-2 font-bold">
                {isRtl ? 'اختر اهتماماتك' : 'Pick your interests'}
              </p>
              <div className="flex flex-wrap gap-2">
                {INTEREST_OPTIONS.map((opt) => {
                  const active = draft.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      onClick={() => toggleDraft(opt.id)}
                      className={`px-3 py-1.5 rounded-full text-xs border transition-all ${
                        active
                          ? 'bg-[#D4AF37]/[0.12] text-[#D4AF37] border-[#D4AF37]/30 shadow-[0_0_14px_-2px_rgba(212,175,55,0.5)]'
                          : 'bg-white/[0.04] text-gray-300 border-white/[0.12] hover:bg-white/10'
                      }`}
                    >
                      {isRtl ? opt.ar : opt.en}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={saveInterests}
                  className="px-5 py-2 rounded-full bg-[#D4AF37] hover:bg-[#B8962D] text-black text-xs font-bold transition-all"
                >
                  {isRtl ? 'حفظ' : 'Save'}
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="px-5 py-2 rounded-full bg-white/[0.06] hover:bg-white/10 border border-white/[0.12] text-gray-300 text-xs transition-all"
                >
                  {isRtl ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between gap-3 mb-2">
                <p className="text-xs text-gray-400 font-bold">
                  {isRtl ? `اهتماماتك (${interests.length})` : `Your interests (${interests.length})`}
                </p>
                <button
                  onClick={startEditing}
                  className="text-xs text-[#D4AF37] hover:underline"
                >
                  {isRtl ? 'تعديل' : 'Edit'}
                </button>
              </div>
              {interests.length === 0 ? (
                <button
                  onClick={startEditing}
                  className="w-full py-3 rounded-2xl border border-dashed border-white/15 text-gray-400 text-sm hover:border-[#D4AF37]/40 hover:text-[#D4AF37] transition-all"
                >
                  {isRtl ? '+ أضف اهتماماتك لبدء الاكتشاف' : '+ Add your interests to start discovering'}
                </button>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {interests.map((id) => (
                    <span
                      key={id}
                      className="px-3 py-1.5 rounded-full text-xs bg-white/[0.06] text-gray-200 border border-white/[0.12]"
                    >
                      {interestLabel(id)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Recommendations */}
      {loading ? (
        <div className={`${glassCard} p-10 text-center text-gray-400 text-sm`}>
          {isRtl ? 'جارٍ التحميل…' : 'Loading…'}
        </div>
      ) : current ? (
        <div className={`${glassCard} overflow-hidden relative`}>
          {/* soft glow */}
          <div className="pointer-events-none absolute -top-16 -right-16 w-48 h-48 rounded-full bg-[#D4AF37]/[0.08] blur-3xl" />

          <div className="p-6 sm:p-8 relative">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-2xl bg-gray-800 border border-white/10 overflow-hidden shrink-0">
                {current.avatar ? (
                  <img src={current.avatar} alt={current.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="w-full h-full flex items-center justify-center text-2xl text-[#D4AF37] font-black">
                    {current.name.charAt(0)}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-lg font-black text-white truncate">{current.name}</p>
                {current.city && <p className="text-xs text-gray-400 mt-0.5">{current.city}</p>}
              </div>

              {/* overflow menu */}
              <div className="relative">
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  className="w-9 h-9 rounded-full bg-white/[0.06] hover:bg-white/10 border border-white/[0.12] text-gray-300 flex items-center justify-center transition-all"
                  aria-label="More"
                >
                  ⋮
                </button>
                {menuOpen && (
                  <div
                    className={`absolute ${
                      isRtl ? 'left-0' : 'right-0'
                    } mt-2 w-40 z-20 bg-white/[0.06] backdrop-blur-2xl border border-white/[0.12] rounded-2xl p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.6)] ring-1 ring-white/[0.05]`}
                  >
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        block(current.id);
                      }}
                      className="w-full text-start px-3 py-2 rounded-xl text-red-400 hover:bg-red-950/40 text-xs transition-colors"
                    >
                      {isRtl ? 'حظر' : 'Block'}
                    </button>
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        setReportFor(current);
                      }}
                      className="w-full text-start px-3 py-2 rounded-xl text-gray-300 hover:bg-white/5 text-xs transition-colors"
                    >
                      {isRtl ? 'إبلاغ' : 'Report'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* shared interests */}
            <div className="mt-5">
              <p className="text-xs text-gray-400 font-bold mb-2">
                {isRtl
                  ? `اهتمامات مشتركة (${current.sharedInterests.length})`
                  : `Shared interests (${current.sharedInterests.length})`}
              </p>
              <div className="flex flex-wrap gap-2">
                {current.sharedInterests.map((id) => (
                  <span
                    key={id}
                    className="px-3 py-1.5 rounded-full text-xs bg-[#D4AF37]/[0.12] text-[#D4AF37] border border-[#D4AF37]/30"
                  >
                    {interestLabel(id)}
                  </span>
                ))}
              </div>
            </div>

            {/* conversation starter */}
            {current.sharedInterests[0] && (
              <div className="mt-5 rounded-2xl bg-white/[0.04] border border-white/[0.10] p-4">
                <p className="text-[11px] uppercase tracking-widest text-[#D4AF37]/70 mb-1">
                  {isRtl ? 'بادرة حديث' : 'Conversation starter'}
                </p>
                <p className="text-sm text-gray-200 leading-relaxed">
                  {isRtl
                    ? `أنتما تشاركان الاهتمام بـ "${interestLabel(current.sharedInterests[0])}". ما رأيكما أن تبدآ الحديث عنه؟`
                    : `You both enjoy "${interestLabel(current.sharedInterests[0])}". Why not break the ice with that?`}
                </p>
              </div>
            )}

            {/* actions */}
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => connect(current.id)}
                disabled={actioning}
                className="flex-1 py-3 rounded-full bg-[#D4AF37] hover:bg-[#B8962D] text-black font-bold text-sm shadow-[0_0_16px_-2px_rgba(212,175,55,0.5)] ring-1 ring-[#D4AF37]/20 transition-all disabled:opacity-60"
              >
                {isRtl ? 'تواصل' : 'Connect'}
              </button>
              <button
                onClick={skip}
                disabled={actioning}
                className="flex-1 py-3 rounded-full bg-white/[0.06] hover:bg-white/10 border border-white/[0.12] text-gray-200 text-sm transition-all disabled:opacity-60"
              >
                {isRtl ? 'تخطٍ' : 'Skip'}
              </button>
            </div>

            <p className="text-[11px] text-gray-500 mt-3 text-center">
              {isRtl
                ? 'عند قبول الطرف الآخر للطلب، يكتمل الاتصال بينكما.'
                : 'Once they accept your request, the connection is complete.'}
            </p>
          </div>
        </div>
      ) : (
        <div className={`${glassCard} p-10 text-center`}>
          <p className="text-gray-300 font-bold">
            {isRtl ? 'لا يوجد اقتراحات حالياً' : 'No suggestions right now'}
          </p>
          <p className="text-xs text-gray-500 mt-2">
            {interests.length === 0
              ? isRtl
                ? 'أضف اهتماماتك أعلاه لنتأكد من اقتراح أشخاص مناسبين لك.'
                : 'Add your interests above so we can match you with the right people.'
              : isRtl
                ? 'جرّب إضافة اهتمامات أكثر أو عُد لاحقاً.'
                : 'Try adding more interests, or check back later.'}
          </p>
          <button
            onClick={() => {
              loadRecommendations();
              loadRequests();
            }}
            className="mt-4 px-5 py-2 rounded-full bg-white/[0.06] hover:bg-white/10 border border-white/[0.12] text-gray-200 text-xs transition-all"
          >
            {isRtl ? 'إعادة المحاولة' : 'Refresh'}
          </button>
        </div>
      )}

      {/* Report modal */}
      {reportFor && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4">
          <div className={`w-full max-w-md ${glassCard} p-5`}>
            <h3 className="text-base font-black text-white">
              {isRtl ? 'الإبلاغ عن المستخدم' : 'Report user'}
            </h3>
            <p className="text-xs text-gray-400 mt-1 mb-4">{reportFor.name}</p>
            <div className="grid grid-cols-2 gap-2">
              {REPORT_REASONS.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setReportReason(r.id)}
                  className={`px-3 py-2 rounded-xl text-xs border transition-all ${
                    reportReason === r.id
                      ? 'bg-[#D4AF37]/[0.12] text-[#D4AF37] border-[#D4AF37]/30'
                      : 'bg-white/[0.04] text-gray-300 border-white/[0.12] hover:bg-white/10'
                  }`}
                >
                  {isRtl ? r.ar : r.en}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={submitReport}
                disabled={actioning}
                className="flex-1 py-2.5 rounded-full bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-all disabled:opacity-60"
              >
                {isRtl ? 'إرسال البلاغ' : 'Submit report'}
              </button>
              <button
                onClick={() => {
                  setReportFor(null);
                  setReportReason('');
                }}
                disabled={actioning}
                className="flex-1 py-2.5 rounded-full bg-white/[0.06] hover:bg-white/10 border border-white/[0.12] text-gray-300 text-xs transition-all"
              >
                {isRtl ? 'إلغاء' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* toast */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-full bg-white/[0.08] backdrop-blur-2xl border border-white/[0.12] text-white text-xs shadow-[0_8px_32px_rgba(0,0,0,0.6)] ring-1 ring-white/[0.05]">
          {toast}
        </div>
      )}
    </div>
  );
};
