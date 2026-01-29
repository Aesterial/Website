import type { ApiTicket, ApiTicketMessage } from "@/lib/api";

export type TicketStatus = "new" | "in_progress" | "closed";

export type TicketPerson = {
  id?: string | number;
  name?: string;
  email?: string;
  rank?: string;
};

export type Ticket = {
  id: string;
  subject: string;
  category?: string;
  status: TicketStatus;
  createdAt?: string;
  updatedAt?: string;
  closedAt?: string;
  requester?: TicketPerson;
  assignee?: TicketPerson;
  messagesCount?: number;
  lastMessageAt?: string;
};

export type TicketMessage = {
  id: string;
  message: string;
  createdAt?: string;
  authorName?: string;
  authorRole?: string;
  authorId?: string | number;
  isStaff?: boolean;
};

type RecordValue = Record<string, unknown>;

const toRecord = (value: unknown): RecordValue | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as RecordValue)
    : null;

const toStringValue = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

const toNumberValue = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const pickString = (record: RecordValue | null, keys: string[]): string => {
  if (!record) {
    return "";
  }
  for (const key of keys) {
    const value = toStringValue(record[key]);
    if (value) {
      return value;
    }
  }
  return "";
};

const pickRecord = (
  record: RecordValue | null,
  keys: string[],
): RecordValue | null => {
  if (!record) {
    return null;
  }
  for (const key of keys) {
    const candidate = toRecord(record[key]);
    if (candidate) {
      return candidate;
    }
  }
  return null;
};

const pickId = (record: RecordValue | null, keys: string[]): string => {
  if (!record) {
    return "";
  }
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }
  return "";
};

const toDateString = (value: unknown): string => {
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString();
  }
  const record = toRecord(value);
  const seconds = record ? toNumberValue(record.seconds) : null;
  if (seconds !== null) {
    const date = new Date(seconds * 1000);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString();
  }
  return "";
};

const normalizeStatus = (
  value: string,
  options: { closedAt?: string; hasAssignee?: boolean },
): TicketStatus => {
  const normalized = value.trim().toLowerCase();
  if (
    normalized.includes("close") ||
    normalized.includes("resolved") ||
    normalized.includes("done")
  ) {
    return "closed";
  }
  if (
    normalized.includes("progress") ||
    normalized.includes("accept") ||
    normalized.includes("assigned")
  ) {
    return "in_progress";
  }
  if (
    normalized.includes("new") ||
    normalized.includes("open") ||
    normalized.includes("pending")
  ) {
    return "new";
  }
  if (options.closedAt) {
    return "closed";
  }
  if (options.hasAssignee) {
    return "in_progress";
  }
  return "new";
};

const resolvePerson = (
  record: RecordValue | null,
): TicketPerson | undefined => {
  if (!record) {
    return undefined;
  }
  const name =
    pickString(record, [
      "name",
      "displayName",
      "display_name",
      "username",
      "login",
    ]) || undefined;
  const email = pickString(record, ["email", "mail", "address"]) || undefined;
  const id = pickId(record, ["id", "uid", "userID", "user_id"]) || undefined;

  const rawRank = record.rank ?? record.role ?? null;
  let rank = toStringValue(rawRank);
  if (!rank) {
    const rankRecord = toRecord(rawRank);
    rank = pickString(rankRecord, ["name"]);
  }

  const person: TicketPerson = {};
  if (id) {
    person.id = id;
  }
  if (name) {
    person.name = name;
  }
  if (email) {
    person.email = email;
  }
  if (rank) {
    person.rank = rank;
  }

  return Object.keys(person).length ? person : undefined;
};

const staffRoles = new Set([
  "admin",
  "staff",
  "developer",
  "moderator",
  "support",
  "operator",
  "system",
]);

const isStaffRole = (value: string | undefined): boolean => {
  if (!value) {
    return false;
  }
  return staffRoles.has(value.trim().toLowerCase());
};

export const mapTicket = (payload: ApiTicket): Ticket | null => {
  const record = toRecord(payload);
  if (!record) {
    return null;
  }

  const id = pickId(record, [
    "id",
    "ticketId",
    "ticket_id",
    "ticketID",
    "uid",
    "uuid",
  ]);
  if (!id) {
    return null;
  }

  const topic = pickString(record, ["topic", "category", "type", "department"]);
  const brief = pickString(record, [
    "brief",
    "message",
    "content",
    "body",
    "description",
  ]);
  const fallbackSubject =
    brief
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? "";
  const subject =
    pickString(record, ["subject", "title", "theme"]) ||
    fallbackSubject ||
    topic;
  const category = topic || undefined;

  const createdAt = toDateString(
    record.createdAt ??
      record.created_at ??
      record.created ??
      record.createdOn ??
      record.created_on,
  );
  const updatedAt = toDateString(
    record.updatedAt ??
      record.updated_at ??
      record.updated ??
      record.updatedOn ??
      record.updated_on,
  );
  const closedAt = toDateString(
    record.closedAt ??
      record.closed_at ??
      record.closedOn ??
      record.closed_on ??
      record.resolvedAt ??
      record.resolved_at,
  );

  const requesterRecord = pickRecord(record, [
    "requester",
    "author",
    "user",
    "customer",
    "owner",
    "creator",
  ]);
  const requester =
    resolvePerson(requesterRecord) ??
    resolvePerson(
      toRecord(
        record.requester_info ??
          record.requesterInfo ??
          record.user_info ??
          record.userInfo,
      ),
    ) ??
    undefined;

  const assigneeRecord = pickRecord(record, [
    "assignee",
    "assignedTo",
    "assigned_to",
    "acceptedBy",
    "accepted_by",
    "admin",
    "operator",
  ]);
  const assignee = resolvePerson(assigneeRecord);

  const messagesValue =
    record.messages ?? record.messageList ?? record.messages_list;
  const messagesCount = Array.isArray(messagesValue)
    ? messagesValue.length
    : (toNumberValue(
        record.messagesCount ??
          record.messages_count ??
          record.messageCount ??
          record.message_count,
      ) ?? undefined);

  const lastMessageAt = toDateString(
    record.lastMessageAt ??
      record.last_message_at ??
      record.last_message ??
      record.lastMessage,
  );

  const statusSource = pickString(record, ["status", "state"]);
  const status = normalizeStatus(statusSource, {
    closedAt,
    hasAssignee: Boolean(assignee),
  });

  return {
    id,
    subject,
    category: category || undefined,
    status,
    createdAt: createdAt || undefined,
    updatedAt: updatedAt || undefined,
    closedAt: closedAt || undefined,
    requester,
    assignee,
    messagesCount,
    lastMessageAt: lastMessageAt || undefined,
  };
};

type MessageMapOptions = { fallbackId: string };

const mapTicketMessage = (
  payload: ApiTicketMessage,
  options: MessageMapOptions,
): TicketMessage | null => {
  const record = toRecord(payload);
  if (!record) {
    return null;
  }

  const id =
    pickId(record, ["id", "messageId", "message_id", "uid", "uuid"]) ||
    options.fallbackId;
  const message = pickString(record, ["message", "text", "content", "body"]);
  if (!message && !id) {
    return null;
  }

  const createdAt = toDateString(
    record.createdAt ??
      record.created_at ??
      record.at ??
      record.sentAt ??
      record.sent_at ??
      record.timestamp,
  );

  const authorRecord = pickRecord(record, [
    "author",
    "user",
    "sender",
    "from",
    "creator",
    "owner",
  ]);
  const authorSettings = pickRecord(authorRecord, ["settings", "profile"]);
  const authorName =
    pickString(record, [
      "authorName",
      "senderName",
      "name",
      "displayName",
      "display_name",
      "username",
    ]) ||
    pickString(authorSettings, ["displayName", "display_name", "name"]) ||
    pickString(authorRecord, [
      "name",
      "displayName",
      "display_name",
      "username",
      "login",
    ]);

  const authorId =
    pickId(record, ["authorId", "userId", "user_id"]) ||
    pickId(authorRecord, ["id", "uid", "userID", "user_id"]) ||
    undefined;

  let authorRole = pickString(record, [
    "authorRole",
    "role",
    "rank",
    "senderRole",
    "userRole",
  ]);
  if (!authorRole) {
    const rawRole = authorRecord?.role ?? authorRecord?.rank ?? null;
    authorRole = toStringValue(rawRole);
    if (!authorRole) {
      authorRole = pickString(toRecord(rawRole), ["name"]);
    }
  }

  const isStaff =
    Boolean(
      record.fromAdmin ??
      record.from_admin ??
      record.isAdmin ??
      record.is_admin,
    ) || isStaffRole(authorRole);

  return {
    id,
    message,
    createdAt: createdAt || undefined,
    authorName: authorName || undefined,
    authorRole: authorRole || undefined,
    authorId,
    isStaff,
  };
};

export const mapTicketMessages = (
  payload: ApiTicketMessage[],
): TicketMessage[] =>
  payload
    .map((item, index) =>
      mapTicketMessage(item, { fallbackId: `message-${index}` }),
    )
    .filter((item): item is TicketMessage => Boolean(item));
