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
  ArrowRight,
  Plus,
  Send,
  Paperclip,
  X,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  FileText,
  Inbox,
  ShieldAlert,
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

const REPORT_STATUS: Record<string, { ar: string; en: string; cls: string }> = {
  pending: { ar: 'بانتظار المراجعة', en: 'Pending', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  reviewing: { ar: 'قيد المراجعة', en: 'Reviewing', cls: 'bg-violet-500/15 text-violet-300 border-violet-500/30' },
  resolved: { ar: 'تم الحل', en: 'Resolved', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  rejected: { ar: 'مرفوض', en: 'Rejected', cls: 'bg-slate-500/15 text-slate-300 border-slate-500/30' },
};

const REPORT_DECISION: Record<string, { ar: string; en: string; cls: string }> = {
  violation: { ar: 'مخالفة', en: 'Violation', cls: 'bg-red-500/15 text-red-300 border-red-500/30' },
  clean: { ar: 'سليم', en: 'Clean', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  escalate: { ar: 'يحتاج مراجعة', en: 'Needs review', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
};

const REPORT_CT: Record<string, { ar: string; en: string }> = {
  user_post: { ar: 'منشور مستخدم', en: 'User post' },
  salon_post: { ar: 'منشور صالون', en: 'Salon post' },
  comment: { ar: 'تعليق', en: 'Comment' },
  reel: { ar: 'ريلز', en: 'Reel' },
};

function formatDateTime(iso: string, isRtl: boolean): string {
  try {
    return new Date(iso).toLocaleString(isRtl ? 'ar-IQ' : 'en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
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

const SupportCenterView: React.FC<{ onNavigate?: (view: string) => void }> = ({ onNavigate }) => {
  const { language, isRtl } = useLanguage();
  const [mode, setMode] = useState<'list' | 'detail' | 'create' | 'report'>('list');
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<SupportTicketDetail | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [reportDetail, setReportDetail] = useState<any>(null);

  const loadTickets = async () => {
    setLoading(true);
    const [tRes, rRes] = await Promise.all([api.getMySupportTickets(), api.getMyContentReports()]);
    if (tRes.success) setTickets(tRes.tickets || []);
    if (rRes.success) setReports(rRes.reports || []);
    setLoading(false);
  };

  useEffect(() => {
    if (mode === 'list') loadTickets();
  }, [mode]);

  const openTicket = async (id: string) => {
    setSelectedId(id);
    setDetail(null);
    setMode('detail');
    setLoading(true);
    const res = await api.getSupportTicket(id);
    if (res.success && res.ticket) setDetail(res.ticket);
    setLoading(false);
  };

  const openReport = async (id: string) => {
    setSelectedReportId(id);
    setReportDetail(null);
    setMode('report');
    setLoading(true);
    const res = await api.getContentReport(id);
    if (res.success) setReportDetail(res);
    setLoading(false);
  };

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="min-h-screen bg-[#07090D] text-white">
      <div className="mx-auto max-w-2xl px-4 py-6">
        {mode === 'list' && (
          <ListView
            language={language}
            isRtl={isRtl}
            tickets={tickets}
            reports={reports}
            loading={loading}
            onOpen={openTicket}
            onOpenReport={openReport}
            onCreate={() => setMode('create')}
            onBack={() => onNavigate?.('profile')}
          />
        )}

        {mode === 'create' && (
          <CreateTicketView
            language={language}
            isRtl={isRtl}
            onCreated={(id) => openTicket(id)}
            onCancel={() => setMode('list')}
          />
        )}

        {mode === 'detail' && (
          <DetailView
            language={language}
            isRtl={isRtl}
            detail={detail}
            loading={loading}
            onBack={() => setMode('list')}
            onChanged={() => openTicket(selectedId!)}
          />
        )}

        {mode === 'report' && (
          <ReportDetailView
            language={language}
            isRtl={isRtl}
            data={reportDetail}
            loading={loading}
            onBack={() => setMode('list')}
          />
        )}
      </div>
    </div>
  );
};

const ListView: React.FC<{
  language: string;
  isRtl: boolean;
  tickets: SupportTicket[];
  reports: any[];
  loading: boolean;
  onOpen: (id: string) => void;
  onOpenReport: (id: string) => void;
  onCreate: () => void;
  onBack: () => void;
}> = ({ language, isRtl, tickets, reports, loading, onOpen, onOpenReport, onCreate, onBack }) => {
  const ar = language === 'ar';
  return (
    <>
      <div className="mb-5 flex items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 transition hover:text-white"
          aria-label={ar ? 'رجوع' : 'Back'}
        >
          {isRtl ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#D4AF37]/20 bg-[#D4AF37]/10">
            <LifeBuoy className="h-5 w-5 text-[#D4AF37]" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white">{ar ? 'صندوق الدعم' : 'Support Mail'}</h1>
            <p className="text-xs text-slate-500">
              {ar ? 'طلباتك وبلاغاتك مع فريق الدعم' : 'Your tickets and reports to the support team'}
            </p>
          </div>
        </div>
        <button
          onClick={onCreate}
          className="flex items-center gap-2 rounded-xl bg-[#D4AF37] px-3 py-2 text-sm font-bold text-black transition hover:bg-[#e6c049]"
        >
          <Plus size={16} />
          {ar ? 'طلب جديد' : 'New'}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : tickets.length === 0 && reports.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-white/[0.07] bg-white/[0.025] py-16 text-center">
          <Inbox className="h-10 w-10 text-slate-600" />
          <p className="text-sm text-slate-400">{ar ? 'لا توجد طلبات دعم أو بلاغات بعد' : 'No support tickets or reports yet'}</p>
          <button
            onClick={onCreate}
            className="mt-2 rounded-xl bg-[#D4AF37] px-4 py-2 text-sm font-bold text-black"
          >
            {ar ? 'أنشئ أول طلب' : 'Create your first ticket'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => {
            const st = STATUS_LABELS[t.status];
            return (
              <button
                key={t.id}
                onClick={() => onOpen(t.id)}
                className="group flex w-full items-start gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 text-right transition hover:border-[#D4AF37]/25 hover:bg-[#D4AF37]/[0.05]"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-lg border px-2 py-0.5 text-[10px] font-bold ${st.cls}`}>{ar ? st.ar : st.en}</span>
                    <span className="text-[10px] text-slate-500">
                      {TYPE_LABELS[t.type as SupportTicketType]?.[ar ? 'ar' : 'en']}
                    </span>
                  </div>
                  <p className="mt-1.5 truncate text-sm font-bold text-white">{t.subject}</p>
                  <p className="mt-0.5 line-clamp-1 text-xs text-slate-400">
                    {t.lastReplyPreview ? `${ar ? 'آخر رد: ' : 'Last reply: '}${t.lastReplyPreview}` : t.message}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-600">
                    #{t.id.slice(-6)} · {formatDateTime(t.updatedAt, isRtl)}
                  </p>
                </div>
                <span className="mt-1 text-slate-600 transition group-hover:text-[#D4AF37]">
                  {isRtl ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
                </span>
              </button>
            );
          })}

          {reports.length > 0 && (
            <div className="space-y-2 pt-1">
              <p className="text-[11px] font-bold text-slate-500">{ar ? 'بلاغاتي' : 'My reports'}</p>
              {reports.map((r) => {
                const st = REPORT_STATUS[r.status];
                const dec = REPORT_DECISION[r.aiDecision];
                return (
                  <button
                    key={r.id}
                    onClick={() => onOpenReport(r.id)}
                    className="group flex w-full items-start gap-3 rounded-2xl border border-[#D4AF37]/20 bg-[#D4AF37]/[0.04] p-3 text-right transition hover:border-[#D4AF37]/40 hover:bg-[#D4AF37]/[0.08]"
                  >
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#D4AF37]" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`rounded-md border px-1.5 py-0.5 text-[9px] font-bold ${st?.cls || ''}`}>
                          {st ? (ar ? st.ar : st.en) : r.status}
                        </span>
                        <span className="rounded-md border border-white/10 px-1.5 py-0.5 text-[9px] font-bold text-slate-300">
                          {REPORT_CT[r.contentType]?.[ar ? 'ar' : 'en'] || r.contentType}
                        </span>
                        {dec && (
                          <span className={`rounded-md border px-1.5 py-0.5 text-[9px] font-bold ${dec.cls}`}>
                            {ar ? dec.ar : dec.en}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 truncate text-sm font-bold text-white">{r.reason || '—'}</p>
                      <p className="mt-0.5 text-[10px] text-slate-500">#{r.id.slice(-6)}</p>
                    </div>
                    <span className="mt-1 text-slate-600 transition group-hover:text-[#D4AF37]">
                      {isRtl ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </>
  );
};

const CreateTicketView: React.FC<{
  language: string;
  isRtl: boolean;
  onCreated: (id: string) => void;
  onCancel: () => void;
}> = ({ language, isRtl, onCreated, onCancel }) => {
  const ar = language === 'ar';
  const [subject, setSubject] = useState('');
  const [type, setType] = useState<SupportTicketType>('bug');
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<SupportAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const onPickFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setUploading(true);
    const uploaded = await Promise.all(Array.from(files).map(uploadAttachment));
    const ok = uploaded.filter((u): u is SupportAttachment => !!u);
    setAttachments((prev) => [...prev, ...ok]);
    setUploading(false);
  };

  const submit = async () => {
    setError('');
    if (!subject.trim() || !message.trim()) {
      setError(ar ? 'العنوان والرسالة مطلوبان.' : 'Subject and message are required.');
      return;
    }
    setSending(true);
    const res = await api.createSupportTicket({
      subject: subject.trim(),
      type,
      message: message.trim(),
      attachments,
    });
    setSending(false);
    if (res.success && res.ticket) {
      onCreated(res.ticket.id);
    } else {
      setError(res.error || (ar ? 'تعذر إنشاء الطلب.' : 'Could not create the ticket.'));
    }
  };

  const types: SupportTicketType[] = ['bug', 'suggestion', 'complaint', 'other'];

  return (
    <>
      <div className="mb-5 flex items-center gap-3">
        <button
          onClick={onCancel}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 transition hover:text-white"
          aria-label={ar ? 'رجوع' : 'Back'}
        >
          {isRtl ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
        <h1 className="text-xl font-black text-white">{ar ? 'طلب دعم جديد' : 'New Support Ticket'}</h1>
      </div>

      <div className="space-y-4 rounded-3xl border border-white/[0.07] bg-white/[0.025] p-5">
        <div>
          <label className="mb-1 block text-xs font-bold text-slate-400">{ar ? 'نوع المشكلة' : 'Type'}</label>
          <div className="grid grid-cols-2 gap-2">
            {types.map((tp) => (
              <button
                key={tp}
                onClick={() => setType(tp)}
                className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${
                  type === tp
                    ? 'border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#D4AF37]'
                    : 'border-white/10 bg-white/[0.03] text-slate-400 hover:text-white'
                }`}
              >
                {TYPE_LABELS[tp][ar ? 'ar' : 'en']}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-bold text-slate-400">{ar ? 'العنوان' : 'Subject'}</label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={200}
            placeholder={ar ? 'مثال: لا يمكنني تغيير صورتي الشخصية' : 'e.g. I cannot change my profile photo'}
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-[#D4AF37]/40"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-bold text-slate-400">{ar ? 'الرسالة' : 'Message'}</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            placeholder={ar ? 'اشرح مشكلتك أو اقتراحك بالتفصيل...' : 'Describe your issue or suggestion in detail...'}
            className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-[#D4AF37]/40"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-bold text-slate-400">{ar ? 'المرفقات (صور)' : 'Attachments (images)'}</label>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => onPickFiles(e.target.files)}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-3 py-2.5 text-xs text-slate-400 transition hover:border-[#D4AF37]/30 hover:text-white"
          >
            <Paperclip size={15} />
            {uploading ? (ar ? 'جارٍ الرفع...' : 'Uploading...') : ar ? 'إرفاق صور' : 'Attach images'}
          </button>
          {attachments.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {attachments.map((a, i) => (
                <div key={i} className="relative h-16 w-16 overflow-hidden rounded-lg border border-white/10">
                  <img src={a.url} alt={a.name || 'attachment'} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                    className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/80 text-white"
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button
            onClick={submit}
            disabled={sending}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#D4AF37] px-4 py-2.5 text-sm font-bold text-black transition hover:bg-[#e6c049] disabled:opacity-60"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send size={15} />}
            {ar ? 'إرسال الطلب' : 'Send ticket'}
          </button>
          <button
            onClick={onCancel}
            className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-slate-400 transition hover:text-white"
          >
            {ar ? 'إلغاء' : 'Cancel'}
          </button>
        </div>
      </div>
    </>
  );
};

const DetailView: React.FC<{
  language: string;
  isRtl: boolean;
  detail: SupportTicketDetail | null;
  loading: boolean;
  onBack: () => void;
  onChanged: () => void;
}> = ({ language, isRtl, detail, loading, onBack, onChanged }) => {
  const ar = language === 'ar';
  const [reply, setReply] = useState('');
  const [attachments, setAttachments] = useState<SupportAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const onPickFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setUploading(true);
    const uploaded = await Promise.all(Array.from(files).map(uploadAttachment));
    const ok = uploaded.filter((u): u is SupportAttachment => !!u);
    setAttachments((prev) => [...prev, ...ok]);
    setUploading(false);
  };

  const sendReply = async () => {
    if (!reply.trim()) return;
    setSending(true);
    const res = await api.replyToSupportTicket(detail!.id, reply.trim(), attachments);
    setSending(false);
    if (res.success) {
      setReply('');
      setAttachments([]);
      onChanged();
    }
  };

  if (loading && !detail) {
    return (
      <div className="flex justify-center py-16 text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (!detail) {
    return (
      <div className="py-16 text-center text-slate-400">
        <p className="mb-3 text-sm">{ar ? 'تعذر تحميل الطلب.' : 'Could not load the ticket.'}</p>
        <button onClick={onBack} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white">
          {ar ? 'رجوع' : 'Back'}
        </button>
      </div>
    );
  }

  const st = STATUS_LABELS[detail.status];

  return (
    <>
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 transition hover:text-white"
          aria-label={ar ? 'رجوع' : 'Back'}
        >
          {isRtl ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-black text-white">{detail.subject}</h1>
          <p className="text-[11px] text-slate-500">
            #{detail.id.slice(-6)} · {ar ? TYPE_LABELS[detail.type as SupportTicketType].ar : TYPE_LABELS[detail.type as SupportTicketType].en}
          </p>
        </div>
        <span className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold ${st.cls}`}>
          {ar ? st.ar : st.en}
        </span>
      </div>

      <div className="space-y-4">
        {detail.adminNote && (
          <div className="rounded-2xl border border-[#D4AF37]/20 bg-[#D4AF37]/[0.06] p-4">
            <p className="mb-1 text-[11px] font-bold text-[#D4AF37]">
              {ar ? 'ملاحظات فريق الدعم' : 'Support team notes'}
            </p>
            <p className="whitespace-pre-wrap text-sm text-slate-200">{detail.adminNote}</p>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {detail.attachments.map((a, i) => (
            <a key={i} href={a.url} target="_blank" rel="noreferrer" className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black/30">
              <img src={a.url} alt={a.name || 'attachment'} className="h-full w-full object-cover" />
            </a>
          ))}
        </div>

        <div className="space-y-3">
          {detail.messages.map((m) => {
            const isUser = m.senderRole === 'user';
            return (
              <div key={m.id} className={`flex ${isRtl ? (isUser ? 'justify-start' : 'justify-end') : isUser ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 ${
                    isUser
                      ? 'bg-[#D4AF37] text-black'
                      : 'border border-white/10 bg-white/[0.04] text-white'
                  }`}
                >
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
                    {formatDateTime(m.createdAt, isRtl)} · {isUser ? (ar ? 'أنت' : 'You') : ar ? 'الدعم' : 'Support'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {detail.status !== 'closed' && detail.status !== 'resolved' && (
          <div className="sticky bottom-0 space-y-2 border-t border-white/[0.07] bg-[#07090D] pt-3">
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
                placeholder={ar ? 'اكتب ردًا...' : 'Write a reply...'}
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
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {attachments.map((a, i) => (
                  <div key={i} className="relative h-12 w-12 overflow-hidden rounded-md border border-white/10">
                    <img src={a.url} alt="" className="h-full w-full object-cover" />
                    <button
                      onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}
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
        )}
      </div>
    </>
  );
};

const ReportDetailView: React.FC<{
  language: string;
  isRtl: boolean;
  data: any;
  loading: boolean;
  onBack: () => void;
}> = ({ language, isRtl, data, loading, onBack }) => {
  const ar = language === 'ar';
  if (loading && !data) {
    return (
      <div className="flex justify-center py-16 text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (!data || !data.report) {
    return (
      <div className="py-16 text-center text-slate-400">
        <p className="mb-3 text-sm">{ar ? 'تعذر تحميل البلاغ.' : 'Could not load the report.'}</p>
        <button onClick={onBack} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white">
          {ar ? 'رجوع' : 'Back'}
        </button>
      </div>
    );
  }

  const report = data.report;
  const snapshot = data.snapshot || {};
  const st = REPORT_STATUS[report.status];
  const dec = report.aiDecision ? REPORT_DECISION[report.aiDecision] : null;

  return (
    <>
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 transition hover:text-white"
          aria-label={ar ? 'رجوع' : 'Back'}
        >
          {isRtl ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-black text-white">{ar ? 'تفاصيل البلاغ' : 'Report details'}</h1>
          <p className="text-[11px] text-slate-500">
            #{report.id.slice(-6)} · {REPORT_CT[report.contentType]?.[ar ? 'ar' : 'en'] || report.contentType}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {st && <span className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold ${st.cls}`}>{ar ? st.ar : st.en}</span>}
          {dec && <span className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold ${dec.cls}`}>{ar ? dec.ar : dec.en}</span>}
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl border border-white/[0.07] bg-black/20 p-3 text-xs text-slate-300">
          <p><span className="text-slate-500">{ar ? 'سبب البلاغ: ' : 'Report reason: '}</span> {report.reason || '—'}</p>
          {report.contentOwnerName && (
            <p><span className="text-slate-500">{ar ? 'صاحب المحتوى: ' : 'Content owner: '}</span> {report.contentOwnerName}</p>
          )}
          {report.details && (
            <p className="mt-1 whitespace-pre-wrap text-slate-200"><span className="text-slate-500">{ar ? 'تفاصيل: ' : 'Details: '}</span>{report.details}</p>
          )}
          {snapshot?.text && (
            <p className="mt-2 whitespace-pre-wrap text-slate-200"><span className="text-slate-500">{ar ? 'نص المحتوى المبلّغ عنه: ' : 'Reported content: '}</span>{snapshot.text}</p>
          )}
          {snapshot?.mediaUrl && (
            <img src={snapshot.mediaUrl} alt="" className="mt-2 max-h-48 rounded-lg border border-white/10" />
          )}
        </div>

        {report.adminNote && (
          <div className="rounded-2xl border border-[#D4AF37]/20 bg-[#D4AF37]/[0.06] p-4">
            <p className="mb-1 text-[11px] font-bold text-[#D4AF37]">{ar ? 'ملاحظة فريق الدعم' : 'Support team note'}</p>
            <p className="whitespace-pre-wrap text-sm text-slate-200">{report.adminNote}</p>
          </div>
        )}

        {(!report.aiDecision) && (
          <p className="text-center text-[11px] text-slate-500">
            {ar ? 'البلاغ قيد المعالجة الآلية والمراجعة.' : 'The report is being processed automatically and reviewed.'}
          </p>
        )}
      </div>
    </>
  );
};

export default SupportCenterView;
