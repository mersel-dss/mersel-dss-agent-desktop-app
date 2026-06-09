/**
 * Ayarlar sayfası: varsayılan imza tercihleri ve zaman damgası sağlayıcıları.
 * Değişiklikler anında yerel diske (`settings.json`) yazılır.
 */

import { toast } from "sonner";
import { useService } from "@/application/services/hooks";
import {
  useSaveSettings,
  useSettings,
} from "@/application/settings/hooks";
import type { AppSettings } from "@/domain/settings/types";
import { errorMessage } from "@/shared/lib/errors";
import { ScrollPage } from "@/presentation/components/common/ScrollPage";
import { PageHeader } from "@/presentation/components/common/PageHeader";
import { Skeleton } from "@/presentation/components/ui/skeleton";
import { SigningDefaultsCard } from "@/presentation/features/settings/SigningDefaultsCard";
import { TimestampProvidersCard } from "@/presentation/features/settings/TimestampProvidersCard";

export function SettingsPage() {
  const { data: settings, isLoading } = useSettings();
  const save = useSaveSettings();
  const { isRunning: agentRunning } = useService("agent");

  const handleChange = (next: AppSettings) => {
    save.mutate(next, {
      onError: (e) =>
        toast.error("Ayar kaydedilemedi", { description: errorMessage(e) }),
    });
  };

  return (
    <ScrollPage className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        title="Ayarlar"
        description="Bu projeye özgü varsayılan imza tercihlerini ve zaman damgası sağlayıcılarını yönetin."
      />

      {isLoading || !settings ? (
        <div className="space-y-5">
          <Skeleton className="h-40 w-full rounded-lg" />
          <Skeleton className="h-56 w-full rounded-lg" />
        </div>
      ) : (
        <>
          <SigningDefaultsCard settings={settings} onChange={handleChange} />
          <TimestampProvidersCard
            settings={settings}
            onChange={handleChange}
            agentRunning={agentRunning}
          />
        </>
      )}
    </ScrollPage>
  );
}
