import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Send, MapPin, Star, Clock } from 'lucide-react';
import { aiSalonChat } from '../../services/aiSalon';

interface Msg { id: number; role: 'user' | 'ai'; text: string; cards?: any[]; time: string; }

export default function YourSalonView({ onBack }: { onBack: () => void }) {
  const [input, setInput] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>([
    { id: 1, role: 'ai', text: 'مرحباً! أنا مساعد صالونات Halaqi الذكي. كيف يمكنني مساعدتك اليوم؟ مثال: "أريد صالون قريب يفصل فايد بسعر حول 10,000 دينار".', time: new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' }) },
  ]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [msgs, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const userMsg: Msg = { id: Date.now(), role: 'user', text, time: new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' }) };
    setMsgs((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    try {
      const history = msgs.map((m) => ({ role: m.role, text: m.text }));
      const data = await aiSalonChat({ message: text, regionConsent: false, conversationHistory: history });
      const aiMsg: Msg = { id: Date.now() + 1, role: 'ai', text: data.reply || 'لا توجد نتائج حالياً.', cards: data.cards || [], time: new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' }) };
      setMsgs((prev) => [...prev, aiMsg]);
    } catch (e) {
      setMsgs((prev) => [...prev, { id: Date.now() + 2, role: 'ai', text: 'حدث خطأ، حاول مرة أخرى.', time: new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' }) }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0A0F] text-white flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0B0A0F]/90 backdrop-blur border-b border-white/10 px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} aria-label="Back" className="p-2 rounded-full hover:bg-white/10 transition" title="رجوع">
          <ArrowLeft className="w-5 h-5 text-[#D4AF37]" />
        </button>
        <div>
          <h1 className="text-base font-bold text-[#D4AF37] leading-tight">صالحون</h1>
          <p className="text-[10px] text-gray-400">مساعد ذكي — Halaqi AI</p>
        </div>
      </div>

      {/* Chat */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {msgs.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-lg ${m.role === 'user' ? 'bg-[#D4AF37] text-black rounded-br-md' : 'bg-white/10 text-white rounded-bl-md border border-white/5'}`}>
              <p className="whitespace-pre-wrap">{m.text}</p>
              {m.cards && m.cards.length > 0 && (
                <div className="mt-3 space-y-3">
                  {m.cards.map((card: any, idx: number) => (
                    <a key={idx} href={card.id ? `/salon/${card.id}` : '#'} className="block rounded-xl bg-[#16121A] border border-white/10 p-3 hover:border-[#D4AF37]/60 transition" onClick={(e) => { if (!card.id) e.preventDefault(); }}>
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
                    </a>
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
      <form onSubmit={(e) => { e.preventDefault(); send(); }} className="sticky bottom-0 bg-[#0B0A0F]/95 backdrop-blur border-t border-white/10 px-3 py-3 flex items-center gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="اسأل عن صالون، خدمة، سعر، تقييم..." className="flex-1 bg-white/10 rounded-full px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#D4AF37]/60 text-white placeholder:text-gray-400" dir="rtl" />
        <button type="submit" disabled={!input.trim() || loading} className="p-2.5 rounded-full bg-[#D4AF37] text-black hover:bg-amber-300 transition disabled:opacity-40" aria-label="إرسال">
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
