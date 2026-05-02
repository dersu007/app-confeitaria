
-- Honey Sugar V2 - Atualização de Base de Dados para Estoque e CRM
-- Execute este script no SQL Editor do seu Supabase para corrigir os problemas de estoque.

-- 1. Adicionar colunas faltantes na tabela 'ingredientes'
ALTER TABLE ingredientes ADD COLUMN IF NOT EXISTS unidade_base TEXT DEFAULT 'g';
ALTER TABLE ingredientes ADD COLUMN IF NOT EXISTS estoque_atual NUMERIC DEFAULT 0;
ALTER TABLE ingredientes ADD COLUMN IF NOT EXISTS estoque_minimo NUMERIC DEFAULT 0;
ALTER TABLE ingredientes ADD COLUMN IF NOT EXISTS estoque_minimo_unidades NUMERIC DEFAULT 0;
ALTER TABLE ingredientes ADD COLUMN IF NOT EXISTS categoria_id UUID REFERENCES categorias(id);
ALTER TABLE ingredientes ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT TRUE;

-- 2. Corrigir permissões de RLS para movimentacoes_estoque (caso a tabela já exista)
-- Garantir que a tabela movimentacoes_estoque exista
CREATE TABLE IF NOT EXISTS movimentacoes_estoque (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    insumo_id UUID NOT NULL REFERENCES ingredientes(id) ON DELETE CASCADE,
    quantidade DECIMAL(12,4) NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida')),
    origem TEXT NOT NULL CHECK (origem IN ('ajuste_manual', 'compra', 'venda_produto')),
    pedido_id UUID REFERENCES pedidos(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID DEFAULT auth.uid()
);

-- Ativar RLS
ALTER TABLE movimentacoes_estoque ENABLE ROW LEVEL SECURITY;

-- Criar política de acesso
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'movimentacoes_estoque' AND policyname = 'Users can manage their own stock movements'
    ) THEN
        CREATE POLICY "Users can manage their own stock movements" ON movimentacoes_estoque 
        FOR ALL USING (auth.uid() = user_id);
    END IF;
END $$;

-- 3. Garantir Gatilho de Sincronização de Saldo (Opcional mas Recomendado)
-- Nota: O código já tenta atualizar o saldo manualmente, mas o trigger é mais seguro.
CREATE OR REPLACE FUNCTION fn_sync_ingredient_stock_balance_v2()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE ingredientes
        SET estoque_atual = COALESCE(estoque_atual, 0) + (
            CASE WHEN NEW.tipo = 'entrada' THEN NEW.quantidade ELSE -NEW.quantidade END
        ),
        data_atualizacao = NOW()
        WHERE id = NEW.insumo_id;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE ingredientes
        SET estoque_atual = COALESCE(estoque_atual, 0) - (
            CASE WHEN OLD.tipo = 'entrada' THEN OLD.quantidade ELSE -OLD.quantidade END
        ),
        data_atualizacao = NOW()
        WHERE id = OLD.insumo_id;
    ELSIF (TG_OP = 'UPDATE') THEN
        UPDATE ingredientes
        SET estoque_atual = COALESCE(estoque_atual, 0) 
            - (CASE WHEN OLD.tipo = 'entrada' THEN OLD.quantidade ELSE -OLD.quantidade END)
            + (CASE WHEN NEW.tipo = 'entrada' THEN NEW.quantidade ELSE -NEW.quantidade END),
        data_atualizacao = NOW()
        WHERE id = NEW.insumo_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_ingredient_stock_v2 ON movimentacoes_estoque;
CREATE TRIGGER trg_sync_ingredient_stock_v2
AFTER INSERT OR UPDATE OR DELETE ON movimentacoes_estoque
FOR EACH ROW
EXECUTE FUNCTION fn_sync_ingredient_stock_balance_v2();

-- 4. Criar categoria padrão se não existir e associar ingredientes sem categoria
-- (Apenas para evitar erros de filtro)
INSERT INTO categorias (nome, margem_padrao, tipo_margem)
SELECT 'Diversos', 30, 'markup'
WHERE NOT EXISTS (SELECT 1 FROM categorias WHERE nome = 'Diversos')
RETURNING id;
