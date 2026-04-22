export type UnidadeBase = 'g' | 'ml' | 'un';
export type TipoMargem = 'markup' | 'margem_real';

export interface Categoria {
  id: string;
  nome: string;
  margem_padrao: number;
  tipo_margem: TipoMargem;
}

export interface Ingrediente {
  id: string;
  nome: string;
  descricao?: string | null;
  unidade_base: UnidadeBase;
  unidade_embalagem: string;
  peso_embalagem: number;
  preco_embalagem: number;
  preco_por_unidade_base: number;
  fornecedor?: string | null;
  data_atualizacao: string;
  estoque_minimo: number;
  estoque_atual: number;
}

export interface Produto {
  id: string;
  user_id?: string;
  nome: string;
  categoria_id: string;
  rendimento_unidades: number;
  peso_final_produto: number;
  custo_total: number;
  custo_unitario: number;
  tempo_producao_valor: number;
  tempo_producao_unidade: 'horas' | 'minutos';
  custo_hora_trabalho: number;
  custo_mao_obra: number;
  custo_fixo_rateado: number;
  usar_margem_categoria: boolean;
  margem_tipo?: TipoMargem;
  margem_percentual?: number;
  preco_venda_manual: number;
  usar_preco_manual: boolean;
  preco_venda_final: number;
  margem_real_calculada: number;
  custo_embalagem?: number;
  taxa_venda_percentual?: number;
  imposto_percentual?: number;
  imagem_url?: string;
  modo_preparo?: string;
  ingredientes?: ProdutoIngrediente[];
  categoria?: Categoria;
  // Keep old names for compatibility if needed, but user said "assume it has these fields"
  custo_total_calculado?: number;
  custo_unitario_snapshot?: number;
  rateio_despesas_fixas?: number;
}

export interface ProdutoIngrediente {
  id: string;
  produto_id: string;
  ingrediente_id: string;
  quantidade: number;
  unidade: string;
  custo_calculado: number;
  ingrediente?: Ingrediente;
}

export interface DespesaFixa {
  id: string;
  descricao: string;
  valor_mensal: number;
  categoria: string;
}

export interface Cliente {
  id: string;
  nome: string;
  telefone?: string;
  email?: string;
  data_nascimento?: string;
  data_cadastro: string;
  observacoes?: string;
  total_pedidos: number;
  valor_total_gasto: number;
  ticket_medio: number;
  ultima_compra?: string;
  dias_desde_ultima_compra: number;
  frequencia_compra: number;
  status: 'VIP' | 'Frequente' | 'Novo' | 'Inativo';
}

export interface Pedido {
  id: string;
  cliente_id: string;
  data_pedido: string;
  valor_total: number;
  status: 'Em preparação' | 'Pronto' | 'Em entrega' | 'Concluído' | 'Cancelado';
  prioridade?: 'Urgente' | 'Padrão' | 'Baixa';
  tempo_estimado?: string;
  observacoes?: string;
  cliente?: Cliente;
  itens?: PedidoItem[];
  extras?: PedidoExtra[];
}

export interface PedidoItem {
  id: string;
  pedido_id: string;
  produto_id: string;
  quantidade: number;
  preco_unitario: number;
  custo_unitario: number;
  subtotal: number;
  produto?: Produto;
}

export interface PedidoExtra {
  id: string;
  pedido_id: string;
  descricao: string;
  categoria: string;
  valor: number;
}

export interface CategoriaExtra {
  id: string;
  nome: string;
}
