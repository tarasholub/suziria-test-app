"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import {
  deleteChat,
  renameChat,
  listChats,
  loadChat,
  newChatId,
  saveChat,
  titleFromMessages,
  type ChatMeta,
} from "@/lib/chat-store";
import type { ProviderInfo } from "@/lib/providers";
import { McpPanel } from "./mcp-panel";
import { Sidebar } from "./sidebar";
import { Markdown } from "./markdown";
import { ReasoningPart } from "./reasoning-part";
import { CopyButton } from "./message-actions";
import { ToolPart } from "./tool-part";

const EXAMPLE_PROMPTS = [
  "Що написано на сторінці https://nextjs.org/blog?",
  "Як у Next.js 16 працює revalidateTag? Подивись у свіжій документації.",
  "Розбий на кроки: як мігрувати великий застосунок з Pages Router на App Router?",
  "Знайди в репозиторії vercel/ai відкриті issues про MCP",
  "Які файли лежать у папці sandbox і що в них?",
];

export function ChatApp() {
  const [chats, setChats] = useState<ChatMeta[]>([]);
  const [chatId, setChatId] = useState<string>("");
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [providerId, setProviderIdState] = useState("google");

  const setProviderId = useCallback((id: string) => {
    setProviderIdState(id);
    try {
      localStorage.setItem("mcp-chat:provider", id);
    } catch {
      // storage unavailable (private mode) — selection just won't persist
    }
  }, []);
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);

  // Generated on the client only — crypto.randomUUID is not prerender-safe.
  useEffect(() => {
    // Client-only init: crypto.randomUUID and localStorage are prerender-unsafe,
    // so this must run in an effect; it fires once and cannot cascade.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChatId((id) => id || newChatId());
    setChats(listChats());
  }, []);

  useEffect(() => {
    void fetch("/api/providers")
      .then((r) => r.json())
      .then((data: { providers: ProviderInfo[] }) => {
        setProviders(data.providers);
        const saved = localStorage.getItem("mcp-chat:provider");
        const isAvailable = (id: string | null) =>
          data.providers.some((p) => p.id === id && p.available);
        if (saved && isAvailable(saved)) {
          setProviderIdState(saved);
          return;
        }
        const firstAvailable = data.providers.find((p) => p.available);
        if (firstAvailable) {
          setProviderIdState((current) =>
            isAvailable(current) ? current : firstAvailable.id,
          );
        }
      })
      .catch(() => {});
  }, []);

  const selectChat = useCallback((id: string) => {
    const stored = loadChat(id);
    setInitialMessages(stored?.messages ?? []);
    setChatId(id);
    setLeftOpen(false);
  }, []);

  const startNewChat = useCallback(() => {
    setInitialMessages([]);
    setChatId(newChatId());
    setLeftOpen(false);
  }, []);

  const removeChat = useCallback(
    (id: string) => {
      deleteChat(id);
      setChats(listChats());
      if (id === chatId) startNewChat();
    },
    [chatId, startNewChat],
  );

  const onMessagesPersisted = useCallback(() => {
    setChats(listChats());
  }, []);

  const handleRename = useCallback((id: string, title: string) => {
    renameChat(id, title);
    setChats(listChats());
  }, []);

  return (
    <div className="flex h-dvh overflow-hidden bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      {/* Sidebar: history */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-64 border-r border-zinc-200 bg-white transition-transform dark:border-zinc-800 dark:bg-zinc-950 md:static md:translate-x-0 ${
          leftOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar
          chats={chats}
          activeId={chatId}
          onSelect={selectChat}
          onNew={startNewChat}
          onDelete={removeChat}
          onRename={handleRename}
        />
      </aside>

      {/* Main chat; key remounts useChat per conversation */}
      {chatId === "" ? (
        <main className="flex-1" />
      ) : (
      <ChatView
        key={chatId}
        chatId={chatId}
        initialMessages={initialMessages}
        providers={providers}
        providerId={providerId}
        onProviderChange={setProviderId}
        onToggleLeft={() => setLeftOpen((v) => !v)}
        onToggleRight={() => setRightOpen((v) => !v)}
        onPersist={onMessagesPersisted}
      />
      )}

      {/* MCP panel */}
      <aside
        className={`fixed inset-y-0 right-0 z-30 w-80 border-l border-zinc-200 bg-white transition-transform dark:border-zinc-800 dark:bg-zinc-950 lg:static lg:translate-x-0 ${
          rightOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <McpPanel />
      </aside>

      {/* Mobile overlay */}
      {(leftOpen || rightOpen) && (
        <div
          className="fixed inset-0 z-20 bg-black/30 md:hidden"
          onClick={() => {
            setLeftOpen(false);
            setRightOpen(false);
          }}
        />
      )}
    </div>
  );
}

interface ChatViewProps {
  chatId: string;
  initialMessages: UIMessage[];
  providers: ProviderInfo[];
  providerId: string;
  onProviderChange: (id: string) => void;
  onToggleLeft: () => void;
  onToggleRight: () => void;
  onPersist: () => void;
}

function ChatView({
  chatId,
  initialMessages,
  providers,
  providerId,
  onProviderChange,
  onToggleLeft,
  onToggleRight,
  onPersist,
}: ChatViewProps) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const atBottomRef = useRef(true);
  const [showScrollDown, setShowScrollDown] = useState(false);

  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/chat" }),
    [],
  );

  const { messages, sendMessage, status, error, stop, clearError, regenerate } = useChat({
    id: chatId,
    messages: initialMessages,
    transport,
  });

  // Persist to localStorage whenever messages actually change.
  // Opening a chat (or StrictMode double-running the effect) must NOT bump
  // updatedAt, or the sidebar reorders on every visit — so compare content
  // with what's already stored before saving.
  useEffect(() => {
    if (messages.length === 0) return;
    const stored = loadChat(chatId);
    const unchanged =
      stored !== null &&
      stored.messages.length === messages.length &&
      JSON.stringify(stored.messages.at(-1)) === JSON.stringify(messages.at(-1));
    if (unchanged) return;
    // A manually renamed chat keeps its title; otherwise derive from messages.
    saveChat({
      id: chatId,
      title: stored?.title ?? titleFromMessages(messages),
      updatedAt: Date.now(),
      messages,
    });
    onPersist();
  }, [messages, chatId, onPersist]);

  // Autoscroll only while the user is already at the bottom — don't yank
  // the viewport away from someone reading an earlier message.
  useEffect(() => {
    if (atBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const onMessagesScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    atBottomRef.current = atBottom;
    setShowScrollDown(!atBottom);
  };

  const isBusy = status === "submitted" || status === "streaming";

  const submit = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isBusy) return;
    clearError();
    void sendMessage({ text: trimmed }, { body: { providerId } });
    setInput("");
    atBottomRef.current = true;
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  return (
    <main className="flex min-w-0 flex-1 flex-col">
      {/* Header */}
      <header className="flex items-center gap-2 border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
        <button
          type="button"
          onClick={onToggleLeft}
          className="rounded-lg p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 md:hidden"
          aria-label="Історія чатів"
        >
          ☰
        </button>
        <h1 className="truncate text-sm font-semibold">AI-чат · MCP</h1>
        <div className="ml-auto flex items-center gap-2">
          <select
            value={providerId}
            onChange={(e) => onProviderChange(e.target.value)}
            className="rounded-lg border border-zinc-200 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            aria-label="Модель"
          >
            {providers.length === 0 && <option value="google">Gemini</option>}
            {providers.map((p) => (
              <option key={p.id} value={p.id} disabled={!p.available}>
                {p.label} · {p.model}
                {p.available ? "" : " (нема ключа)"}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={onToggleRight}
            className="rounded-lg p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 lg:hidden"
            aria-label="MCP-сервери"
          >
            ⚙
          </button>
        </div>
      </header>

      {/* Messages */}
      <div className="relative min-h-0 flex-1">
      <div ref={scrollRef} onScroll={onMessagesScroll} className="h-full overflow-y-auto px-4 py-4">
        <div className="mx-auto max-w-3xl space-y-4">
          {messages.length === 0 && (
            <div className="mt-16 text-center">
              <p className="text-lg font-medium">Чим допомогти?</p>
              <p className="mt-1 text-sm text-zinc-500">
                Помічник користується MCP-серверами: fetch, документація, GitHub,
                файли, покрокове мислення.
              </p>
              <div className="mx-auto mt-6 flex max-w-xl flex-wrap justify-center gap-2">
                {EXAMPLE_PROMPTS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => submit(p)}
                    className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message, mi) => (
            <div key={message.id} className="group">
              {message.role === "user" ? (
                <div className="flex justify-end">
                  <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-zinc-900 px-4 py-2.5 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900">
                    {message.parts.map((part, i) =>
                      part.type === "text" ? <span key={i}>{part.text}</span> : null,
                    )}
                  </div>
                </div>
              ) : (
                <div className="max-w-full text-sm leading-relaxed">
                  {message.parts.map((part, i) => {
                    if (part.type === "text") {
                      return <Markdown key={i} text={part.text} />;
                    }
                    if (part.type === "dynamic-tool") {
                      return <ToolPart key={i} part={part} />;
                    }
                    if (part.type === "reasoning") {
                      return <ReasoningPart key={i} part={part} />;
                    }
                    return null;
                  })}
                  {mi === messages.length - 1 && status === "streaming" && (
                    <span className="ml-0.5 inline-block h-4 w-2 animate-pulse bg-zinc-400 align-text-bottom" />
                  )}
                  {status === "ready" && (
                    <div className="mt-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 max-md:opacity-100">
                      <CopyButton
                        text={message.parts
                          .map((part) => (part.type === "text" ? part.text : ""))
                          .join("\n")
                          .trim()}
                      />
                      {mi === messages.length - 1 && (
                        <button
                          type="button"
                          onClick={() => void regenerate()}
                          className="rounded px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                        >
                          ⟳ Ще раз
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {status === "submitted" && (
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <span className="size-3 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent" />
              Думаю…
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
              <span className="font-medium">Помилка:</span> {error.message}
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {showScrollDown && (
        <button
          type="button"
          onClick={() => {
            atBottomRef.current = true;
            setShowScrollDown(false);
            bottomRef.current?.scrollIntoView({ behavior: "smooth" });
          }}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs shadow-md hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
        >
          ↓ Донизу
        </button>
      )}
      </div>

      {/* Input */}
      <form
        className="border-t border-zinc-200 p-3 dark:border-zinc-800"
        onSubmit={(e) => {
          e.preventDefault();
          submit(input);
        }}
      >
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit(input);
              }
            }}
            rows={1}
            placeholder="Спитай щось… (Enter — надіслати)"
            className="max-h-40 min-h-[44px] flex-1 resize-none rounded-xl border border-zinc-200 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:focus:border-zinc-500"
          />
          {isBusy ? (
            <button
              type="button"
              onClick={() => void stop()}
              className="rounded-xl border border-zinc-300 px-4 py-2.5 text-sm hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800"
            >
              Стоп
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
            >
              →
            </button>
          )}
        </div>
      </form>
    </main>
  );
}
