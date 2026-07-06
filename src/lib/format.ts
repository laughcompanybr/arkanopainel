const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
});

const NUM = new Intl.NumberFormat("pt-BR");

export const formatBRL = (v: number | null | undefined) => BRL.format(Number(v ?? 0));
export const formatNumber = (v: number | null | undefined) => NUM.format(Number(v ?? 0));
export const formatDate = (v: string | Date | null | undefined) => {
  if (!v) return "—";
  const d = typeof v === "string" ? new Date(v) : v;
  return d.toLocaleDateString("pt-BR");
};
