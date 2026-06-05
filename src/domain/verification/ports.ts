/**
 * Doğrulama port arayüzü.
 */

import type {
  SignatureVerificationResult,
  TimestampVerificationResult,
  VerifySignatureRequest,
  VerifyTimestampRequest,
} from "./types";

export interface VerificationGateway {
  verifySignature(
    request: VerifySignatureRequest,
  ): Promise<SignatureVerificationResult>;
  verifyTimestamp(
    request: VerifyTimestampRequest,
  ): Promise<TimestampVerificationResult>;
}
