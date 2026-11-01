import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, FolderPlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatDateBR } from "@/lib/date";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ProjetoFormDialog } from "@/components/projeto-form-dialog";

export const Route = createFileRoute("/_app/projetos/")({
  component: ProjetosPage,
});

type Projeto = {
  id: string;
  nome: string;
  codigo_projeto: string | null;
  empreendedor: string | null;
  cidade_uf: string | null;
  disciplina: string | null;
  criado_em: string;
};

function ProjetosPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [loading, setLoading] = useState(true);
  const [openNew, setOpenNew] = useState(false);
  const [deleteProjeto, setDeleteProjeto] = useState<Projeto | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleConfirmDelete = async () => {
    if (!deleteProjeto) return;
    setDeleting(true);
    const { error } = await supabase
      .from("projetos")
      .delete()
      .eq("id", deleteProjeto.id);
    setDeleting(false);
    if (error) {
      toast.error("Erro ao excluir projeto", { description: error.message });
      return;
    }
    toast.success("Projeto excluído com sucesso");
    setProjetos((prev) => prev.filter((x) => x.id !== deleteProjeto.id));
    setDeleteProjeto(null);
  };

  const fetchProjetos = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("projetos")
      .select("id, nome, codigo_projeto, empreendedor, cidade_uf, disciplina, criado_em")
      .order("criado_em", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar projetos", { description: error.message });
    } else {
      setProjetos((data ?? []) as Projeto[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProjetos();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Projetos</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie os projetos de obra e suas rodadas de cotação
          </p>
        </div>
        <Button onClick={() => setOpenNew(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Projeto
        </Button>
      </div>

      {loading ? (
        <Card className="p-12 text-center text-sm text-muted-foreground">
          Carregando...
        </Card>
      ) : projetos.length === 0 ? (
        <Card className="p-12 flex flex-col items-center justify-center text-center space-y-4">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
            <FolderPlus className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Nenhum projeto ainda</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Comece criando seu primeiro projeto de cotação.
            </p>
          </div>
          <Button onClick={() => setOpenNew(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Criar primeiro projeto
          </Button>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Código</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Empreendedor</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead>Disciplina</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projetos.map((p) => (
                <TableRow
                  key={p.id}
                  className="cursor-pointer"
                  onClick={() =>
                    navigate({ to: "/projetos/$id", params: { id: p.id } })
                  }
                >
                  <TableCell className="font-mono font-bold text-sm">
                    {p.codigo_projeto ?? "—"}
                  </TableCell>
                  <TableCell className="font-medium">{p.nome}</TableCell>
                  <TableCell>{p.empreendedor ?? "—"}</TableCell>
                  <TableCell>{p.cidade_uf ?? "—"}</TableCell>
                  <TableCell>{p.disciplina ?? "—"}</TableCell>
                  <TableCell>
                    {formatDateBR(p.criado_em)}
                  </TableCell>
                  <TableCell
                    className="text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteProjeto(p);
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <ProjetoFormDialog
        open={openNew}
        onOpenChange={setOpenNew}
        userId={user?.id ?? null}
        mode="create"
        onSaved={fetchProjetos}
      />

      <AlertDialog
        open={!!deleteProjeto}
        onOpenChange={(v) => {
          if (!v && !deleting) setDeleteProjeto(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir projeto</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o projeto "{deleteProjeto?.nome}"?
              Esta ação é permanente e remove TODAS as cotações, empresas,
              itens, questionamentos e respostas associadas. Esta ação não pode
              ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                handleConfirmDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Excluindo..." : "Sim, excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
