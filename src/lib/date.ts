/**
 * Camada de exibição/entrada de datas: sempre DD/MM/AAAA.
 * O banco continua com ISO (AAAA-MM-DD ou timestamp).
 */

/** Converte ISO (date-only ou timestamp) para Date local, sem shift de fuso. */
export function parseISOToLocalDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    return new Date(
      Number(dateOnly[1]),
      Number(dateOnly[2]) - 1,
      Number(dateOnly[3]),
    );
  }
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/** Exibe sempre DD/MM/AAAA. Retorna "" quando não houver data. */
export function formatDateBR(value: string | Date | null | undefined): string {
  const d = parseISOToLocalDate(value);
  if (!d) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

/** DD/MM/AAAA HH:mm */
export function formatDateTimeBR(value: string | Date | null | undefined): string {
  const d = parseISOToLocalDate(value);
  if (!d) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${formatDateBR(d)} ${hh}:${mi}`;
}

/** Converte Date local para ISO date-only (AAAA-MM-DD) para gravar no banco. */
export function toISODate(d: Date | null | undefined): string | null {
  if (!d || isNaN(d.getTime())) return null;
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Lê DD/MM/AAAA digitado e devolve Date local (ou null se inválido). */
export function parseDateBR(text: string): Date | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text.trim());
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  if (
    d.getFullYear() !== Number(yyyy) ||
    d.getMonth() !== Number(mm) - 1 ||
    d.getDate() !== Number(dd)
  ) {
    return null;
  }
  return d;
}
