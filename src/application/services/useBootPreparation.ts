/**
 * Açılış hazırlık durumunu (Java tespiti → paket indirme → servis başlatma)
 * tek bir görünüme indirger. Karşılama/bekleme ekranı (BootSplash) bunu tüketir.
 */

import { useJava, useServices } from "@/application/services/hooks";
import { useDownloadProgress } from "@/application/services/useDownloadProgress";
import type { DownloadProgress } from "@/domain/services/types";

export type BootStepStatus = "pending" | "active" | "done" | "warn";

export type BootStepId = "runtime" | "packages" | "launch";

export interface BootStep {
  id: BootStepId;
  label: string;
  hint: string;
  status: BootStepStatus;
}

export interface BootPreparation {
  steps: BootStep[];
  /** Tüm servisler çalışıyor — hazırlık tamam. */
  ready: boolean;
  /** Bir adım uyarı durumunda (örn. Java yok) — kullanıcı erken geçebilmeli. */
  anyWarn: boolean;
  /** Aktif indirmelerin birleşik yüzdesi (0-100) veya null. */
  downloadPercent: number | null;
}

export function useBootPreparation(): BootPreparation {
  const java = useJava();
  const { data, isLoading } = useServices();
  const progress = useDownloadProgress();

  const services = data ?? [];
  const loaded = !isLoading && services.length > 0;
  const allInstalled = loaded && services.every((s) => s.state !== "not-installed");
  const bothRunning = loaded && services.every((s) => s.state === "running");

  const javaResolved = !java.isLoading && java.data !== undefined;
  const javaOk = java.data?.available === true;

  // İndirme ilerlemesi (toplamı bilinenler üzerinden birleşik yüzde).
  const activeDownloads = Object.values(progress).filter(
    (p): p is DownloadProgress => !!p && !p.done,
  );
  const downloading = activeDownloads.length > 0;
  let downloadPercent: number | null = null;
  const withTotal = activeDownloads.filter((p) => p.total && p.total > 0);
  if (withTotal.length > 0) {
    const downloaded = withTotal.reduce((sum, p) => sum + p.downloaded, 0);
    const total = withTotal.reduce((sum, p) => sum + (p.total ?? 0), 0);
    downloadPercent = Math.min(100, Math.round((downloaded / total) * 100));
  }

  const runtime: BootStepStatus = !javaResolved ? "active" : javaOk ? "done" : "warn";
  const packages: BootStepStatus = allInstalled
    ? "done"
    : downloading || loaded
      ? "active"
      : "pending";
  const launch: BootStepStatus = bothRunning
    ? "done"
    : javaResolved && !javaOk
      ? "warn"
      : allInstalled
        ? "active"
        : "pending";

  const runtimeHint = !javaResolved
    ? "Tespit ediliyor…"
    : javaOk
      ? java.data?.bundled
        ? `Paketlenmiş JRE ${java.data?.major ?? 8} hazır`
        : `Java ${java.data?.major ?? "?"} bulundu`
      : "Bulunamadı — panelden kurabilirsiniz";

  const packagesHint = allInstalled
    ? "En güncel sürüm hazır"
    : downloading
      ? downloadPercent !== null
        ? `İndiriliyor · %${downloadPercent}`
        : "İndiriliyor…"
      : loaded
        ? "Son sürüm kontrol ediliyor…"
        : "Bekliyor";

  const launchHint = bothRunning
    ? "Tüm servisler çalışıyor"
    : launch === "warn"
      ? "Java gerekli"
      : launch === "active"
        ? "Boş porttan başlatılıyor…"
        : "Bekliyor";

  return {
    steps: [
      { id: "runtime", label: "Çalışma zamanı", hint: runtimeHint, status: runtime },
      { id: "packages", label: "Servis paketleri", hint: packagesHint, status: packages },
      { id: "launch", label: "Servisleri başlatma", hint: launchHint, status: launch },
    ],
    ready: bothRunning,
    anyWarn: runtime === "warn" || launch === "warn",
    downloadPercent,
  };
}
