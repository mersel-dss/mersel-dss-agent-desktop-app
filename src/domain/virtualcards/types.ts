/**
 * Sanal kart (Dummy Card) domain tipleri. Kart takılı olmasa bile PFX/PKCS#11
 * kaynakları "sanal kart" olarak tanımlanır ve normal kart gibi imzada kullanılır.
 */

export type VirtualCardType = "PKCS11" | "PKCS12";

/** Tanımlı bir sanal kart özeti (parola asla yansıtılmaz). */
export interface VirtualCard {
  /** Sanal kartın adı; imza/listeleme uçlarında terminalName olarak kullanılır. */
  name: string;
  /** Kaynak tipi: PKCS11 | PKCS12. */
  type?: VirtualCardType | string;
  /** Gösterilecek kart tipi etiketi (ör. "PKCS#12 (PFX)"). */
  cardType?: string;
  /** Kaynak açıklaması (PFX dosya adı veya PKCS#11 lib yolu). */
  source?: string;
  [key: string]: unknown;
}

/** PKCS#11 sanal kart tanımlama isteği. */
export interface RegisterPkcs11Request {
  name: string;
  /** PKCS#11 paylaşımlı kütüphanenin tam yolu (diskte var olmalı). */
  libraryPath: string;
}

/** PKCS#12 (PFX) sanal kart tanımlama isteği. */
export interface RegisterPkcs12Request {
  name: string;
  /** Seçilen PFX/PKCS#12 dosyasının tam yolu. */
  filePath: string;
  /** PFX parolası — yalnızca tanım anında ajana iletilir. */
  password: string;
}
