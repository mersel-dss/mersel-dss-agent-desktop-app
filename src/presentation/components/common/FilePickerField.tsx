/**
 * Dosya seçtirme alanı — etiket + seçili yol + "Seç" butonu.
 */

import { FileUp, X } from "lucide-react";
import { Button } from "@/presentation/components/ui/button";
import { Label } from "@/presentation/components/ui/label";
import { basename } from "@/shared/lib/format";
import type { FileFilter } from "@/domain/platform/ports";
import { useFiles } from "@/application/platform/hooks";

interface FilePickerFieldProps {
  label: string;
  value: string | null;
  onChange: (path: string | null) => void;
  filters?: FileFilter[];
  optional?: boolean;
}

export function FilePickerField({
  label,
  value,
  onChange,
  filters,
  optional,
}: FilePickerFieldProps) {
  const files = useFiles();

  const handlePick = async () => {
    const path = await files.pickFile({ title: label, filters });
    if (path) onChange(path);
  };

  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-2">
        {label}
        {optional ? (
          <span className="text-xs font-normal text-muted-foreground">(opsiyonel)</span>
        ) : null}
      </Label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handlePick}
          className="group flex h-10 flex-1 items-center gap-2.5 truncate rounded-lg border border-input bg-surface-raised px-2.5 text-left text-sm shadow-xs transition-colors hover:border-border-strong hover:bg-surface-muted"
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand-hover transition-colors">
            <FileUp className="h-3.5 w-3.5" />
          </span>
          <span className={value ? "truncate font-medium" : "truncate text-fg-dim"}>
            {value ? basename(value) : "Dosya seçilmedi"}
          </span>
        </button>
        {value ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onChange(null)}
            aria-label="Temizle"
          >
            <X className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
