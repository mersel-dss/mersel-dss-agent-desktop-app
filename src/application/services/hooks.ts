/**
 * Servis runtime use-case hook'ları (react-query).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { container } from "@/app/container";
import type { ServiceKind } from "@/domain/services/types";

export const serviceKeys = {
  java: ["java"] as const,
  javaRuntimes: ["java-runtimes"] as const,
  list: ["services"] as const,
  release: (kind: ServiceKind) => ["release", kind] as const,
};

/** Java runtime tespiti. */
export function useJava() {
  return useQuery({
    queryKey: serviceKeys.java,
    queryFn: () => container.services.detectJava(),
    staleTime: 60_000,
  });
}

/** Servislerin gerektirdiği her Java sürümü için ayrı runtime durumu. */
export function useJavaRuntimes() {
  return useQuery({
    queryKey: serviceKeys.javaRuntimes,
    queryFn: () => container.services.detectJavaRuntimes(),
    staleTime: 60_000,
  });
}

/** Servis durumlarını periyodik tazeler. */
export function useServices(refetchMs = 4000) {
  return useQuery({
    queryKey: serviceKeys.list,
    queryFn: () => container.services.listServices(),
    refetchInterval: refetchMs,
  });
}

/** Tek bir servisin anlık görüntüsünü seçer. */
export function useService(kind: ServiceKind) {
  const query = useServices();
  const service = query.data?.find((s) => s.kind === kind);
  return { service, isRunning: service?.state === "running", query };
}

export interface ServiceHealth {
  total: number;
  running: number;
  /** En az bir servis çöktü mü? */
  crashed: boolean;
  /** Servisler yüklendi ve hepsi çalışıyor mu? */
  allRunning: boolean;
  /** En az bir servis çalışıyor mu? */
  anyRunning: boolean;
}

/**
 * Tüm servislerin toplu sağlık özeti. Üst çubuk durumu, dashboard hero ve
 * boot ekranı gibi yerlerde tekrar eden "kaç/kaç çalışıyor" türetmesini tek noktada toplar.
 */
export function useServiceHealth(): ServiceHealth {
  const { data } = useServices();
  const services = data ?? [];
  const total = services.length;
  const running = services.filter((s) => s.state === "running").length;
  return {
    total,
    running,
    crashed: services.some((s) => s.state === "crashed"),
    allRunning: total > 0 && running === total,
    anyRunning: running > 0,
  };
}

export function useLatestRelease(kind: ServiceKind, enabled = true) {
  return useQuery({
    queryKey: serviceKeys.release(kind),
    queryFn: () => container.services.latestRelease(kind),
    enabled,
    staleTime: 300_000,
  });
}

export function useStartService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (kind: ServiceKind) => container.services.startService(kind),
    onSuccess: () => qc.invalidateQueries({ queryKey: serviceKeys.list }),
  });
}

export function useStopService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (kind: ServiceKind) => container.services.stopService(kind),
    onSuccess: () => qc.invalidateQueries({ queryKey: serviceKeys.list }),
  });
}

export function useRestartService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (kind: ServiceKind) => container.services.restartService(kind),
    onSuccess: () => qc.invalidateQueries({ queryKey: serviceKeys.list }),
  });
}

/**
 * Tüm servisleri işletim sistemine kayıtlı (login'de otomatik kalkan) birimler
 * olarak kurar veya kayıtlarını kaldırır.
 */
export function useInstallOsServices() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => container.services.installOsServices(),
    onSuccess: () => qc.invalidateQueries({ queryKey: serviceKeys.list }),
  });
}

export function useUninstallOsServices() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => container.services.uninstallOsServices(),
    onSuccess: () => qc.invalidateQueries({ queryKey: serviceKeys.list }),
  });
}

export function useInstallService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (kind: ServiceKind) => container.services.installService(kind),
    onSuccess: () => qc.invalidateQueries({ queryKey: serviceKeys.list }),
  });
}

/**
 * Servisi en güncel sürüme getirir (indir + çalışıyorsa yeniden başlat).
 * Yeni sürüm tespit edildiğinde otomatik tetiklenmek üzere kullanılır.
 */
export function useUpdateService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (kind: ServiceKind) => container.services.updateService(kind),
    onSuccess: (_updated, kind) => {
      qc.invalidateQueries({ queryKey: serviceKeys.list });
      qc.invalidateQueries({ queryKey: serviceKeys.release(kind) });
    },
  });
}

export const launchLogKeys = {
  logs: (kind: ServiceKind) => ["launch-logs", kind] as const,
};

export function useServiceLaunchLogs(kind: ServiceKind, enabled = true) {
  return useQuery({
    queryKey: launchLogKeys.logs(kind),
    queryFn: () => container.services.readLaunchLogs(kind),
    enabled,
    refetchInterval: 3000,
    staleTime: 0,
  });
}
