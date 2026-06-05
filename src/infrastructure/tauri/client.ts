/**
 * Tauri komut köprüsü. `invoke` çağrılarını sarmalar ve hataları
 * okunabilir `Error` nesnelerine normalize eder.
 */

import { invoke } from "@tauri-apps/api/core";

export async function call<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch (error) {
    // Rust tarafı AppError'ı düz string olarak serialize eder.
    const message =
      typeof error === "string"
        ? error
        : error instanceof Error
          ? error.message
          : "Beklenmeyen bir hata oluştu.";
    throw new Error(message);
  }
}
