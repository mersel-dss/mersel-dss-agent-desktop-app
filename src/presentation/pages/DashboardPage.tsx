/**
 * Genel bakış sayfası: Java durumu + yönetilen servisler.
 */

import { useServices } from "@/application/services/hooks";
import { useDownloadProgress } from "@/application/services/useDownloadProgress";
import { DashboardHero } from "@/presentation/features/dashboard/DashboardHero";
import { JavaStatusCard } from "@/presentation/features/dashboard/JavaStatusCard";
import { ServiceSetupBanner } from "@/presentation/features/dashboard/ServiceSetupBanner";
import { ServicesPanel } from "@/presentation/features/dashboard/ServicesPanel";
import { ScrollPage } from "@/presentation/components/common/ScrollPage";
import { PageHeader } from "@/presentation/components/common/PageHeader";

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

      {/* İlk-kurulum durumu — servisler inerken/kurulamadığında görünür. */}
      <ServiceSetupBanner services={data} progress={progress} />

      <JavaStatusCard />

      {/* Yönetilen servisler — tek bir derli toplu grid içinde. */}
      <ServicesPanel services={data} isLoading={isLoading} progress={progress} />
    </ScrollPage>
  );
}
