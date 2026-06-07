/**
 * Agent servisinin sanal kart JSON yanıtlarını domain tiplerine çevirir.
 * Şema değişse de kırılmaması için savunmacı okuma yapar.
 */

import type { VirtualCard } from "@/domain/virtualcards/types";

function extractArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") {
    for (const value of Object.values(raw as Record<string, unknown>)) {
      if (Array.isArray(value)) return value;
    }
  }
  return [];
}

export function parseVirtualCards(raw: unknown): VirtualCard[] {
  return extractArray(raw)
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item) => ({
      name: String(item.name ?? item.terminalName ?? ""),
      type: item.type as string | undefined,
      cardType: item.cardType as string | undefined,
      source: item.source as string | undefined,
      ...item,
    }))
    .filter((card) => card.name.length > 0);
}
