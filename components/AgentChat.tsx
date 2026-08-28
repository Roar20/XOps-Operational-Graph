"use client";

import { useState, useRef, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { runClientTool } from "@/lib/agent/client-tools";

const SUGGESTIONS = [
  "What does this corpus measure, and what can it not measure?",
  "Profile of DATA FABRIC OPERATIONS",
  "INC08178653",
  "Recurring signatures that are suppression candidates",
];

export function AgentChat() {
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, error, addToolResult } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    // Las herramientas sin execute en el servidor caen aquí. Es lo que permite
    // que el agente consulte 719,946 filas que sólo existen en este navegador.
    async onToolCall({ toolCall }) {
      if (toolCall.dynamic) return;
      const output = await runClientTool(toolCall.toolName, toolCall.input as any);
      addToolResult({
        tool: toolCall.toolName,
        toolCallId: toolCall.toolCallId,
        output,
      });
    },
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const busy = status !== "ready";

  const submit = (text: string) => {
    if (!text.trim()) return;
    sendMessage({ text });
    setInput("");
  };

  return (
    <section className="flex h-full flex-col rounded border border-ink-200 bg-white">
      <header className="flex items-center justify-between border-b border-ink-200 px-4 py-2.5">
        <div>
          <div className="label">Operational agent</div>
          <div className="subtle">
            Claude Sonnet 4.6 · read-only · cut-off 2026-08-12
          </div>
        </div>
        <span className="rounded bg-pep-100 px-2 py-0.5 text-[11px] font-semibold text-pep-800">
          QN v2.4.2
        </span>
      </header>

      <div className="scroll-thin flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-ink-700">
              Answers only from what its tools return. Where the figure does not
              exist, it declares the gap instead of estimating it.
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="btn" onClick={() => submit(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className="space-y-1.5">
            <div className="label">{m.role === "user" ? "You" : "Agent"}</div>
            {m.parts.map((part, i) => {
              if (part.type === "text") {
                return (
                  <p key={i} className="whitespace-pre-wrap text-sm text-ink-900">
                    {part.text}
                  </p>
                );
              }
              // Trazabilidad: cada consulta que hizo el agente queda visible.
              if (part.type.startsWith("tool-")) {
                const name = part.type.replace(/^tool-/, "");
                const state = (part as any).state as string;
                return (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded border border-ink-200 bg-pep-50 px-2.5 py-1.5"
                  >
                    <span className="num text-[11px] font-semibold text-pep-800">
                      {name}
                    </span>
                    <span className="subtle">
                      {state === "output-available"
                        ? "queried"
                        : state === "output-error"
                        ? "error"
                        : "querying…"}
                    </span>
                  </div>
                );
              }
              return null;
            })}
          </div>
        ))}

        {error && (
          <p className="text-sm text-bad">
            The query failed. {error.message}
          </p>
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t border-ink-200 p-3">
        <div className="flex gap-2">
          <input
            className="input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit(input);
              }
            }}
            disabled={busy}
            placeholder="Ask about a ticket, a group or a gap…"
          />
          <button
            className="btn btn-active"
            disabled={busy || !input.trim()}
            onClick={() => submit(input)}
          >
            {busy ? "…" : "Send"}
          </button>
        </div>
        <p className="subtle mt-2">
          The agent does not write, notify or open tickets. Every figure it reports
          carries a denominator, a source and a cut-off date.
        </p>
      </div>
    </section>
  );
}
