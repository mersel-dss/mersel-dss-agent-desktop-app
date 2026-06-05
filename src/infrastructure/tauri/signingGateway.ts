/**
 * `SigningGateway` portunun Tauri gerçeklemesi.
 * Tauri, JS camelCase argümanlarını Rust snake_case parametrelerine çevirir.
 */

import type { SigningGateway } from "@/domain/signing/ports";
import type {
  CertificatePurpose,
  PadesSignRequest,
  XadesSignRequest,
} from "@/domain/signing/types";
import { call } from "./client";

export class TauriSigningGateway implements SigningGateway {
  listSmartcards(): Promise<unknown> {
    return call<unknown>("list_smartcards");
  }

  listCertificates(
    terminalName: string,
    purpose: CertificatePurpose = "SIGNING",
  ): Promise<unknown> {
    return call<unknown>("list_certificates", { terminalName, purpose });
  }

  signPades(request: PadesSignRequest): Promise<string> {
    return call<string>("sign_pades", {
      contentPath: request.contentPath,
      terminalName: request.terminalName,
      certificateId: request.certificateId,
      pin: request.pin,
      outputPath: request.outputPath ?? null,
    });
  }

  signXades(request: XadesSignRequest): Promise<string> {
    return call<string>("sign_xades", {
      contentPath: request.contentPath,
      terminalName: request.terminalName,
      certificateId: request.certificateId,
      pin: request.pin,
      contentType: request.contentType,
      outputPath: request.outputPath ?? null,
    });
  }
}
