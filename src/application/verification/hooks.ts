/**
 * Doğrulama use-case hook'ları.
 */

import { useMutation } from "@tanstack/react-query";
import { container } from "@/app/container";
import type {
  VerifySignatureRequest,
  VerifyTimestampRequest,
} from "@/domain/verification/types";

export function useVerifySignature() {
  return useMutation({
    mutationFn: (request: VerifySignatureRequest) =>
      container.verification.verifySignature(request),
  });
}

export function useVerifyTimestamp() {
  return useMutation({
    mutationFn: (request: VerifyTimestampRequest) =>
      container.verification.verifyTimestamp(request),
  });
}
