/**
 * Tanılama sayfası: trace kayıtları, PIN'siz imza probu, destek paketi
 * ve servis başlatma logları.
 */

import { useService } from "@/application/services/hooks";
import { ScrollPage } from "@/presentation/components/common/ScrollPage";
import { PageHeader } from "@/presentation/components/common/PageHeader";
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
import { ServiceLogsPanel } from "@/presentation/features/diagnostics/ServiceLogsPanel";

export function DiagnosticsPage() {
  const { isRunning } = useService("agent");

  return (
    <ScrollPage className="space-y-5">
      <PageHeader
        title="Tanılama"
        description="Servis logları, imza ajanı izleri, kart prob sonuçları ve destek paketi."
      />
      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="service-logs">
            <div className="mb-6 flex items-center justify-between gap-3">
              <TabsList>
                <TabsTrigger value="service-logs">Servis Logları</TabsTrigger>
                <TabsTrigger value="traces" disabled={!isRunning}>
                  İzler
                </TabsTrigger>
                <TabsTrigger value="probe" disabled={!isRunning}>
                  İmza Probu
                </TabsTrigger>
              </TabsList>
              {isRunning ? <SupportBundleButton /> : null}
            </div>
            <TabsContent value="service-logs">
              <ServiceLogsPanel />
            </TabsContent>
            <TabsContent value="traces">
              {isRunning ? (
                <TracesPanel />
              ) : (
                <p className="text-sm text-muted-foreground">
                  İmza ajanı çalışmıyor; izler için önce Genel Bakış'tan imza
                  ajanını başlatın.
                </p>
              )}
            </TabsContent>
            <TabsContent value="probe">
              {isRunning ? (
                <SignProbePanel />
              ) : (
                <p className="text-sm text-muted-foreground">
                  İmza ajanı çalışmıyor; imza probu için önce Genel Bakış'tan
                  imza ajanını başlatın.
                </p>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </ScrollPage>
  );
}
