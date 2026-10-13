"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMeta } from "@/lib/chat-store";

interface SidebarProps {
  chats: ChatMeta[];
  activeId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
}

export function Sidebar({ chats, activeId, onSelect, onNew, onDelete, onRename }: SidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId) inputRef.current?.select();
  }, [editingId]);

  const startEditing = (chat: ChatMeta) => {
    setEditingId(chat.id);
    setDraft(chat.title);
  };

  const commit = () => {
    if (editingId && draft.trim()) onRename(editingId, draft);
    setEditingId(null);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-200 p-3 dark:border-zinc-800">
        <button
          type="button"
          onClick={onNew}
          className="w-full rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          + Новий чат
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto p-2">
        {chats.length === 0 && (
          <p className="px-2 py-4 text-center text-xs text-zinc-400">
            Історія порожня
          </p>
        )}
        {chats.map((c) => (
          <div
            key={c.id}
            className={`group flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm ${
              c.id === activeId
                ? "bg-zinc-200 dark:bg-zinc-800"
                : "hover:bg-zinc-100 dark:hover:bg-zinc-900"
            }`}
          >
            {editingId === c.id ? (
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commit();
                  if (e.key === "Escape") setEditingId(null);
                }}
                className="min-w-0 flex-1 rounded border border-zinc-300 bg-white px-1 py-0.5 text-sm outline-none focus:border-zinc-500 dark:border-zinc-600 dark:bg-zinc-900"
                aria-label="Нова назва чату"
              />
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onSelect(c.id)}
                  onDoubleClick={() => startEditing(c)}
                  className="min-w-0 flex-1 truncate text-left"
                  title={`${c.title} (подвійний клік — перейменувати)`}
                >
                  {c.title}
                </button>
                <button
                  type="button"
                  onClick={() => startEditing(c)}
                  className={`shrink-0 rounded px-1 text-zinc-400 hover:text-zinc-600 group-hover:visible dark:hover:text-zinc-300 max-md:visible ${
                    c.id === activeId ? "visible" : "invisible"
                  }`}
                  title="Перейменувати чат"
                >
                  ✎
                </button>
                {confirmingId === c.id ? (
                  <button
                    type="button"
                    autoFocus
                    onClick={() => {
                      setConfirmingId(null);
                      onDelete(c.id);
                    }}
                    onBlur={() => setConfirmingId(null)}
                    className="shrink-0 rounded bg-red-600 px-1.5 text-xs font-medium text-white"
                    title="Підтвердити видалення"
                  >
                    Точно?
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingId(c.id)}
                    className={`shrink-0 rounded px-1 text-zinc-400 hover:text-red-500 group-hover:visible max-md:visible ${
                      c.id === activeId ? "visible" : "invisible"
                    }`}
                    title="Видалити чат"
                  >
                    ✕
                  </button>
                )}
              </>
            )}
          </div>
        ))}
      </nav>
    </div>
  );
}
