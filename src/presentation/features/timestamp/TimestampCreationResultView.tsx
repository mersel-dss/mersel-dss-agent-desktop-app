/**
 * Zaman damgası alma sonucu: durum yüzeyi, TSA/zaman/seri metadata'sı ve
 * token'ı `.tst` olarak diske kaydetme aksiyonu.
 */

import { useState } from "react";
import { CircleCheck, Download, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import type { TimestampCreationResult } from "@/domain/timestamp/types";
import { useFiles } from "@/application/platform/hooks";
import { basename, formatDate } from "@/shared/lib/format";
import { errorMessage } from "@/shared/lib/errors";
import { Button } from "@/presentation/components/ui/button";
import { InfoGrid } from "@/presentation/components/common/InfoGrid";
import { VerdictHero } from "@/presentation/features/verify/components/VerdictHero";

interface TimestampCreationResultViewProps {
  result: TimestampCreationResult;
  /** Token'ın türetildiği belge adı (önerilen dosya adı için). */
  documentName: string;
}

export function TimestampCreationResultView({
  result,
  documentName,
}: TimestampCreationResultViewProps) {
  const files = useFiles();
  const [savedPath, setSavedPath] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    // Orijinal dosyanın TAM adını koruyup `.tsq` ekleriz: belge.pdf → belge.pdf.tsq
    const base = documentName || "belge";
    const suggested = `${base}.tsq`;
    const target = await files.pickSavePath({
      title: "Zaman damgası token'ını kaydet",
      defaultPath: suggested,
      filters: [{ name: "Zaman damgası", extensions: ["tsq", "tsr", "tst"] }],
    });
    if (!target) return;

    setSaving(true);
    try {
      const finalPath = await files.moveFile(result.tempPath, target);
      setSavedPath(finalPath);
      toast.success("Token kaydedildi", { description: basename(finalPath) });
    } catch (e) {
      toast.error("Kaydedilemedi", { description: errorMessage(e) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <VerdictHero
        tone="success"
        icon={<CircleCheck className="h-7 w-7" />}
        title="Zaman Damgası Alındı"
        subtitle="RFC 3161 token başarıyla üretildi"
        metrics={[
          { label: "TSA", value: result.tsaName ?? "—" },
          { label: "Zaman", value: formatDate(result.timestamp) },
        ]}
      />

      <InfoGrid
        items={[
          { label: "TSA", value: result.tsaName ?? "—" },
          { label: "Zaman", value: formatDate(result.timestamp) },
          {
            label: "Özet Algoritması",
            value: result.hashAlgorithm ? (
              <span className="font-mono text-xs">{result.hashAlgorithm}</span>
            ) : (
              "—"
            ),
          },
          {
            label: "Seri No",
            value: result.serialNumber ? (
              <span className="break-all font-mono text-xs">
                {result.serialNumber}
              </span>
            ) : (
              "—"
            ),
          },
          {
            label: "Nonce",
            value: result.nonce ? (
              <span className="break-all font-mono text-xs">{result.nonce}</span>
            ) : (
              "—"
            ),
          },
        ]}
      />

      {savedPath ? (
        <div className="flex items-start gap-3 rounded-md border border-success/25 bg-success/5 p-4">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-fg">Token kaydedildi</p>
            <p className="mt-0.5 truncate font-mono text-xs text-fg-muted">
              {savedPath}
            </p>
          </div>
        </div>
      ) : (
        <Button onClick={handleSave} disabled={saving} size="lg">
          <Download className="h-4 w-4" />
          {saving ? "Kaydediliyor…" : "Token'ı kaydet (.tsq)"}
        </Button>
      )}
    </div>
  );
}
