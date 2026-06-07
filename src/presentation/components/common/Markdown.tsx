/**
 * GitHub Markdown (GFM) render edici — sürüm notları gibi uzaktan gelen
 * markdown içeriği temaya uygun, güvenli biçimde gösterir. Ham HTML
 * **bilinçli olarak** işlenmez (XSS yüzeyini daraltmak için `rehype-raw`
 * kullanılmaz); yalnızca markdown söz dizimi render edilir. Bağlantılar
 * uygulama içinde değil, sistemin varsayılan tarayıcısında açılır.
 */

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { openUrl } from "@tauri-apps/plugin-opener";

const COMPONENTS: Components = {
  h1: ({ children }) => (
    <h1 className="mt-6 mb-3 border-b border-border/60 pb-1.5 text-[15px] font-semibold tracking-tight first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-6 mb-2.5 text-[13.5px] font-semibold uppercase tracking-[0.06em] text-fg-muted first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-5 mb-2 text-[13px] font-semibold first:mt-0">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="my-2.5 text-[13px] leading-relaxed text-fg-muted">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="my-2.5 list-disc space-y-1.5 pl-5 marker:text-fg-dim">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2.5 list-decimal space-y-1.5 pl-5 marker:text-fg-dim">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="text-[13px] leading-relaxed text-fg-muted">{children}</li>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault();
        if (href) void openUrl(href);
      }}
      className="font-medium text-primary underline-offset-2 hover:underline"
    >
      {children}
    </a>
  ),
  code: ({ className, children }) => {
    const isBlock = (className ?? "").includes("language-");
    if (isBlock) {
      return (
        <code className="block whitespace-pre-wrap break-words font-mono text-[12px] leading-relaxed">
          {children}
        </code>
      );
    }
    return (
      <code className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-[12px] text-foreground">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="my-3 overflow-x-auto rounded-lg border border-border bg-surface-muted/60 p-3.5">
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-2 border-border-strong pl-3.5 text-[13px] italic text-fg-dim">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-5 border-border/60" />,
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto">
      <table className="w-full border-collapse text-[12.5px]">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-border bg-surface-muted px-3 py-1.5 text-left font-semibold">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-border px-3 py-1.5 text-fg-muted">{children}</td>
  ),
  img: ({ src, alt }) =>
    typeof src === "string" ? (
      <img src={src} alt={alt ?? ""} className="my-3 max-w-full rounded-lg border border-border" />
    ) : null,
};

export function Markdown({ children }: { children: string }) {
  return (
    <div className="text-foreground">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
