/**
 * Centralized Halaqi in-app notification system.
 *
 * Replaces native browser dialogs (alert / confirm / prompt) with Halaqi's
 * Dark Luxury / Glassmorphism UI. A React provider (NotificationsProvider)
 * registers the actual renderers; non-React modules (e.g. api.ts) can call
 * `notify` / `confirmDialog` imperatively through this singleton.
 */

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  /** Danger styling (red) for destructive actions. */
  danger?: boolean;
  /** When set, the modal renders a text input and resolves its value. */
  input?: { placeholder?: string; defaultValue?: string };
}

export interface ConfirmResult {
  confirmed: boolean;
  value?: string;
}

type ToastFn = (message: string, type?: ToastType) => void;
type ConfirmFn = (opts: ConfirmOptions) => Promise<ConfirmResult>;

let _toast: ToastFn | null = null;
let _confirm: ConfirmFn | null = null;

export function registerNotifications(toast: ToastFn, confirm: ConfirmFn): void {
  _toast = toast;
  _confirm = confirm;
}

export function unregisterNotifications(): void {
  _toast = null;
  _confirm = null;
}

/** Show an in-app toast (success / error / warning / info). */
export function notify(message: string, type: ToastType = 'info'): void {
  if (_toast) {
    _toast(message, type);
  } else {
    // Provider not mounted yet — fall back to console so messages are not lost.
    console.warn(`[notify:${type}] ${message}`);
  }
}

/** Show an in-app confirmation modal. Resolves with the user's choice. */
export function confirmDialog(opts: ConfirmOptions): Promise<ConfirmResult> {
  if (_confirm) {
    return _confirm(opts);
  }
  // Provider not mounted — default to CANCEL to avoid accidental destructive actions.
  console.warn(`[confirmDialog] provider not mounted, defaulting to cancel: ${opts.message}`);
  return Promise.resolve({ confirmed: false });
}
