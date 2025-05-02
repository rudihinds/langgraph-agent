"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { SyntaxHighlighter } from "./syntax-highlighter";
import "./markdown-styles.css";

interface MarkdownTextProps {
  children: string;
}

export function MarkdownText({ children }: MarkdownTextProps) {
  return (
    // @ts-ignore - ReactMarkdown type definitions may be outdated
    <ReactMarkdown
      className="markdown-content"
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeSanitize]}
      components={{
        // @ts-ignore - ReactMarkdown component types are complex
        code({ node, inline, className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || "");
          const language = match ? match[1] : "text";

          return !inline ? (
            <SyntaxHighlighter language={language}>
              {String(children).replace(/\n$/, "")}
            </SyntaxHighlighter>
          ) : (
            <code className={className} {...props}>
              {children}
            </code>
          );
        },
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
