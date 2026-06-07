/**
 * Zaman damgası doğrulama sonucu — durum-renkli verdict yüzeyi, TSA bilgisi,
 * message imprint, TSA sertifika penceresi ve hata/uyarılar.
 */

import { CircleCheck, CircleX, ScrollText } from "lucide-react";
import type { TimestampVerificationResult } from "@/domain/verification/types";
import { formatDate } from "@/shared/lib/format";
import { Button } from "@/presentation/components/ui/button";
import { AlertList } from "@/presentation/components/common/AlertList";
import { CertificateDialog } from "./components/CertificateDialog";
import { InfoGrid } from "@/presentation/components/common/InfoGrid";
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

      <AlertList items={result.errors} tone="error" />
      <AlertList items={result.warnings} tone="warning" />
    </div>
  );
}
