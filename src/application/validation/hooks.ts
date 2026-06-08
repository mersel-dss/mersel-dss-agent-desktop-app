/**
 * Şema/şematron doğrulama use-case hook'ları (react-query).
 */

import { useQuery } from "@tanstack/react-query";
import { container } from "@/app/container";

export const validationKeys = {
  document: (path: string, index: number) =>
    ["validate-document", path, index] as const,
};

/** Seçili belgeyi XSD şeması + şematron kurallarına göre doğrular (tembel/lazy). */
export function useValidateDocument(
  signedPath: string | null,
  index: number,
  enabled: boolean,
) {
  return useQuery({
    queryKey: validationKeys.document(signedPath ?? "", index),
    queryFn: () =>
      container.validation.validateDocument({ signedPath: signedPath!, index }),
    enabled: enabled && !!signedPath,
    staleTime: 60_000,
    // Doğrulama altyapısı geçici hataları için fazladan deneme yapma.
    retry: false,
  });
}
