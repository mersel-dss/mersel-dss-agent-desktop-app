/**
 * İmza port arayüzü. Infrastructure, agent servisini Tauri köprüsüyle çağırır.
 */

import type { CertificatePurpose, PadesSignRequest, XadesSignRequest } from "./types";

export interface SigningGateway {
  /** Bağlı kart okuyucularını ve kartları listeler (ham JSON). */
  listSmartcards(): Promise<unknown>;
  /** Karttaki sertifikaları PIN sormadan listeler (ham JSON). */
  listCertificates(
    terminalName: string,
    purpose?: CertificatePurpose,
  ): Promise<unknown>;
  /** PDF'i PAdES-B ile imzalar; imzalı dosya yolunu döner. */
  signPades(request: PadesSignRequest): Promise<string>;
  /** XML'i XAdES ile imzalar; imzalı dosya yolunu döner. */
  signXades(request: XadesSignRequest): Promise<string>;
}
