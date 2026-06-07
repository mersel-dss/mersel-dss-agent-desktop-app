/**
 * Tanımlı sanal kartların listesi. Her kart için tip etiketi, kaynak ve
 * kaldırma aksiyonu gösterir.
 */

import { useState } from "react";
import { CreditCard, FileKey2, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { VirtualCard } from "@/domain/virtualcards/types";
import { useRemoveVirtualCard } from "@/application/virtualcards/hooks";
import { errorMessage } from "@/shared/lib/errors";
import { Badge } from "@/presentation/components/ui/badge";

interface Props {
  cards: VirtualCard[];
  onEdit: (card: VirtualCard) => void;
}

function cardTypeLabel(card: VirtualCard): string {
  if (card.cardType) return card.cardType;
  if (card.type === "PKCS11") return "PKCS#11";
  if (card.type === "PKCS12") return "PKCS#12 (PFX)";
  return "Sanal kart";
}

export function VirtualCardList({ cards, onEdit }: Props) {
  const removeCard = useRemoveVirtualCard();
  const [removing, setRemoving] = useState<string | null>(null);

  const handleRemove = async (name: string) => {
    setRemoving(name);
    try {
      await removeCard.mutateAsync(name);
      toast.success("Sanal kart kaldırıldı", { description: name });
    } catch (e) {
      toast.error("Kaldırılamadı", { description: errorMessage(e) });
    } finally {
      setRemoving(null);
    }
  };

  return (
    <ul className="divide-y divide-border rounded-lg border border-border bg-surface-raised">
      {cards.map((card) => {
        const isPkcs11 = card.type === "PKCS11";
        const Icon = isPkcs11 ? FileKey2 : CreditCard;
        const busy = removing === card.name;
        return (
          <li key={card.name} className="flex items-center gap-3.5 px-4 py-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-medium">{card.name}</p>
                <Badge variant="outline" className="shrink-0">
                  {cardTypeLabel(card)}
                </Badge>
              </div>
              {card.source ? (
                <p className="truncate text-xs text-fg-muted" title={card.source}>
                  {card.source}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => onEdit(card)}
                disabled={busy}
                aria-label="Sanal kartı düzenle"
                className="flex h-8 w-8 items-center justify-center rounded-md text-fg-dim transition-colors hover:bg-muted hover:text-foreground disabled:opacity-60"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => handleRemove(card.name)}
                disabled={busy}
                aria-label="Sanal kartı kaldır"
                className="flex h-8 w-8 items-center justify-center rounded-md text-fg-dim transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-60"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
