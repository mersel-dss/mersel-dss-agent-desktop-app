/**
 * Servislere ait sunum meta verisi (Rust descriptor'larının UI karşılığı).
 */

import type { ServiceKind } from "@/domain/services/types";

export interface ServiceMeta {
  kind: ServiceKind;
  displayName: string;
  shortName: string;
  description: string;
  defaultPort: number;
  repoUrl: string;
}

export const SERVICE_META: Record<ServiceKind, ServiceMeta> = {
  agent: {
    kind: "agent",
    displayName: "İmzalama Servisi",
    shortName: "İmza Ajanı",
    description:
      "Yereldeki mali mühür / e-imza karta erişir; PAdES ve XAdES imzalar üretir.",
    defaultPort: 15212,
    repoUrl: "https://github.com/mersel-dss/mersel-dss-agent-signer-java",
  },
  verifier: {
    kind: "verifier",
    displayName: "Doğrulama Servisi",
    shortName: "Doğrulama",
    description:
      "İmza ve zaman damgalarını DSS 6.3 ile doğrular; XAdES/PAdES/CAdES destekler.",
    defaultPort: 8086,
    repoUrl: "https://github.com/mersel-dss/mersel-dss-verifier-api-java",
  },
};

export const SERVICE_KINDS: ServiceKind[] = ["agent", "verifier"];
