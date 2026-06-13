/**
 * İmza sayfası: PAdES (PDF) ve XAdES (XML) sekmeleri.
 */

import type { ReactNode } from "react";
import {
  KeyRound,
  ShieldCheck,
  FileText,
  FileCode2,
  CreditCard,
} from "lucide-react";
import { useService } from "@/application/services/hooks";
import { useSettingsValue } from "@/application/settings/hooks";
import { ServiceOfflineNotice } from "@/presentation/components/common/ServiceOfflineNotice";
import { SectionHeading } from "@/presentation/components/common/SectionHeading";
import { IconMedallion } from "@/presentation/components/common/IconMedallion";
import { Card, CardContent } from "@/presentation/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/presentation/components/ui/tabs";
import { SignForm } from "@/presentation/features/sign/SignForm";

function SignGuide() {
  const steps = [
    {
      icon: CreditCard,
      title: "Kart & sertifika",
      body: "Takılı mali mühür / e-imza kartını ve imzalamada kullanılacak sertifikayı seçin.",
    },
    {
      icon: FileText,
      title: "Belgeyi seçin",
      body: "İmzalanacak PDF veya XML dosyasını ekleyin; çıktı yolu imza anında sorulur.",
    },
    {
      icon: KeyRound,
      title: "PIN & imzala",
      body: "Kart PIN'i yalnızca imza anında kullanılır, hiçbir yerde saklanmaz.",
    },
  ];

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-border bg-surface-raised p-5">
        <SectionHeading>Nasıl çalışır?</SectionHeading>
        <ol className="mt-4 space-y-4">
          {steps.map((s, i) => (
            <li key={s.title} className="flex gap-3.5">
              <div className="flex flex-col items-center">
                <IconMedallion size="sm">
                  <s.icon className="h-4 w-4" />
                </IconMedallion>
                {i < steps.length - 1 ? (
                  <span className="mt-1 w-px flex-1 bg-border" />
                ) : null}
              </div>
              <div className="pb-1">
                <p className="text-sm font-semibold">{s.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-fg-muted">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-success/25 bg-success/5 p-4">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
        <p className="text-xs leading-relaxed text-fg-muted">
          <span className="font-semibold text-fg">Güvenli imza.</span> PIN ve özel anahtar
          kartı hiçbir zaman terk etmez; imza işlemi yereldeki ajan üzerinden gerçekleşir.
        </p>
      </div>
    </div>
  );
}

/** İmza çalışma alanı: solda form kartı, sağda rehber (her sekme için ortak). */
function SignWorkspace({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-6 px-4 pt-5 pb-1 lg:flex-row lg:items-start">
      <Card className="min-w-0 flex-1 lg:max-w-2xl">
        <CardContent className="pt-6">{children}</CardContent>
      </Card>
      <aside className="lg:sticky lg:top-0 lg:w-[340px] lg:shrink-0">
        <SignGuide />
      </aside>
    </div>
  );
}

export function SignPage() {
  const { isRunning } = useService("agent");
  const { signing } = useSettingsValue();

  if (!isRunning) {
    return (
      <div className="page-enter flex h-full items-center justify-center px-5 py-5">
        <ServiceOfflineNotice
          title="İmza ajanı çalışmıyor"
          description="İmza atabilmek için önce Genel Bakış'tan imza ajanını başlatın."
        />
      </div>
    );
  }

  return (
    <div className="page-enter h-full px-5 py-5">
      <Tabs
        key={`${signing.defaultMode}-${signing.xadesContentType}`}
        defaultValue={signing.defaultMode}
        className="flex h-full min-h-0 flex-col gap-0"
      >
        <div className="flex shrink-0 flex-col gap-3 border-b border-border/60 px-4 py-3">
          <div className="min-w-0">
            <h1 className="text-[15px] font-semibold leading-tight tracking-tight">
              İmzala
            </h1>
            <p className="truncate text-[11.5px] leading-tight text-fg-dim">
              Mali mühür / e-imza kartınızla PDF ve XML belgelerini imzalayın
            </p>
          </div>
          <TabsList className="h-8 w-fit">
            <TabsTrigger value="pades" className="gap-1.5 px-3 text-[12.5px]">
              <FileText className="h-3.5 w-3.5" />
              PDF (PAdES)
            </TabsTrigger>
            <TabsTrigger value="xades" className="gap-1.5 px-3 text-[12.5px]">
              <FileCode2 className="h-3.5 w-3.5" />
              XML (XAdES)
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="pades" className="min-h-0 flex-1 overflow-y-auto">
          <SignWorkspace>
            <SignForm mode="pades" />
          </SignWorkspace>
        </TabsContent>
        <TabsContent value="xades" className="min-h-0 flex-1 overflow-y-auto">
          <SignWorkspace>
            <SignForm mode="xades" defaultContentType={signing.xadesContentType} />
          </SignWorkspace>
        </TabsContent>
      </Tabs>
    </div>
  );
}
