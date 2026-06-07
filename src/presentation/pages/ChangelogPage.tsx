/**
 * Sürüm Notları (Changelog) — uygulamanın GitHub release'lerini render eder.
 * Masaüstü inspector düzeni: solda sürüm rayı (tarih + rozetler), sağda seçili
 * sürümün GitHub Markdown gövdesi. Veri `list_app_releases` ile GitHub'tan gelir.
 */

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, GitBranch, PackageX, RefreshCw, Tag } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useChangelog, useAppVersion } from "@/application/changelog/hooks";
import type { ChangelogEntry } from "@/domain/changelog/types";
import { BRAND } from "@/shared/brand";
import { formatDate } from "@/shared/lib/format";
import { errorMessage } from "@/shared/lib/errors";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/presentation/components/ui/badge";
import { Button } from "@/presentation/components/ui/button";
import { Skeleton } from "@/presentation/components/ui/skeleton";
import { EmptyState } from "@/presentation/components/common/EmptyState";
import { Markdown } from "@/presentation/components/common/Markdown";

const RELEASES_URL = `${BRAND.github}/mersel-dss-agent-desktop-app/releases`;

/** `v0.1.0` / `0.1.0` → `0.1.0`; sürüm karşılaştırması için normalize eder. */
function normalizeVersion(value?: string | null): string {
  return (value ?? "").trim().replace(/^v/i, "");
}

function ReleaseRail({
  releases,
  selected,
  onSelect,
  currentVersion,
}: {
  releases: ChangelogEntry[];
  selected: number;
  onSelect: (index: number) => void;
  currentVersion?: string;
}) {
  // En son kararlı (ön sürüm olmayan) ilk girdi "En son" rozetini alır.
  const latestStableTag = releases.find((r) => !r.prerelease)?.tag;
  const current = normalizeVersion(currentVersion);

  return (
    <div className="space-y-1">
      <p className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-wider text-fg-dim">
        Sürümler · {releases.length}
      </p>
      {releases.map((release, i) => {
        const active = i === selected;
        const isCurrent = current && normalizeVersion(release.tag) === current;
        const isLatest = release.tag === latestStableTag;
        return (
          <button
            key={release.tag || i}
            type="button"
            onClick={() => onSelect(i)}
            className={cn(
              "relative flex w-full flex-col gap-1 rounded-xl px-3 py-2.5 text-left transition-colors",
              active
                ? "bg-primary/8 ring-1 ring-inset ring-primary/20"
                : "hover:bg-muted/60",
            )}
          >
            {active ? (
              <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary" />
            ) : null}
            <div className="flex items-center gap-2">
              <Tag
                className={cn(
                  "h-3.5 w-3.5 shrink-0",
                  active ? "text-primary" : "text-fg-dim",
                )}
              />
              <span className="truncate text-[13px] font-semibold tnum">
                {release.tag || release.name}
              </span>
            </div>
            <span className="pl-[22px] text-[11.5px] text-fg-dim">
              {formatDate(release.publishedAt)}
            </span>
            {(isCurrent || isLatest || release.prerelease) && (
              <div className="flex flex-wrap gap-1 pl-[22px] pt-0.5">
                {isCurrent ? (
                  <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
                    Yüklü
                  </Badge>
                ) : null}
                {isLatest && !isCurrent ? (
                  <Badge variant="outline" className="border-success/40 bg-success/12 text-success">
                    En son
                  </Badge>
                ) : null}
                {release.prerelease ? (
                  <Badge variant="outline" className="border-warning/50 bg-warning/12 text-warning-foreground">
                    Ön sürüm
                  </Badge>
                ) : null}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

function ReleaseDetail({
  release,
  currentVersion,
}: {
  release: ChangelogEntry;
  currentVersion?: string;
}) {
  const isCurrent =
    !!currentVersion &&
    normalizeVersion(release.tag) === normalizeVersion(currentVersion);

  return (
    <article className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 pb-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-[18px] font-semibold tracking-tight">
              {release.name || release.tag}
            </h2>
            {isCurrent ? (
              <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
                Yüklü sürüm
              </Badge>
            ) : null}
            {release.prerelease ? (
              <Badge variant="outline" className="border-warning/50 bg-warning/12 text-warning-foreground">
                Ön sürüm
              </Badge>
            ) : null}
          </div>
          <p className="text-[12.5px] text-fg-dim">
            {release.tag} · {formatDate(release.publishedAt)}
          </p>
        </div>
        {release.htmlUrl ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => void openUrl(release.htmlUrl!)}
          >
            <ExternalLink className="h-4 w-4" />
            GitHub'da aç
          </Button>
        ) : null}
      </header>

      {release.body && release.body.trim().length > 0 ? (
        <Markdown>{release.body}</Markdown>
      ) : (
        <p className="text-[13px] text-fg-dim">
          Bu sürüm için ayrıntılı not girilmemiş.
        </p>
      )}
    </article>
  );
}

function LoadingState() {
  return (
    <div className="flex h-full min-h-0">
      <aside className="w-[280px] shrink-0 space-y-2 border-r border-border/60 bg-surface-muted/30 p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </aside>
      <div className="flex-1 space-y-4 p-6">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-px w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  );
}

export function ChangelogPage() {
  const { data: releases, isLoading, isError, error, refetch, isFetching } =
    useChangelog();
  const { data: currentVersion } = useAppVersion();
  const [selected, setSelected] = useState(0);

  // Veri değişince seçimi sınırlar içinde tut.
  useEffect(() => {
    setSelected(0);
  }, [releases]);

  const current = useMemo(
    () => (releases ? releases[Math.min(selected, releases.length - 1)] : undefined),
    [releases, selected],
  );

  const header = (
    <div className="flex h-13 shrink-0 items-center justify-between gap-3 border-b border-border/60 px-4">
      <div className="min-w-0">
        <h1 className="text-[15px] font-semibold leading-tight tracking-tight">
          Sürüm Notları
        </h1>
        <p className="truncate text-[11.5px] leading-tight text-fg-dim">
          {BRAND.product} değişiklik günlüğü
          {currentVersion ? ` · Yüklü: v${normalizeVersion(currentVersion)}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
          Yenile
        </Button>
        <Button variant="outline" size="sm" onClick={() => void openUrl(RELEASES_URL)}>
          <GitBranch className="h-4 w-4" />
          GitHub
        </Button>
      </div>
    </div>
  );

  let body: React.ReactNode;
  if (isLoading) {
    body = <LoadingState />;
  } else if (isError) {
    body = (
      <div className="flex h-full items-center justify-center p-8">
        <EmptyState
          icon={PackageX}
          title="Sürüm notları alınamadı"
          description={`GitHub'a ulaşılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin. (${errorMessage(error)})`}
          action={
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              <RefreshCw className="h-4 w-4" />
              Tekrar dene
            </Button>
          }
        />
      </div>
    );
  } else if (!releases || releases.length === 0) {
    body = (
      <div className="flex h-full items-center justify-center p-8">
        <EmptyState
          icon={PackageX}
          title="Henüz yayınlanmış sürüm yok"
          description="Bu depoda görüntülenecek bir release bulunamadı."
        />
      </div>
    );
  } else {
    body = (
      <div className="flex h-full min-h-0">
        <aside className="flex w-[280px] shrink-0 flex-col border-r border-border/60 bg-surface-muted/30">
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <ReleaseRail
              releases={releases}
              selected={selected}
              onSelect={setSelected}
              currentVersion={currentVersion}
            />
          </div>
        </aside>
        <div className="min-w-0 flex-1 overflow-y-auto p-6">
          {current ? (
            <ReleaseDetail release={current} currentVersion={currentVersion} />
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="page-enter flex h-full min-h-0 flex-col px-5 py-5">
      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border/60">
        {header}
        <div className="min-h-0 flex-1">{body}</div>
      </div>
    </div>
  );
}
