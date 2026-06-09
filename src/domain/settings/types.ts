/**
 * Uygulama ayarları domain tipleri. Varsayılan imza tercihleri ve zaman damgası
 * sağlayıcıları burada modellenir; `settings.json` olarak yerel diske yazılır.
 *
 * Not: Zaman damgası sağlayıcı parolaları yalnızca bu yerel masaüstü makinesinde
 * saklanır; imza ajanına yalnızca işlem anında parametre olarak iletilir.
 */

import type { XadesContentType } from "@/domain/signing/types";
import {
  detectProtocol,
  type TimestampHashAlgorithm,
  type TsaProtocol,
} from "@/domain/timestamp/types";

/** Varsayılan imza tercihleri. */
export interface SigningDefaults {
  /** İmza ekranı açıldığında öne çıkan sekme. */
  defaultMode: "pades" | "xades";
  /** XAdES için varsayılan imza türü. */
  xadesContentType: XadesContentType;
}

/** Kayıtlı bir zaman damgası sağlayıcısı. */
export interface TimestampProvider {
  id: string;
  /** Kullanıcı dostu ad, örn. "TÜBİTAK KamuSM (Üretim)". */
  name: string;
  /** TSA adresi, örn. http://zd.kamusm.gov.tr */
  tsaUrl: string;
  /** TÜBİTAK müşteri no / TSA Basic-Auth kullanıcı adı. */
  tsUserId?: string;
  /** TSA parolası (yerel olarak saklanır). */
  tsUserPassword?: string;
  /** Protokol tercihi (tubitak / standard); TSA adresinden otomatik türetilir. */
  protocol: TsaProtocol;
  /** Varsayılan özet algoritması. */
  hashAlgorithm: TimestampHashAlgorithm;
  /** TSA sertifikası yanıta dahil edilsin mi. */
  certReq: boolean;
  /** Nonce (replay koruması) kullanılsın mı. */
  useNonce: boolean;
}

/** Zaman damgası ayarları. */
export interface TimestampSettings {
  providers: TimestampProvider[];
  /** Yeni işlemde öntanımlı seçilecek sağlayıcı. */
  defaultProviderId: string | null;
}

/** Uygulamanın tüm kalıcı ayarları. */
export interface AppSettings {
  signing: SigningDefaults;
  timestamp: TimestampSettings;
}

/** Hiç ayar kaydı yokken uygulanan güvenli varsayılanlar. */
export const DEFAULT_SETTINGS: AppSettings = {
  signing: {
    defaultMode: "pades",
    xadesContentType: "XADES_BES",
  },
  timestamp: {
    providers: [],
    defaultProviderId: null,
  },
};

/**
 * Diskten okunan (kısmî / eski şema olabilen) ayarları güvenli varsayılanlarla
 * birleştirir. `null`/eksik alanlar varsayılana düşer.
 */
export function mergeSettings(raw: Partial<AppSettings> | null): AppSettings {
  const signing = { ...DEFAULT_SETTINGS.signing, ...(raw?.signing ?? {}) };
  const timestamp = {
    ...DEFAULT_SETTINGS.timestamp,
    ...(raw?.timestamp ?? {}),
  };
  // Defansif: providers her zaman dizi olmalı.
  if (!Array.isArray(timestamp.providers)) {
    timestamp.providers = [];
  }
  // Geriye dönük uyum: eski `auto` protokolü artık yok; TSA adresinden türet.
  timestamp.providers = timestamp.providers.map((p) => {
    const protocol: TsaProtocol =
      p.protocol === "tubitak" || p.protocol === "standard"
        ? p.protocol
        : detectProtocol(p.tsaUrl ?? "");
    return { ...p, protocol };
  });
  return { signing, timestamp };
}
