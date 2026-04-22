-- ==========================================
-- SISTEMA DE MOVIMENTAÇÃO E BAIXA DE ESTOQUE
-- Honey Sugar - Automação Supabase (PL/pgSQL)
-- ==========================================

-- 1. Criação dos TIPOS ENUM para garantir integridade de dados
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_movimentacao') THEN
        CREATE TYPE tipo_movimentacao AS ENUM ('entrada', 'saida');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'origem_movimentacao') THEN
        CREATE TYPE origem_movimentacao AS ENUM ('ajuste_manual', 'compra', 'venda_produto');
    END IF;
END $$;

-- 2. Tabela de Histórico de Movimentações
CREATE TABLE IF NOT EXISTS movimentacoes_estoque (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    insumo_id UUID NOT NULL REFERENCES ingredientes(id) ON DELETE CASCADE,
    quantidade DECIMAL(12,4) NOT NULL,
    tipo tipo_movimentacao NOT NULL,
    origem origem_movimentacao NOT NULL,
    pedido_id UUID REFERENCES pedidos(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID -- Referência ao proprietário (visto no types.ts como user_id em Produto)
);

-- Comentários para documentação de banco
COMMENT ON TABLE movimentacoes_estoque IS 'Registro histórico de todas as entradas e saídas de insumos.';
COMMENT ON COLUMN movimentacoes_estoque.insumo_id IS 'ID do ingrediente (insumo) movimentado.';
COMMENT ON COLUMN movimentacoes_estoque.quantidade IS 'Quantidade movimentada na unidade base do insumo.';

-- 3. Função para Gatilho de Baixa Automática (Pedido Concluído)
-- Esta função localiza todos os itens do pedido e suas respectivas fichas técnicas
-- para gerar registros de saída automáticos.
CREATE OR REPLACE FUNCTION fn_handle_stock_reduction_on_order_completion()
RETURNS TRIGGER AS $$
BEGIN
    -- Gatilho dispara apenas quando o status transita para 'Concluído'
    IF (NEW.status = 'Concluído' AND (OLD.status IS NULL OR OLD.status <> 'Concluído')) THEN
        
        -- Inserção das saídas baseada na explosão de materiais (Ficha Técnica)
        INSERT INTO movimentacoes_estoque (
            insumo_id, 
            quantidade, 
            tipo, 
            origem, 
            pedido_id
        )
        SELECT 
            pi.ingrediente_id,
            (pi.quantidade * pit.quantidade) as total_utilizado,
            'saida'::tipo_movimentacao,
            'venda_produto'::origem_movimentacao,
            NEW.id
        FROM pedidos_itens pit
        JOIN produto_ingredientes pi ON pi.produto_id = pit.produto_id
        WHERE pit.pedido_id = NEW.id;
        
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Criação do Trigger na tabela de Pedidos
DROP TRIGGER IF EXISTS trg_stock_reduction_on_completion ON pedidos;
CREATE TRIGGER trg_stock_reduction_on_completion
AFTER UPDATE ON pedidos
FOR EACH ROW
EXECUTE FUNCTION fn_handle_stock_reduction_on_order_completion();

-- 5. Lógica de Sincronização de Saldo em Tempo Real
-- Esta função garante que o campo 'estoque_atual' na tabela 'ingredientes'
-- permaneça sincronizado com o somatório das movimentações.
CREATE OR REPLACE FUNCTION fn_sync_ingredient_stock_balance()
RETURNS TRIGGER AS $$
BEGIN
    -- Caso de Nova Movimentação
    IF (TG_OP = 'INSERT') THEN
        UPDATE ingredientes
        SET estoque_atual = COALESCE(estoque_atual, 0) + (
            CASE WHEN NEW.tipo = 'entrada' THEN NEW.quantidade ELSE -NEW.quantidade END
        ),
        data_atualizacao = NOW()
        WHERE id = NEW.insumo_id;

    -- Caso de Exclusão de Movimentação (Estorno)
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE ingredientes
        SET estoque_atual = COALESCE(estoque_atual, 0) - (
            CASE WHEN OLD.tipo = 'entrada' THEN OLD.quantidade ELSE -OLD.quantidade END
        ),
        data_atualizacao = NOW()
        WHERE id = OLD.insumo_id;
        
    -- Caso de Atualização (Correção de Lançamento)
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Gatilho de Sincronização reativo
DROP TRIGGER IF EXISTS trg_sync_ingredient_stock ON movimentacoes_estoque;
CREATE TRIGGER trg_sync_ingredient_stock
AFTER INSERT OR UPDATE OR DELETE ON movimentacoes_estoque
FOR EACH ROW
EXECUTE FUNCTION fn_sync_ingredient_stock_balance();

-- 6. View de Auditoria de Estoque
-- Permite conferir se o estoque em tabela bate com a soma histórica das movimentações.
CREATE OR REPLACE VIEW view_estoque_auditoria AS
SELECT 
    i.id,
    i.nome,
    i.unidade_base,
    i.estoque_atual as saldo_em_tabela,
    COALESCE(SUM(CASE WHEN m.tipo = 'entrada' THEN m.quantidade ELSE -m.quantidade END), 0) as saldo_calculado_historico,
    (i.estoque_atual - COALESCE(SUM(CASE WHEN m.tipo = 'entrada' THEN m.quantidade ELSE -m.quantidade END), 0)) as discrepancia
FROM ingredientes i
LEFT JOIN movimentacoes_estoque m ON i.id = m.insumo_id
GROUP BY i.id, i.nome, i.unidade_base, i.estoque_atual;
