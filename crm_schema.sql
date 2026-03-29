-- CRM Module: Clientes and Pedidos

-- Clientes Table
CREATE TABLE IF NOT EXISTS clientes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
  nome TEXT NOT NULL,
  telefone TEXT,
  email TEXT,
  cpf_cnpj TEXT,
  data_nascimento DATE,
  endereco TEXT,
  cidade TEXT,
  estado TEXT,
  cep TEXT,
  data_cadastro TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  observacoes TEXT,
  
  -- Calculated fields (updated via trigger)
  total_pedidos INTEGER DEFAULT 0,
  valor_total_gasto NUMERIC DEFAULT 0,
  ticket_medio NUMERIC DEFAULT 0,
  ultima_compra TIMESTAMP WITH TIME ZONE,
  dias_desde_ultima_compra INTEGER DEFAULT 0,
  frequencia_compra NUMERIC DEFAULT 0, -- avg orders per month or similar
  segmento TEXT DEFAULT 'Novo', -- 'Novo', 'Frequente', 'VIP', 'Inativo'
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Pedidos Table
CREATE TABLE IF NOT EXISTS pedidos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
  cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
  data_pedido TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  valor_total NUMERIC NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'Concluído', -- 'Pendente', 'Concluído', 'Cancelado'
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage their own clients" ON clientes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own orders" ON pedidos FOR ALL USING (auth.uid() = user_id);

-- Trigger function to update client metrics
CREATE OR REPLACE FUNCTION update_cliente_metrics()
RETURNS TRIGGER AS $$
DECLARE
  v_total_pedidos INTEGER;
  v_valor_total_gasto NUMERIC;
  v_ultima_compra TIMESTAMP WITH TIME ZONE;
  v_segmento TEXT;
  v_vip_threshold NUMERIC := 500; -- Configurable threshold for VIP
BEGIN
  -- Calculate new metrics
  SELECT 
    COUNT(*), 
    SUM(valor_total), 
    MAX(data_pedido)
  INTO 
    v_total_pedidos, 
    v_valor_total_gasto, 
    v_ultima_compra
  FROM pedidos
  WHERE cliente_id = NEW.cliente_id AND status = 'Concluído';

  -- Determine Segment
  IF v_valor_total_gasto >= v_vip_threshold THEN
    v_segmento := 'VIP';
  ELSIF v_total_pedidos >= 2 AND v_total_pedidos <= 5 THEN
    v_segmento := 'Frequente';
  ELSIF v_total_pedidos > 5 THEN
    v_segmento := 'VIP'; -- Also VIP if very frequent
  ELSE
    v_segmento := 'Novo';
  END IF;

  -- Update Cliente
  UPDATE clientes
  SET 
    total_pedidos = v_total_pedidos,
    valor_total_gasto = v_valor_total_gasto,
    ticket_medio = CASE WHEN v_total_pedidos > 0 THEN v_valor_total_gasto / v_total_pedidos ELSE 0 END,
    ultima_compra = v_ultima_compra,
    segmento = v_segmento,
    dias_desde_ultima_compra = EXTRACT(DAY FROM (NOW() - v_ultima_compra))::INTEGER
  WHERE id = NEW.cliente_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create Trigger
DROP TRIGGER IF EXISTS tr_update_cliente_metrics ON pedidos;
CREATE TRIGGER tr_update_cliente_metrics
AFTER INSERT OR UPDATE ON pedidos
FOR EACH ROW
EXECUTE FUNCTION update_cliente_metrics();
