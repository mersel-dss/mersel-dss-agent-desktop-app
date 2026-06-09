/**
 * Varsayılan imza tercihleri: imza ekranı açılışındaki öne çıkan format ve
 * XAdES için varsayılan imza türü.
 */

import { FileSignature } from "lucide-react";
import type { AppSettings } from "@/domain/settings/types";
import type { XadesContentType } from "@/domain/signing/types";
import { Label } from "@/presentation/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/presentation/components/ui/select";
import { IconMedallion } from "@/presentation/components/common/IconMedallion";

interface SigningDefaultsCardProps {
  settings: AppSettings;
  onChange: (next: AppSettings) => void;
}

export function SigningDefaultsCard({
  settings,
  onChange,
}: SigningDefaultsCardProps) {
  const { signing } = settings;

  const setSigning = (patch: Partial<AppSettings["signing"]>) =>
    onChange({ ...settings, signing: { ...signing, ...patch } });

  return (
    <section className="rounded-lg border border-border bg-surface-raised">
      <header className="flex items-center gap-3 border-b border-border/60 px-5 py-4">
        <IconMedallion size="md">
          <FileSignature className="h-4 w-4" />
        </IconMedallion>
        <div>
          <h2 className="text-sm font-semibold">Varsayılan imza tercihleri</h2>
          <p className="text-xs text-fg-muted">
            İmza ekranı bu ayarlarla önceden doldurulur
          </p>
        </div>
      </header>

      <div className="grid gap-4 p-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Varsayılan format</Label>
          <Select
            value={signing.defaultMode}
            onValueChange={(v) =>
              setSigning({ defaultMode: v as "pades" | "xades" })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pades">PDF (PAdES)</SelectItem>
              <SelectItem value="xades">XML (XAdES)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Varsayılan XAdES türü</Label>
          <Select
            value={signing.xadesContentType}
            onValueChange={(v) =>
              setSigning({ xadesContentType: v as XadesContentType })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="XADES_BES">XAdES-BES</SelectItem>
              <SelectItem value="COUNTER_SIGNATURE">
                Counter-Signature
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </section>
  );
}
