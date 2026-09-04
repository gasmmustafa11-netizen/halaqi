import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Loader2, MapPin, User, Bot } from 'lucide-react';

interface Msg { role: 'user' | 'ai'; text: string; cards?: any[]; }

export default function SalonAIChat({ onBack }: { onBack: () => void }) {
  const [messages, setMessages] = useState<Msg[]>([
    { role: 'ai', text: 'هلا بيك 👋 أني جهاز. شلون أكدر أساعدك؟ تريد حلاق، صالون، أو مركز تجميل قريب منك وبسعر مناسب؟' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [regionAsk, setRegionAsk] = useState(false);
  // Mirror the conversation state the server returns so multi-turn context
  // (selected salon/service/date/time) survives across messages — same as
  // YourSalonView. Without this the server gets no state in follow-up turns.
  const [conversationState, setConversationState] = useState<Record<string, any>>({});
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setInput('');
    setLoading(true);
    try {
      const history = [
        ...messages.map((m) => ({ role: m.role, text: m.text })),
        { role: 'user', text: userMsg },
      ].slice(-12);
      const res = await fetch('/api/ai-salon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg, regionConsent: true, conversationHistory: history, conversationState })
      });
      const data = await res.json();
      if (data?.conversationState) {
        setConversationState((prev) => {
          const incoming = data.conversationState;
          const incomingSalonId = incoming.salonId !== undefined ? String(incoming.salonId || '').trim() || undefined : prev.salonId;
          const prevSalonId = prev.salonId ? String(prev.salonId).trim() : '';
          if (incomingSalonId && prevSalonId && incomingSalonId !== prevSalonId) {
            return {
              ...prev,
              ...Object.fromEntries(Object.entries(incoming).filter(([, v]) => v !== null && v !== '')),
              serviceId: incoming.serviceId !== undefined ? incoming.serviceId : undefined,
              serviceName: incoming.serviceName !== undefined ? incoming.serviceName : undefined,
              date: incoming.date !== undefined ? incoming.date : undefined,
              time: incoming.time !== undefined ? incoming.time : undefined,
            };
          }
          return {
            ...prev,
            ...Object.fromEntries(Object.entries(incoming).filter(([, v]) => v !== null && v !== '')),
          };
        });
      }
      setMessages(prev => [...prev, { role: 'ai', text: data.reply || 'ما عندي نتائج حالياً، حاول مرة أخرى.', cards: data.cards || [] }]);
    } catch {
      setMessages(prev => [...prev, { role: 'ai', text: 'حدث خطأ في الاتصال. حاول لاحقاً.' }]);
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col antialiased">
      <header className="sticky top-0 z-40 bg-[#0A0A0A]/90 backdrop-blur-md border-b border-white/10 px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="text-[#D4AF37] hover:text-white text-sm font-bold">← رجوع</button>
        <h1 className="text-[#D4AF37] font-extrabold text-base">صالونك — مساعد ذكاء اصطناعي</h1>
      </header>
      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-4 max-w-3xl mx-auto w-full">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-lg ${m.role === 'user' ? 'bg-[#D4AF37] text-black' : 'bg-white/5 border border-white/10 text-white'}`}>
              <div className="flex items-center gap-2 mb-1 opacity-70 text-xs">
                {m.role === 'user' ? <User className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                <span>{m.role === 'user' ? 'أنت' : 'آني'}</span>
              </div>
              <p>{m.text}</p>
              {m.cards && m.cards.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  {m.cards.map((c: any, idx: number) => (
                    <div key={idx} className="rounded-xl bg-[#141414] border border-[#D4AF37]/30 p-3 shadow-xl">
                      <h3 className="text-[#D4AF37] font-bold text-sm">{c.name}</h3>
                      <p className="text-xs text-slate-300">{c.type} · {c.city}</p>
                      {c.price && <p className="text-xs text-amber-200 font-semibold">سعر: {c.price}</p>}
                      <button className="mt-2 text-xs bg-[#D4AF37] text-black px-2 py-1 rounded-md font-bold hover:bg-[#B8962D]">عرض التفاصيل</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-3 justify-start">
            <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 flex items-center gap-2 text-sm text-slate-300">
              <Loader2 className="w-4 h-4 animate-spin text-[#D4AF37]" />
              <span>جارٍ البحث عن صالونات قريبة...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </main>
      <footer className="sticky bottom-0 z-40 bg-[#0A0A0A]/95 backdrop-blur border-t border-white/10 px-4 py-3">
        <div className="max-w-3xl mx-auto flex gap-2 items-center">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder="اكتب نوع الصالون أو المنطقة..."
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:border-[#D4AF37] transition-colors"
          />
          <button onClick={send} disabled={loading || !input.trim()} className="bg-[#D4AF37] hover:bg-[#B8962D] text-black px-4 py-2.5 rounded-xl font-extrabold text-sm transition-all shadow-lg flex items-center gap-1 disabled:opacity-50">
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] text-slate-500 text-center mt-1">لا نشارك موقعك بدقة إلا بعد إذنك · بيانات الصالونات من قاعدة البيانات فقط</p>
      </footer>
    </div>
  );
}
