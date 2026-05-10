export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString();
export const fmtRating = (n: number) => Number(n).toFixed(1);
export const fmtPrice = (p: string | number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(p));
