"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const remarkPlugins = [remarkGfm];

export default function MarkdownRenderer({ content }: { content: string }) {
  return (
    <div dir="auto" className="markdown-content text-start text-sm leading-relaxed">
      <ReactMarkdown remarkPlugins={remarkPlugins}>{content}</ReactMarkdown>
    </div>
  );
}
