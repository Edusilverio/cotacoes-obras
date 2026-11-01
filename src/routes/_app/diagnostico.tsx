import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  getLog,
  clearLog,
  subscribeLog,
  type LogEntry,
} from "@/lib/error-log";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_app/diagnostico")({
  component: DiagnosticoPage,
});

const tipoVariant: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  Upload: "destructive",
  Tela: "destructive",
  JS: "destructive",
  Dados: "secondary",
  Info: "outline",
};

function DiagnosticoPage() {
  const [entries, setEntries] = useState<LogEntry[]>([]);

  useEffect(() => {
    setEntries(getLog());
    return subscribeLog(() => setEntries(getLog()));
  }, []);

  const copiar = async () => {
    const txt =
      entries
        .map(
          (e) =>
            `[${new Date(e.at).toLocaleString("pt-BR")}] (${e.tipo}) ${e.mensagem}${
              e.detalhe ? "\n    " + e.detalhe.replace(/\n/g, "\n    ") : ""
            }`,
        )
        .join("\n") || "(vazio)";
    try {
      await navigator.clipboard.writeText(txt);
      toast.success("Log copiado para a área de transferência.");
    } catch {
      toast.error("Não foi possível copiar automaticamente.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Diagnóstico</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Registro dos últimos erros e eventos deste navegador — o que falhou
            e por quê (upload recusado, tela que não carregou, dados que não
            vieram). Use o botão "Copiar tudo" para enviar ao suporte.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={copiar}
            disabled={entries.length === 0}
          >
            Copiar tudo
          </Button>
          <Button
            variant="outline"
            onClick={() => clearLog()}
            disabled={entries.length === 0}
          >
            Limpar
          </Button>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-lg border bg-muted/30 px-6 py-16 text-center text-sm text-muted-foreground">
          Nenhum erro registrado ainda. Quando algo falhar (um upload recusado,
          uma tela que não carregou, etc.), o motivo aparece aqui.
        </div>
      ) : (
        <div className="rounded-lg border divide-y">
          {entries.map((e) => (
            <div key={e.id} className="px-4 py-3 space-y-1">
              <div className="flex items-center gap-2 text-xs">
                <Badge variant={tipoVariant[e.tipo] ?? "outline"}>
                  {e.tipo}
                </Badge>
                <span className="text-muted-foreground">
                  {new Date(e.at).toLocaleString("pt-BR")}
                </span>
              </div>
              <p className="text-sm">{e.mensagem}</p>
              {e.detalhe && (
                <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-words bg-muted/40 rounded p-2 max-h-40 overflow-auto">
                  {e.detalhe}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
