"use client";

import type { ChatMeta } from "@/lib/chat-store";

interface SidebarProps {
  chats: ChatMeta[];
  activeId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}

export function Sidebar({ chats, activeId, onSelect, onNew, onDelete }: SidebarProps) {
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
            <button
              type="button"
              onClick={() => onSelect(c.id)}
              className="min-w-0 flex-1 truncate text-left"
              title={c.title}
            >
              {c.title}
            </button>
            <button
              type="button"
              onClick={() => onDelete(c.id)}
              className="invisible shrink-0 rounded px-1 text-zinc-400 hover:text-red-500 group-hover:visible"
              title="Видалити чат"
            >
              ✕
            </button>
          </div>
        ))}
      </nav>
    </div>
  );
}
