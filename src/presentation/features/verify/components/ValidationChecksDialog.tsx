/**
 * "Doğrulama Detayları" penceresi — İmzager'daki kontrol listesi gibi her
 * adımı (kriptografik bütünlük, zincir, iptal, zaman damgası …) Başarılı /
 * Başarısız olarak listeler. COMPREHENSIVE modda dönen failedConstraints ve
 * rootCause ile DSS'in gerçek kök nedenini de gösterir.
 */

import type { ReactNode } from "react";
import { ListChecks } from "lucide-react";
import type {
  FailedConstraint,
  FailureCategory,
  SignatureInfo,
} from "@/domain/verification/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/presentation/components/ui/dialog";
import { ScrollArea } from "@/presentation/components/ui/scroll-area";
import { Separator } from "@/presentation/components/ui/separator";
import { Badge } from "@/presentation/components/ui/badge";
import { CheckRow, boolToState, type CheckState } from "./CheckRow";
import { ToneBadge } from "./ToneBadge";
import { indicationLabel, indicationTone } from "../labels";

const CATEGORY_LABELS: Record<FailureCategory, string> = {
  ROOT_CAUSE: "Kök Neden",
  DERIVED: "Türetilmiş",
  CASCADE: "Zincirleme",
};

function ConstraintRow({ c }: { c: FailedConstraint }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {c.category ? (
            <ToneBadge tone={c.category === "ROOT_CAUSE" ? "critical" : "neutral"}>
              {CATEGORY_LABELS[c.category]}
            </ToneBadge>
          ) : null}
          {c.key ? (
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
              {c.key}
            </code>
          ) : null}
        </div>
        <p className="mt-1 text-sm">{c.message ?? "—"}</p>
      </div>
    </div>
  );
}

export function ValidationChecksDialog({
  signature,
  trigger,
}: {
  signature: SignatureInfo;
  trigger: ReactNode;
}) {
  const vd = signature.validationDetails;
  const checks: { label: string; state: CheckState }[] = vd
    ? [
        {
          label: "İmza bütünlüğü korunmuş",
          state: boolToState(vd.signatureIntact),
        },
        {
          label: "Kriptografik doğrulama başarılı",
          state: boolToState(vd.cryptographicVerificationSuccessful),
        },
        {
          label: "Sertifika zinciri geçerli",
          state: boolToState(vd.certificateChainValid),
        },
        {
          label: "Sertifika süresi dolmamış",
          state: boolToState(vd.certificateNotExpired),
        },
        {
          label: "Sertifika iptal edilmemiş",
          state: boolToState(vd.certificateNotRevoked),
        },
        {
          label: "Güvenilir köke ulaşıldı",
          state: boolToState(vd.trustAnchorReached),
        },
        {
          label: "İptal (revocation) kontrolü yapıldı",
          state: boolToState(vd.revocationCheckPerformed),
        },
        ...(signature.timestampInfo
          ? [
              {
                label: "Zaman damgası geçerli",
                state: boolToState(vd.timestampValid),
              },
            ]
          : []),
      ]
    : [];

  const additional = vd?.additionalDetails
    ? Object.entries(vd.additionalDetails)
    : [];
  const constraints = signature.failedConstraints ?? [];
  const rootCause = signature.rootCause;
  const errors = signature.validationErrors ?? [];
  const warnings = signature.validationWarnings ?? [];

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-primary" />
            Doğrulama Detayları
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[65vh] pr-3">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">DSS sonucu:</span>
              <ToneBadge tone={indicationTone(signature.indication)}>
                {indicationLabel(signature.indication)}
              </ToneBadge>
              {signature.subIndication ? (
                <Badge variant="secondary" className="font-mono text-[11px]">
                  {signature.subIndication}
                </Badge>
              ) : null}
            </div>

            {checks.length > 0 ? (
              <div className="divide-y rounded-lg border px-3">
                {checks.map((c) => (
                  <CheckRow key={c.label} state={c.state} label={c.label} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Adım-adım kontrol bayrakları yalnızca kapsamlı (COMPREHENSIVE)
                doğrulamada döner.
              </p>
            )}

            {rootCause ? (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-destructive">
                  Kök Neden
                </p>
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3">
                  <ConstraintRow c={rootCause} />
                </div>
              </div>
            ) : null}

            {constraints.length > 0 ? (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Tüm Başarısız Kısıtlar ({constraints.length})
                </p>
                <div className="divide-y rounded-lg border px-3">
                  {constraints.map((c, i) => (
                    <ConstraintRow key={`${c.key}-${i}`} c={c} />
                  ))}
                </div>
              </div>
            ) : null}

            {errors.length > 0 ? (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-destructive">
                  Hatalar
                </p>
                <ul className="list-inside list-disc space-y-0.5 text-sm text-destructive">
                  {errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {warnings.length > 0 ? (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-warning-foreground">
                  Uyarılar
                </p>
                <ul className="list-inside list-disc space-y-0.5 text-sm text-muted-foreground">
                  {warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {additional.length > 0 ? (
              <div>
                <Separator className="mb-3" />
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Ek Detaylar
                </p>
                <dl className="divide-y text-sm">
                  {additional.map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4 py-1.5">
                      <dt className="text-muted-foreground">{k}</dt>
                      <dd className="text-right font-medium">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : null}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
