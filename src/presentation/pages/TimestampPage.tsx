/**
 * Zaman damgası sayfası: kayıtlı sağlayıcılarla RFC 3161 token (TÜBİTAK ESYA
 * dahil) üretir. İmza ajanı kapalıysa veya hiç sağlayıcı yoksa yönlendirir.
 */

import { Link } from "react-router-dom";
import { Clock, Settings2 } from "lucide-react";
import { useService } from "@/application/services/hooks";
import { useSettings } from "@/application/settings/hooks";
import { ServiceOfflineNotice } from "@/presentation/components/common/ServiceOfflineNotice";
import { EmptyState } from "@/presentation/components/common/EmptyState";
import { Button } from "@/presentation/components/ui/button";
import { CreateTimestampForm } from "@/presentation/features/timestamp/CreateTimestampForm";

export function TimestampPage() {
  const { isRunning } = useService("agent");
  const { data: settings } = useSettings();

  if (!isRunning) {
    return (
      <div className="page-enter flex h-full items-center justify-center px-5 py-5">
        <ServiceOfflineNotice
          title="İmza ajanı çalışmıyor"
          description="Zaman damgası alabilmek için önce Genel Bakış'tan imza ajanını başlatın."
        />
      </div>
    );
  }

  const hasProviders = (settings?.timestamp.providers.length ?? 0) > 0;

  if (!settings || !hasProviders) {
    return (
      <div className="page-enter flex h-full items-center justify-center px-5 py-5">
        <EmptyState
          icon={Clock}
          title="Önce bir TSA sağlayıcısı ekleyin"
          description="Zaman damgası alabilmek için Ayarlar'dan bir zaman damgası sağlayıcısı (örn. TÜBİTAK KamuSM) tanımlamanız gerekir."
          action={
            <Button asChild variant="outline">
              <Link to="/settings">
                <Settings2 className="h-4 w-4" />
                Ayarlar'a git
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="page-enter h-full px-5 py-5">
      <div className="flex h-full min-h-0 flex-col gap-0">
        <div className="flex h-13 shrink-0 items-center justify-between gap-3 border-b border-border/60 px-4">
          <div className="min-w-0">
            <h1 className="text-[15px] font-semibold leading-tight tracking-tight">
              Zaman Damgası
            </h1>
            <p className="truncate text-[11.5px] leading-tight text-fg-dim">
              RFC 3161 zaman damgası al (TÜBİTAK ESYA dahil)
            </p>
          </div>
        </div>
        <div className="min-h-0 flex-1">
          <CreateTimestampForm settings={settings} />
        </div>
      </div>
    </div>
  );
}
