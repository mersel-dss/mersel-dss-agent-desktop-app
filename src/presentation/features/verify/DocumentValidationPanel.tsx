/**
 * e-Belge şema (XSD) + şematron doğrulama panosu. Verilen dosyadaki belgeyi
 * XSLT servisinin `/v1/validate` (otomatik tespit) uç noktasıyla GİB resmi
 * şema ve iş kurallarına göre doğrular. Dosya bir e-Belge zarfıysa (SBD)
 * içindeki belgeler otomatik tespit edilir; üstteki seçiciden belgeler arası
 * geçilir ve her biri tembel (lazy) doğrulanır.
 */

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  FileX,
  Loader2,
  ServerOff,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useService } from "@/application/services/hooks";
import { usePreviewOutline } from "@/application/preview/hooks";
import { useValidateDocument } from "@/application/validation/hooks";
import type { PreviewDocumentMeta } from "@/domain/preview/types";
import type { ValidationReport } from "@/domain/validation/types";
import { errorMessage } from "@/shared/lib/errors";
import { cn } from "@/shared/lib/utils";
import { EmptyState } from "@/presentation/components/common/EmptyState";
import { ServiceOfflineNotice } from "@/presentation/components/common/ServiceOfflineNotice";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/presentation/components/ui/select";

const TYPE_LABELS: Record<string, string> = {
  INVOICE: "e-Fatura",
  ARCHIVE_INVOICE: "e-Arşiv Fatura",
  DESPATCH_ADVICE: "e-İrsaliye",
  RECEIPT_ADVICE: "İrsaliye Yanıtı",
  APPLICATION_RESPONSE: "Uygulama Yanıtı",
  CREDIT_NOTE: "Müstahsil Makbuzu",
  EMM: "e-Müstahsil Makbuzu",
  ESMM: "e-Serbest Meslek Makbuzu",
  ECHECK: "e-Çek",
};

function typeLabel(type?: string | null): string {
  if (!type) return "Bilinmiyor";
  return TYPE_LABELS[type.toUpperCase()] ?? type;
}

function elementTypeLabel(elementType?: string | null): string {
  if (!elementType) return "Belge";
  return TYPE_LABELS[elementType.toUpperCase()] ?? elementType;
}

function documentLabel(doc: PreviewDocumentMeta): string {
  return doc.documentId ?? `${elementTypeLabel(doc.elementType)} #${doc.index + 1}`;
}

/** Tek bir kontrol bölümü: XSD ya da şematron sonucu + bulgu listesi. */
function CheckSection({
  title,
  passed,
  okText,
  children,
}: {
  title: string;
  passed: boolean;
  okText: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-surface-muted/40 p-3.5">
      <div className="flex items-center gap-2">
        {passed ? (
          <CheckCircle2 className="h-4 w-4 text-status-running" />
        ) : (
          <XCircle className="h-4 w-4 text-destructive" />
        )}
        <span className="text-[13px] font-semibold">{title}</span>
        <span
          className={cn(
            "ml-auto rounded-full border px-2 py-0.5 text-[11px] font-medium",
            passed
              ? "border-status-running/40 bg-status-running/12 text-status-running"
              : "border-destructive/40 bg-destructive/12 text-destructive",
          )}
        >
          {passed ? "Geçerli" : "Hatalı"}
        </span>
      </div>
      {passed ? (
        <p className="mt-2 text-[12px] text-fg-muted">{okText}</p>
      ) : (
        <div className="mt-2.5 space-y-1.5">{children}</div>
      )}
    </div>
  );
}

function ReportView({ report }: { report: ValidationReport }) {
  const ok = report.validSchema && report.validSchematron;

  return (
    <div className="space-y-3.5">
      {/* Özet başlık */}
      <div
        className={cn(
          "flex items-center gap-3 rounded-lg border px-4 py-3",
          ok
            ? "border-status-running/25 bg-status-running/[0.06]"
            : "border-destructive/25 bg-destructive/[0.06]",
        )}
      >
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
            ok
              ? "bg-status-running/12 text-status-running"
              : "bg-destructive/12 text-destructive",
          )}
        >
          {ok ? (
            <ShieldCheck className="h-5 w-5" />
          ) : (
            <ShieldAlert className="h-5 w-5" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            {ok ? "Belge GİB kurallarına uygun" : "Belge doğrulamadan geçmedi"}
          </p>
          <p className="truncate text-[12px] text-fg-muted">
            Tespit edilen tip: {typeLabel(report.detectedDocumentType)}
          </p>
        </div>
      </div>

      {report.errorMessage ? (
        <p className="rounded-md bg-status-starting/10 px-3 py-2 text-[12px] text-[rgb(var(--tone-warning-fg))]">
          {report.errorMessage}
        </p>
      ) : null}

      <CheckSection
        title="Şema (XSD)"
        passed={report.validSchema}
        okText="Belge, GİB UBL-TR XSD şemasına yapısal olarak uygun."
      >
        {report.schemaErrors.map((err, i) => (
          <p
            key={i}
            className="rounded-md bg-destructive/[0.06] px-2.5 py-1.5 text-[12px] leading-relaxed text-fg"
          >
            {err}
          </p>
        ))}
      </CheckSection>

      <CheckSection
        title="Şematron (İş Kuralları)"
        passed={report.validSchematron}
        okText="Belge, GİB şematron iş kurallarının tümünü karşılıyor."
      >
        {report.schematronErrors.map((finding, i) => (
          <div
            key={i}
            className="rounded-md bg-destructive/[0.06] px-2.5 py-1.5 text-[12px] leading-relaxed"
          >
            <p className="text-fg">{finding.message ?? "Kural ihlali"}</p>
            {finding.ruleId ? (
              <p className="mt-0.5 font-mono text-[11px] text-fg-dim">
                {finding.ruleId}
              </p>
            ) : null}
          </div>
        ))}
      </CheckSection>
    </div>
  );
}

export function DocumentValidationPanel({ signedPath }: { signedPath: string }) {
  const { isRunning } = useService("xslt");
  const outline = usePreviewOutline(isRunning ? signedPath : null);
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    setSelected(0);
  }, [signedPath]);

  const documents = outline.data?.documents ?? [];
  const previewable = outline.data?.previewable ?? false;
  const index = Math.min(selected, Math.max(0, documents.length - 1));

  const validation = useValidateDocument(
    signedPath,
    index,
    isRunning && previewable && documents.length > 0,
  );

  if (!isRunning) {
    return (
      <ServiceOfflineNotice
        title="Doğrulama (şema/şematron) servisi çalışmıyor"
        description="Belgeleri GİB şema ve iş kurallarına göre doğrulayabilmek için önce Genel Bakış'tan önizleme (XSLT) servisini başlatın."
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

  if (!previewable || documents.length === 0) {
    return (
      <EmptyState
        icon={FileX}
        title="Bu belge doğrulanamıyor"
        description={
          outline.data?.kind === "binary"
            ? "PDF gibi ikili belgeler için şema/şematron doğrulaması sunulamaz. Bu doğrulama yalnızca e-Belge XML'leri içindir."
            : "Dosya içinde doğrulanabilir bir e-Belge tespit edilemedi."
        }
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Araç çubuğu: belge seçici (zarfta birden çok belge varsa) */}
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
          <div className="flex items-center gap-2 text-sm font-medium">
            <ShieldCheck className="h-4 w-4 text-fg-dim" />
            {documentLabel(documents[index]!)}
          </div>
        )}
      </div>

      {/* Sonuç alanı */}
      <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
        {validation.isLoading ? (
          <div className="flex h-full min-h-[280px] items-center justify-center text-fg-dim">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : validation.isError ? (
          <EmptyState
            icon={FileX}
            title="Belge doğrulanamadı"
            description={errorMessage(validation.error)}
          />
        ) : validation.data ? (
          <ReportView report={validation.data} />
        ) : null}
      </div>
    </div>
  );
}
