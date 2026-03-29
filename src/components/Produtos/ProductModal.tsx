import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Produto, Categoria } from '../../types';
import { X, Plus, Package, Image, Clock, Calculator, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCurrency, calculateProductPricing, calculateUnitCost, resolveProductMargin } from '../../services/bakeryService';
import { FichaTecnica } from '../FichaTecnica';

interface ProductModalProps {
  produto?: Produto | null;
  onClose: () => void;
  onSave: () => void;
}

export const ProductModal = ({ produto, onClose, onSave }: ProductModalProps) => {
  const [nome, setNome] = useState(produto?.nome || '');
  const [categoriaId, setCategoriaId] = useState(produto?.categoria_id || '');
  const [imagemUrl, setImagemUrl] = useState(produto?.imagem_url || '');
  const [tempoProducaoValor, setTempoProducaoValor] = useState(produto?.tempo_producao_valor || 0);
  const [tempoProducaoUnidade, setTempoProducaoUnidade] = useState<'horas' | 'dias'>(produto?.tempo_producao_unidade || 'horas');
  const [modoPreparo, setModoPreparo] = useState(produto?.modo_preparo || '');
  const [rendimentoUnidades, setRendimentoUnidades] = useState(produto?.rendimento_unidades || 1);
  const [pesoFinal, setPesoFinal] = useState(produto?.peso_final_produto || 0);
  
  const [usarPrecoManual, setUsarPrecoManual] = useState(produto?.usar_preco_manual || false);
  const [precoVendaManual, setPrecoVendaManual] = useState(produto?.preco_venda_manual || 0);
  const [usarMargemCategoria, setUsarMargemCategoria] = useState(produto?.usar_margem_categoria ?? true);
  const [margemPercentual, setMargemPercentual] = useState(produto?.margem_percentual || 0);
  const [margemTipo, setMargemTipo] = useState(produto?.margem_tipo || 'margem_real');

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [showFichaTecnica, setShowFichaTecnica] = useState(false);
  const [custoTotal, setCustoTotal] = useState(produto?.custo_total_calculado || 0);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data, error } = await supabase.from('categorias').select('*').order('nome');
      
      if (error) {
        console.error('Erro ao carregar categorias:', error);
        // If it's a permission error or table doesn't exist, we still want to allow the user to proceed if possible
        setCategorias([]);
        return;
      }

      setCategorias(data || []);
      
      // If no categories exist, we might want to warn the user
      if (!data || data.length === 0) {
        console.warn('Nenhuma categoria encontrada. O usuário precisa cadastrar categorias na Base de Dados.');
      }
    } catch (error: any) {
      console.error('Erro detalhado no fetchData:', error);
      // Don't block the UI with a toast if it's just a background fetch
      setCategorias([]);
    }
  };

  const currentUnitCost = calculateUnitCost(custoTotal, rendimentoUnidades);
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
    precoVendaManual
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome || !categoriaId) {
      toast.error('Nome e categoria são obrigatórios');
      return;
    }

    const loadingToast = toast.loading('Salvando produto...');

    try {
        const productData = {
          nome,
          categoria_id: categoriaId,
          imagem_url: imagemUrl,
          tempo_producao_valor: tempoProducaoValor,
          tempo_producao_unidade: tempoProducaoUnidade,
          modo_preparo: modoPreparo,
          rendimento_unidades: rendimentoUnidades,
          peso_final_produto: pesoFinal,
          custo_total_calculado: custoTotal,
          custo_unitario_snapshot: currentUnitCost,
          usar_preco_manual: usarPrecoManual,
          preco_venda_manual: precoVendaManual,
          usar_margem_categoria: usarMargemCategoria,
          margem_percentual: margemPercentual,
          margem_tipo: margemTipo,
          preco_venda_final: precoVendaFinal,
          margem_real_calculada: margemRealCalculada
        };

      if (produto?.id) {
        const { error } = await supabase.from('produtos').update(productData).eq('id', produto.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('produtos').insert([productData]);
        if (error) throw error;
      }

      toast.success('Produto salvo com sucesso!', { id: loadingToast });
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
                    required
                    value={categoriaId}
                    onChange={e => setCategoriaId(e.target.value)}
                    className="w-full px-4 py-2.5 bg-surface-container-low border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">Selecione...</option>
                    {categorias.map(c => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
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
                      onChange={e => setTempoProducaoUnidade(e.target.value as 'horas' | 'dias')}
                      className="bg-surface-container-low border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20 px-2"
                    >
                      <option value="horas">Horas</option>
                      <option value="dias">Dias</option>
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
                    className="w-full px-4 py-2.5 bg-surface-container-low border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest flex items-center gap-1.5">
                  <Image size={12} /> URL da Imagem
                </label>
                <input 
                  type="text"
                  value={imagemUrl}
                  onChange={e => setImagemUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-4 py-2.5 bg-surface-container-low border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20"
                />
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

              <div className="p-4 bg-surface-container-low/50 rounded-2xl border border-surface-container-high">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Ficha Técnica (Ingredientes)</h4>
                  {produto?.id && (
                    <button 
                      type="button"
                      onClick={() => setShowFichaTecnica(true)}
                      className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1"
                    >
                      <Plus size={12} /> Editar Ingredientes
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[10px] text-on-surface-variant block">Custo Total Insumos</span>
                    <span className="text-sm font-bold text-on-surface">{formatCurrency(custoTotal)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-on-surface-variant block">Custo Unitário</span>
                    <span className="text-sm font-bold text-primary">{formatCurrency(currentUnitCost)}</span>
                  </div>
                </div>
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
                    <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest block mb-1">Margem Real Calculada</span>
                    <span className={`text-xl font-bold ${margemRealCalculada >= 40 ? 'text-primary' : 'text-error'}`}>
                      {margemRealCalculada.toFixed(1)}%
                    </span>
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

        <div className="p-6 border-t border-surface-container-high bg-surface-container-low/50 flex justify-end gap-3">
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

      {showFichaTecnica && produto && (
        <FichaTecnica 
          product={{
            ...produto,
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
              const { data } = await supabase.from('produtos').select('custo_total_calculado').eq('id', produto.id).single();
              if (data) setCustoTotal(data.custo_total_calculado);
            };
            fetchNewCost();
          }}
        />
      )}
    </div>
  );
};
