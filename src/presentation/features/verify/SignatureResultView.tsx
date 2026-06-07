/**
 * İmza doğrulama sonucu: üstte durum-renkli "verdict" odak yüzeyi, altında
 * (çoklu imzada) sol "İmza Ağacı" / sağ detay, ince ayraçlarla bölünür.
 */

import { useState } from "react";
import { CircleCheck, CircleX, FileX } from "lucide-react";
import type { SignatureVerificationResult } from "@/domain/verification/types";
import { formatDate } from "@/shared/lib/format";
import { EmptyState } from "@/presentation/components/common/EmptyState";
import { AlertList } from "@/presentation/components/common/AlertList";
import { SignatureTree } from "./components/SignatureTree";
import { SignatureDetailPanel } from "./components/SignatureDetailPanel";
import { VerdictHero } from "./components/VerdictHero";
import { DocumentIdentity } from "./components/DocumentIdentity";
import { signatureTypeLabel } from "./labels";

export function SignatureResultView({
  result,
  documentId,
  uuid,
}: {
  result: SignatureVerificationResult;
  /** Belge numarası (UBL `cbc:ID`) — varsa kimlik şeridinde gösterilir. */
  documentId?: string | null;
  /** ETTN (UBL `cbc:UUID`) — varsa kimlik şeridinde gösterilir. */
  uuid?: string | null;
}) {
  const signatures = result.signatures ?? [];
  const ok = result.valid === true;
  const [selected, setSelected] = useState(0);
  const current = signatures[Math.min(selected, signatures.length - 1)];

  return (
    <div className="space-y-5">
      <VerdictHero
        tone={ok ? "success" : "critical"}
        icon={ok ? <CircleCheck className="h-7 w-7" /> : <CircleX className="h-7 w-7" />}
        title={ok ? "İmza Geçerli" : "İmza Geçersiz"}
        subtitle={result.status ?? (ok ? "Tüm kontroller başarılı" : "Doğrulama başarısız")}
        metrics={[
          {
            label: "İmza",
            value: String(result.signatureCount ?? signatures.length),
          },
          { label: "Format", value: signatureTypeLabel(result.signatureType) },
          { label: "Doğrulama", value: formatDate(result.verificationTime) },
        ]}
      />

      <DocumentIdentity documentId={documentId} uuid={uuid} />

      <AlertList items={result.errors} tone="error" />
      <AlertList items={result.warnings} tone="warning" />

      {signatures.length === 0 ? (
        <EmptyState
          icon={FileX}
          title="İmza bulunamadı"
          description="Dokümanda doğrulanabilir bir elektronik imza tespit edilemedi."
        />
      ) : signatures.length === 1 ? (
        <SignatureDetailPanel signature={current!} index={selected} />
      ) : (
        <div className="grid gap-0 lg:grid-cols-[248px_1fr]">
          <div className="border-b pb-5 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-6">
            <SignatureTree
              signatures={signatures}
              selected={selected}
              onSelect={setSelected}
            />
          </div>
          <div className="min-w-0 pt-5 lg:pl-8 lg:pt-0">
            <SignatureDetailPanel signature={current!} index={selected} />
          </div>
        </div>
      )}
    </div>
  );
}
