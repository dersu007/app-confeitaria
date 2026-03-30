import { Ingrediente, Produto, ProdutoIngrediente, Categoria, TipoMargem } from '../types';

/**
 * Business logic for bakery calculations
 */

export const convertToStandardUnit = (value: number, unit: string): number => {
  const u = unit?.toLowerCase();
  const v = Number(value) || 0;
  
  switch (u) {
    case 'kg':
    case 'l':
      return v * 1000;
    case 'g':
    case 'ml':
    case 'un':
    default:
      return v;
  }
};

export const calculateIngredientUnitPrice = (precoEmbalagem: number, pesoEmbalagem: number, unidade: string): number => {
  const pEmbalagem = Number(precoEmbalagem) || 0;
  const pPeso = Number(pesoEmbalagem) || 0;
  
  if (pPeso <= 0) return 0; // Proteção contra divisão por zero
  
  const pesoPadrao = convertToStandardUnit(pPeso, unidade);
  if (pesoPadrao <= 0) return 0; // Proteção contra divisão por zero após conversão
  
  const result = pEmbalagem / pesoPadrao;
  return isNaN(result) || !isFinite(result) ? 0 : Math.round((result + Number.EPSILON) * 10000) / 10000; // 4 decimal places for unit price
};

export const calculateRecipeIngredientCost = (quantidade: number, unidade: string, precoUnidadeBase: number | null | undefined): number => {
  const pUnidadeBase = Number(precoUnidadeBase) || 0;
  if (pUnidadeBase <= 0) return 0;
  
  const qtd = Number(quantidade) || 0;
  const qtdPadrao = convertToStandardUnit(qtd, unidade);
  
  const result = qtdPadrao * pUnidadeBase;
  return isNaN(result) ? 0 : Math.round((result + Number.EPSILON) * 100) / 100;
};

export const resolveProductMargin = (produto: Partial<Produto>, categoria?: Categoria) => {
  if (produto.usar_margem_categoria && categoria) {
    return {
      margem: categoria.margem_padrao,
      tipo: categoria.tipo_margem
    };
  }
  return {
    margem: produto.margem_percentual || 0,
    tipo: produto.margem_tipo || 'markup'
  };
};

export const calculateProductPricing = (
  custoProducao: number,
  margemPercentual: number,
  tipoMargem: TipoMargem,
  usarPrecoManual: boolean,
  precoVendaManual: number,
  custoEmbalagem: number = 0,
  taxaVendaPercentual: number = 0,
  impostoPercentual: number = 0
) => {
  let precoVendaFinal = 0;
  const custoTotalBase = custoProducao + custoEmbalagem;
  const taxasImpostosTotal = taxaVendaPercentual + impostoPercentual;

  if (!usarPrecoManual) {
    if (tipoMargem === 'markup') {
      // Markup simples sobre o custo total (produção + embalagem)
      precoVendaFinal = custoTotalBase * (1 + margemPercentual / 100);
    } else {
      // Margem Real desejada (Profit Margin)
      // Preço = Custo / (1 - (Margem % + Taxas % + Impostos %))
      const divisor = 1 - (margemPercentual + taxasImpostosTotal) / 100;
      if (divisor <= 0.05) { // Proteção contra divisão por zero ou margens impossíveis
        precoVendaFinal = custoTotalBase * 5; 
      } else {
        precoVendaFinal = custoTotalBase / divisor;
      }
    }
  } else {
    precoVendaFinal = precoVendaManual;
  }

  // Rounding final price
  precoVendaFinal = Math.round((precoVendaFinal + Number.EPSILON) * 100) / 100;

  let margemRealCalculada = 0;
  if (precoVendaFinal > 0) {
    // Margem Real % = ((Preço Venda - (Custo Produção + Custo Embalagem) - (Preço Venda * (Taxas + Impostos) / 100)) / Preço Venda) * 100
    const deducaoTaxas = precoVendaFinal * (taxasImpostosTotal / 100);
    margemRealCalculada = ((precoVendaFinal - custoTotalBase - deducaoTaxas) / precoVendaFinal) * 100;
    margemRealCalculada = Math.round((margemRealCalculada + Number.EPSILON) * 100) / 100;
  }

  return {
    precoVendaFinal,
    margemRealCalculada
  };
};

export const recalculateProduct = async (productId: string, supabase: any) => {
  try {
    // 1. Buscar produto e sua categoria
    const { data: product, error: pErr } = await supabase
      .from('produtos')
      .select('*, categoria:categorias!categoria_id(*)')
      .eq('id', productId)
      .maybeSingle();
      
    if (pErr || !product) {
      console.error('Erro ao buscar produto para recálculo:', pErr);
      return null;
    }

    // 2. Buscar produto_ingredientes (itens da receita)
    const { data: recipeItems, error: rErr } = await supabase
      .from('produto_ingredientes')
      .select('*, ingrediente:ingredientes!ingrediente_id(*)')
      .eq('produto_id', productId);
      
    if (rErr || !recipeItems) {
      console.error('Erro ao buscar ingredientes do produto para recálculo:', rErr);
      return null;
    }

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
          updatedRecipeItems.push({ id: item.id, custo_calculado: itemCost });
        }
      }
    }

    if (isNaN(totalCost)) totalCost = 0;
    totalCost = Math.round((totalCost + Number.EPSILON) * 100) / 100;

    // Atualizar itens da receita no banco
    if (updatedRecipeItems.length > 0) {
      for (const item of updatedRecipeItems) {
        await supabase.from('produto_ingredientes').update({ custo_calculado: item.custo_calculado }).eq('id', item.id);
      }
    }

    // 4. Calcular custo_unitario (usando rendimento_unidades)
    const unitCost = calculateUnitCost(totalCost, product.rendimento_unidades);

    // 5. Calcular preco_venda_final e margem_real_calculada
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

    // 6. Atualizar produto com os novos valores calculados
    const { data: updatedProduct, error: uErr } = await supabase.from('produtos').update({
      custo_total_calculado: totalCost,
      custo_unitario_snapshot: unitCost,
      preco_venda_final: precoVendaFinal,
      margem_real_calculada: margemRealCalculada
    }).eq('id', productId).select().single();

    if (uErr) {
      console.error('Erro ao atualizar produto após recálculo:', uErr);
    }

    return updatedProduct;
  } catch (err) {
    console.error('Erro inesperado no recálculo do produto:', err);
    return null;
  }
};

export const recalculateAllProducts = async (supabase: any) => {
  const { data: products } = await supabase.from('produtos').select('id');
  if (!products) return;

  for (const p of products) {
    await recalculateProduct(p.id, supabase);
  }
};

export const recalculateProductsUsingIngredient = async (ingredientId: string, supabase: any) => {
  const { data: recipeItems } = await supabase
    .from('produto_ingredientes')
    .select('produto_id')
    .eq('ingrediente_id', ingredientId);
    
  if (!recipeItems) return;

  // Unique product IDs
  const productIds = Array.from(new Set(recipeItems.map((item: any) => item.produto_id)));
  
  for (const productId of productIds) {
    await recalculateProduct(productId as string, supabase);
  }
};

export const calculateUnitCost = (custoTotal: number | undefined | null, rendimento: number | undefined | null): number => {
  const c = Number(custoTotal) || 0;
  const r = Number(rendimento) || 1;
  if (r <= 0) return 0; // Proteção contra divisão por zero
  const result = c / r;
  return isNaN(result) || !isFinite(result) ? 0 : result;
};

export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};
