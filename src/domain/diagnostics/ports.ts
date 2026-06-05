/**
 * Tanılama port arayüzü. Infrastructure, agent diagnostics uçlarını Tauri köprüsüyle çağırır.
 */

import type { SignProbeResult, TracesResponse } from "./types";

export interface DiagnosticsGateway {
  /** Bellek içi trace kayıtlarını listeler. */
  listTraces(limit?: number, errorOnly?: boolean): Promise<TracesResponse>;
  /** Trace buffer'ını temizler. */
  clearTraces(): Promise<void>;
  /** Trace recorder'ı açar/kapatır. */
  setTracesEnabled(enabled: boolean): Promise<void>;
  /** PIN'siz dry-run imza tanılaması çalıştırır. */
  signProbe(
    terminalName: string,
    options?: { pkcs11LibraryPath?: string; cardType?: string },
  ): Promise<SignProbeResult>;
  /** Destek paketi ZIP'ini indirir; kayıt yolunu döner. */
  downloadSupportBundle(outputPath: string): Promise<string>;
}
