/**
 * "İmza Ağacı" — dokümandaki tüm imzaları seçilebilir liste olarak gösterir.
 * Çoklu imzada soldaki listeden seçim, sağdaki detay panelini değiştirir.
 */

import { CircleCheck, CircleX } from "lucide-react";
import type { SignatureInfo } from "@/domain/verification/types";
import { cn } from "@/shared/lib/utils";
import { certDisplayName, signatureLevelLabel } from "../labels";

export function SignatureTree({
  signatures,
  selected,
  onSelect,
}: {
  signatures: SignatureInfo[];
  selected: number;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <p className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-wider text-fg-dim">
        İmza Ağacı · {signatures.length}
      </p>
      {signatures.map((sig, i) => {
        const active = i === selected;
        return (
          <button
            key={sig.signatureId ?? i}
            type="button"
            onClick={() => onSelect(i)}
            className={cn(
              "relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
              active
                ? "bg-primary/8 ring-1 ring-inset ring-primary/20"
                : "hover:bg-muted/60",
            )}
          >
            {active ? (
              <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary" />
            ) : null}
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                sig.valid
                  ? "bg-success/12 text-success"
                  : "bg-destructive/12 text-destructive",
              )}
            >
              {sig.valid ? (
                <CircleCheck className="h-4 w-4" />
              ) : (
                <CircleX className="h-4 w-4" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">
                {certDisplayName(sig.signerCertificate)}
              </span>
              <span className="block truncate text-xs text-fg-dim">
                {sig.signatureFormat ?? signatureLevelLabel(sig.signatureLevel)}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
