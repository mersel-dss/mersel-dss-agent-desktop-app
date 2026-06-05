/**
 * Açılış karşılama/bekleme ekranı. İlk açılışta servisler (imza ajanı +
 * doğrulama) arka planda hazırlanırken tam ekran, şık bir overlay gösterir:
 * "En iyi deneyim için servislerinizi ayarlıyoruz" hissi.
 *
 * Davranış:
 * - En az `MIN_VISIBLE_MS` görünür (anlık parlamayı önler).
 * - Tüm servisler çalışınca yumuşak fade-out ile kapanır.
 * - `SKIP_AFTER_MS` sonra (veya bir uyarı varsa hemen) "Panele geç" sunar.
 * - `MAX_VISIBLE_MS` aşılırsa kullanıcı asla mahsur kalmasın diye otomatik kapanır.
 */

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  Coffee,
  Loader2,
  PackageCheck,
  Rocket,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import {
  useBootPreparation,
  type BootStep,
  type BootStepId,
  type BootStepStatus,
} from "@/application/services/useBootPreparation";
import { cn } from "@/shared/lib/utils";

const MIN_VISIBLE_MS = 1300;
const SKIP_AFTER_MS = 4000;
const MAX_VISIBLE_MS = 30000;
const FADE_MS = 450;

const STEP_ICON: Record<BootStepId, LucideIcon> = {
  runtime: Coffee,
  packages: PackageCheck,
  launch: Rocket,
};

export function BootSplash() {
  const prep = useBootPreparation();
  const startRef = useRef(Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);
  const [skipped, setSkipped] = useState(false);

  // Geçen süreye bağlı UI (skip butonu, max timeout) için düşük frekanslı tik.
  useEffect(() => {
    if (gone) return;
    const id = setInterval(() => setNow(Date.now()), 400);
    return () => clearInterval(id);
  }, [gone]);

  const elapsed = now - startRef.current;
  const shouldDismiss =
    skipped ||
    (prep.ready && elapsed >= MIN_VISIBLE_MS) ||
    elapsed >= MAX_VISIBLE_MS;

  // 1) Kapanış kararı: yalnızca fade-out'u (leaving) tetikler.
  useEffect(() => {
    if (gone || leaving) return;
    if (shouldDismiss) setLeaving(true);
  }, [shouldDismiss, gone, leaving]);

  // 2) Fade tamamlanınca overlay'i tamamen kaldır. Timeout, yalnızca `leaving`'e
  //    bağlı ayrı bir effect'te kurulur; böylece başka state değişimleri
  //    timeout'u iptal edip kaldırmayı engelleyemez.
  useEffect(() => {
    if (!leaving) return;
    const id = setTimeout(() => setGone(true), FADE_MS);
    return () => clearTimeout(id);
  }, [leaving]);

  if (gone) return null;

  const canSkip = elapsed >= SKIP_AFTER_MS || prep.anyWarn;

  return (
    <div
      data-tauri-drag-region
      className={cn(
        "fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-background transition-opacity duration-[450ms] ease-out",
        leaving ? "pointer-events-none opacity-0" : "opacity-100",
      )}
    >
      {/* Ambient marka parıltısı — sakin, düşük yoğunluklu. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[38%] h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.07] blur-3xl"
        style={{ background: "radial-gradient(circle, rgb(var(--accent)) 0%, transparent 70%)" }}
      />

      <div className="relative z-10 flex w-full max-w-md flex-col items-center px-8 [animation:var(--animate-fade-up)]">
        {/* Marka madalyonu + dönen halka */}
        <div className="relative mb-7 flex h-20 w-20 items-center justify-center">
          <span
            aria-hidden
            className="absolute inset-0 rounded-2xl border-2 border-brand/25 border-t-brand [animation:spin_1.1s_linear_infinite]"
          />
          <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-[22px] font-bold text-primary-foreground shadow-md">
            M
          </span>
        </div>

        <h1 className="text-center text-[19px] font-semibold tracking-tight text-fg">
          Çalışma alanınız hazırlanıyor
        </h1>
        <p className="mt-1.5 max-w-xs text-center text-[13px] leading-relaxed text-fg-muted">
          En iyi deneyim için imza ve doğrulama servislerinizi sizin yerinize
          ayarlıyoruz. Bu yalnızca birkaç saniye sürer.
        </p>

        {/* Adım listesi */}
        <div className="mt-7 w-full rounded-xl border border-border bg-surface-raised/70 p-2 backdrop-blur-sm">
          <ul className="divide-y divide-border">
            {prep.steps.map((step) => (
              <StepRow key={step.id} step={step} />
            ))}
          </ul>

          {/* İndirme ilerleme şeridi */}
          {prep.downloadPercent !== null ? (
            <div className="px-2 pb-1.5 pt-1">
              <div className="h-1 overflow-hidden rounded-full bg-surface-muted">
                <div
                  className="h-full rounded-full bg-brand transition-[width] duration-300 ease-out"
                  style={{ width: `${prep.downloadPercent}%` }}
                />
              </div>
            </div>
          ) : null}
        </div>

        {/* Erken geçiş */}
        <div className="mt-5 h-8">
          {canSkip && !leaving ? (
            <button
              type="button"
              onClick={() => setSkipped(true)}
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-medium text-fg-muted transition-colors hover:text-fg [animation:var(--animate-fade-in)]"
            >
              {prep.anyWarn ? "Yine de panele geç" : "Panele geç"}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function StepRow({ step }: { step: BootStep }) {
  const Icon = STEP_ICON[step.id];
  const active = step.status === "active";
  const done = step.status === "done";
  const warn = step.status === "warn";

  return (
    <li className="flex items-center gap-3 px-2 py-2.5">
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors",
          done && "bg-status-running/12 text-status-running",
          active && "bg-brand-soft text-brand-hover",
          warn && "bg-status-starting/15 text-[rgb(var(--tone-warning-fg))]",
          step.status === "pending" && "bg-surface-muted text-fg-dim",
        )}
      >
        <Icon className="h-[18px] w-[18px]" />
      </span>

      <div className="min-w-0 flex-1 text-left">
        <p
          className={cn(
            "text-[13px] font-medium leading-tight",
            step.status === "pending" ? "text-fg-muted" : "text-fg",
          )}
        >
          {step.label}
        </p>
        <p className="truncate text-[11.5px] leading-tight text-fg-muted">
          {step.hint}
        </p>
      </div>

      <StatusGlyph status={step.status} />
    </li>
  );
}

function StatusGlyph({ status }: { status: BootStepStatus }) {
  if (status === "active") {
    return <Loader2 className="h-4 w-4 shrink-0 animate-spin text-brand" />;
  }
  if (status === "done") {
    return (
      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-status-running text-white">
        <Check className="h-2.5 w-2.5" strokeWidth={3} />
      </span>
    );
  }
  if (status === "warn") {
    return (
      <TriangleAlert className="h-4 w-4 shrink-0 text-[rgb(var(--tone-warning-fg))]" />
    );
  }
  return (
    <span className="h-2 w-2 shrink-0 rounded-full border border-border-strong" />
  );
}
