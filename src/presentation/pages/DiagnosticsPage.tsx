/**
 * Tanılama sayfası: trace kayıtları, PIN'siz imza probu ve destek paketi.
 * Tüm veriler agent diagnostics API'sinden native gelir; pencere açmaya gerek yoktur.
 */

import { useService } from "@/application/services/hooks";
import { ScrollPage } from "@/presentation/components/common/ScrollPage";
import { PageHeader } from "@/presentation/components/common/PageHeader";
import { ServiceOfflineNotice } from "@/presentation/components/common/ServiceOfflineNotice";
import { Card, CardContent } from "@/presentation/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/presentation/components/ui/tabs";
import { TracesPanel } from "@/presentation/features/diagnostics/TracesPanel";
import { SignProbePanel } from "@/presentation/features/diagnostics/SignProbePanel";
import { SupportBundleButton } from "@/presentation/features/diagnostics/SupportBundleButton";

export function DiagnosticsPage() {
  const { isRunning } = useService("agent");

  if (!isRunning) {
    return (
      <ScrollPage className="space-y-5">
        <PageHeader
          title="Tanılama"
          description="İmza ajanının izleri, kart prob sonuçları ve destek paketi."
        />
        <ServiceOfflineNotice
          title="İmza ajanı çalışmıyor"
          description="Tanılama verisi için önce Genel Bakış'tan imza ajanını başlatın."
        />
      </ScrollPage>
    );
  }

  return (
    <ScrollPage className="space-y-5">
      <PageHeader
        title="Tanılama"
        description="İmza ajanının izleri, kart prob sonuçları ve destek paketi."
      />
      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="traces">
            <div className="mb-6 flex items-center justify-between gap-3">
              <TabsList>
                <TabsTrigger value="traces">İzler</TabsTrigger>
                <TabsTrigger value="probe">İmza Probu</TabsTrigger>
              </TabsList>
              <SupportBundleButton />
            </div>
            <TabsContent value="traces">
              <TracesPanel />
            </TabsContent>
            <TabsContent value="probe">
              <SignProbePanel />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </ScrollPage>
  );
}
