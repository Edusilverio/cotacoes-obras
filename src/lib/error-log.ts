// Registro leve de erros/eventos do lado do cliente, persistido em localStorage,
// para alimentar a página de Diagnóstico. Ajuda o usuário e o suporte a entender
// o QUE falhou e POR QUÊ (upload recusado, tela que não carregou, dados que não vieram).

export type LogTipo = "Upload" | "Tela" | "Dados" | "JS" | "Info";

export interface LogEntry {
  id: string;
  at: number; // epoch ms
  tipo: LogTipo;
  mensagem: string;
  detalhe?: string;
}

const KEY = "nexo_error_log";
const MAX = 80;

type Listener = () => void;
const listeners = new Set<Listener>();

function hasStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function read(): LogEntry[] {
  if (!hasStorage()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const arr = raw ? (JSON.parse(raw) as LogEntry[]) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function write(list: LogEntry[]) {
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX)));
  } catch {
    // storage cheio ou indisponível — ignora
  }
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      /* noop */
    }
  });
}

function short(s: unknown, max = 1500): string | undefined {
  if (s == null) return undefined;
  const str = typeof s === "string" ? s : String(s);
  return str.length > max ? str.slice(0, max) + "…" : str;
}

export function logEvent(
  tipo: LogTipo,
  mensagem: unknown,
  detalhe?: unknown,
): void {
  if (!hasStorage()) return;
  const list = read();
  list.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: Date.now(),
    tipo,
    mensagem: short(mensagem, 400) ?? "(sem mensagem)",
    detalhe: short(detalhe),
  });
  write(list);
}

export function getLog(): LogEntry[] {
  return read().slice().reverse(); // mais recentes primeiro
}

export function clearLog(): void {
  write([]);
}

export function subscribeLog(l: Listener): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
