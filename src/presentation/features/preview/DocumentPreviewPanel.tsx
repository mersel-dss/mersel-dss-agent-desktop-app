/**
 * e-Belge önizleme panosu — verilen dosyadaki belgeleri XSLT servisi ile HTML'e
 * dönüştürüp güvenli (sandbox'lı) bir iframe içinde gösterir. Dosya bir e-Belge
 * zarfıysa (SBD) içindeki tüm belgeler otomatik tespit edilir; üstteki seçiciden
 * belgeler arasında geçilir ve her biri tembel (lazy) olarak dönüştürülür.
 *
 * Render güvenliği: HTML, scriptleri ve aynı-köken erişimini engelleyen
 * `sandbox` iframe içinde gösterilir; yalnızca belgenin stilleri ve gömülü
 * (base64) görselleri çalışır.
 */

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  FileDown,
  FileText,
  FileX,
  Loader2,
  Printer,
  Save,
  ServerOff,
} from "lucide-react";
import { toast } from "sonner";
import { container } from "@/app/container";
import { useService } from "@/application/services/hooks";
import {
  usePreviewDocument,
  usePreviewFileBytes,
  usePreviewOutline,
} from "@/application/preview/hooks";
import type { PreviewDocumentMeta } from "@/domain/preview/types";
import { useFiles } from "@/application/platform/hooks";
import { errorMessage } from "@/shared/lib/errors";
import { Badge } from "@/presentation/components/ui/badge";
import { EmptyState } from "@/presentation/components/common/EmptyState";
import { ServiceOfflineNotice } from "@/presentation/components/common/ServiceOfflineNotice";
import { Button } from "@/presentation/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/presentation/components/ui/select";

// Native tek-tık PDF yalnızca macOS'ta (WKWebView.createPDF) mevcut; diğer
// platformlarda tarayıcı tabanlı çözüme düşülür. Webview userAgent'ından tespit.
const IS_MACOS =
  typeof navigator !== "undefined" && /Mac/i.test(navigator.userAgent);

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

export function DocumentPreviewPanel({ signedPath }: { signedPath: string }) {
  const { isRunning } = useService("xslt");
  const files = useFiles();
  const outline = usePreviewOutline(isRunning ? signedPath : null);
  const [selected, setSelected] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Yeni dosya geldiğinde seçimi başa al.
  useEffect(() => {
    setSelected(0);
  }, [signedPath]);

  const documents = outline.data?.documents ?? [];
  const previewable = outline.data?.previewable ?? false;
  const index = Math.min(selected, Math.max(0, documents.length - 1));

  // Her zaman belgenin kendi gömülü (embedded) tasarımı tercih edilir; yoksa ya
  // da gömülü XSLT hata verirse servis otomatik olarak varsayılan şablona düşer.
  const preview = usePreviewDocument(
    signedPath,
    index,
    true,
    isRunning && previewable && documents.length > 0,
  );

  // Varsayılan şablona düşüldü mü ve gömülü tasarım bir hata yüzünden mi
  // uygulanamadı (yoksa belgede gömülü tasarım hiç yok mu)?
  const usedDefault = preview.data?.defaultUsed ?? false;
  const embeddedError = preview.data?.customError ?? null;

  if (!isRunning) {
    return (
      <ServiceOfflineNotice
        title="Önizleme servisi çalışmıyor"
        description="Belgeleri görüntüleyebilmek için önce Genel Bakış'tan önizleme (XSLT) servisini başlatın."
      />
    );
  }

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

  // PAdES/PDF gibi ikili belgeler HTML'e dönüştürülemez; bunun yerine dosyayı
  // doğrudan gömülü PDF görüntüleyicide gösteririz.
  if (outline.data?.kind === "binary") {
    return <PdfPreview signedPath={signedPath} />;
  }

  if (!previewable || documents.length === 0) {
    return (
      <EmptyState
        icon={FileX}
        title="Bu belge önizlenemiyor"
        description="Dosya içinde görüntülenebilir bir e-Belge tespit edilemedi."
      />
    );
  }

  const documentBaseName = () => {
    const current = documents[index];
    return current?.documentId ?? `onizleme-${index + 1}`;
  };

  // Tauri webview'ında (özellikle macOS WKWebView) iframe içinden window.print()
  // çalışmaz. Belgeyi ayrı bir (üst-seviye) webview penceresinde açıp native
  // yazdır panelini tetikliyoruz — macOS panelinde "PDF olarak kaydet" de var.
  const handlePrint = async () => {
    if (!preview.data?.html) return;
    try {
      await container.preview.printDocument(preview.data.html, documentBaseName());
    } catch (e) {
      toast.error("Yazdırma penceresi açılamadı", {
        description: errorMessage(e),
      });
    }
  };

  // Tek tıkla PDF: macOS'ta native (WKWebView.createPDF) ile dosyaya yazar.
  // Native köprü yoksa belgeyi tarayıcıda açıp "PDF olarak kaydet"e yönlendirir.
  const handleExportPdf = async () => {
    if (!preview.data?.html) return;
    const html = preview.data.html;
    const base = documentBaseName();

    if (!IS_MACOS) {
      await container.preview.openInBrowser(html, base);
      toast.info("Belge tarayıcıda açıldı", {
        description:
          "PDF için yazdır penceresinden \u201cPDF olarak kaydet\u201d seçeneğini seçin.",
      });
      return;
    }

    const path = await files.pickSavePath({
      title: "PDF olarak kaydet",
      defaultPath: `${base}.pdf`,
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
    if (!path) return;
    try {
      await container.preview.exportPdf(html, base, path);
      toast.success("PDF kaydedildi");
    } catch (e) {
      // Native köprü beklenmedik biçimde kullanılamazsa tarayıcıya düş.
      if (errorMessage(e).includes("native_pdf_unsupported")) {
        await container.preview.openInBrowser(html, base);
        toast.info("Belge tarayıcıda açıldı", {
          description:
            "PDF için yazdır penceresinden \u201cPDF olarak kaydet\u201d seçeneğini seçin.",
        });
        return;
      }
      toast.error("PDF oluşturulamadı", { description: errorMessage(e) });
    }
  };

  const handleSave = async () => {
    if (!preview.data?.html) return;
    const current = documents[index];
    const base = current?.documentId ?? `onizleme-${index + 1}`;
    const path = await files.pickSavePath({
      title: "HTML olarak kaydet",
      defaultPath: `${base}.html`,
      filters: [{ name: "HTML", extensions: ["html"] }],
    });
    if (!path) return;
    try {
      await files.saveTextFile(path, preview.data.html);
      toast.success("HTML kaydedildi");
    } catch (e) {
      toast.error("Kaydedilemedi", { description: errorMessage(e) });
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Araç çubuğu: belge seçici · tasarım rozeti · eylemler */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 pb-3">
        {documents.length > 1 ? (
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
        ) : (
          <div className="flex items-center gap-2 text-sm font-medium">
            <FileText className="h-4 w-4 text-fg-dim" />
            {documentLabel(documents[index]!)}
          </div>
        )}

        {documents.length > 1 ? (
          <span className="rounded-sm bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-fg-muted">
            {index + 1} / {documents.length}
          </span>
        ) : null}

        {/* Tasarım rozeti: yalnızca varsayılan şablona düşüldüğünde gösterilir.
            Gömülü XSLT bir hata yüzünden uygulanamadıysa uyarı tonunda belirtilir. */}
        {usedDefault ? (
          embeddedError ? (
            <Badge
              variant="outline"
              className="gap-1 border-[rgb(var(--tone-warning-fg))]/30 bg-status-starting/10 text-[rgb(var(--tone-warning-fg))]"
              title={`Belgedeki gömülü tasarım uygulanamadığı için varsayılan şablon kullanıldı:\n${embeddedError}`}
            >
              <AlertTriangle className="h-3 w-3" />
              Varsayılan tasarım · gömülü XSLT hatalı
            </Badge>
          ) : (
            <Badge
              variant="secondary"
              className="gap-1"
              title="Belgede gömülü tasarım bulunmadığı için varsayılan şablonla gösteriliyor."
            >
              Varsayılan tasarım
            </Badge>
          )
        ) : null}

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSave}
            disabled={!preview.data?.html}
          >
            <Save className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Kaydet</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleExportPdf()}
            disabled={!preview.data?.html}
            title={
              IS_MACOS
                ? "Belgeyi PDF dosyası olarak kaydet"
                : "Tarayıcıda aç — \u201cPDF olarak kaydet\u201d ile dışa aktarın"
            }
          >
            <FileDown className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">PDF</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handlePrint()}
            disabled={!preview.data?.html}
            title="Yazdır"
          >
            <Printer className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Yazdır</span>
          </Button>
        </div>
      </div>

      {/* Render alanı (XML → HTML) */}
      <div className="relative mt-3 min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-white">
        {preview.isLoading ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 text-fg-dim">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : null}

        {preview.isError ? (
          <div className="flex h-full items-center justify-center p-6">
            <EmptyState
              icon={FileX}
              title="Belge dönüştürülemedi"
              description={errorMessage(preview.error)}
            />
          </div>
        ) : preview.data ? (
          <iframe
            ref={iframeRef}
            title="Belge önizleme"
            sandbox="allow-same-origin allow-modals"
            srcDoc={preview.data.html}
            className="h-full w-full border-0 bg-white"
          />
        ) : null}
      </div>
    </div>
  );
}

/** Verilen yoldan dosya adının (uzantısız) gövdesini çıkarır. */
function fileBaseName(path: string): string {
  const name = path.split(/[\\/]/).pop() ?? path;
  return name || "belge";
}

/**
 * PAdES/PDF gibi ikili belgelerin gömülü PDF görüntüleyicide önizlemesi. Dosyanın
 * ham baytları okunup bir `Blob` URL'ine dönüştürülür ve webview'in native PDF
 * görüntüleyicisinde (iframe) gösterilir.
 */
function PdfPreview({ signedPath }: { signedPath: string }) {
  const bytes = usePreviewFileBytes(signedPath, true);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!bytes.data) {
      setObjectUrl(null);
      return;
    }
    const blob = new Blob([bytes.data], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [bytes.data]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <FileText className="h-4 w-4 text-fg-dim" />
          {fileBaseName(signedPath)}
        </div>
        <Badge variant="secondary" className="ml-auto">
          PDF
        </Badge>
      </div>

      <div className="relative mt-3 min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-surface-muted">
        {bytes.isLoading ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center text-fg-dim">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : null}

        {bytes.isError ? (
          <div className="flex h-full items-center justify-center p-6">
            <EmptyState
              icon={FileX}
              title="PDF açılamadı"
              description={errorMessage(bytes.error)}
            />
          </div>
        ) : objectUrl ? (
          <iframe
            title="PDF önizleme"
            src={objectUrl}
            className="h-full w-full border-0"
          />
        ) : null}
      </div>
    </div>
  );
}
