/**
 * Zaman damgası oluşturma çalışma yüzeyi: solda sağlayıcı + belge seçimi,
 * sağda alınan token'ın metadata'sı ve kaydetme aksiyonu. Kayıtlı sağlayıcı
 * bilgileri ajan'a parametre olarak iletilir.
 */

import { useMemo, useState } from "react";
import { Clock, Loader2, RefreshCw, Stamp, Wallet } from "lucide-react";
import { toast } from "sonner";
import type { AppSettings, TimestampProvider } from "@/domain/settings/types";
import {
  TIMESTAMP_HASH_ALGORITHMS,
  type TimestampHashAlgorithm,
  tubitakFlag,
} from "@/domain/timestamp/types";
import {
  useCreateTimestamp,
  useTubitakCredit,
} from "@/application/timestamp/hooks";
import { basename } from "@/shared/lib/format";
import { errorMessage } from "@/shared/lib/errors";
import { Button } from "@/presentation/components/ui/button";
import { Label } from "@/presentation/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/presentation/components/ui/select";
import { FileDropField } from "@/presentation/components/common/FileDropField";
import { IconMedallion } from "@/presentation/components/common/IconMedallion";
import {
  ResultLoading,
  ResultPlaceholder,
  WorkspaceLayout,
} from "@/presentation/features/verify/components/Workspace";
import { TimestampCreationResultView } from "./TimestampCreationResultView";

interface CreateTimestampFormProps {
  settings: AppSettings;
}

export function CreateTimestampForm({ settings }: CreateTimestampFormProps) {
  const providers = settings.timestamp.providers;
  const create = useCreateTimestamp();
  const credit = useTubitakCredit();

  const [providerId, setProviderId] = useState<string>(
    () => settings.timestamp.defaultProviderId ?? providers[0]?.id ?? "",
  );
  const [documentPath, setDocumentPath] = useState<string | null>(null);
  const [hashOverride, setHashOverride] = useState<TimestampHashAlgorithm | "">(
    "",
  );

  const provider = useMemo<TimestampProvider | undefined>(
    () => providers.find((p) => p.id === providerId),
    [providers, providerId],
  );

  const effectiveHash: TimestampHashAlgorithm =
    hashOverride || provider?.hashAlgorithm || "SHA256";

  const isTubitakCapable =
    !!provider &&
    provider.protocol !== "standard" &&
    !!provider.tsUserId &&
    !!provider.tsUserPassword;

  const handleCreate = () => {
    if (!provider || !documentPath) return;
    create.mutate(
      {
        documentPath,
        hashAlgorithm: effectiveHash,
        tsaUrl: provider.tsaUrl,
        tsUserId: provider.tsUserId,
        tsUserPassword: provider.tsUserPassword,
        tubitak: tubitakFlag(provider.protocol),
        certReq: provider.certReq,
        useNonce: provider.useNonce,
      },
      {
        onError: (e) =>
          toast.error("Zaman damgası alınamadı", {
            description: errorMessage(e),
          }),
      },
    );
  };

  const handleCheckCredit = () => {
    if (!provider?.tsUserId || !provider.tsUserPassword) return;
    credit.mutate(
      {
        tsaUrl: provider.tsaUrl,
        tsUserId: provider.tsUserId,
        tsUserPassword: provider.tsUserPassword,
        tubitak: tubitakFlag(provider.protocol),
      },
      {
        onError: (e) =>
          toast.error("Kontör sorgusu başarısız", {
            description: errorMessage(e),
          }),
      },
    );
  };

  const input = (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <IconMedallion size="lg" dashed>
          <Stamp className="h-5 w-5" />
        </IconMedallion>
        <div>
          <h2 className="text-sm font-semibold">Zaman Damgası Al</h2>
          <p className="text-xs text-muted-foreground">RFC 3161 · TSA</p>
        </div>
      </div>

      <div className="space-y-4 border-t border-dashed border-border/70 pt-5">
        <div className="space-y-1.5">
          <Label>Sağlayıcı</Label>
          <Select value={providerId} onValueChange={setProviderId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Sağlayıcı seçin" />
            </SelectTrigger>
            <SelectContent>
              {providers.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {provider ? (
            <p className="truncate font-mono text-[11px] text-fg-dim">
              {provider.tsaUrl}
            </p>
          ) : null}
        </div>

        <FileDropField
          label="Damgalanacak belge"
          hint="Herhangi bir dosya"
          value={documentPath}
          onChange={setDocumentPath}
        />

        <div className="space-y-1.5">
          <Label>Özet algoritması</Label>
          <Select
            value={hashOverride || provider?.hashAlgorithm || "SHA256"}
            onValueChange={(v) =>
              setHashOverride(v as TimestampHashAlgorithm)
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

        {isTubitakCapable ? (
          <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface-muted/40 px-3 py-2.5">
            <span className="flex items-center gap-2 text-xs text-fg-muted">
              <Wallet className="h-3.5 w-3.5" />
              {credit.data?.remainingCredit != null
                ? `Kalan kontör: ${credit.data.remainingCredit.toLocaleString("tr-TR")}`
                : "TÜBİTAK kontör"}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={handleCheckCredit}
              disabled={credit.isPending}
            >
              {credit.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              Sorgula
            </Button>
          </div>
        ) : null}
      </div>

      <Button
        onClick={handleCreate}
        disabled={!provider || !documentPath || create.isPending}
        size="lg"
        className="w-full"
      >
        <Stamp className="h-4 w-4" />
        {create.isPending ? "Alınıyor…" : "Zaman damgası al"}
      </Button>
    </div>
  );

  const result = create.isPending ? (
    <ResultLoading />
  ) : create.data ? (
    <TimestampCreationResultView
      result={create.data}
      documentName={basename(documentPath)}
    />
  ) : (
    <ResultPlaceholder
      icon={<Clock className="h-7 w-7" />}
      title="Zaman damgası burada görünecek"
      description="Soldan bir sağlayıcı ve belge seçip “Zaman damgası al”a basın. Üretilen RFC 3161 token'ını .tst olarak kaydedebilirsiniz."
      highlights={["RFC 3161", "TÜBİTAK ESYA", "TSA token"]}
    />
  );

  return <WorkspaceLayout input={input} result={result} />;
}
