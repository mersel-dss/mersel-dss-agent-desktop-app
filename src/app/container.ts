/**
 * Composition root — port arayüzlerini somut Tauri adaptörlerine bağlar.
 * Uygulamanın tek bağımlılık enjeksiyon noktası; testte mock'larla değiştirilebilir.
 */

import type { ServiceGateway } from "@/domain/services/ports";
import type { SigningGateway } from "@/domain/signing/ports";
import type { VirtualCardGateway } from "@/domain/virtualcards/ports";
import type { VerificationGateway } from "@/domain/verification/ports";
import type { DiagnosticsGateway } from "@/domain/diagnostics/ports";
import type { FileGateway } from "@/domain/platform/ports";
import type { UpdaterGateway } from "@/domain/update/ports";
import type { ChangelogGateway } from "@/domain/changelog/ports";

import { TauriServiceGateway } from "@/infrastructure/tauri/serviceGateway";
import { TauriSigningGateway } from "@/infrastructure/tauri/signingGateway";
import { TauriVirtualCardGateway } from "@/infrastructure/tauri/virtualCardsGateway";
import { TauriVerificationGateway } from "@/infrastructure/tauri/verificationGateway";
import { TauriDiagnosticsGateway } from "@/infrastructure/tauri/diagnosticsGateway";
import { TauriFileGateway } from "@/infrastructure/tauri/fileGateway";
import { TauriUpdaterGateway } from "@/infrastructure/tauri/updaterGateway";
import { TauriChangelogGateway } from "@/infrastructure/tauri/changelogGateway";

export interface Container {
  services: ServiceGateway;
  signing: SigningGateway;
  virtualCards: VirtualCardGateway;
  verification: VerificationGateway;
  diagnostics: DiagnosticsGateway;
  files: FileGateway;
  updater: UpdaterGateway;
  changelog: ChangelogGateway;
}

export const container: Container = {
  services: new TauriServiceGateway(),
  signing: new TauriSigningGateway(),
  virtualCards: new TauriVirtualCardGateway(),
  verification: new TauriVerificationGateway(),
  diagnostics: new TauriDiagnosticsGateway(),
  files: new TauriFileGateway(),
  updater: new TauriUpdaterGateway(),
  changelog: new TauriChangelogGateway(),
};
