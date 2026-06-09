/**
 * Zaman damgası use-case hook'ları.
 */

import { useMutation } from "@tanstack/react-query";
import { container } from "@/app/container";
import type {
  CreateTimestampRequest,
  TubitakCreditRequest,
} from "@/domain/timestamp/types";

export function useCreateTimestamp() {
  return useMutation({
    mutationFn: (request: CreateTimestampRequest) =>
      container.timestamp.create(request),
  });
}

export function useTubitakCredit() {
  return useMutation({
    mutationFn: (request: TubitakCreditRequest) =>
      container.timestamp.checkTubitakCredit(request),
  });
}
