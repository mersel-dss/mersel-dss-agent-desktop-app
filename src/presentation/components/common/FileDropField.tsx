/**
 * Modern dosya alanı — tıkla & seç + gerçek sürükle-bırak (Tauri native).
 * Boşken kesik çerçeveli davet yüzeyi, doluyken seçili dosya + temizleme.
 * Üzerine dosya sürüklendiğinde marka rengiyle vurgulanır.
 */

import { useRef } from "react";
import { FileUp, X } from "lucide-react";
import { basename } from "@/shared/lib/format";
import type { FileFilter } from "@/domain/platform/ports";
import { useFiles } from "@/application/platform/hooks";
import { Label } from "@/presentation/components/ui/label";
import { cn } from "@/shared/lib/utils";
import { useFileDrop } from "./useFileDrop";

interface FileDropFieldProps {
  label: string;
  hint?: string;
  value: string | null;
  onChange: (path: string | null) => void;
  filters?: FileFilter[];
  optional?: boolean;
}

export function FileDropField({
  label,
  hint,
  value,
  onChange,
  filters,
  optional,
}: FileDropFieldProps) {
  const files = useFiles();
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const { ref, isOver } = useFileDrop((paths) => {
    if (paths[0]) onChangeRef.current(paths[0]);
  });

  const handlePick = async () => {
    const path = await files.pickFile({ title: label, filters });
    if (path) onChange(path);
  };

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-fg-dim">
        {label}
        {optional ? (
          <span className="font-normal normal-case tracking-normal text-fg-dim/80">
            opsiyonel
          </span>
        ) : null}
      </Label>

      <div ref={ref as React.RefObject<HTMLDivElement>} className="rounded-md">
        {value ? (
          <div
            className={cn(
              "group flex items-center gap-3 rounded-md border bg-surface-raised px-3.5 py-3 transition-colors",
              isOver ? "border-primary ring-2 ring-primary/30" : "border-border",
            )}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <FileUp className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{basename(value)}</p>
              <button
                type="button"
                onClick={handlePick}
                className="text-xs text-primary/90 hover:text-primary hover:underline"
              >
                Değiştir
              </button>
            </div>
            <button
              type="button"
              onClick={() => onChange(null)}
              aria-label="Temizle"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-fg-dim transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handlePick}
            className={cn(
              "group flex w-full flex-col items-center gap-2.5 rounded-md border border-dashed px-4 py-7 text-center transition-colors duration-150",
              isOver
                ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                : "border-border-strong bg-surface-muted/40 hover:border-primary/50 hover:bg-primary/5",
            )}
          >
            <span
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-md border border-dashed transition-colors",
                isOver
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border-strong bg-surface-raised text-fg-dim group-hover:border-primary/40 group-hover:text-primary",
              )}
            >
              <FileUp className="h-5 w-5" />
            </span>
            <span className="text-sm font-medium text-foreground">
              {isOver ? "Bırak, alayım" : "Dosya seçin veya sürükleyin"}
            </span>
            {hint ? <span className="text-xs text-fg-dim">{hint}</span> : null}
          </button>
        )}
      </div>
    </div>
  );
}
