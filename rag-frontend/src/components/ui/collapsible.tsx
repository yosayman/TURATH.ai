"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────
// Collapsible — lightweight, no extra dependencies needed
// ─────────────────────────────────────────────────────────────

interface CollapsibleProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}

function Collapsible({
  open: controlledOpen,
  onOpenChange,
  defaultOpen = false,
  children,
  className,
}: CollapsibleProps) {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;

  const toggle = React.useCallback(() => {
    const next = !isOpen;
    setInternalOpen(next);
    onOpenChange?.(next);
  }, [isOpen, onOpenChange]);

  return (
    <CollapsibleContext.Provider value={{ isOpen, toggle }}>
      <div className={cn(className)} data-state={isOpen ? "open" : "closed"}>
        {children}
      </div>
    </CollapsibleContext.Provider>
  );
}

// ── Context ──
const CollapsibleContext = React.createContext<{
  isOpen: boolean;
  toggle: () => void;
}>({ isOpen: false, toggle: () => {} });

function useCollapsible() {
  return React.useContext(CollapsibleContext);
}

// ── Trigger ──
function CollapsibleTrigger({
  children,
  className,
  asChild: _asChild,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }) {
  const { toggle } = useCollapsible();
  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(className)}
      {...props}
    >
      {children}
    </button>
  );
}

// ── Content ──
function CollapsibleContent({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const { isOpen } = useCollapsible();

  return (
    <div
      className={cn(
        "collapsible-content overflow-hidden transition-all duration-300 ease-in-out",
        isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        className
      )}
      style={{
        display: "grid",
        gridTemplateRows: isOpen ? "1fr" : "0fr",
      }}
      {...props}
    >
      <div className="overflow-hidden">{children}</div>
    </div>
  );
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
