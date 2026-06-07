/**
 * Doküman doğrulama çalışma yüzeyi. Tek ekran: kullanıcı bir dosya verir,
 * sistem **e-Belge zarfını (StandardBusinessDocument) otomatik tespit eder**.
 * Zarfsa içindeki tüm imzalı belgeler çözülüp tek tek doğrulanır; değilse
 * tekil imza (XAdES/PAdES/CAdES) doğrulaması yapılır. Solda girdi, sağda sonuç.
 */

import { useState } from "react";
import { FileSearch, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { errorMessage } from "@/shared/lib/errors";
import { useVerifyDocument } from "@/application/verification/hooks";
import type { VerificationLevel } from "@/domain/verification/types";
import { Button } from "@/presentation/components/ui/button";
import { Label } from "@/presentation/components/ui/label";
import { IconMedallion } from "@/presentation/components/common/IconMedallion";
import { FileDropField } from "@/presentation/components/common/FileDropField";
import { SignatureResultView } from "./SignatureResultView";
import { EnvelopeResultView } from "./EnvelopeResultView";
import {
  ResultLoading,
  ResultPlaceholder,
  SegmentedToggle,
  WorkspaceLayout,
} from "./components/Workspace";

export function VerifyDocumentForm() {
  const verify = useVerifyDocument();
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
          <FileSearch className="h-5 w-5" />
        </IconMedallion>
        <div>
          <h2 className="text-sm font-semibold">İmzalı Doküman</h2>
          <p className="text-xs text-muted-foreground">
            XAdES · PAdES · CAdES · e-Belge zarfı
          </p>
        </div>
      </div>

      <div className="space-y-4 border-t border-dashed border-border/70 pt-5">
        <FileDropField
          label="Doküman"
          hint="İmza dosyası ya da e-Belge zarfı (SBD)"
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
        <p className="text-[11.5px] leading-relaxed text-fg-dim">
          Verdiğiniz dosya bir e-Belge zarfıysa (StandardBusinessDocument)
          otomatik çözülür; içindeki tüm imzalı belgeler tek tek doğrulanır.
        </p>
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

  const data = verify.data;
  const result = verify.isPending ? (
    <ResultLoading />
  ) : data ? (
    data.kind === "envelope" && data.envelope ? (
      <EnvelopeResultView result={data.envelope} />
    ) : data.signature ? (
      <SignatureResultView
        result={data.signature}
        documentId={data.documentId}
        uuid={data.uuid}
      />
    ) : (
      <ResultPlaceholder
        icon={<ShieldCheck className="h-7 w-7" />}
        title="Sonuç çözümlenemedi"
        description="Doğrulama servisi beklenen biçimde yanıt vermedi. Lütfen tekrar deneyin."
      />
    )
  ) : (
    <ResultPlaceholder
      icon={<FileSearch className="h-7 w-7" />}
      title="Doğrulama sonucu burada görünecek"
      description="Soldan bir imzalı doküman ya da e-Belge zarfı seçip “Doğrula”ya basın. Zarf otomatik tespit edilip içindeki tüm belgeler çözülür; sonra imza ağacı, sertifika zinciri ve adım-adım kontroller listelenir."
      highlights={["Otomatik zarf tespiti", "XAdES", "PAdES", "CAdES", "Çoklu belge", "Sertifika zinciri"]}
    />
  );

  return <WorkspaceLayout input={input} result={result} />;
}
