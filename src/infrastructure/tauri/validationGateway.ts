/**
 * `ValidationGateway` portunun Tauri gerçeklemesi.
 */

import type { ValidationGateway } from "@/domain/validation/ports";
import type {
  ValidateDocumentRequest,
  ValidationReport,
} from "@/domain/validation/types";
import { call } from "./client";

export class TauriValidationGateway implements ValidationGateway {
  validateDocument(request: ValidateDocumentRequest): Promise<ValidationReport> {
    return call<ValidationReport>("validate_document", {
      signedPath: request.signedPath,
      index: request.index ?? null,
    });
  }
}
