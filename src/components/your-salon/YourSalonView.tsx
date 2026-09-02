import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Send, MapPin, Star, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { aiSalonChat } from '../../services/aiSalon';
import { api } from '../../services/api';

interface Msg { id: number; role: 'user' | 'ai'; text: string; cards?: any[]; time: string; }

export default function YourSalonView({ onBack, onSelectSalonId }: { onBack: () => void; onSelectSalonId: (salonId: string) => void }) {
  const [input, setInput] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>([
    { id: 1, role: 'ai', text: 'مرحباً! أنا مساعد صالونات Halaqi الذكي. كيف يمكنني مساعدتك اليوم؟ مثال: "أريد صالون قريب يفصل فايد بسعر حول 10,000 دينار".', time: new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' }) },
  ]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Booking integration states
  const [bookingMode, setBookingMode] = useState(false);
  const [selectedSalonId, setSelectedSalonId] = useState<string | null>(null);
  const [bookingFields, setBookingFields] = useState<{ salonId?: string; serviceId?: string; serviceName?: string; date?: string; timeSlot?: string; price?: number }>({});
  const [bookingConfirmMsg, setBookingConfirmMsg] = useState('');
  const [bookingError, setBookingError] = useState('');
  const [bookingServices, setBookingServices] = useState<any[]>([]);
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

  const tryProcessBooking = async () => {
    if (!bookingMode) return;
    setBookingError('');
    const userTexts = msgs.filter(m => m.role === 'user').map(m => m.text);
    const lastUser = userTexts[userTexts.length - 1] || '';
    // Extract salon from cards or text
    let salonId = selectedSalonId || bookingFields.salonId || null;
    if (!salonId && lastUser) {
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].cards && msgs[i].cards.length > 0) {
          for (const card of msgs[i].cards) {
            const name = (card.name || '').toString();
            if (name && lastUser.includes(name)) {
              salonId = card.id || salonId;
              setSelectedSalonId(salonId);
              setBookingFields(prev => ({ ...prev, salonId }));
              break;
            }
          }
        }
        if (salonId) break;
      }
    }
    if (!salonId) return; // Need salon first
    // Fetch services if needed
    if (!bookingServices.length || !bookingFields.serviceId) {
      try {
        const svcs = await api.getServices(salonId);
        setBookingServices(svcs || []);
      } catch (e) { /* ignore */ }
    }
    // Extract service from text or previous selection
    let serviceId = bookingFields.serviceId;
    let serviceName = bookingFields.serviceName;
    if (!serviceId && bookingServices.length > 0 && lastUser) {
      for (const s of bookingServices) {
        const sName = (s.name || '').toString();
        if (lastUser.includes(sName)) {
          serviceId = s.id;
          serviceName = s.name;
          setBookingFields(prev => ({ ...prev, serviceId, serviceName }));
          break;
        }
      }
    }
    // Extract date (YYYY-MM-DD or Arabic digits with separators)
    let date = bookingFields.date;
    if (!date) {
      const dMatch = lastUser.match(/(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
      if (dMatch) date = `${dMatch[1]}-${dMatch[2].padStart(2,'0')}-${dMatch[3].padStart(2,'0')}`;
      else {
        const ar = lastUser.match(/(\d{1,2})[\s\/\-]*(\d{1,2})[\s\/\-]*(\d{4})/);
        if (ar) date = `${ar[3]}-${ar[2].padStart(2,'0')}-${ar[1].padStart(2,'0')}`;
      }
      if (date) setBookingFields(prev => ({ ...prev, date }));
    }
    // Extract time (HH:MM)
    let timeSlot = bookingFields.timeSlot;
    if (!timeSlot) {
      const tMatch = lastUser.match(/(\d{1,2}):(\d{2})/);
      if (tMatch) timeSlot = `${tMatch[1].padStart(2,'0')}:${tMatch[2]}`;
      if (timeSlot) setBookingFields(prev => ({ ...prev, timeSlot }));
    }
    // If all present and user just provided them, confirm and submit
    if (salonId && serviceId && date && timeSlot) {
      setBookingConfirmMsg('تم جمع البيانات، تم الحجز...');
      await submitBooking({ salonId, serviceId, date, timeSlot });
    }
  };

  const submitBooking = async (fields: { salonId: string; serviceId: string; date: string; timeSlot: string }) => {
    setLoading(true);
    setBookingError('');
    try {
      // Verify salon exists via API or use current cards
      const salon = (msgs.map(m => m.cards).flat() || []).find((c: any) => c.id === fields.salonId);
      const service = bookingServices.find((s: any) => s.id === fields.serviceId);
      const price = service?.price ?? 0;
      const payload = {
        salonId: fields.salonId,
        serviceId: fields.serviceId,
        date: fields.date,
        timeSlot: fields.timeSlot,
        // customer details from auth server-side via requireAuth
      };
      // Check availability via occupied slots endpoint first (optional quick check)
      try {
        const occ = await api.getOccupiedSlots(fields.salonId, fields.date);
        // We don't enforce here; server booking endpoint validates fully
      } catch(e){}
      const res = await api.createBooking(payload);
      if (res.success && res.booking) {
        const b = res.booking as any;
        setBookingConfirmMsg('');
        setBookingFields({});
        setBookingMode(false);
        setBookingError('');
        // Send confirmation AI message with real booking data
        const confirmText = `تم الحجز بنجاح ✅\nالصالون: ${b.salonName || fields.salonId}\nالتاريخ: ${b.date || fields.date}\nالساعة: ${b.timeSlot || fields.timeSlot}\nالخدمة: ${b.serviceName || fields.serviceId}\nالصالون بانتظارك بالموعد المحدد.\n\nعند وصولك للصالون، أظهر رمز QR الخاص بالحجز للحلاق لإتمام الخدمة.`;
        setMsgs(prev => [...prev, { id: Date.now(), role: 'ai', text: confirmText, time: new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' }) }]);
        setBookingConfirmMsg('');
        // Note: notifications already handled by server; we do not send extra notifications here.
      } else {
        const errMsg = res.error || 'تعذر الحجز';
        let errorText = '';
        if (errMsg.includes('401') || errMsg.includes('login') || errMsg.includes('تسجيل')) {
          errorText = 'يرجى تسجيل الدخول أولاً لإتمام الحجز.';
        } else if (errMsg.includes('400') || errMsg.includes('ناقص') || errMsg.includes('بيانات')) {
          errorText = 'البيانات ناقصة أو غير صحيحة، يرجى التأكد من الصالون والخدمة والتاريخ والساعة.';
        } else if (errMsg.includes('409') || errMsg.includes('غير متاح')) {
          errorText = 'الموعد غير متاح، يرجى اختيار وقت آخر.';
        } else if (errMsg.includes('500') || errMsg.includes('خطأ')) {
          errorText = 'حدث خطأ في الخادم، حاول لاحقاً.';
        } else {
          errorText = errMsg;
        }
        setBookingError(errorText);
        setMsgs(prev => [...prev, { id: Date.now(), role: 'ai', text: errorText, time: new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' }) }]);
      }
    } catch (e: any) {
      const msg = (e.message || '').includes('401') || (e.message || '').includes('login') ? 'يرجى تسجيل الدخول أولاً لإتمام الحجز.' : 'حدث خطأ في الحجز، يرجى المحاولة مرة أخرى.';
      setBookingError(msg);
      setMsgs(prev => [...prev, { id: Date.now(), role: 'ai', text: msg, time: new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' }) }]);
    } finally {
      setLoading(false);
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const userMsg: Msg = { id: Date.now(), role: 'user', text, time: new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' }) };
    setMsgs((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    if (bookingMode) {
      // Try extracting from previous context; will process after AI response
      setTimeout(() => tryProcessBooking(), 400);
    }
    try {
      const history = msgs.map((m) => ({ role: m.role, text: m.text }));
      const data = await aiSalonChat({ message: text, regionConsent: false, conversationHistory: history, conversationState });
      const aiMsg: Msg = { id: Date.now() + 1, role: 'ai', text: data.reply || 'لا توجد نتائج حالياً.', cards: data.cards || [], time: new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' }) };
      setMsgs((prev) => [...prev, aiMsg]);
      // Update conversation state from AI response (only when user explicitly selects or context already set)
      setConversationState((prev) => {
        const next = { ...prev };
        // Only resolve salon when user explicitly selected via card click (handled by onSelectSalonId prop) or when conversationState from server indicates a selected salon.
        // Never auto-assign cards[0] as selected salon just because it is first.
        if (data.cards && data.cards.length === 1 && !prev.salonId && data.cards[0].id && prev.salonName === (data.cards[0].name || '')) {
          // Only apply if conversation context already points to this salon name (clear disambiguation)
          next.salonId = data.cards[0].id;
          next.salonName = data.cards[0].name || prev.salonName;
          next.lastResolvedContext = `صالون مختار من السياق: ${data.cards[0].name || ''}`;
        }
        return next;
      });
      // Detect booking request from AI or user context
      const textLower = (data.reply || '').toLowerCase();
      if (textLower.includes('حجز') || textLower.includes('احجز') || textLower.includes('موعد') || textLower.includes('كتاب')) {
        setBookingMode(true);
      }
      if (bookingMode) {
        setTimeout(() => tryProcessBooking(), 300);
      }
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
                    <button type="button" key={idx} className="w-full text-right block rounded-xl bg-[#16121A] border border-white/10 p-3 hover:border-[#D4AF37]/60 transition" onClick={() => { if (card.id) onSelectSalonId(card.id); }}>
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
