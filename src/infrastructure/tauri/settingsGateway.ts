/**
 * `SettingsGateway` portunun Tauri gerçeklemesi. Ayarları `settings.json`
 * üzerinden okur/yazar; okuma sırasında varsayılanlarla birleştirir.
 */

import type { SettingsGateway } from "@/domain/settings/ports";
import { type AppSettings, mergeSettings } from "@/domain/settings/types";
import { call } from "./client";

export class TauriSettingsGateway implements SettingsGateway {
  async load(): Promise<AppSettings> {
    const raw = await call<Partial<AppSettings> | null>("load_app_settings");
    return mergeSettings(raw);
  }

  save(settings: AppSettings): Promise<void> {
    return call<void>("save_app_settings", { settings });
  }
}
