/**
 * `ChangelogGateway` portunun Tauri gerçeklemesi.
 */

import type { ChangelogGateway } from "@/domain/changelog/ports";
import type { ChangelogEntry } from "@/domain/changelog/types";
import { call } from "./client";

export class TauriChangelogGateway implements ChangelogGateway {
  listReleases(): Promise<ChangelogEntry[]> {
    return call<ChangelogEntry[]>("list_app_releases");
  }
}
