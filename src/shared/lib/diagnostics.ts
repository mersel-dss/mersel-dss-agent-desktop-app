/**
 * Tanılama dışa aktarım/kopyalama yardımcıları (Swing paneliyle aynı davranış).
 */

import type { TraceRecord } from "@/domain/diagnostics/types";

/** Tek kaydı girintili JSON'a çevirir. */
export function traceToJson(record: TraceRecord): string {
  return JSON.stringify(record, null, 2);
}

/** Tüm kayıtları satır-başına-bir-JSON (NDJSON) formatına çevirir. */
export function tracesToNdjson(records: TraceRecord[]): string {
  return records.map((r) => JSON.stringify(r)).join("\n") + "\n";
}

/** Metni panoya kopyalar; başarı durumunu döner. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Dosya adı için güvenli slug (Swing safeForFile ile aynı mantık). */
export function safeFileSlug(value?: string | null): string {
  if (!value) return String(Date.now());
  return value.replace(/[^0-9A-Za-z]/g, "-");
}
