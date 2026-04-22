import React, { useState, useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { productSchema, ProductFormValues } from '../../schemas/productSchema';
import { dataService } from '../../services/dataService';
import { useAuth } from '../../lib/auth';
import { Produto, Categoria, TipoMargem } from '../../types';
import { X, Plus, Package, Image, Clock, Calculator, Save, Upload, Loader2, Trash2, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCurrency, calculateProductPricing, calculateUnitCost, resolveProductMargin, validateProductIntegrity } from '../../services/bakeryService';
import { FichaTecnica } from '../FichaTecnica';
import { DEFAULT_PRODUCT_IMAGE, DEFAULT_CUSTO_HORA } from '../../constants';

interface ProductModalProps {
  produto?: Produto | null;
  onClose: () => void;
  onSave: () => void;
  onDelete?: (id: string) => Promise<void>;
}

export const ProductModal = ({ produto, onClose, onSave, onDelete }: ProductModalProps) => {
  const { user } = useAuth();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [showFichaTecnica, setShowFichaTecnica] = useState(false);
  const [custoInsumos, setCustoInsumos] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [productToEditState, setProductToEditState] = useState<Produto | null>(produto || null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      nome: produto?.nome || '',
      categoria_id: produto?.categoria_id || '',
      rendimento_unidades: produto?.rendimento_unidades || 1,
      tempo_producao_valor: produto?.tempo_producao_valor || 0,
      tempo_producao_unidade: (produto?.tempo_producao_unidade as 'horas' | 'minutos') || 'horas',
      usar_margem_categoria: produto?.usar_margem_categoria ?? true,
      margem_percentual: produto?.margem_percentual || 0,
      margem_tipo: (produto?.margem_tipo as TipoMargem) || 'margem_real',
      usar_preco_manual: produto?.usar_preco_manual || false,
      preco_venda_manual: produto?.preco_venda_manual || 0,
      custo_embalagem: produto?.custo_embalagem || 0,
      taxa_venda_percentual: produto?.taxa_venda_percentual || 0,
      imposto_percentual: produto?.imposto_percentual || 0,
      imagem_url: produto?.imagem_url || '',
      modo_preparo: produto?.modo_preparo || '',
      ativo: produto?.ativo ?? true,
    },
  });

  const formValues = watch();

  useEffect(() => {
    fetchData();
    if (produto?.id) {
      fetchIngredientsCost();
    }
  }, [produto?.id, fetchData, fetchIngredientsCost]);

  useEffect(() => {
    if (produto) {
      reset({
        nome: produto.nome,
        categoria_id: produto.categoria_id,
        rendimento_unidades: produto.rendimento_unidades,
        tempo_producao_valor: produto.tempo_producao_valor,
        tempo_producao_unidade: produto.tempo_producao_unidade,
        usar_margem_categoria: produto.usar_margem_categoria,
        margem_percentual: produto.margem_percentual,
        margem_tipo: produto.margem_tipo,
        usar_preco_manual: produto.usar_preco_manual,
        preco_venda_manual: produto.preco_venda_manual,
        custo_embalagem: produto.custo_embalagem,
        taxa_venda_percentual: produto.taxa_venda_percentual,
        imposto_percentual: produto.imposto_percentual,
        imagem_url: produto.imagem_url,
        modo_preparo: produto.modo_preparo,
        ativo: produto.ativo,
      });
      setProductToEditState(produto);
    }
  }, [produto, reset]);

  const fetchIngredientsCost = React.useCallback(async () => {
    if (!produto?.id) return;
    try {
      const data = await dataService.getProdutoIngredientes(produto.id);
      if (data) {
        const total = data.reduce((acc, item) => acc + (item.custo_calculado || 0), 0);
        setCustoInsumos(total);
      }
    } catch (error) {
      console.error('Erro ao buscar custo de ingredientes:', error);
    }
  }, [produto?.id]);

  const fetchData = React.useCallback(async () => {
    try {
      const data = await dataService.getCategorias();
      setCategorias(data || []);
    } catch (error) {
      console.error('Erro ao buscar categorias:', error);
      setCategorias([]);
    }
  }, []);

  // Pricing calculations
  const tempoEmHoras = formValues.tempo_producao_unidade === 'minutos' 
    ? (Number(formValues.tempo_producao_valor) || 0) / 60 
    : (Number(formValues.tempo_producao_valor) || 0);
  
  // Note: We use DEFAULT_CUSTO_HORA if no product or if custo_hora_trabalho is not defined
  const currentCustoHora = productToEditState?.custo_hora_trabalho || (produto ? 0 : DEFAULT_CUSTO_HORA);
  const laborCost = tempoEmHoras * currentCustoHora;
  const fixedCost = productToEditState?.custo_fixo_rateado || 0;
  const fullTotalCost = custoInsumos + laborCost + fixedCost;
  const currentUnitCost = calculateUnitCost(fullTotalCost, formValues.rendimento_unidades || 1);
  const selectedCategoria = categorias.find(c => c.id === formValues.categoria_id);
  
  const activeMargin = resolveProductMargin(
    { 
      usar_margem_categoria: formValues.usar_margem_categoria, 
      margem_percentual: formValues.margem_percentual, 
      margem_tipo: formValues.margem_tipo 
    },
    selectedCategoria
  );

  const { precoVendaFinal, margemRealCalculada } = calculateProductPricing(
    currentUnitCost,
    activeMargin.margem,
    activeMargin.tipo,
    formValues.usar_preco_manual,
    formValues.preco_venda_manual,
    formValues.custo_embalagem,
    formValues.taxa_venda_percentual,
    formValues.imposto_percentual
  );

  const handleOpenFichaTecnica = async () => {
    if (!productToEditState?.id) {
      if (!formValues.nome) {
        toast.error('Preencha o nome para iniciar a ficha técnica');
        return;
      }
      
      const loadingToast = toast.loading('Salvando produto inicial...');
      try {
        const rawProductData = {
          user_id: user?.id,
          ...formValues,
          custo_hora_trabalho: currentCustoHora,
          custo_fixo_rateado: fixedCost,
          // Other derived fields
          custo_mao_obra: laborCost,
          custo_total: fullTotalCost,
          custo_unitario: currentUnitCost,
          preco_venda_final: precoVendaFinal,
          margem_real_calculada: margemRealCalculada,
          ativo: true
        };

        const savedProduct = await dataService.saveProduto(rawProductData as Partial<Produto>);
        if (savedProduct) {
          toast.success('Produto criado! Agora você pode adicionar ingredientes.', { id: loadingToast });
          onSave(); 
          setProductToEditState(savedProduct);
          setShowFichaTecnica(true);
        }
      } catch (error) {
        toast.error(`Erro ao criar produto: ${error instanceof Error ? error.message : 'Erro desconhecido'}`, { id: loadingToast });
      }
    } else {
      setShowFichaTecnica(true);
    }
  };

  const integrityErrors = useMemo(() => {
    if (!productToEditState) return [];
    const tempProduct = {
      ...productToEditState,
      ...formValues,
      margem_real_calculada: margemRealCalculada,
      ingredientes: productToEditState.ingredientes || []
    };
    return validateProductIntegrity(tempProduct);
  }, [productToEditState, formValues, margemRealCalculada]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const loadingToast = toast.loading('Enviando imagem...');
    setUploading(true);
    try {
      const url = await dataService.uploadImage(file, 'produtos');
      setValue('imagem_url', url);
      toast.success('Imagem enviada com sucesso!', { id: loadingToast });
    } catch (error) {
      console.error('Erro no upload:', error);
      toast.error('Erro ao enviar imagem.', { id: loadingToast });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!productToEditState?.id || !onDelete) return;
    
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    setDeleting(true);
    try {
      await onDelete(productToEditState.id);
    } catch (error) {
      console.error('Erro ao excluir no modal:', error);
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const onFormSubmit = async (data: ProductFormValues) => {
    const loadingToast = toast.loading('Salvando produto...');

    try {
      const rawProductData = {
        id: productToEditState?.id,
        user_id: productToEditState?.user_id || user?.id,
        ...data,
        custo_hora_trabalho: currentCustoHora,
        custo_mao_obra: laborCost,
        custo_fixo_rateado: fixedCost,
        custo_total: fullTotalCost,
        custo_unitario: currentUnitCost,
        preco_venda_final: precoVendaFinal,
        margem_real_calculada: margemRealCalculada,
      };

      const savedProduct = await dataService.saveProduto(rawProductData as Partial<Produto>);
      
      if (!savedProduct) throw new Error("Erro ao salvar produto");

      await dataService.recalculateProduct(savedProduct.id);

      toast.success('Produto salvo com sucesso!', { id: loadingToast });
      onSave();
    } catch (error) {
      console.error('Erro ao salvar produto:', error);
      toast.error(`Erro ao salvar: ${error instanceof Error ? error.message : 'Erro desconhecido'}`, { id: loadingToast });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface-container-lowest w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden border border-surface-container-high flex flex-col animate-in fade-in zoom-in duration-200">
        <div className="p-6 border-b border-surface-container-high flex justify-between items-center bg-surface-container-low/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-container/30 rounded-xl text-primary">
              <Package size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-on-surface flex items-center gap-2">
                {produto ? 'Editar Produto' : 'Novo Produto'}
                {integrityErrors.length > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-error/10 text-error text-[8px] font-bold uppercase tracking-widest rounded-full border border-error/20">
                    <AlertTriangle size={10} />
                    Incompleto
                  </span>
                )}
              </h2>
              <p className="text-xs text-on-surface-variant">Configure as informações e precificação do produto.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface-container-high rounded-full transition-all">
            <X size={20} className="text-on-surface-variant" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onFormSubmit)} className="flex-grow overflow-y-auto p-6 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Left Column: Basic Info */}
            <div className="space-y-6">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Nome do Produto</label>
                <input 
                  {...register('nome')}
                  placeholder="Ex: Pão Italiano"
                  className={`w-full px-4 py-2.5 bg-surface-container-low border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20 ${errors.nome ? 'ring-2 ring-error' : ''}`}
                />
                {errors.nome && <p className="text-xs text-error mt-1">{errors.nome.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Categoria</label>
                  <select 
                    {...register('categoria_id')}
                    className={`w-full px-4 py-2.5 bg-surface-container-low border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20 ${errors.categoria_id ? 'ring-2 ring-error' : ''}`}
                  >
                    <option value="">Selecione uma categoria</option>
                    {categorias.map(c => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                  {errors.categoria_id && <p className="text-xs text-error mt-1">{errors.categoria_id.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest flex items-center gap-1.5">
                    <Clock size={12} /> Tempo Produção
                  </label>
                  <div className="flex gap-2">
                    <input 
                      type="number"
                      step="any"
                      {...register('tempo_producao_valor', { valueAsNumber: true })}
                      placeholder="0"
                      className={`w-full px-4 py-2.5 bg-surface-container-low border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20 ${errors.tempo_producao_valor ? 'ring-2 ring-error' : ''}`}
                    />
                    <select
                      {...register('tempo_producao_unidade')}
                      className="w-32 px-2 py-2.5 bg-surface-container-low border-none rounded-xl text-xs focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="horas">Horas</option>
                      <option value="minutos">Minutos</option>
                    </select>
                  </div>
                  {errors.tempo_producao_valor && <p className="text-xs text-error mt-1">{errors.tempo_producao_valor.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest flex items-center gap-1.5">
                    <Package size={12} /> Rendimento (un)
                  </label>
                  <input 
                    type="number"
                    {...register('rendimento_unidades', { valueAsNumber: true })}
                    className={`w-full px-4 py-2.5 bg-surface-container-low border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20 ${errors.rendimento_unidades ? 'ring-2 ring-error' : ''}`}
                  />
                  {errors.rendimento_unidades && <p className="text-xs text-error mt-1">{errors.rendimento_unidades.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest flex items-center gap-1.5">
                    <Package size={12} /> Custo Embalagem (R$)
                  </label>
                  <input 
                    type="number"
                    step="0.01"
                    {...register('custo_embalagem', { valueAsNumber: true })}
                    className="w-full px-4 py-2.5 bg-surface-container-low border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20"
                  />
                  {errors.custo_embalagem && <p className="text-xs text-error mt-1">{errors.custo_embalagem.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest flex items-center gap-1.5">
                    <Calculator size={12} /> Taxas (%)
                  </label>
                  <input 
                    type="number"
                    step="0.1"
                    {...register('taxa_venda_percentual', { valueAsNumber: true })}
                    className="w-full px-4 py-2.5 bg-surface-container-low border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20"
                  />
                  {errors.taxa_venda_percentual && <p className="text-xs text-error mt-1">{errors.taxa_venda_percentual.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest flex items-center gap-1.5">
                    <Calculator size={12} /> Impostos (%)
                  </label>
                  <input 
                    type="number"
                    step="0.1"
                    {...register('imposto_percentual', { valueAsNumber: true })}
                    className="w-full px-4 py-2.5 bg-surface-container-low border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20"
                  />
                  {errors.imposto_percentual && <p className="text-xs text-error mt-1">{errors.imposto_percentual.message}</p>}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest flex items-center gap-1.5">
                  <Image size={12} /> Imagem do Produto
                </label>
                <div className="flex gap-2">
                  <input 
                    type="text"
                    {...register('imagem_url')}
                    placeholder="URL da imagem ou faça upload..."
                    className={`flex-grow px-4 py-2.5 bg-surface-container-low border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20 ${errors.imagem_url ? 'ring-2 ring-error' : ''}`}
                  />
                  <label className="cursor-pointer p-2.5 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition-all flex items-center justify-center min-w-[44px]">
                    {uploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleImageUpload}
                      disabled={uploading}
                    />
                  </label>
                </div>
                {errors.imagem_url && <p className="text-xs text-error mt-1">{errors.imagem_url.message}</p>}
                {formValues.imagem_url && (
                  <div className="mt-2 aspect-video w-full rounded-xl overflow-hidden border border-surface-container-high relative group">
                    <img 
                      src={formValues.imagem_url || DEFAULT_PRODUCT_IMAGE} 
                      alt="Preview" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = DEFAULT_PRODUCT_IMAGE;
                      }}
                    />
                    <button 
                      type="button"
                      onClick={() => setValue('imagem_url', '')}
                      className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Modo de Preparo</label>
                <textarea 
                  rows={4}
                  {...register('modo_preparo')}
                  placeholder="Descreva o passo a passo da produção..."
                  className="w-full px-4 py-2.5 bg-surface-container-low border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20 resize-none"
                />
              </div>

              <div className={`p-4 rounded-2xl border transition-all ${(!productToEditState?.ingredientes || productToEditState.ingredientes.length === 0) ? 'bg-error/5 border-error/20' : 'bg-surface-container-low/50 border-surface-container-high'}`}>
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest flex items-center gap-1.5">
                    Ficha Técnica (Ingredientes)
                    {(!productToEditState?.ingredientes || productToEditState.ingredientes.length === 0) && (
                      <span className="text-error"><AlertTriangle size={12} /></span>
                    )}
                  </h4>
                  <button 
                    type="button"
                    onClick={handleOpenFichaTecnica}
                    className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1"
                  >
                    <Plus size={12} /> {productToEditState?.id ? 'Editar Ingredientes' : 'Salvar e Adicionar Ingredientes'}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[10px] text-on-surface-variant block">Custo Total Insumos</span>
                    <span className="text-sm font-bold text-on-surface">{formatCurrency(custoInsumos)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-on-surface-variant block">Custo Unitário</span>
                    <span className="text-sm font-bold text-primary">{formatCurrency(currentUnitCost)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Pricing Logic */}
            <div className="space-y-6">
              <div className="bg-surface-container-low p-6 rounded-3xl border border-surface-container-high space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
                    <Calculator size={16} className="text-primary" /> Lógica de Preço
                  </h3>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-on-surface-variant uppercase">Manual</span>
                      <Controller
                        name="usar_preco_manual"
                        control={control}
                        render={({ field }) => (
                           <button 
                            type="button"
                            onClick={() => {
                              if (!field.value && formValues.preco_venda_manual === 0) {
                                setValue('preco_venda_manual', precoVendaFinal);
                              }
                              field.onChange(!field.value);
                            }}
                            className={`w-10 h-5 rounded-full relative transition-all ${field.value ? 'bg-primary' : 'bg-surface-container-highest'}`}
                          >
                            <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${field.value ? 'left-6' : 'left-1'}`}></div>
                          </button>
                        )}
                      />
                    </div>
                    {!formValues.usar_preco_manual && (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-on-surface-variant uppercase">Margem Categoria</span>
                        <Controller
                          name="usar_margem_categoria"
                          control={control}
                          render={({ field }) => (
                            <button 
                              type="button"
                              onClick={() => field.onChange(!field.value)}
                              className={`w-10 h-5 rounded-full relative transition-all ${field.value ? 'bg-primary' : 'bg-surface-container-highest'}`}
                            >
                              <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${field.value ? 'left-6' : 'left-1'}`}></div>
                            </button>
                          )}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {formValues.usar_preco_manual ? (
                  <div className="space-y-4 animate-in fade-in duration-300">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Preço de Venda Manual</label>
                      <input 
                        type="number"
                        step="0.01"
                        {...register('preco_venda_manual', { valueAsNumber: true })}
                        className={`w-full px-4 py-2.5 bg-surface-container-lowest border-none rounded-xl text-lg font-bold text-primary focus:ring-2 focus:ring-primary/20 ${errors.preco_venda_manual ? 'ring-2 ring-error' : ''}`}
                      />
                      {errors.preco_venda_manual && <p className="text-xs text-error mt-1">{errors.preco_venda_manual.message}</p>}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 animate-in fade-in duration-300">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Tipo de Margem</label>
                        <select 
                          disabled={formValues.usar_margem_categoria}
                          {...register('margem_tipo')}
                          className={`w-full px-4 py-2.5 bg-surface-container-lowest border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20 ${formValues.usar_margem_categoria ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                          <option value="markup">Markup</option>
                          <option value="margem_real">Margem Real</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Margem (%)</label>
                        <input 
                          disabled={formValues.usar_margem_categoria}
                          type="number"
                          step="any"
                          {...register('margem_percentual', { valueAsNumber: true })}
                          className={`w-full px-4 py-2.5 bg-surface-container-lowest border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20 ${formValues.usar_margem_categoria ? 'opacity-60 cursor-not-allowed' : ''}`}
                        />
                      </div>
                    </div>
                    {formValues.usar_margem_categoria && selectedCategoria && (
                      <p className="text-[10px] text-primary italic">
                        Usando margem padrão da categoria "{selectedCategoria.nome}"
                      </p>
                    )}
                  </div>
                )}

                <div className="pt-6 border-t border-surface-container-high flex justify-between items-end">
                  <div>
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest block">Margem Real Calculada</span>
                      {margemRealCalculada <= 0 && <AlertTriangle size={12} className="text-error" />}
                    </div>
                    <span className={`text-xl font-bold ${margemRealCalculada >= 40 ? 'text-primary' : 'text-error'}`}>
                      {margemRealCalculada.toFixed(1)}%
                    </span>
                    {margemRealCalculada <= 0 && (
                      <p className="text-[9px] text-error font-bold mt-1">⚠️ Prejuízo detectado!</p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest block mb-1">Preço Final</span>
                    <span className="text-3xl font-black text-primary">
                      {formatCurrency(precoVendaFinal)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>

        <div className="p-6 border-t border-surface-container-high bg-surface-container-low/50 flex justify-between items-center gap-3">
          <div>
            {productToEditState?.id && onDelete && (
              <div className="flex items-center gap-2">
                {confirmDelete ? (
                  <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-200">
                    <button 
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="px-4 py-2 bg-surface-container-high text-on-surface text-xs font-bold rounded-xl hover:bg-surface-container-highest transition-all"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="button"
                      onClick={handleDelete}
                      disabled={deleting}
                      className={`flex items-center gap-2 px-6 py-3 bg-error text-white font-bold rounded-2xl hover:bg-error/90 transition-all shadow-lg shadow-error/20 ${deleting ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {deleting ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                      {deleting ? 'Excluindo...' : 'Confirmar Exclusão'}
                    </button>
                  </div>
                ) : (
                  <button 
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="flex items-center gap-2 px-6 py-3 bg-error/10 text-error font-bold rounded-2xl hover:bg-error/20 transition-all border border-error/20"
                  >
                    <Trash2 size={18} /> Excluir Produto
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <button 
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-8 py-3 bg-surface-container-high text-on-surface font-bold rounded-2xl hover:bg-surface-container-highest transition-all disabled:opacity-50"
            >
              Cancelar
            </button>
            <button 
              disabled={isSubmitting}
              onClick={handleSubmit(onFormSubmit)}
              className="flex items-center gap-2 px-12 py-3 bg-primary text-white font-bold rounded-2xl hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              Salvar Produto
            </button>
          </div>
        </div>
      </div>

      {showFichaTecnica && productToEditState && (
        <FichaTecnica 
          product={{
            ...productToEditState,
            ...formValues,
            margem_percentual: formValues.margem_percentual,
            margem_tipo: formValues.margem_tipo as TipoMargem,
            usar_preco_manual: formValues.usar_preco_manual,
            preco_venda_manual: formValues.preco_venda_manual,
            rendimento_unidades: formValues.rendimento_unidades || 1
          }}
          onClose={() => setShowFichaTecnica(false)}
          onUpdate={() => {
            const fetchNewCost = async () => {
              try {
                const data = await dataService.getProdutoById(productToEditState.id);
                if (data) {
                  // laborCost and fixedCost are derived from form and state
                  setCustoInsumos(data.custo_total - laborCost - fixedCost);
                }
                fetchIngredientsCost();
              } catch (error) {
                console.error('Erro ao atualizar custo após mudança na ficha técnica:', error);
              }
            };
            fetchNewCost();
          }}
        />
      )}
    </div>
  );
};
