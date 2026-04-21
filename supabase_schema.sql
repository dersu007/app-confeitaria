-- SQL for Supabase Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Categorias
CREATE TABLE categorias (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
  nome TEXT NOT NULL,
  margem_padrao NUMERIC DEFAULT 30,
  tipo_margem TEXT DEFAULT 'markup',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ingredientes
CREATE TABLE ingredientes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
  nome TEXT NOT NULL,
  unidade_embalagem TEXT DEFAULT 'g', -- kg, g, l, ml
  peso_embalagem NUMERIC DEFAULT 1,
  preco_embalagem NUMERIC DEFAULT 0,
  preco_por_unidade_base NUMERIC DEFAULT 0, -- Preço por g ou ml
  fornecedor TEXT,
  data_atualizacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Produtos
CREATE TABLE produtos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
  nome TEXT NOT NULL,
  categoria_id UUID REFERENCES categorias(id) ON DELETE SET NULL,
  rendimento_unidades NUMERIC DEFAULT 1,
  peso_final_produto NUMERIC DEFAULT 0,
  custo_total_calculado NUMERIC DEFAULT 0,
  margem_tipo TEXT DEFAULT 'markup',
  margem_percentual NUMERIC DEFAULT 30,
  usar_margem_categoria BOOLEAN DEFAULT TRUE,
  preco_venda_manual NUMERIC DEFAULT 0,
  usar_preco_manual BOOLEAN DEFAULT FALSE,
  preco_venda_final NUMERIC DEFAULT 0,
  margem_real_calculada NUMERIC DEFAULT 0,
  imagem_url TEXT,
  tempo_producao_valor NUMERIC DEFAULT 0,
  tempo_producao_unidade TEXT DEFAULT 'horas',
  modo_preparo TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SCRIPT DE AJUSTE DE CONSTRANGIMENTOS (Pode ser rodado no SQL Editor)
-- 1. Garantir que na tabela de produtos a exclusão seja permitida (SET NULL)
-- DO $$
-- DECLARE
--     r record;
-- BEGIN
--     FOR r IN (
--         SELECT constraint_name 
--         FROM information_schema.key_column_usage 
--         WHERE table_name = 'produtos' 
--         AND column_name = 'categoria_id'
--         AND constraint_name LIKE '%fkey%'
--     ) LOOP
--         EXECUTE 'ALTER TABLE produtos DROP CONSTRAINT ' || quote_ident(r.constraint_name);
--     END LOOP;
-- END $$;
-- ALTER TABLE produtos ADD CONSTRAINT produtos_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE SET NULL;

-- 2. Remover qualquer vínculo de categorias na tabela de ingredientes (insumos)
-- DO $$ 
-- BEGIN 
--     IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ingredientes' AND column_name='categoria_id') THEN
--         ALTER TABLE ingredientes DROP COLUMN categoria_id;
--     END IF;
-- END $$;


-- Produto_Ingredientes
CREATE TABLE produto_ingredientes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
  produto_id UUID REFERENCES produtos(id) ON DELETE CASCADE,
  ingrediente_id UUID REFERENCES ingredientes(id),
  quantidade NUMERIC DEFAULT 0,
  unidade TEXT DEFAULT 'g', -- kg, g, l, ml
  custo_calculado NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Despesas_Fixas
CREATE TABLE despesas_fixas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
  descricao TEXT NOT NULL,
  valor_mensal NUMERIC DEFAULT 0,
  categoria TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS (Row Level Security)
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE produto_ingredientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE despesas_fixas ENABLE ROW LEVEL SECURITY;

-- Create Policies (Simple ownership policies)
CREATE POLICY "Users can manage their own categories" ON categorias FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own ingredients" ON ingredientes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own products" ON produtos FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own product ingredients" ON produto_ingredientes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own fixed expenses" ON despesas_fixas FOR ALL USING (auth.uid() = user_id);

-- Initial Data
INSERT INTO categorias (nome, margem_padrao, tipo_margem) VALUES 
('Pães Artesanais', 40, 'markup'),
('Confeitaria', 50, 'margem_real'),
('Salgados', 35, 'markup');

INSERT INTO ingredientes (nome, unidade_embalagem, peso_embalagem, preco_embalagem, preco_por_unidade_base) VALUES 
('Farinha de Trigo T55', 'g', 1000, 8.50, 0.0085),
('Manteiga AOP 82%', 'g', 250, 20.00, 0.08),
('Chocolate Callebaut', 'g', 2500, 245.00, 0.098);
