import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Send, MapPin, Star, Clock } from 'lucide-react';
import { aiSalonChat } from '../../services/aiSalon';

interface Msg { id: number; role: 'user' | 'ai'; text: string; cards?: any[]; time: string; }

export default function YourSalonView({ onBack, onSelectSalonId }: { onBack: () => void; onSelectSalonId: (salonId: string) => void }) {
  const [input, setInput] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>([
    { id: 1, role: 'ai', text: 'مرحباً! أنا مساعد صالونات Halaqi الذكي. كيف يمكنني مساعدتك اليوم؟ مثال: "أريد صالون قريب يفصل فايد بسعر حول 10,000 دينار".', time: new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' }) },
  ]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [selectedSalonId, setSelectedSalonId] = useState<string | null>(null);
  const [conversationState, setConversationState] = useState<{
    intent?: string;
    location?: string;
    salonId?: string;
    salonName?: string;
    serviceId?: string;
    serviceName?: string;
    date?: string;
    time?: string;
    pendingQuestion?: string;
    lastResolvedContext?: string;
  }>({});

  const handleSelectCard = (card: any) => {
    if (card.id) onSelectSalonId(card.id);
    setSelectedSalonId(card.id);
    setConversationState((prev) => {
      const newSalonId = card.id;
      const isSalonChange = prev.salonId && prev.salonId !== newSalonId;
      if (isSalonChange) {
        return {
          ...prev,
          salonId: newSalonId,
          salonName: card.name || prev.salonName,
          serviceId: undefined,
          serviceName: undefined,
          date: undefined,
          time: undefined,
        };
      }
      return {
        ...prev,
        salonId: newSalonId,
        salonName: card.name || prev.salonName,
      };
    });
  };

  const prevMsgsLength = useRef(msgs.length);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const added = msgs.length > prevMsgsLength.current;
    prevMsgsLength.current = msgs.length;
    // Only scroll when a new message was added AND user is near bottom
    if (added) {
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
      if (nearBottom) {
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      }
    }
  }, [msgs, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const userMsg: Msg = { id: Date.now(), role: 'user', text, time: new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' }) };
    setMsgs((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    try {
      const history = [
        ...msgs.map((m) => ({ role: m.role, text: m.text })),
        { role: 'user', text },
      ].slice(-12);

      const data = await aiSalonChat({
        message: text,
        regionConsent: false,
        conversationHistory: history,
        conversationState,
      });
      
      if (data?.conversationState) {
        const incoming = data.conversationState;
        setConversationState(prev => {
          const incomingSalonId = incoming.salonId !== undefined ? String(incoming.salonId || '').trim() || undefined : prev.salonId;
          const prevSalonId = prev.salonId ? String(prev.salonId).trim() : '';
          const isSalonChange = incomingSalonId && prevSalonId && incomingSalonId !== prevSalonId;
          if (isSalonChange) {
            return {
              ...prev,
              ...Object.fromEntries(
                Object.entries(incoming).filter(
                  ([, value]) => value !== null && value !== ''
                )
              ),
              serviceId: incoming.serviceId !== undefined ? incoming.serviceId : undefined,
              serviceName: incoming.serviceName !== undefined ? incoming.serviceName : undefined,
              date: incoming.date !== undefined ? incoming.date : undefined,
              time: incoming.time !== undefined ? incoming.time : undefined,
            };
          }
          return {
            ...prev,
            ...Object.fromEntries(
              Object.entries(incoming).filter(
                ([, value]) => value !== null && value !== ''
              )
            ),
          };
        });
      }
      const aiMsg: Msg = { id: Date.now() + 1, role: 'ai', text: data.reply || 'لا توجد نتائج حالياً.', cards: data.cards || [], time: new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' }) };
      setMsgs((prev) => [...prev, aiMsg]);
    } catch (e) {
      setMsgs((prev) => [...prev, { id: Date.now() + 2, role: 'ai', text: 'حدث خطأ، حاول مرة أخرى.', time: new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' }) }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full h-full bg-[#0B0A0F] text-white overflow-hidden overscroll-none">
      {/* Header */}
      <div className="shrink-0 bg-[#0B0A0F]/90 backdrop-blur border-b border-white/10 px-4 py-3 flex items-center gap-3 z-40" style={{ paddingTop: 'env(safe-area-inset-top, 0.75rem)' }}>
        <button onClick={onBack} aria-label="Back" className="p-2 rounded-full hover:bg-white/10 transition" title="رجوع">
          <ArrowLeft className="w-5 h-5 text-[#D4AF37]" />
        </button>
        <div>
          <h1 className="text-base font-bold text-[#D4AF37] leading-tight">الصالون</h1>
          <p className="text-[10px] text-gray-400">مساعد ذكي — Halaqi AI</p>
        </div>
      </div>

      {/* Chat */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4 overscroll-contain touch-pan-y" style={{ overscrollBehavior: 'contain' }}>
        {msgs.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-lg ${m.role === 'user' ? 'bg-[#D4AF37] text-black rounded-br-md' : 'bg-white/10 text-white rounded-bl-md border border-white/5'}`}>
              <p className="whitespace-pre-wrap">{m.text}</p>
              {m.cards && m.cards.length > 0 && (
                <div className="mt-3 space-y-3">
                  {m.cards.map((card: any, idx: number) => (
                    <button type="button" key={idx} className="w-full text-right block rounded-xl bg-[#16121A] border border-white/10 p-3 hover:border-[#D4AF37]/60 transition" onClick={() => handleSelectCard(card)}>
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-bold text-[#D4AF37]">{card.name}</h3>
                        <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full text-gray-300">{card.type}</span>
                      </div>
                      <div className="text-xs text-gray-300 space-y-0.5">
                        <div className="flex items-center gap-2"><MapPin className="w-3 h-3 text-[#D4AF37]" /> {card.city}</div>
                        <div className="flex items-center gap-2"><Star className="w-3 h-3 text-amber-400" /> تقييم {card.rating} ({card.reviewCount})</div>
                        <div className="flex items-center gap-2"><Clock className="w-3 h-3 text-emerald-400" /> {card.services || 'خدمات متعددة'}</div>
                        <div className="text-amber-300">سعر تقريباً: {card.price || 'غير محدد'}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <div className="text-[10px] text-gray-500 mt-2">{m.time}</div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white/10 rounded-2xl rounded-bl-md px-4 py-3 text-sm text-gray-300 animate-pulse">جارٍ البحث في Halaqi...</div>
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex-none shrink-0 bg-[#0B0A0F]/95 backdrop-blur-md border-t border-white/10 px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-3 w-full" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0.75rem)', minHeight: '56px' }} dir="rtl">
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="اسأل عن صالون، خدمة، سعر، تقييم..." className="flex-1 min-w-0 bg-white/10 rounded-full px-4 py-3 text-sm sm:text-base outline-none focus:ring-2 focus:ring-[#D4AF37]/60 text-white placeholder:text-gray-400" dir="rtl" />
        <button type="submit" disabled={!input.trim() || loading} className="shrink-0 p-3 rounded-full bg-[#D4AF37] text-black hover:bg-amber-300 active:scale-95 transition disabled:opacity-40 shadow-lg" aria-label="إرسال" title="إرسال">
          <Send className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
      </form>
    </div>
  );
}
