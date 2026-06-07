/**
 * İmza sayfası: PAdES (PDF) ve XAdES (XML) sekmeleri.
 */

import {
  KeyRound,
  ShieldCheck,
  FileText,
  FileCode2,
  CreditCard,
} from "lucide-react";
import { useService } from "@/application/services/hooks";
import { ScrollPage } from "@/presentation/components/common/ScrollPage";
import { PageHeader } from "@/presentation/components/common/PageHeader";
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

export function SignPage() {
  const { isRunning } = useService("agent");

  if (!isRunning) {
    return (
      <ScrollPage className="space-y-5">
        <PageHeader
          title="İmzala"
          description="Mali mühür / e-imza kartınızla PDF ve XML belgelerini imzalayın."
        />
        <ServiceOfflineNotice
          title="İmza ajanı çalışmıyor"
          description="İmza atabilmek için önce Genel Bakış'tan imza ajanını başlatın."
        />
      </ScrollPage>
    );
  }

  return (
    <ScrollPage className="space-y-5">
      <PageHeader
        title="İmzala"
        description="Mali mühür / e-imza kartınızla PDF ve XML belgelerini imzalayın."
      />
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <Card className="min-w-0 flex-1 lg:max-w-2xl">
          <CardContent className="pt-6">
            <Tabs defaultValue="pades">
              <TabsList className="mb-6">
                <TabsTrigger value="pades">
                  <FileText className="h-4 w-4" />
                  PDF (PAdES)
                </TabsTrigger>
                <TabsTrigger value="xades">
                  <FileCode2 className="h-4 w-4" />
                  XML (XAdES)
                </TabsTrigger>
              </TabsList>
              <TabsContent value="pades">
                <SignForm mode="pades" />
              </TabsContent>
              <TabsContent value="xades">
                <SignForm mode="xades" />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <aside className="lg:sticky lg:top-0 lg:w-[340px] lg:shrink-0">
          <SignGuide />
        </aside>
      </div>
    </ScrollPage>
  );
}
