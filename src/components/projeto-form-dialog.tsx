import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { CharCount, LIMITS } from "@/components/char-count";

export type ProjetoFormData = {
  id?: string;
  nome: string;
  codigo_projeto?: string | null;
  empreendedor?: string | null;
  empreendimento?: string | null;
  cidade_uf?: string | null;
  disciplina?: string | null;
  formato_default?: string | null;
  escopo_pa?: string | null;
  referencia?: string | null;
};


const CODIGO_RE = /^[A-Za-z0-9-]*$/;
const isCodigoValid = (s: string) =>
  s.length <= 20 && CODIGO_RE.test(s);


interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string | null;
  mode: "create" | "edit";
  initial?: ProjetoFormData | null;
  onSaved: () => void;
}

export function ProjetoFormDialog({
  open,
  onOpenChange,
  userId,
  mode,
  initial,
  onSaved,
}: Props) {
  const [nome, setNome] = useState("");
  const [codigoProjeto, setCodigoProjeto] = useState("");
  const [empreendedor, setEmpreendedor] = useState("");
  const [empreendimento, setEmpreendimento] = useState("");
  const [cidadeUf, setCidadeUf] = useState("");
  const [disciplina, setDisciplina] = useState("");
  const [formatoDefault, setFormatoDefault] = useState("XXX000");
  const [escopoPa, setEscopoPa] = useState("");
  const [referencia, setReferencia] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setNome(initial?.nome ?? "");
      setCodigoProjeto(initial?.codigo_projeto ?? "");
      setEmpreendedor(initial?.empreendedor ?? "");
      setEmpreendimento(initial?.empreendimento ?? "");
      setCidadeUf(initial?.cidade_uf ?? "");
      setDisciplina(initial?.disciplina ?? "");
      setFormatoDefault(initial?.formato_default ?? "XXX000");
      setEscopoPa(initial?.escopo_pa ?? "");
      setReferencia(initial?.referencia ?? "");
    }
  }, [open, initial]);



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.preventDefault();
    if (!nome.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    const codigoTrim = codigoProjeto.trim();
    if (codigoTrim && !isCodigoValid(codigoTrim)) {
      toast.error("Código do Projeto inválido", {
        description: "Máx. 20 caracteres alfanuméricos ou hífens.",
      });
      return;
    }
    if (!userId) {
      toast.error("Usuário não autenticado");
      return;
    }
    setSubmitting(true);

    const payload = {
      nome: nome.trim(),
      codigo_projeto: codigoTrim || null,
      empreendedor: empreendedor.trim() || null,
      empreendimento: empreendimento.trim() || null,
      cidade_uf: cidadeUf.trim() || null,
      disciplina: disciplina.trim() || null,
      formato_default: formatoDefault,
      escopo_pa: escopoPa.trim() || null,
      referencia: referencia.trim() || null,
    };


    const handleSupabaseError = (
      error: { code?: string; message: string } | null,
      action: "criar" | "atualizar",
    ) => {
      if (!error) return false;
      if (error.code === "23505") {
        toast.error("Já existe outro projeto com esse código nesta organização.");
      } else {
        toast.error(`Erro ao ${action} projeto`, { description: error.message });
      }
      return true;
    };

    if (mode === "edit" && initial?.id) {
      const { error } = await supabase
        .from("projetos")
        .update(payload)
        .eq("id", initial.id);
      setSubmitting(false);
      if (handleSupabaseError(error, "atualizar")) return;
      toast.success("Projeto atualizado");
    } else {
      const { data: perfil, error: perfilError } = await supabase
        .from("perfis")
        .select("organizacao_id")
        .eq("id", userId)
        .single();
      if (perfilError || !perfil?.organizacao_id) {
        toast.error("Não foi possível identificar sua organização", {
          description: perfilError?.message,
        });
        setSubmitting(false);
        return;
      }
      const { error } = await supabase.from("projetos").insert({
        ...payload,
        organizacao_id: perfil.organizacao_id,
        criado_por: userId,
      });
      setSubmitting(false);
      if (handleSupabaseError(error, "criar")) return;
      toast.success("Projeto criado com sucesso");
    }


    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? "Editar dados do projeto" : "Novo Projeto"}
          </DialogTitle>
          <DialogDescription>
            Preencha as informações do projeto de cotação.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">
              Nome <span className="text-destructive">*</span>
            </Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
              maxLength={LIMITS.nome}
            />
            <CharCount value={nome} limit={LIMITS.nome} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="codigo_projeto">Código do Projeto</Label>
            <Input
              id="codigo_projeto"
              value={codigoProjeto}
              onChange={(e) => setCodigoProjeto(e.target.value)}
              placeholder="Ex: MOD022"
              className={
                !codigoProjeto.trim() || isCodigoValid(codigoProjeto.trim())
                  ? undefined
                  : "border-destructive focus-visible:ring-destructive"
              }
            />
            <p className="text-xs text-muted-foreground">
              Identificador curto livre, ex: MOD022, MOD006, MOD2025
            </p>
            {codigoProjeto.trim() && !isCodigoValid(codigoProjeto.trim()) ? (
              <p className="text-xs text-destructive">
                Máx. 20 caracteres alfanuméricos ou hífens.
              </p>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="empreendedor">Empreendedor</Label>
              <Input
                id="empreendedor"
                value={empreendedor}
                onChange={(e) => setEmpreendedor(e.target.value)}
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="empreendimento">Empreendimento</Label>
              <Input
                id="empreendimento"
                value={empreendimento}
                onChange={(e) => setEmpreendimento(e.target.value)}
                maxLength={200}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cidade_uf">Cidade/UF</Label>
              <Input
                id="cidade_uf"
                value={cidadeUf}
                onChange={(e) => setCidadeUf(e.target.value)}
                placeholder="São Paulo/SP"
                maxLength={LIMITS.cidadeUf}
              />
              <CharCount value={cidadeUf} limit={LIMITS.cidadeUf} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="disciplina">Disciplina</Label>
              <Input
                id="disciplina"
                value={disciplina}
                onChange={(e) => setDisciplina(e.target.value)}
                maxLength={100}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="escopo_pa">Escopo da PA</Label>
            <Textarea
              id="escopo_pa"
              rows={4}
              value={escopoPa}
              onChange={(e) => setEscopoPa(e.target.value)}
              maxLength={LIMITS.escopoPa}
              placeholder="Descreva o escopo do projeto..."
            />
            <CharCount value={escopoPa} limit={LIMITS.escopoPa} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="referencia">Referência</Label>
            <Textarea
              id="referencia"
              rows={3}
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
              maxLength={LIMITS.referencia}
              placeholder="Ex: Proposta com base no memorial descritivo..."
            />
            <CharCount value={referencia} limit={LIMITS.referencia} />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting
                ? "Salvando..."
                : mode === "edit"
                  ? "Salvar"
                  : "Criar projeto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
