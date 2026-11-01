import { useCallback, useEffect, useRef, useState } from "react";
import {
  FileSpreadsheet,
  UploadCloud,
  X,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { logEvent } from "@/lib/error-log";

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? "";
const FUNCTIONS_PREFIX = (import.meta.env.VITE_FUNCTIONS_PREFIX as string | undefined) ?? "";
const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

interface EmpresaOption {
  id: string;
  indice: number | null;
  letra_id: string | null;
  nome: string;
  numero_revisao: number | null;
  status: string | null;
  tem_proposta?: boolean;
}

interface UploadCotacaoModalProps {
  projetoId: string;
  numeroPacote?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  // legacy props kept for compat with call sites — currently unused
  numeroRodada?: number;
  numeroRevisao?: number;
  dataRodadaInicial?: Date;
  novoPacote?: boolean;
}

export function UploadCotacaoModal({
  projetoId,
  numeroPacote,
  open,
  onOpenChange,
  onSuccess,
}: UploadCotacaoModalProps) {
  const pacoteAtual = numeroPacote ?? 1;

  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Prévia: quando o back-end detecta itens que não casam com a estrutura,
  // avisamos antes de gravar (o usuário decide importar assim mesmo).
  const [aviso, setAviso] = useState<{
    layout: string;
    total: number;
    casaram: number;
    nao_casaram: number;
    formato_estrutura?: string | null;
    formato_incompativel?: boolean;
  } | null>(null);

  const [empresas, setEmpresas] = useState<EmpresaOption[]>([]);
  const [rodadaInfo, setRodadaInfo] = useState<{
    numero_rodada: number | null;
    data_rodada: string | null;
  } | null>(null);
  const [loadingEmpresas, setLoadingEmpresas] = useState(false);
  const [empresaModo, setEmpresaModo] = useState<"existente" | "nova">(
    "existente",
  );
  const [empresaId, setEmpresaId] = useState<string>("");
  const [empresaNomeNova, setEmpresaNomeNova] = useState<string>("");

  const carregarEmpresas = useCallback(async () => {
    setLoadingEmpresas(true);
    try {
      const { data: cot, error: e1 } = await supabase
        .from("cotacoes")
        .select("id, numero_rodada, data_rodada")
        .eq("projeto_id", projetoId)
        .eq("numero_pacote", pacoteAtual)
        .eq("status", "ativa")
        .limit(1)
        .maybeSingle();
      if (e1) throw e1;
      if (!cot?.id) {
        setEmpresas([]);
        setRodadaInfo(null);
        return;
      }
      setRodadaInfo({
        numero_rodada: cot.numero_rodada ?? null,
        data_rodada: cot.data_rodada ?? null,
      });
      const { data, error } = await supabase
        .from("empresas")
        .select("id, indice, letra_id, nome, numero_revisao, status")
        .eq("cotacao_id", cot.id)
        .order("indice", { ascending: true });
      if (error) throw error;
      const lista = (data ?? []) as EmpresaOption[];
      // Fonte de verdade da revisão = existência de proposta nesta cotação,
      // não o campo "status" (que pode ficar "entregue" com 0 propostas).
      const ids = lista.map((e) => e.id);
      let comProposta = new Set<string>();
      if (ids.length > 0) {
        const { data: props } = await supabase
          .from("item_propostas")
          .select("empresa_id")
          .in("empresa_id", ids);
        comProposta = new Set(
          (props ?? []).map((p: { empresa_id: string }) => p.empresa_id),
        );
      }
      setEmpresas(
        lista.map((e) => ({ ...e, tem_proposta: comProposta.has(e.id) })),
      );
    } catch (err) {
      toast.error("Erro ao carregar empresas", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoadingEmpresas(false);
    }
  }, [projetoId, pacoteAtual]);

  useEffect(() => {
    if (open) {
      setFile(null);
      setDragOver(false);
      setUploading(false);
      setProgress(0);
      setEmpresaModo("existente");
      setEmpresaId("");
      setEmpresaNomeNova("");
      setEmpresas([]);
      setRodadaInfo(null);
      setAviso(null);
      void carregarEmpresas();
    }
  }, [open, carregarEmpresas]);

  const handleOpenChange = (v: boolean) => {
    if (uploading) return;
    onOpenChange(v);
  };

  const acceptFile = useCallback((f: File) => {
    const isXlsx =
      f.name.toLowerCase().endsWith(".xlsx") || f.type === XLSX_MIME;
    if (!isXlsx) {
      toast.error("Arquivo inválido", {
        description: "Apenas planilhas .xlsx são aceitas.",
      });
      return;
    }
    setFile(f);
    setAviso(null);
  }, []);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) acceptFile(f);
    e.target.value = "";
  };

  const rodadaLabel = (() => {
    if (!rodadaInfo) return null;
    const n = rodadaInfo.numero_rodada;
    const num = n != null ? `Rodada ${String(n + 1).padStart(2, "0")}` : "Rodada";
    const data = rodadaInfo.data_rodada
      ? new Date(`${rodadaInfo.data_rodada}T00:00:00`).toLocaleDateString(
          "pt-BR",
        )
      : null;
    return data ? `${num} · ${data}` : num;
  })();

  const empresaSelecionada = empresas.find((e) => e.id === empresaId);
  const revisaoAtual = empresaSelecionada?.numero_revisao ?? 0;
  const proximaRevisao = revisaoAtual + 1;

  const nomeDuplicado =
    empresaModo === "nova" &&
    empresas.some(
      (e) =>
        (e.nome ?? "").trim().toLowerCase() ===
        empresaNomeNova.trim().toLowerCase(),
    );

  const podeEnviar =
    !!file &&
    !uploading &&
    (empresaModo === "existente"
      ? !!empresaId
      : empresaNomeNova.trim().length > 0 && !nomeDuplicado);

  const postUpload = async (preview: boolean) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("SESSAO");
    const fd = new FormData();
    fd.append("file", file as File);
    fd.append("projeto_id", projetoId);
    fd.append("numero_pacote", String(pacoteAtual));
    if (empresaModo === "existente") fd.append("empresa_id", empresaId);
    else fd.append("empresa_nome_nova", empresaNomeNova.trim());
    if (preview) fd.append("preview", "true");
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/${FUNCTIONS_PREFIX}upload-cotacao`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: fd,
      },
    );
    const result = await response
      .json()
      .catch(() => ({ erro: "Resposta inválida do servidor" }));
    return { response, result };
  };

  const reportErro = (result: any, status: number) => {
    const backendErro =
      typeof result?.erro === "string" ? result.erro : `HTTP ${status}`;
    let description = backendErro;
    if (
      backendErro.includes("Não foi possível identificar o tipo da planilha")
    ) {
      description +=
        "\n\nDica: envie o modelo Nexo preenchido (POR) ou o quantitativo do projeto — não a planilha de análise/erros.";
    }
    const sheets = result?.sheets_encontradas;
    if (Array.isArray(sheets) && sheets.length > 0) {
      description += `\n\nAbas encontradas na planilha: ${sheets.join(", ")}`;
    }
    toast.error("Falha ao importar", { description });
    logEvent(
      "Upload",
      `Falha ao importar "${file?.name ?? ""}": ${backendErro}`,
      Array.isArray(sheets)
        ? `Abas encontradas: ${sheets.join(", ")}`
        : undefined,
    );
  };

  const doCommit = async () => {
    setAviso(null);
    setUploading(true);
    setProgress(20);
    try {
      const interval = setInterval(() => {
        setProgress((p) => (p < 90 ? p + 5 : p));
      }, 400);
      const { response, result } = await postUpload(false);
      clearInterval(interval);
      setProgress(95);
      if (!response.ok) {
        reportErro(result, response.status);
        setUploading(false);
        setProgress(0);
        return;
      }
      setProgress(100);
      const nome =
        result.empresa_nome ??
        empresaSelecionada?.nome ??
        empresaNomeNova ??
        "empresa";
      const revisao = result.revisao ?? result.numero_revisao ?? 0;
      const itens = result.resumo?.itens_atualizados ?? 0;
      const naoEnc = result.resumo?.itens_nao_encontrados ?? 0;
      logEvent(
        "Info",
        `Importado "${file?.name ?? ""}" (${result.layout ?? "?"}): ${itens} itens, ${naoEnc} não casaram.`,
      );
      if (result.empresa_criada) {
        toast.success(`POR de ${nome} importada (R00). ${itens} itens.`);
      } else {
        toast.success(
          `POR de ${nome} importada (R${String(revisao).padStart(2, "0")}). ${itens} itens atualizados, ${naoEnc} extras como omissos.`,
        );
      }
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      if ((err as Error).message === "SESSAO") {
        toast.error("Sessão expirada. Faça login novamente.");
      } else {
        toast.error("Erro inesperado no upload", {
          description: err instanceof Error ? err.message : String(err),
        });
        logEvent(
          "Upload",
          `Erro inesperado ao importar "${file?.name ?? ""}"`,
          err instanceof Error ? (err.stack ?? err.message) : String(err),
        );
      }
      setUploading(false);
      setProgress(0);
    }
  };

  const handleSubmit = async () => {
    if (!file) return;
    setUploading(true);
    setProgress(15);
    try {
      const { response, result } = await postUpload(true); // prévia (não grava)
      setProgress(60);
      if (!response.ok) {
        reportErro(result, response.status);
        setUploading(false);
        setProgress(0);
        return;
      }
      const layout = result.layout ?? "?";
      const total = result.total_itens ?? 0;
      const casaram = result.casaram ?? 0;
      const nao = result.nao_casaram ?? 0;
      const primeira = !!result.primeira_por;
      const formatoEstrutura = (result.estrutura_formato ?? null) as
        | string
        | null;
      const formatoIncompat = !!result.formato_incompativel;
      logEvent(
        "Info",
        `Prévia "${file.name}": layout ${layout}, ${total} itens — casaram ${casaram}, não casaram ${nao}${primeira ? " (1ª proposta: define a estrutura)" : ""}${formatoIncompat ? ` — FORMATO INCOMPATÍVEL (estrutura: ${formatoEstrutura})` : ""}.`,
      );
      setUploading(false);
      setProgress(0);
      if (!primeira && (nao > 0 || formatoIncompat)) {
        setAviso({
          layout,
          total,
          casaram,
          nao_casaram: nao,
          formato_estrutura: formatoEstrutura,
          formato_incompativel: formatoIncompat,
        });
        return; // aguarda o usuário confirmar
      }
      await doCommit();
    } catch (err) {
      if ((err as Error).message === "SESSAO") {
        toast.error("Sessão expirada. Faça login novamente.");
      } else {
        toast.error("Erro inesperado no upload", {
          description: err instanceof Error ? err.message : String(err),
        });
        logEvent(
          "Upload",
          `Erro na prévia de "${file?.name ?? ""}"`,
          err instanceof Error ? (err.stack ?? err.message) : String(err),
        );
      }
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-xl"
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = "copy";
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = "copy";
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (file) return;
          const f = e.dataTransfer.files?.[0];
          if (f) acceptFile(f);
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <span>Enviar proposta</span>
            {rodadaLabel && (
              <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                {rodadaLabel}
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            {rodadaLabel
              ? `A proposta será registrada nesta rodada (${rodadaLabel}). Selecione a empresa proponente e arraste o arquivo POR (.xlsx).`
              : "Selecione a empresa proponente e arraste o arquivo POR (.xlsx)."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Linha 1 — Empresa proponente */}
          <Tabs
            value={empresaModo}
            onValueChange={(v) => setEmpresaModo(v as "existente" | "nova")}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="existente">Empresa existente</TabsTrigger>
              <TabsTrigger value="nova">Criar nova empresa</TabsTrigger>
            </TabsList>

            <TabsContent value="existente" className="space-y-2 mt-4">
              <Label>Empresa</Label>
              {loadingEmpresas ? (
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" /> Carregando…
                </p>
              ) : empresas.length === 0 ? (
                <p className="text-xs text-muted-foreground rounded-md border bg-muted/40 px-3 py-2">
                  Ainda não há empresas neste pacote. Use "Criar nova empresa"
                  abaixo.
                </p>
              ) : (
                <>
                  <Select value={empresaId} onValueChange={setEmpresaId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a empresa" />
                    </SelectTrigger>
                    <SelectContent>
                      {empresas.map((e) => {
                        const letra =
                          e.letra_id ??
                          (e.indice != null
                            ? String.fromCharCode(64 + e.indice)
                            : "?");
                        const entregou = !!e.tem_proposta;
                        const rev = String(e.numero_revisao ?? 0).padStart(
                          2,
                          "0",
                        );
                        return (
                          <SelectItem key={e.id} value={e.id}>
                            {letra} · {e.nome}{" "}
                            {entregou
                              ? `(revisão atual: R${rev})`
                              : "(sem proposta ainda)"}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>

                  {empresaSelecionada?.tem_proposta && (
                    <p className="text-xs rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 flex items-start gap-2">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
                      <span>
                        Esta empresa já enviou uma POR (R
                        {String(revisaoAtual).padStart(2, "0")}). Este upload
                        será registrado como revisão R
                        {String(proximaRevisao).padStart(2, "0")}.
                      </span>
                    </p>
                  )}
                </>
              )}
            </TabsContent>

            <TabsContent value="nova" className="space-y-2 mt-4">
              <Label htmlFor="nova-empresa">Nome da empresa</Label>
              <Input
                id="nova-empresa"
                placeholder="Ex: Construtora Alfa Ltda"
                value={empresaNomeNova}
                onChange={(e) => setEmpresaNomeNova(e.target.value)}
              />
              {nomeDuplicado && (
                <p className="text-xs rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 flex items-start gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
                  <span>
                    Já existe uma empresa com esse nome nesta cotação. Para
                    reenviar a proposta dela, use a aba "Empresa existente"
                    (será registrada como nova revisão).
                  </span>
                </p>
              )}
            </TabsContent>
          </Tabs>

          {/* Linha 2 — Arquivo POR */}
          <div className="space-y-2">
            <Label>Arquivo POR (.xlsx)</Label>
            {!file ? (
              <div
                role="button"
                tabIndex={0}
                onClick={() => inputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    inputRef.current?.click();
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                className={cn(
                  "flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors cursor-pointer",
                  dragOver
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50 hover:bg-muted/40",
                )}
              >
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <UploadCloud className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">
                    Arraste a planilha aqui ou clique para selecionar
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Somente arquivos .xlsx
                  </p>
                </div>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx"
                  className="hidden"
                  onChange={onPick}
                />
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
                <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                {!uploading && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setFile(null);
                      setAviso(null);
                    }}
                    aria-label="Remover arquivo"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </div>

          {uploading && (
            <div className="space-y-2">
              <Progress value={progress} />
              <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                {aviso ? "Importando..." : "Verificando planilha..."}
              </p>
            </div>
          )}

          {aviso && !uploading && (
            <div
              className={cn(
                "rounded-md border px-3 py-2.5 text-xs space-y-1",
                aviso.formato_incompativel
                  ? "border-red-500/60 bg-red-500/10"
                  : "border-amber-500/50 bg-amber-500/10",
              )}
            >
              {aviso.formato_incompativel ? (
                <>
                  <p className="flex items-start gap-2 font-medium text-red-700">
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    Formato incompatível com esta cotação.
                  </p>
                  <p className="text-muted-foreground">
                    Esta cotação foi montada no formato{" "}
                    <strong>
                      {aviso.formato_estrutura === "por"
                        ? "modelo Nexo (macros A/B/C)"
                        : "quantitativo (preço único)"}
                    </strong>
                    , mas o arquivo enviado é{" "}
                    <strong>
                      {aviso.layout === "quant"
                        ? "quantitativo (preço único)"
                        : "modelo Nexo"}
                    </strong>
                    . Enviar assim pode duplicar itens como omissos. O mais
                    provável é que seja o arquivo errado para esta cotação —
                    confira antes de continuar.
                  </p>
                </>
              ) : (
                <>
                  <p className="flex items-start gap-2 font-medium text-amber-700">
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    Atenção: {aviso.nao_casaram} de {aviso.total} itens não
                    casaram com a estrutura desta cotação.
                  </p>
                  <p className="text-muted-foreground">
                    Layout detectado:{" "}
                    {aviso.layout === "quant"
                      ? "quantitativo do projeto (preço único)"
                      : aviso.layout === "por"
                        ? "modelo Nexo"
                        : aviso.layout}
                    . Os itens que não casam entram como omissos. Confirme se
                    está enviando o arquivo certo para esta cotação antes de
                    continuar.
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => (aviso ? setAviso(null) : handleOpenChange(false))}
            disabled={uploading}
          >
            {aviso ? "Voltar" : "Cancelar"}
          </Button>
          {aviso ? (
            <Button
              variant="destructive"
              onClick={doCommit}
              disabled={uploading}
            >
              {uploading ? "Importando..." : "Importar assim mesmo"}
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={!podeEnviar}>
              {uploading ? "Verificando..." : "Enviar"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
