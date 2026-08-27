import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { api } from '../../services/api';
import { Message, Conversation } from '../../types';
import { MessageSquare, Send, ArrowLeft, Loader2, Check, CheckCheck } from 'lucide-react';

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

export const MessagesView: React.FC<{
  initialUserId?: string | null;
  onNavigate?: (view: string) => void;
}> = ({ initialUserId, onNavigate }) => {
  const { user } = useAuth();
  const { isRtl } = useLanguage();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loadingConv, setLoadingConv] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  // Scroll container for the message thread. We pin the view to the latest
  // message ONLY when the user is already near the bottom, so reading older
  // messages is never interrupted by polling. Scrolling is contained to this
  // element (never the page) by setting scrollTop directly.
  const threadScrollRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);

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
    try {
      const convs = await api.getConversations();
      setConversations(convs);
    } catch {
      /* keep previous state on transient failure */
    }
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    setLoadingConv(true);
    loadConversations().finally(() => setLoadingConv(false));
    const timer = setInterval(loadConversations, 12000);
    return () => clearInterval(timer);
  }, [user?.id, loadConversations]);

  const loadMessages = useCallback(
    async (otherId: string, before?: string) => {
      setLoadingMsg(true);
      try {
        const { messages: msgs, hasMore: more } = await api.getMessages(
          otherId,
          before
        );
        if (before) {
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
      // Keep the Navbar Messages unread badge in sync immediately.
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('halaqi:messages-unread-refresh'));
      }
    }, 10000);
    return () => clearInterval(timer);
  }, [selectedId, user?.id, loadMessages]);

  // Pin the thread to the latest message when it first loads or when the
  // user is already near the bottom. If they've scrolled up to read older
  // messages, leave their scroll position untouched.
  useEffect(() => {
    if (!selectedId) return;
    const el = threadScrollRef.current;
    if (!el) return;
    if (nearBottomRef.current) {
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
        <h2 className="text-lg font-black text-white">
          {isRtl ? 'الرسائل' : 'Messages'}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loadingConv && conversations.length === 0 ? (
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
                onClick={() => openConversation(conv.otherUser.id)}
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

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-white truncate">
                      {conv.otherUser.name}
                    </p>
                    <span className="text-[10px] text-gray-500 shrink-0">
                      {formatTime(conv.lastMessage.createdAt, isRtl)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[12px] text-gray-400 truncate">
                      {conv.lastMessage.senderId === user.id ? '› ' : ''}
                      {conv.lastMessage.body}
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
    <div className="flex flex-col h-full">
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
            <p className="text-sm font-bold text-white truncate">
              {selectedConv.otherUser.name}
            </p>
          </button>
        )}
      </div>

      {/* Messages */}
      <div
        ref={threadScrollRef}
        onScroll={handleThreadScroll}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-[#0f0f0f]"
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
            return (
              <div
                key={m.id}
                className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[78%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    mine
                      ? 'bg-[#D4AF37] text-black rounded-br-sm'
                      : 'bg-[#262626] text-gray-100 rounded-bl-sm'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p
                    className={`text-[9px] mt-1 flex items-center gap-1 ${
                      mine ? 'text-black/60' : 'text-gray-500'
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
      <div className="px-3 py-3 border-t border-[#262626] flex items-center gap-2">
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
          disabled={sending || !input.trim()}
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

  return (
    <div className="max-w-5xl mx-auto px-0 sm:px-4 py-4">
      <div className="bg-[#141414] border border-[#262626] rounded-3xl overflow-hidden h-[78vh]">
        <div className="grid h-full grid-cols-1 md:grid-cols-[340px_1fr]">
          {/* Inbox pane (hidden on mobile when a thread is open) */}
          <div
            className={`h-full border-[#262626] md:border-e ${
              selectedId ? 'hidden md:block' : 'block'
            }`}
          >
            {listPane}
          </div>

          {/* Thread pane */}
          <div className={`h-full ${selectedId ? 'block' : 'hidden md:block'}`}>
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
    </div>
  );
};
