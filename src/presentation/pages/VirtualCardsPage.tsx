/**
 * Sanal Kartlar sayfası: kart takılı olmasa bile PFX/PKCS#11 kaynaklarını
 * sanal kart olarak tanımlama, listeleme ve kaldırma. Agent çalışırken
 * tanımlar ajan üzerinde kalıcı olur ve imza ekranında kart gibi görünür.
 */

import { useState } from "react";
import { CreditCard, Plus, ShieldCheck } from "lucide-react";
import { useService } from "@/application/services/hooks";
import { useVirtualCards } from "@/application/virtualcards/hooks";
import type { VirtualCard } from "@/domain/virtualcards/types";
import { ScrollPage } from "@/presentation/components/common/ScrollPage";
import { PageHeader } from "@/presentation/components/common/PageHeader";
import { ServiceOfflineNotice } from "@/presentation/components/common/ServiceOfflineNotice";
import { EmptyState } from "@/presentation/components/common/EmptyState";
import { Button } from "@/presentation/components/ui/button";
import { Card, CardContent } from "@/presentation/components/ui/card";
import { Skeleton } from "@/presentation/components/ui/skeleton";
import { VirtualCardList } from "@/presentation/features/virtualcards/VirtualCardList";
import { VirtualCardDialog } from "@/presentation/features/virtualcards/VirtualCardDialog";

export function VirtualCardsPage() {
  const { isRunning } = useService("agent");
  const cards = useVirtualCards(isRunning);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editCard, setEditCard] = useState<VirtualCard | null>(null);

  const openCreate = () => {
    setEditCard(null);
    setDialogOpen(true);
  };

  const openEdit = (card: VirtualCard) => {
    setEditCard(card);
    setDialogOpen(true);
  };

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) setEditCard(null);
  };

  if (!isRunning) {
    return (
      <ScrollPage className="space-y-5">
        <PageHeader
          title="Sanal Kartlar"
          description="Fiziksel kart olmadan PFX ya da PKCS#11 ile imza için sanal kart tanımları."
        />
        <ServiceOfflineNotice
          title="İmza ajanı çalışmıyor"
          description="Sanal kart tanımlayabilmek için önce Genel Bakış'tan imza ajanını başlatın."
        />
      </ScrollPage>
    );
  }

  const list = cards.data ?? [];

  return (
    <ScrollPage className="space-y-5">
      <PageHeader
        title="Sanal Kartlar"
        description="Fiziksel kart olmadan PFX ya da PKCS#11 ile imza için sanal kart tanımları."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Sanal kart tanımla
          </Button>
        }
      />

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <Card className="min-w-0 flex-1 lg:max-w-2xl">
          <CardContent className="pt-6">
            {cards.isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : list.length === 0 ? (
              <EmptyState
                icon={CreditCard}
                title="Henüz sanal kart yok"
                description="Bir PFX dosyası veya PKCS#11 kütüphanesi ekleyerek kart takmadan imza atabilirsiniz."
                action={
                  <Button onClick={openCreate} variant="outline">
                    <Plus className="h-4 w-4" />
                    Sanal kart tanımla
                  </Button>
                }
              />
            ) : (
              <VirtualCardList cards={list} onEdit={openEdit} />
            )}
          </CardContent>
        </Card>

        <aside className="lg:sticky lg:top-0 lg:w-[340px] lg:shrink-0">
          <div className="flex items-start gap-3 rounded-lg border border-success/25 bg-success/5 p-4">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            <p className="text-xs leading-relaxed text-fg-muted">
              <span className="font-semibold text-fg">Kalıcı tanım.</span> Sanal
              kartlar ajan üzerinde saklanır; ajan açıkken İmzala ekranında normal
              kart gibi seçilebilir. PFX parolası yalnızca tanım anında ajana
              iletilir, burada saklanmaz.
            </p>
          </div>
        </aside>
      </div>

      <VirtualCardDialog
        open={dialogOpen}
        onOpenChange={handleDialogChange}
        editCard={editCard}
      />
    </ScrollPage>
  );
}
