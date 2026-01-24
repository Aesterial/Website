"use client";

import { useAuth } from "@/components/auth-provider";
import { Header } from "@/components/header";
import { useLanguage } from "@/components/language-provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  closeTicket,
  createTicketMessage,
  fetchTicketInfo,
  fetchTicketMessages,
} from "@/lib/api";
import {
  mapTicket,
  mapTicketMessages,
  type Ticket,
  type TicketMessage,
  type TicketStatus,
} from "@/lib/tickets";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  ExternalLink,
  Lock,
  Maximize2,
  MessageSquare,
  Send,
  ShieldCheck,
  UserCircle2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

const statusStyles: Record<TicketStatus, string> = {
  new: "bg-foreground/5 text-foreground",
  in_progress: "bg-foreground text-background",
  closed: "border border-foreground/15 text-muted-foreground",
};

const copyByLanguage = {
  RU: {
    statusLabel: {
      new: "Ожидает",
      in_progress: "В работе",
      closed: "Закрыто",
    },
    ticketNotFound: "Обращение не найдено.",
    loadError: "Не удалось загрузить обращение.",
    newSupportMessageTitle: "Новое сообщение от поддержки",
    newSupportMessageFallback: "Проверьте диалог",
    messageSendError: "Не удалось отправить сообщение.",
    closeError: "Не удалось закрыть обращение.",
    supportAuthorName: "Поддержка",
    userAuthorName: "Пользователь",
    supportRole: "Поддержка",
    userRole: "Пользователь",
    messagesTitle: "Сообщения",
    untitled: "Без темы",
    messagesCountSuffix: "шт.",
    refreshing: "Обновляем",
    popupAction: "Попап",
    windowAction: "Окно",
    closeAction: "Закрыть",
    noMessages: "Сообщений пока нет.",
    newMessageLabel: "Новое сообщение",
    closedPlaceholder: "Обращение закрыто",
    messagePlaceholder: "Напишите уточнение или ответ",
    sendingAction: "Отправляем...",
    sendAction: "Отправить",
    backToForm: "Назад к форме",
    supportHistory: "История обращений",
    ticketLabel: "Обращение",
    autoCloseNote:
      "Если в обращении не будет новых сообщений в течение 48 часов, оно закроется автоматически.",
    detailsTitle: "Данные обращения",
    contactLabel: "Контакт:",
    emailLabel: "Email:",
    createdLabel: "Создано:",
    updatedLabel: "Последнее обновление:",
    categoryLabel: "Категория:",
    inProgressTitle: "Обращение в работе",
    inQueueMessage:
      "Обращение в очереди. Специалист подключится в ближайшее время.",
    closedTicketLabel: "Обращение закрыто",
    closingAction: "Закрываем...",
    closeTicketAction: "Закрыть обращение",
  },

  EN: {
    statusLabel: {
      new: "Waiting",
      in_progress: "In progress",
      closed: "Closed",
    },
    ticketNotFound: "Ticket not found.",
    loadError: "Failed to load ticket.",
    newSupportMessageTitle: "New message from support",
    newSupportMessageFallback: "Check the conversation",
    messageSendError: "Failed to send the message.",
    closeError: "Failed to close the ticket.",
    supportAuthorName: "Support",
    userAuthorName: "User",
    supportRole: "Support",
    userRole: "User",
    messagesTitle: "Messages",
    untitled: "No subject",
    messagesCountSuffix: "messages",
    refreshing: "Refreshing",
    popupAction: "Popup",
    windowAction: "Window",
    closeAction: "Close",
    noMessages: "No messages yet.",
    newMessageLabel: "New message",
    closedPlaceholder: "Ticket is closed",
    messagePlaceholder: "Write an update or reply",
    sendingAction: "Sending...",
    sendAction: "Send",
    backToForm: "Back to form",
    supportHistory: "Support history",
    ticketLabel: "Ticket",
    autoCloseNote:
      "If there are no new messages within 48 hours, the ticket will close automatically.",
    detailsTitle: "Ticket details",
    contactLabel: "Contact:",
    emailLabel: "Email:",
    createdLabel: "Created:",
    updatedLabel: "Last update:",
    categoryLabel: "Category:",
    inProgressTitle: "Ticket in progress",
    inQueueMessage: "Ticket is in the queue. A specialist will join shortly.",
    closedTicketLabel: "Ticket closed",
    closingAction: "Closing...",
    closeTicketAction: "Close ticket",
  },

  KZ: {
    statusLabel: {
      new: "Күтуде",
      in_progress: "Қаралуда",
      closed: "Жабық",
    },
    ticketNotFound: "Өтініш табылмады.",
    loadError: "Өтінішті жүктеу мүмкін болмады.",
    newSupportMessageTitle: "Қолдаудан жаңа хабар",
    newSupportMessageFallback: "Диалогты тексеріңіз",
    messageSendError: "Хабарды жіберу мүмкін болмады.",
    closeError: "Өтінішті жабу мүмкін болмады.",
    supportAuthorName: "Қолдау",
    userAuthorName: "Пайдаланушы",
    supportRole: "Қолдау",
    userRole: "Пайдаланушы",
    messagesTitle: "Хабарламалар",
    untitled: "Тақырыбы жоқ",
    messagesCountSuffix: "хабар",
    refreshing: "Жаңартып жатырмыз",
    popupAction: "Қалқымалы терезе",
    windowAction: "Терезе",
    closeAction: "Жабу",
    noMessages: "Хабарламалар әлі жоқ.",
    newMessageLabel: "Жаңа хабарлама",
    closedPlaceholder: "Өтініш жабық",
    messagePlaceholder: "Нақтылау немесе жауап жазыңыз",
    sendingAction: "Жіберілуде...",
    sendAction: "Жіберу",
    backToForm: "Формаға оралу",
    supportHistory: "Қолдау тарихы",
    ticketLabel: "Өтініш",
    autoCloseNote:
      "48 сағат ішінде жаңа хабар болмаса, өтініш автоматты түрде жабылады.",
    detailsTitle: "Өтініш деректері",
    contactLabel: "Байланыс:",
    emailLabel: "Email:",
    createdLabel: "Жасалған:",
    updatedLabel: "Соңғы жаңарту:",
    categoryLabel: "Санат:",
    inProgressTitle: "Өтініш қаралуда",
    inQueueMessage: "Өтініш кезекте. Маман жақын арада қосылады.",
    closedTicketLabel: "Өтініш жабық",
    closingAction: "Жабылып жатыр...",
    closeTicketAction: "Өтінішті жабу",
  },
} as const;


const resolveLocale = (language: string) =>
  language === "KZ" ? "kk-KZ" : language === "RU" ? "ru-RU" : "en-US";

const formatDateTime = (
  value: string | undefined,
  formatter: Intl.DateTimeFormat,
) => {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return formatter.format(date);
};

const formatTime = (
  value: string | undefined,
  formatter: Intl.DateTimeFormat,
) => {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return formatter.format(date);
};

export default function SupportTicketPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { language } = useLanguage();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messageIdsRef = useRef<Set<string>>(new Set());
  const bootstrappedMessagesRef = useRef(false);
  const notify = useCallback((title: string, description?: string) => {
    if (typeof window === "undefined") {
      return;
    }
    window.setTimeout(() => {
      toast(title, description ? { description } : undefined);
    }, 0);
  }, []);

  const ticketId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const isDialogView = searchParams?.get("dialog") === "1";

  const copy = useMemo(
    () => copyByLanguage[language] ?? copyByLanguage.RU,
    [language],
  );

  const locale = useMemo(() => resolveLocale(language), [language]);
  const dateTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    [locale],
  );
  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        hour: "2-digit",
        minute: "2-digit",
      }),
    [locale],
  );

  const loadTicket = useCallback(
    async (signal?: AbortSignal, options?: { silent?: boolean }) => {
      if (!ticketId) {
        return;
      }
      const silent = options?.silent ?? false;
      if (!silent) {
        setLoading(true);
        setError(null);
      } else {
        setRefreshing(true);
      }
      try {
        const [info, list] = await Promise.all([
          fetchTicketInfo(ticketId, { signal }),
          fetchTicketMessages(ticketId, { signal }),
        ]);
        if (signal?.aborted) {
          return;
        }
        const mapped = info ? mapTicket(info) : null;
        setTicket(mapped);
        setMessages(mapTicketMessages(list));
        if (!mapped && !silent) {
          setError(copy.ticketNotFound);
        }
      } catch (err) {
        if (!signal?.aborted && !silent) {
          setError(copy.loadError);
        }
      } finally {
        if (!signal?.aborted && !silent) {
          setLoading(false);
        }
        if (!signal?.aborted && silent) {
          setRefreshing(false);
        }
      }
    },
    [ticketId, copy],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadTicket(controller.signal);
    return () => controller.abort();
  }, [loadTicket]);

  useEffect(() => {
    if (!ticketId) {
      return;
    }
    bootstrappedMessagesRef.current = false;
    messageIdsRef.current = new Set();
  }, [ticketId]);

  useEffect(() => {
    if (!ticketId) {
      return;
    }
    const interval = window.setInterval(() => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState !== "visible"
      ) {
        return;
      }
      void loadTicket(undefined, { silent: true });
    }, 5000);
    return () => window.clearInterval(interval);
  }, [ticketId, loadTicket]);

  useEffect(() => {
    if (!messages.length) {
      return;
    }
    const seen = messageIdsRef.current;
    if (!bootstrappedMessagesRef.current) {
      messages.forEach((message) => seen.add(message.id));
      bootstrappedMessagesRef.current = true;
      return;
    }
    const newMessages = messages.filter((message) => !seen.has(message.id));
    if (!newMessages.length) {
      return;
    }
    newMessages.forEach((message) => seen.add(message.id));
    if (newMessages.some((message) => message.isStaff)) {
      notify(
        copy.newSupportMessageTitle,
        ticket?.subject || copy.newSupportMessageFallback,
      );
    }
  }, [messages, notify, ticket?.subject, copy]);

  useEffect(() => {
    if (!messagesEndRef.current) {
      return;
    }
    messagesEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const handleSend = async () => {
    if (!ticketId || sending || ticket?.status === "closed") {
      return;
    }
    const trimmed = messageText.trim();
    if (!trimmed) {
      return;
    }
    setSending(true);
    setError(null);
    try {
      await createTicketMessage(ticketId, trimmed);
      setMessageText("");
      await loadTicket(undefined, { silent: true });
    } catch (err) {
      setError(copy.messageSendError);
    } finally {
      setSending(false);
    }
  };

  const handleClose = async () => {
    if (!ticketId || closing || ticket?.status === "closed") {
      return;
    }
    setClosing(true);
    setError(null);
    try {
      await closeTicket(ticketId);
      await loadTicket(undefined, { silent: true });
    } catch (err) {
      setError(copy.closeError);
    } finally {
      setClosing(false);
    }
  };

  const status = ticket?.status ?? "new";
  const isClosed = status === "closed";

  const resolveAuthorName = (message: TicketMessage) => {
    if (message.authorName) {
      return message.authorName;
    }
    if (message.isStaff) {
      return copy.supportAuthorName;
    }
    return copy.userAuthorName;
  };

  const resolveAuthorRole = (message: TicketMessage) => {
    if (message.authorRole && message.authorRole.trim()) {
      return message.authorRole.trim();
    }
    return message.isStaff ? copy.supportRole : copy.userRole;
  };

  const getInitials = (value: string) => {
    const parts = value.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) {
      return "U";
    }
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  };

  const currentUserId = user?.uid;
  const [dialogOpen, setDialogOpen] = useState(false);

  const openDialogWindow = () => {
    if (typeof window === "undefined") {
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.set("dialog", "1");
    window.open(url.toString(), "_blank", "noopener,noreferrer");
  };

  const renderConversation = ({
    variant,
    onClose,
  }: {
    variant: "page" | "modal" | "window";
    onClose?: () => void;
  }) => {
    const isModal = variant === "modal";
    const isWindow = variant === "window";
    const maxHeightClass =
      variant === "page" ? "max-h-[360px]" : "max-h-[60vh]";
    const showSkeleton = loading && messages.length === 0;

    return (
      <section className="rounded-3xl border border-border/70 bg-card/90 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">{copy.messagesTitle}</p>
            <p className="text-xs text-muted-foreground">
              {ticket?.subject || copy.untitled}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {`${messages.length} ${copy.messagesCountSuffix}`}
            </span>
            {refreshing ? (
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-foreground/60" />
                {copy.refreshing}
              </span>
            ) : null}
            {!isModal && !isWindow ? (
              <button
                type="button"
                onClick={() => setDialogOpen(true)}
                className="inline-flex items-center gap-2 rounded-full border border-border/70 px-3 py-1 text-xs font-semibold transition-all duration-300 hover:bg-foreground hover:text-background"
              >
                <Maximize2 className="h-3.5 w-3.5" />
                {copy.popupAction}
              </button>
            ) : null}
            {!isWindow ? (
              <button
                type="button"
                onClick={openDialogWindow}
                className="inline-flex items-center gap-2 rounded-full border border-border/70 px-3 py-1 text-xs font-semibold transition-all duration-300 hover:bg-foreground hover:text-background"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {copy.windowAction}
              </button>
            ) : null}
            {isModal && onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-2 rounded-full border border-border/70 px-3 py-1 text-xs font-semibold transition-all duration-300 hover:bg-foreground hover:text-background"
              >
                <X className="h-3.5 w-3.5" />
                {copy.closeAction}
              </button>
            ) : null}
          </div>
        </div>

        {error ? (
          <p className="mt-4 rounded-2xl border border-foreground/10 bg-foreground/5 px-4 py-3 text-sm">
            {error}
          </p>
        ) : null}

        <div
          className={cn("mt-4 space-y-4 overflow-y-auto pr-2", maxHeightClass)}
        >
          {showSkeleton ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={`skeleton-${index}`}
                  className={cn(
                    "flex items-start gap-3",
                    index % 2 === 0 ? "justify-start" : "justify-end",
                  )}
                >
                  <div className="h-9 w-9 rounded-full bg-muted/60 animate-pulse" />
                  <div className="h-16 w-[70%] rounded-2xl bg-muted/60 animate-pulse" />
                </div>
              ))}
            </div>
          ) : messages.length ? (
            <AnimatePresence initial={false}>
              {messages.map((message) => {
                const isMine =
                  currentUserId != null && message.authorId != null
                    ? String(currentUserId) === String(message.authorId)
                    : false;
                const authorLabel = resolveAuthorName(message);
                const roleLabel = resolveAuthorRole(message);
                const initials = getInitials(authorLabel);
                const authorId =
                  message.authorId != null ? String(message.authorId) : "";
                const canLinkAuthor = Boolean(authorId) && !message.isStaff;
                const bubbleClass = isMine
                  ? "bg-foreground text-background"
                  : message.isStaff
                    ? "border border-foreground/15 bg-background"
                    : "bg-muted/80";
                const metaTextClass = isMine
                  ? "text-background/70"
                  : "text-muted-foreground";
                const nameClass = isMine
                  ? "text-background"
                  : "text-foreground";
                const roleClass = isMine
                  ? "border border-background/30 text-background/80"
                  : "border border-border/60 text-muted-foreground";

                return (
                  <motion.div
                    key={message.id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2 }}
                    className={cn(
                      "flex items-start gap-3",
                      isMine ? "justify-end" : "justify-start",
                    )}
                  >
                    {!isMine ? (
                      <Avatar className="h-9 w-9">
                        <AvatarFallback
                          className={cn(
                            "text-xs font-semibold",
                            message.isStaff && "bg-foreground text-background",
                          )}
                        >
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                    ) : null}
                    <div
                      className={cn(
                        "max-w-[80%] rounded-2xl px-4 py-3 text-sm",
                        bubbleClass,
                      )}
                    >
                      <div
                        className={cn(
                          "flex flex-wrap items-center gap-2 text-xs",
                          metaTextClass,
                        )}
                      >
                        {canLinkAuthor ? (
                          <Link
                            href={`/users/${authorId}`}
                            className={cn(
                              "font-semibold hover:underline",
                              nameClass,
                            )}
                          >
                            {authorLabel}
                          </Link>
                        ) : (
                          <span className={cn("font-semibold", nameClass)}>
                            {authorLabel}
                          </span>
                        )}
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em]",
                            roleClass,
                          )}
                        >
                          {roleLabel}
                        </span>
                        <span>
                          {formatTime(message.createdAt, timeFormatter)}
                        </span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm">
                        {message.message}
                      </p>
                    </div>
                    {isMine ? (
                      <Avatar className="h-9 w-9">
                        <AvatarFallback
                          className={cn(
                            "text-xs font-semibold",
                            message.isStaff && "bg-foreground text-background",
                          )}
                        >
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                    ) : null}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          ) : (
            <p className="text-sm text-muted-foreground">{copy.noMessages}</p>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="mt-5 space-y-3">
          <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            {copy.newMessageLabel}
          </label>
          <textarea
            rows={3}
            value={messageText}
            onChange={(event) => setMessageText(event.target.value)}
            placeholder={
              isClosed ? copy.closedPlaceholder : copy.messagePlaceholder
            }
            disabled={isClosed}
            className="w-full resize-none rounded-2xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20 disabled:opacity-60"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || isClosed || !messageText.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-foreground/30 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Send className="h-4 w-4" />
            {sending ? copy.sendingAction : copy.sendAction}
          </button>
        </div>
      </section>
    );
  };

  if (isDialogView) {
    return (
      <div className="min-h-screen bg-background text-foreground px-4 py-6">
        <div className="mx-auto w-full max-w-4xl">
          {loading ? (
            <div className="h-64 rounded-3xl bg-muted/60 animate-pulse" />
          ) : (
            renderConversation({ variant: "window" })
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="pt-24 pb-12 px-4 sm:pt-28 sm:pb-16 sm:px-6">
        <div className="container mx-auto max-w-6xl space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-3"
          >
            <div className="flex flex-wrap items-center gap-4">
              <Link
                href="/support"
                className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                {copy.backToForm}
              </Link>
              <Link
                href="/support/history"
                className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
              >
                {copy.supportHistory}
              </Link>
            </div>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                  {copy.ticketLabel} #{ticket?.id ?? ticketId}
                </p>
                <h1 className="text-2xl font-bold sm:text-3xl">
                  {ticket?.subject || copy.untitled}
                </h1>
              </div>
              <span
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold",
                  statusStyles[status],
                )}
              >
                {copy.statusLabel[status]}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {copy.autoCloseNote}
            </p>
          </motion.div>

          {loading ? (
            <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
              <div className="h-64 rounded-3xl bg-muted/60 animate-pulse" />
              <div className="h-64 rounded-3xl bg-muted/60 animate-pulse" />
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
              <motion.section
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.05 }}
                className="rounded-3xl border border-border/70 bg-card/90 p-6"
              >
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    <MessageSquare className="h-4 w-4" />
                    {copy.detailsTitle}
                  </div>
                  <div className="grid gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <UserCircle2 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        {copy.contactLabel}
                      </span>
                      <span className="font-semibold">
                        {ticket?.requester?.name ||
                          user?.displayName ||
                          user?.username ||
                          "-"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        {copy.emailLabel}
                      </span>
                      <span className="font-semibold">
                        {ticket?.requester?.email || user?.email || "-"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        {copy.createdLabel}
                      </span>
                      <span className="font-semibold">
                        {formatDateTime(ticket?.createdAt, dateTimeFormatter)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        {copy.updatedLabel}
                      </span>
                      <span className="font-semibold">
                        {formatDateTime(
                          ticket?.updatedAt || ticket?.lastMessageAt,
                          dateTimeFormatter,
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Lock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        {copy.categoryLabel}
                      </span>
                      <span className="font-semibold">
                        {ticket?.category || "-"}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/60 bg-background/70 p-4 text-sm">
                    {ticket?.assignee?.name ? (
                      <div className="space-y-1">
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          {copy.inProgressTitle}
                        </p>
                        <p className="font-semibold">{ticket.assignee.name}</p>
                      </div>
                    ) : (
                      <p className="text-muted-foreground">
                        {copy.inQueueMessage}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={closing || isClosed}
                    className="inline-flex items-center justify-center rounded-full border border-border/70 px-4 py-2 text-sm font-semibold transition-all duration-300 hover:bg-foreground hover:text-background disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isClosed
                      ? copy.closedTicketLabel
                      : closing
                        ? copy.closingAction
                        : copy.closeTicketAction}
                  </button>
                </div>
              </motion.section>

              <motion.section
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
              >
                {renderConversation({ variant: "page" })}
              </motion.section>
            </div>
          )}
        </div>
      </main>

      {dialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
          <button
            type="button"
            onClick={() => setDialogOpen(false)}
            className="absolute inset-0 bg-background/50 backdrop-blur-md"
            aria-label="Close dialog"
          />
          <div className="relative w-full max-w-4xl">
            {renderConversation({
              variant: "modal",
              onClose: () => setDialogOpen(false),
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
