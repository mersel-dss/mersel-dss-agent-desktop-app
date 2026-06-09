/**
 * Seçilen sertifikanın özet kartı — sahip (commonName), vergi/kimlik no (taxId)
 * ve geçerlilik aralığını şık biçimde gösterir.
 */

import { CalendarDays, Fingerprint, ShieldCheck, ShieldX } from "lucide-react";
import type { Certificate } from "@/domain/signing/types";
import { formatDate } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/presentation/components/ui/badge";

/** notAfter'a göre geçerlilik durumunu hesaplar. */
function validity(cert: Certificate) {
  if (!cert.notAfter) return { tone: "muted" as const, label: "Bilinmiyor" };
  const end = new Date(cert.notAfter).getTime();
  if (Number.isNaN(end)) return { tone: "muted" as const, label: "Bilinmiyor" };
  const now = Date.now();
  if (end < now) return { tone: "destructive" as const, label: "Süresi dolmuş" };
  const days = Math.ceil((end - now) / 86_400_000);
  if (days <= 30)
    return { tone: "warning" as const, label: `${days} gün kaldı` };
  return { tone: "success" as const, label: "Geçerli" };
}

/** Sahip seri no / vergi kimlik no için en uygun değeri seçer. */
export function ownerId(cert: Certificate): string | undefined {
  return cert.taxId ?? cert.subjectSerialNumber ?? undefined;
}

/** Sertifika için gösterilecek okunabilir ad (id'ye düşmeden). */
export function certName(cert: Certificate): string {
  return cert.commonName ?? cert.subject ?? cert.certificateId;
}

export function CertificateInfoCard({
  cert,
  /** Bir panelin içine gömülüyken kendi çerçeve/zeminini bırakır. */
  bare = false,
}: {
  cert: Certificate;
  bare?: boolean;
}) {
  const status = validity(cert);
  const owner = ownerId(cert);
  const expired = status.tone === "destructive";
  const Icon = expired ? ShieldX : ShieldCheck;

  return (
    <div className={cn(!bare && "rounded-xl border bg-muted/30 p-4")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={cn(
              "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
              expired
                ? "bg-destructive/10 text-destructive"
                : "bg-primary/10 text-primary",
            )}
          >
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold leading-tight">
              {certName(cert)}
            </p>
            {cert.issuerDN ? (
              <p className="truncate text-xs text-muted-foreground">
                {cert.issuerDN}
              </p>
            ) : null}
          </div>
        </div>
        <Badge
          variant={
            status.tone === "success"
              ? "default"
              : status.tone === "warning"
                ? "secondary"
                : status.tone === "destructive"
                  ? "destructive"
                  : "outline"
          }
        >
          {status.label}
        </Badge>
      </div>

      <dl className="mt-4 grid gap-x-4 gap-y-3 sm:grid-cols-2">
        <div className="flex items-center gap-2">
          <Fingerprint className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <dt className="text-xs text-muted-foreground">VKN / TCKN</dt>
            <dd className="truncate font-mono text-sm font-medium">
              {owner ?? "—"}
            </dd>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <dt className="text-xs text-muted-foreground">Geçerlilik</dt>
            <dd className="truncate text-sm font-medium">
              {formatDate(cert.notBefore)} – {formatDate(cert.notAfter)}
            </dd>
          </div>
        </div>
      </dl>
    </div>
  );
}
