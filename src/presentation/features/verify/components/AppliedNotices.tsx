/**
 * Mersel'in DSS kararına uyguladığı tolerans (suppression) ve Türkiye'ye
 * özgü red (rejection) gerekçelerini audit amaçlı kart olarak gösterir.
 */

import { ShieldQuestion, Ban, ExternalLink } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import type {
  AppliedRejection,
  AppliedSuppression,
} from "@/domain/verification/types";
import { Button } from "@/presentation/components/ui/button";
import { ToneBadge } from "./ToneBadge";
import { severityTone } from "../labels";

function NoticeCard({
  icon,
  code,
  title,
  reason,
  severity,
  docsUrl,
  original,
}: {
  icon: React.ReactNode;
  code?: string;
  title?: string;
  reason?: string;
  severity?: string;
  docsUrl?: string;
  original?: string;
}) {
  return (
    <div className="border-l-2 border-border bg-muted/20 py-2 pl-3 pr-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          {icon}
          <div className="min-w-0">
            <p className="text-sm font-medium">{title ?? code}</p>
            {code ? (
              <code className="font-mono text-[11px] text-muted-foreground">
                {code}
              </code>
            ) : null}
          </div>
        </div>
        {severity ? (
          <ToneBadge tone={severityTone(severity)}>{severity}</ToneBadge>
        ) : null}
      </div>
      {reason ? (
        <p className="mt-2 text-xs text-muted-foreground">{reason}</p>
      ) : null}
      {original ? (
        <p className="mt-1 text-xs text-muted-foreground">
          DSS orijinal kararı:{" "}
          <span className="font-mono">{original}</span>
        </p>
      ) : null}
      {docsUrl ? (
        <Button
          variant="link"
          size="sm"
          className="mt-1 h-auto p-0 text-xs"
          onClick={() => void openUrl(docsUrl)}
        >
          Dokümantasyon <ExternalLink className="h-3 w-3" />
        </Button>
      ) : null}
    </div>
  );
}

export function AppliedNotices({
  suppressions,
  rejections,
}: {
  suppressions?: AppliedSuppression[];
  rejections?: AppliedRejection[];
}) {
  const hasSup = suppressions && suppressions.length > 0;
  const hasRej = rejections && rejections.length > 0;
  if (!hasSup && !hasRej) return null;

  return (
    <div className="space-y-3">
      {hasSup ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Uygulanan Toleranslar
          </p>
          {suppressions!.map((s, i) => (
            <NoticeCard
              key={s.code ?? i}
              icon={<ShieldQuestion className="mt-0.5 h-4 w-4 text-warning-foreground" />}
              code={s.code}
              title={s.title}
              reason={s.reason}
              severity={s.severity}
              docsUrl={s.docsUrl}
              original={
                s.originalIndication
                  ? `${s.originalIndication}${s.originalSubIndication ? ` (${s.originalSubIndication})` : ""}`
                  : undefined
              }
            />
          ))}
        </div>
      ) : null}

      {hasRej ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-destructive">
            Red Gerekçeleri
          </p>
          {rejections!.map((r, i) => (
            <NoticeCard
              key={r.code ?? i}
              icon={<Ban className="mt-0.5 h-4 w-4 text-destructive" />}
              code={r.code}
              title={r.title}
              reason={r.reason}
              severity={r.severity}
              docsUrl={r.docsUrl}
              original={
                r.originalIndication
                  ? `${r.originalIndication}${r.originalSubIndication ? ` (${r.originalSubIndication})` : ""}`
                  : undefined
              }
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
