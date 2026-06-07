/**
 * Sanal kart tanımlama / düzenleme diyaloğu: PKCS#12 (PFX) veya PKCS#11
 * (HSM / sürücü) kaynağını "sanal kart" olarak kaydeder. Java masaüstündeki
 * "Sanal Kart Tanımla" diyaloğunun masaüstü app içindeki karşılığı.
 *
 * Düzenleme: Ajanda güncelleme ucu olmadığı için düzenleme, eski kaydı silip
 * yeniden tanımlama şeklinde yürür (bkz. useEditVirtualCard). PFX baytları/parolası
 * ajandan geri okunamadığı için PKCS#12 düzenlemesinde dosya + parola yeniden istenir.
 */

import { useEffect, useState } from "react";
import { PlusCircle, Save } from "lucide-react";
import { toast } from "sonner";
import type { VirtualCard } from "@/domain/virtualcards/types";
import {
  useEditVirtualCard,
  useRegisterPkcs11,
  useRegisterPkcs12,
} from "@/application/virtualcards/hooks";
import { errorMessage } from "@/shared/lib/errors";
import { basename } from "@/shared/lib/format";
import { Button } from "@/presentation/components/ui/button";
import { Input } from "@/presentation/components/ui/input";
import { Label } from "@/presentation/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/presentation/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/presentation/components/ui/tabs";
import { FileDropField } from "@/presentation/components/common/FileDropField";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Verilirse diyalog düzenleme modunda açılır. */
  editCard?: VirtualCard | null;
}

const PFX_FILTERS = [{ name: "PFX / PKCS#12", extensions: ["pfx", "p12"] }];
const LIB_FILTERS = [
  { name: "PKCS#11 kütüphanesi", extensions: ["so", "dll", "dylib"] },
];

type Tab = "pkcs12" | "pkcs11";

export function VirtualCardDialog({ open, onOpenChange, editCard }: Props) {
  const registerPkcs12 = useRegisterPkcs12();
  const registerPkcs11 = useRegisterPkcs11();
  const editCardMut = useEditVirtualCard();

  const isEdit = !!editCard;

  const [tab, setTab] = useState<Tab>("pkcs12");

  // PKCS#12
  const [p12Name, setP12Name] = useState("");
  const [pfxPath, setPfxPath] = useState<string | null>(null);
  const [password, setPassword] = useState("");

  // PKCS#11
  const [p11Name, setP11Name] = useState("");
  const [libraryPath, setLibraryPath] = useState<string | null>(null);

  // Diyalog açıldığında alanları (düzenleme moduna göre) hazırla.
  useEffect(() => {
    if (!open) return;
    setP12Name("");
    setPfxPath(null);
    setPassword("");
    setP11Name("");
    setLibraryPath(null);
    if (editCard) {
      if (editCard.type === "PKCS11") {
        setTab("pkcs11");
        setP11Name(editCard.name);
        setLibraryPath(editCard.source ?? null);
      } else {
        setTab("pkcs12");
        setP12Name(editCard.name);
      }
    } else {
      setTab("pkcs12");
    }
  }, [open, editCard]);

  const pending =
    registerPkcs12.isPending || registerPkcs11.isPending || editCardMut.isPending;

  const close = () => onOpenChange(false);

  const handlePkcs12 = async () => {
    if (!pfxPath) return;
    const name = p12Name.trim() || `PFX - ${basename(pfxPath)}`;
    const request = { name, filePath: pfxPath, password };
    try {
      if (isEdit && editCard) {
        await editCardMut.mutateAsync({
          previousName: editCard.name,
          kind: "pkcs12",
          request,
        });
        toast.success("Sanal kart güncellendi", { description: name });
      } else {
        await registerPkcs12.mutateAsync(request);
        toast.success("Sanal kart tanımlandı", { description: name });
      }
      close();
    } catch (e) {
      toast.error(isEdit ? "Güncelleme başarısız" : "Tanımlama başarısız", {
        description: errorMessage(e),
      });
    }
  };

  const handlePkcs11 = async () => {
    if (!libraryPath) return;
    const name = p11Name.trim() || `HSM - ${basename(libraryPath)}`;
    const request = { name, libraryPath };
    try {
      if (isEdit && editCard) {
        await editCardMut.mutateAsync({
          previousName: editCard.name,
          kind: "pkcs11",
          request,
        });
        toast.success("Sanal kart güncellendi", { description: name });
      } else {
        await registerPkcs11.mutateAsync(request);
        toast.success("Sanal kart tanımlandı", { description: name });
      }
      close();
    } catch (e) {
      toast.error(isEdit ? "Güncelleme başarısız" : "Tanımlama başarısız", {
        description: errorMessage(e),
      });
    }
  };

  const submitLabel = isEdit ? "Kaydet" : "Tanımla";
  const SubmitIcon = isEdit ? Save : PlusCircle;

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Sanal kartı düzenle" : "Sanal kart tanımla"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Tanımı güncellemek kaydı yeniden oluşturur. Güvenlik gereği PFX dosyası ve parolası ajandan geri okunamaz; PKCS#12 için bunları yeniden seçin."
              : "Fiziksel kart takılı olmasa bile bir PFX dosyası ya da PKCS#11 kütüphanesini sanal kart olarak ekleyin; imza ve sertifika listesinde normal kart gibi görünür."}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          {/* Düzenlemede kaynak tipi değiştirilemez; sekme çubuğu gizlenir. */}
          {isEdit ? null : (
            <TabsList className="mb-4 w-full">
              <TabsTrigger value="pkcs12" className="flex-1">
                PFX (PKCS#12)
              </TabsTrigger>
              <TabsTrigger value="pkcs11" className="flex-1">
                PKCS#11 (HSM)
              </TabsTrigger>
            </TabsList>
          )}

          <TabsContent value="pkcs12" className="space-y-4">
            <FileDropField
              label="PFX / PKCS#12 dosyası"
              hint=".pfx veya .p12"
              value={pfxPath}
              onChange={setPfxPath}
              filters={PFX_FILTERS}
            />

            <div className="space-y-1.5">
              <Label htmlFor="p12-password">PFX parolası</Label>
              <Input
                id="p12-password"
                type="password"
                autoComplete="off"
                placeholder="••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="p12-name">Kart adı (opsiyonel)</Label>
              <Input
                id="p12-name"
                autoComplete="off"
                placeholder={
                  pfxPath ? `PFX - ${basename(pfxPath)}` : "PFX - firma.pfx"
                }
                value={p12Name}
                onChange={(e) => setP12Name(e.target.value)}
              />
            </div>

            <Button
              onClick={handlePkcs12}
              disabled={!pfxPath || pending}
              className="w-full"
              size="lg"
            >
              <SubmitIcon className="h-4 w-4" />
              {pending ? "Kaydediliyor…" : submitLabel}
            </Button>
          </TabsContent>

          <TabsContent value="pkcs11" className="space-y-4">
            <FileDropField
              label="PKCS#11 kütüphanesi"
              hint=".so / .dll / .dylib"
              value={libraryPath}
              onChange={setLibraryPath}
              filters={LIB_FILTERS}
            />

            <div className="space-y-1.5">
              <Label htmlFor="p11-name">Kart adı (opsiyonel)</Label>
              <Input
                id="p11-name"
                autoComplete="off"
                placeholder={
                  libraryPath
                    ? `HSM - ${basename(libraryPath)}`
                    : "HSM - SoftHSM Slot 0"
                }
                value={p11Name}
                onChange={(e) => setP11Name(e.target.value)}
              />
            </div>

            <Button
              onClick={handlePkcs11}
              disabled={!libraryPath || pending}
              className="w-full"
              size="lg"
            >
              <SubmitIcon className="h-4 w-4" />
              {pending ? "Kaydediliyor…" : submitLabel}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
