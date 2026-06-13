/**
 * Servislere ait sunum meta verisi (Rust descriptor'larının UI karşılığı).
 */

import type { ServiceKind } from "@/domain/services/types";

export interface ServiceMeta {
  kind: ServiceKind;
  displayName: string;
  shortName: string;
  /** Teknik açıklama (ne yapar). */
  description: string;
  /** Kullanıcı odaklı sade açıklama: bu servisi ne için kullanırsınız. */
  usage: string;
  defaultPort: number;
  repoUrl: string;
  packageLabel?: string;
  docsPath?: string;
}

export const SERVICE_META: Record<ServiceKind, ServiceMeta> = {
  agent: {
    kind: "agent",
    displayName: "İmzalama Servisi",
    shortName: "İmza Ajanı",
    description:
      "Yereldeki mali mühür / e-imza karta erişir; PAdES ve XAdES imzalar üretir.",
    usage:
      "e-Fatura ve e-belgelerinizi mali mühür veya e-imzanızla yasal geçerli biçimde imzalamak için.",
    defaultPort: 15212,
    repoUrl: "https://github.com/mersel-dss/mersel-dss-agent-signer-java",
  },
  verifier: {
    kind: "verifier",
    displayName: "Doğrulama Servisi",
    shortName: "Doğrulama",
    description:
      "İmza ve zaman damgalarını DSS 6.3 ile doğrular; XAdES/PAdES/CAdES destekler.",
    usage:
      "Aldığınız imzalı belgelerin ve zaman damgalarının gerçekten geçerli olduğunu denetlemek için.",
    defaultPort: 8086,
    repoUrl: "https://github.com/mersel-dss/mersel-dss-verifier-api-java",
  },
  xslt: {
    kind: "xslt",
    displayName: "Önizleme Servisi",
    shortName: "Önizleme",
    description:
      "e-Fatura, e-Arşiv ve e-İrsaliye XML'lerini Saxon XSLT ile kâğıttaki gibi HTML'e dönüştürür.",
    usage:
      "e-Fatura, e-Arşiv ve e-İrsaliye XML'lerini kâğıttaki gibi okunabilir önizlemeye çevirmek için.",
    defaultPort: 8080,
    repoUrl: "https://github.com/mersel-os/ebelge-xslt-service",
  },
  "html-to-pdf": {
    kind: "html-to-pdf",
    displayName: "PDF Dönüştürme Servisi",
    shortName: "PDF Servisi",
    description:
      "HTML önizlemelerini Playwright Chromium ile platform bağımsız PDF çıktısına dönüştürür.",
    usage:
      "Belge önizlemelerini paylaşılabilir ve yazdırılabilir PDF dosyasına dönüştürmek için.",
    defaultPort: 5090,
    repoUrl: "https://github.com/mersel-os/html-to-pdf",
    packageLabel: "Paket",
    docsPath: "/scalar/v1",
  },
};

export const SERVICE_KINDS: ServiceKind[] = [
  "agent",
  "verifier",
  "xslt",
  "html-to-pdf",
];
