/**
 * Agent servisinin dinamik JSON yanıtlarını domain tiplerine çevirir.
 * Şema değişse de kırılmaması için savunmacı okuma yapar.
 */

import type { Certificate, SmartCard } from "@/domain/signing/types";

/** Bir değerin içinden ilk dizi alanını bulur (ör. { smartCards: [...] }). */
function extractArray(raw: unknown, keys: string[]): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") {
    const record = raw as Record<string, unknown>;
    for (const key of keys) {
      if (Array.isArray(record[key])) return record[key] as unknown[];
    }
    // Bilinen anahtar yoksa ilk dizi alanını döndür.
    for (const value of Object.values(record)) {
      if (Array.isArray(value)) return value;
    }
  }
  return [];
}

export function parseSmartcards(raw: unknown): SmartCard[] {
  const items = extractArray(raw, ["smartCards", "cards", "terminals", "readers", "data"]);
  return items
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item) => ({
      terminalName: String(item.terminalName ?? item.terminal ?? item.name ?? ""),
      cardPresent: (item.cardPresent ?? item.present) as boolean | undefined,
      cardType: item.cardType as string | undefined,
      atr: item.atr as string | undefined,
      ...item,
    }))
    .filter((card) => card.terminalName.length > 0);
}

export function parseCertificates(raw: unknown): Certificate[] {
  const items = extractArray(raw, ["certificates", "certs", "data"]);
  return items
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item) => ({
      certificateId: String(item.certificateId ?? item.id ?? item.alias ?? ""),
      commonName: item.commonName as string | undefined,
      serialNumber: item.serialNumber as string | undefined,
      subjectSerialNumber: (item.subjectSerialNumber ?? item.subjectSerial) as
        | string
        | undefined,
      taxId: (item.taxId ?? item.taxNumber ?? item.vkn ?? item.tckn) as
        | string
        | undefined,
      subject: item.subject as string | undefined,
      issuerDN: item.issuerDN as string | undefined,
      notBefore: item.notBefore as string | undefined,
      notAfter: item.notAfter as string | undefined,
      purpose: item.purpose as string | undefined,
      ...item,
    }))
    .filter((cert) => cert.certificateId.length > 0);
}
