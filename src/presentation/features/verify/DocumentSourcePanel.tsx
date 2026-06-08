/**
 * Salt-okunur XML kaynak panosu. Verilen dosyadaki (ya da e-Belge zarfındaki
 * seçili) belgenin ham XML kaynağını Monaco editöründe gösterir. Zarf otomatik
 * çözülür; üstteki seçiciden belgeler arası geçilir ve kaynak tembel (lazy)
 * çekilir. "Biçimlendir" ile XML girintili biçime çevrilir (sağ tık menüsündeki
 * "Format Document" da aynı işi yapar); "Ham" ile imzalı baytlar olduğu gibi
 * görüntülenir.
 *
 * XSLT servisine ihtiyaç duymaz: hem belge listesi hem kaynak okuma servisten
 * bağımsız, doğrudan dosyadan çözülür.
 */

import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { FileX, Loader2, ServerOff } from "lucide-react";
import { usePreviewOutline, useDocumentSource } from "@/application/preview/hooks";
import type { PreviewDocumentMeta } from "@/domain/preview/types";
import { errorMessage } from "@/shared/lib/errors";
import { formatXml } from "@/shared/lib/xml";
import { cn } from "@/shared/lib/utils";
import { EmptyState } from "@/presentation/components/common/EmptyState";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/presentation/components/ui/select";

// Monaco ağırdır; yalnızca kaynak görünümü açıldığında ayrı parça olarak yüklenir.
const CodeViewer = lazy(() =>
  import("@/presentation/components/common/CodeViewer").then((m) => ({
    default: m.CodeViewer,
  })),
);

function elementTypeLabel(elementType?: string | null): string {
  if (!elementType) return "Belge";
  const map: Record<string, string> = {
    INVOICE: "Fatura",
    ARCHIVE_INVOICE: "e-Arşiv Fatura",
    DESPATCHADVICE: "İrsaliye",
    RECEIPTADVICE: "İrsaliye Yanıtı",
    APPLICATIONRESPONSE: "Uygulama Yanıtı",
    CREDITNOTE: "Müstahsil Makbuzu",
  };
  return map[elementType.toUpperCase()] ?? elementType;
}

function documentLabel(doc: PreviewDocumentMeta): string {
  return doc.documentId ?? `${elementTypeLabel(doc.elementType)} #${doc.index + 1}`;
}

type SourceFormat = "raw" | "pretty";

export function DocumentSourcePanel({ signedPath }: { signedPath: string }) {
  const outline = usePreviewOutline(signedPath);
  const [selected, setSelected] = useState(0);
  const [format, setFormat] = useState<SourceFormat>("raw");

  useEffect(() => {
    setSelected(0);
  }, [signedPath]);

  const documents = outline.data?.documents ?? [];
  const previewable = outline.data?.previewable ?? false;
  const index = Math.min(selected, Math.max(0, documents.length - 1));

  const source = useDocumentSource(
    signedPath,
    index,
    previewable && documents.length > 0,
  );

  const raw = source.data ?? "";
  const value = useMemo(
    () => (format === "pretty" ? formatXml(raw) : raw),
    [format, raw],
  );

  if (outline.isLoading) {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center text-fg-dim">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (outline.isError) {
    return (
      <EmptyState
        icon={ServerOff}
        title="Belge çözümlenemedi"
        description={errorMessage(outline.error)}
      />
    );
  }

  if (!previewable || documents.length === 0) {
    return (
      <EmptyState
        icon={FileX}
        title="XML kaynağı yok"
        description={
          outline.data?.kind === "binary"
            ? "PDF gibi ikili belgelerin XML kaynağı bulunmaz. Kaynak görünümü yalnızca e-Belge XML'leri içindir."
            : "Dosya içinde görüntülenebilir bir e-Belge tespit edilemedi."
        }
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Araç çubuğu: belge seçici · biçim (ham/biçimli) */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 pb-3">
        {documents.length > 1 ? (
          <>
            <Select
              value={String(index)}
              onValueChange={(v) => setSelected(Number(v))}
            >
              <SelectTrigger size="sm" className="min-w-[200px] max-w-[320px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {documents.map((doc) => (
                  <SelectItem key={doc.index} value={String(doc.index)}>
                    {documentLabel(doc)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="rounded-sm bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-fg-muted">
              {index + 1} / {documents.length}
            </span>
          </>
        ) : (
          <div className="text-sm font-medium">{documentLabel(documents[index]!)}</div>
        )}

        {/* Ham ↔ Biçimli (Format Document) */}
        <div className="ml-auto flex rounded-md border border-border bg-surface-muted p-0.5 text-[12px]">
          <button
            type="button"
            onClick={() => setFormat("raw")}
            className={cn(
              "rounded-sm px-2.5 py-1 font-medium transition-colors",
              format === "raw"
                ? "bg-surface-raised text-foreground ring-1 ring-border"
                : "text-fg-muted hover:text-foreground",
            )}
            title="İmzalı baytları olduğu gibi göster"
          >
            Ham
          </button>
          <button
            type="button"
            onClick={() => setFormat("pretty")}
            className={cn(
              "rounded-sm px-2.5 py-1 font-medium transition-colors",
              format === "pretty"
                ? "bg-surface-raised text-foreground ring-1 ring-border"
                : "text-fg-muted hover:text-foreground",
            )}
            title="Girintili biçimde göster (Format Document · ⇧⌥F)"
          >
            Biçimli
          </button>
        </div>
      </div>

      {/* Editör alanı */}
      <div className="mt-3 min-h-0 flex-1">
        {source.isLoading ? (
          <div className="flex h-full min-h-[280px] items-center justify-center text-fg-dim">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : source.isError ? (
          <EmptyState
            icon={FileX}
            title="Kaynak okunamadı"
            description={errorMessage(source.error)}
          />
        ) : (
          <div className="h-full min-h-[280px] overflow-hidden rounded-lg border border-border bg-surface-muted/30">
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center text-fg-dim">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              }
            >
              <CodeViewer
                value={value}
                language="xml"
                className="h-full"
                onFormat={() => setFormat("pretty")}
              />
            </Suspense>
          </div>
        )}
      </div>
    </div>
  );
}
