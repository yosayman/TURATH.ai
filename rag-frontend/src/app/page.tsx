"use client";

import dynamic from "next/dynamic";
import {
  memo,
  startTransition,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type FormEvent,
  type RefObject,
} from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import KhaimaParallax from "@/components/ui/KhaimaParallax";
import { sendMessage, generateId, type ChatMessage } from "@/lib/chat-service";

const MarkdownRenderer = dynamic(
  () => import("@/components/ui/markdown-renderer"),
  {
    loading: () => (
      <div className="space-y-2">
        <Skeleton className="h-4 w-full bg-white/10" />
        <Skeleton className="h-4 w-5/6 bg-white/10" />
      </div>
    ),
  }
);

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
      className="h-6 w-6"
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
// Suggested prompts for the empty state
// ─────────────────────────────────────────────────────────────

const SUGGESTED_PROMPTS = [
  {
    title: "التاريخ المغربي",
    prompt: "عاود ليا على الممالك القديمة ديال المغرب",
    icon: "🏛️",
  },
  {
    title: "الشعر الحساني",
    prompt: "شنو هو السر وراء تقاليد شعر التبراع الحساني؟",
    icon: "📜",
  },
  {
    title: "الثقافة الصحراوية",
    prompt: "وصف ليا طقوس جلسة أتاي الأصيلة عند الصحراوة",
    icon: "🍵",
  },
  {
    title: "الطبخ المغربي",
    prompt: "شنو اللي كيخلي الطاجين المغربي مميز فالعالم؟",
    icon: "🫕",
  },
];

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

const MessageBubble = memo(function MessageBubble({
  message,
}: {
  message: ChatMessage;
}) {
  const isUser = message.role === "user";

  return (
    <div
      className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"} mb-6 animate-in fade-in slide-in-from-bottom-2 duration-300`}
    >
      {/* Avatar */}
      <Avatar
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${
          isUser
            ? "user-avatar-shell"
            : "assistant-avatar-shell"
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
            ? "user-bubble rounded-br-md"
            : "glass-card rounded-bl-md"
        }`}
        dir="auto"
      >
        {isUser ? (
          <p className="text-start text-sm leading-relaxed">{message.content}</p>
        ) : (
          <MarkdownRenderer content={message.content} />
        )}

        {/* Timestamp */}
        <p
          dir="ltr"
          className={`mt-2 text-[10px] ${
            isUser
              ? "text-end text-primary-foreground/50"
              : "text-end text-muted-foreground/60"
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
});

const MessagesList = memo(function MessagesList({
  messages,
  isLoading,
  messagesEndRef,
}: {
  messages: ChatMessage[];
  isLoading: boolean;
  messagesEndRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div>
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}

      {isLoading && (
        <div className="mb-6 flex gap-3 animate-in fade-in duration-200">
          <Avatar className="assistant-avatar-shell flex h-8 w-8 shrink-0 items-center justify-center rounded-full border">
            <MoroccanStarIcon />
          </Avatar>
          <div className="glass-card rounded-2xl rounded-bl-md px-4 py-3">
            <LoadingDots />
            <p className="mt-1 text-[10px] text-muted-foreground/40">
              Searching knowledge base…
            </p>
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
});

// ─────────────────────────────────────────────────────────────
// Main Chat Page
// ─────────────────────────────────────────────────────────────

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useEffectEvent(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: messages.length > 1 ? "smooth" : "auto",
    });
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages.length, isLoading]);

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

      startTransition(() => {
        setMessages((prev) => [...prev, assistantMessage]);
      });
    } catch {
      // Add error message from assistant
      const errorMessage: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content:
          "⚠️ **Connection Error**\n\nI couldn't reach the backend server. Please make sure:\n\n1. The Spring Boot backend is running on `localhost:8080`\n2. ChromaDB is running on `localhost:8000`\n3. The LLM server is accessible\n\n```\nmvn spring-boot:run\n```",
        timestamp: new Date(),
      };

      startTransition(() => {
        setMessages((prev) => [...prev, errorMessage]);
      });
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
  const canSend = inputValue.trim().length > 0;

  return (
    <KhaimaParallax>
      <div className="chat-shell relative z-10 flex h-screen w-full flex-col overflow-hidden">
      {/* ───── Header ───── */}
      <header className="shrink-0">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            {/* Logo / Brand */}
            <div className="brand-mark flex h-9 w-9 items-center justify-center rounded-lg">
              <SparklesIcon />
            </div>
            <div>
              <h1 className="text-sm font-semibold tracking-tight">
                Hassani AI
              </h1>
              <p className="text-[11px] text-[color:var(--text-soft)]">
                Moroccan & Hassani Cultural Expert
              </p>
            </div>
          </div>

          {/* Status indicator */}
          <div className="status-pill flex items-center gap-2 text-xs text-[color:var(--text-soft)]">
            <div className="status-dot h-2 w-2 rounded-full" />
            RAG Pipeline Active
          </div>
        </div>
      </header>

      {/* ───── Chat Area ───── */}
      <main className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="mx-auto max-w-4xl px-4 py-6">
          {isEmpty ? (
            /* ── Empty State ── */
            <div className="flex flex-col items-center justify-center py-20">
              {/* Large animated logo */}
              <div className="hero-mark mb-8 flex h-20 w-20 items-center justify-center rounded-2xl">
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-10 w-10 text-moroccan-gold">
                  <polygon points="12,2 15,9 22,9 16.5,14 18.5,21 12,17 5.5,21 7.5,14 2,9 9,9" />
                </svg>
              </div>

              <h2 className="mb-2 text-2xl font-bold tracking-tight glow-text">
                Hassani AI
              </h2>
              <p className="mb-8 max-w-md text-center text-sm text-muted-foreground leading-relaxed">
                Your AI companion for exploring Moroccan and Hassani culture,
                history, poetry, and traditions. Ask me anything!
              </p>

              {/* Suggested prompts row */}
              <div className="prompt-rail w-full max-w-4xl overflow-x-auto pb-3">
                {SUGGESTED_PROMPTS.map((item) => (
                  <button
                    key={item.title}
                    onClick={() => handleSend(item.prompt)}
                    dir="rtl"
                    lang="ar"
                    className="prompt-card group shrink-0 cursor-pointer rounded-xl p-3 text-start transition-all duration-300 hover:-translate-y-1"
                  >
                    <span className="prompt-icon-badge mb-2 flex h-10 w-10 items-center justify-center rounded-2xl text-2xl drop-shadow-lg">
                      {item.icon}
                    </span>
                    <span className="prompt-title block text-lg font-bold leading-tight">
                      {item.title}
                    </span>
                    <span className="prompt-copy mt-1 block line-clamp-2 text-sm leading-relaxed">
                      {item.prompt}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* ── Messages List ── */
            <MessagesList
              messages={messages}
              isLoading={isLoading}
              messagesEndRef={messagesEndRef}
            />
          )}
        </div>
      </main>

      {/* ───── Input Bar ───── */}
      <footer className="shrink-0 pb-4">
        <form
          onSubmit={handleSubmit}
          className="mx-auto flex max-w-4xl items-center gap-3 px-4"
        >
          <div className="composer-shell relative flex-1 rounded-2xl p-2 backdrop-blur-xl">
            <Input
              ref={inputRef}
              id="chat-input"
              type="text"
              placeholder="سولني على الثقافة، التاريخ، أو التقاليد المغربية..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={isLoading}
              dir={inputValue ? "auto" : "rtl"}
              autoComplete="off"
              spellCheck={false}
              className="composer-input h-12 rounded-xl border-0 bg-transparent px-4 text-start text-lg focus-visible:ring-0 focus-visible:ring-offset-0 transition-all"
            />
          </div>

          <Button
            id="send-button"
            type="submit"
            disabled={isLoading || !canSend}
            size="icon"
            className="send-button-ornate h-14 w-14 shrink-0 rounded-xl p-4 transition-all disabled:opacity-40"
          >
            <SendIcon />
          </Button>
        </form>

        <p className="footer-caption mx-auto max-w-4xl px-4 pb-3 text-center text-[10px]">
          Powered by RAG pipeline — ChromaDB + Fine-tuned LLaMA 3.1
        </p>
      </footer>
      </div>
    </KhaimaParallax>
  );
}
