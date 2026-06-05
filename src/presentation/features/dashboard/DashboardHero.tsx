/**
 * State-aware hero (RunHQ imza deseni): çalışma alanının en kritik durumunu
 * tek bir başlıkta, tona uygun renkte ve ambient gradient ile yansıtır.
 */

import {
  CheckCircle2,
  CircleAlert,
  Loader2,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { useJava, useServices } from "@/application/services/hooks";
import { cn } from "@/shared/lib/utils";

type Tone = "success" | "warning" | "critical" | "idle";

const TONE: Record<
  Tone,
  { dot: string; text: string; grad: string; medallion: string; icon: LucideIcon }
> = {
  success: {
    dot: "bg-status-running",
    text: "text-status-running",
    grad: "5 150 105",
    medallion: "bg-status-running/12 text-status-running ring-status-running/20",
    icon: CheckCircle2,
  },
  warning: {
    dot: "bg-status-starting",
    text: "text-[rgb(var(--tone-warning-fg))]",
    grad: "217 119 6",
    medallion:
      "bg-status-starting/12 text-[rgb(var(--tone-warning-fg))] ring-status-starting/20",
    icon: Loader2,
  },
  critical: {
    dot: "bg-status-error",
    text: "text-status-error",
    grad: "220 38 38",
    medallion: "bg-status-error/12 text-status-error ring-status-error/20",
    icon: CircleAlert,
  },
  idle: {
    dot: "bg-fg-dim",
    text: "text-fg-muted",
    grad: "148 140 130",
    medallion: "bg-surface-muted text-fg-muted ring-border",
    icon: ShieldCheck,
  },
};

export function DashboardHero() {
  const { data } = useServices();
  const java = useJava();

  const total = data?.length ?? 0;
  const running = data?.filter((s) => s.state === "running").length ?? 0;
  const crashed = data?.some((s) => s.state === "crashed") ?? false;

  let tone: Tone = "idle";
  let headline = "Çalışma alanı boşta";
  let sub = "Servisleri başlatınca imza ve doğrulama akışları hazır olur.";

  if (java.data && !java.data.available) {
    tone = "critical";
    headline = "Java çalışma zamanı bulunamadı";
    sub =
      "Paketlenmiş JRE bulunamadı ve sistemde Java yok. Java 8+ kurun veya uygulamayı yeniden yükleyin.";
  } else if (crashed) {
    tone = "critical";
    headline = "Bir servis hata verdi";
    sub = "Aşağıdaki karttan son hatayı inceleyip yeniden başlatabilirsiniz.";
  } else if (total > 0 && running === total) {
    tone = "success";
    headline = "Tüm servisler çalışıyor";
    sub = "İmza ajanı ve doğrulama servisi hazır; tüm akışları kullanabilirsiniz.";
  } else if (running > 0) {
    tone = "warning";
    headline = `${running}/${total} servis çalışıyor`;
    sub = "Kalan servisi Genel Bakış kartından başlatabilirsiniz.";
  }

  const t = TONE[tone];
  const Icon = t.icon;

  return (
    <section className="relative flex items-center gap-3.5 overflow-hidden rounded-lg border border-border bg-surface-raised py-3.5 pr-4 pl-4">
      {/* Sol durum vurgu çizgisi (kart yerine düz şerit imzası). */}
      <span
        aria-hidden
        className={cn("absolute inset-y-0 left-0 w-[3px]", t.dot)}
      />
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-md",
          t.medallion,
        )}
      >
        <Icon className={cn("h-5 w-5", tone === "warning" && "animate-spin")} />
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-fg-dim">
          Çalışma alanı durumu
        </span>
        <h2 className={cn("text-[16px] font-semibold leading-tight", t.text)}>
          {headline}
        </h2>
        <p className="max-w-xl text-[13px] leading-relaxed text-fg-muted">{sub}</p>
      </div>
    </section>
  );
}
