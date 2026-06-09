/**
 * Etiketli ikili (on/off) anahtar. Proje genelinde harici bir switch bağımlılığı
 * olmadığından, erişilebilir bir `role="switch"` butonuyla sade bir kontrol sunar.
 */

import { cn } from "@/shared/lib/utils";

interface ToggleFieldProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function ToggleField({
  label,
  description,
  checked,
  onChange,
  disabled,
}: ToggleFieldProps) {
  return (
    <label
      className={cn(
        "flex items-center justify-between gap-4 rounded-md border border-border bg-surface-raised px-3.5 py-3",
        disabled ? "opacity-60" : "cursor-pointer",
      )}
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">
          {label}
        </span>
        {description ? (
          <span className="mt-0.5 block text-xs leading-relaxed text-fg-muted">
            {description}
          </span>
        ) : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-150 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40",
          checked ? "bg-primary" : "bg-border-strong",
        )}
      >
        <span
          className={cn(
            "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-150",
            checked ? "translate-x-[18px]" : "translate-x-0.5",
          )}
        />
      </button>
    </label>
  );
}
