import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronRight, Pencil, Upload, Inbox, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { DateInput } from "@/components/ui/date-input";
import { cn } from "@/lib/utils";
import { formatDateBR } from "@/lib/date";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ProjetoFormDialog } from "@/components/projeto-form-dialog";
import { UploadCotacaoModal } from "@/components/upload-cotacao-modal";

export const Route = createFileRoute("/_app/projetos/$id")({
  component: ProjetoDetalhePage,
});

type Projeto = {
  id: string;
  nome: string;
  codigo_projeto: string | null;
  empreendedor: string | null;
  empreendimento: string | null;
  cidade_uf: string | null;
  disciplina: string | null;
  formato_default: string | null;
  escopo_pa: string | null;
  referencia: string | null;
};


type Cotacao = {
  id: string;
  numero_pacote: number;
  numero_rodada: number;
  numero_revisao: number;
  data_rodada: string | null;
  status: string;
};

const pad3 = (n: number) => String(n).padStart(3, "0");
const pad2 = (n: number) => String(n).padStart(2, "0");

function ProjetoDetalhePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [projeto, setProjeto] = useState<Projeto | null>(null);
  const [cotacoes, setCotacoes] = useState<Cotacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [openEdit, setOpenEdit] = useState(false);
  const [openUpload, setOpenUpload] = useState(false);
  const [uploadPacote, setUploadPacote] = useState<number | undefined>(undefined);
  const [uploadRodada, setUploadRodada] = useState<number | undefined>(undefined);
  const [uploadRevisao, setUploadRevisao] = useState<number | undefined>(undefined);
  const [uploadDataRodada, setUploadDataRodada] = useState<Date | undefined>(undefined);
  const [uploadNovoPacote, setUploadNovoPacote] = useState(false);
  const [creatingPacote, setCreatingPacote] = useState(false);

  const [novaRodadaPacote, setNovaRodadaPacote] = useState<number | null>(null);
  const [novaRodadaData, setNovaRodadaData] = useState<Date | undefined>(new Date());
  const [activePacote, setActivePacote] = useState<string | null>(null);
  const [criandoRodada, setCriandoRodada] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    const { data: proj, error: projErr } = await supabase
      .from("projetos")
      .select(
        "id, nome, codigo_projeto, empreendedor, empreendimento, cidade_uf, disciplina, formato_default, escopo_pa, referencia",

      )
      .eq("id", id)
      .single();

    if (projErr) {
      toast.error("Erro ao carregar projeto", { description: projErr.message });
      setLoading(false);
      return;
    }
    setProjeto(proj as Projeto);

    const { data: cots, error: cotsErr } = await supabase
      .from("cotacoes")
      .select("id, numero_pacote, numero_rodada, numero_revisao, data_rodada, status")
      .eq("projeto_id", id)
      .order("numero_pacote", { ascending: true })
      .order("numero_rodada", { ascending: false })
      .order("numero_revisao", { ascending: false });

    if (cotsErr) {
      toast.error("Erro ao carregar cotações", { description: cotsErr.message });
    } else {
      const mapped: Cotacao[] = (cots ?? []).map((c: any) => ({
        id: c.id,
        numero_pacote: c.numero_pacote ?? 1,
        numero_rodada: c.numero_rodada ?? 0,
        numero_revisao: c.numero_revisao ?? 0,
        data_rodada: c.data_rodada,
        status: c.status,
      }));
      setCotacoes(mapped);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const pacotes = useMemo(() => {
    const set = new Set<number>();
    for (const c of cotacoes) set.add(c.numero_pacote);
    return Array.from(set).sort((a, b) => a - b);
  }, [cotacoes]);

  useEffect(() => {
    if (pacotes.length === 0) {
      setActivePacote(null);
      return;
    }
    if (!activePacote || !pacotes.includes(Number(activePacote))) {
      setActivePacote(String(pacotes[0]));
    }
  }, [pacotes, activePacote]);

  const proximoPacote = (pacotes[pacotes.length - 1] ?? 0) + 1;

  const createEmptyPacote = async (numeroPacote: number) => {
    if (!user?.id) {
      toast.error("Usuário não autenticado");
      return;
    }
    setCreatingPacote(true);
    // Mantém a regra: marca cotações do mesmo pacote como histórico antes do insert
    await supabase
      .from("cotacoes")
      .update({ status: "historico" })
      .eq("projeto_id", id)
      .eq("numero_pacote", numeroPacote)
      .eq("status", "ativa");

    const today = new Date().toISOString().slice(0, 10);
    const { error } = await supabase.from("cotacoes").insert({
      projeto_id: id,
      numero_pacote: numeroPacote,
      numero_rodada: 0,
      numero_revisao: 0,
      status: "ativa",
      data_rodada: today,
      criado_por: user.id,
      formato: projeto?.formato_default ?? "XXX000",
      template_xlsx_path: "",
    });
    setCreatingPacote(false);
    if (error) {
      toast.error("Erro ao criar pacote", { description: error.message });
      return;
    }
    toast.success(`Pacote COT${pad3(numeroPacote)} criado. Faça upload de uma POR para começar.`);
    setActivePacote(String(numeroPacote));
    await fetchAll();
  };

  const criarNovaRodada = async (numeroPacote: number) => {
    const doPacote = cotacoes.filter((c) => c.numero_pacote === numeroPacote);
    const origem =
      doPacote.find((c) => c.status === "ativa") ??
      [...doPacote].sort(
        (a, b) =>
          b.numero_rodada - a.numero_rodada || b.numero_revisao - a.numero_revisao,
      )[0];

    if (!origem) {
      toast.error("Nenhuma rodada ativa encontrada neste pacote");
      return;
    }

    setCriandoRodada(true);
    const { data: novaRodadaId, error } = await supabase.rpc("criar_nova_rodada", {
      p_cotacao_origem: origem.id,
    });
    setCriandoRodada(false);

    if (error) {
      toast.error("Erro ao criar nova rodada", { description: error.message });
      return;
    }

    toast.success("Nova rodada criada");
    await fetchAll();
    setActivePacote(String(numeroPacote));
    if (novaRodadaId) {
      navigate({
        to: "/projetos/$projetoId/cotacoes/$cotacaoId",
        params: { projetoId: id, cotacaoId: String(novaRodadaId) },
      });
    }
  };



  if (loading && !projeto) {
    return <div className="text-sm text-muted-foreground">Carregando projeto...</div>;
  }

  if (!projeto) {
    return (
      <div className="text-sm text-muted-foreground">Projeto não encontrado.</div>
    );
  }

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link to="/projetos" className="hover:text-foreground transition-colors">
          Projetos
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground font-medium">{projeto.nome}</span>
      </nav>

      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            {projeto.codigo_projeto ? (
              <span className="font-mono font-bold text-sm text-muted-foreground">
                {projeto.codigo_projeto}
              </span>
            ) : null}
            <h1 className="text-2xl font-semibold text-foreground">{projeto.nome}</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {projeto.empreendimento ?? "Sem empreendimento informado"}
          </p>
        </div>
        <Button variant="outline" onClick={() => setOpenEdit(true)}>
          <Pencil className="h-4 w-4 mr-2" />
          Editar dados do projeto
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informações do projeto</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <InfoItem label="Código do Projeto" value={projeto.codigo_projeto} />
            <InfoItem label="Empreendedor" value={projeto.empreendedor} />
            <InfoItem label="Cidade/UF" value={projeto.cidade_uf} />
            <InfoItem label="Disciplina" value={projeto.disciplina} />
          </dl>
        </CardContent>
      </Card>

      {pacotes.length === 0 ? (
        <Card className="p-12 flex flex-col items-center text-center space-y-3">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
            <Inbox className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-semibold">Nenhum pacote ainda</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Faça upload de uma planilha .xlsx para criar o primeiro pacote.
            </p>
          </div>
          <Button
            disabled={creatingPacote}
            onClick={() => createEmptyPacote(1)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Criar primeiro pacote
          </Button>

        </Card>
      ) : (
        <Tabs
          value={activePacote ?? String(pacotes[0])}
          onValueChange={setActivePacote}
          className="space-y-4"
        >
          <TabsList className="flex flex-wrap h-auto justify-start gap-1 bg-muted/40 p-1">
            {pacotes.map((p) => (
              <TabsTrigger key={p} value={String(p)} className="font-mono">
                COT{pad3(p)}
              </TabsTrigger>
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="ml-1 h-8"
              disabled={creatingPacote}
              onClick={() => createEmptyPacote(proximoPacote)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Novo Pacote
            </Button>
          </TabsList>

          {pacotes.map((p) => {
            const lista = cotacoes.filter((c) => c.numero_pacote === p);
            return (
              <TabsContent key={p} value={String(p)} className="space-y-3 mt-0">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">
                      Pacote COT{pad3(p)}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Histórico de rodadas e revisões deste pacote
                    </p>
                  </div>
                  <Button
                    disabled={criandoRodada}
                    onClick={() => criarNovaRodada(p)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Rodada
                  </Button>
                </div>

                <Card>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-24">Rodada</TableHead>
                        <TableHead className="w-24">Revisão</TableHead>
                        <TableHead className="w-32">Status</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lista.map((c) => {
                        const ativa = c.status === "ativa";
                        return (
                          <TableRow
                            key={c.id}
                            className={cn(
                              ativa &&
                                "bg-primary/5 hover:bg-primary/10 border-l-2 border-l-primary",
                              c.status === "historico" && "text-muted-foreground",
                            )}
                          >
                            <TableCell className="font-mono font-medium">
                              {c.numero_rodada + 1}
                            </TableCell>
                            <TableCell className="font-mono">
                              R{pad2(c.numero_revisao)}
                            </TableCell>
                            <TableCell>
                              <StatusBadge status={c.status} />
                            </TableCell>
                            <TableCell>
                              {c.data_rodada
                                ? formatDateBR(c.data_rodada)
                                : "—"}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  navigate({
                                    to: "/projetos/$projetoId/cotacoes/$cotacaoId",
                                    params: { projetoId: id, cotacaoId: c.id },
                                  })
                                }
                              >
                                Abrir
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </Card>
              </TabsContent>
            );
          })}
        </Tabs>
      )}

      <ProjetoFormDialog
        open={openEdit}
        onOpenChange={setOpenEdit}
        userId={user?.id ?? null}
        mode="edit"
        initial={projeto}
        onSaved={fetchAll}
      />

      <UploadCotacaoModal
        projetoId={id}
        numeroPacote={uploadPacote}
        numeroRodada={uploadRodada}
        numeroRevisao={uploadRevisao}
        dataRodadaInicial={uploadDataRodada}
        novoPacote={uploadNovoPacote}
        open={openUpload}
        onOpenChange={(v) => {
          setOpenUpload(v);
          if (!v) {
            setUploadPacote(undefined);
            setUploadRodada(undefined);
            setUploadRevisao(undefined);
            setUploadDataRodada(undefined);
            setUploadNovoPacote(false);
          }
        }}
        onSuccess={() => {
          if (uploadPacote != null) setActivePacote(String(uploadPacote));
          fetchAll();
        }}
      />



      <Dialog
        open={novaRodadaPacote != null}
        onOpenChange={(v) => {
          if (!v) setNovaRodadaPacote(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Nova Rodada</DialogTitle>
            <DialogDescription>
              Você está adicionando uma nova rodada de cotação a este pacote. No
              próximo passo, faça o upload da planilha .xlsx preenchida.
            </DialogDescription>
          </DialogHeader>

          {novaRodadaPacote != null && (() => {
            const maxRodada = cotacoes
              .filter((c) => c.numero_pacote === novaRodadaPacote)
              .reduce((acc, c) => Math.max(acc, c.numero_rodada), -1);
            const proxRodada = maxRodada + 1;
            return (
              <div className="space-y-4 py-2">
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Pacote
                    </Label>
                    <div>
                      <Badge variant="secondary" className="font-mono">
                        COT{pad3(novaRodadaPacote)}
                      </Badge>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Próxima rodada
                    </Label>
                    <div>
                      <Badge className="font-mono">Rodada {proxRodada + 1}</Badge>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Próxima revisão
                    </Label>
                    <div>
                      <Badge variant="outline" className="font-mono">
                        R00
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="data-nova-rodada">Data da rodada</Label>
                  <DateInput
                    id="data-nova-rodada"
                    value={novaRodadaData}
                    onChange={setNovaRodadaData}
                  />
                </div>
              </div>
            );
          })()}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setNovaRodadaPacote(null)}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (novaRodadaPacote == null) return;
                const maxRodada = cotacoes
                  .filter((c) => c.numero_pacote === novaRodadaPacote)
                  .reduce((acc, c) => Math.max(acc, c.numero_rodada), -1);
                const proxRodada = maxRodada + 1;
                setUploadPacote(novaRodadaPacote);
                setUploadRodada(proxRodada);
                setUploadRevisao(0);
                setUploadDataRodada(novaRodadaData);
                setNovaRodadaPacote(null);
                setOpenUpload(true);
              }}
            >
              <Upload className="h-4 w-4 mr-2" />
              Enviar proposta da Rodada
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
        {label}
      </dt>
      <dd className="font-medium text-foreground">{value ?? "—"}</dd>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "ativa") {
    return <Badge>Ativa</Badge>;
  }
  if (status === "historico") {
    return <Badge variant="secondary">Histórico</Badge>;
  }
  return <Badge variant="outline">{status}</Badge>;
}
