import type { UIMessage } from "ai";

function clip(value: unknown, max = 600): string {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return text.length > max ? `${text.slice(0, max)}\n…(скорочено)` : text;
}

/** Serializes a conversation (text, tool calls, reasoning) into Markdown. */
export function chatToMarkdown(title: string, messages: UIMessage[]): string {
  const lines: string[] = [`# ${title}`, ""];
  for (const message of messages) {
    lines.push(message.role === "user" ? "## 👤 Користувач" : "## 🤖 Асистент", "");
    for (const part of message.parts) {
      if (part.type === "text") {
        lines.push(part.text, "");
      } else if (part.type === "reasoning" && part.text.trim()) {
        lines.push(`> 💭 _${part.text.trim().replace(/\n/g, "\n> ")}_`, "");
      } else if (part.type === "dynamic-tool") {
        lines.push(`> 🔧 **${part.toolName}**`, ">", "> ```json");
        lines.push(`> ${clip(part.input ?? {}).replace(/\n/g, "\n> ")}`, "> ```");
        if (part.state === "output-available") {
          lines.push(">", "> Результат:", "> ```json");
          lines.push(`> ${clip(part.output).replace(/\n/g, "\n> ")}`, "> ```");
        } else if (part.state === "output-error") {
          lines.push(">", `> ❌ ${part.errorText}`);
        }
        lines.push("");
      }
    }
  }
  return lines.join("\n");
}

export function downloadMarkdown(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
