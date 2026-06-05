/**
 * İmza doğrulama sonucu: üstte durum-renkli "verdict" odak yüzeyi, altında
 * (çoklu imzada) sol "İmza Ağacı" / sağ detay, ince ayraçlarla bölünür.
 */

import { useState } from "react";
import { CircleCheck, CircleX, FileX } from "lucide-react";
import type { SignatureVerificationResult } from "@/domain/verification/types";
import { formatDate } from "@/shared/lib/format";
import { EmptyState } from "@/presentation/components/common/EmptyState";
import { SignatureTree } from "./components/SignatureTree";
import { SignatureDetailPanel } from "./components/SignatureDetailPanel";
import { VerdictHero } from "./components/VerdictHero";
import { signatureTypeLabel } from "./labels";

export function SignatureResultView({
  result,
}: {
  result: SignatureVerificationResult;
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

      {result.errors && result.errors.length > 0 ? (
        <ul className="list-inside list-disc border-l-2 border-destructive/50 bg-destructive/5 py-2 pl-4 pr-3 text-sm text-destructive">
          {result.errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      ) : null}
      {result.warnings && result.warnings.length > 0 ? (
        <ul className="list-inside list-disc border-l-2 border-warning/60 bg-warning/5 py-2 pl-4 pr-3 text-sm text-muted-foreground">
          {result.warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      ) : null}

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
