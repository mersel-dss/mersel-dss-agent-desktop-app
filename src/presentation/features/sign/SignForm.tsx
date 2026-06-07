/**
 * PAdES/XAdES imza formu. `mode` ile PDF veya XML akışını yönetir.
 */

import { useState } from "react";
import { PenLine, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useService } from "@/application/services/hooks";
import { useSignPades, useSignXades } from "@/application/signing/hooks";
import { useFiles } from "@/application/platform/hooks";
import type { XadesContentType } from "@/domain/signing/types";
import { basename } from "@/shared/lib/format";
import { errorMessage } from "@/shared/lib/errors";
import { Button } from "@/presentation/components/ui/button";
import { Input } from "@/presentation/components/ui/input";
import { Label } from "@/presentation/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/presentation/components/ui/select";
import { FileDropField } from "@/presentation/components/common/FileDropField";
import { CardCertificateSelect } from "./CardCertificateSelect";

interface SignFormProps {
  mode: "pades" | "xades";
}

const FILTERS = {
  pades: [{ name: "PDF", extensions: ["pdf"] }],
  xades: [{ name: "XML", extensions: ["xml"] }],
};

export function SignForm({ mode }: SignFormProps) {
  const { isRunning } = useService("agent");
  const files = useFiles();
  const signPades = useSignPades();
  const signXades = useSignXades();

  const [terminalName, setTerminalName] = useState<string | null>(null);
  const [certificateId, setCertificateId] = useState<string | null>(null);
  const [contentPath, setContentPath] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [contentType, setContentType] = useState<XadesContentType>("XADES_BES");

  const pending = signPades.isPending || signXades.isPending;
  const canSubmit =
    isRunning && terminalName && certificateId && contentPath && pin.length > 0 && !pending;

  const handleSign = async () => {
    if (!terminalName || !certificateId || !contentPath) return;

    const base = { contentPath, terminalName, certificateId, pin };

    // 1) Önce imzala (PIN burada kullanılır). Çıktı geçici dosyaya yazılır.
    let tempPath: string;
    try {
      tempPath =
        mode === "pades"
          ? await signPades.mutateAsync(base)
          : await signXades.mutateAsync({ ...base, contentType });
    } catch (e) {
      toast.error("İmzalama başarısız", { description: errorMessage(e) });
      return;
    }
    // PIN'i imza biter bitmez temizle (kayıt iptal edilse bile bellekte tutma).
    setPin("");

    // 2) İmza tamamlandı; şimdi kayıt yolunu sor.
    const ext = mode === "pades" ? "pdf" : "xml";
    const suggested = basename(contentPath.replace(/(\.[^.]+)?$/, `-signed.${ext}`));
    const outputPath = await files.pickSavePath({
      title: "İmzalı dosyayı kaydet",
      defaultPath: suggested,
      filters: FILTERS[mode],
    });

    if (!outputPath) {
      toast.info("İmza oluşturuldu", {
        description: "Kaydetme iptal edildi; dosya kaydedilmedi.",
      });
      return;
    }

    // 3) Geçici imzalı dosyayı seçilen konuma taşı.
    try {
      const finalPath = await files.moveFile(tempPath, outputPath);
      toast.success("İmzalandı", { description: basename(finalPath) });
    } catch (e) {
      toast.error("Dosya kaydedilemedi", { description: errorMessage(e) });
    }
  };

  return (
    <div className="space-y-4">
      <CardCertificateSelect
        enabled={isRunning}
        terminalName={terminalName}
        certificateId={certificateId}
        onTerminalChange={(v) => {
          setTerminalName(v);
          setCertificateId(null);
        }}
        onCertificateChange={setCertificateId}
      />

      <FileDropField
        label={mode === "pades" ? "İmzalanacak PDF" : "İmzalanacak XML"}
        hint={mode === "pades" ? "PDF dosyası" : "XML dosyası"}
        value={contentPath}
        onChange={setContentPath}
        filters={FILTERS[mode]}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        {mode === "xades" ? (
          <div className="space-y-1.5">
            <Label>İmza türü</Label>
            <Select
              value={contentType}
              onValueChange={(v) => setContentType(v as XadesContentType)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="XADES_BES">XAdES-BES</SelectItem>
                <SelectItem value="COUNTER_SIGNATURE">
                  Counter-Signature
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="pin">Kart PIN'i</Label>
          <Input
            id="pin"
            type="password"
            autoComplete="off"
            placeholder="••••••"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
          />
        </div>
      </div>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5" />
        PIN yalnızca imza anında kullanılır, hiçbir yerde saklanmaz.
      </p>

      <Button
        onClick={handleSign}
        disabled={!canSubmit}
        className="w-full"
        size="lg"
      >
        <PenLine className="h-4 w-4" />
        {pending ? "İmzalanıyor…" : "İmzala"}
      </Button>
    </div>
  );
}
