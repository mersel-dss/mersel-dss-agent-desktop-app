/**
 * Servis runtime use-case hook'ları (react-query).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { container } from "@/app/container";
import type { ServiceKind } from "@/domain/services/types";

export const serviceKeys = {
  java: ["java"] as const,
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

export function useInstallService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (kind: ServiceKind) => container.services.installService(kind),
    onSuccess: () => qc.invalidateQueries({ queryKey: serviceKeys.list }),
  });
}
