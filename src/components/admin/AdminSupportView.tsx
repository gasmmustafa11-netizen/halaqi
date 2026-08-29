import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { api } from '../../services/api';
import {
  SupportTicket,
  SupportTicketDetail,
  SupportTicketStatus,
  SupportTicketType,
  SupportAttachment,
} from '../../types';
import {
  LifeBuoy,
  Search,
  Send,
  Paperclip,
  X,
  Loader2,
  Image as ImageIcon,
  CheckCircle2,
} from 'lucide-react';

const STATUS_LABELS: Record<SupportTicketStatus, { ar: string; en: string; cls: string }> = {
  new: { ar: 'جديد', en: 'New', cls: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
  reviewing: { ar: 'قيد المراجعة', en: 'Reviewing', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  processing: { ar: 'جاري المعالجة', en: 'Processing', cls: 'bg-violet-500/15 text-violet-300 border-violet-500/30' },
  resolved: { ar: 'تم الحل', en: 'Resolved', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  closed: { ar: 'مغلق', en: 'Closed', cls: 'bg-slate-500/15 text-slate-300 border-slate-500/30' },
};

const TYPE_LABELS: Record<SupportTicketType, { ar: string; en: string }> = {
  bug: { ar: 'مشكلة تقنية', en: 'Technical issue' },
  suggestion: { ar: 'اقتراح', en: 'Suggestion' },
  complaint: { ar: 'شكوى', en: 'Complaint' },
  other: { ar: 'أخرى', en: 'Other' },
};

const STATUS_OPTIONS: SupportTicketStatus[] = ['new', 'reviewing', 'processing', 'resolved', 'closed'];

function formatDateTime(iso: string, isRtl: boolean): string {
  try {
    return new Date(iso).toLocaleString(isRtl ? 'ar-IQ' : 'en-US', {
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function uploadAttachment(file: File): Promise<SupportAttachment | null> {
  try {
    const dataUrl = await readFileAsDataUrl(file);
    const token = typeof window !== 'undefined' ? localStorage.getItem('halaqi_auth_token') : null;
    const res = await fetch('/api/uploads/image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ dataUrl }),
    });
    const data = await res.json().catch(() => ({}));
    if (data?.success && data?.imageUrl) {
      return { url: data.imageUrl, type: file.type, name: file.name };
    }
    return null;
  } catch {
    return null;
  }
}

const AdminSupportView: React.FC<{ onNavigate?: (view: string) => void }> = () => {
  const { language, isRtl } = useLanguage();
  const ar = language === 'ar';
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const [detail, setDetail] = useState<SupportTicketDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reply, setReply] = useState('');
  const [replyAttachments, setReplyAttachments] = useState<SupportAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<SupportTicketStatus>('new');
  const [savingNote, setSavingNote] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadList = async (overrides?: { search?: string; status?: string }) => {
    setLoading(true);
    const s = overrides?.search !== undefined ? overrides.search : search;
    const st = overrides?.status !== undefined ? overrides.status : statusFilter;
    const res = await api.adminListSupportTickets({ search: s || undefined, status: st || undefined });
    if (res.success) setTickets(res.tickets || []);
    setLoading(false);
  };

  useEffect(() => {
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openTicket = async (id: string) => {
    setDetail(null);
    setDetailLoading(true);
    const res = await api.adminGetSupportTicket(id);
    if (res.success && res.ticket) {
      setDetail(res.ticket);
      setNote(res.ticket.adminNote || '');
      setStatus(res.ticket.status);
      setReply('');
      setReplyAttachments([]);
    }
    setDetailLoading(false);
  };

  const onPickFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setUploading(true);
    const uploaded = await Promise.all(Array.from(files).map(uploadAttachment));
    const ok = uploaded.filter((u): u is SupportAttachment => !!u);
    setReplyAttachments((prev) => [...prev, ...ok]);
    setUploading(false);
  };

  const sendReply = async () => {
    if (!detail || !reply.trim()) return;
    setSending(true);
    const res = await api.adminReplySupportTicket(detail.id, reply.trim(), replyAttachments);
    setSending(false);
    if (res.success) {
      setReply('');
      setReplyAttachments([]);
      openTicket(detail.id);
      loadList();
    }
  };

  const changeStatus = async (next: SupportTicketStatus) => {
    if (!detail) return;
    setStatus(next);
    const res = await api.adminUpdateSupportTicketStatus(detail.id, next);
    if (res.success) {
      openTicket(detail.id);
      loadList();
    } else {
      setStatus(detail.status);
    }
  };

  const saveNote = async () => {
    if (!detail) return;
    setSavingNote(true);
    const res = await api.adminUpdateSupportTicketNote(detail.id, note);
    setSavingNote(false);
    if (res.success) {
      openTicket(detail.id);
      loadList();
    }
  };

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="grid gap-5 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
      {/* LIST */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadList()}
              placeholder={ar ? 'بحث بالعنوان أو المستخدم' : 'Search subject or user'}
              className="w-full rounded-xl border border-white/10 bg-black/30 py-2.5 pl-9 pr-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-[#D4AF37]/40"
            />
          </div>
          <button
            onClick={() => loadList()}
            className="rounded-xl bg-[#D4AF37] px-3 py-2.5 text-sm font-bold text-black"
          >
            {ar ? 'بحث' : 'Search'}
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => { setStatusFilter(''); loadList({ status: '' }); }}
            className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold transition ${
              !statusFilter ? 'border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#D4AF37]' : 'border-white/10 text-slate-400 hover:text-white'
            }`}
          >
            {ar ? 'الكل' : 'All'}
          </button>
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); loadList({ status: s }); }}
              className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold transition ${
                statusFilter === s ? 'border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#D4AF37]' : 'border-white/10 text-slate-400 hover:text-white'
              }`}
            >
              {ar ? STATUS_LABELS[s].ar : STATUS_LABELS[s].en}
            </button>
          ))}
        </div>

        <div className="max-h-[70vh] space-y-2 overflow-y-auto scrollbar-hide">
          {loading ? (
            <div className="flex justify-center py-10 text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : tickets.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] py-10 text-center text-sm text-slate-400">
              {ar ? 'لا توجد طلبات مطابقة' : 'No matching tickets'}
            </div>
          ) : (
            tickets.map((t) => {
              const st = STATUS_LABELS[t.status];
              const active = detail?.id === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => openTicket(t.id)}
                  className={`flex w-full items-start gap-3 rounded-2xl border p-3 text-right transition ${
                    active ? 'border-[#D4AF37]/40 bg-[#D4AF37]/[0.08]' : 'border-white/[0.07] bg-white/[0.025] hover:border-[#D4AF37]/20'
                  }`}
                >
                  {t.userAvatar ? (
                    <img src={t.userAvatar} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#D4AF37]/15 text-xs font-bold text-[#D4AF37]">
                      {(t.userFullName || t.userUsername || '؟').charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-md border px-1.5 py-0.5 text-[9px] font-bold ${st.cls}`}>{ar ? st.ar : st.en}</span>
                    </div>
                    <p className="mt-1 truncate text-sm font-bold text-white">{t.subject}</p>
                    <p className="truncate text-[11px] text-slate-400">
                      {t.userFullName || t.userUsername || '—'} · {formatDateTime(t.updatedAt, isRtl)}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* DETAIL */}
      <div className="rounded-3xl border border-white/[0.07] bg-white/[0.025] p-5">
        {detailLoading && !detail ? (
          <div className="flex justify-center py-16 text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : !detail ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center text-slate-500">
            <LifeBuoy className="h-10 w-10 text-slate-700" />
            <p className="text-sm">{ar ? 'اختر طلبًا من القائمة' : 'Select a ticket from the list'}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2">
                <span className={`rounded-lg border px-2 py-0.5 text-[10px] font-bold ${STATUS_LABELS[detail.status].cls}`}>
                  {ar ? STATUS_LABELS[detail.status].ar : STATUS_LABELS[detail.status].en}
                </span>
                <span className="text-[11px] text-slate-500">{ar ? TYPE_LABELS[detail.type as SupportTicketType].ar : TYPE_LABELS[detail.type as SupportTicketType].en}</span>
              </div>
              <h2 className="mt-2 text-lg font-black text-white">{detail.subject}</h2>
              <p className="text-[11px] text-slate-500">
                #{detail.id.slice(-6)} · {detail.userFullName || detail.userUsername || '—'} · {formatDateTime(detail.createdAt, isRtl)}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-400">{ar ? 'الحالة' : 'Status'}</label>
              <select
                value={status}
                onChange={(e) => changeStatus(e.target.value as SupportTicketStatus)}
                className="flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-[#D4AF37]/40"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s} className="bg-[#141414]">
                    {ar ? STATUS_LABELS[s].ar : STATUS_LABELS[s].en}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-400">{ar ? 'ملاحظة داخلية (للإدارة)' : 'Internal note (admin only)'}</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder={ar ? 'ملاحظات خاصة بفريق الدعم' : 'Private notes for the support team'}
                className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-[#D4AF37]/40"
              />
              <button
                onClick={saveNote}
                disabled={savingNote}
                className="mt-1.5 flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-1.5 text-xs font-bold text-slate-300 transition hover:text-white disabled:opacity-60"
              >
                {savingNote ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                {ar ? 'حفظ الملاحظة' : 'Save note'}
              </button>
            </div>

            <div className="space-y-3 border-t border-white/[0.07] pt-3">
              {detail.messages.map((m) => {
                const isUser = m.senderRole === 'user';
                return (
                  <div key={m.id} className={`flex ${isRtl ? (isUser ? 'justify-start' : 'justify-end') : isUser ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 ${isUser ? 'bg-[#D4AF37] text-black' : 'border border-white/10 bg-white/[0.04] text-white'}`}>
                      <p className="whitespace-pre-wrap text-sm">{m.message}</p>
                      {m.attachments && m.attachments.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {m.attachments.map((a, i) => (
                            <a key={i} href={a.url} target="_blank" rel="noreferrer" className="block h-14 w-14 overflow-hidden rounded-md border border-black/10">
                              <img src={a.url} alt={a.name || 'attachment'} className="h-full w-full object-cover" />
                            </a>
                          ))}
                        </div>
                      )}
                      <p className={`mt-1 text-[10px] ${isUser ? 'text-black/60' : 'text-slate-500'}`}>
                        {formatDateTime(m.createdAt, isRtl)} · {isUser ? (ar ? 'المستخدم' : 'User') : ar ? 'الدعم' : 'Support'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="space-y-2 border-t border-white/[0.07] pt-3">
              <div className="flex items-end gap-2">
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 transition hover:text-white"
                  aria-label={ar ? 'إرفاق صورة' : 'Attach image'}
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon size={18} />}
                </button>
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  rows={1}
                  placeholder={ar ? 'اكتب ردًا باسم الدعم...' : 'Write a reply as support...'}
                  className="max-h-32 min-h-[44px] flex-1 resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-[#D4AF37]/40"
                />
                <button
                  onClick={sendReply}
                  disabled={sending || !reply.trim()}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#D4AF37] text-black transition hover:bg-[#e6c049] disabled:opacity-60"
                  aria-label={ar ? 'إرسال' : 'Send'}
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send size={17} />}
                </button>
              </div>
              {replyAttachments.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {replyAttachments.map((a, i) => (
                    <div key={i} className="relative h-12 w-12 overflow-hidden rounded-md border border-white/10">
                      <img src={a.url} alt="" className="h-full w-full object-cover" />
                      <button
                        onClick={() => setReplyAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                        className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-black/80 text-white"
                      >
                        <X size={9} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => onPickFiles(e.target.files)} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminSupportView;
