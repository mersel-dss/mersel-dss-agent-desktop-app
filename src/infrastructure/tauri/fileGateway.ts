/**
 * `FileGateway` portunun Tauri dialog plugin gerçeklemesi.
 */

import { open, save } from "@tauri-apps/plugin-dialog";
import type { FileGateway, OpenFileOptions, SaveFileOptions } from "@/domain/platform/ports";
import { call } from "./client";

export class TauriFileGateway implements FileGateway {
  async pickFile(options?: OpenFileOptions): Promise<string | null> {
    const selected = await open({
      title: options?.title,
      multiple: false,
      directory: false,
      filters: options?.filters,
    });
    return typeof selected === "string" ? selected : null;
  }

  async pickSavePath(options?: SaveFileOptions): Promise<string | null> {
    const selected = await save({
      title: options?.title,
      defaultPath: options?.defaultPath,
      filters: options?.filters,
    });
    return selected ?? null;
  }

  saveTextFile(path: string, contents: string): Promise<string> {
    return call<string>("write_text_file", { path, contents });
  }

  moveFile(from: string, to: string): Promise<string> {
    return call<string>("persist_file", { from, to });
  }
}
