import { Produto, Categoria, TipoMargem } from '../types';

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
  let precoVendaFinal: number;
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

/**
 * Sanitizes product update data to avoid "column not found" errors in Supabase.
 * Only includes fields that are defined and potentially exist in the schema.
 * Applies fallbacks for optional fields.
 */
export const sanitizeProductUpdate = (productData: Partial<Produto>) => {
  // Core fields that are expected to always exist
  const coreFields = [
    'id',
    'user_id',
    'nome',
    'categoria_id',
    'rendimento_unidades',
    'tempo_producao_valor',
    'tempo_producao_unidade',
    'margem_percentual',
    'usar_preco_manual',
    'preco_venda_manual',
    'margem_tipo',
    'usar_margem_categoria',
    'preco_venda_final',
    'margem_real_calculada',
    'peso_final_produto',
    'modo_preparo',
    'imagem_url',
    'ativo'
  ];

  // Optional fields that might not exist in some schemas
  const optionalFields = [
    'custo_unitario_snapshot',
    'custo_hora_trabalho',
    'custo_mao_obra',
    'custo_fixo_rateado',
    'custo_total',
    'custo_unitario',
    'custo_total_calculado',
    'custo_embalagem',
    'taxa_venda_percentual',
    'imposto_percentual'
  ];

  const sanitized: Record<string, unknown> = {};

  // Apply fallbacks to the input data if needed
  const dataWithFallbacks = { ...productData } as Record<string, unknown>;
  
  if (dataWithFallbacks.imagem_url === '') {
    dataWithFallbacks.imagem_url = null;
  }
  
  // Add core fields if they are defined
  coreFields.forEach(field => {
    if (dataWithFallbacks[field] !== undefined) {
      sanitized[field] = dataWithFallbacks[field];
    }
  });

  // Add optional fields only if they are defined
  optionalFields.forEach(field => {
    if (dataWithFallbacks[field] !== undefined) {
      sanitized[field] = dataWithFallbacks[field];
    }
  });

  return sanitized;
};

export const validateProductIntegrity = (product: Partial<Produto>): string[] => {
  const errors: string[] = [];

  if (!product.categoria_id) {
    errors.push("Categoria não definida");
  }

  if ((product.margem_real_calculada ?? 0) <= 0) {
    errors.push("Margem de lucro negativa ou zero");
  }

  if (!product.ingredientes || product.ingredientes.length === 0) {
    errors.push("Ficha técnica vazia");
  }

  if (Number(product.rendimento_unidades ?? 0) <= 0) {
    errors.push("Rendimento não configurado");
  }

  return errors;
};
