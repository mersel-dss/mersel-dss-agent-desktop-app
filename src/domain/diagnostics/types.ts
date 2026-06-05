/**
 * Tanılama domain tipleri. Agent diagnostics API yanıtlarını yansıtır.
 * Tüm uçlar PIN harcamaz, kart sayacını etkilemez.
 */

/** Cause zinciri çerçevesi ({@code CauseChainExtractor.Frame}). */
export interface CauseFrame {
  type: string;
  message?: string;
}

/** İmza tanılama bağlamı ({@code SignatureDiagnostics}). */
export interface SignatureDiagnostics {
  terminalName?: string;
  atr?: string;
  cardType?: string;
  pkcs11Library?: string;
  tokenLabel?: string;
  tokenManufacturerId?: string;
  tokenModel?: string;
  tokenFirmwareVersion?: string;
  tokenHardwareVersion?: string;
  tokenSerialMasked?: string;
  keyAlgorithm?: string;
  keySize?: number;
  tokenMechanisms?: string[];
  attemptedSignatureAlgorithm?: string;
  resolvedJcaSignature?: string;
  resolvedPkcs11Mechanism?: string;
  fallbackStrategy?: string;
  warnings?: string[];
  remediation?: string[];
  [key: string]: unknown;
}

/** Tek bir HTTP isteğinin tanılama kaydı ({@code TraceRecord}). */
export interface TraceRecord {
  traceId: string;
  startedAt?: string;
  durationMs: number;
  method?: string;
  path?: string;
  querySanitised?: string;
  remoteAddr?: string;
  statusCode: number;
  errorCode?: string;
  errorMessage?: string;
  exceptionType?: string;
  causeChain?: CauseFrame[];
  signatureDiagnostics?: SignatureDiagnostics;
}

export interface TraceStats {
  enabled: boolean;
  capacity: number;
  currentSize: number;
  totalRecorded: number;
  totalDropped: number;
}

export interface TracesResponse {
  stats: TraceStats;
  records: TraceRecord[];
}

/** Dry-run imza probu dalı (RSA/ECDSA). */
export interface ProbeBranch {
  tokenSupports?: boolean;
  outcome?: string;
  errorCode?: string;
  errorMessage?: string;
  diagnostics?: SignatureDiagnostics;
}

export type ProbeOutcome = "WOULD_SUCCEED" | "WOULD_FAIL";

/** {@code POST /diagnostics/sign-probe} sonucu. */
export interface SignProbeResult {
  terminalName?: string;
  atr?: string;
  cardType?: string;
  pkcs11Library?: string;
  outcome?: ProbeOutcome;
  blockingReason?: string;
  remediation?: string[];
  rsa?: ProbeBranch;
  ecdsa?: ProbeBranch;
}
