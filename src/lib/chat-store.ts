import type { UIMessage } from "ai";

export interface StoredChat {
  id: string;
  title: string;
  updatedAt: number;
  messages: UIMessage[];
}

export interface ChatMeta {
  id: string;
  title: string;
  updatedAt: number;
}

const INDEX_KEY = "mcp-chat:index";
const chatKey = (id: string) => `mcp-chat:chat:${id}`;

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function listChats(): ChatMeta[] {
  if (typeof window === "undefined") return [];
  const index = safeParse<ChatMeta[]>(localStorage.getItem(INDEX_KEY)) ?? [];
  return index.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function loadChat(id: string): StoredChat | null {
  if (typeof window === "undefined") return null;
  return safeParse<StoredChat>(localStorage.getItem(chatKey(id)));
}

export function saveChat(chat: StoredChat): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(chatKey(chat.id), JSON.stringify(chat));
  const index = listChats().filter((c) => c.id !== chat.id);
  index.unshift({ id: chat.id, title: chat.title, updatedAt: chat.updatedAt });
  localStorage.setItem(INDEX_KEY, JSON.stringify(index));
}

export function deleteChat(id: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(chatKey(id));
  const index = listChats().filter((c) => c.id !== id);
  localStorage.setItem(INDEX_KEY, JSON.stringify(index));
}

export function newChatId(): string {
  return crypto.randomUUID();
}

/** First user message text, trimmed for the sidebar. */
export function titleFromMessages(messages: UIMessage[]): string {
  const firstUser = messages.find((m) => m.role === "user");
  const text = firstUser?.parts
    .map((p) => (p.type === "text" ? p.text : ""))
    .join(" ")
    .trim();
  if (!text) return "Новий чат";
  return text.length > 60 ? `${text.slice(0, 60)}…` : text;
}
