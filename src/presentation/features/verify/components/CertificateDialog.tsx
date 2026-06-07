/**
 * Sertifika detay penceresi — İmzager'daki "Sertifika" popup'ı gibi
 * Genel / Detaylar / Sertifika Zinciri sekmelerini içerir.
 */

import type { ReactNode } from "react";
import { ShieldCheck, ShieldX, ShieldAlert } from "lucide-react";
import type {
  CertificateInfo,
  ChainRevocationStatus,
} from "@/domain/verification/types";
import { formatDate } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/presentation/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/presentation/components/ui/tabs";
import { ScrollArea } from "@/presentation/components/ui/scroll-area";
import { Separator } from "@/presentation/components/ui/separator";
import { InfoGrid } from "@/presentation/components/common/InfoGrid";
import { ToneBadge } from "./ToneBadge";
import { CheckRow, boolToState } from "./CheckRow";
import {
  certDisplayName,
  chainRevocationStatus,
  revocationStatus,
} from "../labels";

/** DSS keyUsage token'ını Türkçeleştirir. */
const KEY_USAGE_TR: Record<string, string> = {
  DIGITAL_SIGNATURE: "Sayısal İmza Oluşturma",
  DIGITALSIGNATURE: "Sayısal İmza Oluşturma",
  NON_REPUDIATION: "İnkar Edilemezlik",
  NONREPUDIATION: "İnkar Edilemezlik",
  CONTENT_COMMITMENT: "İnkar Edilemezlik",
  KEY_ENCIPHERMENT: "Anahtar Şifreleme",
  KEYENCIPHERMENT: "Anahtar Şifreleme",
  DATA_ENCIPHERMENT: "Veri Şifreleme",
  KEY_AGREEMENT: "Anahtar Uzlaşması",
  KEY_CERT_SIGN: "Sertifika İmzalama",
  CRL_SIGN: "CRL İmzalama",
  ENCIPHER_ONLY: "Yalnızca Şifreleme",
  DECIPHER_ONLY: "Yalnızca Çözme",
};

function parseKeyUsages(keyUsage?: string): string[] {
  if (!keyUsage) return [];
  return keyUsage
    .replace(/[[\]]/g, "")
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((token) => {
      const key = token.toUpperCase().replace(/[\s-]/g, "_");
      return KEY_USAGE_TR[key] ?? token;
    });
}

/**
 * Tek sertifikanın tonu. `chainTrusted` true ise (zincir güvenilir bir köke
 * ulaşıyorsa), kökten aşağıdaki ara CA'lar ve imzacı da güvenilir kabul edilir;
 * yalnızca sertifikanın kendi geçerliliği (süre/iptal) sorunluysa uyarı verilir.
 */
function certTone(cert: CertificateInfo, chainTrusted = false) {
  if (cert.revoked) return "critical" as const;
  if (cert.expired || cert.valid === false) return "critical" as const;
  if (cert.trusted === false && !chainTrusted) return "warning" as const;
  return "success" as const;
}

function certStatusText(cert: CertificateInfo, chainTrusted = false): string {
  if (cert.revoked) return "İptal edilmiş";
  if (cert.expired) return "Süresi dolmuş";
  if (cert.valid === false) return "Geçersiz";
  if (cert.trusted === false && !chainTrusted) return "Güvenilmeyen kök";
  return "Geçerli";
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-xs font-semibold uppercase tracking-wider text-fg-dim">
        {children}
      </span>
      <span className="h-px flex-1 bg-border/60" />
    </div>
  );
}

function RevocationSection({ cert }: { cert: CertificateInfo }) {
  const rev = cert.revocation;
  if (!rev && cert.revoked === undefined) return null;
  const status = revocationStatus(rev?.status ?? (cert.revoked ? "REVOKED" : undefined));
  return (
    <div className="space-y-4">
      <SectionLabel>İptal (Revocation) Bilgisi</SectionLabel>
      <InfoGrid
        items={[
          {
            label: "Durum",
            value: <ToneBadge tone={status.tone}>{status.label}</ToneBadge>,
          },
          { label: "Kaynak", value: rev?.source ?? "—" },
          { label: "Menşe", value: rev?.origin ?? "—" },
          {
            label: "Responder",
            full: true,
            value: rev?.responderUrl ? (
              <span className="break-all font-mono text-xs">{rev.responderUrl}</span>
            ) : (
              "—"
            ),
          },
          { label: "Üretilme", value: formatDate(rev?.producedAt) },
          { label: "Sonraki güncelleme", value: formatDate(rev?.nextUpdate) },
          {
            label: "İptal nedeni",
            value: rev?.revocationReason ?? cert.revocationReason ?? "—",
          },
          {
            label: "İptal tarihi",
            value: formatDate(
              rev?.revocationDate ?? cert.revocationDate ?? cert.revocationTime,
            ),
          },
        ]}
      />
    </div>
  );
}

/**
 * Sertifika zincirini kök → imzacı (leaf) sırasına dizer. Order bilinmediği
 * için issuer/subject DN bağlarını takip ederek en iyi tahmini yapar; bağ
 * kurulamazsa verilen sırayı korur.
 */
function orderRootToLeaf(
  chain: CertificateInfo[],
  leafSerial?: string,
): CertificateInfo[] {
  if (chain.length <= 1) return chain;
  const bySubject = new Map<string, CertificateInfo>();
  for (const c of chain) if (c.subject) bySubject.set(c.subject, c);

  // Leaf: dialog'un sertifikasıyla eşleşen; yoksa kimsenin issuer'ı olmayan.
  const issuerDNs = new Set(chain.map((c) => c.issuerDN).filter(Boolean));
  let leaf =
    chain.find((c) => leafSerial && c.serialNumber === leafSerial) ??
    chain.find((c) => c.subject && !issuerDNs.has(c.subject));
  if (!leaf) return chain;

  const ordered: CertificateInfo[] = [];
  const seen = new Set<CertificateInfo>();
  let node: CertificateInfo | undefined = leaf;
  while (node && !seen.has(node)) {
    const cur: CertificateInfo = node;
    ordered.push(cur);
    seen.add(cur);
    const issuer: string | undefined = cur.issuerDN;
    node =
      issuer && issuer !== cur.subject ? bySubject.get(issuer) : undefined;
  }
  // Bağlanmayan sertifikalar kaldıysa sona ekle, sonra kök→leaf için ters çevir.
  for (const c of chain) if (!seen.has(c)) ordered.push(c);
  return ordered.reverse();
}

function ChainCert({
  cert,
  depth,
  isLeaf,
  chainTrusted,
}: {
  cert: CertificateInfo;
  depth: number;
  isLeaf: boolean;
  chainTrusted: boolean;
}) {
  const tone = certTone(cert, chainTrusted);
  const Icon =
    tone === "success" ? ShieldCheck : tone === "warning" ? ShieldAlert : ShieldX;
  return (
    <div
      className="flex items-start gap-2 py-1.5"
      style={{ paddingLeft: depth * 16 }}
    >
      <Icon
        className={cn(
          "mt-0.5 h-4 w-4 shrink-0",
          tone === "success"
            ? "text-success"
            : tone === "warning"
              ? "text-warning-foreground"
              : "text-destructive",
        )}
      />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">
          {certDisplayName(cert)}
          {isLeaf ? (
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
              (imzacı)
            </span>
          ) : null}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {certStatusText(cert, chainTrusted)} · {formatDate(cert.notAfter)}{" "}
          tarihine kadar geçerli
        </p>
      </div>
    </div>
  );
}

export function CertificateDialog({
  cert,
  chain,
  chainRevocation,
  title = "Sertifika",
  trigger,
}: {
  cert: CertificateInfo;
  chain?: CertificateInfo[];
  chainRevocation?: ChainRevocationStatus;
  title?: string;
  trigger: ReactNode;
}) {
  const usages = parseKeyUsages(cert.keyUsage);
  const orderedChain =
    chain && chain.length > 0
      ? orderRootToLeaf(chain, cert.serialNumber)
      : undefined;
  const leafSerial = cert.serialNumber;
  const chainStatus = chainRevocationStatus(chainRevocation);
  // Zincir güvenilir bir köke ulaşıyorsa (kök trusted), ara CA'lar ve imzacı da
  // güvenilir sayılır. Tek sertifika açıldığında kendi trusted bayrağı geçerli.
  const chainTrusted = orderedChain
    ? orderedChain.some((c) => c.trusted === true)
    : cert.trusted === true;

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="general">
          <TabsList>
            <TabsTrigger value="general">Genel</TabsTrigger>
            <TabsTrigger value="details">Detaylar</TabsTrigger>
            {orderedChain ? (
              <TabsTrigger value="chain">Sertifika Zinciri</TabsTrigger>
            ) : null}
          </TabsList>

          <ScrollArea className="max-h-[60vh] pr-3">
            <TabsContent value="general" className="space-y-6">
              <div className="flex items-start justify-between gap-3 rounded-xl bg-muted/40 p-4">
                <div className="min-w-0">
                  <p className="font-semibold leading-snug">{certDisplayName(cert)}</p>
                  <p className="mt-0.5 break-words text-xs text-muted-foreground">
                    {cert.issuerDN ?? "—"}
                  </p>
                </div>
                <ToneBadge tone={certTone(cert, chainTrusted)}>
                  {certStatusText(cert, chainTrusted)}
                </ToneBadge>
              </div>

              <div className="space-y-2.5">
                <SectionLabel>Sertifika Kullanım Alanları</SectionLabel>
                {usages.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {usages.map((u) => (
                      <span
                        key={u}
                        className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground"
                      >
                        {u}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Belirtilmemiş</p>
                )}
              </div>

              <div className="space-y-4">
                <SectionLabel>Kimlik</SectionLabel>
                <InfoGrid
                  items={[
                    { label: "Sertifika Sahibi", value: certDisplayName(cert) },
                    { label: "Yayıncı", value: cert.issuerDN ?? "—", full: true },
                    {
                      label: "Geçerlilik Başlangıcı",
                      value: formatDate(cert.notBefore),
                    },
                    { label: "Geçerlilik Sonu", value: formatDate(cert.notAfter) },
                  ]}
                />
              </div>

              <RevocationSection cert={cert} />
            </TabsContent>

            <TabsContent value="details">
              <InfoGrid
                items={[
                  { label: "Sertifika Sahibi (DN)", value: cert.subject ?? "—", full: true },
                  { label: "Yayıncı (DN)", value: cert.issuerDN ?? "—", full: true },
                  {
                    label: "Seri Numarası",
                    full: true,
                    value: (
                      <span className="break-all font-mono text-xs">
                        {cert.serialNumber ?? "—"}
                      </span>
                    ),
                  },
                  {
                    label: "Sahip Seri No (TCKN/VKN)",
                    value: cert.subjectSerialNumber ?? "—",
                  },
                  {
                    label: "Geçerlilik Başlangıcı",
                    value: formatDate(cert.notBefore),
                  },
                  { label: "Geçerlilik Sonu", value: formatDate(cert.notAfter) },
                  {
                    label: "İmzalama Algoritması",
                    value: cert.signatureAlgorithm ? (
                      <span className="font-mono text-xs">{cert.signatureAlgorithm}</span>
                    ) : (
                      "—"
                    ),
                  },
                  {
                    label: "Açık Anahtar",
                    value: cert.publicKeyAlgorithm
                      ? `${cert.publicKeyAlgorithm}${cert.publicKeySize ? ` (${cert.publicKeySize} bit)` : ""}`
                      : "—",
                  },
                  { label: "Anahtar Kullanımı", value: cert.keyUsage ?? "—", full: true },
                ]}
              />
            </TabsContent>

            {orderedChain ? (
              <TabsContent value="chain" className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">Doğrulama Sonucu</p>
                  <ToneBadge tone={chainStatus.tone}>{chainStatus.label}</ToneBadge>
                </div>
                <Separator />
                <div className="rounded-lg border p-2">
                  {orderedChain.map((c, i) => (
                    <ChainCert
                      key={c.serialNumber ?? i}
                      cert={c}
                      depth={i}
                      isLeaf={
                        leafSerial
                          ? c.serialNumber === leafSerial
                          : i === orderedChain.length - 1
                      }
                      chainTrusted={chainTrusted}
                    />
                  ))}
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Zincir Kontrolleri
                  </p>
                  <div className="divide-y rounded-lg border px-3">
                    <CheckRow
                      state={boolToState(
                        orderedChain.every((c) => c.expired !== true),
                      )}
                      label="Tüm sertifikalar geçerlilik tarihinde"
                    />
                    <CheckRow
                      state={boolToState(
                        orderedChain.every((c) => c.revoked !== true),
                      )}
                      label="Zincirde iptal edilmiş sertifika yok"
                    />
                    <CheckRow
                      state={boolToState(
                        orderedChain.some((c) => c.trusted === true),
                      )}
                      label="Güvenilir köke ulaşıldı"
                    />
                  </div>
                </div>
              </TabsContent>
            ) : null}
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
