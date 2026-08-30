import React, { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { api } from '../../services/api';
import { Message, Conversation } from '../../types';
import VerifiedBadge from '../common/VerifiedBadge';
import {
  MessageSquare,
  Send,
  ArrowLeft,
  Loader2,
  Check,
  CheckCheck,
  Image as ImageIcon,
  Mic,
  Square,
  X,
  Play,
  Pause,
  Download,
  MoreVertical,
  Pin,
  Trash2,
  EyeOff,
  Lock,
} from 'lucide-react';

const formatTime = (iso: string, isRtl: boolean): string => {
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
};

const MessageStatusTicks: React.FC<{ status: Message['status']; isRtl: boolean }> = ({
  status,
  isRtl,
}) => {
  if (status === 'sent') {
    return (
      <span title={isRtl ? 'تم الإرسال' : 'Sent'} className="inline-flex">
        <Check className="w-3 h-3" />
      </span>
    );
  }

  if (status === 'delivered') {
    return (
      <span title={isRtl ? 'تم التسليم' : 'Delivered'} className="inline-flex text-gray-400">
        <CheckCheck className="w-3.5 h-3.5" />
      </span>
    );
  }

  // read
  return (
    <span title={isRtl ? 'تم القراءة' : 'Read'} className="inline-flex text-[#D4AF37]">
      <CheckCheck className="w-3.5 h-3.5" />
    </span>
  );
};

/* ---- Media helpers (client-side only) ------------------------------- */

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/* Generate a small JPEG thumbnail locally so the chat only shows a
   lightweight preview; the original is uploaded untouched at full quality. */
function makeThumbnail(file: File, max = 360): Promise<string | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      } catch {
        URL.revokeObjectURL(url);
        resolve(null);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

function formatDuration(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/* ---- Audio player (Play/Pause, progress, duration) ------------------- */

const AudioPlayer: React.FC<{ url: string; duration?: number; isRtl: boolean }> = ({
  url,
  duration,
  isRtl,
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [total, setTotal] = useState(duration || 0);

  const toggle = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      a.play().catch(() => setPlaying(false));
    } else {
      a.pause();
    }
  }, []);

  const onSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const a = audioRef.current;
    if (!a) return;
    const value = Number(e.target.value);
    a.currentTime = value;
    setCurrent(value);
  };

  return (
    <div className="flex items-center gap-3 w-full max-w-[260px]">
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (isFinite(d) && d > 0) setTotal(d);
        }}
        onDurationChange={(e) => {
          const d = e.currentTarget.duration;
          if (isFinite(d) && d > 0) setTotal(d);
        }}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setCurrent(0);
        }}
      />
      <button
        type="button"
        onClick={toggle}
        className="shrink-0 w-9 h-9 rounded-full bg-[#D4AF37] hover:bg-[#B8962D] text-black flex items-center justify-center transition-all"
        title={isRtl ? 'تشغيل/إيقاف' : 'Play/Pause'}
      >
        {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 rtl:mr-0.5" />}
      </button>
      <div className="flex-1 flex items-center gap-2">
        <input
          type="range"
          min={0}
          max={total || 0}
          step={0.1}
          value={Math.min(current, total || 0)}
          onChange={onSeek}
          className="flex-1 accent-[#D4AF37] h-1 cursor-pointer"
          aria-label={isRtl ? 'شريط التقدم' : 'Progress'}
        />
        <span className="text-[10px] tabular-nums text-gray-400 shrink-0 w-[34px] text-end">
          {formatDuration(current)} / {formatDuration(total)}
        </span>
      </div>
    </div>
  );
};

export const MessagesView: React.FC<{
  initialUserId?: string | null;
  onNavigate?: (view: string) => void;
}> = ({ initialUserId, onNavigate }) => {
  const { user } = useAuth();
  const { isRtl } = useLanguage();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [hiddenPinError, setHiddenPinError] = useState('');
  const [hiddenUnlocked, setHiddenUnlocked] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const [longPressConvId, setLongPressConvId] = useState<string | null>(null);
  const justLongPressed = useRef(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loadingConv, setLoadingConv] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  // Media composer state
  const [pendingImage, setPendingImage] = useState<{
    file: File;
    previewUrl: string;
    caption: string;
  } | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordElapsed, setRecordElapsed] = useState(0);
  const [audioPreview, setAudioPreview] = useState<{
    url: string;
    duration: number;
    mime: string;
    blob: Blob;
  } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);
  const recordStartRef = useRef(0);
  const recordTimerRef = useRef<number | null>(null);
  const discardRecordingRef = useRef(false);

  // Scroll container for the message thread. We pin the view to the latest
  // message ONLY when the user is already near the bottom, so reading older
  // messages is never interrupted by polling. Scrolling is contained to this
  // element (never the page) by setting scrollTop directly.
  const threadScrollRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  // Scroll anchor used to preserve the visible position when older messages are
  // prepended (loading history). Saved right before the state update and
  // restored in a layout effect so the view never jumps.
  const loadOlderAnchor = useRef<{ height: number; top: number } | null>(null);

  const scrollThreadToBottom = useCallback(() => {
    const el = threadScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  const handleThreadScroll = useCallback(() => {
    const el = threadScrollRef.current;
    if (!el) return;
    nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }, []);

  const loadConversations = useCallback(async () => {
    justLongPressed.current = false; // reset after any refresh
    try {
      const convs = await api.getConversations();
      const sorted = [...(Array.isArray(convs) ? convs : [])].sort((a: any, b: any) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        const ta = new Date(a?.lastMessage?.createdAt || 0).getTime();
        const tb = new Date(b?.lastMessage?.createdAt || 0).getTime();
        return tb - ta; // descending
      });
      setConversations(sorted);
    } catch {
      /* keep previous state on transient failure */
    }
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    if (showHidden) return; // don't poll main list while viewing hidden list
    setLoadingConv(true);
    loadConversations().finally(() => setLoadingConv(false));
    const timer = setInterval(loadConversations, 12000);
    return () => clearInterval(timer);
  }, [user?.id, loadConversations, showHidden]);

  const loadMessages = useCallback(
    async (otherId: string, before?: string) => {
      setLoadingMsg(true);
      try {
        const { messages: msgs, hasMore: more } = await api.getMessages(
          otherId,
          before
        );
        if (before) {
          const el = threadScrollRef.current;
          loadOlderAnchor.current = el
            ? { height: el.scrollHeight, top: el.scrollTop }
            : null;
          setMessages((prev) => [...msgs, ...prev]);
        } else {
          setMessages(msgs);
        }
        setHasMore(more);
      } catch {
        setError(isRtl ? 'تعذر تحميل الرسائل.' : 'Failed to load messages.');
      } finally {
        setLoadingMsg(false);
      }
    },
    [isRtl]
  );

  const openConversation = useCallback(
    async (otherId: string) => {
      setSelectedId(otherId);
      setError(null);
      // Always open a conversation pinned to the newest message.
      nearBottomRef.current = true;
      setMessages([]);
      await loadMessages(otherId);
      await api.markMessagesRead(otherId);
      await loadConversations();
      // Immediately refresh the Navbar Messages unread badge so it clears
      // without waiting for the polling cycle.
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('halaqi:messages-unread-refresh'));
      }
      // Jump to the latest message once the thread has rendered.
      requestAnimationFrame(scrollThreadToBottom);
    },
    [loadMessages, loadConversations, scrollThreadToBottom]
  );

  // Open a specific conversation when navigated from a profile ("Message" button).
  useEffect(() => {
    if (!initialUserId || !user?.id) return;
    openConversation(initialUserId);
  }, [initialUserId, user?.id, openConversation]);

  // Poll the open thread for new messages and keep read state fresh.
  useEffect(() => {
    if (!selectedId || !user?.id) return;
    const timer = setInterval(async () => {
      await loadMessages(selectedId);
      await api.markMessagesRead(selectedId);
      // Refresh conversation list order when new messages arrive
      await loadConversations();
      // Keep the Navbar Messages unread badge in sync immediately.
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('halaqi:messages-unread-refresh'));
      }
    }, 10000);
    return () => clearInterval(timer);
  }, [selectedId, user?.id, loadMessages]);

  // Pin the thread to the latest message when it first loads or when the user
  // is already near the bottom. When older messages are prepended (history
  // load), restore the exact previous scroll position so the view never jumps.
  useLayoutEffect(() => {
    if (!selectedId) return;
    const el = threadScrollRef.current;
    if (!el) return;
    if (loadOlderAnchor.current) {
      const delta = el.scrollHeight - loadOlderAnchor.current.height;
      el.scrollTop = loadOlderAnchor.current.top + delta;
      loadOlderAnchor.current = null;
    } else if (nearBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, selectedId]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || !selectedId || !user?.id) return;
    setSending(true);
    setError(null);
    try {
      const res = await api.sendMessage(selectedId, text);
      if (res.success && res.message) {
        setMessages((prev) => [...prev, res.message as Message]);
        setInput('');
        await loadConversations();
        // Always reveal the message the user just sent.
        requestAnimationFrame(scrollThreadToBottom);
      } else {
        setError(res.error || (isRtl ? 'فشل إرسال الرسالة.' : 'Failed to send message.'));
      }
    } catch {
      setError(isRtl ? 'تعذر إرسال الرسالة.' : 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  /* ---------------- Image sending ---------------- */
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError(isRtl ? 'الرجاء اختيار صورة صالحة.' : 'Please choose a valid image.');
      return;
    }
    setError(null);
    setPendingImage({
      file,
      previewUrl: URL.createObjectURL(file),
      caption: '',
    });
  };

  const cancelPendingImage = () => {
    if (pendingImage) URL.revokeObjectURL(pendingImage.previewUrl);
    setPendingImage(null);
  };

  const handleSendImage = async () => {
    if (!pendingImage || !selectedId || !user?.id) return;
    setUploading(true);
    setError(null);
    try {
      const original = await readAsDataUrl(pendingImage.file);
      const thumb = await makeThumbnail(pendingImage.file);
      const up = await api.uploadMessageMedia({
        kind: 'image',
        original,
        thumbnail: thumb || undefined,
      });
      if (!up.success || !up.url) {
        setError(up.error || (isRtl ? 'فشل رفع الصورة.' : 'Failed to upload image.'));
        setUploading(false);
        return;
      }
      const res = await api.sendMessage(selectedId, pendingImage.caption, {
        type: 'image',
        url: up.url,
        thumbnail: up.thumbnailUrl,
        metadata: {
          size: pendingImage.file.size,
          mime: pendingImage.file.type,
          name: pendingImage.file.name,
        },
      });
      if (res.success && res.message) {
        setMessages((prev) => [...prev, res.message as Message]);
        cancelPendingImage();
        await loadConversations();
        requestAnimationFrame(scrollThreadToBottom);
      } else {
        setError(res.error || (isRtl ? 'فشل إرسال الصورة.' : 'Failed to send image.'));
      }
    } catch {
      setError(isRtl ? 'تعذر إرسال الصورة.' : 'Failed to send image.');
    } finally {
      setUploading(false);
    }
  };

  /* ---------------- Voice recording ---------------- */
  const startRecording = async () => {
    if (audioPreview) {
      URL.revokeObjectURL(audioPreview.url);
      setAudioPreview(null);
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(isRtl ? 'التسجيل غير مدعوم على هذا الجهاز.' : 'Recording is not supported on this device.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Pick a container/codec that both the sender and the recipient can
      // actually decode in a mobile browser. Prefer MP4/AAC (plays on Safari
      // iOS + Chrome) and fall back to WebM/Opus (Chrome/Android/Firefox).
      const preferredMime = [
        'audio/mp4;codecs=aac',
        'audio/mp4',
        'audio/webm;codecs=opus',
        'audio/webm',
      ].find(
        (t) =>
          typeof MediaRecorder !== 'undefined' &&
          MediaRecorder.isTypeSupported(t)
      );
      const recorder = preferredMime
        ? new MediaRecorder(stream, { mimeType: preferredMime })
        : new MediaRecorder(stream);
      recordChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(recordChunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        stream.getTracks().forEach((t) => t.stop());
        const wasDiscarded = discardRecordingRef.current;
        discardRecordingRef.current = false;
        if (wasDiscarded) {
          setRecording(false);
          setRecordElapsed(0);
          return;
        }
        const url = URL.createObjectURL(blob);
        const duration = (Date.now() - recordStartRef.current) / 1000;
        setAudioPreview({ url, duration, mime: blob.type, blob });
        setRecording(false);
        setRecordElapsed(0);
      };
      recordStartRef.current = Date.now();
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
      setRecordElapsed(0);
      setError(null);
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      recordTimerRef.current = window.setInterval(() => {
        setRecordElapsed((Date.now() - recordStartRef.current) / 1000);
      }, 200);
    } catch {
      setError(
        isRtl
          ? 'تعذر الوصول إلى الميكروفون. يرجى السماح بالإذن.'
          : 'Microphone access denied. Please allow permission.'
      );
      setRecording(false);
    }
  };

  const stopRecording = () => {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    mediaRecorderRef.current?.stop();
  };

  const cancelRecording = () => {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      discardRecordingRef.current = true;
      mediaRecorderRef.current.stop();
    } else if (audioPreview) {
      URL.revokeObjectURL(audioPreview.url);
      setAudioPreview(null);
    }
    setRecording(false);
    setRecordElapsed(0);
  };

  const handleSendAudio = async () => {
    if (!audioPreview || !selectedId || !user?.id) return;
    setUploading(true);
    setError(null);
    try {
      const original = await readAsDataUrl(audioPreview.blob);
      const up = await api.uploadMessageMedia({ kind: 'audio', original });
      if (!up.success || !up.url) {
        setError(up.error || (isRtl ? 'فشل رفع الصوت.' : 'Failed to upload audio.'));
        setUploading(false);
        return;
      }
      const res = await api.sendMessage(selectedId, '', {
        type: 'audio',
        url: up.url,
        metadata: {
          duration: Math.round(audioPreview.duration * 10) / 10,
          size: audioPreview.blob.size,
          mime: audioPreview.mime,
        },
      });
      if (res.success && res.message) {
        setMessages((prev) => [...prev, res.message as Message]);
        URL.revokeObjectURL(audioPreview.url);
        setAudioPreview(null);
        await loadConversations();
        requestAnimationFrame(scrollThreadToBottom);
      } else {
        setError(res.error || (isRtl ? 'فشل إرسال الصوت.' : 'Failed to send audio.'));
      }
    } catch {
      setError(isRtl ? 'تعذر إرسال الصوت.' : 'Failed to send audio.');
    } finally {
      setUploading(false);
    }
  };

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center text-gray-400">
        {isRtl ? 'يرجى تسجيل الدخول لعرض الرسائل.' : 'Please sign in to view messages.'}
      </div>
    );
  }

  const selectedConv = conversations.find((c) => c.otherUser.id === selectedId);

  const listPane = (
    <div className="flex flex-col h-full">
      <div className="px-4 py-4 border-b border-[#262626] flex items-center gap-2">
        <MessageSquare className="w-5 h-5 text-[#D4AF37]" />
                  <button
                    type="button"
                    onClick={() => { setShowHidden(!showHidden); setPinInput(''); setHiddenPinError(''); setHiddenUnlocked(false); }}
                    aria-label="⋮"
                    className="w-9 h-9 rounded-xl bg-[#141414] border border-white/10 flex items-center justify-center hover:bg-[#202020] text-[#D4AF37] text-lg font-black"
                  >
                    ⋮
                  </button>
                  <h2 className="text-lg font-black text-white">
                    {isRtl ? 'الرسائل' : 'Messages'}
                  </h2>
      </div>

      <div className="flex-1 overflow-y-auto max-md:pb-[calc(72px+env(safe-area-inset-bottom))]">
        {showHidden && (
          <div className="flex flex-col h-full">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[#262626]">
              <button
                type="button"
                onClick={() => { setShowHidden(false); setPinInput(''); setHiddenPinError(''); setHiddenUnlocked(false); loadConversations(); }}
                className="w-9 h-9 rounded-xl bg-[#141414] border border-white/10 flex items-center justify-center hover:bg-[#202020] text-[#D4AF37]"
                title={isRtl ? 'رجوع' : 'Back'}
                aria-label={isRtl ? 'رجوع' : 'Back'}
              >
                <ArrowLeft className="w-5 h-5 rtl:rotate-180" />
              </button>
              <h3 className="text-sm font-black text-white">
                {isRtl ? 'المحادثات المخفية' : 'Hidden conversations'}
              </h3>
            </div>

            {(!hiddenUnlocked) && (
              <div className="px-4 py-6 space-y-4">
                <div className="flex gap-2">
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={pinInput}
                    onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(0,4); setPinInput(v); setHiddenPinError(''); }}
                    placeholder={isRtl ? 'PIN 4 أرقام' : '4-digit PIN'}
                    className="flex-1 rounded-xl bg-[#1c1c1c] border border-white/10 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#D4AF37]"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const res = await api.getHiddenConversations(String(pinInput || ''));
                        if (res.success && Array.isArray(res.conversations)) {
                          setConversations(res.conversations as any);
                          setHiddenUnlocked(true);
                          setHiddenPinError('');
                        } else {
                          setHiddenPinError(isRtl ? 'PIN غير صحيح' : 'Wrong PIN');
                        }
                      } catch {
                        setHiddenPinError(isRtl ? 'فشل التحقق' : 'Verification failed');
                      }
                    }}
                    className="px-4 py-2.5 rounded-xl bg-[#D4AF37] hover:bg-[#B8962D] text-black text-xs font-black shrink-0"
                  >
                    {isRtl ? 'فتح' : 'Open'}
                  </button>
                </div>
                {hiddenPinError && <p className="text-xs text-red-400">{hiddenPinError}</p>}
                <p className="text-[11px] text-gray-500">
                  {isRtl ? 'أدخل رمز الـ PIN لفتح المحادثات المخفية.' : 'Enter the PIN to view hidden conversations.'}
                </p>
              </div>
            )}

            {hiddenUnlocked && conversations.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center px-6">
                <div className="w-14 h-14 rounded-2xl bg-white/[0.035] border border-white/[0.06] flex items-center justify-center mb-4">
                  <MessageSquare className="w-6 h-6 text-gray-500" />
                </div>
                <p className="text-sm font-bold text-gray-300">
                  {isRtl ? 'لا توجد محادثات مخفية' : 'No hidden conversations'}
                </p>
              </div>
            )}

            {hiddenUnlocked && conversations.length > 0 && (
              <div className="flex-1 overflow-y-auto">
                {conversations.map((conv) => {
                  const isActive = conv.otherUser.id === selectedId;
                  return (
                    <button
                      key={conv.otherUser.id}
                      onClick={() => { setShowHidden(false); setHiddenUnlocked(false); setPinInput(''); loadConversations(); openConversation(conv.otherUser.id); }}
                      className={`w-full text-start px-4 py-3.5 border-b border-white/[0.05] flex items-center gap-3 transition-all ${
                        isActive ? 'bg-[#D4AF37]/[0.08]' : 'hover:bg-white/[0.04]'
                      }`}
                    >
                      <div className="shrink-0 w-11 h-11 rounded-full bg-gray-800 border border-[#333] flex items-center justify-center overflow-hidden">
                        {conv.otherUser.avatar ? (
                          <img src={conv.otherUser.avatar} alt={conv.otherUser.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[#D4AF37] font-bold">{conv.otherUser.name.charAt(0)}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-bold text-white truncate">
                            {conv.otherUser.name}
                            {conv.otherUser.isVerified && <VerifiedBadge />}
                          </p>
                          <span className="text-[10px] text-gray-500 shrink-0">
                            {formatTime(conv.lastMessage.createdAt, isRtl)}
                          </span>
                        </div>
                        <p className="text-[12px] text-gray-400 truncate">
                          {conv.lastMessage.type === 'image' ? (isRtl ? '📷 صورة' : '📷 Photo')
                            : conv.lastMessage.type === 'audio' ? (isRtl ? '🎤 رسالة صوتية' : '🎤 Voice message')
                            : conv.lastMessage.body}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
        {loadingConv && conversations.length === 0 && !showHidden ? (
          <div className="flex items-center justify-center py-16 text-gray-500">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-white/[0.035] border border-white/[0.06] flex items-center justify-center mb-4">
              <MessageSquare className="w-6 h-6 text-gray-500" />
            </div>
            <p className="text-sm font-bold text-gray-300">
              {isRtl ? 'لا توجد محادثات' : 'No conversations'}
            </p>
            <p className="text-[11px] text-gray-600 mt-1.5">
              {isRtl
                ? 'ابدأ محادثة من ملف المستخدم أو صالون.'
                : 'Start a chat from a user or salon profile.'}
            </p>
          </div>
        ) : (
          conversations.map((conv) => {
            const isActive = conv.otherUser.id === selectedId;
            return (
              <button
                key={conv.otherUser.id}
                onClick={() => {
                  if (justLongPressed.current) {
                    justLongPressed.current = false;
                    return;
                  }
                  openConversation(conv.otherUser.id);
                }}
                onMouseDown={() => { longPressTimer.current = setTimeout(() => { setLongPressConvId(conv.otherUser.id); justLongPressed.current = true; }, 600); }}
                onMouseUp={() => { if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; } if (longPressConvId && longPressConvId !== conv.otherUser.id) { setLongPressConvId(null); } }}
                onMouseLeave={() => { if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; } }}
                onTouchStart={() => { longPressTimer.current = setTimeout(() => { setLongPressConvId(conv.otherUser.id); justLongPressed.current = true; }, 600); }}
                onTouchEnd={() => { if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; } if (longPressConvId && longPressConvId !== conv.otherUser.id) { setLongPressConvId(null); } }}
                onTouchMove={() => { if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; } }}
                className={`w-full text-start px-4 py-3.5 border-b border-white/[0.05] flex items-center gap-3 transition-all ${
                  isActive ? 'bg-[#D4AF37]/[0.08]' : 'hover:bg-white/[0.04]'
                }`}
              >
                <div className="shrink-0 w-11 h-11 rounded-full bg-gray-800 border border-[#333] flex items-center justify-center overflow-hidden">
                  {conv.otherUser.avatar ? (
                    <img
                      src={conv.otherUser.avatar}
                      alt={conv.otherUser.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-[#D4AF37] font-bold">
                      {conv.otherUser.name.charAt(0)}
                    </span>
                  )}
                </div>

                {longPressConvId === conv.otherUser.id && (
                  <div className="absolute z-50 bg-[#181818]/95 border border-[#D4AF37]/30 rounded-xl shadow-2xl p-2 min-w-[160px] text-xs font-bold text-white" style={{ top: 40, left: 10 }}>
                    <button onClick={(e) => { e.stopPropagation(); e.preventDefault(); setLongPressConvId(null); if(conv.otherUser.id){ (async () => { await api.post('/api/messages/conversation-state', { otherId: conv.otherUser.id, action: 'delete' }); await loadConversations(); })(); } }} className="block w-full text-right px-2 py-1.5 hover:bg-white/10 rounded-lg text-red-400">حذف المحادثة</button>
                    <button onClick={(e) => { e.stopPropagation(); e.preventDefault(); setLongPressConvId(null); if(conv.otherUser.id){ (async () => { await api.post('/api/messages/conversation-state', { otherId: conv.otherUser.id, action: 'pin' }); await loadConversations(); })(); } }} className="block w-full text-right px-2 py-1.5 hover:bg-white/10 rounded-lg text-[#D4AF37]">تثبيت</button>
                    <button onClick={(e) => { e.stopPropagation(); e.preventDefault(); setLongPressConvId(null); if(conv.otherUser.id){ (async () => { await api.post('/api/messages/conversation-state', { otherId: conv.otherUser.id, action: 'hide' }); await loadConversations(); })(); } }} className="block w-full text-right px-2 py-1.5 hover:bg-white/10 rounded-lg text-slate-300">إخفاء</button>
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-white truncate">
                      {conv.otherUser.name}
                      {conv.otherUser.isVerified && <VerifiedBadge />}
                    </p>
                    <span className="text-[10px] text-gray-500 shrink-0">
                      {formatTime(conv.lastMessage.createdAt, isRtl)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[12px] text-gray-400 truncate">
                      {conv.lastMessage.senderId === user.id ? '› ' : ''}
                      {conv.lastMessage.type === 'image'
                        ? isRtl
                          ? '📷 صورة'
                          : '📷 Photo'
                        : conv.lastMessage.type === 'audio'
                        ? isRtl
                          ? '🎤 رسالة صوتية'
                          : '🎤 Voice message'
                        : conv.lastMessage.body}
                    </p>
                    {conv.unreadCount > 0 && (
                      <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center">
                        {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );

  const threadPane = (
    <div className="flex flex-col h-full max-md:pb-[calc(72px+env(safe-area-inset-bottom))]">
      {/* Thread header */}
      <div className="px-3 py-3 border-b border-[#262626] flex items-center gap-2">
        <button
          onClick={() => setSelectedId(null)}
          className="md:hidden flex items-center justify-center w-9 h-9 rounded-xl bg-[#262626] text-[#D4AF37]"
          title={isRtl ? 'رجوع' : 'Back'}
        >
          <ArrowLeft className="w-5 h-5 rotate-180" />
        </button>
        {selectedConv && (
          <button
            type="button"
            onClick={() => onNavigate?.(`user:${selectedConv.otherUser.id}`)}
            className="flex items-center gap-3 min-w-0 text-start hover:opacity-80 transition-opacity"
            title={isRtl ? 'عرض الملف الشخصي' : 'View profile'}
          >
            <div className="shrink-0 w-9 h-9 rounded-full bg-gray-800 border border-[#333] flex items-center justify-center overflow-hidden">
              {selectedConv.otherUser.avatar ? (
                <img
                  src={selectedConv.otherUser.avatar}
                  alt={selectedConv.otherUser.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-[#D4AF37] font-bold">
                  {selectedConv.otherUser.name.charAt(0)}
                </span>
              )}
            </div>
            <p className="text-sm font-bold text-white truncate flex items-center gap-1">
              @{selectedConv.otherUser.username || selectedConv.otherUser.name}
              {selectedConv.otherUser.isVerified && <VerifiedBadge />}
            </p>
          </button>
        )}
      </div>

      {/* Messages */}
      <div
        ref={threadScrollRef}
        onScroll={handleThreadScroll}
        className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3 bg-[#0f0f0f]"
      >
        {loadingMsg && messages.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-gray-500">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-16 text-gray-500 text-sm">
            {isRtl ? 'لا توجد رسائل بعد. ابدأ المحادثة!' : 'No messages yet. Start the conversation!'}
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.senderId === user.id;
            const isImage = m.type === 'image' && m.mediaUrl;
            const isAudio = m.type === 'audio' && m.mediaUrl;
            const bubbleBase = mine
              ? 'bg-[#D4AF37] text-black rounded-br-sm'
              : 'bg-[#262626] text-gray-100 rounded-bl-sm';
            const mediaWrap = isImage || isAudio;
            // A caption is stored in `body`; the stock emoji markers mean
            // "no caption was provided", so don't render those as text.
            const caption =
              mediaWrap && m.body && m.body !== '📷' && m.body !== '🎤'
                ? m.body
                : null;
            return (
              <div
                key={m.id}
                className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[78%] rounded-2xl text-sm leading-relaxed ${
                    mediaWrap ? '' : `px-3.5 py-2.5 ${bubbleBase}`
                  }`}
                >
                  {isImage ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setViewerUrl(m.mediaUrl!)}
                        className="block overflow-hidden rounded-2xl border border-white/10"
                        title={isRtl ? 'فتح الصورة' : 'Open image'}
                      >
                        <img
                          src={m.mediaThumbnail || m.mediaUrl}
                          alt=""
                          loading="lazy"
                          className="max-w-[240px] max-h-[260px] w-auto h-auto object-cover"
                        />
                      </button>
                      {caption && (
                        <p className="whitespace-pre-wrap break-words mt-1.5 text-[13px]">
                          {caption}
                        </p>
                      )}
                    </>
                  ) : isAudio ? (
                    <div className={`rounded-2xl px-3 py-2.5 ${bubbleBase}`}>
                      <AudioPlayer
                        url={m.mediaUrl!}
                        duration={m.mediaMetadata?.duration}
                        isRtl={isRtl}
                      />
                      {caption && (
                        <p className="whitespace-pre-wrap break-words mt-1.5 text-[13px]">
                          {caption}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  )}
                  <p
                    className={`text-[9px] mt-1 flex items-center gap-1 ${
                      mediaWrap
                        ? mine
                          ? 'text-black/60 justify-end pe-1'
                          : 'text-gray-500 ps-1'
                        : mine
                        ? 'text-black/60'
                        : 'text-gray-500'
                    }`}
                  >
                    {formatTime(m.createdAt, isRtl)}
                    {mine && <MessageStatusTicks status={m.status} isRtl={isRtl} />}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Composer */}
      {error && (
        <div className="px-4 py-1 text-[11px] text-red-400">{error}</div>
      )}

      {/* Pending image preview */}
      {pendingImage && (
        <div className="px-3 pb-2">
          <div className="flex items-center gap-3 bg-[#1c1c1c] border border-[#2a2a2a] rounded-2xl p-2.5">
            <img
              src={pendingImage.previewUrl}
              alt=""
              className="w-14 h-14 rounded-xl object-cover border border-white/10 shrink-0"
            />
            <input
              type="text"
              value={pendingImage.caption}
              onChange={(e) =>
                setPendingImage((p) => (p ? { ...p, caption: e.target.value } : p))
              }
              placeholder={isRtl ? 'أضف تعليقاً (اختياري)…' : 'Add a caption (optional)…'}
              className="flex-1 min-w-0 bg-[#262626] border border-[#333] rounded-full px-3 py-2 text-sm text-white outline-none focus:border-[#D4AF37]"
            />
            <button
              onClick={cancelPendingImage}
              className="shrink-0 w-9 h-9 rounded-full bg-[#262626] text-gray-300 flex items-center justify-center hover:bg-[#333]"
              title={isRtl ? 'إلغاء' : 'Cancel'}
            >
              <X className="w-4 h-4" />
            </button>
            <button
              onClick={handleSendImage}
              disabled={uploading}
              className="shrink-0 w-11 h-11 rounded-full bg-[#D4AF37] hover:bg-[#B8962D] disabled:opacity-40 text-black flex items-center justify-center transition-all"
              title={isRtl ? 'إرسال الصورة' : 'Send image'}
            >
              {uploading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      )}

      {/* Recording / audio preview */}
      {recording && (
        <div className="px-3 pb-2">
          <div className="flex items-center gap-3 bg-[#1c1c1c] border border-[#2a2a2a] rounded-2xl px-3 py-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm text-gray-200 font-mono tabular-nums">
              {formatDuration(recordElapsed)}
            </span>
            <span className="text-xs text-gray-500 flex-1">
              {isRtl ? 'جارٍ التسجيل…' : 'Recording…'}
            </span>
            <button
              onClick={cancelRecording}
              className="shrink-0 w-9 h-9 rounded-full bg-[#262626] text-gray-300 flex items-center justify-center hover:bg-[#333]"
              title={isRtl ? 'إلغاء' : 'Cancel'}
            >
              <X className="w-4 h-4" />
            </button>
            <button
              onClick={stopRecording}
              className="shrink-0 w-11 h-11 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-all"
              title={isRtl ? 'إيقاف وإرسال' : 'Stop'}
            >
              <Square className="w-4 h-4 fill-current" />
            </button>
          </div>
        </div>
      )}

      {audioPreview && !recording && (
        <div className="px-3 pb-2">
          <div className="flex items-center gap-3 bg-[#1c1c1c] border border-[#2a2a2a] rounded-2xl px-3 py-2.5">
            <AudioPlayer url={audioPreview.url} duration={audioPreview.duration} isRtl={isRtl} />
            <button
              onClick={cancelRecording}
              className="shrink-0 w-9 h-9 rounded-full bg-[#262626] text-gray-300 flex items-center justify-center hover:bg-[#333]"
              title={isRtl ? 'إلغاء' : 'Cancel'}
            >
              <X className="w-4 h-4" />
            </button>
            <button
              onClick={handleSendAudio}
              disabled={uploading}
              className="shrink-0 w-11 h-11 rounded-full bg-[#D4AF37] hover:bg-[#B8962D] disabled:opacity-40 text-black flex items-center justify-center transition-all"
              title={isRtl ? 'إرسال الصوت' : 'Send voice'}
            >
              {uploading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      )}

      <div className="px-3 py-3 border-t border-[#262626] flex items-center gap-2">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={!!pendingImage || recording || !!audioPreview}
          className="shrink-0 w-11 h-11 rounded-full bg-[#262626] hover:bg-[#333] disabled:opacity-40 text-[#D4AF37] flex items-center justify-center transition-all"
          title={isRtl ? 'إرفاق صورة' : 'Attach image'}
        >
          <ImageIcon className="w-5 h-5" />
        </button>
        <button
          onClick={recording ? stopRecording : startRecording}
          disabled={!!pendingImage}
          className={`shrink-0 w-11 h-11 rounded-full flex items-center justify-center transition-all ${
            recording
              ? 'bg-red-500 hover:bg-red-600 text-white'
              : 'bg-[#262626] hover:bg-[#333] text-[#D4AF37] disabled:opacity-40'
          }`}
          title={isRtl ? 'تسجيل صوت' : 'Record voice'}
        >
          {recording ? <Square className="w-4 h-4 fill-current" /> : <Mic className="w-5 h-5" />}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageSelect}
        />
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={isRtl ? 'اكتب رسالتك…' : 'Type a message…'}
          className="flex-1 bg-[#262626] border border-[#333] rounded-full px-4 py-2.5 text-sm text-white outline-none focus:border-[#D4AF37]"
        />
        <button
          onClick={handleSend}
          disabled={sending || !input.trim() || !!pendingImage || recording || !!audioPreview}
          className="shrink-0 w-11 h-11 rounded-full bg-[#D4AF37] hover:bg-[#B8962D] disabled:opacity-40 text-black flex items-center justify-center transition-all"
          title={isRtl ? 'إرسال' : 'Send'}
        >
          {sending ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </button>
      </div>
    </div>
  );

  /* Full-screen original image viewer (lazy: only the original URL is
     fetched when the user taps the thumbnail). */
  const saveExt = (() => {
    const mime = messages
      .find((m) => m.mediaUrl === viewerUrl)
      ?.mediaMetadata?.mime;
    if (mime && mime.startsWith('image/')) {
      const sub = mime.split('/')[1];
      if (sub === 'jpeg') return 'jpg';
      if (sub === 'webp') return 'webp';
      if (sub) return sub;
    }
    return 'jpg';
  })();
  const viewer = viewerUrl ? (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
      onClick={() => setViewerUrl(null)}
    >
      <button
        onClick={() => setViewerUrl(null)}
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
        title={isRtl ? 'إغلاق' : 'Close'}
      >
        <X className="w-5 h-5" />
      </button>
      <img
        src={viewerUrl}
        alt=""
        onClick={(e) => e.stopPropagation()}
        className="max-w-full max-h-full object-contain rounded-xl"
      />
      <a
        href={`${viewerUrl}&download=1`}
        download={`halaqi-image.${saveExt}`}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#D4AF37] hover:bg-[#B8962D] text-black text-sm font-bold transition-all"
      >
        <Download className="w-4 h-4" />
        {isRtl ? 'حفظ الصورة' : 'Save Image'}
      </a>
    </div>
  ) : null;

  return (
    <div className="max-w-5xl mx-auto px-0 sm:px-4 py-4 h-full max-md:fixed max-md:inset-x-0 max-md:top-16 max-md:z-30 max-md:max-w-none max-md:px-0 max-md:py-0 max-md:mx-0 max-md:h-[calc(100dvh-4rem)]">
        <div className="bg-[#141414] border border-[#262626] rounded-3xl overflow-hidden h-full max-md:rounded-none max-md:border-0">
        <div className="grid h-full grid-cols-1 md:grid-cols-[340px_1fr] max-md:flex max-md:flex-col">
          {/* Inbox pane (hidden on mobile when a thread is open) */}
          <div
            className={`h-full min-h-0 border-[#262626] md:border-e ${
              selectedId ? 'hidden md:block' : 'block'
            }`}
          >
            {listPane}
          </div>

          {/* Thread pane */}
          <div className={`h-full min-h-0 ${selectedId ? 'block' : 'hidden md:block'}`}>
            {selectedId ? (
              threadPane
            ) : (
              <div className="hidden md:flex items-center justify-center h-full text-gray-600 text-sm">
                {isRtl ? 'اختر محادثة لعرض الرسائل' : 'Select a conversation'}
              </div>
            )}
          </div>
        </div>
      </div>
      {viewer}
    </div>
  );
};
