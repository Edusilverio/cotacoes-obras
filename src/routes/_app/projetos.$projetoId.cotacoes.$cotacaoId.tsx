import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ChevronRight,
  ArrowLeft,
  Loader2,
  Download,
  Upload,
  AlertTriangle,
  Pencil,
} from "lucide-react";
import { UploadCotacaoModal } from "@/components/upload-cotacao-modal";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { DateInput } from "@/components/ui/date-input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { CharCount, LIMITS } from "@/components/char-count";
import { formatDateBR } from "@/lib/date";
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY, FUNCTIONS_PREFIX } from "@/integrations/supabase/client";

export const Route = createFileRoute(
  "/_app/projetos/$projetoId/cotacoes/$cotacaoId",
)({
  component: CotacaoDetalhePage,
});

type CotacaoDetalhe = {
  id: string;
  numero_rodada: number;
  numero_pacote: number;
  numero_revisao: number;
  status: string;
  formato: string | null;
  data_rodada: string | null;
  criada_em: string;
  projeto_id: string;
  projeto_nome: string;
  codigo_projeto: string | null;
};

type ProjetoForm = {
  nome: string;
  codigo_projeto: string;
  empreendedor: string;
  empreendimento: string;
  cidade_uf: string;
  disciplina: string;
  escopo_pa: string;
  referencia: string;
};

const EMPTY_FORM: ProjetoForm = {
  nome: "",
  codigo_projeto: "",
  empreendedor: "",
  empreendimento: "",
  cidade_uf: "",
  disciplina: "",
  escopo_pa: "",
  referencia: "",
};

const CODIGO_PROJETO_RE = /^[A-Za-z0-9-]*$/;
const isCodigoProjetoValid = (s: string) =>
  s.length <= 20 && CODIGO_PROJETO_RE.test(s);


type EmpresaStatus = "nao_entregue" | "entregue" | "declinou";

const STATUS_PROPONENTE: { value: EmpresaStatus; label: string }[] = [
  { value: "nao_entregue", label: "Não entregue" },
  { value: "entregue", label: "Entregue" },
  { value: "declinou", label: "Declinou" },
];

type EmpresaRow = {
  id: string | null;
  indice: number;
  letra_id: string;
  nome: string;
  contato: string;
  telefone: string;
  email: string;
  prazo_dias: string;
  prazo_unidade: "dias" | "meses";
  short_list: boolean;
  com_faturamento_direto: boolean;
  status: EmpresaStatus;
  bdi_percentual: number | null;
};

const LETRAS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];

const phoneDigits = (s: string) => (s || "").replace(/\D/g, "").slice(0, 11);
const formatPhoneBR = (s: string) => {
  const d = phoneDigits(s);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10)
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};
const isPhoneValid = (s: string) => {
  const d = phoneDigits(s);
  return d.length === 0 || d.length === 10 || d.length === 11;
};

const emptyEmpresa = (i: number): EmpresaRow => ({
  id: null,
  indice: i + 1,
  letra_id: LETRAS[i],
  nome: "",
  contato: "",
  telefone: "",
  email: "",
  prazo_dias: "",
  prazo_unidade: "dias",
  short_list: false,
  com_faturamento_direto: false,
  status: "nao_entregue",
  bdi_percentual: null,
});

const buildEmpresas = (rows: any[]): EmpresaRow[] => {
  const slots = Array.from({ length: 10 }, (_, i) => emptyEmpresa(i));
  for (const r of rows) {
    const idx = (r.indice ?? 0) - 1;
    if (idx >= 0 && idx < 10) {
      slots[idx] = {
        id: r.id,
        indice: r.indice,
        letra_id: r.letra_id ?? LETRAS[idx],
        nome: r.nome ?? "",
        contato: r.contato ?? "",
        telefone: formatPhoneBR(r.telefone ?? ""),
        email: r.email ?? "",
        prazo_unidade: r.prazo_unidade === "meses" ? "meses" : "dias",
        prazo_dias:
          r.prazo_dias == null
            ? ""
            : r.prazo_unidade === "meses"
              ? String(Math.round(Number(r.prazo_dias) / 30))
              : String(r.prazo_dias),
        short_list: !!r.short_list,
        com_faturamento_direto: !!r.com_faturamento_direto,
        status:
          r.status === "entregue" || r.status === "declinou"
            ? r.status
            : "nao_entregue",
        bdi_percentual:
          r.bdi_percentual != null ? Number(r.bdi_percentual) : null,
      };
    }
  }
  return slots;
};

function CotacaoDetalhePage() {
  const { projetoId, cotacaoId } = Route.useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<CotacaoDetalhe | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloadingCot, setDownloadingCot] = useState(false);
  const [openUpload, setOpenUpload] = useState(false);
  // Bump para atualizar os dados após um upload SEM recarregar a página inteira
  // (o window.location.reload() cheio era o gatilho do crash/loop de erro).
  const [reloadNonce, setReloadNonce] = useState(0);

  async function handleDownloadCot() {
    setDownloadingCot(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/${FUNCTIONS_PREFIX}download-cot`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session?.access_token ?? ""}`,
          "Content-Type": "application/json",
          "apikey": SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ cotacao_id: cotacaoId }),
      });
      if (!resp.ok) {
        let msg = "Erro ao gerar COT";
        try {
          const j = await resp.json();
          if (j?.erro) msg = j.erro;
        } catch {}
        toast.error(msg);
        return;
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "COT.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("COT gerada");
    } catch (e) {
      console.error(e);
      toast.error("Falha de rede ao baixar COT");
    } finally {
      setDownloadingCot(false);
    }
  }
  const [initialForm, setInitialForm] = useState<ProjetoForm>(EMPTY_FORM);
  const [form, setForm] = useState<ProjetoForm>(EMPTY_FORM);
  const [initialEmpresas, setInitialEmpresas] = useState<EmpresaRow[]>([]);
  const [empresas, setEmpresas] = useState<EmpresaRow[]>([]);
  const [shortListAtivo, setShortListAtivo] = useState(false);
  const [observacoes, setObservacoes] = useState("");
  const [initialCadastro, setInitialCadastro] = useState({
    short_list_ativo: false,
    observacoes: "",
  });
  const [dataRodada, setDataRodada] = useState<Date | undefined>(undefined);
  const [initialDataRodada, setInitialDataRodada] = useState<string | null>(null);
  
  const [questionamentos, setQuestionamentos] = useState<QuestionamentoRow[]>([]);
  const [respostas, setRespostas] = useState<Record<string, Record<string, string>>>({});
  const [initialRespostas, setInitialRespostas] = useState<Record<string, Record<string, string>>>({});
  const [questLoading, setQuestLoading] = useState(true);
  const [questErr, setQuestErr] = useState<string | null>(null);
  const [propostasDirty, setPropostasDirty] = useState(false);
  const propostasSaveRef = useRef<
    () => Promise<{ ok: boolean; count: number; empresaNome: string } | null>
  >(async () => null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [cotRes, empRes] = await Promise.all([
        supabase
          .from("cotacoes")
          .select(
            "id, numero_rodada, numero_pacote, numero_revisao, status, formato, data_rodada, criada_em, short_list_ativo, observacoes, projeto:projetos!inner(id, nome, codigo_projeto, empreendedor, empreendimento, cidade_uf, escopo_pa, referencia, disciplina)",
          )
          .eq("id", cotacaoId)
          .maybeSingle(),
        supabase
          .from("empresas")
          .select("*")
          .eq("cotacao_id", cotacaoId)
          .order("indice", { ascending: true }),
      ]);


      if (cancelled) return;

      if (cotRes.error || !cotRes.data) {
        toast.error("Cotação não encontrada");
        navigate({ to: "/projetos" });
        return;
      }

      const row: any = cotRes.data;
      const p: any = row.projeto;
      setData({
        id: row.id,
        numero_rodada: row.numero_rodada,
        numero_pacote: row.numero_pacote ?? 1,
        numero_revisao: row.numero_revisao ?? 0,
        status: row.status,
        formato: row.formato,
        data_rodada: row.data_rodada,
        criada_em: row.criada_em,
        projeto_id: p.id,
        projeto_nome: p.nome,
        codigo_projeto: p.codigo_projeto ?? null,
      });
      const initial: ProjetoForm = {
        nome: p.nome ?? "",
        codigo_projeto: p.codigo_projeto ?? "",
        empreendedor: p.empreendedor ?? "",
        empreendimento: p.empreendimento ?? "",
        cidade_uf: p.cidade_uf ?? "",
        disciplina: p.disciplina ?? "",
        escopo_pa: p.escopo_pa ?? "",
        referencia: p.referencia ?? "",
      };
      setInitialForm(initial);
      setForm(initial);

      const emps = buildEmpresas(empRes.data ?? []);
      setInitialEmpresas(emps);
      setEmpresas(emps.map((e) => ({ ...e })));

      const sl = row.short_list_ativo ?? false;
      const obs = row.observacoes ?? "";
      setShortListAtivo(sl);
      setObservacoes(obs);
      setInitialCadastro({ short_list_ativo: sl, observacoes: obs });

      setDataRodada(row.data_rodada ? new Date(row.data_rodada) : undefined);
      setInitialDataRodada(row.data_rodada ?? null);

      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [cotacaoId, navigate, reloadNonce]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setQuestLoading(true);
      setQuestErr(null);
      const { data: qs, error: qErr } = await supabase
        .from("questionamentos")
        .select("id, categoria, numero, pergunta, ordem")
        .eq("cotacao_id", cotacaoId)
        .order("ordem", { ascending: true });
      if (cancelled) return;
      if (qErr) {
        setQuestErr(qErr.message);
        setQuestLoading(false);
        return;
      }
      const list = (qs ?? []) as QuestionamentoRow[];
      setQuestionamentos(list);
      const map: Record<string, Record<string, string>> = {};
      if (list.length > 0) {
        const ids = list.map((q) => q.id);
        const { data: rs, error: rErr } = await supabase
          .from("questionamento_respostas")
          .select("questionamento_id, empresa_id, resposta")
          .in("questionamento_id", ids);
        if (cancelled) return;
        if (rErr) {
          setQuestErr(rErr.message);
          setQuestLoading(false);
          return;
        }
        for (const r of rs ?? []) {
          const qid = (r as { questionamento_id: string }).questionamento_id;
          const eid = (r as { empresa_id: string }).empresa_id;
          const resp = (r as { resposta: string | null }).resposta ?? "";
          if (!map[qid]) map[qid] = {};
          map[qid][eid] = resp;
        }
      }
      setRespostas(map);
      setInitialRespostas(map);
      setQuestLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [cotacaoId]);

  const projetoDirty = useMemo(
    () =>
      (Object.keys(form) as (keyof ProjetoForm)[]).some(
        (k) => form[k] !== initialForm[k],
      ),
    [form, initialForm],
  );

  const empresaIsEmpty = (e: EmpresaRow) =>
    !e.nome && !e.contato && !e.telefone && !e.email && !e.prazo_dias &&
    !e.short_list && !e.com_faturamento_direto;

  const empresaEquals = (a: EmpresaRow, b: EmpresaRow) =>
    a.nome === b.nome &&
    a.contato === b.contato &&
    a.telefone === b.telefone &&
    a.email === b.email &&
    a.prazo_dias === b.prazo_dias &&
    a.prazo_unidade === b.prazo_unidade &&
    a.short_list === b.short_list &&
    a.com_faturamento_direto === b.com_faturamento_direto &&
    a.status === b.status;

  const empresasDirty = useMemo(
    () => empresas.some((e, i) => !empresaEquals(e, initialEmpresas[i])),
    [empresas, initialEmpresas],
  );

  const dataRodadaIso = dataRodada
    ? format(dataRodada, "yyyy-MM-dd")
    : null;
  const cadastroDirty =
    shortListAtivo !== initialCadastro.short_list_ativo ||
    observacoes !== initialCadastro.observacoes ||
    dataRodadaIso !== initialDataRodada;

  const modifiedRespostas = useMemo(() => {
    const upserts: { questionamento_id: string; empresa_id: string; resposta: string }[] = [];
    const deletes: { questionamento_id: string; empresa_id: string }[] = [];
    for (const q of questionamentos) {
      for (const e of empresas) {
        if (!e.id) continue;
        const curr = respostas[q.id]?.[e.id] ?? "";
        const init = initialRespostas[q.id]?.[e.id] ?? "";
        if (curr === init) continue;
        if (curr === "" && init !== "") {
          deletes.push({ questionamento_id: q.id, empresa_id: e.id });
        } else {
          upserts.push({ questionamento_id: q.id, empresa_id: e.id, resposta: curr });
        }
      }
    }
    return { upserts, deletes };
  }, [questionamentos, empresas, respostas, initialRespostas]);

  const questionamentosDirty =
    modifiedRespostas.upserts.length > 0 || modifiedRespostas.deletes.length > 0;

  const dirty = projetoDirty || empresasDirty || cadastroDirty || questionamentosDirty || propostasDirty;

  const handleChange = (k: keyof ProjetoForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const updateEmpresa = (idx: number, patch: Partial<EmpresaRow>) =>
    setEmpresas((arr) =>
      arr.map((e, i) => (i === idx ? { ...e, ...patch } : e)),
    );

  const handleSave = async () => {
    if (!data || !dirty || saving) return;
    if (empresas.some((e) => !isPhoneValid(e.telefone))) {
      toast.error("Telefone inválido. Use 10 ou 11 dígitos.");
      return;
    }
    if (form.codigo_projeto.trim() && !isCodigoProjetoValid(form.codigo_projeto.trim())) {
      toast.error("Código do Projeto inválido", {
        description: "Máx. 20 caracteres alfanuméricos ou hífens.",
      });
      return;
    }
    setSaving(true);

    let projetoOk = true;
    if (projetoDirty) {
      const { error } = await supabase
        .from("projetos")
        .update({
          nome: form.nome,
          codigo_projeto: form.codigo_projeto.trim() || null,
          empreendedor: form.empreendedor || null,
          empreendimento: form.empreendimento || null,
          cidade_uf: form.cidade_uf || null,
          disciplina: form.disciplina || null,
          escopo_pa: form.escopo_pa || null,
          referencia: form.referencia || null,
        })
        .eq("id", data.projeto_id);
      if (error) {
        projetoOk = false;
        if ((error as { code?: string }).code === "23505") {
          toast.error("Já existe outro projeto com esse código nesta organização.");
        } else {
          toast.error("Erro ao salvar projeto: " + error.message);
        }
      }
    }


    let empresasCount = 0;
    let empresasErr: string | null = null;
    if (empresasDirty) {
      for (let i = 0; i < empresas.length; i++) {
        const e = empresas[i];
        const init = initialEmpresas[i];
        if (empresaEquals(e, init)) continue;

        const payload = {
          cotacao_id: cotacaoId,
          indice: e.indice,
          letra_id: e.letra_id,
          nome: e.nome || null,
          contato: e.contato || null,
          telefone: phoneDigits(e.telefone) || null,
          email: e.email || null,
          prazo_dias:
            e.prazo_dias === ""
              ? null
              : e.prazo_unidade === "meses"
                ? Number(e.prazo_dias) * 30
                : Number(e.prazo_dias),
          prazo_unidade: e.prazo_unidade,
          short_list: e.short_list,
          com_faturamento_direto: e.com_faturamento_direto,
          status: e.status,
        };

        if (e.id) {
          const { error } = await supabase
            .from("empresas")
            .update(payload)
            .eq("id", e.id);
          if (error) {
            empresasErr = error.message;
            break;
          }
          empresasCount++;
        } else {
          if (empresaIsEmpty(e)) continue;
          const { data: inserted, error } = await supabase
            .from("empresas")
            .insert(payload)
            .select("id")
            .single();
          if (error) {
            empresasErr = error.message;
            break;
          }
          updateEmpresa(i, { id: (inserted as any).id });
          empresasCount++;
        }
      }
    }

    let cadastroOk = true;
    const cadastroChanged =
      shortListAtivo !== initialCadastro.short_list_ativo ||
      observacoes !== initialCadastro.observacoes;
    if (cadastroChanged) {
      const { error } = await supabase
        .from("cotacoes")
        .update({
          short_list_ativo: shortListAtivo,
          observacoes: observacoes.trim() ? observacoes : null,
        } as any)
        .eq("id", cotacaoId);
      if (error) {
        cadastroOk = false;
        toast.error("Erro ao salvar configurações: " + error.message);
      }
    }


    let dataRodadaOk = true;
    const dataRodadaChanged = dataRodadaIso !== initialDataRodada;
    if (dataRodadaChanged) {
      const { error } = await supabase
        .from("cotacoes")
        .update({ data_rodada: dataRodadaIso })
        .eq("id", data.id);
      if (error) {
        dataRodadaOk = false;
        toast.error("Erro ao salvar data da rodada: " + error.message);
      }
    }

    let respostasOk = true;
    let respostasCount = 0;
    if (questionamentosDirty) {
      const { upserts, deletes } = modifiedRespostas;
      if (upserts.length > 0) {
        const { error } = await supabase
          .from("questionamento_respostas")
          .upsert(upserts, { onConflict: "questionamento_id,empresa_id" });
        if (error) {
          respostasOk = false;
          toast.error("Erro ao salvar respostas: " + error.message);
        } else {
          respostasCount += upserts.length;
        }
      }
      if (respostasOk && deletes.length > 0) {
        for (const d of deletes) {
          const { error } = await supabase
            .from("questionamento_respostas")
            .delete()
            .eq("questionamento_id", d.questionamento_id)
            .eq("empresa_id", d.empresa_id);
          if (error) {
            respostasOk = false;
            toast.error("Erro ao salvar respostas: " + error.message);
            break;
          }
          respostasCount++;
        }
      }
    }

    let propostasOk = true;
    let propostasCount = 0;
    let propostasEmpresaNome = "";
    if (propostasDirty) {
      const res = await propostasSaveRef.current();
      if (!res || !res.ok) {
        propostasOk = false;
      } else {
        propostasCount = res.count;
        propostasEmpresaNome = res.empresaNome;
      }
    }

    setSaving(false);

    if (empresasErr) {
      toast.error("Erro ao salvar empresas: " + empresasErr);
      return;
    }

    if (projetoOk && projetoDirty) {
      setInitialForm(form);
      setData((d) => (d ? { ...d, projeto_nome: form.nome } : d));
    }

    if (cadastroOk && cadastroChanged) {
      setInitialCadastro({ short_list_ativo: shortListAtivo, observacoes });
    }

    if (dataRodadaOk && dataRodadaChanged) {
      setInitialDataRodada(dataRodadaIso);
      setData((d) => (d ? { ...d, data_rodada: dataRodadaIso } : d));
    }

    if (empresasCount > 0) {
      // refetch to lock in canonical state (and pick up new ids)
      const { data: empData } = await supabase
        .from("empresas")
        .select("*")
        .eq("cotacao_id", cotacaoId)
        .order("indice", { ascending: true });
      const emps = buildEmpresas(empData ?? []);
      setInitialEmpresas(emps);
      setEmpresas(emps.map((e) => ({ ...e })));
    }

    if (respostasOk && respostasCount > 0) {
      setInitialRespostas(
        JSON.parse(JSON.stringify(respostas)) as Record<string, Record<string, string>>,
      );
    }

    const anyOk =
      (projetoOk && projetoDirty) ||
      empresasCount > 0 ||
      (cadastroOk && cadastroChanged) ||
      (dataRodadaOk && dataRodadaChanged) ||
      (respostasOk && respostasCount > 0) ||
      (propostasOk && propostasCount > 0);
    const allOk =
      projetoOk && cadastroOk && dataRodadaOk && respostasOk && propostasOk && !empresasErr;

    if (propostasOk && propostasCount > 0) {
      toast.success(
        `Proposta da empresa ${propostasEmpresaNome} salva: ${propostasCount} itens atualizados`,
      );
    }

    if (allOk && anyOk) {
      const onlyPropostas =
        propostasCount > 0 &&
        respostasCount === 0 &&
        !projetoDirty &&
        empresasCount === 0 &&
        !cadastroChanged &&
        !dataRodadaChanged;
      const onlyRespostas =
        respostasCount > 0 &&
        propostasCount === 0 &&
        !projetoDirty &&
        empresasCount === 0 &&
        !cadastroChanged &&
        !dataRodadaChanged;
      if (onlyPropostas) {
        // toast already shown above
      } else if (onlyRespostas) {
        toast.success(`${respostasCount} resposta(s) atualizada(s)`);
      } else {
        toast.success("Todas as alterações foram salvas");
      }
    }
  };

  const saveRef = useRef(handleSave);
  const dirtyRef = useRef(dirty);
  const savingRef = useRef(saving);
  saveRef.current = handleSave;
  dirtyRef.current = dirty;
  savingRef.current = saving;

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (dirtyRef.current && !savingRef.current) {
          void saveRef.current();
        }
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  if (loading || !data) {
    return (
      <div className="text-sm text-muted-foreground">Carregando cotação...</div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              navigate({ to: "/projetos/$id", params: { id: projetoId } })
            }
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Voltar
          </Button>
          <nav className="flex items-center gap-1 text-sm text-muted-foreground min-w-0">
            <Link to="/projetos" className="hover:text-foreground transition-colors">
              Projetos
            </Link>
            <ChevronRight className="h-4 w-4 shrink-0" />
            <Link
              to="/projetos/$id"
              params={{ id: projetoId }}
              className="hover:text-foreground transition-colors truncate"
            >
              {data.codigo_projeto ? `${data.codigo_projeto} - ${data.projeto_nome}` : data.projeto_nome}
            </Link>
            <ChevronRight className="h-4 w-4 shrink-0" />
            <span className="text-foreground font-medium">
              {(() => {
                const pac = `COT${String(data.numero_pacote).padStart(3, "0")}`;
                const rev = `R${String(data.numero_revisao).padStart(2, "0")}`;
                const base = `${pac} ${rev}`;
                return data.codigo_projeto ? `${data.codigo_projeto}-${base}` : base;
              })()}
            </span>
          </nav>
        </div>
        {data.status === "ativa" && (
          <Button variant="outline" onClick={() => setOpenUpload(true)}>
            <Upload className="h-4 w-4 mr-1" />
            Upload proposta da Rodada
          </Button>
        )}
        <Button variant="outline" disabled={downloadingCot} onClick={handleDownloadCot}>
          {downloadingCot ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-1" />
          )}
          Baixar COT
        </Button>
        <Button disabled={!dirty || saving} onClick={handleSave}>
          {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
          Salvar alterações
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold text-foreground">
          {(() => {
            const pac = `COT${String(data.numero_pacote).padStart(3, "0")}`;
            const rev = `R${String(data.numero_revisao).padStart(2, "0")}`;
            const base = `${pac} ${rev}`;
            return data.codigo_projeto ? `${data.codigo_projeto}-${base}` : base;
          })()}
        </h1>
        <StatusBadge status={data.status} />
      </div>
      <div className="text-sm text-muted-foreground -mt-4">
        Rodada {data.numero_rodada + 1} · {data.status}
        {data.data_rodada
          ? ` · ${formatDateBR(data.data_rodada)}`
          : ""}
      </div>


      <Tabs defaultValue="cadastro">
        <TabsList>
          <TabsTrigger value="cadastro">Cadastro</TabsTrigger>
          <TabsTrigger value="propostas">Propostas Originais</TabsTrigger>
          <TabsTrigger value="questionamentos">Questionamentos</TabsTrigger>
        </TabsList>

        <TabsContent value="cadastro" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Dados do Projeto</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Nome" className="md:col-span-2">
                  <Input value={form.nome} onChange={handleChange("nome")} maxLength={LIMITS.nome} />
                  <CharCount value={form.nome} limit={LIMITS.nome} />
                </Field>
                <Field label="Código do Projeto" className="md:col-span-2">
                  <Input
                    value={form.codigo_projeto}
                    onChange={handleChange("codigo_projeto")}
                    placeholder="Ex: MOD022"
                    className={
                      !form.codigo_projeto.trim() ||
                      isCodigoProjetoValid(form.codigo_projeto.trim())
                        ? undefined
                        : "border-destructive focus-visible:ring-destructive"
                    }
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Identificador curto livre, ex: MOD022, MOD006, MOD2025
                  </p>
                  {form.codigo_projeto.trim() &&
                  !isCodigoProjetoValid(form.codigo_projeto.trim()) ? (
                    <p className="text-xs text-destructive mt-1">
                      Máx. 20 caracteres alfanuméricos ou hífens.
                    </p>
                  ) : null}
                </Field>
                <Field label="Empreendedor">
                  <Input value={form.empreendedor} onChange={handleChange("empreendedor")} />
                </Field>
                <Field label="Empreendimento">
                  <Input value={form.empreendimento} onChange={handleChange("empreendimento")} />
                </Field>
                <Field label="Cidade/UF">
                  <Input value={form.cidade_uf} onChange={handleChange("cidade_uf")} maxLength={LIMITS.cidadeUf} />
                  <CharCount value={form.cidade_uf} limit={LIMITS.cidadeUf} />
                </Field>
                <Field label="Disciplina">
                  <Input value={form.disciplina} onChange={handleChange("disciplina")} />
                </Field>
                <Field label="Escopo do PA" className="md:col-span-2">
                  <Textarea
                    rows={4}
                    value={form.escopo_pa}
                    onChange={handleChange("escopo_pa")}
                    maxLength={LIMITS.escopoPa}
                    placeholder="Descreva o escopo do projeto..."
                  />
                  <CharCount value={form.escopo_pa} limit={LIMITS.escopoPa} />
                </Field>
                <Field label="Referência" className="md:col-span-2">
                  <Input value={form.referencia} onChange={handleChange("referencia")} />
                </Field>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Empresas Proponentes</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead className="w-12">Letra</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="w-40">Prazo</TableHead>
                    <TableHead className="w-24 text-center">Short List</TableHead>
                    <TableHead className="w-24 text-center">Fat. Direto</TableHead>
                    <TableHead className="w-40">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {empresas.map((e, idx) => (
                    <TableRow key={e.indice}>
                      <TableCell className="text-muted-foreground">{e.indice}</TableCell>
                      <TableCell className="font-medium">{e.letra_id}</TableCell>
                      <TableCell>
                        <Input
                          value={e.nome}
                          maxLength={LIMITS.nome}
                          onChange={(ev) => updateEmpresa(idx, { nome: ev.target.value })}
                        />
                        <CharCount value={e.nome} limit={LIMITS.nome} />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={e.contato}
                          maxLength={LIMITS.contato}
                          onChange={(ev) => updateEmpresa(idx, { contato: ev.target.value })}
                        />
                        <CharCount value={e.contato} limit={LIMITS.contato} />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={e.telefone}
                          placeholder="(99) 99999-9999"
                          inputMode="tel"
                          onChange={(ev) =>
                            updateEmpresa(idx, {
                              telefone: formatPhoneBR(ev.target.value),
                            })
                          }
                          className={
                            isPhoneValid(e.telefone)
                              ? undefined
                              : "border-destructive focus-visible:ring-destructive"
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="email"
                          value={e.email}
                          maxLength={LIMITS.email}
                          onChange={(ev) => updateEmpresa(idx, { email: ev.target.value })}
                        />
                        <CharCount value={e.email} limit={LIMITS.email} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            min={0}
                            className="w-[60px]"
                            value={e.prazo_dias}
                            onChange={(ev) =>
                              updateEmpresa(idx, { prazo_dias: ev.target.value })
                            }
                          />
                          <Select
                            value={e.prazo_unidade}
                            onValueChange={(v) =>
                              updateEmpresa(idx, {
                                prazo_unidade: v as "dias" | "meses",
                              })
                            }
                          >
                            <SelectTrigger className="w-[88px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="dias">dias</SelectItem>
                              <SelectItem value="meses">meses</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={e.short_list}
                          onCheckedChange={(v) =>
                            updateEmpresa(idx, { short_list: v })
                          }
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={e.com_faturamento_direto}
                          onCheckedChange={(v) =>
                            updateEmpresa(idx, { com_faturamento_direto: v })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={e.status}
                          onValueChange={(v) =>
                            updateEmpresa(idx, { status: v as EmpresaStatus })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_PROPONENTE.map((s) => (
                              <SelectItem key={s.value} value={s.value}>
                                {s.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Configurações da Cotação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Rodada">
                  <div className="h-9 flex items-center">
                    <Badge variant="outline">{data.numero_rodada + 1}</Badge>
                  </div>
                </Field>
                <Field label="Código do Projeto">
                  <div className="h-9 flex items-center">
                    <Badge variant="outline">
                      {data.codigo_projeto
                        ? `${data.codigo_projeto}-COT${String(data.numero_pacote).padStart(3, "0")} R${String(data.numero_revisao).padStart(2, "0")}`
                        : "—"}
                    </Badge>
                  </div>
                </Field>
                <Field label="Data da rodada">
                  <DateInput value={dataRodada} onChange={setDataRodada} />
                </Field>
                <Field label="Status">
                  <div className="h-9 flex items-center">
                    <StatusBadge status={data.status} />
                  </div>
                </Field>
              </div>

              <div className="flex items-center justify-between gap-4 rounded-md border p-3">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Short list ativo</Label>
                  <p className="text-xs text-muted-foreground">
                    Habilita a triagem por short list nesta cotação.
                  </p>
                </div>
                <Switch
                  checked={shortListAtivo}
                  onCheckedChange={setShortListAtivo}
                />
              </div>

              <Field label="Observações">
                <Textarea
                  rows={4}
                  value={observacoes}
                  maxLength={LIMITS.observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Anotações sobre esta cotação..."
                />
                <CharCount value={observacoes} limit={LIMITS.observacoes} />
              </Field>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="propostas" className="mt-4">
          <PropostasOriginaisTab
            key={reloadNonce}
            cotacaoId={cotacaoId}
            empresas={empresas}
            onDirtyChange={setPropostasDirty}
            registerSave={(fn) => {
              propostasSaveRef.current = fn;
            }}
          />
        </TabsContent>

        <TabsContent value="questionamentos" className="mt-4">
          <QuestionamentosTab
            empresas={empresas}
            questionamentos={questionamentos}
            respostas={respostas}
            onChange={(qid, eid, value) =>
              setRespostas((prev) => {
                const next = { ...prev };
                next[qid] = { ...(next[qid] ?? {}), [eid]: value };
                return next;
              })
            }
            loading={questLoading}
            erro={questErr}
          />
        </TabsContent>
      </Tabs>

      <UploadCotacaoModal
        projetoId={projetoId}
        numeroPacote={data.numero_pacote}
        open={openUpload}
        onOpenChange={setOpenUpload}
        onSuccess={() => setReloadNonce((n) => n + 1)}
      />
    </div>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={"space-y-1.5 " + (className ?? "")}>
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "ativa") {
    return (
      <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white">
        Ativa
      </Badge>
    );
  }
  if (status === "historico") {
    return <Badge variant="secondary">Histórico</Badge>;
  }
  return <Badge variant="outline">{status}</Badge>;
}

type QuestionamentoRow = {
  id: string;
  categoria: string | null;
  numero: string | null;
  pergunta: string;
  ordem: number;
};

function QuestionamentosTab({
  empresas,
  questionamentos,
  respostas,
  onChange,
  loading,
  erro,
}: {
  empresas: EmpresaRow[];
  questionamentos: QuestionamentoRow[];
  respostas: Record<string, Record<string, string>>;
  onChange: (qid: string, eid: string, value: string) => void;
  loading: boolean;
  erro: string | null;
}) {
  if (loading) {
    return (
      <div className="flex justify-center py-12 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando...
      </div>
    );
  }

  if (erro) {
    return (
      <Card>
        <CardContent className="p-12 text-center text-sm text-destructive">
          Erro ao carregar questionamentos: {erro}
        </CardContent>
      </Card>
    );
  }

  if (questionamentos.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center text-sm text-muted-foreground">
          Nenhum questionamento cadastrado para esta cotação.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Accordion type="multiple" className="w-full">
        {questionamentos.map((q) => {
          const answeredCount = empresas.filter(
            (e) => e.id && respostas[q.id]?.[e.id]?.trim(),
          ).length;

          return (
            <AccordionItem key={q.id} value={q.id}>
              <AccordionTrigger className="hover:no-underline py-3">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {q.categoria && (
                      <Badge variant="secondary" className="shrink-0 text-xs">
                        {q.categoria}
                      </Badge>
                    )}
                    {q.numero && (
                      <span className="text-xs font-semibold shrink-0">
                        #{q.numero}
                      </span>
                    )}
                    <span className="text-sm font-medium truncate">
                      {q.pergunta}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0 mr-2">
                    {answeredCount} / {empresas.length}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="flex flex-col gap-4 pb-2">
                  {empresas.map((e) => (
                    <div key={e.id ?? e.letra_id} className="space-y-1.5">
                      <div className="text-xs font-medium text-muted-foreground">
                        {e.letra_id} · {e.nome || "(sem nome)"}
                      </div>
                      <Textarea
                        rows={3}
                        disabled={!e.id}
                        value={(e.id && respostas[q.id]?.[e.id]) || ""}
                        onChange={(ev) =>
                          e.id && onChange(q.id, e.id, ev.target.value)
                        }
                        className="resize-y"
                        placeholder={
                          e.id ? "" : "Salve a empresa para responder"
                        }
                      />
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}

type ItemRow = {
  id: string;
  codigo_item: string;
  descricao: string;
  unidade: string | null;
  quantidade_projeto: number | null;
  parent_codigo: string | null;
  nivel: number;
  ordem: number;
  tipo: string | null;
  eh_expansivel: boolean | null;
  empresa_origem_id?: string | null;
  empresa_letra?: string | null;
  empresa_nome?: string | null;
};

type PropostaRow = {
  item_id: string;
  quantidade_proponente: number | null;
  preco_unit_material: number | null;
  preco_unit_mao_obra: number | null;
  preco_unitario: number | null;
  observacao_proponente: string | null;
};

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function rowClassByTipo(tipo: string | null, ehExp: boolean | null): string {
  switch (tipo) {
    case "macro":
      return "bg-blue-50 font-bold text-[15px]";
    case "secao":
      return "bg-muted/60 font-bold";
    case "omissos":
      return "bg-yellow-50 font-bold";
    case "subtotal":
    case "total":
      return "bg-muted font-bold";
    case "item":
      return ehExp ? "font-bold" : "";
    default:
      return "";
  }
}

type EditRow = {
  qtd_prop: string;
  preco_mat: string;
  preco_mo: string;
  obs: string;
};

const EMPTY_EDIT: EditRow = { qtd_prop: "", preco_mat: "", preco_mo: "", obs: "" };

const propostaToEdit = (p?: PropostaRow): EditRow => {
  // Proponente de quantitativo tem preço único (preco_unitario) e Material/MO nulos.
  // Exibimos esse preço na coluna Material para o valor aparecer e somar corretamente.
  const material =
    p?.preco_unit_material != null
      ? p.preco_unit_material
      : (p?.preco_unitario ?? null);
  return {
    qtd_prop:
      p?.quantidade_proponente == null ? "" : String(p.quantidade_proponente),
    preco_mat: material == null ? "" : String(material),
    preco_mo: p?.preco_unit_mao_obra == null ? "" : String(p.preco_unit_mao_obra),
    obs: p?.observacao_proponente ?? "",
  };
};

const editEquals = (a: EditRow, b: EditRow) =>
  a.qtd_prop === b.qtd_prop &&
  a.preco_mat === b.preco_mat &&
  a.preco_mo === b.preco_mo &&
  a.obs === b.obs;

const editIsEmpty = (e: EditRow) =>
  e.qtd_prop === "" && e.preco_mat === "" && e.preco_mo === "" && e.obs === "";

const parseNum = (s: string): number | null => {
  if (s === "" || s == null) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

const isEditableTipo = (tipo: string | null, ehExp: boolean | null) =>
  (tipo === "item" && !ehExp) || tipo === "subitem_omissos";

function PropostasOriginaisTab({
  cotacaoId,
  empresas,
  onDirtyChange,
  registerSave,
}: {
  cotacaoId: string;
  empresas: EmpresaRow[];
  onDirtyChange: (dirty: boolean) => void;
  registerSave: (
    fn: () => Promise<{ ok: boolean; count: number; empresaNome: string } | null>,
  ) => void;
}) {
  const empresasSalvas = useMemo(
    () => empresas.filter((e) => e.id && e.nome.trim()),
    [empresas],
  );
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [itens, setItens] = useState<ItemRow[]>([]);
  const [edits, setEdits] = useState<Record<string, EditRow>>({});
  const [initialEdits, setInitialEdits] = useState<Record<string, EditRow>>({});
  const [descricoes, setDescricoes] = useState<Record<string, string>>({});
  const [initialDescricoes, setInitialDescricoes] = useState<Record<string, string>>({});
  const [focusedDescId, setFocusedDescId] = useState<string | null>(null);


  const [loadingItens, setLoadingItens] = useState(true);
  const [loadingProp, setLoadingProp] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pendingEmpresaId, setPendingEmpresaId] = useState<string | null>(null);
  const [revisao, setRevisao] = useState<string>("atual");
  const [revisoesDisp, setRevisoesDisp] = useState<number[]>([]);
  const [uploadsPorRev, setUploadsPorRev] = useState<Record<string, string>>({});
  const [confirmExcluir, setConfirmExcluir] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [bdiInput, setBdiInput] = useState<string>("");
  const [bdiSaving, setBdiSaving] = useState(false);
  const [editingCod, setEditingCod] = useState<string | null>(null);
  const [codInput, setCodInput] = useState<string>("");
  const [savingCod, setSavingCod] = useState(false);
  const somenteLeitura = revisao !== "atual";

  // Edição inline da numeração (código) — correção manual na interface.
  const salvarCod = async (it: ItemRow) => {
    const novo = codInput.trim();
    setEditingCod(null);
    if (!novo || novo === it.codigo_item) return;
    setSavingCod(true);
    const { error } = await supabase
      .from("itens")
      .update({ codigo_item: novo })
      .eq("id", it.id);
    setSavingCod(false);
    if (error) {
      toast.error("Erro ao salvar numeração: " + error.message);
      return;
    }
    setItens((prev) =>
      prev.map((x) => (x.id === it.id ? { ...x, codigo_item: novo } : x)),
    );
    toast.success("Numeração atualizada.");
  };

  // BDI (por proponente) — carrega da empresa selecionada
  useEffect(() => {
    const emp = empresas.find((e) => e.id === empresaId);
    setBdiInput(
      emp?.bdi_percentual != null ? String(emp.bdi_percentual) : "",
    );
  }, [empresaId, empresas]);

  const salvarBdi = async () => {
    if (!empresaId) return;
    const raw = bdiInput.trim().replace(",", ".");
    const val = raw === "" ? null : Number(raw);
    if (val != null && (isNaN(val) || val < 0)) {
      toast.error("Informe um BDI válido (%).");
      return;
    }
    setBdiSaving(true);
    const { error } = await supabase
      .from("empresas")
      .update({ bdi_percentual: val })
      .eq("id", empresaId);
    setBdiSaving(false);
    if (error) toast.error("Erro ao salvar BDI: " + error.message);
  };

  useEffect(() => {
    setRevisao("atual");
  }, [empresaId]);

  useEffect(() => {
    if (empresaId && !empresasSalvas.some((e) => e.id === empresaId)) {
      setEmpresaId(null);
    }
    if (!empresaId && empresasSalvas.length > 0) {
      setEmpresaId(empresasSalvas[0].id);
    }
  }, [empresasSalvas, empresaId]);

  const ITENS_SELECT =
    "id, codigo_item, descricao, unidade, quantidade_projeto, parent_codigo, nivel, ordem, tipo, eh_expansivel, empresa_origem_id, empresa_origem:empresas!empresa_origem_id(letra_id, nome)";

  const mapItens = (data: any[] | null): ItemRow[] =>
    (data ?? []).map((r: any) => ({
      ...r,
      empresa_letra: r.empresa_origem?.letra_id ?? null,
      empresa_nome: r.empresa_origem?.nome ?? null,
    })) as ItemRow[];

  const refetchItens = async () => {
    setErro(null);
    const { data, error } = await supabase
      .from("itens")
      .select(ITENS_SELECT)
      .eq("cotacao_id", cotacaoId)
      .order("ordem", { ascending: true });
    if (error) {
      setErro(error.message);
      return [] as ItemRow[];
    }
    const rows = mapItens(data as any[]);
    setItens(rows);
    const dmap: Record<string, string> = {};
    for (const it of rows) dmap[it.id] = it.descricao ?? "";
    setDescricoes(dmap);
    setInitialDescricoes({ ...dmap });
    return rows;
  };

  // Exclui a proposta importada do proponente selecionado (para o caso de ter
  // importado uma planilha errada/defeituosa). Remove os valores e os omissos
  // que ela trouxe, e volta o status para "não entregue".
  const excluirProposta = async () => {
    if (!empresaId || !cotacaoId) return;
    setExcluindo(true);
    try {
      const { error: e1 } = await supabase
        .from("item_propostas")
        .delete()
        .eq("empresa_id", empresaId);
      if (e1) throw e1;
      const { error: e2 } = await supabase
        .from("itens")
        .delete()
        .eq("cotacao_id", cotacaoId)
        .eq("origem_omisso", true)
        .eq("empresa_origem_id", empresaId);
      if (e2) throw e2;
      // Exclusão é CORREÇÃO (não versão): limpa o histórico de revisões e
      // zera a revisão, para o próximo envio voltar a ser a revisão inicial (R00).
      await supabase
        .from("item_propostas_historico")
        .delete()
        .eq("empresa_id", empresaId);
      await supabase
        .from("empresas")
        .update({ status: "nao_entregue", numero_revisao: 0 })
        .eq("id", empresaId);
      toast.success("Proposta importada removida.");
      await refetchItens();
      setEdits({});
      setInitialEdits({});
    } catch (err) {
      toast.error(
        "Erro ao excluir proposta: " +
          (err instanceof Error ? err.message : String(err)),
      );
    } finally {
      setExcluindo(false);
      setConfirmExcluir(false);
    }
  };

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoadingItens(true);
      const { data, error } = await supabase
        .from("itens")
        .select(ITENS_SELECT)
        .eq("cotacao_id", cotacaoId)
        .order("ordem", { ascending: true });
      if (cancel) return;
      if (error) setErro(error.message);
      else {
        const rows = mapItens(data as any[]);
        setItens(rows);
        const dmap: Record<string, string> = {};
        for (const it of rows) dmap[it.id] = it.descricao ?? "";
        setDescricoes(dmap);
        setInitialDescricoes({ ...dmap });
      }
      setLoadingItens(false);
    })();
    return () => {
      cancel = true;
    };
  }, [cotacaoId]);

  // Revisões arquivadas e uploads da empresa selecionada
  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!empresaId) {
        setRevisoesDisp([]);
        setUploadsPorRev({});
        return;
      }
      const { data } = await supabase
        .from("item_propostas_historico")
        .select("numero_revisao")
        .eq("empresa_id", empresaId);
      if (cancel) return;
      const revs = Array.from(
        new Set(((data ?? []) as any[]).map((r) => Number(r.numero_revisao))),
      )
        .filter((n) => Number.isFinite(n))
        .sort((a, b) => a - b);
      setRevisoesDisp(revs);

      const up = await supabase
        .from("uploads_historico")
        .select("numero_revisao, arquivo_path")
        .eq("empresa_id", empresaId);
      if (cancel) return;
      const map: Record<string, string> = {};
      for (const u of (up.data ?? []) as any[]) {
        if (u.arquivo_path) map[String(u.numero_revisao ?? "atual")] = u.arquivo_path;
      }
      setUploadsPorRev(map);
    })();
    return () => {
      cancel = true;
    };
  }, [empresaId]);

  useEffect(() => {
    if (!empresaId || itens.length === 0) {
      setEdits({});
      setInitialEdits({});
      setLoadingProp(false);
      return;
    }
    let cancel = false;
    (async () => {
      setLoadingProp(true);
      try {
        console.log("[propostas] fetch start", { empresaId, revisao });
        const query =
          revisao === "atual"
            ? supabase
                .from("item_propostas")
                .select(
                  "item_id, quantidade_proponente, preco_unit_material, preco_unit_mao_obra, preco_unitario, observacao_proponente",
                )
                .eq("empresa_id", empresaId)
            : supabase
                .from("item_propostas_historico")
                .select(
                  "item_id, quantidade_proponente, preco_unit_material, preco_unit_mao_obra, preco_unitario, observacao_proponente",
                )
                .eq("empresa_id", empresaId)
                .eq("numero_revisao", Number(revisao));
        const { data, error } = await query;
        if (error) {
          console.error("[propostas] erro:", error);
          throw error;
        }
        console.log("[propostas] fetch done", { empresaId, cancel, count: data?.length });
        if (cancel) return;
        const map: Record<string, EditRow> = {};
        const byItem: Record<string, PropostaRow> = {};
        for (const p of (data ?? []) as PropostaRow[]) byItem[p.item_id] = p;
        for (const it of itens) {
          map[it.id] = propostaToEdit(byItem[it.id]);
        }
        setEdits(map);
        setInitialEdits(JSON.parse(JSON.stringify(map)));
      } catch (e) {
        console.error("[propostas] catch:", e);
        if (!cancel) {
          setErro(e instanceof Error ? e.message : "Erro ao carregar propostas da empresa.");
          setEdits({});
          setInitialEdits({});
        }
      } finally {
        setLoadingProp(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [empresaId, itens, revisao]);


  const modifiedIds = useMemo(() => {
    const ids: string[] = [];
    for (const itemId of Object.keys(edits)) {
      const curr = edits[itemId];
      const init = initialEdits[itemId] ?? EMPTY_EDIT;
      if (!editEquals(curr, init)) ids.push(itemId);
    }
    return ids;
  }, [edits, initialEdits]);

  const descModifiedIds = useMemo(() => {
    const ids: string[] = [];
    for (const itemId of Object.keys(descricoes)) {
      const curr = descricoes[itemId] ?? "";
      const init = initialDescricoes[itemId] ?? "";
      if (curr !== init) ids.push(itemId);
    }
    return ids;
  }, [descricoes, initialDescricoes]);

  const dirty = modifiedIds.length > 0 || descModifiedIds.length > 0;

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  const empresaIdRef = useRef(empresaId);
  const editsRef = useRef(edits);
  const initialEditsRef = useRef(initialEdits);
  const modifiedIdsRef = useRef(modifiedIds);
  const descricoesRef = useRef(descricoes);
  const descModifiedIdsRef = useRef(descModifiedIds);
  const empresasRef = useRef(empresasSalvas);
  empresaIdRef.current = empresaId;
  editsRef.current = edits;
  initialEditsRef.current = initialEdits;
  modifiedIdsRef.current = modifiedIds;
  descricoesRef.current = descricoes;
  descModifiedIdsRef.current = descModifiedIds;
  empresasRef.current = empresasSalvas;

  useEffect(() => {
    registerSave(async () => {
      const eid = empresaIdRef.current;
      const emp = empresasRef.current.find((e) => e.id === eid);
      const empresaNome = emp?.nome ?? "";
      const ids = modifiedIdsRef.current;
      const descIds = descModifiedIdsRef.current;
      if (!eid && descIds.length === 0) return { ok: true, count: 0, empresaNome: "" };
      if (ids.length === 0 && descIds.length === 0)
        return { ok: true, count: 0, empresaNome };

      const upserts: any[] = [];
      const deletes: string[] = [];
      const currEdits = editsRef.current;
      const initEdits = initialEditsRef.current;
      if (eid) {
        for (const itemId of ids) {
          const curr = currEdits[itemId];
          const init = initEdits[itemId] ?? EMPTY_EDIT;
          const hadBefore = !editIsEmpty(init);
          if (editIsEmpty(curr) && hadBefore) {
            deletes.push(itemId);
          } else if (!editIsEmpty(curr)) {
            upserts.push({
              item_id: itemId,
              empresa_id: eid,
              quantidade_proponente: parseNum(curr.qtd_prop),
              preco_unit_material: parseNum(curr.preco_mat),
              preco_unit_mao_obra: parseNum(curr.preco_mo),
              observacao_proponente: curr.obs || null,
            });
          }
        }
      }

      let count = 0;
      if (upserts.length > 0) {
        const { error } = await supabase
          .from("item_propostas")
          .upsert(upserts, { onConflict: "item_id,empresa_id" });
        if (error) {
          toast.error("Erro ao salvar propostas: " + error.message);
          return { ok: false, count: 0, empresaNome };
        }
        count += upserts.length;
      }
      for (const itemId of deletes) {
        const { error } = await supabase
          .from("item_propostas")
          .delete()
          .eq("item_id", itemId)
          .eq("empresa_id", eid!);
        if (error) {
          toast.error("Erro ao salvar propostas: " + error.message);
          return { ok: false, count: 0, empresaNome };
        }
        count++;
      }

      // Persistir descrições de itens alteradas
      const currDesc = descricoesRef.current;
      for (const itemId of descIds) {
        const novo = (currDesc[itemId] ?? "").trim();
        const { error } = await supabase
          .from("itens")
          .update({ descricao: novo === "" ? null : novo })
          .eq("id", itemId);
        if (error) {
          toast.error("Erro ao salvar descrição: " + error.message);
          return { ok: false, count, empresaNome };
        }
        count++;
      }
      if (descIds.length > 0) {
        setItens((prev) =>
          prev.map((it) =>
            descIds.includes(it.id)
              ? { ...it, descricao: (currDesc[it.id] ?? "").trim() }
              : it,
          ),
        );
        setInitialDescricoes({ ...currDesc });
      }

      setInitialEdits(JSON.parse(JSON.stringify(editsRef.current)));
      return { ok: true, count, empresaNome };
    });
  }, [registerSave]);

  // Expansível se a próxima linha (por ordem) tiver nivel maior.
  const idsExpansiveis = useMemo(() => {
    const s = new Set<string>();
    for (let i = 0; i < itens.length; i++) {
      const cur = itens[i];
      const next = itens[i + 1];
      if (next && (next.nivel ?? 0) > (cur.nivel ?? 0)) s.add(cur.id);
    }
    return s;
  }, [itens]);

  // Estado inicial: tudo expandido → guardamos os RECOLHIDOS.
  const [recolhidos, setRecolhidos] = useState<Set<string>>(new Set());

  const linhasVisiveis = useMemo(() => {
    const out: ItemRow[] = [];
    let skipAcimaDe: number | null = null; // esconder enquanto nivel > skipAcimaDe
    for (const it of itens) {
      const n = it.nivel ?? 0;
      if (skipAcimaDe !== null) {
        if (n > skipAcimaDe) continue;
        skipAcimaDe = null;
      }
      out.push(it);
      if (recolhidos.has(it.id) && idsExpansiveis.has(it.id)) {
        skipAcimaDe = n;
      }
    }
    return out;
  }, [itens, recolhidos, idsExpansiveis]);

  const toggle = (id: string) => {
    setRecolhidos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Total por item (folhas) e subtotal por grupo (soma das folhas descendentes).
  const totaisPorId = useMemo(() => {
    const leafTotal = new Map<string, number | null>();
    for (const it of itens) {
      const editable = isEditableTipo(it.tipo, it.eh_expansivel);
      const isGroup = idsExpansiveis.has(it.id);
      if (isGroup || !editable) {
        leafTotal.set(it.id, null);
        continue;
      }
      const e = edits[it.id] ?? EMPTY_EDIT;
      const qtdPropNum = parseNum(e.qtd_prop);
      const matNum = parseNum(e.preco_mat);
      const moNum = parseNum(e.preco_mo);
      const qtdForTotal = qtdPropNum ?? it.quantidade_projeto;
      const t =
        qtdForTotal != null ? qtdForTotal * ((matNum ?? 0) + (moNum ?? 0)) : null;
      leafTotal.set(it.id, t);
    }
    const out = new Map<string, number | null>(leafTotal);
    for (let i = 0; i < itens.length; i++) {
      const cur = itens[i];
      if (!idsExpansiveis.has(cur.id)) continue;
      const baseNivel = cur.nivel ?? 0;
      let sum = 0;
      let has = false;
      for (let j = i + 1; j < itens.length; j++) {
        const nj = itens[j].nivel ?? 0;
        if (nj <= baseNivel) break;
        const lt = leafTotal.get(itens[j].id);
        if (lt != null) {
          sum += lt;
          has = true;
        }
      }
      out.set(cur.id, has ? sum : null);
    }
    return out;
  }, [itens, edits, idsExpansiveis]);

  // Total geral do proponente = soma das folhas (grupos são excluídos p/ não duplicar).
  const totalGeral = useMemo(() => {
    let s = 0;
    let has = false;
    for (const it of itens) {
      if (idsExpansiveis.has(it.id)) continue;
      const v = totaisPorId.get(it.id);
      if (v != null) {
        s += v;
        has = true;
      }
    }
    return has ? s : null;
  }, [itens, idsExpansiveis, totaisPorId]);

  // BDI aplicado sobre o subtotal de custos (diretos + indiretos).
  const bdiPct = (() => {
    const n = Number(bdiInput.trim().replace(",", "."));
    return isNaN(n) ? 0 : n;
  })();
  const bdiValor = totalGeral != null ? totalGeral * (bdiPct / 100) : null;
  const totalComBdi =
    totalGeral != null ? totalGeral + (bdiValor ?? 0) : null;

  // Validação interna: sinaliza linhas fora do padrão (não trava a importação).
  const diagnosticos = useMemo(() => {
    const m = new Map<string, { tipo: "erro" | "aviso"; motivo: string }>();
    const contCod = new Map<string, number>();
    for (const it of itens)
      if (!it.empresa_origem_id)
        contCod.set(it.codigo_item, (contCod.get(it.codigo_item) ?? 0) + 1);
    for (const it of itens) {
      if (it.empresa_origem_id) {
        m.set(it.id, {
          tipo: "erro",
          motivo:
            "Item fora da estrutura (omisso) — veio do proponente e não casou com a planilha.",
        });
        continue;
      }
      const isGroup = idsExpansiveis.has(it.id);
      const editable = isEditableTipo(it.tipo, it.eh_expansivel);
      if (isGroup || !editable) continue;
      const e = edits[it.id] ?? EMPTY_EDIT;
      const q = parseNum(e.qtd_prop) ?? it.quantidade_projeto;
      const mat = parseNum(e.preco_mat);
      const mo = parseNum(e.preco_mo);
      const temPreco = (mat ?? 0) !== 0 || (mo ?? 0) !== 0;
      const temQtd = q != null && q !== 0;
      if (temQtd && !temPreco) {
        m.set(it.id, { tipo: "aviso", motivo: "Quantidade informada, mas sem preço." });
        continue;
      }
      if (!temQtd && temPreco) {
        m.set(it.id, { tipo: "aviso", motivo: "Preço informado, mas sem quantidade." });
        continue;
      }
      if ((contCod.get(it.codigo_item) ?? 0) > 1) {
        m.set(it.id, {
          tipo: "aviso",
          motivo: "Código repetido na planilha — confira a numeração.",
        });
        continue;
      }
    }
    return m;
  }, [itens, edits, idsExpansiveis]);

  const resumoDiag = useMemo(() => {
    let erros = 0;
    let avisos = 0;
    for (const d of diagnosticos.values())
      d.tipo === "erro" ? erros++ : avisos++;
    return { erros, avisos };
  }, [diagnosticos]);

  const updateEdit = (itemId: string, patch: Partial<EditRow>) =>
    setEdits((prev) => ({
      ...prev,
      [itemId]: { ...(prev[itemId] ?? EMPTY_EDIT), ...patch },
    }));

  const handleEmpresaSelect = (v: string) => {
    if (v === empresaId) return;
    if (dirty) {
      setPendingEmpresaId(v);
    } else {
      setEmpresaId(v);
    }
  };

  const confirmSwitch = async (mode: "save" | "discard") => {
    const target = pendingEmpresaId;
    if (!target) return;
    if (mode === "save") {
      const res = await propostasSaveLocal();
      if (!res.ok) {
        // keep dialog state? close it; user can retry
        setPendingEmpresaId(null);
        return;
      }
      const emp = empresasSalvas.find((e) => e.id === empresaId);
      toast.success(
        `Proposta da empresa ${emp?.nome ?? ""} salva: ${res.count} itens atualizados`,
      );
    }
    setPendingEmpresaId(null);
    setEmpresaId(target);
  };

  // local save (mirrors registered save) so we don't recurse through parent
  const propostasSaveLocal = async (): Promise<{ ok: boolean; count: number }> => {
    const eid = empresaId;
    const ids = eid ? modifiedIds : [];
    if (ids.length === 0 && descModifiedIds.length === 0)
      return { ok: true, count: 0 };

    const upserts: any[] = [];
    const deletes: string[] = [];
    for (const itemId of ids) {
      const curr = edits[itemId];
      const init = initialEdits[itemId] ?? EMPTY_EDIT;
      const hadBefore = !editIsEmpty(init);
      if (editIsEmpty(curr) && hadBefore) {
        deletes.push(itemId);
      } else if (!editIsEmpty(curr)) {
        upserts.push({
          item_id: itemId,
          empresa_id: eid,
          quantidade_proponente: parseNum(curr.qtd_prop),
          preco_unit_material: parseNum(curr.preco_mat),
          preco_unit_mao_obra: parseNum(curr.preco_mo),
          observacao_proponente: curr.obs || null,
        });
      }
    }

    let count = 0;
    if (upserts.length > 0) {
      const { error } = await supabase
        .from("item_propostas")
        .upsert(upserts, { onConflict: "item_id,empresa_id" });
      if (error) {
        toast.error("Erro ao salvar propostas: " + error.message);
        return { ok: false, count: 0 };
      }
      count += upserts.length;
    }
    for (const itemId of deletes) {
      const { error } = await supabase
        .from("item_propostas")
        .delete()
        .eq("item_id", itemId)
        .eq("empresa_id", eid);
      if (error) {
        toast.error("Erro ao salvar propostas: " + error.message);
        return { ok: false, count: 0 };
      }
      count++;
    }
    // Persistir descrições alteradas
    for (const itemId of descModifiedIds) {
      const novo = (descricoes[itemId] ?? "").trim();
      const { error } = await supabase
        .from("itens")
        .update({ descricao: novo === "" ? null : novo })
        .eq("id", itemId);
      if (error) {
        toast.error("Erro ao salvar descrição: " + error.message);
        return { ok: false, count };
      }
      count++;
    }
    if (descModifiedIds.length > 0) {
      setItens((prev) =>
        prev.map((it) =>
          descModifiedIds.includes(it.id)
            ? { ...it, descricao: (descricoes[it.id] ?? "").trim() }
            : it,
        ),
      );
      setInitialDescricoes({ ...descricoes });
    }
    setInitialEdits(JSON.parse(JSON.stringify(edits)));
    return { ok: true, count };
  };

  const baixarEnvio = async (path: string) => {
    try {
      if (/^https?:\/\//.test(path)) {
        window.open(path, "_blank");
        return;
      }
      const [bucket, ...rest] = path.split("/");
      const objectPath = rest.join("/");
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(objectPath, 60);
      if (error || !data?.signedUrl) throw error ?? new Error("Sem URL");
      window.open(data.signedUrl, "_blank");
    } catch (e) {
      toast.error(
        "Não foi possível baixar o arquivo: " +
          (e instanceof Error ? e.message : String(e)),
      );
    }
  };

  const empresaSel = empresasSalvas.find((e) => e.id === empresaId);
  // Revisão corrente (editável) = maior número; arquivadas são as menores.
  const revAtualNum = revisoesDisp.length ? Math.max(...revisoesDisp) + 1 : 0;



  if (empresasSalvas.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center text-sm text-muted-foreground">
          Cadastre e salve ao menos uma empresa proponente para editar
          propostas.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Empresa selecionada
          </Label>
          <Select
            value={empresaId ?? undefined}
            onValueChange={handleEmpresaSelect}
          >
            <SelectTrigger className="w-[320px]">
              <SelectValue placeholder="Selecione a empresa" />
            </SelectTrigger>
            <SelectContent>
              {empresasSalvas.map((e) => (
                <SelectItem key={e.id!} value={e.id!}>
                  {e.letra_id} · {e.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-3">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Revisão
          </Label>
          <Select
            value={revisao}
            onValueChange={(v) => {
              if (v === revisao) return;
              if (dirty) {
                toast.error(
                  "Salve ou descarte as alterações antes de trocar de revisão.",
                );
                return;
              }
              setRevisao(v);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="atual">
                R{String(revAtualNum).padStart(2, "0")}
              </SelectItem>
              {revisoesDisp.map((r) => (
                <SelectItem key={r} value={String(r)}>
                  R{String(r).padStart(2, "0")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {uploadsPorRev[revisao] && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => baixarEnvio(uploadsPorRev[revisao])}
            >
              <Download className="h-4 w-4 mr-1" />
              Baixar .xlsx
            </Button>
          )}
        </div>
        {empresaSel && (
          <span className="text-sm text-muted-foreground">
            {somenteLeitura ? "Visualizando revisão arquivada de " : "Editando proposta da empresa "}
            <span className="font-medium text-foreground">
              {empresaSel.nome}
            </span>
          </span>
        )}
        {empresaSel?.id && (
          <div className="flex items-center gap-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              BDI %
            </Label>
            <Input
              type="text"
              value={bdiInput}
              onChange={(e) => setBdiInput(e.target.value)}
              onBlur={salvarBdi}
              disabled={somenteLeitura || bdiSaving}
              placeholder="0"
              className="w-20 h-8 text-right"
            />
          </div>
        )}
        {empresaSel?.id && !somenteLeitura && (
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive border-destructive/40"
            onClick={() => setConfirmExcluir(true)}
          >
            Excluir proposta
          </Button>
        )}
      </div>

      <AlertDialog
        open={confirmExcluir}
        onOpenChange={(o) => {
          if (!excluindo) setConfirmExcluir(o);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir proposta importada?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove os valores importados
              {empresaSel ? ` da empresa ${empresaSel.nome}` : ""} e os itens
              omissos que ela trouxe. Use quando a planilha foi importada errada
              ou com defeito. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmExcluir(false)}
              disabled={excluindo}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={excluirProposta}
              disabled={excluindo}
            >
              {excluindo ? "Excluindo..." : "Excluir proposta"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {somenteLeitura && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="p-3 text-sm">
            Você está visualizando a revisão R
            {String(Number(revisao)).padStart(2, "0")} (somente leitura).
            Selecione a revisão mais recente (R
            {String(revAtualNum).padStart(2, "0")}) para editar os valores
            correntes.
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Os omissos listam itens extras que cada proponente trouxe. As decisões
        sobre cada omisso (aceitar, recusar, renumerar) devem ser feitas na
        planilha COT de equalização, fora do sistema.
      </p>

      {empresaSel?.id &&
        (resumoDiag.erros > 0 || resumoDiag.avisos > 0) && (
          <div className="flex items-center gap-2 rounded-md border border-amber-400/60 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 text-xs">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <span>
              Validação:{" "}
              {resumoDiag.erros > 0 && (
                <span className="font-medium text-red-700">
                  {resumoDiag.erros} linha(s) com erro
                </span>
              )}
              {resumoDiag.erros > 0 && resumoDiag.avisos > 0 && " · "}
              {resumoDiag.avisos > 0 && (
                <span className="font-medium text-amber-700">
                  {resumoDiag.avisos} aviso(s)
                </span>
              )}
              . As linhas destacadas em vermelho/amarelo têm o motivo no ícone de
              alerta. Você pode corrigir os valores direto na tabela — a
              importação não é bloqueada.
            </span>
          </div>
        )}


      {erro && (
        <Card>
          <CardContent className="p-4 text-sm text-destructive">
            {erro}
          </CardContent>
        </Card>
      )}

      {loadingItens ? (
        <div className="flex justify-center py-12 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando itens...
        </div>
      ) : itens.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-sm text-muted-foreground">
            Nenhum item cadastrado para esta cotação.
          </CardContent>
        </Card>
      ) : (
        <div className="w-full border rounded-md overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead className="w-[140px]">Código</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="w-[60px] text-center">Un</TableHead>
                <TableHead className="w-[110px] text-right">Qtd Projeto</TableHead>
                <TableHead className="w-[120px] text-right">Qtd Prop.</TableHead>
                <TableHead className="w-[140px] text-right">$ Material</TableHead>
                <TableHead className="w-[140px] text-right">$ MO</TableHead>
                <TableHead className="w-[140px] text-right">Material+MO</TableHead>
                <TableHead className="w-[130px] text-right">Total</TableHead>
                <TableHead className="w-[220px]">Obs</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhasVisiveis.map((it) => {
                const temFilhos = idsExpansiveis.has(it.id);
                const aberto = !recolhidos.has(it.id);
                const editable = isEditableTipo(it.tipo, it.eh_expansivel);
                const edit = edits[it.id] ?? EMPTY_EDIT;
                const qtdPropNum = parseNum(edit.qtd_prop);
                const matNum = parseNum(edit.preco_mat);
                const moNum = parseNum(edit.preco_mo);
                const qtdForTotal = qtdPropNum ?? it.quantidade_projeto;
                const total =
                  qtdForTotal != null
                    ? qtdForTotal * ((matNum ?? 0) + (moNum ?? 0))
                    : null;
                return (
                  <TableRow
                    key={it.id}
                    className={cn(
                      rowClassByTipo(it.tipo, it.eh_expansivel),
                      diagnosticos.get(it.id)?.tipo === "erro" &&
                        "bg-red-50 dark:bg-red-950/30 border-l-2 border-l-red-500",
                      diagnosticos.get(it.id)?.tipo === "aviso" &&
                        "bg-amber-50 dark:bg-amber-950/20 border-l-2 border-l-amber-500",
                    )}
                  >
                    <TableCell className="font-mono text-xs">
                      <div className="flex items-center gap-1 group">
                        {temFilhos ? (
                          <button
                            type="button"
                            onClick={() => toggle(it.id)}
                            className="shrink-0 inline-flex items-center justify-center w-4 h-4 hover:bg-muted rounded cursor-pointer"
                            aria-label={aberto ? "Recolher" : "Expandir"}
                          >
                            {aberto ? (
                              <ChevronDown className="h-3 w-3" />
                            ) : (
                              <ChevronRight className="h-3 w-3" />
                            )}
                          </button>
                        ) : (
                          <span className="inline-block w-4" />
                        )}
                        {editingCod === it.id ? (
                          <input
                            autoFocus
                            value={codInput}
                            disabled={savingCod}
                            onChange={(e) => setCodInput(e.target.value)}
                            onBlur={() => salvarCod(it)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.currentTarget.blur();
                              if (e.key === "Escape") setEditingCod(null);
                            }}
                            className="w-24 h-6 px-1 rounded border border-input bg-background text-xs font-mono focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          />
                        ) : (
                          <>
                            <span>{it.codigo_item}</span>
                            {!somenteLeitura && (
                              <button
                                type="button"
                                title="Editar numeração"
                                onClick={() => {
                                  setEditingCod(it.id);
                                  setCodInput(it.codigo_item);
                                }}
                                className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center justify-center w-4 h-4 hover:bg-muted rounded cursor-pointer text-muted-foreground"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                            )}
                            {(() => {
                              const d = diagnosticos.get(it.id);
                              return d ? (
                                <span
                                  title={d.motivo}
                                  className="shrink-0 ml-0.5 cursor-help"
                                >
                                  <AlertTriangle
                                    className={cn(
                                      "h-3.5 w-3.5",
                                      d.tipo === "erro"
                                        ? "text-red-600"
                                        : "text-amber-600",
                                    )}
                                  />
                                </span>
                              ) : null;
                            })()}
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell
                      style={{ paddingLeft: `${(it.nivel ?? 0) * 16 + 12}px` }}
                    >
                      <div className="flex items-center gap-2">
                        {editable ? (
                          <div className="relative min-w-0 flex-1">
                            <Textarea
                              readOnly={somenteLeitura}
                              value={descricoes[it.id] ?? ""}
                              onChange={(e) =>
                                setDescricoes((prev) => ({
                                  ...prev,
                                  [it.id]: e.target.value,
                                }))
                              }
                              onFocus={() => setFocusedDescId(it.id)}
                              onBlur={() => setFocusedDescId(null)}
                              rows={focusedDescId === it.id ? 3 : 1}
                              className={cn(
                                "resize-none overflow-hidden py-1 px-2 text-sm leading-tight focus-visible:ring-1 focus-visible:ring-ring",
                                focusedDescId === it.id
                                  ? "absolute left-0 top-0 z-50 min-w-[520px] min-h-[72px] bg-background shadow-md border rounded-md"
                                  : "relative w-full h-8 min-h-[32px]"
                              )}
                              placeholder="Descrição do item"
                            />
                          </div>
                        ) : (
                          <span className="flex-1">{it.descricao}</span>
                        )}
                        {it.tipo === "subitem_omissos" && it.empresa_origem_id && (
                          <Badge variant="secondary" className="ml-2 text-xs">
                            {it.empresa_letra ?? "—"} · {it.empresa_nome ?? ""}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-xs">
                      {it.unidade ?? ""}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {it.quantidade_projeto ?? ""}
                    </TableCell>
                    <TableCell className="text-right p-1">
                      {editable ? (
                        <Input
                          type="number"
                          step="0.000001"
                          value={edit.qtd_prop}
                          readOnly={somenteLeitura}
                          onChange={(e) =>
                            updateEdit(it.id, { qtd_prop: e.target.value })
                          }
                          className="h-8 text-right"
                        />
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right p-1">
                      {editable ? (
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground">R$</span>
                          <Input
                            type="number"
                            step="0.01"
                            value={edit.preco_mat}
                            readOnly={somenteLeitura}
                            onChange={(e) =>
                              updateEdit(it.id, { preco_mat: e.target.value })
                            }
                            className="h-8 text-right"
                          />
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right p-1">
                      {editable ? (
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground">R$</span>
                          <Input
                            type="number"
                            step="0.01"
                            value={edit.preco_mo}
                            readOnly={somenteLeitura}
                            onChange={(e) =>
                              updateEdit(it.id, { preco_mo: e.target.value })
                            }
                            className="h-8 text-right"
                          />
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">
                      {matNum == null && moNum == null
                        ? "—"
                        : fmtBRL((matNum ?? 0) + (moNum ?? 0))}
                    </TableCell>
                    <TableCell className="text-right">
                      {(() => {
                        const isGroup = temFilhos;
                        const val = isGroup ? totaisPorId.get(it.id) ?? null : total;
                        return val != null && val !== 0 ? fmtBRL(val) : "—";
                      })()}
                    </TableCell>
                    <TableCell className="p-1">
                      {editable ? (
                        <Input
                          type="text"
                          value={edit.obs}
                          readOnly={somenteLeitura}
                          onChange={(e) =>
                            updateEdit(it.id, { obs: e.target.value })
                          }
                          className="h-8 truncate"
                        />
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-right text-muted-foreground"
                >
                  Subtotal (custos diretos + indiretos)
                </TableCell>
                <TableCell className="text-right">
                  {totalGeral != null ? fmtBRL(totalGeral) : "—"}
                </TableCell>
                <TableCell />
              </TableRow>
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-right text-muted-foreground"
                >
                  BDI ({bdiPct.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%)
                </TableCell>
                <TableCell className="text-right">
                  {bdiValor != null ? fmtBRL(bdiValor) : "—"}
                </TableCell>
                <TableCell />
              </TableRow>
              <TableRow className="bg-muted/60 font-semibold">
                <TableCell colSpan={8} className="text-right">
                  TOTAL GERAL (com BDI)
                </TableCell>
                <TableCell className="text-right">
                  {totalComBdi != null ? fmtBRL(totalComBdi) : "—"}
                </TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
          {loadingProp && (
            <div className="flex items-center justify-center py-3 text-xs text-muted-foreground border-t">
              <Loader2 className="h-3 w-3 animate-spin mr-2" /> Carregando
              proposta...
            </div>
          )}
        </div>
      )}

      <AlertDialog
        open={pendingEmpresaId !== null}
        onOpenChange={(o) => {
          if (!o) setPendingEmpresaId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Alterações não salvas</AlertDialogTitle>
            <AlertDialogDescription>
              Você tem alterações não salvas na proposta de{" "}
              {empresaSel?.nome ?? ""}. Deseja salvar antes de trocar de
              empresa?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              variant="outline"
              onClick={() => setPendingEmpresaId(null)}
            >
              Cancelar
            </Button>
            <Button
              variant="secondary"
              onClick={() => confirmSwitch("discard")}
            >
              Descartar e trocar
            </Button>
            <Button onClick={() => confirmSwitch("save")}>
              Salvar e trocar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
