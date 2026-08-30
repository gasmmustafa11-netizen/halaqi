import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { api } from '../../services/api';
import {
  ShieldAlert,
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Bot,
  CheckCircle2,
  RotateCcw,
  EyeOff,
  Trash2,
  AlertTriangle,
  UserX,
  ShieldCheck,
} from 'lucide-react';
import { ModerationCategory, ModerationDecision } from '../../types';

const CT_LABELS: Record<string, { ar: string; en: string }> = {
  user: { ar: 'حساب مستخدم', en: 'User Account' },
  user_post: { ar: 'منشور مستخدم', en: 'User post' },
  salon_post: { ar: 'منشور صالون', en: 'Salon post' },
  comment: { ar: 'تعليق', en: 'Comment' },
  reel: { ar: 'ريلز', en: 'Reel' },
};

const DECISION_LABELS: Record<ModerationDecision, { ar: string; en: string; cls: string }> = {
  violation: { ar: 'مخالفة', en: 'Violation', cls: 'bg-red-500/15 text-red-300 border-red-500/30' },
  clean: { ar: 'سليم', en: 'Clean', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  escalate: { ar: 'يحتاج مراجعة', en: 'Needs review', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
};

const SEVERITY_LABELS: Record<string, { ar: string; en: string; cls: string }> = {
  high: { ar: 'عالية', en: 'High', cls: 'text-red-300' },
  medium: { ar: 'متوسطة', en: 'Medium', cls: 'text-amber-300' },
  low: { ar: 'منخفضة', en: 'Low', cls: 'text-slate-300' },
};

const CAT_LABELS: Record<ModerationCategory, { ar: string; en: string }> = {
  hate_sectarian: { ar: 'كراهية وطائفية', en: 'Hate / sectarian' },
  incitement_violence: { ar: 'تحريض على العنف', en: 'Incitement to violence' },
  threat_violence: { ar: 'تهديد وعنف', en: 'Threat / violence' },
  harassment_bullying: { ar: 'تنمر وتحرش', en: 'Harassment / bullying' },
  sexual_inappropriate: { ar: 'محتوى جنسي', en: 'Sexual / inappropriate' },
  scam_fraud: { ar: 'احتيال وخداع', en: 'Scam / fraud' },
  spam: { ar: 'سبام', en: 'Spam' },
  impersonation: { ar: 'انتحال شخصية', en: 'Impersonation' },
  illegal_dangerous: { ar: 'محتوى غير قانوني', en: 'Illegal / dangerous' },
  doxxing: { ar: 'نشر معلومات حساسة', en: 'Doxxing' },
  policy_violation: { ar: 'مخالفة سياسات', en: 'Policy violation' },
  other: { ar: 'أخرى', en: 'Other' },
};

const STATUS_LABELS: Record<string, { ar: string; en: string }> = {
  pending: { ar: 'بانتظار المراجعة', en: 'Pending' },
  reviewing: { ar: 'قيد المراجعة', en: 'Reviewing' },
  resolved: { ar: 'تم الحل', en: 'Resolved' },
  rejected: { ar: 'مرفوض', en: 'Rejected' },
};

function pct(n: number | undefined): string {
  if (n === undefined || isNaN(n)) return '—';
  return `${Math.round(n * 100)}%`;
}

const AdminModerationView: React.FC<{ onNavigate?: (view: string) => void }> = () => {
  const { language, isRtl } = useLanguage();
  const ar = language === 'ar';
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [decisionFilter, setDecisionFilter] = useState('');
  const [search, setSearch] = useState('');

  const [selected, setSelected] = useState<any>(null);
  const [detail, setDetail] = useState<{ report: any; snapshot: any; logs: any[] } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [adminNote, setAdminNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await api.getAdminModerationReports({
      status: statusFilter || undefined,
      decision: decisionFilter || undefined,
      search: search || undefined,
    });
    if (res.success) setReports(res.reports || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const open = async (report: any) => {
    setSelected(report);
    setDetail(null);
    setDetailLoading(true);
    const res = await api.getAdminModerationReportDetail(report.id);
    if (res.success) {
      setDetail({ report: res.report, snapshot: res.snapshot, logs: res.logs || [] });
      setAdminNote((res.report as any)?.adminNote || '');
    }
    setDetailLoading(false);
  };

  const act = async (payload: any) => {
    if (!selected) return;
    setBusy(true);
    const res = await api.adminUpdateModerationReport(selected.id, payload);
    setBusy(false);
    if (res.success) {
      await open(selected);
      load();
    }
  };

  const decision = (selected && detail?.report?.aiDecision) || (selected as any)?.aiDecision;
  const isViolation = decision === 'violation';
  const isAi = detail?.logs?.some((l: any) => l.model && l.model !== 'admin');

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="grid gap-5 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      {/* LIST */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && load()}
              placeholder={ar ? 'بحث بالسبب أو المعرّف' : 'Search by reason or id'}
              className="w-full rounded-xl border border-white/10 bg-black/30 py-2.5 pl-9 pr-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-[#D4AF37]/40"
            />
          </div>
          <button onClick={load} className="rounded-xl bg-[#D4AF37] px-3 py-2.5 text-sm font-bold text-black">
            {ar ? 'بحث' : 'Search'}
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {[
            { v: '', l: ar ? 'الكل' : 'All' },
            { v: 'pending', l: STATUS_LABELS.pending[ar ? 'ar' : 'en'] },
            { v: 'resolved', l: STATUS_LABELS.resolved[ar ? 'ar' : 'en'] },
            { v: 'rejected', l: STATUS_LABELS.rejected[ar ? 'ar' : 'en'] },
          ].map((s) => (
            <button
              key={`s-${s.v}`}
              onClick={() => { setStatusFilter(s.v); }}
              className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold transition ${
                statusFilter === s.v ? 'border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#D4AF37]' : 'border-white/10 text-slate-400 hover:text-white'
              }`}
            >
              {s.l}
            </button>
          ))}
          {(['violation', 'clean', 'escalate'] as ModerationDecision[]).map((d) => (
            <button
              key={`d-${d}`}
              onClick={() => { setDecisionFilter(d); }}
              className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold transition ${
                decisionFilter === d ? `border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#D4AF37]` : 'border-white/10 text-slate-400 hover:text-white'
              }`}
            >
              {DECISION_LABELS[d][ar ? 'ar' : 'en']}
            </button>
          ))}
        </div>

        <div className="max-h-[70vh] space-y-2 overflow-y-auto scrollbar-hide">
          {loading ? (
            <div className="flex justify-center py-10 text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : reports.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] py-10 text-center text-sm text-slate-400">
              {ar ? 'لا توجد بلاغات مطابقة' : 'No matching reports'}
            </div>
          ) : (
            reports.map((r) => {
              const dec = r.aiDecision as ModerationDecision;
              const dLabel = dec ? DECISION_LABELS[dec] : null;
              const active = selected?.id === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => open(r)}
                  className={`flex w-full items-start gap-3 rounded-2xl border p-3 text-right transition ${
                    active ? 'border-[#D4AF37]/40 bg-[#D4AF37]/[0.08]' : 'border-white/[0.07] bg-white/[0.025] hover:border-[#D4AF37]/20'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded-md border border-white/10 px-1.5 py-0.5 text-[9px] font-bold text-slate-300">
                        {CT_LABELS[r.contentType]?.[ar ? 'ar' : 'en'] || r.contentType}
                      </span>
                      {dLabel && (
                        <span className={`rounded-md border px-1.5 py-0.5 text-[9px] font-bold ${dLabel.cls}`}>{dLabel[ar ? 'ar' : 'en']}</span>
                      )}
                      {r.model && r.model !== 'admin' && (
                        <span className="flex items-center gap-1 rounded-md border border-violet-500/30 bg-violet-500/10 px-1.5 py-0.5 text-[9px] font-bold text-violet-300">
                          <Bot className="h-3 w-3" /> AI
                        </span>
                      )}
                    </div>
                    <p className="mt-1 truncate text-sm font-bold text-white">{r.reason || '—'}</p>
                    <p className="truncate text-[11px] text-slate-400">
                      {r.reporterName || r.reporterId} · {pct(r.confidence)}
                      {r.severity ? ` · ${SEVERITY_LABELS[r.severity]?.[ar ? 'ar' : 'en'] || r.severity}` : ''}
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
            <ShieldAlert className="h-10 w-10 text-slate-700" />
            <p className="text-sm">{ar ? 'اختر بلاغًا من القائمة' : 'Select a report from the list'}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-white">
                    {CT_LABELS[detail.report.contentType]?.[ar ? 'ar' : 'en'] || detail.report.contentType}
                  </span>
                  {isAi && (
                    <span className="flex items-center gap-1 rounded-md border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold text-violet-300">
                      <Bot className="h-3 w-3" /> {ar ? 'قرار الذكاء الاصطناعي' : 'AI decision'}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500">
                  #{detail.report.id.slice(-6)} · {STATUS_LABELS[detail.report.status]?.[ar ? 'ar' : 'en'] || detail.report.status}
                </p>
              </div>
              {decision && (
                <span className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold ${DECISION_LABELS[decision as ModerationDecision].cls}`}>
                  {DECISION_LABELS[decision as ModerationDecision][ar ? 'ar' : 'en']}
                </span>
              )}
            </div>

            <div className="rounded-2xl border border-white/[0.07] bg-black/20 p-3 text-xs text-slate-300">
              <p><span className="text-slate-500">{ar ? 'المُبلِّغ: ' : 'Reporter: '}</span> {detail.report.reporterName || detail.report.reporterId}</p>
              <p><span className="text-slate-500">{ar ? 'صاحب المحتوى: ' : 'Content owner: '}</span> {detail.report.contentOwnerName || detail.report.contentOwnerId || '—'}</p>
              <p><span className="text-slate-500">{ar ? 'سبب البلاغ: ' : 'Report reason: '}</span> {detail.report.reason || '—'}</p>
              {detail.snapshot?.text && (
                <p className="mt-2 whitespace-pre-wrap text-slate-200"><span className="text-slate-500">{ar ? 'نص المحتوى: ' : 'Content text: '}</span>{detail.snapshot.text}</p>
              )}
              {detail.snapshot?.mediaUrl && (
                <img src={detail.snapshot.mediaUrl} alt="" className="mt-2 max-h-40 rounded-lg border border-white/10" />
              )}
            </div>

            {/* AI LOGS */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-400">{ar ? 'سجل قرارات الذكاء الاصطناعي' : 'AI decision log'}</p>
              {detail.logs.length === 0 && (
                <p className="text-[11px] text-slate-500">{ar ? 'لا يوجد سجل آلي (إجراء يدوي).' : 'No automated log (manual action).'}</p>
              )}
              {detail.logs.map((l: any) => (
                <div key={l.id} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {l.model && l.model !== 'admin' && (
                      <span className="flex items-center gap-1 rounded-md border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold text-violet-300">
                        <Bot className="h-3 w-3" /> {l.model}
                      </span>
                    )}
                    {l.decision && (
                      <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${DECISION_LABELS[l.decision as ModerationDecision]?.cls || ''}`}>
                        {DECISION_LABELS[l.decision as ModerationDecision]?.[ar ? 'ar' : 'en'] || l.decision}
                      </span>
                    )}
                    {l.severity && (
                      <span className={`text-[10px] font-bold ${SEVERITY_LABELS[l.severity]?.[ar ? 'ar' : 'en'] && SEVERITY_LABELS[l.severity].cls}`}>
                        {SEVERITY_LABELS[l.severity]?.[ar ? 'ar' : 'en'] || l.severity}
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400">{ar ? 'ثقة' : 'Conf'}: {pct(l.confidence)}</span>
                    {l.reviewedByAdmin && (
                      <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                        {ar ? 'راجعه الأدمن' : 'Admin reviewed'}
                      </span>
                    )}
                  </div>
                  {Array.isArray(l.detectedCategories) && l.detectedCategories.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {l.detectedCategories.map((c: string, i: number) => (
                        <span key={i} className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-slate-300">
                          {CAT_LABELS[c as ModerationCategory]?.[ar ? 'ar' : 'en'] || c}
                        </span>
                      ))}
                    </div>
                  )}
                  {l.reason && <p className="mt-1.5 text-[11px] leading-5 text-slate-400">{l.reason}</p>}
                </div>
              ))}
            </div>

            {/* ACTIONS */}
            <div className="space-y-3 border-t border-white/[0.07] pt-3">
              <p className="text-xs font-bold text-slate-400">{ar ? 'إجراءات الأدمن' : 'Admin actions'}</p>

              <div className="grid grid-cols-2 gap-2">
                <button
                  disabled={busy || !isViolation}
                  onClick={() => act({ finalDecision: 'upheld', status: 'resolved', adminNote })}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500/90 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-500 disabled:opacity-40"
                >
                  <CheckCircle2 className="h-4 w-4" /> {ar ? 'قبول قرار AI' : 'Accept AI'}
                </button>
                <button
                  disabled={busy}
                  onClick={() => act({ finalDecision: 'overturned', status: 'rejected', applyRestore: true, adminNote })}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-slate-300 transition hover:text-white disabled:opacity-40"
                >
                  <RotateCcw className="h-4 w-4" /> {ar ? 'عكس وإرجاع المحتوى' : 'Reverse & restore'}
                </button>
                {detail.report.contentType !== 'user' && (
                  <>
                    <button
                      disabled={busy}
                      onClick={() => act({ applyHide: true, adminNote })}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-slate-300 transition hover:text-white disabled:opacity-40"
                    >
                      <EyeOff className="h-4 w-4" /> {ar ? 'إخفاء المحتوى' : 'Hide content'}
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => act({ applyRemove: true, status: 'resolved', adminNote })}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-slate-300 transition hover:text-white disabled:opacity-40"
                    >
                      <Trash2 className="h-4 w-4" /> {ar ? 'حذف المحتوى' : 'Remove'}
                    </button>
                  </>
                )}
                <button
                  disabled={busy || !detail.report.contentOwnerId}
                  onClick={() => act({ applyWarn: true, adminNote })}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-slate-300 transition hover:text-white disabled:opacity-40"
                >
                  <AlertTriangle className="h-4 w-4" /> {ar ? 'تحذير الحساب' : 'Warn account'}
                </button>
                <button
                  disabled={busy || !detail.report.contentOwnerId}
                  onClick={() => act({ applyRestrict: true, adminNote })}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-slate-300 transition hover:text-white disabled:opacity-40"
                >
                  <UserX className="h-4 w-4" /> {ar ? 'تقييد الحساب' : 'Restrict account'}
                </button>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-bold text-slate-400">{ar ? 'ملاحظة الأدمن' : 'Admin note'}</label>
                <textarea
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  rows={2}
                  className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-[#D4AF37]/40"
                  placeholder={ar ? 'ملاحظات حول القرار' : 'Notes about the decision'}
                />
                <button
                  disabled={busy}
                  onClick={() => act({ adminNote })}
                  className="mt-1.5 flex items-center justify-center gap-1.5 rounded-xl bg-[#D4AF37] px-4 py-2 text-xs font-bold text-black transition hover:bg-[#e6c049] disabled:opacity-60"
                >
                  <ShieldCheck className="h-4 w-4" /> {ar ? 'حفظ وتمييز كمراجَع' : 'Save & mark reviewed'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminModerationView;
