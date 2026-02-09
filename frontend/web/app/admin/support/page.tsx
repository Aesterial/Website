"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
  CalendarDays,
  Check,
  ChevronDown,
  ExternalLink,
  Globe,
  Lock,
  LogOut,
  Maximize2,
  MessageSquare,
  Send,
  ShieldCheck,
  UserCheck,
  UserCircle2,
  X,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { useAuth } from "@/components/auth-provider";
import { useLanguage } from "@/components/language-provider";
import {
  acceptTicket,
  closeTicket,
  createTicketMessage,
  fetchTicketInfo,
  fetchTicketMessages,
  fetchTicketsALL,
  ApiError,
} from "@/lib/api";
import {
  mapTicket,
  mapTicketMessages,
  type Ticket,
  type TicketMessage,
  type TicketStatus,
} from "@/lib/tickets";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const statusLabel: Record<TicketStatus, string> = {
  new: "Ожидает",
  in_progress: "В работе",
  closed: "Закрыто",
};

const statusStyles: Record<TicketStatus, string> = {
  new: "bg-foreground/5 text-foreground",
  in_progress: "bg-foreground text-background",
  closed: "border border-foreground/15 text-muted-foreground",
};

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

const areMessagesEqual = (prev: TicketMessage[], next: TicketMessage[]) => {
  if (prev === next) {
    return true;
  }
  if (prev.length !== next.length) {
    return false;
  }
  for (let index = 0; index < prev.length; index += 1) {
    const a = prev[index];
    const b = next[index];
    const avatarA = a.avatar;
    const avatarB = b.avatar;
    if (
      a.id !== b.id ||
      a.message !== b.message ||
      a.createdAt !== b.createdAt ||
      a.authorId !== b.authorId ||
      a.authorName !== b.authorName ||
      a.authorRole !== b.authorRole ||
      a.isStaff !== b.isStaff ||
      avatarA?.url !== avatarB?.url ||
      avatarA?.contentType !== avatarB?.contentType ||
      avatarA?.data !== avatarB?.data ||
      avatarA?.key !== avatarB?.key
    ) {
      return false;
    }
  }
  return true;
};

const areTicketsEqual = (a: Ticket | null, b: Ticket | null) => {
  if (a === b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  return (
    a.id === b.id &&
    a.subject === b.subject &&
    a.category === b.category &&
    a.status === b.status &&
    a.createdAt === b.createdAt &&
    a.updatedAt === b.updatedAt &&
    a.closedAt === b.closedAt &&
    a.lastMessageAt === b.lastMessageAt &&
    a.requester?.id === b.requester?.id &&
    a.requester?.name === b.requester?.name &&
    a.requester?.email === b.requester?.email &&
    a.assignee?.id === b.assignee?.id &&
    a.assignee?.name === b.assignee?.name
  );
};

export default function AdminSupportPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { logout, user } = useAuth();
  const { language, setLanguage } = useLanguage();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [messageText, setMessageText] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [sending, setSending] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [closing, setClosing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [refreshingList, setRefreshingList] = useState(false);
  const [refreshingDetails, setRefreshingDetails] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesScrollRef = useRef<HTMLDivElement | null>(null);
  const shouldStickToBottomRef = useRef(true);
  const pendingScrollRef = useRef(false);
  const messageIdsRef = useRef<Set<string>>(new Set());
  const bootstrappedMessagesRef = useRef(false);
  const ticketIdsRef = useRef<Set<string>>(new Set());
  const bootstrappedTicketsRef = useRef(false);
  const lastSelectedIdRef = useRef<string | null>(null);
  const notify = useCallback((title: string, description?: string) => {
    if (typeof window === "undefined") {
      return;
    }
    window.setTimeout(() => {
      toast(title, description ? { description } : undefined);
    }, 0);
  }, []);

  const displayName = user?.displayName || user?.username || "";
  const initials = (displayName || "A").slice(0, 2).toUpperCase();
  const currentName = displayName || user?.username || "";
  const currentUserId = user?.uid;
  const canViewAllAccepted = user?.rank?.name === "developer";

  const languageOptions = [
    { code: "RU" as const, label: "RU" },
    { code: "EN" as const, label: "EN" },
    { code: "KZ" as const, label: "KZ" },
  ];

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

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  const isDialogView = searchParams?.get("dialog") === "1";
  const dialogTicketId = searchParams?.get("ticket");

  const isAssignedToCurrentUser = useCallback(
    (ticket: Ticket) => {
      const assignee = ticket.assignee;
      if (!assignee) {
        return false;
      }
      if (currentUserId != null && assignee.id != null) {
        return String(currentUserId) === String(assignee.id);
      }
      if (currentName && assignee.name) {
        return currentName === assignee.name;
      }
      return false;
    },
    [currentName, currentUserId],
  );

  const canOpenTicket = useCallback(
    (ticket: Ticket) => {
      if (!ticket.assignee) {
        return true;
      }
      if (isAssignedToCurrentUser(ticket)) {
        return true;
      }
      return canViewAllAccepted;
    },
    [canViewAllAccepted, isAssignedToCurrentUser],
  );

  const loadTickets = useCallback(
    async (signal?: AbortSignal, options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false;
      if (!silent) {
        setLoadingList(true);
        setError(null);
      } else {
        setRefreshingList(true);
      }
      try {
        const list = await fetchTicketsALL({ signal });
        if (signal?.aborted) {
          return;
        }
        const mapped = list
          .map((item) => mapTicket(item))
          .filter((item): item is Ticket => Boolean(item));
        setTickets(mapped);
      } catch (err) {
        if (!signal?.aborted && !silent) {
          setError("Не удалось загрузить обращения.");
          setTickets([]);
        }
      } finally {
        if (!signal?.aborted && !silent) {
          setLoadingList(false);
        }
        if (!signal?.aborted && silent) {
          setRefreshingList(false);
        }
      }
    },
    [],
  );

  const loadDetails = useCallback(
    async (
      id: string,
      signal?: AbortSignal,
      options?: { silent?: boolean },
    ) => {
      const silent = options?.silent ?? false;
      if (!silent) {
        setLoadingDetails(true);
        setError(null);
      } else {
        setRefreshingDetails(true);
      }
      try {
        const [info, list] = await Promise.all([
          fetchTicketInfo(id, { signal }),
          fetchTicketMessages(id, { signal }),
        ]);
        if (signal?.aborted) {
          return;
        }
        const mapped = info ? mapTicket(info) : null;
        const fallback = tickets.find((ticket) => ticket.id === id) ?? null;
        setSelectedTicket((prev) => {
          const nextTicket = mapped ?? fallback;
          return areTicketsEqual(prev, nextTicket) ? prev : nextTicket;
        });
        const nextMessages = mapTicketMessages(list);
        setMessages((prev) =>
          areMessagesEqual(prev, nextMessages) ? prev : nextMessages,
        );
      } catch (err) {
        if (!signal?.aborted && !silent) {
          setError("Не удалось загрузить данные обращения.");
          setMessages([]);
        }
      } finally {
        if (!signal?.aborted && !silent) {
          setLoadingDetails(false);
        }
        if (!signal?.aborted && silent) {
          setRefreshingDetails(false);
        }
      }
    },
    [tickets],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadTickets(controller.signal);
    return () => controller.abort();
  }, [loadTickets]);

  useEffect(() => {
    bootstrappedMessagesRef.current = false;
    messageIdsRef.current = new Set();
    pendingScrollRef.current = true;
  }, [selectedId]);

  useEffect(() => {
    if (!tickets.length) {
      return;
    }
    const seen = ticketIdsRef.current;
    if (!bootstrappedTicketsRef.current) {
      tickets.forEach((ticket) => seen.add(ticket.id));
      bootstrappedTicketsRef.current = true;
      return;
    }
    const newTickets = tickets.filter((ticket) => !seen.has(ticket.id));
    if (!newTickets.length) {
      return;
    }
    newTickets.forEach((ticket) => seen.add(ticket.id));
    notify(
      "Новое обращение в поддержке",
      newTickets[0]?.subject || "Проверьте очередь",
    );
  }, [notify, tickets]);

  useEffect(() => {
    if (!selectedId || !messages.length) {
      return;
    }
    const seen = messageIdsRef.current;
    if (!bootstrappedMessagesRef.current) {
      messages.forEach((message) => seen.add(message.id));
      bootstrappedMessagesRef.current = true;
      pendingScrollRef.current = true;
      return;
    }
    const newMessages = messages.filter((message) => !seen.has(message.id));
    if (!newMessages.length) {
      return;
    }
    newMessages.forEach((message) => seen.add(message.id));
    pendingScrollRef.current = true;
    if (newMessages.some((message) => !message.isStaff)) {
      notify(
        "Новое сообщение от пользователя",
        selectedTicket?.subject || "Проверьте диалог",
      );
    }
  }, [messages, notify, selectedId, selectedTicket?.subject]);

  useEffect(() => {
    if (!messagesEndRef.current || !pendingScrollRef.current) {
      return;
    }
    if (shouldStickToBottomRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }
    pendingScrollRef.current = false;
  }, [messages]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState !== "visible"
      ) {
        return;
      }
      void loadTickets(undefined, { silent: true });
      if (selectedId) {
        void loadDetails(selectedId, undefined, { silent: true });
      }
    }, 5000);
    return () => window.clearInterval(interval);
  }, [loadTickets, loadDetails, selectedId]);

  useEffect(() => {
    if (!dialogTicketId) {
      return;
    }
    if (selectedId !== dialogTicketId) {
      setSelectedId(dialogTicketId);
    }
  }, [dialogTicketId, selectedId]);

  const firstAvailableId = useMemo(
    () => tickets.find((ticket) => canOpenTicket(ticket))?.id ?? null,
    [tickets, canOpenTicket],
  );

  useEffect(() => {
    if (!tickets.length) {
      setSelectedId(null);
      setSelectedTicket(null);
      setMessages([]);
      setNotice(null);
      return;
    }
    if (!selectedId) {
      setSelectedId(firstAvailableId);
      return;
    }
    const activeTicket = tickets.find((ticket) => ticket.id === selectedId);
    if (!activeTicket) {
      setSelectedId(firstAvailableId);
      return;
    }
    setSelectedTicket((prev) =>
      areTicketsEqual(prev, activeTicket) ? prev : activeTicket,
    );
    if (selectedId !== lastSelectedIdRef.current) {
      setMessageText("");
    }
    if (!canOpenTicket(activeTicket)) {
      setNotice("Обращение уже принято другим администратором.");
      setMessages([]);
      return;
    }
    setNotice(null);
    const controller = new AbortController();
    void loadDetails(activeTicket.id, controller.signal);
    lastSelectedIdRef.current = selectedId;
    return () => controller.abort();
  }, [tickets, selectedId, firstAvailableId, canOpenTicket, loadDetails]);

  const handleSelect = (ticket: Ticket) => {
    if (!canOpenTicket(ticket)) {
      setNotice("Обращение уже принято другим администратором.");
    } else {
      setNotice(null);
    }
    setSelectedId(ticket.id);
  };

  const handleAccept = async () => {
    if (!selectedTicket || accepting || selectedTicket.status === "closed") {
      return;
    }
    if (selectedTicket.assignee) {
      return;
    }
    setAccepting(true);
    setError(null);
    try {
      await acceptTicket(selectedTicket.id);
      await Promise.all([
        loadTickets(undefined, { silent: true }),
        loadDetails(selectedTicket.id, undefined, { silent: true }),
      ]);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setNotice("Обращение уже принято другим администратором.");
        await Promise.all([
          loadTickets(undefined, { silent: true }),
          loadDetails(selectedTicket.id, undefined, { silent: true }),
        ]);
      } else {
        setError("Не удалось принять обращение.");
      }
    } finally {
      setAccepting(false);
    }
  };

  const handleSend = async () => {
    if (
      !selectedTicket ||
      sending ||
      notice ||
      selectedTicket.status === "closed"
    ) {
      return;
    }
    const trimmed = messageText.trim();
    if (!trimmed) {
      return;
    }
    setSending(true);
    setError(null);
    try {
      await createTicketMessage(selectedTicket.id, trimmed);
      setMessageText("");
      await Promise.all([
        loadTickets(undefined, { silent: true }),
        loadDetails(selectedTicket.id, undefined, { silent: true }),
      ]);
    } catch (err) {
      setError("Не удалось отправить сообщение.");
    } finally {
      setSending(false);
    }
  };

  const handleClose = async () => {
    if (
      !selectedTicket ||
      closing ||
      selectedTicket.status === "closed" ||
      notice
    ) {
      return;
    }
    setClosing(true);
    setError(null);
    try {
      await closeTicket(selectedTicket.id);
      await Promise.all([
        loadTickets(undefined, { silent: true }),
        loadDetails(selectedTicket.id, undefined, { silent: true }),
      ]);
    } catch (err) {
      setError("Не удалось закрыть обращение.");
    } finally {
      setClosing(false);
    }
  };

  const resolveAuthorName = (message: TicketMessage) => {
    if (message.authorName) {
      return message.authorName;
    }
    if (message.isStaff) {
      return "Поддержка";
    }
    return "Пользователь";
  };

  const resolveAuthorRole = (message: TicketMessage) => {
    if (message.authorRole && message.authorRole.trim()) {
      return message.authorRole.trim();
    }
    return message.isStaff ? "Поддержка" : "Пользователь";
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

  const resolveAvatarSrc = (
    avatar?: { url?: string; contentType?: string; data?: string } | null,
  ) => {
    if (!avatar) {
      return "";
    }
    if (avatar.url) {
      return avatar.url;
    }
    if (avatar.contentType && avatar.data) {
      return `data:${avatar.contentType};base64,${avatar.data}`;
    }
    return "";
  };

  const selectedStatus = selectedTicket?.status ?? "new";
  const isSelectedClosed = selectedStatus === "closed";

  const openDialogWindow = () => {
    if (typeof window === "undefined" || !selectedTicket) {
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.set("dialog", "1");
    url.searchParams.set("ticket", selectedTicket.id);
    window.open(url.toString(), "_blank", "noopener,noreferrer");
  };

  const renderConversation = ({
    variant,
    onClose,
    framed = true,
  }: {
    variant: "page" | "modal" | "window";
    onClose?: () => void;
    framed?: boolean;
  }) => {
    const isModal = variant === "modal";
    const isWindow = variant === "window";
    const maxHeightClass =
      variant === "page" ? "max-h-[240px]" : "max-h-[60vh]";
    const title = selectedTicket?.subject || "Диалог";
    const showSkeleton = loadingDetails && messages.length === 0;
    const wrapperClass = framed
      ? "rounded-3xl border border-border/70 bg-card/90 p-6"
      : "";

    return (
      <section className={wrapperClass}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">{title}</p>
            {selectedTicket?.category ? (
              <p className="text-xs text-muted-foreground">
                {selectedTicket.category}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {messages.length} шт.
            </span>
            <span
              className={cn(
                "flex min-w-[92px] items-center gap-2 text-xs text-muted-foreground",
                refreshingDetails ? "opacity-100" : "opacity-0",
              )}
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-foreground/60" />
              Обновляем
            </span>
            {!isModal && !isWindow ? (
              <button
                type="button"
                onClick={() => setDialogOpen(true)}
                className="inline-flex items-center gap-2 rounded-full border border-border/70 px-3 py-1 text-xs font-semibold transition-all duration-300 hover:bg-foreground hover:text-background"
              >
                <Maximize2 className="h-3.5 w-3.5" />
                Попап
              </button>
            ) : null}
            {!isWindow ? (
              <button
                type="button"
                onClick={openDialogWindow}
                className="inline-flex items-center gap-2 rounded-full border border-border/70 px-3 py-1 text-xs font-semibold transition-all duration-300 hover:bg-foreground hover:text-background"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Окно
              </button>
            ) : null}
            {isModal && onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-2 rounded-full border border-border/70 px-3 py-1 text-xs font-semibold transition-all duration-300 hover:bg-foreground hover:text-background"
              >
                <X className="h-3.5 w-3.5" />
                Закрыть
              </button>
            ) : null}
          </div>
        </div>

        {showSkeleton ? (
          <div className="mt-4 space-y-3">
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
          <div
            ref={messagesScrollRef}
            onScroll={() => {
              const element = messagesScrollRef.current;
              if (!element) {
                return;
              }
              const distance =
                element.scrollHeight - element.scrollTop - element.clientHeight;
              shouldStickToBottomRef.current = distance < 80;
            }}
            className={cn(
              "mt-4 space-y-4 overflow-y-auto pr-2",
              maxHeightClass,
            )}
          >
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
                const avatarSrc = resolveAvatarSrc(message.avatar);
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
                        {avatarSrc ? (
                          <AvatarImage src={avatarSrc} alt={authorLabel} />
                        ) : null}
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
                        {avatarSrc ? (
                          <AvatarImage src={avatarSrc} alt={authorLabel} />
                        ) : null}
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
            <div ref={messagesEndRef} />
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            Сообщений пока нет.
          </p>
        )}

        <div className="mt-5 space-y-3">
          <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Ответить
          </label>
          <textarea
            rows={3}
            value={messageText}
            onChange={(event) => setMessageText(event.target.value)}
            placeholder={
              isSelectedClosed
                ? "Обращение закрыто"
                : notice
                  ? "Нет доступа к переписке"
                  : "Введите ответ"
            }
            disabled={isSelectedClosed || Boolean(notice)}
            className="w-full resize-none rounded-2xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20 disabled:opacity-60"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSend}
              disabled={
                sending ||
                isSelectedClosed ||
                Boolean(notice) ||
                !messageText.trim()
              }
              className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-foreground/30 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Send className="h-4 w-4" />
              {sending ? "Отправляем..." : "Отправить"}
            </button>
            <button
              type="button"
              onClick={handleClose}
              disabled={closing || isSelectedClosed || Boolean(notice)}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-border/70 px-4 py-2 text-sm font-semibold transition-all duration-300 hover:bg-foreground hover:text-background disabled:cursor-not-allowed disabled:opacity-60"
            >
              <X className="h-4 w-4" />
              {closing ? "Закрываем..." : "Закрыть"}
            </button>
          </div>
        </div>
      </section>
    );
  };

  if (isDialogView) {
    return (
      <div className="min-h-screen bg-background text-foreground px-4 py-6">
        <div className="mx-auto w-full max-w-4xl">
          {loadingList || loadingDetails ? (
            <div className="h-64 rounded-3xl bg-muted/60 animate-pulse" />
          ) : selectedTicket ? (
            renderConversation({ variant: "window" })
          ) : (
            <p className="text-sm text-muted-foreground">
              Выберите обращение, чтобы открыть диалог.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      <div className="pointer-events-none absolute -top-40 right-0 h-[24rem] w-[24rem] rounded-full bg-foreground/5 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-[26rem] w-[26rem] rounded-full bg-foreground/10 blur-3xl" />

      <header
        className="sticky top-0 z-20 border-b border-border/60 bg-background/85 backdrop-blur"
        style={{ top: "var(--maintenance-banner-height)" }}
      >
        <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-4">
            <Link href="/" aria-label="Go to main site">
              <Logo className="h-9 w-9 text-foreground" showText={false} />
            </Link>
            <div>
              <p className="text-lg font-semibold">Админ-панель</p>
              <p className="text-xs text-muted-foreground">
                Поддержка и обращения
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background px-4 py-2 text-sm font-semibold transition-all duration-300 hover:bg-foreground hover:text-background"
                >
                  <Globe className="h-4 w-4" />
                  {language}
                  <ChevronDown className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[90px]">
                {languageOptions.map((option) => (
                  <DropdownMenuItem
                    key={option.code}
                    onClick={() => setLanguage(option.code)}
                  >
                    {option.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-3 rounded-full border border-border/60 bg-card/90 px-4 py-2 text-sm font-semibold transition-all duration-300 hover:bg-foreground hover:text-background"
                >
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="text-xs font-semibold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-semibold">
                    {displayName || user?.username || "admin"}
                  </span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem asChild>
                  <Link href="/account">
                    <ShieldCheck className="h-4 w-4" />
                    Аккаунт
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={(event) => {
                    event.preventDefault();
                    void handleLogout();
                  }}
                >
                  <LogOut className="h-4 w-4" />
                  Выйти
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Link
              href="/admin"
              className="rounded-full border border-border/70 px-4 py-2 text-sm font-semibold transition-all duration-300 hover:bg-foreground hover:text-background"
            >
              Админ-панель
            </Link>
          </div>
        </div>
      </header>

      <main className="px-4 pb-16 pt-8 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-6">
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="rounded-3xl border border-border/70 bg-card/90 p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                  Поддержка
                </p>
                <h1 className="text-2xl font-bold sm:text-3xl">
                  Очередь обращений
                </h1>
                <p className="text-sm text-muted-foreground">
                  Примите обращение и поддерживайте переписку прямо из панели.
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Если в обращении не будет сообщений 48 часов, оно закроется
                  автоматически.
                </p>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-border/70 px-4 py-2 text-sm font-semibold">
                <span>Всего: {loadingList ? "..." : tickets.length}</span>
                <span
                  className={cn(
                    "flex min-w-[92px] items-center gap-2 text-xs text-muted-foreground",
                    refreshingList ? "opacity-100" : "opacity-0",
                  )}
                >
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-foreground/60" />
                  Обновляем
                </span>
              </div>
            </div>
            {notice ? (
              <p className="mt-4 rounded-2xl border border-foreground/10 bg-foreground/5 px-4 py-3 text-sm">
                {notice}
              </p>
            ) : null}
            {error ? (
              <p className="mt-4 rounded-2xl border border-foreground/10 bg-foreground/5 px-4 py-3 text-sm">
                {error}
              </p>
            ) : null}
          </motion.section>

          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05 }}
              className="rounded-3xl border border-border/70 bg-card/90 p-5"
            >
              {loadingList ? (
                <div className="space-y-4">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div
                      key={index}
                      className="h-24 rounded-3xl bg-muted/60 animate-pulse"
                    />
                  ))}
                </div>
              ) : tickets.length ? (
                <div className="space-y-4">
                  {tickets.map((ticket) => {
                    const locked = !canOpenTicket(ticket);
                    return (
                      <motion.button
                        key={ticket.id}
                        type="button"
                        onClick={() => handleSelect(ticket)}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25 }}
                        className={cn(
                          "w-full rounded-3xl border border-border/60 bg-background/70 p-4 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-foreground/30",
                          selectedId === ticket.id &&
                            "ring-2 ring-foreground/15 border-foreground/40",
                          locked && "opacity-60",
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                              {ticket.category || "Без категории"}
                            </p>
                            <p className="mt-2 text-base font-semibold">
                              {ticket.subject || "Без темы"}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {ticket.requester?.name || "Пользователь"} ·{" "}
                              {formatDateTime(
                                ticket.createdAt,
                                dateTimeFormatter,
                              )}
                            </p>
                          </div>
                          <span
                            className={cn(
                              "rounded-full px-3 py-1 text-xs font-semibold",
                              statusStyles[ticket.status],
                            )}
                          >
                            {statusLabel[ticket.status]}
                          </span>
                        </div>
                        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                          {ticket.assignee?.name ? (
                            <span className="flex items-center gap-2">
                              <UserCheck className="h-4 w-4" />В работе:{" "}
                              {ticket.assignee.name}
                            </span>
                          ) : (
                            <span className="flex items-center gap-2">
                              <MessageSquare className="h-4 w-4" />
                              Готово к принятию
                            </span>
                          )}
                          {locked ? (
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Lock className="h-4 w-4" />
                              Закрыто для просмотра
                            </span>
                          ) : null}
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Обращений пока нет.
                </p>
              )}
            </motion.section>

            <motion.aside
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="rounded-3xl border border-border/70 bg-card/90 p-6"
            >
              {selectedTicket ? (
                <div className="space-y-5">
                  <div>
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      <span>{selectedTicket.category || "Без категории"}</span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 font-semibold",
                          statusStyles[selectedStatus],
                        )}
                      >
                        {statusLabel[selectedStatus]}
                      </span>
                    </div>
                    <h2 className="mt-2 text-xl font-semibold">
                      {selectedTicket.subject || "Без темы"}
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Создано:{" "}
                      {formatDateTime(
                        selectedTicket.createdAt,
                        dateTimeFormatter,
                      )}
                    </p>
                  </div>

                  <div className="grid gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <UserCircle2 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Контакт:</span>
                      <span className="font-semibold">
                        {selectedTicket.requester?.name || "Пользователь"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Email:</span>
                      <span className="font-semibold">
                        {selectedTicket.requester?.email || "-"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        Последнее обновление:
                      </span>
                      <span className="font-semibold">
                        {formatDateTime(
                          selectedTicket.updatedAt ||
                            selectedTicket.lastMessageAt,
                          dateTimeFormatter,
                        )}
                      </span>
                    </div>
                  </div>

                  {selectedTicket.assignee?.name ? (
                    <div className="rounded-2xl border border-border/60 bg-background/70 p-4 text-xs text-muted-foreground">
                      В работе:{" "}
                      <span className="font-semibold text-foreground">
                        {selectedTicket.assignee.name}
                      </span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleAccept}
                      disabled={accepting || isSelectedClosed}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-foreground/30 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Check className="h-4 w-4" />
                      {accepting ? "Принимаем..." : "Взять в работу"}
                    </button>
                  )}

                  {renderConversation({ variant: "page", framed: false })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Выберите обращение, чтобы увидеть детали.
                </p>
              )}
            </motion.aside>
          </div>
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
