
-- Clientes: endereço completo
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS zip text,
  ADD COLUMN IF NOT EXISTS district text,
  ADD COLUMN IF NOT EXISTS street text,
  ADD COLUMN IF NOT EXISTS number text,
  ADD COLUMN IF NOT EXISTS complement text,
  ADD COLUMN IF NOT EXISTS reference text;

-- Pedidos: novos campos financeiros e endereço de entrega
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS photo_path text,
  ADD COLUMN IF NOT EXISTS commission numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS card_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipping numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_costs numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ship_zip text,
  ADD COLUMN IF NOT EXISTS ship_street text,
  ADD COLUMN IF NOT EXISTS ship_number text,
  ADD COLUMN IF NOT EXISTS ship_complement text,
  ADD COLUMN IF NOT EXISTS ship_district text,
  ADD COLUMN IF NOT EXISTS ship_city text,
  ADD COLUMN IF NOT EXISTS ship_state text,
  ADD COLUMN IF NOT EXISTS ship_reference text;

-- Pagamentos: parcelas e taxa de cartão
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS installments integer,
  ADD COLUMN IF NOT EXISTS card_fee numeric NOT NULL DEFAULT 0;

-- Despesas: garante coluna category
ALTER TABLE public.expenses
  ALTER COLUMN category SET DEFAULT 'Outros';

UPDATE public.expenses SET category = 'Outros' WHERE category IS NULL;

-- Novos status de pedido
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel='partial_payment' AND enumtypid='public.order_status'::regtype) THEN
    ALTER TYPE public.order_status ADD VALUE 'partial_payment';
  END IF;
END$$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel='separating' AND enumtypid='public.order_status'::regtype) THEN
    ALTER TYPE public.order_status ADD VALUE 'separating';
  END IF;
END$$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel='shipped' AND enumtypid='public.order_status'::regtype) THEN
    ALTER TYPE public.order_status ADD VALUE 'shipped';
  END IF;
END$$;
