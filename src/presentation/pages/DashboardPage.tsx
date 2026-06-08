/**
 * Genel bakış sayfası: Java durumu + yönetilen servisler.
 */

import { useServices } from "@/application/services/hooks";
import { useDownloadProgress } from "@/application/services/useDownloadProgress";
import { DashboardHero } from "@/presentation/features/dashboard/DashboardHero";
import { JavaStatusCard } from "@/presentation/features/dashboard/JavaStatusCard";
import { ServiceControlCard } from "@/presentation/features/dashboard/ServiceControlCard";
import { ScrollPage } from "@/presentation/components/common/ScrollPage";
import { PageHeader } from "@/presentation/components/common/PageHeader";
import { Skeleton } from "@/presentation/components/ui/skeleton";

export function DashboardPage() {
  const { data, isLoading } = useServices();
  const progress = useDownloadProgress();

  return (
    <ScrollPage className="space-y-5">
      <PageHeader
        title="Genel Bakış"
        description="Yerel imza ajanı, doğrulama ve önizleme servislerinin durumu."
      />
      <DashboardHero />

      <JavaStatusCard />

      {/* Yönetilen servisler — geniş ekranda üç sütun (her servis bir kart). */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {isLoading
          ? [0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-72 w-full rounded-lg" />
            ))
          : data?.map((service) => (
              <ServiceControlCard
                key={service.kind}
                service={service}
                progress={progress}
              />
            ))}
      </div>
    </ScrollPage>
  );
}
