/**
 * Doğrulama ekranı — masaüstü inspector düzeni: üstte ince segment çubuğu
 * (İmza / Zaman Damgası), altında tam yükseklikli iki panolu çalışma yüzeyi
 * (girdi rayı solda · sonuç detayı sağda, her biri bağımsız kaydırır).
 */

import { Clock, FileSignature } from "lucide-react";
import { useService } from "@/application/services/hooks";
import { ServiceOfflineNotice } from "@/presentation/components/common/ServiceOfflineNotice";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/presentation/components/ui/tabs";
import { VerifyDocumentForm } from "@/presentation/features/verify/VerifyDocumentForm";
import { VerifyTimestampForm } from "@/presentation/features/verify/VerifyTimestampForm";

export function VerifyPage() {
  const { isRunning } = useService("verifier");

  if (!isRunning) {
    return (
      <div className="page-enter flex h-full items-center justify-center px-5 py-5">
        <ServiceOfflineNotice
          title="Doğrulama servisi çalışmıyor"
          description="Doğrulama yapabilmek için önce Genel Bakış'tan doğrulama servisini başlatın."
        />
      </div>
    );
  }

  return (
    <div className="page-enter h-full px-5 py-5">
      <Tabs
        defaultValue="signature"
        className="flex h-full min-h-0 flex-col gap-0"
      >
        <div className="flex shrink-0 flex-col gap-3 border-b border-border/60 px-4 py-3">
          <div className="min-w-0">
            <h1 className="text-[15px] font-semibold leading-tight tracking-tight">
              Doğrula
            </h1>
            <p className="truncate text-[11.5px] leading-tight text-fg-dim">
              İmza, e-Belge zarfı ve zaman damgası geçerliliği
            </p>
          </div>
          <TabsList className="h-8 w-fit">
            <TabsTrigger value="signature" className="gap-1.5 px-3 text-[12.5px]">
              <FileSignature className="h-3.5 w-3.5" />
              İmza
            </TabsTrigger>
            <TabsTrigger value="timestamp" className="gap-1.5 px-3 text-[12.5px]">
              <Clock className="h-3.5 w-3.5" />
              Zaman Damgası
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="signature" className="min-h-0 flex-1">
          <VerifyDocumentForm />
        </TabsContent>
        <TabsContent value="timestamp" className="min-h-0 flex-1">
          <VerifyTimestampForm />
        </TabsContent>
      </Tabs>
    </div>
  );
}
