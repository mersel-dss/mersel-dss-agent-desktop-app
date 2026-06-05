/**
 * Tek tıkla destek paketi (ZIP) indirir.
 */

import { LifeBuoy } from "lucide-react";
import { toast } from "sonner";
import { useDownloadSupportBundle } from "@/application/diagnostics/hooks";
import { useFiles } from "@/application/platform/hooks";
import { Button } from "@/presentation/components/ui/button";
import { basename } from "@/shared/lib/format";

export function SupportBundleButton() {
  const download = useDownloadSupportBundle();
  const files = useFiles();

  const handleDownload = async () => {
    const path = await files.pickSavePath({
      title: "Destek paketini kaydet",
      defaultPath: `mersel-destek-${Date.now()}.zip`,
      filters: [{ name: "ZIP", extensions: ["zip"] }],
    });
    if (!path) return;
    download.mutate(path, {
      onSuccess: (saved) => toast.success("Destek paketi kaydedildi", { description: basename(saved) }),
      onError: (e) => toast.error("İndirilemedi", { description: (e as Error).message }),
    });
  };

  return (
    <Button variant="outline" onClick={handleDownload} disabled={download.isPending}>
      <LifeBuoy className="h-4 w-4" />
      {download.isPending ? "Hazırlanıyor…" : "Destek paketi"}
    </Button>
  );
}
