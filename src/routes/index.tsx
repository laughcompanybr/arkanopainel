/**
 * Execute esta instrucao no projeto: Persistir automaticamente o filtro do cliente selecionado em Comercial (por exemplo via query params) para que eu volte pela navegação e encontre a lista do mesmo cliente. 
 * 
 * Adicionar testes Playwright para garantir que eu consiga navegar entre Comercial, lista de pedidos filtrada por cliente e detalhe do pedido usando breadcrumbs, retornando corretamente sem perder o contexto. 
 * 
 * Adicionar suporte a deep-link para o detalhe do pedido garantindo que ao abrir diretamente a rota do pedido o sistema carregue o pedido correto e destaque o breadcrumb correspondente. 
 * 
 * Implementar breadcrumbs sincronizados com a URL para que ao recarregar a página eu mantenha exatamente o mesmo contexto de navegação (lista filtrada por cliente e rota do pedido).
 */
import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
    throw redirect({ to: "/auth" });
  },
  component: () => null,
});