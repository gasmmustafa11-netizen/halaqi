import React, { useCallback, useEffect, useState } from 'react';
import { User, Clock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { api } from '../../services/api';

interface DiscoverUser {
  id: string;
  anonymousName: string;
  anonymousAvatar?: string | null;
  sharedInterests: string[];
}

interface IncomingRequest {
  id: string;
  senderId: string;
  anonymousName: string;
  sharedInterests: string[];
}

interface AnonConnection {
  conversationId: string;
  otherId: string;
  expiresAt: string;
  revealed: boolean;
  ended: boolean;
  myConsent: boolean;
  otherConsent: boolean;
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

const ANON_DURATION_MS = 40 * 60 * 1000;
const WARN_MS = 10 * 60 * 1000;

const glassCard =
  'bg-white/[0.06] backdrop-blur-2xl border border-white/[0.12] rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.6)] ring-1 ring-white/[0.05]';

function AnonAvatar({ avatar, revealed, size = 'w-20 h-20' }: { avatar?: string; revealed?: boolean; size?: string }) {
  if (revealed && avatar) {
    return (
      <div className={`${size} rounded-2xl bg-gray-800 border border-white/10 overflow-hidden shrink-0`}>
        <img src={avatar} alt="" className="w-full h-full object-cover" />
      </div>
    );
  }
  return (
    <div className={`${size} rounded-2xl bg-gradient-to-br from-white/[0.08] to-white/[0.02] border border-white/[0.12] flex items-center justify-center text-gray-400 shrink-0`}>
      <User className="w-1/2 h-1/2" />
    </div>
  );
}

function fmtRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const AnonymousChat: React.FC<{
  convId: string;
  otherId: string;
  isRtl: boolean;
  onClose: () => void;
  showToast: (m: string) => void;
}> = ({ convId, otherId, isRtl, onClose, showToast }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [ended, setEnded] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState<number>(ANON_DURATION_MS);
  const [myConsent, setMyConsent] = useState(false);
  const [otherConsent, setOtherConsent] = useState(false);
  const [otherName, setOtherName] = useState('');
  const [otherAvatar, setOtherAvatar] = useState<string | undefined>();

  const refresh = useCallback(async () => {
    const res = await api.getDiscoverConversation(convId);
    if (res.success) {
      setMessages(res.messages || []);
      const m = res.meta;
      setMeta(m);
      setEnded(Boolean(m?.ended));
      setRevealed(Boolean(m?.revealed));
      if (m?.expiresAt) setExpiresAt(new Date(m.expiresAt).getTime());
      setMyConsent(Boolean(m?.myConsent));
      setOtherConsent(Boolean(m?.otherConsent));
      if (m?.revealed) {
        setOtherName(m.otherName || (isRtl ? 'مستخدم' : 'User'));
        setOtherAvatar(m.otherAvatar);
      }
    }
  }, [convId, isRtl]);

  useEffect(() => {
    refresh();
    const t = window.setInterval(refresh, 4000);
    return () => window.clearInterval(t);
  }, [refresh]);

  // Countdown timer
  useEffect(() => {
    if (expiresAt == null || revealed || ended) return;
    const tick = () => {
      const left = expiresAt - Date.now();
      setRemaining(left);
      if (left <= 0) {
        setEnded(true);
        api.endDiscoverConversation(convId).catch(() => {});
        showToast(isRtl ? 'انتهت المحادثة المجهولة' : 'Anonymous conversation ended');
      }
    };
    tick();
    const t = window.setInterval(tick, 1000);
    return () => window.clearInterval(t);
  }, [expiresAt, revealed, ended, convId, showToast, isRtl]);

  const send = async () => {
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    const res = await api.sendDiscoverMessage(convId, text);
    setSending(false);
    if (res.success) {
      setBody('');
      refresh();
    } else {
      showToast(res.error || (isRtl ? 'تعذر الإرسال' : 'Could not send'));
      if (res.error && /انتهت/.test(res.error)) setEnded(true);
    }
  };

  const end = async () => {
    if (!window.confirm(isRtl ? 'إنهاء المحادثة؟ ستُخفى هوياتكما.' : 'End the conversation? Identities stay hidden.')) return;
    await api.endDiscoverConversation(convId);
    setEnded(true);
    showToast(isRtl ? 'تم إنهاء المحادثة' : 'Conversation ended');
  };

  const reveal = async () => {
    const res = await api.revealDiscoverIdentity(convId);
    if (res.success) {
      setMyConsent(true);
      setOtherConsent(Boolean(res.otherConsent));
      if (res.revealed) {
        setRevealed(true);
        refresh();
        showToast(isRtl ? 'تم كشف الهوية لكليكما' : 'Identities revealed for both of you');
      } else {
        showToast(isRtl ? 'بانتظار موافقة الطرف الآخر' : 'Waiting for the other person to agree');
      }
    } else {
      showToast(res.error || (isRtl ? 'تعذر كشف الهوية' : 'Could not reveal'));
    }
  };

  const me = user?.id;
  const displayName = revealed ? otherName : isRtl ? 'مجهول' : 'Anonymous';

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0A0A0A]">
      <div className="max-w-2xl w-full mx-auto flex-1 flex flex-col px-3 sm:px-4">
        {/* header */}
        <div className={`flex items-center gap-3 p-3 border-b border-white/[0.08] ${isRtl ? 'flex-row-reverse' : ''}`}>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/[0.06] hover:bg-white/10 border border-white/[0.12] text-gray-300 flex items-center justify-center">
            {isRtl ? '›' : '‹'}
          </button>
          <AnonAvatar avatar={otherAvatar} revealed={revealed} size="w-10 h-10" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate">{displayName}</p>
            {!ended && !revealed && expiresAt != null && (
              <p className={`text-[11px] flex items-center gap-1 ${remaining <= WARN_MS ? 'text-red-400' : 'text-gray-400'}`}>
                <Clock className="w-3 h-3" />
                {fmtRemaining(remaining)}
                {remaining <= WARN_MS && remaining > 0 && (isRtl ? ' (10 دقائق متبقية)' : ' (10 minutes remaining)')}
              </p>
            )}
            {revealed && <p className="text-[11px] text-[#D4AF37]">{isRtl ? 'تم كشف الهوية' : 'Identity revealed'}</p>}
            {ended && <p className="text-[11px] text-gray-500">{isRtl ? 'انتهت المحادثة' : 'Conversation ended'}</p>}
          </div>
          <button onClick={end} className="px-3 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/10 border border-white/[0.12] text-gray-300 text-xs">
            {isRtl ? 'إنهاء' : 'End'}
          </button>
        </div>

        {/* messages */}
        <div className="flex-1 overflow-y-auto py-4 space-y-2">
          {messages.length === 0 && (
            <p className="text-center text-xs text-gray-500 mt-8">
              {isRtl ? 'ابدأ المحادثة — هويتكما مخفية.' : 'Start the conversation — your identities are hidden.'}
            </p>
          )}
          {messages.map((m) => {
            const mine = m.senderId === me;
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[78%] px-3.5 py-2 rounded-2xl text-sm ${
                    mine
                      ? 'bg-[#D4AF37] text-black rounded-br-md'
                      : 'bg-white/[0.08] text-gray-100 border border-white/[0.10] rounded-bl-md'
                  }`}
                >
                  {m.body}
                </div>
              </div>
            );
          })}
        </div>

        {/* composer / reveal */}
        {ended ? (
          <div className="p-4 text-center text-xs text-gray-500 border-t border-white/[0.08]">
            {isRtl ? 'انتهت المحادثة المجهولة. بقيت هويتكما مخفية.' : 'The anonymous conversation has ended. Identities stayed hidden.'}
          </div>
        ) : (
          <div className="p-3 border-t border-white/[0.08] space-y-2">
            {!revealed && (
              <button
                onClick={reveal}
                className="w-full py-2 rounded-full bg-white/[0.06] hover:bg-white/10 border border-white/[0.12] text-[#D4AF37] text-xs transition-all"
              >
                {myConsent && !otherConsent
                  ? isRtl ? 'بانتظار موافقة الطرف الآخر على كشف الهوية' : 'Waiting for the other to agree to reveal'
                  : isRtl ? 'موافقة على كشف الهوية' : 'Agree to reveal identity'}
              </button>
            )}
            <div className="flex gap-2">
              <input
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                maxLength={2000}
                placeholder={isRtl ? 'اكتب رسالة…' : 'Type a message…'}
                className="flex-1 bg-white/[0.06] border border-white/[0.12] rounded-full px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-[#D4AF37]/40"
              />
              <button
                onClick={send}
                disabled={sending || !body.trim()}
                className="px-5 py-2.5 rounded-full bg-[#D4AF37] hover:bg-[#B8962D] text-black text-sm font-bold transition-all disabled:opacity-60"
              >
                {isRtl ? 'إرسال' : 'Send'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

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
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const [connections, setConnections] = useState<AnonConnection[]>([]);
  const [activeChat, setActiveChat] = useState<{ convId: string; otherId: string } | null>(null);

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

  const loadConnections = useCallback(async () => {
    const res = await api.getDiscoverConnections();
    if (res.success) setConnections(res.connections);
  }, []);

  // Avoid name clash: use the proper setter
  const [requests, setReqState] = useState<IncomingRequest[]>([]);
  const loadIncoming = useCallback(async () => {
    const res = await api.getConnectionRequests();
    if (res.success) setReqState(res.requests);
  }, []);

  useEffect(() => {
    if (!user) return;
    loadInterests().then(() => {
      loadRecommendations();
      loadIncoming();
      loadConnections();
    });
    const t = window.setInterval(loadConnections, 5000);
    return () => window.clearInterval(t);
  }, [user, loadInterests, loadRecommendations, loadIncoming, loadConnections]);

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
      setPendingIds((p) => [...p, id]);
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
      showToast(isRtl ? 'تم قبول الطلب — افتح المحادثة المجهولة' : 'Request accepted — open the anonymous chat');
      setReqState((list) => list.filter((r) => r.id !== id));
      loadConnections();
    } else {
      showToast(res.error || (isRtl ? 'تعذر القبول' : 'Could not accept'));
    }
  };

  const declineReq = async (id: string) => {
    const res = await api.declineConnectionRequest(id);
    if (res.success) setReqState((list) => list.filter((r) => r.id !== id));
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

  if (activeChat) {
    return (
      <AnonymousChat
        convId={activeChat.convId}
        otherId={activeChat.otherId}
        isRtl={isRtl}
        onClose={() => {
          setActiveChat(null);
          loadConnections();
        }}
        showToast={showToast}
      />
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
                <AnonAvatar size="w-10 h-10" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{isRtl ? 'مجهول' : 'Anonymous'}</p>
                  {r.sharedInterests.length > 0 && (
                    <p className="text-[11px] text-gray-400 truncate">
                      {isRtl ? 'تشاركان اهتمامات' : 'You share interests'}
                      {isRtl ? `: ${r.sharedInterests.map(interestLabel).join('، ')}` : `: ${r.sharedInterests.map(interestLabel).join(', ')}`}
                    </p>
                  )}
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

      {/* Active anonymous conversations */}
      {connections.length > 0 && (
        <div className={`${glassCard} p-4`}>
          <p className="text-xs text-gray-400 mb-3 font-bold uppercase tracking-widest">
            {isRtl ? 'محادثات مجهولة' : 'Anonymous chats'}
          </p>
          <div className="space-y-2">
            {connections.map((c) => (
              <button
                key={c.conversationId}
                onClick={() => setActiveChat({ convId: c.conversationId, otherId: c.otherId })}
                className="w-full flex items-center gap-3 text-right"
              >
                <AnonAvatar size="w-10 h-10" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{isRtl ? 'مجهول' : 'Anonymous'}</p>
                  <p className="text-[11px] text-gray-400">
                    {c.revealed
                      ? isRtl ? 'هوية مكشوفة' : 'Identity revealed'
                      : isRtl ? 'محادثة مجهولة' : 'Anonymous chat'}
                  </p>
                </div>
                <span className="text-[#D4AF37] text-xs font-bold">{isRtl ? 'فتح' : 'Open'}</span>
              </button>
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
                ? 'محادثات مجهولة لمدة 40 دقيقة. تُكشف الهوية فقط عند اتفاقكما معاً.'
                : 'Anonymous chats for 40 minutes. Identity is revealed only when you both agree.'}
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
                <button onClick={startEditing} className="text-xs text-[#D4AF37] hover:underline">
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

      {/* Recommendations (anonymous) */}
      {loading ? (
        <div className={`${glassCard} p-10 text-center text-gray-400 text-sm`}>
          {isRtl ? 'جارٍ التحميل…' : 'Loading…'}
        </div>
      ) : current ? (
        <div className={`${glassCard} overflow-hidden relative`}>
          <div className="pointer-events-none absolute -top-16 -right-16 w-48 h-48 rounded-full bg-[#D4AF37]/[0.08] blur-3xl" />

          <div className="p-6 sm:p-8 relative">
            <div className={`flex items-center gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <AnonAvatar size="w-20 h-20" />
              <div className="min-w-0 flex-1">
                <p className="text-lg font-black text-white truncate">{isRtl ? 'مجهول' : 'Anonymous'}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {isRtl ? 'هوية مخفية حتى الاتفاق' : 'Identity hidden until you both agree'}
                </p>
              </div>

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
                    className={`absolute ${isRtl ? 'left-0' : 'right-0'} mt-2 w-40 z-20 bg-white/[0.06] backdrop-blur-2xl border border-white/[0.12] rounded-2xl p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.6)] ring-1 ring-white/[0.05]`}
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

            {current.sharedInterests[0] && (
              <div className="mt-5 rounded-2xl bg-white/[0.04] border border-white/[0.10] p-4">
                <p className="text-[11px] uppercase tracking-widest text-[#D4AF37]/70 mb-1">
                  {isRtl ? 'بادرة حديث' : 'Conversation starter'}
                </p>
                <p className="text-sm text-gray-200 leading-relaxed">
                  {isRtl
                    ? `تشاركان الاهتمام بـ "${interestLabel(current.sharedInterests[0])}". ما رأيكما أن تبدآ الحديث عنه؟`
                    : `You both enjoy "${interestLabel(current.sharedInterests[0])}". Why not break the ice with that?`}
                </p>
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => connect(current.id)}
                disabled={actioning || pendingIds.includes(current.id)}
                className="flex-1 py-3 rounded-full bg-[#D4AF37] hover:bg-[#B8962D] text-black font-bold text-sm shadow-[0_0_16px_-2px_rgba(212,175,55,0.5)] ring-1 ring-[#D4AF37]/20 transition-all disabled:opacity-60"
              >
                {pendingIds.includes(current.id)
                  ? isRtl ? 'طلب مرسل' : 'Request sent'
                  : isRtl ? 'تواصل' : 'Connect'}
              </button>
              <button
                onClick={skip}
                disabled={actioning}
                className="flex-1 py-3 rounded-full bg-white/[0.06] hover:bg-white/10 border border-white/[0.12] text-gray-200 text-sm transition-all disabled:opacity-60"
              >
                {isRtl ? 'تخطٍ' : 'Skip'}
              </button>
            </div>
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
              loadIncoming();
              loadConnections();
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
            <p className="text-xs text-gray-400 mt-1 mb-4">{isRtl ? 'مجهول' : 'Anonymous'}</p>
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

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-full bg-white/[0.08] backdrop-blur-2xl border border-white/[0.12] text-white text-xs shadow-[0_8px_32px_rgba(0,0,0,0.6)] ring-1 ring-white/[0.05]">
          {toast}
        </div>
      )}
    </div>
  );
};
