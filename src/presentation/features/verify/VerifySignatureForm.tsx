/**
 * İmza doğrulama çalışma yüzeyi: solda doküman/ayar girdisi, sağda sonuç.
 */

import { useState } from "react";
import { FileSignature, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { errorMessage } from "@/shared/lib/errors";
import { useVerifySignature } from "@/application/verification/hooks";
import type { VerificationLevel } from "@/domain/verification/types";
import { Button } from "@/presentation/components/ui/button";
import { Label } from "@/presentation/components/ui/label";
import { IconMedallion } from "@/presentation/components/common/IconMedallion";
import { FileDropField } from "@/presentation/components/common/FileDropField";
import { SignatureResultView } from "./SignatureResultView";
import {
  ResultLoading,
  ResultPlaceholder,
  SegmentedToggle,
  WorkspaceLayout,
} from "./components/Workspace";

export function VerifySignatureForm() {
  const verify = useVerifySignature();
  const [signedPath, setSignedPath] = useState<string | null>(null);
  const [originalPath, setOriginalPath] = useState<string | null>(null);
  const [level, setLevel] = useState<VerificationLevel>("COMPREHENSIVE");

  const handleVerify = () => {
    if (!signedPath) return;
    verify.mutate(
      {
        signedPath,
        originalPath: originalPath ?? undefined,
        level,
        // Kapsamlı modda DSS'in tüm FAIL constraint'lerini de iste; böylece
        // "Doğrulama Detayları" penceresi kök neden + tüm kısıtları gösterebilir.
        includeFailedConstraints: level === "COMPREHENSIVE",
      },
      {
        onError: (e) =>
          toast.error("Doğrulama başarısız", {
            description: errorMessage(e),
          }),
      },
    );
  };

  const input = (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <IconMedallion size="lg" dashed>
          <FileSignature className="h-5 w-5" />
        </IconMedallion>
        <div>
          <h2 className="text-sm font-semibold">İmzalı Doküman</h2>
          <p className="text-xs text-muted-foreground">
            XAdES · PAdES · CAdES
          </p>
        </div>
      </div>

      <div className="space-y-4 border-t border-dashed border-border/70 pt-5">
        <FileDropField
          label="İmzalı doküman"
          hint="XML, PDF veya imza dosyası"
          value={signedPath}
          onChange={setSignedPath}
        />
        <FileDropField
          label="Orijinal doküman"
          hint="Ayrık (detached) imza için"
          value={originalPath}
          onChange={setOriginalPath}
          optional
        />
      </div>

      <div className="space-y-2 border-t border-dashed border-border/70 pt-5">
        <Label className="text-xs font-medium uppercase tracking-wider text-fg-dim">
          Doğrulama seviyesi
        </Label>
        <SegmentedToggle
          value={level}
          onChange={(v) => setLevel(v)}
          options={[
            { value: "SIMPLE", label: "Basit", hint: "Yalnızca imza geçerliliği" },
            {
              value: "COMPREHENSIVE",
              label: "Kapsamlı",
              hint: "Sertifika zinciri, iptal, kök neden",
            },
          ]}
        />
      </div>
      <Button
        onClick={handleVerify}
        disabled={!signedPath || verify.isPending}
        size="lg"
        className="w-full"
      >
        <ShieldCheck className="h-4 w-4" />
        {verify.isPending ? "Doğrulanıyor…" : "Doğrula"}
      </Button>
    </div>
  );

  const result = verify.isPending ? (
    <ResultLoading />
  ) : verify.data ? (
    <SignatureResultView result={verify.data} />
  ) : (
    <ResultPlaceholder
      icon={<ShieldCheck className="h-7 w-7" />}
      title="Doğrulama sonucu burada görünecek"
      description="Soldan imzalı bir doküman seçip “Doğrula”ya basın. İmza ağacı, sertifika zinciri ve adım-adım kontroller bu alanda listelenir."
      highlights={["XAdES", "PAdES", "CAdES", "Zaman damgası", "Sertifika zinciri"]}
    />
  );

  return <WorkspaceLayout input={input} result={result} />;
}
