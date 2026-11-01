export const LIMITS = {
  nome: 120,
  contato: 120,
  email: 120,
  cidadeUf: 60,
  escopoPa: 500,
  observacoes: 1000,
  referencia: 1000,
} as const;


export function CharCount({
  value,
  limit,
  className,
}: {
  value: string;
  limit: number;
  className?: string;
}) {
  return (
    <p
      className={
        "mt-1 text-[11px] leading-none text-muted-foreground text-right " +
        (className ?? "")
      }
    >
      {value.length}/{limit}
    </p>
  );
}
