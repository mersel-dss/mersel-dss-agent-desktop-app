/**
 * Sürüm notları (changelog) port arayüzü.
 */

import type { ChangelogEntry } from "./types";

export interface ChangelogGateway {
  /** Uygulamanın GitHub sürüm notlarını en yeniden eskiye listeler. */
  listReleases(): Promise<ChangelogEntry[]>;
}
