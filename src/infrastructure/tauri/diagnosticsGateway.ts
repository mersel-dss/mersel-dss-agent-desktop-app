/**
 * `DiagnosticsGateway` portunun Tauri gerçeklemesi.
 */

import type { DiagnosticsGateway } from "@/domain/diagnostics/ports";
import type { SignProbeResult, TracesResponse } from "@/domain/diagnostics/types";
import { call } from "./client";

export class TauriDiagnosticsGateway implements DiagnosticsGateway {
  listTraces(limit = 100, errorOnly = false): Promise<TracesResponse> {
    return call<TracesResponse>("list_traces", { limit, errorOnly });
  }

  clearTraces(): Promise<void> {
    return call<void>("clear_traces");
  }

  setTracesEnabled(enabled: boolean): Promise<void> {
    return call<void>("set_traces_enabled", { enabled });
  }

  signProbe(
    terminalName: string,
    options?: { pkcs11LibraryPath?: string; cardType?: string },
  ): Promise<SignProbeResult> {
    return call<SignProbeResult>("sign_probe", {
      terminalName,
      pkcs11LibraryPath: options?.pkcs11LibraryPath ?? null,
      cardType: options?.cardType ?? null,
    });
  }

  downloadSupportBundle(outputPath: string): Promise<string> {
    return call<string>("download_support_bundle", { outputPath });
  }
}
