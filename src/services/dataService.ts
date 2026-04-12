import { supabase } from '../lib/supabase';
import { cacheService } from './cacheService';
import { 
  Ingrediente, 
  Produto, 
  ProdutoIngrediente, 
  Categoria, 
  Pedido, 
  DespesaFixa,
  Cliente,
  CategoriaExtra
} from '../types';
import { 
  calculateRecipeIngredientCost,
  calculateUnitCost,
  resolveProductMargin,
  calculateProductPricing,
  sanitizeProductUpdate
} from './bakeryService';

class DataService {
  // ... existing code ...
  
  // --- Recalculation Methods ---
  async recalculateProduct(productId: string): Promise<Produto | null> {
    try {
      // 1. Buscar produto e sua categoria
      const product = await this.getProdutoById(productId);
      if (!product) return null;

      // 2. Buscar produto_ingredientes (itens da receita)
      const recipeItems = await this.getProdutoIngredientes(productId);
      if (!recipeItems) return null;

      // 3. Calcular custo_calculado de cada ingrediente e somar custo_total_calculado
      let totalCost = 0;
      const updatedRecipeItems = [];

      for (const item of recipeItems) {
        if (item.ingrediente) {
          const itemCost = calculateRecipeIngredientCost(
            item.quantidade,
            item.unidade,
            item.ingrediente.preco_por_unidade_base
          );
          totalCost += itemCost;
          
          // Atualizar custo_calculado no banco se necessário
          if (item.custo_calculado !== itemCost) {
            updatedRecipeItems.push({ id: item.id, custo_calculado: itemCost, produto_id: productId });
          }
        }
      }

      if (isNaN(totalCost)) totalCost = 0;
      totalCost = Math.round((totalCost + Number.EPSILON) * 100) / 100;

      // 4. Calcular custos de mão de obra e fixos
      const tempoProducao = Number(product.tempo_producao) || 0;
      const custoHora = Number(product.custo_hora_trabalho) || 0;
      const laborCost = tempoProducao * custoHora;
      const fixedCost = Number(product.custo_fixo_rateado) || 0;
      
      // Custo Total = Insumos + Mão de Obra + Custos Fixos
      const fullTotalCost = totalCost + laborCost + fixedCost;

      // Atualizar itens da receita no banco
      if (updatedRecipeItems.length > 0) {
        for (const item of updatedRecipeItems) {
          await this.saveProdutoIngrediente(item);
        }
      }

      // 5. Calcular custo_unitario (usando rendimento_unidades)
      const unitCost = calculateUnitCost(fullTotalCost, product.rendimento_unidades);

      // 6. Calcular preco_venda_final e margem_real_calculada
      const activeMargin = resolveProductMargin(product, (product as any).categoria);
      
      const { precoVendaFinal, margemRealCalculada } = calculateProductPricing(
        unitCost,
        activeMargin.margem,
        activeMargin.tipo,
        product.usar_preco_manual,
        product.preco_venda_manual,
        product.custo_embalagem || 0,
        product.taxa_venda_percentual || 0,
        product.imposto_percentual || 0
      );

      // 7. Atualizar produto com os novos valores calculados
      const updateData = sanitizeProductUpdate({
        id: productId,
        user_id: product.user_id,
        custo_mao_obra: laborCost,
        custo_fixo_rateado: fixedCost,
        custo_total: fullTotalCost,
        custo_unitario: unitCost,
        preco_venda_final: precoVendaFinal,
        margem_real_calculada: margemRealCalculada,
        custo_total_calculado: totalCost,
        custo_unitario_snapshot: unitCost
      });

      return await this.saveProduto(updateData);
    } catch (err) {
      console.error('Erro inesperado no recálculo do produto:', err);
      return null;
    }
  }

  async recalculateAllProducts(): Promise<void> {
    const products = await this.getProdutos();
    if (!products) return;

    for (const p of products) {
      await this.recalculateProduct(p.id);
    }
  }

  async recalculateProductsUsingIngredient(ingredientId: string): Promise<void> {
    const { data: recipeItems } = await supabase
      .from('produto_ingredientes')
      .select('produto_id')
      .eq('ingrediente_id', ingredientId);
      
    if (!recipeItems) return;

    const productIds = Array.from(new Set(recipeItems.map((item: any) => item.produto_id)));
    
    for (const productId of productIds) {
      await this.recalculateProduct(productId as string);
    }
  }
  private async getWithCache<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const cached = cacheService.getCache<T>(key);
    if (cached) return cached;

    const data = await fetcher();
    cacheService.setCache(key, data);
    return data;
  }

  // --- Ingredientes ---
  async getIngredientes(): Promise<Ingrediente[]> {
    return this.getWithCache('ingredientes', async () => {
      const { data, error } = await supabase
        .from('ingredientes')
        .select('*')
        .order('nome');
      if (error) throw error;
      return data || [];
    });
  }

  async saveIngrediente(ingrediente: Partial<Ingrediente>): Promise<Ingrediente> {
    let query;
    if (ingrediente.id) {
      query = supabase.from('ingredientes').update(ingrediente).eq('id', ingrediente.id);
    } else {
      query = supabase.from('ingredientes').insert(ingrediente);
    }

    const { data, error } = await query.select().single();
    
    if (error) throw error;
    cacheService.invalidateCache('ingredientes');
    // Also invalidate products because their costs might change
    cacheService.invalidateCache('produtos');
    return data;
  }

  async deleteIngrediente(id: string): Promise<void> {
    const { error } = await supabase.from('ingredientes').delete().eq('id', id);
    if (error) throw error;
    cacheService.invalidateCache('ingredientes');
    cacheService.invalidateCache('produtos');
  }

  // --- Produtos ---
  async getProdutos(): Promise<Produto[]> {
    return this.getWithCache('produtos', async () => {
      const { data, error } = await supabase
        .from('produtos')
        .select('*, categoria:categorias!categoria_id(*)')
        .order('nome');
      if (error) throw error;
      return data || [];
    });
  }

  async getProdutoById(id: string): Promise<Produto> {
    return this.getWithCache(`produto:${id}`, async () => {
      const { data, error } = await supabase
        .from('produtos')
        .select('*, categoria:categorias!categoria_id(*), ingredientes:produto_ingredientes(*, ingrediente:ingredientes(*))')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    });
  }

  async saveProduto(produto: Partial<Produto>): Promise<Produto> {
    const sanitized = sanitizeProductUpdate(produto);
    
    let query;
    if (sanitized.id) {
      // Use update for existing records to support partial updates
      query = supabase.from('produtos').update(sanitized).eq('id', sanitized.id);
    } else {
      // Use insert for new records
      query = supabase.from('produtos').insert(sanitized);
    }

    const { data, error } = await query.select().single();
    
    if (error) throw error;
    cacheService.invalidateCache('produtos');
    cacheService.invalidateCache(`produto:${data.id}`);
    return data;
  }

  async deleteProduto(id: string): Promise<void> {
    const { error } = await supabase.from('produtos').delete().eq('id', id);
    if (error) throw error;
    cacheService.invalidateCache('produtos');
    cacheService.invalidateCache(`produto:${id}`);
  }

  // --- Produto Ingredientes (Ficha Técnica) ---
  async getProdutoIngredientes(produtoId: string): Promise<ProdutoIngrediente[]> {
    return this.getWithCache(`produto_ingredientes:${produtoId}`, async () => {
      const { data, error } = await supabase
        .from('produto_ingredientes')
        .select('*, ingrediente:ingredientes(*)')
        .eq('produto_id', produtoId);
      if (error) throw error;
      return data || [];
    });
  }

  async saveProdutoIngrediente(item: Partial<ProdutoIngrediente>): Promise<ProdutoIngrediente> {
    let query;
    if (item.id) {
      query = supabase.from('produto_ingredientes').update(item).eq('id', item.id);
    } else {
      query = supabase.from('produto_ingredientes').insert(item);
    }

    const { data, error } = await query.select().single();
    
    if (error) throw error;
    cacheService.invalidateCache(`produto_ingredientes:${item.produto_id}`);
    cacheService.invalidateCache('produtos');
    cacheService.invalidateCache(`produto:${item.produto_id}`);
    return data;
  }

  async deleteProdutoIngrediente(id: string, produtoId: string): Promise<void> {
    const { error } = await supabase.from('produto_ingredientes').delete().eq('id', id);
    if (error) throw error;
    cacheService.invalidateCache(`produto_ingredientes:${produtoId}`);
    cacheService.invalidateCache('produtos');
    cacheService.invalidateCache(`produto:${produtoId}`);
  }

  // --- Categorias ---
  async getCategorias(): Promise<Categoria[]> {
    return this.getWithCache('categorias', async () => {
      const { data, error } = await supabase
        .from('categorias')
        .select('*')
        .order('nome');
      if (error) throw error;
      return data || [];
    });
  }

  async saveCategoria(categoria: Partial<Categoria>): Promise<Categoria> {
    let query;
    if (categoria.id) {
      query = supabase.from('categorias').update(categoria).eq('id', categoria.id);
    } else {
      query = supabase.from('categorias').insert(categoria);
    }

    const { data, error } = await query.select().single();
    
    if (error) throw error;
    cacheService.invalidateCache('categorias');
    cacheService.invalidateCache('produtos'); // Products might use category margin
    return data;
  }

  // --- Pedidos ---
  async getPedidos(): Promise<Pedido[]> {
    return this.getWithCache('pedidos', async () => {
      const { data, error } = await supabase
        .from('pedidos')
        .select(`
          *,
          cliente:clientes(*),
          itens:pedidos_itens(*, produto:produtos(*)),
          extras:pedidos_extras(*)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    });
  }

  async updatePedidoStatus(pedidoId: string, status: Pedido['status']): Promise<void> {
    const { error } = await supabase
      .from('pedidos')
      .update({ status })
      .eq('id', pedidoId);
    
    if (error) throw error;
    cacheService.invalidateCache('pedidos');
  }

  async savePedido(pedido: Partial<Pedido>): Promise<Pedido> {
    let query;
    if (pedido.id) {
      query = supabase.from('pedidos').update(pedido).eq('id', pedido.id);
    } else {
      query = supabase.from('pedidos').insert(pedido);
    }

    const { data, error } = await query.select().single();
    
    if (error) throw error;
    cacheService.invalidateCache('pedidos');
    return data;
  }

  // --- Despesas Fixas ---
  async getDespesasFixas(): Promise<DespesaFixa[]> {
    return this.getWithCache('despesas_fixas', async () => {
      const { data, error } = await supabase
        .from('despesas_fixas')
        .select('*')
        .order('descricao');
      if (error) throw error;
      return data || [];
    });
  }

  async saveDespesaFixa(despesa: Partial<DespesaFixa>): Promise<DespesaFixa> {
    let query;
    if (despesa.id) {
      query = supabase.from('despesas_fixas').update(despesa).eq('id', despesa.id);
    } else {
      query = supabase.from('despesas_fixas').insert(despesa);
    }

    const { data, error } = await query.select().single();
    
    if (error) throw error;
    cacheService.invalidateCache('despesas_fixas');
    return data;
  }

  // --- Clientes ---
  async getClientes(): Promise<Cliente[]> {
    return this.getWithCache('clientes', async () => {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .order('nome');
      if (error) throw error;
      return data || [];
    });
  }

  async saveCliente(cliente: Partial<Cliente>): Promise<Cliente> {
    let query;
    if (cliente.id) {
      query = supabase.from('clientes').update(cliente).eq('id', cliente.id);
    } else {
      query = supabase.from('clientes').insert(cliente);
    }

    const { data, error } = await query.select().single();
    
    if (error) throw error;
    cacheService.invalidateCache('clientes');
    return data;
  }

  // --- Categorias Extras ---
  async getCategoriasExtras(): Promise<CategoriaExtra[]> {
    return this.getWithCache('categorias_extras', async () => {
      const { data, error } = await supabase
        .from('categorias_extras')
        .select('*')
        .order('nome');
      if (error) throw error;
      return data || [];
    });
  }

  // --- Pedidos Itens & Extras ---
  async savePedidoItens(itens: any[]): Promise<void> {
    const { error } = await supabase.from('pedidos_itens').insert(itens);
    if (error) throw error;
    cacheService.invalidateCache('pedidos');
  }

  async savePedidoExtras(extras: any[]): Promise<void> {
    const { error } = await supabase.from('pedidos_extras').insert(extras);
    if (error) throw error;
    cacheService.invalidateCache('pedidos');
  }

  async deletePedidoItens(pedidoId: string): Promise<void> {
    const { error } = await supabase.from('pedidos_itens').delete().eq('pedido_id', pedidoId);
    if (error) throw error;
  }

  async deletePedidoExtras(pedidoId: string): Promise<void> {
    const { error } = await supabase.from('pedidos_extras').delete().eq('pedido_id', pedidoId);
    if (error) throw error;
  }

  // --- Generic Methods for DatabaseGrid ---
  async getTableData(table: string): Promise<any[]> {
    return this.getWithCache(table, async () => {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    });
  }

  async saveEntity(table: string, entity: any): Promise<any> {
    let query;
    if (entity.id) {
      query = supabase.from(table).update(entity).eq('id', entity.id);
    } else {
      query = supabase.from(table).insert(entity);
    }

    const { data, error } = await query.select().single();
    
    if (error) throw error;
    
    // Invalidate relevant caches
    cacheService.invalidateCache(table);
    if (table === 'ingredientes' || table === 'categorias' || table === 'produto_ingredientes') {
      cacheService.invalidateCache('produtos');
    }
    
    return data;
  }

  async insertEntities(table: string, entities: any[]): Promise<any[]> {
    const { data, error } = await supabase
      .from(table)
      .insert(entities)
      .select();
    
    if (error) throw error;
    
    cacheService.invalidateCache(table);
    if (table === 'ingredientes' || table === 'categorias') {
      cacheService.invalidateCache('produtos');
    }
    
    return data || [];
  }

  async deleteEntity(table: string, id: string): Promise<void> {
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) throw error;
    
    cacheService.invalidateCache(table);
    if (table === 'ingredientes' || table === 'categorias') {
      cacheService.invalidateCache('produtos');
    }
  }
}

export const dataService = new DataService();
