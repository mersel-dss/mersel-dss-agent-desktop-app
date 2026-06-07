/**
 * e-Belge zarf doğrulama sonucu. Üstte zarf özeti (kaç belge / kaçı geçerli),
 * altında — birden fazla belge varsa — solda seçilebilir belge rayı, sağda
 * seçili belgenin tam imza doğrulama raporu (SignatureResultView). Tek belgede
 * doğrudan raporu gösterir.
 */

import { useState } from "react";
import { CircleCheck, CircleX, FileX, PackageOpen } from "lucide-react";
import type { EnvelopeVerificationResult } from "@/domain/verification/types";
import { cn } from "@/shared/lib/utils";
import { EmptyState } from "@/presentation/components/common/EmptyState";
import { SignatureResultView } from "./SignatureResultView";
import { VerdictHero } from "./components/VerdictHero";

function elementTypeLabel(elementType?: string | null): string {
  if (!elementType) return "Belge";
  const map: Record<string, string> = {
    INVOICE: "Fatura",
    DESPATCHADVICE: "İrsaliye",
    RECEIPTADVICE: "Mal Kabul",
    APPLICATIONRESPONSE: "Uygulama Yanıtı",
    CREDITNOTE: "İade Faturası",
  };
  return map[elementType.toUpperCase()] ?? elementType;
}

/** Tek bir zarf belgesinin doğrulama raporu (ya da çıkmaması hâlinde hata). */
function DocumentReport({
  doc,
}: {
  doc: EnvelopeVerificationResult["documents"][number];
}) {
  if (doc.error || !doc.result) {
    return (
      <EmptyState
        icon={FileX}
        title="Bu belge doğrulanamadı"
        description={
          doc.error ??
          "Doğrulama servisi bu belge için sonuç döndürmedi."
        }
      />
    );
  }
  return (
    <SignatureResultView
      result={doc.result}
      documentId={doc.documentId}
      uuid={doc.uuid}
    />
  );
}

export function EnvelopeResultView({
  result,
}: {
  result: EnvelopeVerificationResult;
}) {
  const documents = result.documents ?? [];
  const [selected, setSelected] = useState(0);
  const current = documents[Math.min(selected, documents.length - 1)];

  const total = result.documentCount ?? documents.length;
  const valid = result.validCount ?? 0;
  const allValid = total > 0 && valid === total;
  const tone = allValid ? "success" : valid === 0 ? "critical" : "warning";

  const hero = (
    <VerdictHero
      tone={tone}
      icon={
        allValid ? (
          <CircleCheck className="h-7 w-7" />
        ) : (
          <PackageOpen className="h-7 w-7" />
        )
      }
      title={
        allValid
          ? "Tüm Belgeler Geçerli"
          : valid === 0
            ? "Belgeler Geçersiz"
            : "Kısmen Geçerli"
      }
      subtitle={`Zarf içinde ${total} imzalı belge tespit edildi`}
      metrics={[
        { label: "Belge", value: String(total) },
        { label: "Geçerli", value: String(valid) },
        { label: "Geçersiz", value: String(total - valid) },
      ]}
    />
  );

  if (documents.length === 0) {
    return (
      <div className="space-y-5">
        {hero}
        <EmptyState
          icon={FileX}
          title="İmzalı belge bulunamadı"
          description="Zarf içinde doğrulanabilir bir imzalı içerik tespit edilemedi."
        />
      </div>
    );
  }

  if (documents.length === 1) {
    return (
      <div className="space-y-5">
        {hero}
        <DocumentReport doc={current!} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {hero}
      <div className="grid gap-0 lg:grid-cols-[268px_1fr]">
        <div className="border-b pb-5 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-6">
          <p className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-wider text-fg-dim">
            Zarf İçeriği · {documents.length}
          </p>
          <div className="space-y-1.5">
            {documents.map((doc, i) => {
              const active = i === selected;
              const ok = doc.result?.valid === true && !doc.error;
              return (
                <button
                  key={doc.index ?? i}
                  type="button"
                  onClick={() => setSelected(i)}
                  className={cn(
                    "relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                    active
                      ? "bg-primary/8 ring-1 ring-inset ring-primary/20"
                      : "hover:bg-muted/60",
                  )}
                >
                  {active ? (
                    <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary" />
                  ) : null}
                  <span
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                      ok
                        ? "bg-success/12 text-success"
                        : "bg-destructive/12 text-destructive",
                    )}
                  >
                    {ok ? (
                      <CircleCheck className="h-4 w-4" />
                    ) : (
                      <CircleX className="h-4 w-4" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {doc.documentId
                        ? doc.documentId
                        : `${elementTypeLabel(doc.elementType)} #${i + 1}`}
                    </span>
                    <span className="block truncate text-xs text-fg-dim">
                      {elementTypeLabel(doc.elementType)}
                      {doc.result?.signatureCount
                        ? ` · ${doc.result.signatureCount} imza`
                        : ""}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="min-w-0 pt-5 lg:pl-8 lg:pt-0">
          <DocumentReport doc={current!} />
        </div>
      </div>
    </div>
  );
}
