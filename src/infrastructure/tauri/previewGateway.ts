/**
 * `PreviewGateway` portunun Tauri gerçeklemesi.
 */

import type { PreviewGateway } from "@/domain/preview/ports";
import type {
  PreviewDocumentRequest,
  PreviewOutline,
  PreviewResult,
} from "@/domain/preview/types";
import { call } from "./client";

export class TauriPreviewGateway implements PreviewGateway {
  listDocuments(signedPath: string): Promise<PreviewOutline> {
    return call<PreviewOutline>("list_preview_documents", { signedPath });
  }

  previewDocument(request: PreviewDocumentRequest): Promise<PreviewResult> {
    return call<PreviewResult>("preview_document", {
      signedPath: request.signedPath,
      index: request.index ?? null,
      transformType: request.transformType ?? null,
      useEmbeddedXslt: request.useEmbeddedXslt ?? true,
    });
  }

  readDocumentSource(signedPath: string, index?: number): Promise<string> {
    return call<string>("read_document_source", {
      signedPath,
      index: index ?? null,
    });
  }

  readFileBytes(signedPath: string): Promise<ArrayBuffer> {
    return call<ArrayBuffer>("read_file_bytes", { signedPath });
  }

  openInBrowser(html: string, fileName: string): Promise<string> {
    return call<string>("open_preview_in_browser", { html, fileName });
  }

  printDocument(html: string, fileName: string): Promise<void> {
    return call<void>("print_preview_document", { html, fileName });
  }

  exportPdf(html: string, fileName: string, savePath: string): Promise<string> {
    return call<string>("export_document_pdf", { html, fileName, savePath });
  }
}
