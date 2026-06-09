/**
 * Yönetilen Java servislerini tek, derli toplu bir grid (tablo) içinde gösterir.
 * Her satır bir servis: durum, port, sürüm ve işlem butonu.
 */

import { Boxes } from "lucide-react";
import type { ServiceSnapshot } from "@/domain/services/types";
import type { ProgressMap } from "@/application/services/useDownloadProgress";
import { Card } from "@/presentation/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/presentation/components/ui/table";
import { Skeleton } from "@/presentation/components/ui/skeleton";
import { ServiceRow } from "@/presentation/features/dashboard/ServiceRow";

interface ServicesPanelProps {
  services: ServiceSnapshot[] | undefined;
  isLoading: boolean;
  progress: ProgressMap;
}

const HEAD_CLASS =
  "h-10 px-4 text-[11px] font-semibold uppercase tracking-[0.06em] text-fg-dim";

export function ServicesPanel({ services, isLoading, progress }: ServicesPanelProps) {
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Boxes className="h-3.5 w-3.5 text-fg-dim" />
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-dim">
          Yönetilen Servisler
        </h2>
      </div>

      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className={HEAD_CLASS}>Servis</TableHead>
            <TableHead className={HEAD_CLASS}>Durum</TableHead>
            <TableHead className={HEAD_CLASS}>Port</TableHead>
            <TableHead className={HEAD_CLASS}>Sürüm</TableHead>
            <TableHead className={`${HEAD_CLASS} text-right`}>İşlem</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="[&_td]:px-4">
          {isLoading ? (
            [0, 1, 2, 3].map((i) => (
              <TableRow key={i} className="hover:bg-transparent">
                <TableCell colSpan={5} className="px-4 py-3">
                  <Skeleton className="h-9 w-full" />
                </TableCell>
              </TableRow>
            ))
          ) : services && services.length > 0 ? (
            services.map((service) => (
              <ServiceRow key={service.kind} service={service} progress={progress} />
            ))
          ) : (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={5} className="px-4 py-8 text-center text-sm text-fg-muted">
                Henüz yönetilen servis yok.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
