/**
 * Zaman damgası doğrulama çalışma yüzeyi: solda girdi, sağda sonuç.
 */

import { useState } from "react";
import { Clock } from "lucide-react";
import { toast } from "sonner";
import { errorMessage } from "@/shared/lib/errors";
import { useVerifyTimestamp } from "@/application/verification/hooks";
import { Button } from "@/presentation/components/ui/button";
import { IconMedallion } from "@/presentation/components/common/IconMedallion";
import { FileDropField } from "@/presentation/components/common/FileDropField";
import { TimestampResultView } from "./TimestampResultView";
import {
  ResultLoading,
  ResultPlaceholder,
  WorkspaceLayout,
} from "./components/Workspace";

export function VerifyTimestampForm() {
  const verify = useVerifyTimestamp();
  const [timestampPath, setTimestampPath] = useState<string | null>(null);
  const [originalPath, setOriginalPath] = useState<string | null>(null);

  const handleVerify = () => {
    if (!timestampPath) return;
    verify.mutate(
      { timestampPath, originalPath: originalPath ?? undefined },
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
          <Clock className="h-5 w-5" />
        </IconMedallion>
        <div>
          <h2 className="text-sm font-semibold">Zaman Damgası</h2>
          <p className="text-xs text-muted-foreground">RFC 3161 · TSA</p>
        </div>
      </div>
      <div className="space-y-4 border-t border-dashed border-border/70 pt-5">
        <FileDropField
          label="Zaman damgası dosyası"
          hint=".tsr / .tst"
          value={timestampPath}
          onChange={setTimestampPath}
          filters={[{ name: "Zaman damgası", extensions: ["tsr", "tst"] }]}
        />
        <FileDropField
          label="Orijinal veri"
          hint="Message imprint için"
          value={originalPath}
          onChange={setOriginalPath}
          optional
        />
      </div>
      <Button
        onClick={handleVerify}
        disabled={!timestampPath || verify.isPending}
        size="lg"
        className="w-full"
      >
        <Clock className="h-4 w-4" />
        {verify.isPending ? "Doğrulanıyor…" : "Doğrula"}
      </Button>
    </div>
  );

  const result = verify.isPending ? (
    <ResultLoading />
  ) : verify.data ? (
    <TimestampResultView result={verify.data} />
  ) : (
    <ResultPlaceholder
      icon={<Clock className="h-7 w-7" />}
      title="Zaman damgası sonucu burada görünecek"
      description="Soldan bir .tsr/.tst dosyası seçip “Doğrula”ya basın. TSA bilgisi, message imprint ve sertifika bu alanda listelenir."
      highlights={["RFC 3161", "TSA sertifikası", "Message imprint"]}
    />
  );

  return <WorkspaceLayout input={input} result={result} />;
}
