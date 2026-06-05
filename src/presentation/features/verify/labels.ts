/**
 * Doğrulama sonucu enum/kod → Türkçe etiket eşlemeleri ve görsel "ton"
 * yardımcıları. Verifier'ın ham DSS kodlarını İmzager benzeri okunur
 * ifadelere çevirir; tek bir yerde tutulur ki UI bileşenleri saf kalsın.
 */

import type {
  ChainRevocationStatus,
  SignaturePackaging,
  SignatureType,
} from "@/domain/verification/types";

/** Görsel vurgulama tonu. */
export type Tone = "success" | "warning" | "critical" | "neutral";

export const SIGNATURE_TYPE_LABELS: Record<SignatureType, string> = {
  XADES: "XAdES (XML)",
  PADES: "PAdES (PDF)",
  CADES: "CAdES (CMS)",
  ASIC_S: "ASiC-S",
  ASIC_E: "ASiC-E",
  UNKNOWN: "Bilinmiyor",
};

export function signatureTypeLabel(type?: SignatureType | string): string {
  if (!type) return "—";
  return SIGNATURE_TYPE_LABELS[type as SignatureType] ?? String(type);
}

export const PACKAGING_LABELS: Record<SignaturePackaging, string> = {
  ENVELOPED: "Tümleşik İmza (Enveloped)",
  ENVELOPING: "Zarflayan İmza (Enveloping)",
  DETACHED: "Ayrık İmza (Detached)",
};

export function packagingLabel(p?: SignaturePackaging | string): string {
  if (!p) return "—";
  return PACKAGING_LABELS[p as SignaturePackaging] ?? String(p);
}

/**
 * DSS imza seviyesi kodunu (örn. `XAdES-BASELINE-B`, `XAdES_T`,
 * `PAdES_BASELINE_LTA`) İmzager'daki "İmza Tipi" ifadesine çevirir.
 */
export function signatureLevelLabel(level?: string): string {
  if (!level) return "—";
  const u = level.toUpperCase();
  // Arşiv / uzun ömürlü doğrulama (en spesifikten genele doğru kontrol).
  if (u.includes("LTA") || /(_|-|\b)A$/.test(u) || u.includes("ARCHIVE"))
    return "Arşiv İmzası (LTA / A)";
  if (
    u.includes("LT") ||
    u.includes("XL") ||
    /(_|-)X$/.test(u) ||
    /(_|-)C$/.test(u)
  )
    return "Uzun Dönem Doğrulamalı İmza (LT)";
  if (/(_|-)T$/.test(u) || u.includes("BASELINE-T") || u.includes("BASELINE_T"))
    return "Zaman Damgalı İmza (T)";
  if (u.includes("EPES")) return "Politika Bazlı İmza (EPES)";
  if (u.includes("BES") || u.includes("BASELINE-B") || u.includes("BASELINE_B"))
    return "Basit Elektronik İmza (BES)";
  return level;
}

/** DSS indication kodunu Türkçeleştirir. */
export function indicationLabel(indication?: string): string {
  if (!indication) return "—";
  switch (indication.toUpperCase()) {
    case "TOTAL_PASSED":
    case "PASSED":
      return "Geçerli";
    case "INDETERMINATE":
      return "Belirsiz";
    case "TOTAL_FAILED":
    case "FAILED":
      return "Geçersiz";
    default:
      return indication;
  }
}

export function indicationTone(indication?: string): Tone {
  switch ((indication ?? "").toUpperCase()) {
    case "TOTAL_PASSED":
    case "PASSED":
      return "success";
    case "INDETERMINATE":
      return "warning";
    case "TOTAL_FAILED":
    case "FAILED":
      return "critical";
    default:
      return "neutral";
  }
}

interface LabeledTone {
  label: string;
  tone: Tone;
}

const CHAIN_REVOCATION: Record<ChainRevocationStatus, LabeledTone> = {
  ALL_GOOD: { label: "Tüm zincir geçerli", tone: "success" },
  LEAF_REVOKED: { label: "İmzacı sertifikası iptal edilmiş", tone: "critical" },
  LEAF_GOOD_CA_REVOKED: {
    label: "Ara CA iptal edilmiş",
    tone: "warning",
  },
  UNKNOWN: { label: "İptal durumu bilinmiyor", tone: "warning" },
  NOT_CHECKED: { label: "İptal kontrolü yapılmadı", tone: "neutral" },
};

export function chainRevocationStatus(
  status?: ChainRevocationStatus | string,
): LabeledTone {
  if (!status) return { label: "—", tone: "neutral" };
  return (
    CHAIN_REVOCATION[status as ChainRevocationStatus] ?? {
      label: String(status),
      tone: "neutral",
    }
  );
}

/** Sertifikanın OCSP/CRL durum kodu (`GOOD`/`REVOKED`/`UNKNOWN`). */
export function revocationStatus(status?: string): LabeledTone {
  switch ((status ?? "").toUpperCase()) {
    case "GOOD":
      return { label: "Geçerli (GOOD)", tone: "success" };
    case "REVOKED":
      return { label: "İptal edilmiş (REVOKED)", tone: "critical" };
    case "UNKNOWN":
      return { label: "Bilinmiyor (UNKNOWN)", tone: "warning" };
    default:
      return { label: status ?? "—", tone: "neutral" };
  }
}

/** Yasal kalite seviyesi (QES / AdES-QC / AdES). */
export function qualificationLabel(level?: string): LabeledTone {
  switch ((level ?? "").toUpperCase()) {
    case "QES":
    case "QESIG":
      return { label: "Nitelikli Elektronik İmza (QES)", tone: "success" };
    case "ADES/QC":
    case "ADESIG/QC":
      return {
        label: "Nitelikli Sertifikalı Gelişmiş İmza (AdES/QC)",
        tone: "success",
      };
    case "ADES":
    case "ADESIG":
      return { label: "Gelişmiş Elektronik İmza (AdES)", tone: "warning" };
    case "NA":
    case "N/A":
      return { label: "Belirlenemedi", tone: "neutral" };
    default:
      return { label: level ?? "—", tone: "neutral" };
  }
}

/** Suppression/Rejection severity tonu. */
export function severityTone(severity?: string): Tone {
  switch ((severity ?? "").toUpperCase()) {
    case "INFO":
      return "neutral";
    case "WARN":
    case "WARNING":
      return "warning";
    case "CRITICAL":
    case "ERROR":
    case "FATAL":
      return "critical";
    default:
      return "neutral";
  }
}

/**
 * Bir Distinguished Name'den (CN=…, OU=…) insan-okunur "CN" değerini çıkarır.
 * Bulunamazsa ham DN'i döndürür.
 */
export function commonNameFromDN(dn?: string): string {
  if (!dn) return "—";
  const match = dn.match(/CN=([^,]+)/i);
  return match?.[1]?.trim() ?? dn;
}

/** Bir sertifikanın görünen adı (commonName → subject CN → "—"). */
export function certDisplayName(cert?: {
  commonName?: string;
  subject?: string;
}): string {
  if (!cert) return "—";
  // Boş string'i de atla (`??` boş string'i geçer); subject'ten CN düşür.
  const cn = cert.commonName?.trim();
  if (cn) return cn;
  return commonNameFromDN(cert.subject);
}
