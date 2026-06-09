/**
 * Kayıtlı zaman damgası sağlayıcılarının yönetimi: ekle / düzenle / sil ve
 * varsayılan sağlayıcı seçimi.
 */

import { useState } from "react";
import { Clock, Pencil, Plus, Star, Trash2 } from "lucide-react";
import type { AppSettings, TimestampProvider } from "@/domain/settings/types";
import type { TsaProtocol } from "@/domain/timestamp/types";
import { Badge } from "@/presentation/components/ui/badge";
import { Button } from "@/presentation/components/ui/button";
import { IconMedallion } from "@/presentation/components/common/IconMedallion";
import { SectionHeading } from "@/presentation/components/common/SectionHeading";
import { cn } from "@/shared/lib/utils";
import { TimestampProviderDialog } from "./TimestampProviderDialog";

const PROTOCOL_BADGE: Record<TsaProtocol, string> = {
  tubitak: "TÜBİTAK ESYA",
  standard: "RFC 3161",
};

interface TimestampProvidersCardProps {
  settings: AppSettings;
  onChange: (next: AppSettings) => void;
  agentRunning: boolean;
}

export function TimestampProvidersCard({
  settings,
  onChange,
  agentRunning,
}: TimestampProvidersCardProps) {
  const { providers, defaultProviderId } = settings.timestamp;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TimestampProvider | null>(null);

  const openAdd = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (provider: TimestampProvider) => {
    setEditing(provider);
    setDialogOpen(true);
  };

  const upsert = (next: AppSettings["timestamp"]) =>
    onChange({ ...settings, timestamp: next });

  const handleSave = (provider: TimestampProvider) => {
    const exists = providers.some((p) => p.id === provider.id);
    const nextProviders = exists
      ? providers.map((p) => (p.id === provider.id ? provider : p))
      : [...providers, provider];
    // İlk sağlayıcı otomatik varsayılan olur.
    const nextDefault =
      defaultProviderId ?? (exists ? defaultProviderId : provider.id);
    upsert({ providers: nextProviders, defaultProviderId: nextDefault });
  };

  const handleDelete = (id: string) => {
    const nextProviders = providers.filter((p) => p.id !== id);
    const nextDefault =
      defaultProviderId === id
        ? (nextProviders[0]?.id ?? null)
        : defaultProviderId;
    upsert({ providers: nextProviders, defaultProviderId: nextDefault });
  };

  const setDefault = (id: string) =>
    upsert({ providers, defaultProviderId: id });

  return (
    <section className="rounded-lg border border-border bg-surface-raised">
      <header className="flex items-center justify-between gap-3 border-b border-border/60 px-5 py-4">
        <div className="flex items-center gap-3">
          <IconMedallion size="md">
            <Clock className="h-4 w-4" />
          </IconMedallion>
          <div>
            <h2 className="text-sm font-semibold">Zaman damgası sağlayıcıları</h2>
            <p className="text-xs text-fg-muted">
              TSA adresleri ve kimlik bilgileri (TÜBİTAK ESYA dahil)
            </p>
          </div>
        </div>
        <Button size="sm" onClick={openAdd}>
          <Plus className="h-4 w-4" />
          Sağlayıcı ekle
        </Button>
      </header>

      <div className="p-5">
        {providers.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border-strong bg-surface-muted/40 px-6 py-9 text-center">
            <Clock className="h-7 w-7 text-fg-dim" />
            <p className="text-sm font-medium">Henüz sağlayıcı eklenmedi</p>
            <p className="max-w-sm text-xs leading-relaxed text-fg-muted">
              Zaman damgası alabilmek için bir TSA (örn. TÜBİTAK KamuSM)
              sağlayıcısı ekleyin. Kimlik bilgileri yalnızca bu makinede saklanır.
            </p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {providers.map((provider) => {
              const isDefault = provider.id === defaultProviderId;
              return (
                <li
                  key={provider.id}
                  className={cn(
                    "flex items-center gap-3 rounded-md border bg-surface-muted/30 px-3.5 py-3 transition-colors",
                    isDefault ? "border-primary/40" : "border-border",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">
                        {provider.name}
                      </p>
                      <Badge variant="outline" className="shrink-0">
                        {PROTOCOL_BADGE[provider.protocol]}
                      </Badge>
                      {isDefault ? (
                        <Badge className="shrink-0 gap-1">
                          <Star className="h-3 w-3" />
                          Varsayılan
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-0.5 truncate font-mono text-xs text-fg-muted">
                      {provider.tsaUrl}
                      {provider.tsUserId ? ` · #${provider.tsUserId}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {!isDefault ? (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Varsayılan yap"
                        onClick={() => setDefault(provider.id)}
                      >
                        <Star className="h-4 w-4" />
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title="Düzenle"
                      onClick={() => openEdit(provider)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title="Sil"
                      onClick={() => handleDelete(provider.id)}
                      className="text-fg-muted hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {providers.length > 0 ? (
          <p className="mt-4">
            <SectionHeading className="inline">
              {providers.length} sağlayıcı kayıtlı
            </SectionHeading>
          </p>
        ) : null}
      </div>

      <TimestampProviderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
        onSave={handleSave}
        agentRunning={agentRunning}
      />
    </section>
  );
}
