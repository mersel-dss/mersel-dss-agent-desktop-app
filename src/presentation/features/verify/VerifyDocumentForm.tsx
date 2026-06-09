/**
 * Doküman doğrulama çalışma yüzeyi. Tek ekran: kullanıcı bir dosya verir,
 * sistem **e-Belge zarfını (StandardBusinessDocument) otomatik tespit eder**.
 * Zarfsa içindeki tüm imzalı belgeler çözülüp tek tek doğrulanır; değilse
 * tekil imza (XAdES/PAdES/CAdES) doğrulaması yapılır. Solda girdi, sağda sonuç.
 */

import { useState } from "react";
import { CodeXml, FileSearch, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { errorMessage } from "@/shared/lib/errors";
import { cn } from "@/shared/lib/utils";
import { useVerifyDocument } from "@/application/verification/hooks";
import { useService } from "@/application/services/hooks";
import { usePreviewOutline } from "@/application/preview/hooks";
import type { VerificationLevel } from "@/domain/verification/types";
import { Button } from "@/presentation/components/ui/button";
import { Label } from "@/presentation/components/ui/label";
import { IconMedallion } from "@/presentation/components/common/IconMedallion";
import { FileDropField } from "@/presentation/components/common/FileDropField";
import { DocumentPreviewPanel } from "@/presentation/features/preview/DocumentPreviewPanel";
import { DocumentValidationPanel } from "./DocumentValidationPanel";
import { DocumentSourcePanel } from "./DocumentSourcePanel";
import { SignatureResultView } from "./SignatureResultView";
import { EnvelopeResultView } from "./EnvelopeResultView";
import {
  ResultLoading,
  ResultPlaceholder,
  SegmentedToggle,
  WorkspaceLayout,
} from "./components/Workspace";

type ResultTab = "verify" | "validate" | "preview";

export function VerifyDocumentForm() {
  const verify = useVerifyDocument();
  const xslt = useService("xslt");
  const [signedPath, setSignedPath] = useState<string | null>(null);
  const [originalPath, setOriginalPath] = useState<string | null>(null);
  const [level, setLevel] = useState<VerificationLevel>("COMPREHENSIVE");
  const [resultTab, setResultTab] = useState<ResultTab>("verify");
  // İmza/Şema/Önizleme tablarından bağımsız, üst seviye "ham XML kaynağı" görünümü.
  const [showSource, setShowSource] = useState(false);

  const handleVerify = () => {
    if (!signedPath) return;
    setResultTab("verify");
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
  const verifyBody = verify.isPending ? (
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

  // Doğrulama tamamlandıysa ve XSLT servisi çalışıyorsa, aynı dosya için
  // "İmza ↔ Geçerlilik ↔ Önizleme" geçişi sun: imza doğrulaması, GİB şema/
  // şematron geçerlilik kontrolü ve belgenin kâğıttaki görünümü tek ekranda.
  const canInspect = !!data && !!signedPath && xslt.isRunning;
  // PAdES/PDF gibi ikili belgelerde şema/şematron doğrulaması ve ham XML kaynağı
  // anlamsızdır; bu sekmeler gizlenir, önizleme ise gömülü PDF görüntüleyiciye düşer.
  const outline = usePreviewOutline(canInspect ? signedPath : null);
  const isPdf = outline.data?.kind === "binary";
  // Ham XML kaynağı yalnızca içerik tümüyle XML ise (tekil belge ya da e-Belge
  // zarfı) anlamlıdır; PDF gibi ikili belgelerde ya da tür henüz çözülmemişken yok.
  const isXml =
    outline.data?.kind === "single" || outline.data?.kind === "envelope";
  // PDF'te "Şema & Şematron Kontrolü" sekmesi yoksa o sekmeye düşmeyi engelle.
  const effectiveTab = isPdf && resultTab === "validate" ? "verify" : resultTab;
  const activeTab = canInspect ? effectiveTab : "verify";
  const sourceView = canInspect && isXml && showSource;
  const tabOptions: { value: ResultTab; label: string }[] = [
    { value: "verify", label: "İmza" },
    ...(isPdf
      ? []
      : [{ value: "validate" as const, label: "Şema & Şematron Kontrolü" }]),
    { value: "preview", label: "Önizleme" },
  ];
  const result = (
    <div className="flex h-full min-h-0 flex-col">
      {canInspect ? (
        <div className="mb-4 flex shrink-0 flex-wrap items-center gap-3">
          <div className="w-fit max-w-full">
            <SegmentedToggle
              value={effectiveTab}
              onChange={(v) => {
                setResultTab(v);
                setShowSource(false);
              }}
              options={tabOptions}
            />
          </div>
          {/* Tabların en sağında: tüm tablardan bağımsız ham XML kaynağı geçişi.
              Yalnızca içerik tümüyle XML ise gösterilir (PDF/ikili belgede yok). */}
          {isXml ? (
            <button
              type="button"
              onClick={() => setShowSource((s) => !s)}
              aria-pressed={showSource}
              className={cn(
                "ml-auto flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[13px] font-medium transition-colors",
                showSource
                  ? "border-[rgb(var(--accent))]/40 bg-brand-soft text-foreground"
                  : "border-border bg-surface-muted text-fg-muted hover:text-foreground",
              )}
              title="Belgenin ham XML kaynağını göster"
            >
              <CodeXml className="h-4 w-4" />
              XML Kaynağını göster
            </button>
          ) : null}
        </div>
      ) : null}
      <div
        className={cn(
          "min-h-0 flex-1",
          sourceView || activeTab === "preview" ? "" : "overflow-y-auto",
        )}
      >
        {sourceView ? (
          <DocumentSourcePanel signedPath={signedPath!} />
        ) : activeTab === "preview" ? (
          <DocumentPreviewPanel signedPath={signedPath!} />
        ) : activeTab === "validate" ? (
          <DocumentValidationPanel signedPath={signedPath!} />
        ) : (
          verifyBody
        )}
      </div>
    </div>
  );

  return <WorkspaceLayout input={input} result={result} />;
}
