/**
 * Doğrulama use-case hook'ları.
 */

import { useMutation } from "@tanstack/react-query";
import { container } from "@/app/container";
import type {
  VerifyDocumentRequest,
  VerifyTimestampRequest,
} from "@/domain/verification/types";

export function useVerifyDocument() {
  return useMutation({
    mutationFn: (request: VerifyDocumentRequest) =>
      container.verification.verifyDocument(request),
  });
}

export function useVerifyTimestamp() {
  return useMutation({
    mutationFn: (request: VerifyTimestampRequest) =>
      container.verification.verifyTimestamp(request),
  });
}
