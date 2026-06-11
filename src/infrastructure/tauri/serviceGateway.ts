/**
 * `ServiceGateway` portunun Tauri gerçeklemesi.
 */

import type { ServiceGateway } from "@/domain/services/ports";
import type {
  JavaInfo,
  JavaRuntimeInfo,
  ReleaseInfo,
  ServiceKind,
  ServiceSnapshot,
} from "@/domain/services/types";
import { call } from "./client";

export class TauriServiceGateway implements ServiceGateway {
  detectJava(): Promise<JavaInfo> {
    return call<JavaInfo>("detect_java");
  }

  detectJavaRuntimes(): Promise<JavaRuntimeInfo[]> {
    return call<JavaRuntimeInfo[]>("detect_java_runtimes");
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

  restartService(kind: ServiceKind): Promise<void> {
    return call<void>("restart_service", { kind });
  }

  stopAllServices(): Promise<void> {
    return call<void>("stop_all_services");
  }

  latestRelease(kind: ServiceKind): Promise<ReleaseInfo> {
    return call<ReleaseInfo>("latest_release", { kind });
  }

  installService(kind: ServiceKind): Promise<string> {
    return call<string>("install_service", { kind });
  }

  updateService(kind: ServiceKind): Promise<boolean> {
    return call<boolean>("update_service", { kind });
  }

  readLaunchLogs(kind: ServiceKind, lines?: number): Promise<string> {
    return call<string>("read_service_launch_logs", {
      kind,
      lines: lines ?? 500,
    });
  }

  installOsServices(): Promise<void> {
    return call<void>("install_os_services");
  }

  uninstallOsServices(): Promise<void> {
    return call<void>("uninstall_os_services");
  }

  osServicesInstalled(): Promise<ServiceKind[]> {
    return call<ServiceKind[]>("os_services_installed");
  }
}
