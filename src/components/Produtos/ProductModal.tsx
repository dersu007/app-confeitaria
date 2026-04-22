import React, { useState, useEffect, useMemo } from 'react';
import { dataService } from '../../services/dataService';
import { useAuth } from '../../lib/auth';
import { Produto, Categoria } from '../../types';
import { X, Plus, Package, Image, Clock, Calculator, Save, Weight, DollarSign, Upload, Loader2, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCurrency, calculateProductPricing, calculateUnitCost, resolveProductMargin, validateProductIntegrity } from '../../services/bakeryService';
import { FichaTecnica } from '../FichaTecnica';
import { DEFAULT_PRODUCT_IMAGE, DEFAULT_CUSTO_HORA } from '../../constants';
import { AlertTriangle } from 'lucide-react';

interface ProductModalProps {
  produto?: Produto | null;
  onClose: () => void;
  onSave: () => void;
  onDelete?: (id: string) => Promise<void>;
}

export const ProductModal = ({ produto, onClose, onSave, onDelete }: ProductModalProps) => {
  const { user } = useAuth();
  const [nome, setNome] = useState(produto?.nome || '');
  const [categoriaId, setCategoriaId] = useState(produto?.categoria_id || '');
  const [imagemUrl, setImagemUrl] = useState(produto?.imagem_url || '');
  const [tempoProducaoValor, setTempoProducaoValor] = useState(produto?.tempo_producao_valor || 0);
  const [tempoProducaoUnidade, setTempoProducaoUnidade] = useState<'horas' | 'minutos'>(produto?.tempo_producao_unidade || 'horas');
  const [modoPreparo, setModoPreparo] = useState(produto?.modo_preparo || '');
  const [rendimentoUnidades, setRendimentoUnidades] = useState(produto?.rendimento_unidades || 1);
  const [pesoFinal, setPesoFinal] = useState(produto?.peso_final_produto || 0);
  const [custoHoraTrabalho, setCustoHoraTrabalho] = useState(produto?.custo_hora_trabalho || (produto ? 0 : DEFAULT_CUSTO_HORA));
  const [custoFixoRateado, setCustoFixoRateado] = useState(produto?.custo_fixo_rateado || 0);
  const [custoEmbalagem, setCustoEmbalagem] = useState(produto?.custo_embalagem || 0);
  const [taxaVendaPercentual, setTaxaVendaPercentual] = useState(produto?.taxa_venda_percentual || 0);
  const [impostoPercentual, setImpostoPercentual] = useState(produto?.imposto_percentual || 0);
  
  const [usarPrecoManual, setUsarPrecoManual] = useState(produto?.usar_preco_manual || false);
  const [precoVendaManual, setPrecoVendaManual] = useState(produto?.preco_venda_manual || 0);
  const [usarMargemCategoria, setUsarMargemCategoria] = useState(produto?.usar_margem_categoria ?? true);
  const [margemPercentual, setMargemPercentual] = useState(produto?.margem_percentual || 0);
  const [margemTipo, setMargemTipo] = useState(produto?.margem_tipo || 'margem_real');

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [showFichaTecnica, setShowFichaTecnica] = useState(false);
  const [custoInsumos, setCustoInsumos] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    fetchData();
    if (produto?.id) {
      fetchIngredientsCost();
    }
  }, [produto]);

  const fetchIngredientsCost = async () => {
    try {
      const data = await dataService.getProdutoIngredientes(produto?.id!);
      if (data) {
        const total = data.reduce((acc, item) => acc + (item.custo_calculado || 0), 0);
        setCustoInsumos(total);
      }
    } catch (error) {
      console.error('Erro ao buscar custo de ingredientes:', error);
    }
  };

  const fetchData = async () => {
    try {
      const data = await dataService.getCategorias();
      setCategorias(data || []);
    } catch (error: any) {
      console.error('Erro ao carregar categorias:', error);
      setCategorias([]);
    }
  };

  const tempoEmHoras = tempoProducaoUnidade === 'minutos' ? (Number(tempoProducaoValor) || 0) / 60 : (Number(tempoProducaoValor) || 0);
  const laborCost = tempoEmHoras * (Number(custoHoraTrabalho) || 0);
  const fixedCost = Number(custoFixoRateado) || 0;
  const fullTotalCost = custoInsumos + laborCost + fixedCost;
  const currentUnitCost = calculateUnitCost(fullTotalCost, rendimentoUnidades);
  const selectedCategoria = categorias.find(c => c.id === categoriaId);
  
  const activeMargin = resolveProductMargin(
    { usar_margem_categoria: usarMargemCategoria, margem_percentual: margemPercentual, margem_tipo: margemTipo },
    selectedCategoria
  );

  const { precoVendaFinal, margemRealCalculada } = calculateProductPricing(
    currentUnitCost,
    activeMargin.margem,
    activeMargin.tipo,
    usarPrecoManual,
    precoVendaManual,
    custoEmbalagem,
    taxaVendaPercentual,
    impostoPercentual
  );

  const handleOpenFichaTecnica = async () => {
    if (!produto?.id) {
      if (!nome) {
        toast.error('Preencha o nome para iniciar a ficha técnica');
        return;
      }
      
      const loadingToast = toast.loading('Salvando produto inicial...');
      try {
        const rawProductData = {
          user_id: user?.id,
          nome,
          categoria_id: categoriaId || null,
          rendimento_unidades: rendimentoUnidades,
          tempo_producao_valor: tempoProducaoValor,
          tempo_producao_unidade: tempoProducaoUnidade,
          custo_hora_trabalho: custoHoraTrabalho,
          custo_fixo_rateado: custoFixoRateado,
          custo_embalagem: custoEmbalagem,
          taxa_venda_percentual: taxaVendaPercentual,
          imposto_percentual: impostoPercentual,
          usar_margem_categoria: usarMargemCategoria,
          margem_percentual: margemPercentual,
          margem_tipo: margemTipo,
          usar_preco_manual: usarPrecoManual,
          preco_venda_manual: precoVendaManual
        };

        const savedProduct = await dataService.saveProduto(rawProductData as any);
        if (savedProduct) {
          toast.success('Produto criado! Agora você pode adicionar ingredientes.', { id: loadingToast });
          onSave(); // Refresh list
          // Update local state to reflect we now have an ID
          setProductToEditState(savedProduct);
          setShowFichaTecnica(true);
        }
      } catch (error: any) {
        toast.error(`Erro ao criar produto: ${error.message}`, { id: loadingToast });
      }
    } else {
      setShowFichaTecnica(true);
    }
  };

  const [productToEditState, setProductToEditState] = useState<Produto | null>(produto || null);

  const integrityErrors = useMemo(() => {
    if (!productToEditState) return [];
    // Construct a temporary product object with current state to validate in real-time
    const tempProduct = {
      ...productToEditState,
      categoria_id: categoriaId,
      rendimento_unidades: rendimentoUnidades,
      margem_real_calculada: margemRealCalculada,
      ingredientes: productToEditState.ingredientes || []
    };
    return validateProductIntegrity(tempProduct as any);
  }, [productToEditState, categoriaId, rendimentoUnidades, margemRealCalculada, productToEditState?.ingredientes]);

  useEffect(() => {
    setProductToEditState(produto || null);
  }, [produto]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const loadingToast = toast.loading('Enviando imagem...');
    setUploading(true);
    try {
      const url = await dataService.uploadImage(file, 'produtos');
      setImagemUrl(url);
      toast.success('Imagem enviada com sucesso!', { id: loadingToast });
    } catch (error: any) {
      console.error('Erro no upload:', error);
      toast.error('Erro ao enviar imagem. Verifique se o bucket "produtos" existe no Supabase.', { id: loadingToast });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!produto?.id || !onDelete) return;
    
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    setDeleting(true);
    try {
      await onDelete(produto.id);
    } catch (error) {
      console.error('Erro ao excluir no modal:', error);
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome) {
      toast.error('O nome do produto é obrigatório');
      return;
    }

    const loadingToast = toast.loading('Salvando produto...');

    try {
      const rawProductData = {
        id: productToEditState?.id,
        user_id: productToEditState?.user_id || user?.id,
        nome,
        categoria_id: categoriaId || null,
        imagem_url: imagemUrl,
        tempo_producao_valor: tempoProducaoValor,
        tempo_producao_unidade: tempoProducaoUnidade,
        custo_hora_trabalho: custoHoraTrabalho,
        custo_mao_obra: laborCost,
        custo_fixo_rateado: custoFixoRateado,
        custo_embalagem: custoEmbalagem,
        taxa_venda_percentual: taxaVendaPercentual,
        imposto_percentual: impostoPercentual,
        modo_preparo: modoPreparo,
        rendimento_unidades: rendimentoUnidades,
        peso_final_produto: pesoFinal,
        custo_total: fullTotalCost,
        custo_unitario: currentUnitCost,
        usar_preco_manual: usarPrecoManual,
        preco_venda_manual: precoVendaManual,
        usar_margem_categoria: usarMargemCategoria,
        margem_percentual: margemPercentual,
        margem_tipo: margemTipo,
        preco_venda_final: precoVendaFinal,
        margem_real_calculada: margemRealCalculada,
        // Backwards compatibility
        custo_total_calculado: custoInsumos,
        custo_unitario_snapshot: currentUnitCost,
        ativo: productToEditState?.ativo ?? true
      };

      const savedProduct = await dataService.saveProduto(rawProductData as any);
      
      if (!savedProduct) throw new Error("Erro ao salvar produto");

      // Recalculate after save to ensure all totals are correct
      await dataService.recalculateProduct(savedProduct.id);

      toast.success('Produto salvo com sucesso!', { id: loadingToast });
      
      // Call onSave which handles refreshing the UI in the parent component
      onSave();
    } catch (error: any) {
      console.error('Erro ao salvar produto:', error);
      toast.error(`Erro ao salvar: ${error.message}`, { id: loadingToast });
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
              <h2 className="text-xl font-bold text-on-surface">{produto ? 'Editar Produto' : 'Novo Produto'}</h2>
              <p className="text-xs text-on-surface-variant">Configure as informações e precificação do produto.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface-container-high rounded-full transition-all">
            <X size={20} className="text-on-surface-variant" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-grow overflow-y-auto p-6 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Left Column: Basic Info */}
            <div className="space-y-6">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Nome do Produto</label>
                <input 
                  required
                  type="text"
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  placeholder="Ex: Pão Italiano"
                  className="w-full px-4 py-2.5 bg-surface-container-low border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Categoria</label>
                  <select 
                    value={categoriaId}
                    onChange={e => setCategoriaId(e.target.value)}
                    className={`w-full px-4 py-2.5 bg-surface-container-low border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20 ${!categoriaId ? 'ring-1 ring-error/50' : ''}`}
                  >
                    <option value="">Sem Categoria</option>
                    {categorias.map(c => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                  {!categoriaId && (
                    <p className="text-[9px] text-error font-medium flex items-center gap-1 mt-1">
                      <AlertTriangle size={10} /> Categoria obrigatória para o sistema
                    </p>
                  )}
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
                      value={tempoProducaoValor}
                      onChange={e => setTempoProducaoValor(Number(e.target.value))}
                      placeholder="0"
                      className="w-full px-4 py-2.5 bg-surface-container-low border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20"
                    />
                    <select
                      value={tempoProducaoUnidade}
                      onChange={e => setTempoProducaoUnidade(e.target.value as 'horas' | 'minutos')}
                      className="w-32 px-2 py-2.5 bg-surface-container-low border-none rounded-xl text-xs focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="horas">Horas</option>
                      <option value="minutos">Minutos</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest flex items-center gap-1.5">
                    <Package size={12} /> Rendimento (un)
                  </label>
                  <input 
                    type="number"
                    value={rendimentoUnidades}
                    onChange={e => setRendimentoUnidades(Number(e.target.value))}
                    className={`w-full px-4 py-2.5 bg-surface-container-low border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20 ${rendimentoUnidades <= 0 ? 'ring-1 ring-error/50' : ''}`}
                  />
                  {rendimentoUnidades <= 0 && (
                    <p className="text-[9px] text-error font-medium flex items-center gap-1 mt-1">
                      <AlertTriangle size={10} /> Rendimento deve ser maior que zero
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest flex items-center gap-1.5">
                    <Weight size={12} /> Peso Final (g)
                  </label>
                  <input 
                    type="number"
                    value={pesoFinal}
                    onChange={e => setPesoFinal(Number(e.target.value))}
                    className="w-full px-4 py-2.5 bg-surface-container-low border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest flex items-center gap-1.5">
                    <DollarSign size={12} /> Custo Hora (R$)
                  </label>
                  <input 
                    type="number"
                    value={custoHoraTrabalho}
                    onChange={e => setCustoHoraTrabalho(Number(e.target.value))}
                    className="w-full px-4 py-2.5 bg-surface-container-low border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest flex items-center gap-1.5">
                  <Calculator size={12} /> Rateio Custos Fixos (R$)
                </label>
                <input 
                  type="number"
                  value={custoFixoRateado}
                  onChange={e => setCustoFixoRateado(Number(e.target.value))}
                  className="w-full px-4 py-2.5 bg-surface-container-low border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest flex items-center gap-1.5">
                    <Package size={12} /> Custo Embalagem (R$)
                  </label>
                  <input 
                    type="number"
                    step="0.01"
                    value={custoEmbalagem}
                    onChange={e => setCustoEmbalagem(Number(e.target.value))}
                    className="w-full px-4 py-2.5 bg-surface-container-low border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest flex items-center gap-1.5">
                    <Calculator size={12} /> Taxas (%)
                  </label>
                  <input 
                    type="number"
                    step="0.1"
                    value={taxaVendaPercentual}
                    onChange={e => setTaxaVendaPercentual(Number(e.target.value))}
                    className="w-full px-4 py-2.5 bg-surface-container-low border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest flex items-center gap-1.5">
                    <Calculator size={12} /> Impostos (%)
                  </label>
                  <input 
                    type="number"
                    step="0.1"
                    value={impostoPercentual}
                    onChange={e => setImpostoPercentual(Number(e.target.value))}
                    className="w-full px-4 py-2.5 bg-surface-container-low border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest flex items-center gap-1.5">
                  <Image size={12} /> Imagem do Produto
                </label>
                <div className="flex gap-2">
                  <input 
                    type="text"
                    value={imagemUrl}
                    onChange={e => setImagemUrl(e.target.value)}
                    placeholder="URL da imagem ou faça upload..."
                    className="flex-grow px-4 py-2.5 bg-surface-container-low border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20"
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
                {imagemUrl && (
                  <div className="mt-2 aspect-video w-full rounded-xl overflow-hidden border border-surface-container-high relative group">
                    <img 
                      src={imagemUrl || DEFAULT_PRODUCT_IMAGE} 
                      alt="Preview" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = DEFAULT_PRODUCT_IMAGE;
                      }}
                    />
                    <button 
                      type="button"
                      onClick={() => setImagemUrl('')}
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
                  value={modoPreparo}
                  onChange={e => setModoPreparo(e.target.value)}
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
                {(!productToEditState?.ingredientes || productToEditState.ingredientes.length === 0) && productToEditState?.id && (
                  <p className="text-[9px] text-error font-medium mt-2 italic flex items-center gap-1">
                    <AlertTriangle size={10} /> Produtos sem ingredientes não calculam custo corretamente.
                  </p>
                )}
                {!produto?.id && (
                  <p className="text-[10px] text-on-surface-variant mt-2 italic">Salve o produto primeiro para adicionar ingredientes.</p>
                )}
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
                      <button 
                        type="button"
                        onClick={() => {
                          if (!usarPrecoManual && precoVendaManual === 0) {
                            setPrecoVendaManual(precoVendaFinal);
                          }
                          setUsarPrecoManual(!usarPrecoManual);
                        }}
                        className={`w-10 h-5 rounded-full relative transition-all ${usarPrecoManual ? 'bg-primary' : 'bg-surface-container-highest'}`}
                      >
                        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${usarPrecoManual ? 'left-6' : 'left-1'}`}></div>
                      </button>
                    </div>
                    {!usarPrecoManual && (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-on-surface-variant uppercase">Margem Categoria</span>
                        <button 
                          type="button"
                          onClick={() => setUsarMargemCategoria(!usarMargemCategoria)}
                          className={`w-10 h-5 rounded-full relative transition-all ${usarMargemCategoria ? 'bg-primary' : 'bg-surface-container-highest'}`}
                        >
                          <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${usarMargemCategoria ? 'left-6' : 'left-1'}`}></div>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {usarPrecoManual ? (
                  <div className="space-y-4 animate-in fade-in duration-300">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Preço de Venda Manual</label>
                      <input 
                        type="number"
                        step="0.01"
                        value={precoVendaManual}
                        onChange={e => setPrecoVendaManual(Number(e.target.value))}
                        className="w-full px-4 py-2.5 bg-surface-container-lowest border-none rounded-xl text-lg font-bold text-primary focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 animate-in fade-in duration-300">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Tipo de Margem</label>
                        <select 
                          disabled={usarMargemCategoria}
                          value={activeMargin.tipo}
                          onChange={e => setMargemTipo(e.target.value as any)}
                          className={`w-full px-4 py-2.5 bg-surface-container-lowest border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20 ${usarMargemCategoria ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                          <option value="markup">Markup</option>
                          <option value="margem_real">Margem Real</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Margem (%)</label>
                        <input 
                          disabled={usarMargemCategoria}
                          type="number"
                          value={activeMargin.margem}
                          onChange={e => setMargemPercentual(Number(e.target.value))}
                          className={`w-full px-4 py-2.5 bg-surface-container-lowest border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20 ${usarMargemCategoria ? 'opacity-60 cursor-not-allowed' : ''}`}
                        />
                      </div>
                    </div>
                    {usarMargemCategoria && selectedCategoria && (
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
                    <p className="text-[9px] text-on-surface-variant italic mt-1 max-w-[180px]">
                      Lucro da empresa após descontar todos os custos, inclusive seu salário.
                    </p>
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
            {produto?.id && onDelete && (
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
              onClick={onClose}
              className="px-8 py-3 bg-surface-container-high text-on-surface font-bold rounded-2xl hover:bg-surface-container-highest transition-all"
            >
              Cancelar
            </button>
            <button 
              onClick={handleSubmit}
              className="flex items-center gap-2 px-12 py-3 bg-primary text-white font-bold rounded-2xl hover:bg-primary/90 transition-all shadow-xl shadow-primary/20"
            >
              <Save size={18} /> Salvar Produto
            </button>
          </div>
        </div>
      </div>

      {showFichaTecnica && productToEditState && (
        <FichaTecnica 
          product={{
            ...productToEditState,
            margem_percentual: margemPercentual,
            margem_tipo: margemTipo,
            usar_preco_manual: usarPrecoManual,
            preco_venda_manual: precoVendaManual,
            rendimento_unidades: rendimentoUnidades
          }}
          onClose={() => setShowFichaTecnica(false)}
          onUpdate={() => {
            // Recalculate cost when ingredients change
            const fetchNewCost = async () => {
              try {
                const data = await dataService.getProdutoById(productToEditState.id);
                if (data) setCustoInsumos(data.custo_total - laborCost - fixedCost);
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
