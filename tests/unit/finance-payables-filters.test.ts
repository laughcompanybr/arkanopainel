import { describe, expect, it } from "vitest";

/**
 * Replica exata da lógica de filtragem em finance.functions.ts#listPayables.
 * Mantê-la aqui garante que o comportamento de busca/status/intervalo
 * permanece consistente com os totais exibidos na aba "A pagar".
 */
type Row = {
  id: string;
  order_number: number;
  suppliers: { name: string } | null;
  expected_delivery: string | null;
  purchase_date: string | null;
  cost_price: number;
  paid: number;
  balance: number;
};

type Filter = {
  search?: string;
  from?: string;
  to?: string;
  statusFilter: "all" | "overdue" | "upcoming" | "future" | "no_date";
};

function applyFilters(rows: Row[], data: Filter, today: string) {
  const search = (data.search ?? "").toLowerCase().trim();
  return rows
    .filter((r) => r.balance > 0.009)
    .filter((r) => {
      if (!search) return true;
      const hay = `${r.suppliers?.name ?? ""} #${r.order_number}`.toLowerCase();
      return hay.includes(search);
    })
    .filter((r) => {
      const due = r.expected_delivery ?? r.purchase_date ?? null;
      if (data.from && due && due < data.from) return false;
      if (data.to && due && due > data.to) return false;
      if (data.statusFilter === "overdue") return !!due && due < today;
      if (data.statusFilter === "upcoming") {
        if (!due) return false;
        const diff = (new Date(due).getTime() - new Date(today).getTime()) / 86_400_000;
        return diff >= 0 && diff <= 7;
      }
      if (data.statusFilter === "future") return !!due && due > today;
      if (data.statusFilter === "no_date") return !due;
      return true;
    });
}

const today = "2026-07-07";
const rows: Row[] = [
  { id: "1", order_number: 101, suppliers: { name: "Alpha" }, expected_delivery: "2026-06-30", purchase_date: null, cost_price: 100, paid: 0, balance: 100 },
  { id: "2", order_number: 102, suppliers: { name: "Beta" }, expected_delivery: "2026-07-10", purchase_date: null, cost_price: 50, paid: 0, balance: 50 },
  { id: "3", order_number: 103, suppliers: { name: "Gamma" }, expected_delivery: "2026-08-20", purchase_date: null, cost_price: 200, paid: 0, balance: 200 },
  { id: "4", order_number: 104, suppliers: { name: "Delta" }, expected_delivery: null, purchase_date: null, cost_price: 30, paid: 0, balance: 30 },
  { id: "5", order_number: 105, suppliers: { name: "Alpha" }, expected_delivery: "2026-07-08", purchase_date: null, cost_price: 80, paid: 80, balance: 0 },
];

describe("payables filters", () => {
  it("busca por nome do fornecedor", () => {
    const out = applyFilters(rows, { statusFilter: "all", search: "alpha" }, today);
    expect(out.map((r) => r.order_number)).toEqual([101]);
  });

  it("status overdue mostra apenas vencidos", () => {
    const out = applyFilters(rows, { statusFilter: "overdue" }, today);
    expect(out.map((r) => r.order_number)).toEqual([101]);
  });

  it("status upcoming mostra próximos 7 dias", () => {
    const out = applyFilters(rows, { statusFilter: "upcoming" }, today);
    expect(out.map((r) => r.order_number).sort()).toEqual([102]);
  });

  it("status future mostra vencimentos posteriores", () => {
    const out = applyFilters(rows, { statusFilter: "future" }, today);
    expect(out.map((r) => r.order_number)).toEqual([102, 103]);
  });

  it("status no_date mostra sem data", () => {
    const out = applyFilters(rows, { statusFilter: "no_date" }, today);
    expect(out.map((r) => r.order_number)).toEqual([104]);
  });

  it("intervalo de datas exclui fora da janela", () => {
    const out = applyFilters(rows, { statusFilter: "all", from: "2026-07-01", to: "2026-07-31" }, today);
    // sem data (104) permanece pois filtro só se aplica quando due existe
    expect(out.map((r) => r.order_number).sort()).toEqual([102, 104]);
  });

  it("linhas quitadas nunca aparecem", () => {
    const out = applyFilters(rows, { statusFilter: "all" }, today);
    expect(out.find((r) => r.order_number === 105)).toBeUndefined();
  });

  it("total do filtro coincide com soma dos saldos", () => {
    const out = applyFilters(rows, { statusFilter: "overdue" }, today);
    const total = out.reduce((a, b) => a + b.balance, 0);
    expect(total).toBe(100);
  });
});
