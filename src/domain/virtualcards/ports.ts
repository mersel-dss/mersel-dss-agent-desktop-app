/**
 * Sanal kart port arayüzü. Infrastructure, agent servisini Tauri köprüsüyle çağırır.
 */

import type { RegisterPkcs11Request, RegisterPkcs12Request } from "./types";

export interface VirtualCardGateway {
  /** Tanımlı sanal kartları listeler (ham JSON). */
  listVirtualCards(): Promise<unknown>;
  /** PKCS#11 (HSM / yüklü sürücü) sanal kart tanımlar; oluşan kayıt (ham JSON). */
  registerPkcs11(request: RegisterPkcs11Request): Promise<unknown>;
  /** PKCS#12 (PFX) sanal kart tanımlar; oluşan kayıt (ham JSON). */
  registerPkcs12(request: RegisterPkcs12Request): Promise<unknown>;
  /** Bir sanal kartı kaldırır. */
  removeVirtualCard(name: string): Promise<void>;
}
