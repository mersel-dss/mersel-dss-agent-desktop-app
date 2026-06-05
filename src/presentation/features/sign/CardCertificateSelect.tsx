/**
 * Kart ve sertifika seçimi. Agent'tan kartları ve seçilen kartın
 * sertifikalarını çeker.
 */

import { useCertificates, useSmartcards } from "@/application/signing/hooks";
import { Label } from "@/presentation/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/presentation/components/ui/select";
import { CertificateInfoCard, certName, ownerId } from "./CertificateInfoCard";

interface Props {
  enabled: boolean;
  terminalName: string | null;
  certificateId: string | null;
  onTerminalChange: (value: string) => void;
  onCertificateChange: (value: string) => void;
}

export function CardCertificateSelect({
  enabled,
  terminalName,
  certificateId,
  onTerminalChange,
  onCertificateChange,
}: Props) {
  const cards = useSmartcards(enabled);
  const certificates = useCertificates(terminalName);
  const selectedCert = (certificates.data ?? []).find(
    (c) => c.certificateId === certificateId,
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Kart okuyucu</Label>
          <Select
            value={terminalName ?? undefined}
            onValueChange={onTerminalChange}
            disabled={!enabled || cards.isLoading}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={cards.isLoading ? "Yükleniyor…" : "Kart seçin"}
              />
            </SelectTrigger>
            <SelectContent>
              {(cards.data ?? []).map((card) => (
                <SelectItem key={card.terminalName} value={card.terminalName}>
                  {card.terminalName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Sertifika</Label>
          <Select
            value={certificateId ?? undefined}
            onValueChange={onCertificateChange}
            disabled={!terminalName || certificates.isLoading}
          >
            <SelectTrigger className="h-auto min-h-9 py-1.5">
              {selectedCert ? (
                <span className="flex min-w-0 flex-col items-start gap-0 text-left leading-tight">
                  <span className="truncate font-medium">
                    {certName(selectedCert)}
                  </span>
                  {ownerId(selectedCert) ? (
                    <span className="truncate font-mono text-xs text-muted-foreground">
                      VKN: {ownerId(selectedCert)}
                    </span>
                  ) : null}
                </span>
              ) : (
                <SelectValue
                  placeholder={
                    certificates.isLoading ? "Yükleniyor…" : "Sertifika seçin"
                  }
                />
              )}
            </SelectTrigger>
            <SelectContent>
              {(certificates.data ?? []).map((cert) => (
                <SelectItem key={cert.certificateId} value={cert.certificateId}>
                  <span className="flex flex-col gap-0 leading-tight">
                    <span className="font-medium">{certName(cert)}</span>
                    {ownerId(cert) ? (
                      <span className="font-mono text-xs text-muted-foreground">
                        VKN: {ownerId(cert)}
                      </span>
                    ) : null}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedCert ? <CertificateInfoCard cert={selectedCert} /> : null}
    </div>
  );
}
