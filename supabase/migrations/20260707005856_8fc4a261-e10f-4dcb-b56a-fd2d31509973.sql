-- 1) card_fee_percent per payment (nullable, 0-100)
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS card_fee_percent NUMERIC(6,3);

ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_card_fee_percent_check;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_card_fee_percent_check
  CHECK (card_fee_percent IS NULL OR (card_fee_percent >= 0 AND card_fee_percent <= 100));

-- 2) global default card fee percent
INSERT INTO public.app_settings(key, value, description)
VALUES ('card_fee_percent', '{"percent": 3.49}'::jsonb, 'Taxa % padrão do cartão de crédito')
ON CONFLICT (key) DO NOTHING;

-- 3) Extend tg_order_event: also log changes to key financial fields
CREATE OR REPLACE FUNCTION public.tg_order_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  changed jsonb := '{}'::jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.order_events(order_id, type, message, actor)
    VALUES (NEW.id, 'created', 'Pedido criado', NEW.created_by);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.order_events(order_id, type, message, meta, actor)
      VALUES (NEW.id, 'status_changed',
        'Status alterado para ' || NEW.status::text,
        jsonb_build_object('from', OLD.status, 'to', NEW.status),
        auth.uid());
    END IF;

    IF NEW.sale_price IS DISTINCT FROM OLD.sale_price THEN
      changed := changed || jsonb_build_object('sale_price', jsonb_build_object('from', OLD.sale_price, 'to', NEW.sale_price));
    END IF;
    IF NEW.cost_price IS DISTINCT FROM OLD.cost_price THEN
      changed := changed || jsonb_build_object('cost_price', jsonb_build_object('from', OLD.cost_price, 'to', NEW.cost_price));
    END IF;
    IF NEW.commission IS DISTINCT FROM OLD.commission THEN
      changed := changed || jsonb_build_object('commission', jsonb_build_object('from', OLD.commission, 'to', NEW.commission));
    END IF;
    IF NEW.card_fee IS DISTINCT FROM OLD.card_fee THEN
      changed := changed || jsonb_build_object('card_fee', jsonb_build_object('from', OLD.card_fee, 'to', NEW.card_fee));
    END IF;
    IF NEW.shipping IS DISTINCT FROM OLD.shipping THEN
      changed := changed || jsonb_build_object('shipping', jsonb_build_object('from', OLD.shipping, 'to', NEW.shipping));
    END IF;
    IF NEW.other_costs IS DISTINCT FROM OLD.other_costs THEN
      changed := changed || jsonb_build_object('other_costs', jsonb_build_object('from', OLD.other_costs, 'to', NEW.other_costs));
    END IF;
    IF NEW.quantity IS DISTINCT FROM OLD.quantity THEN
      changed := changed || jsonb_build_object('quantity', jsonb_build_object('from', OLD.quantity, 'to', NEW.quantity));
    END IF;

    IF changed <> '{}'::jsonb THEN
      INSERT INTO public.order_events(order_id, type, message, meta, actor)
      VALUES (NEW.id, 'values_changed', 'Valores do pedido atualizados', changed, auth.uid());
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;