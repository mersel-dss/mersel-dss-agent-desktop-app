/**
 * SignatureDiagnostics bloğunu okunabilir biçimde gösterir (token bilgisi,
 * çözümlenen algoritmalar, mekanizmalar, uyarılar, remediation).
 */

import type { SignatureDiagnostics } from "@/domain/diagnostics/types";
import { DescriptionList } from "@/presentation/components/common/DescriptionList";
import { Badge } from "@/presentation/components/ui/badge";

function MechList({ items }: { items?: string[] }) {
  if (!items || items.length === 0) return <span>—</span>;
  return (
    <div className="flex max-w-[320px] flex-wrap justify-end gap-1">
      {items.map((m) => (
        <Badge key={m} variant="secondary" className="font-mono text-[11px]">
          {m}
        </Badge>
      ))}
    </div>
  );
}

export function SignatureDiagnosticsView({ diag }: { diag: SignatureDiagnostics }) {
  return (
    <div className="space-y-3">
      <DescriptionList
        items={[
          { label: "Kart tipi", value: diag.cardType ?? "—" },
          { label: "Token", value: diag.tokenLabel ?? diag.tokenModel ?? "—" },
          { label: "Üretici", value: diag.tokenManufacturerId ?? "—" },
          {
            label: "Anahtar",
            value: diag.keyAlgorithm
              ? `${diag.keyAlgorithm}${diag.keySize ? ` ${diag.keySize} bit` : ""}`
              : "—",
          },
          { label: "JCA imza", value: diag.resolvedJcaSignature ?? "—" },
          { label: "PKCS#11 mekanizma", value: diag.resolvedPkcs11Mechanism ?? "—" },
          { label: "Fallback", value: diag.fallbackStrategy ?? "—" },
          { label: "Mekanizmalar", value: <MechList items={diag.tokenMechanisms} /> },
        ]}
      />

      {diag.warnings && diag.warnings.length > 0 ? (
        <div>
          <p className="mb-1 text-xs font-medium text-warning-foreground">Uyarılar</p>
          <ul className="list-inside list-disc text-xs text-muted-foreground">
            {diag.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {diag.remediation && diag.remediation.length > 0 ? (
        <div>
          <p className="mb-1 text-xs font-medium">Çözüm önerileri</p>
          <ul className="list-inside list-disc text-xs text-muted-foreground">
            {diag.remediation.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
