/**
 * Belge kimlik şeridi — UBL kök seviyesindeki `cbc:ID` (Belge No) ve
 * `cbc:UUID` (ETTN) değerlerini doğrulama detaylarının başında, tek tıkla
 * kopyalanabilir biçimde gösterir. İkisi de yoksa hiçbir şey çizmez.
 */

import { useState } from "react";
import { Check, Copy, Fingerprint, Hash } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/shared/lib/utils";

function Field({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`${label} kopyalandı`);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Kopyalanamadı");
    }
  };

  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-muted text-fg-muted">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-fg-dim">
          {label}
        </p>
        <button
          type="button"
          onClick={handleCopy}
          title="Kopyala"
          className="group flex max-w-full items-center gap-1.5 font-mono text-[12.5px] font-medium text-foreground"
        >
          <span className="truncate">{value}</span>
          {copied ? (
            <Check className="h-3 w-3 shrink-0 text-success" />
          ) : (
            <Copy className="h-3 w-3 shrink-0 text-fg-dim opacity-0 transition-opacity group-hover:opacity-100" />
          )}
        </button>
      </div>
    </div>
  );
}

export function DocumentIdentity({
  documentId,
  uuid,
  className,
}: {
  documentId?: string | null;
  uuid?: string | null;
  className?: string;
}) {
  if (!documentId && !uuid) return null;

  return (
    <section
      className={cn(
        "flex flex-wrap items-center gap-x-8 gap-y-3 rounded-lg border border-border bg-surface-raised px-4 py-3",
        className,
      )}
    >
      {documentId ? (
        <Field
          icon={<Hash className="h-3.5 w-3.5" />}
          label="Belge No"
          value={documentId}
        />
      ) : null}
      {uuid ? (
        <Field
          icon={<Fingerprint className="h-3.5 w-3.5" />}
          label="ETTN"
          value={uuid}
        />
      ) : null}
    </section>
  );
}
