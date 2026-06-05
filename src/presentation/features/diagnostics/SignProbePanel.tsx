/**
 * PIN'siz dry-run imza probu paneli: kart seç, çalıştır, RSA/ECDSA sonucu gör.
 */

import { useState } from "react";
import { Stethoscope } from "lucide-react";
import { toast } from "sonner";
import type { ProbeBranch, SignProbeResult } from "@/domain/diagnostics/types";
import { useSmartcards } from "@/application/signing/hooks";
import { useSignProbe } from "@/application/diagnostics/hooks";
import { Button } from "@/presentation/components/ui/button";
import { Label } from "@/presentation/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/presentation/components/ui/select";
import { Badge } from "@/presentation/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/presentation/components/ui/card";
import { ValidityBanner } from "@/presentation/components/common/ValidityBanner";
import { SignatureDiagnosticsView } from "./SignatureDiagnosticsView";

function BranchCard({ title, branch }: { title: string; branch?: ProbeBranch }) {
  if (!branch) return null;
  const ok = branch.tokenSupports === true;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm">
          {title}
          <Badge
            variant="outline"
            className={
              ok
                ? "border-success/40 bg-success/15 text-success"
                : "border-destructive/40 bg-destructive/15 text-destructive"
            }
          >
            {ok ? "Destekleniyor" : "Desteklenmiyor"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {branch.errorCode ? (
          <p className="text-xs text-destructive">
            {branch.errorCode}
            {branch.errorMessage ? ` — ${branch.errorMessage}` : ""}
          </p>
        ) : null}
        {branch.diagnostics ? <SignatureDiagnosticsView diag={branch.diagnostics} /> : null}
      </CardContent>
    </Card>
  );
}

export function SignProbePanel() {
  const cards = useSmartcards(true);
  const probe = useSignProbe();
  const [terminalName, setTerminalName] = useState<string | null>(null);
  const result: SignProbeResult | undefined = probe.data;

  const handleProbe = () => {
    if (!terminalName) return;
    probe.mutate(
      { terminalName },
      { onError: (e) => toast.error("Prob başarısız", { description: (e as Error).message }) },
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex items-end gap-3">
        <div className="flex-1 space-y-1.5">
          <Label>Kart okuyucu</Label>
          <Select
            value={terminalName ?? undefined}
            onValueChange={setTerminalName}
            disabled={cards.isLoading}
          >
            <SelectTrigger>
              <SelectValue placeholder={cards.isLoading ? "Yükleniyor…" : "Kart seçin"} />
            </SelectTrigger>
            <SelectContent>
              {(cards.data ?? []).map((card) => (
                <SelectItem key={card.terminalName} value={card.terminalName}>
                  {card.terminalName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleProbe} disabled={!terminalName || probe.isPending}>
          <Stethoscope className="h-4 w-4" />
          {probe.isPending ? "Çalışıyor…" : "Probu çalıştır"}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Bu test PIN istemez ve kart sayacını harcamaz; kartın imzalayıp imzalayamayacağını
        önceden söyler.
      </p>

      {result ? (
        <div className="space-y-4">
          <ValidityBanner
            valid={result.outcome === "WOULD_SUCCEED"}
            status={
              result.outcome === "WOULD_SUCCEED"
                ? "Bu kart imzalayabilir"
                : (result.blockingReason ?? "Bu kart imzalayamaz")
            }
          />
          <div className="grid gap-4 md:grid-cols-2">
            <BranchCard title="RSA" branch={result.rsa} />
            <BranchCard title="ECDSA" branch={result.ecdsa} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
