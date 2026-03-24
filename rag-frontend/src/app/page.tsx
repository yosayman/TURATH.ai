"use client";

import { useState, useRef, useEffect, FormEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import KhaimaParallax from "@/components/ui/KhaimaParallax";
import { sendMessage, generateId, type ChatMessage } from "@/lib/chat-service";

// ─────────────────────────────────────────────────────────────
// Icons (inline SVGs to avoid extra dependencies)
// ─────────────────────────────────────────────────────────────

function SendIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <path d="M22 2 11 13" />
      <path d="m22 2-7 20-4-9-9-4 20-7Z" />
    </svg>
  );
}

function SparklesIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
      <path d="M20 3v4" />
      <path d="M22 5h-4" />
      <path d="M4 17v2" />
      <path d="M5 18H3" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function MoroccanStarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <polygon points="12,2 15,9 22,9 16.5,14 18.5,21 12,17 5.5,21 7.5,14 2,9 9,9" />
    </svg>
  );
}



// ─────────────────────────────────────────────────────────────
// Loading dots component
// ─────────────────────────────────────────────────────────────

function LoadingDots() {
  return (
    <div className="flex items-center gap-1.5 py-2">
      <div className="loading-dot h-2 w-2 rounded-full bg-primary" />
      <div className="loading-dot h-2 w-2 rounded-full bg-primary" />
      <div className="loading-dot h-2 w-2 rounded-full bg-primary" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Message bubble component
// ─────────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div
      className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"} mb-6 animate-in fade-in slide-in-from-bottom-2 duration-300`}
    >
      {/* Avatar */}
      <Avatar
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${
          isUser
            ? "bg-primary/20 border-primary/30"
            : "bg-moroccan-gold/15 border-moroccan-gold/25"
        }`}
      >
        {isUser ? (
          <UserIcon />
        ) : (
          <MoroccanStarIcon />
        )}
      </Avatar>

      {/* Message Content */}
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "glass-card rounded-bl-md"
        }`}
      >
        {isUser ? (
          <p className="text-sm leading-relaxed">{message.content}</p>
        ) : (
          <div className="markdown-content text-sm leading-relaxed">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}

        {/* Timestamp */}
        <p
          className={`mt-2 text-[10px] ${
            isUser ? "text-primary-foreground/50" : "text-muted-foreground/60"
          }`}
        >
          {message.timestamp.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Chat Page
// ─────────────────────────────────────────────────────────────

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  /**
   * Handles sending a message and receiving the AI response.
   */
  async function handleSend(query?: string) {
    const messageText = query || inputValue.trim();
    if (!messageText || isLoading) return;

    // Add user message
    const userMessage: ChatMessage = {
      id: generateId(),
      role: "user",
      content: messageText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      // Call the RAG backend
      const answer = await sendMessage(messageText);

      // Add assistant message
      const assistantMessage: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content: answer,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      // Add error message from assistant
      const errorMessage: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content:
          "⚠️ **Connection Error**\n\nI couldn't reach the backend server. Please make sure:\n\n1. The Spring Boot backend is running on `localhost:8080`\n2. ChromaDB is running on `localhost:8000`\n3. The LLM server is accessible\n\n```\nmvn spring-boot:run\n```",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    handleSend();
  }

  const isEmpty = messages.length === 0;

  return (
    <KhaimaParallax>
      <div className="flex h-screen flex-col overflow-hidden relative z-10 w-full">
      {/* ───── Header ───── */}
      <header className="shrink-0">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            {/* Logo / Brand */}
            <div className="flex h-9 items-center justify-center">
              <img src="/LOGO1.png" alt="Hassani AI Logo" className="h-full w-auto object-contain" />
            </div>
            <div>
              <h1 className="text-sm font-semibold tracking-tight">
                Hassani AI
              </h1>
              <p className="text-[11px] text-muted-foreground">
                Moroccan & Hassani Cultural Expert
              </p>
            </div>
          </div>


        </div>
      </header>

      {/* ───── Chat Area ───── */}
      <main className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="mx-auto max-w-4xl px-4 py-6">
          {isEmpty ? (
            /* ── Empty State ── */
            <div className="flex flex-col items-center justify-center py-20">
              {/* Large logo */}
              <div className="mb-8 flex h-28 items-center justify-center">
                <img src="/LOGO1.png" alt="Hassani AI Logo" className="h-full w-auto object-contain drop-shadow-2xl" />
              </div>

              <h2 className="mb-2 text-2xl font-bold tracking-tight glow-text">
                Hassani AI
              </h2>
              <p className="mb-8 max-w-md text-center text-sm text-muted-foreground leading-relaxed">
                Your AI companion for exploring Moroccan and Hassani culture,
                history, poetry, and traditions. Ask me anything!
              </p>


            </div>
          ) : (
            /* ── Messages List ── */
            <div>
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}

              {/* Loading indicator */}
              {isLoading && (
                <div className="flex gap-3 mb-6 animate-in fade-in duration-200">
                  <Avatar className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-moroccan-gold/15 border-moroccan-gold/25">
                    <MoroccanStarIcon />
                  </Avatar>
                  <div className="glass-card rounded-2xl rounded-bl-md px-4 py-3">
                    <LoadingDots />
                    <p className="text-[10px] text-muted-foreground/40 mt-1">
                      Searching knowledge base…
                    </p>
                  </div>
                </div>
              )}

              {/* Scroll anchor */}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </main>

      {/* ───── Input Bar ───── */}
      <footer className="shrink-0 pb-4">
        <form
          onSubmit={handleSubmit}
          className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-4"
        >
          <div className="relative flex-1">
            <Input
              ref={inputRef}
              id="chat-input"
              type="text"
              placeholder="Ask about Moroccan culture, history, or traditions…"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={isLoading}
              className="h-12 rounded-xl bg-secondary/50 border-border/50 pl-4 pr-4 text-sm placeholder:text-muted-foreground/50 focus-visible:ring-primary/40 transition-all"
            />
          </div>

          <Button
            id="send-button"
            type="submit"
            disabled={isLoading || !inputValue.trim()}
            size="icon"
            className="h-12 w-12 shrink-0 rounded-xl bg-gradient-to-r from-primary to-moroccan-gold text-primary-foreground shadow-lg shadow-primary/20 transition-all duration-200 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 disabled:opacity-40 disabled:shadow-none disabled:translate-y-0"
          >
            <SendIcon />
          </Button>
        </form>

        <p className="mx-auto max-w-4xl px-4 pb-3 text-center text-[10px] text-muted-foreground/40">
          Powered by RAG pipeline — ChromaDB + Fine-tuned LLaMA 3.1
        </p>
      </footer>
      </div>
    </KhaimaParallax>
  );
}
