/**
 * `ServiceGateway` portunun Tauri gerçeklemesi.
 */

import type { ServiceGateway } from "@/domain/services/ports";
import type {
  JavaInfo,
  ReleaseInfo,
  ServiceKind,
  ServiceSnapshot,
} from "@/domain/services/types";
import { call } from "./client";

export class TauriServiceGateway implements ServiceGateway {
  detectJava(): Promise<JavaInfo> {
    return call<JavaInfo>("detect_java");
  }

  listServices(): Promise<ServiceSnapshot[]> {
    return call<ServiceSnapshot[]>("list_services");
  }

  startService(kind: ServiceKind): Promise<number> {
    return call<number>("start_service", { kind });
  }

  stopService(kind: ServiceKind): Promise<void> {
    return call<void>("stop_service", { kind });
  }

  latestRelease(kind: ServiceKind): Promise<ReleaseInfo> {
    return call<ReleaseInfo>("latest_release", { kind });
  }

  installService(kind: ServiceKind): Promise<string> {
    return call<string>("install_service", { kind });
  }
}
