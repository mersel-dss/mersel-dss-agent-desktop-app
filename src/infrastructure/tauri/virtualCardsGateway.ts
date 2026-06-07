/**
 * `VirtualCardGateway` portunun Tauri gerçeklemesi.
 * Tauri, JS camelCase argümanlarını Rust snake_case parametrelerine çevirir.
 */

import type { VirtualCardGateway } from "@/domain/virtualcards/ports";
import type {
  RegisterPkcs11Request,
  RegisterPkcs12Request,
} from "@/domain/virtualcards/types";
import { call } from "./client";

export class TauriVirtualCardGateway implements VirtualCardGateway {
  listVirtualCards(): Promise<unknown> {
    return call<unknown>("list_virtual_cards");
  }

  registerPkcs11(request: RegisterPkcs11Request): Promise<unknown> {
    return call<unknown>("register_pkcs11_virtual_card", {
      name: request.name,
      libraryPath: request.libraryPath,
    });
  }

  registerPkcs12(request: RegisterPkcs12Request): Promise<unknown> {
    return call<unknown>("register_pkcs12_virtual_card", {
      name: request.name,
      filePath: request.filePath,
      password: request.password,
    });
  }

  removeVirtualCard(name: string): Promise<void> {
    return call<void>("remove_virtual_card", { name });
  }
}
