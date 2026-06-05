/**
 * İmza use-case hook'ları.
 */

import { useMutation, useQuery } from "@tanstack/react-query";
import { container } from "@/app/container";
import type {
  CertificatePurpose,
  PadesSignRequest,
  XadesSignRequest,
} from "@/domain/signing/types";
import { parseCertificates, parseSmartcards } from "./parsers";

export const signingKeys = {
  smartcards: ["smartcards"] as const,
  certificates: (terminal: string, purpose: CertificatePurpose) =>
    ["certificates", terminal, purpose] as const,
};

/** Bağlı kartları listeler. `enabled` ile agent çalışırken tetiklenir. */
export function useSmartcards(enabled: boolean) {
  return useQuery({
    queryKey: signingKeys.smartcards,
    queryFn: async () => parseSmartcards(await container.signing.listSmartcards()),
    enabled,
  });
}

/** Seçili kart için sertifikaları listeler. */
export function useCertificates(
  terminalName: string | null,
  purpose: CertificatePurpose = "SIGNING",
) {
  return useQuery({
    queryKey: signingKeys.certificates(terminalName ?? "", purpose),
    queryFn: async () =>
      parseCertificates(
        await container.signing.listCertificates(terminalName as string, purpose),
      ),
    enabled: !!terminalName,
  });
}

export function useSignPades() {
  return useMutation({
    mutationFn: (request: PadesSignRequest) => container.signing.signPades(request),
  });
}

export function useSignXades() {
  return useMutation({
    mutationFn: (request: XadesSignRequest) => container.signing.signXades(request),
  });
}
