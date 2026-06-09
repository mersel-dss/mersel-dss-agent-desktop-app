/**
 * Ayarlar use-case hook'ları (react-query). Ayarlar tek bir sorgu altında
 * tutulur; kaydetme sonrası önbellek anında güncellenir.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { container } from "@/app/container";
import { type AppSettings, DEFAULT_SETTINGS } from "@/domain/settings/types";

export const settingsKeys = {
  all: ["settings"] as const,
};

/** Kayıtlı ayarları okur (varsayılanlarla birleştirilmiş). */
export function useSettings() {
  return useQuery({
    queryKey: settingsKeys.all,
    queryFn: () => container.settings.load(),
    staleTime: 30_000,
  });
}

/**
 * Ayarları diske yazar ve önbelleği günceller. Çağıran, yeni ayarın tamamını
 * verir (kısmi güncelleme için önce mevcut ayar okunup birleştirilmelidir).
 */
export function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settings: AppSettings) => container.settings.save(settings),
    onSuccess: (_void, settings) => {
      qc.setQueryData(settingsKeys.all, settings);
    },
  });
}

/** Ayar henüz yüklenmediyse güvenli varsayılanı döndüren yardımcı. */
export function useSettingsValue(): AppSettings {
  const { data } = useSettings();
  return data ?? DEFAULT_SETTINGS;
}
