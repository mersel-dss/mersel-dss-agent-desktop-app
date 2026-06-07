/**
 * "Servis çalışmıyor" boş durumu — ilgili servis kapalıyken sayfaların
 * gösterdiği ortak uyarı. Kullanıcıyı servisi başlatabileceği Genel Bakış'a yönlendirir.
 */

import { Link } from "react-router-dom";
import { ServerOff } from "lucide-react";
import { EmptyState } from "./EmptyState";
import { Button } from "@/presentation/components/ui/button";

interface ServiceOfflineNoticeProps {
  title: string;
  description: string;
}

export function ServiceOfflineNotice({ title, description }: ServiceOfflineNoticeProps) {
  return (
    <EmptyState
      icon={ServerOff}
      title={title}
      description={description}
      action={
        <Button asChild variant="outline">
          <Link to="/">Genel Bakış'a git</Link>
        </Button>
      }
    />
  );
}
