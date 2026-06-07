/**
 * Seçili imzanın tüm detaylarını İmzager düzeninde gösterir: İmza Detayları,
 * İmzalayan Detayları, zaman damgası, yasal kalite ve audit notları. Sertifika
 * ve doğrulama-detayı pencerelerini açan butonları barındırır.
 */

import { CalendarClock, FileSignature, ListChecks, ScrollText } from "lucide-react";
import type { SignatureInfo } from "@/domain/verification/types";
import { formatDate } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/presentation/components/ui/button";
import { InfoGrid } from "@/presentation/components/common/InfoGrid";
import { ToneBadge } from "./ToneBadge";
import { CertificateDialog } from "./CertificateDialog";
import { ValidationChecksDialog } from "./ValidationChecksDialog";
import { AppliedNotices } from "./AppliedNotices";
import {
  certDisplayName,
  chainRevocationStatus,
  indicationLabel,
  indicationTone,
  packagingLabel,
  qualificationLabel,
  signatureLevelLabel,
} from "../labels";

function SpecCard({
  icon,
  title,
  children,
  className,
}: {
  icon: React.ReactNode;
  title: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "flex flex-col gap-4 rounded-lg border border-border bg-surface-raised p-5",
        className,
      )}
    >
      <div className="flex items-center gap-2.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-surface-muted text-fg-muted">
          {icon}
        </span>
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-dim">
          {title}
        </h3>
      </div>
      {children}
    </section>
  );
}

export function SignatureDetailPanel({
  signature,
  index,
}: {
  signature: SignatureInfo;
  index: number;
}) {
  const signer = signature.signerCertificate;
  const ts = signature.timestampInfo;
  const qual = signature.qualificationDetails;
  const qualLabel = qual ? qualificationLabel(qual.qualificationLevel) : null;
  const chainStatus = signature.chainRevocationStatus
    ? chainRevocationStatus(signature.chainRevocationStatus)
    : null;

  return (
    <div className="space-y-5">
      {/* Üst başlık + aksiyonlar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface-raised px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-soft text-brand-hover">
            <FileSignature className="h-[18px] w-[18px]" />
          </span>
          <span className="text-[15px] font-semibold">
            {signature.signatureFormat ?? `İmza #${index + 1}`}
          </span>
          <ToneBadge tone={indicationTone(signature.indication ?? (signature.valid ? "PASSED" : "FAILED"))}>
            {signature.valid
              ? "Geçerli"
              : signature.indication
                ? indicationLabel(signature.indication)
                : "Geçersiz"}
          </ToneBadge>
        </div>
        <div className="flex gap-2">
          <ValidationChecksDialog
            signature={signature}
            trigger={
              <Button variant="outline" size="sm">
                <ListChecks className="h-4 w-4" />
                Doğrulama Detayları
              </Button>
            }
          />
          {signer ? (
            <CertificateDialog
              cert={signer}
              chain={signature.certificateChain}
              chainRevocation={signature.chainRevocationStatus}
              title="İmzacı Sertifikası"
              trigger={
                <Button variant="outline" size="sm">
                  <ScrollText className="h-4 w-4" />
                  Sertifika
                </Button>
              }
            />
          ) : null}
        </div>
      </div>

      <div className="grid items-start gap-5 [grid-template-columns:repeat(auto-fit,minmax(340px,1fr))]">
      {/* İmza Detayları */}
      <SpecCard icon={<FileSignature className="h-3.5 w-3.5" />} title="İmza Detayları">
        <InfoGrid
          items={[
            { label: "İmza Formatı", value: signature.signatureFormat ?? "—" },
            {
              label: "İmza Tipi",
              value: signatureLevelLabel(signature.signatureLevel),
            },
            ...(signature.signaturePackaging
              ? [
                  {
                    label: "İmzalama Tipi",
                    value: packagingLabel(signature.signaturePackaging),
                  },
                ]
              : []),
            {
              label: "İmza Algoritması",
              value: signature.signatureAlgorithm ? (
                <span className="font-mono text-xs">{signature.signatureAlgorithm}</span>
              ) : (
                "—"
              ),
            },
            {
              label: "Özet Algoritması",
              value: signature.digestAlgorithm ? (
                <span className="font-mono text-xs">{signature.digestAlgorithm}</span>
              ) : (
                "—"
              ),
            },
            {
              label: "İmza Profili",
              value: signature.policyIdentifier ?? "Yok",
            },
            {
              label: "Beyan Edilen İmza Zamanı",
              value: formatDate(
                signature.claimedSigningTime ?? signature.signingTime,
              ),
            },
            ...(signature.signingTime &&
            signature.signingTime !== signature.claimedSigningTime
              ? [
                  {
                    label: "Doğrulanan İmza Zamanı",
                    value: formatDate(signature.signingTime),
                  },
                ]
              : []),
            {
              label: "Geçerlilik Durumu",
              value: (
                <ToneBadge tone={signature.valid ? "success" : "critical"}>
                  {signature.valid ? "Geçerli" : "Geçersiz"}
                </ToneBadge>
              ),
            },
          ]}
        />
      </SpecCard>

      {/* İmzalayan Detayları */}
      {signer ? (
        <SpecCard icon={<ScrollText className="h-3.5 w-3.5" />} title="İmzalayan Detayları">
          <InfoGrid
            items={[
              { label: "Sertifika Sahibi", value: certDisplayName(signer) },
              { label: "Yayıncı", value: signer.issuerDN ?? "—", full: true },
              {
                label: "Geçerlilik Durumu",
                value: (
                    <ToneBadge
                      tone={
                        signer.revoked
                          ? "critical"
                          : signer.expired || signer.valid === false
                            ? "critical"
                            : "success"
                      }
                    >
                      {signer.revoked
                        ? "Sertifika iptal edilmiş"
                        : signer.expired
                          ? "Sertifika süresi dolmuş"
                          : signer.valid === false
                            ? "Sertifika geçersiz"
                            : "Sertifika doğrulama başarılı"}
                    </ToneBadge>
                  ),
                },
                ...(chainStatus
                  ? [
                      {
                        label: "Zincir İptal Durumu",
                        value: (
                          <ToneBadge tone={chainStatus.tone}>
                            {chainStatus.label}
                          </ToneBadge>
                        ),
                      },
                    ]
                  : []),
            ]}
          />
        </SpecCard>
      ) : null}

      {/* Zaman damgası */}
      {ts ? (
        <SpecCard
          icon={<CalendarClock className="h-3.5 w-3.5" />}
          title={`Zaman Damgası${
            signature.timestampCount && signature.timestampCount > 1
              ? ` · ${signature.timestampCount} adet`
              : ""
          }`}
        >
          <InfoGrid
            items={[
              {
                label: "Durum",
                value: (
                  <ToneBadge tone={ts.valid ? "success" : "critical"}>
                    {ts.valid ? "Geçerli" : "Geçersiz"}
                  </ToneBadge>
                ),
              },
              { label: "TSA", value: ts.tsaName ?? "—" },
              { label: "Zaman", value: formatDate(ts.timestampTime) },
              { label: "Tip", value: ts.timestampType ?? "—" },
              { label: "Özet Algoritması", value: ts.digestAlgorithm ?? "—" },
            ]}
          />
          {ts.tsaCertificate ? (
            <div className="pt-1">
              <CertificateDialog
                cert={ts.tsaCertificate}
                title="TSA Sertifikası"
                trigger={
                  <Button variant="outline" size="sm">
                    <ScrollText className="h-4 w-4" />
                    TSA Sertifikası
                  </Button>
                }
              />
            </div>
          ) : null}
        </SpecCard>
      ) : null}

      {/* Yasal kalite */}
      {qual && qualLabel ? (
        <SpecCard
          icon={<FileSignature className="h-3.5 w-3.5" />}
          title="Yasal Kalite Seviyesi"
        >
          <div className="flex items-center gap-2">
            <ToneBadge tone={qualLabel.tone}>{qualLabel.label}</ToneBadge>
          </div>
          {qual.warnings && qual.warnings.length > 0 ? (
            <ul className="list-inside list-disc text-xs text-muted-foreground">
              {qual.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          ) : null}
        </SpecCard>
      ) : null}
      </div>

      {/* Audit: tolerans / red */}
      <AppliedNotices
        suppressions={signature.appliedSuppressions}
        rejections={signature.appliedRejections}
      />
    </div>
  );
}
