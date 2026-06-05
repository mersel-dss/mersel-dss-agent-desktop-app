/**
 * Trace kayıtları tablosu (Swing paneliyle aynı kolonlar):
 * Saat · Method · Path · Status · Süre · Error · Trace ID. Satıra tıklayınca seçilir.
 */

import { Inbox } from "lucide-react";
import type { TraceRecord } from "@/domain/diagnostics/types";
import { formatTime } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import { EmptyState } from "@/presentation/components/common/EmptyState";
import { HttpStatusBadge } from "@/presentation/components/common/HttpStatusBadge";
import { MethodBadge } from "@/presentation/components/common/MethodBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/presentation/components/ui/table";

interface Props {
  records: TraceRecord[];
  selectedId?: string | null;
  onSelect: (record: TraceRecord) => void;
}

export function TraceTable({ records, selectedId, onSelect }: Props) {
  if (records.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="Henüz trace kaydı yok"
        description="Bir API isteği gönderildiğinde otomatik listelenir. Health / ping gibi gürültü trafiği kaydedilmez."
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-20">Saat</TableHead>
            <TableHead className="w-20">Method</TableHead>
            <TableHead className="min-w-[180px]">Path</TableHead>
            <TableHead className="w-20">Status</TableHead>
            <TableHead className="w-24 text-right">Süre</TableHead>
            <TableHead className="w-40">Error</TableHead>
            <TableHead className="w-44">Trace ID</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((r) => (
            <TableRow
              key={r.traceId}
              onClick={() => onSelect(r)}
              data-state={selectedId === r.traceId ? "selected" : undefined}
              className="cursor-pointer"
            >
              <TableCell className="tnum text-xs text-muted-foreground">
                {formatTime(r.startedAt)}
              </TableCell>
              <TableCell>
                <MethodBadge method={r.method} />
              </TableCell>
              <TableCell className="max-w-[260px] truncate font-medium">{r.path ?? "—"}</TableCell>
              <TableCell>
                <HttpStatusBadge status={r.statusCode} />
              </TableCell>
              <TableCell className="tnum text-right text-muted-foreground">
                {r.durationMs} ms
              </TableCell>
              <TableCell
                className={cn(
                  "text-xs",
                  r.errorCode ? "font-semibold text-destructive" : "text-muted-foreground",
                )}
              >
                {r.errorCode ?? "—"}
              </TableCell>
              <TableCell className="font-mono text-[11px] text-muted-foreground">
                {r.traceId}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
