/**
 * Bir trace kaydının detayını 4 sekmede gösterir (Swing paneliyle aynı):
 * Özet · Hata zinciri · İmzalama tanılaması · Ham JSON.
 * Eylemler: JSON'u kopyala, Dışa aktar (.json).
 */

import { Copy, Download } from "lucide-react";
import { toast } from "sonner";
import type { TraceRecord } from "@/domain/diagnostics/types";
import { formatDate } from "@/shared/lib/format";
import { traceToJson, copyToClipboard, safeFileSlug } from "@/shared/lib/diagnostics";
import { errorMessage } from "@/shared/lib/errors";
import { useFiles } from "@/application/platform/hooks";
import { DescriptionList } from "@/presentation/components/common/DescriptionList";
import { HttpStatusBadge } from "@/presentation/components/common/HttpStatusBadge";
import { MethodBadge } from "@/presentation/components/common/MethodBadge";
import { SignatureDiagnosticsView } from "./SignatureDiagnosticsView";
import { Button } from "@/presentation/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/presentation/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/presentation/components/ui/tabs";

interface Props {
  record: TraceRecord | null;
  onClose: () => void;
}

export function TraceDetailDialog({ record, onClose }: Props) {
  const files = useFiles();

  const handleCopy = async () => {
    if (!record) return;
    const ok = await copyToClipboard(traceToJson(record));
    if (ok) toast.success("Trace JSON panoya kopyalandı");
    else toast.error("Panoya kopyalanamadı");
  };

  const handleExport = async () => {
    if (!record) return;
    const path = await files.pickSavePath({
      title: "Trace kaydını dışa aktar",
      defaultPath: `trace-${safeFileSlug(record.traceId)}.json`,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (!path) return;
    try {
      await files.saveTextFile(path, traceToJson(record));
      toast.success("Kayıt dışa aktarıldı");
    } catch (e) {
      toast.error("Dışa aktarma başarısız", { description: errorMessage(e) });
    }
  };

  return (
    <Dialog open={!!record} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-2xl">
        {record ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2 text-sm">
                <MethodBadge method={record.method} />
                <span className="font-mono">{record.path}</span>
                <HttpStatusBadge status={record.statusCode} />
                <span className="tnum text-xs text-muted-foreground">
                  {record.durationMs} ms
                </span>
              </DialogTitle>
              <span className="font-mono text-xs text-muted-foreground">{record.traceId}</span>
            </DialogHeader>

            <Tabs defaultValue="summary" className="flex min-h-0 flex-1 flex-col">
              <TabsList>
                <TabsTrigger value="summary">Özet</TabsTrigger>
                <TabsTrigger value="cause">Hata zinciri</TabsTrigger>
                <TabsTrigger value="sig">İmzalama tanılaması</TabsTrigger>
                <TabsTrigger value="json">Ham JSON</TabsTrigger>
              </TabsList>

              <div className="min-h-0 flex-1 overflow-y-auto pt-4">
                <TabsContent value="summary">
                  <DescriptionList
                    items={[
                      { label: "Zaman", value: formatDate(record.startedAt) },
                      { label: "Süre", value: `${record.durationMs} ms` },
                      { label: "Sorgu", value: record.querySanitised ?? "—" },
                      { label: "İstemci", value: record.remoteAddr ?? "—" },
                      { label: "Hata kodu", value: record.errorCode ?? "—" },
                      { label: "İstisna", value: record.exceptionType ?? "—" },
                    ]}
                  />
                  {record.errorMessage ? (
                    <p className="mt-3 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                      {record.errorMessage}
                    </p>
                  ) : null}
                </TabsContent>

                <TabsContent value="cause">
                  {record.causeChain && record.causeChain.length > 0 ? (
                    <ol className="space-y-1 text-xs">
                      {record.causeChain.map((frame, i) => (
                        <li key={i} className="rounded-md bg-muted/60 p-2">
                          <span className="font-mono text-muted-foreground">{frame.type}</span>
                          {frame.message ? <p className="mt-0.5">{frame.message}</p> : null}
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="text-sm text-muted-foreground">Hata zinciri yok.</p>
                  )}
                </TabsContent>

                <TabsContent value="sig">
                  {record.signatureDiagnostics ? (
                    <SignatureDiagnosticsView diag={record.signatureDiagnostics} />
                  ) : (
                    <p className="text-sm text-muted-foreground">İmza tanılaması yok.</p>
                  )}
                </TabsContent>

                <TabsContent value="json">
                  <pre className="selectable overflow-x-auto rounded-md bg-muted/60 p-3 font-mono text-xs">
                    {traceToJson(record)}
                  </pre>
                </TabsContent>
              </div>
            </Tabs>

            <div className="flex justify-end gap-2 border-t pt-3">
              <Button variant="outline" size="sm" onClick={handleCopy}>
                <Copy className="h-4 w-4" />
                JSON'u kopyala
              </Button>
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4" />
                Dışa aktar (.json)
              </Button>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
