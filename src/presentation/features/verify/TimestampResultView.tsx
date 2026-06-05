/**
 * Zaman damgası doğrulama sonucu — durum-renkli verdict yüzeyi, TSA bilgisi,
 * message imprint, TSA sertifika penceresi ve hata/uyarılar.
 */

import { CircleCheck, CircleX, ScrollText } from "lucide-react";
import type { TimestampVerificationResult } from "@/domain/verification/types";
import { formatDate } from "@/shared/lib/format";
import { Button } from "@/presentation/components/ui/button";
import { CertificateDialog } from "./components/CertificateDialog";
import { InfoGrid } from "./components/InfoGrid";
import { VerdictHero } from "./components/VerdictHero";

export function TimestampResultView({
  result,
}: {
  result: TimestampVerificationResult;
}) {
  const ok = result.valid === true;

  return (
    <div className="space-y-5">
      <VerdictHero
        tone={ok ? "success" : "critical"}
        icon={ok ? <CircleCheck className="h-7 w-7" /> : <CircleX className="h-7 w-7" />}
        title={ok ? "Zaman Damgası Geçerli" : "Zaman Damgası Geçersiz"}
        subtitle={
          result.status ?? (ok ? "RFC 3161 doğrulaması başarılı" : "Doğrulama başarısız")
        }
        metrics={[
          { label: "TSA", value: result.tsaName ?? "—" },
          { label: "Zaman", value: formatDate(result.timestampTime) },
        ]}
      />

      <InfoGrid
        items={[
          { label: "TSA", value: result.tsaName ?? "—" },
          { label: "Zaman", value: formatDate(result.timestampTime) },
          {
            label: "Özet Algoritması",
            value: result.digestAlgorithm ? (
              <span className="font-mono text-xs">{result.digestAlgorithm}</span>
            ) : (
              "—"
            ),
          },
          {
            label: "TSA Sertifikası",
            value: result.tsaCertificate?.commonName ?? "—",
          },
          {
            label: "Message Imprint",
            full: true,
            value: result.messageImprint ? (
              <span className="break-all font-mono text-xs">
                {result.messageImprint}
              </span>
            ) : (
              "—"
            ),
          },
          {
            label: "Doğrulama Zamanı",
            value: formatDate(result.verificationTime),
          },
        ]}
      />

      {result.tsaCertificate ? (
        <CertificateDialog
          cert={result.tsaCertificate}
          title="TSA Sertifikası"
          trigger={
            <Button variant="outline" size="sm">
              <ScrollText className="h-4 w-4" />
              TSA Sertifikası
            </Button>
          }
        />
      ) : null}

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
    </div>
  );
}
