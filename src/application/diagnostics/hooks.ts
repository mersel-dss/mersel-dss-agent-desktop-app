/**
 * Tanılama use-case hook'ları.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { container } from "@/app/container";

export const diagnosticsKeys = {
  traces: (limit: number, errorOnly: boolean) =>
    ["traces", limit, errorOnly] as const,
};

/** Trace kayıtlarını periyodik tazeler (agent çalışırken). */
export function useTraces(opts: {
  limit: number;
  errorOnly: boolean;
  enabled: boolean;
  refetchMs?: number;
}) {
  return useQuery({
    queryKey: diagnosticsKeys.traces(opts.limit, opts.errorOnly),
    queryFn: () => container.diagnostics.listTraces(opts.limit, opts.errorOnly),
    enabled: opts.enabled,
    refetchInterval: opts.refetchMs ?? 3000,
  });
}

export function useClearTraces() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => container.diagnostics.clearTraces(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["traces"] }),
  });
}

export function useSetTracesEnabled() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (enabled: boolean) => container.diagnostics.setTracesEnabled(enabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["traces"] }),
  });
}

export function useSignProbe() {
  return useMutation({
    mutationFn: (vars: { terminalName: string; cardType?: string }) =>
      container.diagnostics.signProbe(vars.terminalName, { cardType: vars.cardType }),
  });
}

export function useDownloadSupportBundle() {
  return useMutation({
    mutationFn: (outputPath: string) =>
      container.diagnostics.downloadSupportBundle(outputPath),
  });
}
