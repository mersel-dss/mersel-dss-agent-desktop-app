/**
 * Ayarlar port arayüzü.
 */

import type { AppSettings } from "./types";

export interface SettingsGateway {
  /** Kayıtlı ayarları okur; kayıt yoksa varsayılanlarla doldurulmuş hâli döner. */
  load(): Promise<AppSettings>;
  /** Ayarların tamamını yerel diske yazar. */
  save(settings: AppSettings): Promise<void>;
}
