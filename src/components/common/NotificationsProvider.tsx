import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';
import {
  registerNotifications,
  unregisterNotifications,
  ConfirmOptions,
  ConfirmResult,
  ToastType,
} from '../../utils/notifications';
import { useLanguage } from '../../context/LanguageContext';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

const ICONS: Record<ToastType, React.FC<{ className?: string }>> = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const ACCENT: Record<ToastType, string> = {
  success: 'text-emerald-400 border-emerald-400/40',
  error: 'text-red-400 border-red-400/40',
  warning: 'text-amber-400 border-amber-400/40',
  info: 'text-sky-400 border-sky-400/40',
};

const TOAST_DURATION = 3500;

/**
 * Renders Halaqi's in-app toast stack and confirmation modal, and registers
 * them with the notifications singleton so any module can call notify() /
 * confirmDialog(). Dark Luxury glassmorphism: ~50% transparent dark surface,
 * backdrop blur, subtle border + shadow, RTL + mobile friendly.
 */
export const NotificationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isRtl } = useLanguage();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<{
    opts: ConfirmOptions;
    resolve: (r: ConfirmResult) => void;
    input: string;
  } | null>(null);
  const idRef = useRef(0);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, TOAST_DURATION);
  }, []);

  const runConfirm = useCallback((opts: ConfirmOptions): Promise<ConfirmResult> => {
    return new Promise((resolve) => {
      setConfirmState({ opts, resolve, input: opts.input?.defaultValue || '' });
    });
  }, []);

  useEffect(() => {
    registerNotifications(showToast, runConfirm);
    return () => unregisterNotifications();
  }, [showToast, runConfirm]);

  const closeConfirm = (result: ConfirmResult) => {
    setConfirmState((state) => {
      if (state) state.resolve(result);
      return null;
    });
  };

  return (
    <>
      {children}

      {/* Toast stack */}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[200] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => {
          const Icon = ICONS[t.type];
          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-xl border bg-[#0b0d12]/50 px-4 py-3 text-sm text-white shadow-lg shadow-black/40 backdrop-blur-md ${
                ACCENT[t.type]
              } ${isRtl ? 'flex-row-reverse text-right' : ''}`}
              role="status"
            >
              <Icon className={`h-5 w-5 shrink-0 ${ACCENT[t.type].split(' ')[0]}`} />
              <span className="flex-1 break-words">{t.message}</span>
            </div>
          );
        })}
      </div>

      {/* Confirmation modal */}
      {confirmState && (
        <div
          className="fixed inset-0 z-[210] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => closeConfirm({ confirmed: false })}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-sm rounded-2xl border border-white/10 bg-[#0b0d12]/50 p-5 text-white shadow-2xl shadow-black/50 backdrop-blur-md ${
              isRtl ? 'text-right' : ''
            }`}
            role="dialog"
            aria-modal="true"
          >
            {confirmState.opts.title && (
              <h3 className="mb-2 text-base font-bold">{confirmState.opts.title}</h3>
            )}
            <p className="mb-4 text-sm text-white/80">{confirmState.opts.message}</p>

            {confirmState.opts.input && (
              <input
                autoFocus
                value={confirmState.input}
                onChange={(e) =>
                  setConfirmState((s) => (s ? { ...s, input: e.target.value } : s))
                }
                placeholder={confirmState.opts.input.placeholder}
                className="mb-4 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-[#D4AF37]/60"
              />
            )}

            <div className={`flex gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <button
                onClick={() => closeConfirm({ confirmed: false })}
                className="flex-1 rounded-lg border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white/80 transition-colors hover:bg-white/10"
              >
                {confirmState.opts.cancelText || (isRtl ? 'إلغاء' : 'Cancel')}
              </button>
              <button
                onClick={() =>
                  closeConfirm({ confirmed: true, value: confirmState.input })
                }
                className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-bold transition-colors ${
                  confirmState.opts.danger
                    ? 'bg-red-600 text-white hover:bg-red-500'
                    : 'bg-[#D4AF37] text-black hover:bg-[#B8962D]'
                }`}
              >
                {confirmState.opts.confirmText || (isRtl ? 'تأكيد' : 'Confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
