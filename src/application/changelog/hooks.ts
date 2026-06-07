/**
 * Sürüm notları (changelog) use-case hook'ları (react-query).
 */

import { useQuery } from "@tanstack/react-query";
import { getVersion } from "@tauri-apps/api/app";
import { container } from "@/app/container";

export const changelogKeys = {
  list: ["app-changelog"] as const,
  version: ["app-version"] as const,
};

/** GitHub sürüm notlarını çeker (en yeniden eskiye). */
export function useChangelog() {
  return useQuery({
    queryKey: changelogKeys.list,
    queryFn: () => container.changelog.listReleases(),
    staleTime: 30 * 60 * 1000,
    retry: false,
  });
}

/** Çalışan uygulamanın mevcut sürümünü döner (örn. `0.1.0`). */
export function useAppVersion() {
  return useQuery({
    queryKey: changelogKeys.version,
    queryFn: () => getVersion(),
    staleTime: Infinity,
    retry: false,
  });
}
