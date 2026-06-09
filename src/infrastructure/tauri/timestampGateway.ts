/**
 * `TimestampGateway` portunun Tauri gerçeklemesi. İmza ajanının zaman damgası
 * uçlarını Rust komut köprüsü üzerinden çağırır.
 */

import type { TimestampGateway } from "@/domain/timestamp/ports";
import type {
  CreateTimestampRequest,
  TimestampCreationResult,
  TimestampStatus,
  TubitakCreditRequest,
  TubitakCreditResult,
} from "@/domain/timestamp/types";
import { call } from "./client";

export class TauriTimestampGateway implements TimestampGateway {
  create(request: CreateTimestampRequest): Promise<TimestampCreationResult> {
    return call<TimestampCreationResult>("create_timestamp", {
      documentPath: request.documentPath,
      hashAlgorithm: request.hashAlgorithm,
      tsaUrl: request.tsaUrl,
      tsUserId: request.tsUserId ?? null,
      tsUserPassword: request.tsUserPassword ?? null,
      tubitak: request.tubitak ?? null,
      certReq: request.certReq ?? true,
      useNonce: request.useNonce ?? false,
    });
  }

  checkTubitakCredit(
    request: TubitakCreditRequest,
  ): Promise<TubitakCreditResult> {
    return call<TubitakCreditResult>("check_tubitak_credit", {
      tsaUrl: request.tsaUrl,
      tsUserId: request.tsUserId,
      tsUserPassword: request.tsUserPassword,
      tubitak: request.tubitak ?? null,
    });
  }

  status(): Promise<TimestampStatus> {
    return call<TimestampStatus>("timestamp_status");
  }
}
