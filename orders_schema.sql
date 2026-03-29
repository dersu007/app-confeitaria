-- Orders Module: Items, Extras and Categories

-- Categorias Extras
CREATE TABLE IF NOT EXISTS categorias_extras (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
  nome TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, nome)
);

-- Pedidos Itens
CREATE TABLE IF NOT EXISTS pedidos_itens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
  pedido_id UUID REFERENCES pedidos(id) ON DELETE CASCADE,
  produto_id UUID REFERENCES produtos(id),
  quantidade NUMERIC NOT NULL DEFAULT 1,
  preco_unitario NUMERIC NOT NULL DEFAULT 0,
  custo_unitario NUMERIC NOT NULL DEFAULT 0,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Pedidos Extras
CREATE TABLE IF NOT EXISTS pedidos_extras (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
  pedido_id UUID REFERENCES pedidos(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  categoria TEXT,
  valor NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE categorias_extras ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos_extras ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage their own extra categories" ON categorias_extras FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own order items" ON pedidos_itens FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own order extras" ON pedidos_extras FOR ALL USING (auth.uid() = user_id);

-- Update status options in pedidos table (if needed, but we'll handle in app)
-- We'll add a 'prioridade' field to pedidos for the Kanban badges
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS prioridade TEXT DEFAULT 'Padrão'; -- 'Urgente', 'Padrão', 'Baixa'
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS tempo_estimado TEXT;

-- Function to update order total automatically
CREATE OR REPLACE FUNCTION update_pedido_total()
RETURNS TRIGGER AS $$
DECLARE
  v_pedido_id UUID;
  v_total_itens NUMERIC;
  v_total_extras NUMERIC;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_pedido_id := OLD.pedido_id;
  ELSE
    v_pedido_id := NEW.pedido_id;
  END IF;

  SELECT COALESCE(SUM(subtotal), 0) INTO v_total_itens FROM pedidos_itens WHERE pedido_id = v_pedido_id;
  SELECT COALESCE(SUM(valor), 0) INTO v_total_extras FROM pedidos_extras WHERE pedido_id = v_pedido_id;

  UPDATE pedidos 
  SET valor_total = v_total_itens + v_total_extras 
  WHERE id = v_pedido_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Triggers for total calculation
DROP TRIGGER IF EXISTS tr_update_total_on_item ON pedidos_itens;
CREATE TRIGGER tr_update_total_on_item
AFTER INSERT OR UPDATE OR DELETE ON pedidos_itens
FOR EACH ROW EXECUTE FUNCTION update_pedido_total();

DROP TRIGGER IF EXISTS tr_update_total_on_extra ON pedidos_extras;
CREATE TRIGGER tr_update_total_on_extra
AFTER INSERT OR UPDATE OR DELETE ON pedidos_extras
FOR EACH ROW EXECUTE FUNCTION update_pedido_total();

-- Trigger to auto-save extra categories
CREATE OR REPLACE FUNCTION auto_save_extra_category()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.categoria IS NOT NULL AND NEW.categoria != '' THEN
    INSERT INTO categorias_extras (user_id, nome)
    VALUES (NEW.user_id, NEW.categoria)
    ON CONFLICT (user_id, nome) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_auto_save_extra_category ON pedidos_extras;
CREATE TRIGGER tr_auto_save_extra_category
AFTER INSERT OR UPDATE ON pedidos_extras
FOR EACH ROW EXECUTE FUNCTION auto_save_extra_category();
