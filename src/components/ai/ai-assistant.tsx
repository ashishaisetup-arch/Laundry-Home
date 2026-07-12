"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, Send, Trash2, Bot, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "Recommend a vendor for my next order",
  "Estimate price for 5kg wash & fold",
  "Predict delivery time for active order",
  "Forecast weekend demand",
];

export function AiAssistant() {
  const { aiOpen, setAiOpen, aiChat, sendAiMessage, clearAiChat } = useAppStore();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current && aiOpen) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [aiChat, aiOpen]);

  const handleSend = () => {
    if (!input.trim()) return;
    sendAiMessage(input.trim());
    setInput("");
  };

  return (
    <>
      <AnimatePresence>
        {aiOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
              onClick={() => setAiOpen(false)}
            />
            {/* Panel */}
            <motion.div
              initial={{ x: "100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-background border-l border-border shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-border bg-gradient-to-r from-teal-50 via-emerald-50 to-cyan-50 dark:from-teal-950/30 dark:via-emerald-950/30 dark:to-cyan-950/30">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 via-emerald-500 to-cyan-600 shadow-glow">
                      <Sparkles className="h-5 w-5 text-white" />
                    </div>
                    <motion.div
                      className="absolute -inset-1 rounded-xl bg-teal-400 opacity-30 -z-10"
                      animate={{ scale: [1, 1.15, 1], opacity: [0.2, 0.4, 0.2] }}
                      transition={{ duration: 2.5, repeat: Infinity }}
                    />
                  </div>
                  <div>
                    <p className="font-semibold text-sm flex items-center gap-1.5">
                      Laundry Home AI
                      <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    </p>
                    <p className="text-[11px] text-muted-foreground">Powered by GLM · Always learning</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={clearAiChat} title="Clear chat">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setAiOpen(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 p-4" ref={scrollRef as never}>
                <div className="space-y-4">
                  {aiChat.map((msg) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        "flex gap-2.5",
                        msg.role === "user" && "flex-row-reverse"
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                          msg.role === "assistant"
                            ? "bg-gradient-to-br from-teal-500 to-cyan-600 text-white"
                            : "bg-muted text-foreground"
                        )}
                      >
                        {msg.role === "assistant" ? <Bot className="h-4 w-4" /> : <UserIcon className="h-4 w-4" />}
                      </div>
                      <div
                        className={cn(
                          "max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                          msg.role === "assistant"
                            ? "bg-muted text-foreground rounded-tl-sm"
                            : "bg-primary text-primary-foreground rounded-tr-sm"
                        )}
                      >
                        <p className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: formatMarkdown(msg.content) }} />
                        <p className={cn("text-[10px] mt-1", msg.role === "assistant" ? "text-muted-foreground" : "text-primary-foreground/70")}>
                          {msg.time}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Suggestions */}
                {aiChat.length <= 1 && (
                  <div className="mt-6">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Try asking
                    </p>
                    <div className="space-y-1.5">
                      {SUGGESTIONS.map((s) => (
                        <button
                          key={s}
                          onClick={() => sendAiMessage(s)}
                          className="w-full text-left rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-muted hover:border-primary/30 transition-colors"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </ScrollArea>

              {/* Input */}
              <div className="border-t border-border p-3">
                <div className="flex items-end gap-2 rounded-xl border border-border bg-card px-3 py-2 focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary/50 transition-all">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder="Ask about vendors, pricing, predictions…"
                    rows={1}
                    className="flex-1 resize-none bg-transparent outline-none text-sm placeholder:text-muted-foreground max-h-24"
                  />
                  <Button
                    size="icon"
                    className="h-8 w-8 shrink-0 bg-gradient-to-br from-teal-500 to-cyan-600"
                    onClick={handleSend}
                    disabled={!input.trim()}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground/70 text-center mt-2">
                  AI responses are simulated for this demo
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function formatMarkdown(text: string): string {
  // Simple **bold** formatting
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>');
}
