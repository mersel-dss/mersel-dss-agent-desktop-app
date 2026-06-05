/**
 * Kompakt sayfa başlığı (üst-menü düzeninde içerik başlığı). Sol: başlık +
 * açıklama; sağ: opsiyonel aksiyon alanı.
 */

import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-0.5">
        <h1 className="text-xl font-semibold leading-tight tracking-tight">
          {title}
        </h1>
        {description ? (
          <p className="text-[13px] leading-relaxed text-fg-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
