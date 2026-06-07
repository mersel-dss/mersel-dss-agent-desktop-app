/**
 * Sanal kart (Dummy Card) use-case hook'ları.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { container } from "@/app/container";
import type {
  RegisterPkcs11Request,
  RegisterPkcs12Request,
} from "@/domain/virtualcards/types";
import { signingKeys } from "@/application/signing/hooks";
import { parseVirtualCards } from "./parsers";

export const virtualCardKeys = {
  list: ["virtual-cards"] as const,
};

/** Tanımlı sanal kartları listeler. `enabled` ile agent çalışırken tetiklenir. */
export function useVirtualCards(enabled: boolean) {
  return useQuery({
    queryKey: virtualCardKeys.list,
    queryFn: async () => parseVirtualCards(await container.virtualCards.listVirtualCards()),
    enabled,
  });
}

/** Sanal kart tanım/silme sonrası ilgili sorguları tazeler. */
function useInvalidateVirtualCards() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: virtualCardKeys.list });
    // Sanal kart artık /smartcard listesinde de göründüğü için imza ekranını da tazele.
    qc.invalidateQueries({ queryKey: signingKeys.smartcards });
  };
}

export function useRegisterPkcs11() {
  const invalidate = useInvalidateVirtualCards();
  return useMutation({
    mutationFn: (request: RegisterPkcs11Request) =>
      container.virtualCards.registerPkcs11(request),
    onSuccess: invalidate,
  });
}

export function useRegisterPkcs12() {
  const invalidate = useInvalidateVirtualCards();
  return useMutation({
    mutationFn: (request: RegisterPkcs12Request) =>
      container.virtualCards.registerPkcs12(request),
    onSuccess: invalidate,
  });
}

export function useRemoveVirtualCard() {
  const invalidate = useInvalidateVirtualCards();
  return useMutation({
    mutationFn: (name: string) => container.virtualCards.removeVirtualCard(name),
    onSuccess: invalidate,
  });
}

/** Bir düzenleme isteğinin yeni tanım yükü (PKCS#11 ya da PKCS#12). */
export type EditVirtualCardPayload =
  | { previousName: string; kind: "pkcs11"; request: RegisterPkcs11Request }
  | { previousName: string; kind: "pkcs12"; request: RegisterPkcs12Request };

/**
 * Sanal kartı "düzenler". Ajanda güncelleme ucu olmadığı için işlem,
 * eski kaydı silip yeni tanımı yeniden kaydetme şeklinde yürütülür.
 * Veri kaybını azaltmak için ad değiştiyse önce yeni kayıt eklenir, sonra
 * eski ad silinir; ad aynıysa (çakışmayı önlemek için) önce silip yeniden kaydeder.
 */
export function useEditVirtualCard() {
  const invalidate = useInvalidateVirtualCards();
  return useMutation({
    mutationFn: async (payload: EditVirtualCardPayload) => {
      const register = () =>
        payload.kind === "pkcs11"
          ? container.virtualCards.registerPkcs11(payload.request)
          : container.virtualCards.registerPkcs12(payload.request);

      if (payload.previousName === payload.request.name) {
        await container.virtualCards.removeVirtualCard(payload.previousName);
        await register();
      } else {
        await register();
        await container.virtualCards.removeVirtualCard(payload.previousName);
      }
    },
    onSuccess: invalidate,
  });
}
