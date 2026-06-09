/**
 * Zaman damgası sağlayıcısı ekleme/düzenleme diyaloğu. KamuSM/TÜBİTAK ESYA ve
 * standart RFC 3161 TSA'ları tek formda yönetir. Parola yalnızca yerel diskte
 * saklanır, imza ajanına işlem anında parametre olarak gönderilir.
 */

import { useEffect, useState } from "react";
import { KeyRound, Loader2, ServerCog, Wallet } from "lucide-react";
import { toast } from "sonner";
import type { TimestampProvider } from "@/domain/settings/types";
import {
  detectProtocol,
  TIMESTAMP_HASH_ALGORITHMS,
  type TimestampHashAlgorithm,
  type TsaProtocol,
  tubitakFlag,
} from "@/domain/timestamp/types";
import { useTubitakCredit } from "@/application/timestamp/hooks";
import { errorMessage } from "@/shared/lib/errors";
import { Button } from "@/presentation/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/presentation/components/ui/dialog";
import { Input } from "@/presentation/components/ui/input";
import { Label } from "@/presentation/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/presentation/components/ui/select";
import { ToggleField } from "@/presentation/components/common/ToggleField";

const PROTOCOL_LABELS: Record<TsaProtocol, string> = {
  tubitak: "TÜBİTAK ESYA",
  standard: "Standart RFC 3161 TSA",
};

const DEFAULT_TSA_URL = "http://zd.kamusm.gov.tr";

/** Boş bir sağlayıcı taslağı (KamuSM örnek adresiyle). */
export function emptyProvider(): TimestampProvider {
  return {
    id: crypto.randomUUID(),
    name: "",
    tsaUrl: DEFAULT_TSA_URL,
    tsUserId: "",
    tsUserPassword: "",
    protocol: detectProtocol(DEFAULT_TSA_URL),
    hashAlgorithm: "SHA256",
    certReq: true,
    useNonce: false,
  };
}

interface TimestampProviderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Düzenlenecek mevcut sağlayıcı; yeni ekleme için `null`. */
  initial: TimestampProvider | null;
  onSave: (provider: TimestampProvider) => void;
  /** Ajan çalışıyor mu (kontör/bağlantı testi için gerekli). */
  agentRunning: boolean;
}

export function TimestampProviderDialog({
  open,
  onOpenChange,
  initial,
  onSave,
  agentRunning,
}: TimestampProviderDialogProps) {
  const [draft, setDraft] = useState<TimestampProvider>(
    () => initial ?? emptyProvider(),
  );
  const credit = useTubitakCredit();

  // Diyalog her açılışta düzenlenen/yeni sağlayıcıya sıfırlanır.
  useEffect(() => {
    if (open) {
      setDraft(initial ?? emptyProvider());
      credit.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial]);

  const set = <K extends keyof TimestampProvider>(
    key: K,
    value: TimestampProvider[K],
  ) => setDraft((prev) => ({ ...prev, [key]: value }));

  const trimmedName = draft.name.trim();
  const trimmedUrl = draft.tsaUrl.trim();
  const canSave = trimmedName.length > 0 && trimmedUrl.length > 0;

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      ...draft,
      name: trimmedName,
      tsaUrl: trimmedUrl,
      tsUserId: draft.tsUserId?.trim() || undefined,
      tsUserPassword: draft.tsUserPassword || undefined,
    });
    onOpenChange(false);
  };

  const handleTestCredit = () => {
    if (!trimmedUrl || !draft.tsUserId?.trim() || !draft.tsUserPassword) {
      toast.error("Eksik bilgi", {
        description:
          "Kontör sorgusu için TSA adresi, müşteri no ve parola gereklidir.",
      });
      return;
    }
    credit.mutate(
      {
        tsaUrl: trimmedUrl,
        tsUserId: draft.tsUserId.trim(),
        tsUserPassword: draft.tsUserPassword,
        tubitak: tubitakFlag(draft.protocol),
      },
      {
        onSuccess: (data) =>
          toast.success("Bağlantı başarılı", {
            description:
              data.remainingCredit != null
                ? `Kalan kontör: ${data.remainingCredit.toLocaleString("tr-TR")}`
                : (data.message ?? "Kimlik doğrulandı."),
          }),
        onError: (e) =>
          toast.error("Kontör sorgusu başarısız", {
            description: errorMessage(e),
          }),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] gap-0 overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ServerCog className="h-5 w-5 text-primary" />
            {initial ? "Sağlayıcıyı düzenle" : "Zaman damgası sağlayıcısı ekle"}
          </DialogTitle>
          <DialogDescription>
            TSA adresi ve kimlik bilgileri yalnızca bu makinede saklanır; imza
            ajanına işlem anında parametre olarak iletilir.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="provider-name">Sağlayıcı adı</Label>
            <Input
              id="provider-name"
              placeholder="TÜBİTAK KamuSM (Üretim)"
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="provider-url">TSA adresi</Label>
            <Input
              id="provider-url"
              placeholder="http://zd.kamusm.gov.tr"
              value={draft.tsaUrl}
              onChange={(e) => {
                const tsaUrl = e.target.value;
                // Protokolü adresten otomatik türet (KamuSM → TÜBİTAK);
                // kullanıcı aşağıdaki seçimle elle değiştirebilir.
                setDraft((prev) => ({
                  ...prev,
                  tsaUrl,
                  protocol: detectProtocol(tsaUrl),
                }));
              }}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Protokol</Label>
              <Select
                value={draft.protocol}
                onValueChange={(v) => set("protocol", v as TsaProtocol)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PROTOCOL_LABELS) as TsaProtocol[]).map((p) => (
                    <SelectItem key={p} value={p}>
                      {PROTOCOL_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-fg-dim">
                TSA adresinden otomatik seçilir; gerekirse değiştirin.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Özet algoritması</Label>
              <Select
                value={draft.hashAlgorithm}
                onValueChange={(v) =>
                  set("hashAlgorithm", v as TimestampHashAlgorithm)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMESTAMP_HASH_ALGORITHMS.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="provider-user">
                Müşteri no / kullanıcı adı
              </Label>
              <Input
                id="provider-user"
                autoComplete="off"
                placeholder="TÜBİTAK için sayısal müşteri no"
                value={draft.tsUserId ?? ""}
                onChange={(e) => set("tsUserId", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="provider-pass">Parola</Label>
              <Input
                id="provider-pass"
                type="password"
                autoComplete="off"
                placeholder="••••••"
                value={draft.tsUserPassword ?? ""}
                onChange={(e) => set("tsUserPassword", e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-3">
            <ToggleField
              label="TSA sertifikasını yanıta dahil et"
              description="certReq — doğrulama için sertifika token'a gömülür."
              checked={draft.certReq}
              onChange={(v) => set("certReq", v)}
            />
            <ToggleField
              label="Nonce kullan"
              description="Replay koruması; sunucu davranışıyla uyum için varsayılan kapalı."
              checked={draft.useNonce}
              onChange={(v) => set("useNonce", v)}
            />
          </div>

          <div className="flex items-center gap-2 rounded-md border border-dashed border-border bg-surface-muted/40 px-3.5 py-3">
            <KeyRound className="h-4 w-4 shrink-0 text-fg-dim" />
            <p className="text-xs leading-relaxed text-fg-muted">
              TÜBİTAK sağlayıcıları için “Kontör sorgula” ile kimlik
              bilgilerini ve bağlantıyı sınayabilirsiniz.
            </p>
          </div>
        </div>

        <DialogFooter className="mt-6 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={handleTestCredit}
            disabled={credit.isPending || !agentRunning}
            title={
              agentRunning
                ? "Kontör sorgula / bağlantıyı test et"
                : "Test için imza ajanı çalışıyor olmalı"
            }
          >
            {credit.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wallet className="h-4 w-4" />
            )}
            Kontör sorgula
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Vazgeç
            </Button>
            <Button type="button" onClick={handleSave} disabled={!canSave}>
              {initial ? "Kaydet" : "Ekle"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
