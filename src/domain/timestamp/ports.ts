/**
 * Zaman damgası port arayüzü.
 */

import type {
  CreateTimestampRequest,
  TimestampCreationResult,
  TimestampStatus,
  TubitakCreditRequest,
  TubitakCreditResult,
} from "./types";

export interface TimestampGateway {
  /** Belge için RFC 3161 zaman damgası alır (TÜBİTAK ESYA dahil). */
  create(request: CreateTimestampRequest): Promise<TimestampCreationResult>;
  /** TÜBİTAK ESYA kalan kontör miktarını sorgular (bağlantı/kimlik testi). */
  checkTubitakCredit(
    request: TubitakCreditRequest,
  ): Promise<TubitakCreditResult>;
  /** Zaman damgası özelliğinin durumunu döner. */
  status(): Promise<TimestampStatus>;
}
