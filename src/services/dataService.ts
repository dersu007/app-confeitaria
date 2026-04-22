import { supabase } from '../lib/supabase';
import { 
  Ingrediente, 
  Produto, 
  ProdutoIngrediente, 
  Categoria, 
  Pedido, 
  PedidoItem,
  PedidoExtra,
  DespesaFixa,
  Cliente,
  CategoriaExtra,
  MovimentacaoEstoque
} from '../types';
import { 
  calculateRecipeIngredientCost,
  calculateUnitCost,
  resolveProductMargin,
  calculateProductPricing,
  sanitizeProductUpdate
} from './bakeryService';

import { DEFAULT_CUSTO_HORA } from '../constants';

class DataService {
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
      const tempoValor = Number(product.tempo_producao_valor) || 0;
      const tempoUnidade = product.tempo_producao_unidade || 'horas';
      
      // Aplicar novo padrão de custo hora se estiver zerado
      const custoHora = Number(product.custo_hora_trabalho) || DEFAULT_CUSTO_HORA;
      
      // Lógica de cálculo: (tempo_em_minutos / 60) * custo_hora
      const tempoEmMinutos = tempoUnidade === 'horas' ? tempoValor * 60 : tempoValor;
      const laborCost = (tempoEmMinutos / 60) * custoHora;
      
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
      const activeMargin = resolveProductMargin(product, product.categoria);
      
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

  async recalculateEverything(): Promise<void> {
    // 1. Recalculate all products (Costs, margins, prices)
    await this.recalculateAllProducts();

    // 2. Recalculate all client metrics (LTV, order counts, etc)
    const { data: clients, error: clientsError } = await supabase.from('clientes').select('id');
    if (clientsError) throw clientsError;

    const { data: orders, error: ordersError } = await supabase
      .from('pedidos')
      .select('cliente_id, valor_total, data_pedido')
      .eq('status', 'Concluído');
    
    if (ordersError) throw ordersError;

    interface ClienteStats {
      total_pedidos: number;
      valor_total_gasto: number;
      ultima_compra: string | null;
    }

    // Process stats in memory
    const statsMap = (clients || []).reduce((acc: Record<string, ClienteStats>, c: { id: string }) => {
      acc[c.id] = { total_pedidos: 0, valor_total_gasto: 0, ultima_compra: null };
      return acc;
    }, {});

    (orders || []).forEach((o: { cliente_id: string, valor_total: number, data_pedido: string }) => {
      if (statsMap[o.cliente_id]) {
        statsMap[o.cliente_id].total_pedidos += 1;
        statsMap[o.cliente_id].valor_total_gasto += o.valor_total;
        
        const currentData = o.data_pedido;
        if (!statsMap[o.cliente_id].ultima_compra || new Date(currentData) > new Date(statsMap[o.cliente_id].ultima_compra)) {
          statsMap[o.cliente_id].ultima_compra = currentData;
        }
      }
    });

    // Update base in batches or individually (since we have individual IDs)
    const updates = Object.entries(statsMap).map(([id, stats]) => 
      supabase.from('clientes').update(stats).eq('id', id)
    );

    await Promise.all(updates);
  }

  async recalculateProductsUsingIngredient(ingredientId: string): Promise<void> {
    const { data: recipeItems } = await supabase
      .from('produto_ingredientes')
      .select('produto_id')
      .eq('ingrediente_id', ingredientId);
      
    if (!recipeItems) return;

    const productIds = Array.from(new Set(recipeItems.map((item: { produto_id: string }) => item.produto_id)));
    
    for (const productId of productIds) {
      await this.recalculateProduct(productId as string);
    }
  }

  // --- Ingredientes ---
  async getIngredientes(): Promise<Ingrediente[]> {
    const { data, error } = await supabase
      .from('ingredientes')
      .select('*, categoria:categorias(*)')
      .order('nome');
    if (error) throw error;
    return data || [];
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
    return data;
  }

  async deleteIngrediente(id: string): Promise<void> {
    const { error } = await supabase.from('ingredientes').delete().eq('id', id);
    if (error) throw error;
  }

  // --- Produtos ---
  async getProdutos(): Promise<Produto[]> {
    const { data, error } = await supabase
      .from('produtos')
      .select('*, categoria:categorias!categoria_id(*), ingredientes:produto_ingredientes(*)')
      .order('nome');
    if (error) throw error;
    return data || [];
  }

  async duplicateProduct(productId: string): Promise<Produto> {
    try {
      // 1. Fetch original product with its technical sheet
      const original = await this.getProdutoById(productId);
      if (!original) throw new Error('Produto original não encontrado');

      // 2. Prepare new product object (removing ID and changing name)
      const { id: _id, ingredientes: _ing, categoria: _cat, ...rest } = original;
      const duplicatedProduct: Partial<Produto> = {
        ...rest,
        nome: `${original.nome} (Cópia)`,
      };

      // 3. Save the new product
      const newProduct = await this.saveProduto(duplicatedProduct);
      
      // 4. Duplicate the recipe (technical sheet)
      if (original.ingredientes && original.ingredientes.length > 0) {
        const duplicatedRecipe = original.ingredientes.map((item) => ({
          produto_id: newProduct.id,
          ingrediente_id: item.ingrediente_id,
          quantidade: item.quantidade,
          unidade: item.unidade,
          custo_calculado: item.custo_calculado
        }));
        
        await this.insertEntities('produto_ingredientes', duplicatedRecipe);
      }

      return newProduct;
    } catch (err) {
      console.error('Erro ao duplicar produto:', err);
      throw err;
    }
  }

  async getProdutoById(id: string): Promise<Produto> {
    const { data, error } = await supabase
      .from('produtos')
      .select('*, categoria:categorias!categoria_id(*), ingredientes:produto_ingredientes(*, ingrediente:ingredientes(*))')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  }

  async saveProduto(produto: Partial<Produto>): Promise<Produto> {
    const sanitized = sanitizeProductUpdate(produto);
    
    let query;
    if (sanitized.id) {
      query = supabase.from('produtos').update(sanitized).eq('id', sanitized.id);
    } else {
      query = supabase.from('produtos').insert(sanitized);
    }

    const { data, error } = await query.select().single();
    if (error) throw error;
    return data;
  }

  async deleteProduto(id: string): Promise<void> {
    // 1. Check if used in orders (pedidos_itens)
    const { data: orderItems, error: checkError } = await supabase
      .from('pedidos_itens')
      .select('id')
      .eq('produto_id', id)
      .limit(1);
    
    if (checkError) {
      console.error('Erro ao verificar dependências do produto:', checkError);
    }

    if (orderItems && orderItems.length > 0) {
      throw new Error('Este produto não pode ser excluído pois já está vinculado a um pedido existente.');
    }

    // 2. Delete ingredients (recipe) first
    const { error: ingredientsError } = await supabase
      .from('produto_ingredientes')
      .delete()
      .eq('produto_id', id);
    
    if (ingredientsError) {
      console.error('Erro ao excluir ingredientes do produto:', ingredientsError);
      throw new Error('Erro ao limpar a ficha técnica do produto.');
    }

    // 3. Delete the product
    const { error } = await supabase.from('produtos').delete().eq('id', id);
    if (error) {
      console.error('Erro ao excluir produto:', error);
      throw error;
    }
  }

  // --- Produto Ingredientes (Ficha Técnica) ---
  async getProdutoIngredientes(produtoId: string): Promise<ProdutoIngrediente[]> {
    const { data, error } = await supabase
      .from('produto_ingredientes')
      .select('*, ingrediente:ingredientes(*)')
      .eq('produto_id', produtoId);
    if (error) throw error;
    return data || [];
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
    return data;
  }

  async deleteProdutoIngrediente(id: string, _produtoId: string): Promise<void> {
    const { error } = await supabase.from('produto_ingredientes').delete().eq('id', id);
    if (error) throw error;
  }

  // --- Categorias ---
  async getCategorias(): Promise<Categoria[]> {
    const { data, error } = await supabase
      .from('categorias')
      .select('*')
      .order('nome');
    if (error) throw error;
    return data || [];
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
    return data;
  }

  // --- Pedidos ---
  async getPedidos(): Promise<Pedido[]> {
    const { data, error } = await supabase
      .from('pedidos')
      .select(`
        *,
        cliente:clientes(*),
        itens:pedidos_itens(*, produto:produtos(*, categoria:categorias!categoria_id(*))),
        extras:pedidos_extras(*)
      `)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async updatePedidoStatus(pedidoId: string, status: Pedido['status']): Promise<void> {
    const { error } = await supabase
      .from('pedidos')
      .update({ status })
      .eq('id', pedidoId);
    
    if (error) throw error;
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
    return data;
  }

  // --- Despesas Fixas ---
  async getDespesasFixas(): Promise<DespesaFixa[]> {
    const { data, error } = await supabase
      .from('despesas_fixas')
      .select('*')
      .order('descricao');
    if (error) throw error;
    return data || [];
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
    return data;
  }

  // --- Clientes ---
  async getClientes(): Promise<Cliente[]> {
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .order('nome');
    if (error) throw error;
    return data || [];
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
    return data;
  }

  async deleteCliente(id: string): Promise<void> {
    // 1. Check if has orders
    const { data: orders, error: checkError } = await supabase
      .from('pedidos')
      .select('id')
      .eq('cliente_id', id)
      .limit(1);
    
    if (checkError) {
      console.error('Erro ao verificar pedidos do cliente:', checkError);
    }

    if (orders && orders.length > 0) {
      throw new Error('Este cliente possui pedidos vinculados e não pode ser excluído para preservar o histórico financeiro.');
    }

    // 2. Delete the client
    const { error } = await supabase.from('clientes').delete().eq('id', id);
    if (error) {
      console.error('Erro ao excluir cliente:', error);
      throw error;
    }
  }

  // --- Categorias Extras ---
  async getCategoriasExtras(): Promise<CategoriaExtra[]> {
    const { data, error } = await supabase
      .from('categorias_extras')
      .select('*')
      .order('nome');
    if (error) throw error;
    return data || [];
  }

  // --- Pedidos Itens & Extras ---
  async savePedidoItens(itens: Partial<PedidoItem>[]): Promise<void> {
    const { error } = await supabase.from('pedidos_itens').insert(itens);
    if (error) throw error;
  }

  async savePedidoExtras(extras: Partial<PedidoExtra>[]): Promise<void> {
    const { error } = await supabase.from('pedidos_extras').insert(extras);
    if (error) throw error;
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
  async getTableData(table: string): Promise<Record<string, unknown>[]> {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async saveEntity(table: string, entity: Record<string, unknown>): Promise<Record<string, unknown>> {
    let query;
    if (entity.id) {
      query = supabase.from(table).update(entity).eq('id', entity.id);
    } else {
      query = supabase.from(table).insert(entity);
    }

    const { data, error } = await query.select().single();
    if (error) throw error;
    return data;
  }

  async insertEntities(table: string, entities: Record<string, unknown>[]): Promise<Record<string, unknown>[]> {
    const { data, error } = await supabase
      .from(table)
      .insert(entities)
      .select();
    
    if (error) throw error;
    return data || [];
  }

  async deleteEntity(table: string, id: string): Promise<void> {
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) {
      console.error(`[Supabase Error] Falha ao deletar de ${table}:`, error);
      throw error;
    }
  }

  // --- Estoque ---
  async getMovimentacoesEstoque(insumoId?: string): Promise<MovimentacaoEstoque[]> {
    let query = supabase
      .from('movimentacoes_estoque')
      .select('*, insumo:ingredientes(*)')
      .order('created_at', { ascending: false });

    if (insumoId) {
      query = query.eq('insumo_id', insumoId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async saveMovimentacaoEstoque(movimentacao: Partial<MovimentacaoEstoque>): Promise<MovimentacaoEstoque> {
    const { data, error } = await supabase
      .from('movimentacoes_estoque')
      .insert(movimentacao)
      .select('*, insumo:ingredientes(*)')
      .single();

    if (error) throw error;
    return data;
  }

  // --- Storage ---
  async uploadImage(file: File, path: string): Promise<string> {
    const fileExt = (file?.name || '').split('.').pop() || 'jpg';
    const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `${path}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('produtos')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from('produtos')
      .getPublicUrl(filePath);

    return data.publicUrl;
  }
}

export const dataService = new DataService();
