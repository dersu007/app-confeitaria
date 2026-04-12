import React, { useState, useEffect } from 'react';
import { dataService } from '../services/dataService';
import { useAuth } from '../lib/auth';
import { Produto, Categoria } from '../types';
import { 
  formatCurrency, 
  calculateProductPricing, 
  resolveProductMargin
} from '../services/bakeryService';
import { 
  Search, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  Info,
  RefreshCw,
  DollarSign
} from 'lucide-react';
import toast from 'react-hot-toast';

export const Precificacao = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState<Produto[]>([]);
  const [categories, setCategories] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [prodRes, catRes] = await Promise.all([
        dataService.getProdutos(),
        dataService.getCategorias()
      ]);

      setProducts(prodRes || []);
      setCategories(catRes || []);
    } catch (error: any) {
      console.error('Erro ao carregar dados de precificação:', error);
      toast.error('Erro ao carregar produtos');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (id: string, field: string, value: any) => {
    setUpdatingId(id);
    try {
      await dataService.saveProduto({ id, [field]: value } as any);

      // Recalcular após atualização
      const updatedProduct = await dataService.recalculateProduct(id);
      if (updatedProduct) {
        setProducts(prev => prev.map(p => p.id === id ? updatedProduct : p));
      }
    } catch (error: any) {
      console.error('Erro ao atualizar produto:', error);
      toast.error('Erro ao salvar alteração');
    } finally {
      setUpdatingId(null);
    }
  };

  const recalculateAll = async () => {
    const loadingToast = toast.loading('Recalculando todos os produtos...');
    try {
      await dataService.recalculateAllProducts();
      await fetchData();
      toast.success('Todos os produtos foram recalculados!', { id: loadingToast });
    } catch (err: any) {
      console.error('Erro no recálculo global:', err);
      toast.error(`Erro no recálculo: ${err.message}`, { id: loadingToast });
    }
  };

  const getMarginColor = (margin: number) => {
    if (margin >= 40) return 'text-primary bg-primary/10 border-primary/20';
    if (margin >= 20) return 'text-warning bg-warning/10 border-warning/20';
    return 'text-error bg-error/10 border-error/20';
  };

  const getMarginIcon = (margin: number) => {
    if (margin >= 40) return <CheckCircle2 size={14} />;
    if (margin >= 20) return <Info size={14} />;
    return <AlertTriangle size={14} />;
  };

  const filteredProducts = products.filter(p => 
    p.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold headline text-primary flex items-center gap-2">
            <DollarSign size={24} /> Precificação Profissional
          </h2>
          <p className="text-sm text-on-surface-variant">Gerencie margens e preços finais de venda</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" size={16} />
            <input 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar produto..."
              className="pl-10 pr-4 py-2 bg-white border border-surface-container-high rounded-xl text-sm w-full focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>
          <button 
            onClick={recalculateAll}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white font-bold rounded-xl text-sm hover:opacity-90 transition-all whitespace-nowrap"
          >
            <RefreshCw size={16} /> Recalcular Tudo
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-surface-container-high shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <CheckCircle2 size={20} />
            </div>
            <span className="text-sm font-bold text-on-surface-variant uppercase tracking-wider">Saudável</span>
          </div>
          <p className="text-2xl font-bold text-on-surface">{products.filter(p => p.margem_real_calculada >= 40).length}</p>
          <p className="text-xs text-on-surface-variant mt-1">Produtos com margem {'>'} 40%</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-surface-container-high shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-warning/10 rounded-lg text-warning">
              <Info size={20} />
            </div>
            <span className="text-sm font-bold text-on-surface-variant uppercase tracking-wider">Atenção</span>
          </div>
          <p className="text-2xl font-bold text-on-surface">{products.filter(p => p.margem_real_calculada >= 20 && p.margem_real_calculada < 40).length}</p>
          <p className="text-xs text-on-surface-variant mt-1">Produtos com margem entre 20% e 40%</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-surface-container-high shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-error/10 rounded-lg text-error">
              <AlertTriangle size={20} />
            </div>
            <span className="text-sm font-bold text-on-surface-variant uppercase tracking-wider">Perigo</span>
          </div>
          <p className="text-2xl font-bold text-on-surface">{products.filter(p => p.margem_real_calculada < 20).length}</p>
          <p className="text-xs text-on-surface-variant mt-1">Produtos com margem {'<'} 20%</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-surface-container-high overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-lowest">
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant border-b border-surface-container-high">Produto</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant border-b border-surface-container-high text-center">Custo Total</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant border-b border-surface-container-high text-center">Rendimento</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant border-b border-surface-container-high text-center">Custo Hora/Fixo</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant border-b border-surface-container-high text-center">Custo Unitário</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant border-b border-surface-container-high text-center">Taxas/Imp/Emb</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant border-b border-surface-container-high text-center">Preço Sugerido</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant border-b border-surface-container-high text-center">Preço Final</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant border-b border-surface-container-high text-center">Margem Real %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-high">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-on-surface-variant">
                    <RefreshCw size={24} className="animate-spin mx-auto mb-2 opacity-20" />
                    Carregando precificação...
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-on-surface-variant">
                    Nenhum produto encontrado.
                  </td>
                </tr>
              ) : (
                filteredProducts.map(product => {
                  const category = categories.find(c => c.id === product.categoria_id);
                  const activeMargin = resolveProductMargin(product, category);
                  
                  // Calcular preço sugerido (sempre baseado no markup/margem real configurada, ignorando o manual)
                  const { precoVendaFinal: precoSugerido } = calculateProductPricing(
                    product.custo_unitario_snapshot || 0,
                    activeMargin.margem,
                    activeMargin.tipo,
                    false, // Forçar cálculo automático para o sugerido
                    0,
                    product.custo_embalagem || 0,
                    product.taxa_venda_percentual || 0,
                    product.imposto_percentual || 0
                  );

                  return (
                    <tr key={product.id} className="hover:bg-surface-container-lowest transition-colors group">
                      <td className="px-6 py-4">
                        <div className="font-bold text-on-surface">{product.nome}</div>
                        <div className="text-[10px] text-on-surface-variant uppercase tracking-wider">
                          {category?.nome || 'Sem Categoria'}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-sm text-center">
                        {formatCurrency(product.custo_total || 0)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <input 
                            type="number"
                            step="1"
                            value={product.rendimento_unidades || 1}
                            onChange={e => handleUpdate(product.id, 'rendimento_unidades', parseInt(e.target.value) || 1)}
                            className="w-16 bg-surface-container-low border-none rounded-lg text-sm p-1 text-center focus:ring-2 focus:ring-primary/20"
                          />
                          <span className="text-[10px] text-on-surface-variant uppercase">un</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1 items-center">
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] text-on-surface-variant w-8">Hora:</span>
                            <input 
                              type="number"
                              step="0.01"
                              value={product.custo_hora_trabalho || 0}
                              onChange={e => handleUpdate(product.id, 'custo_hora_trabalho', parseFloat(e.target.value) || 0)}
                              className="w-14 bg-surface-container-low border-none rounded-lg text-[10px] p-0.5 text-center focus:ring-1 focus:ring-primary/20"
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] text-on-surface-variant w-8">Fixo:</span>
                            <input 
                              type="number"
                              step="0.01"
                              value={product.custo_fixo_rateado || 0}
                              onChange={e => handleUpdate(product.id, 'custo_fixo_rateado', parseFloat(e.target.value) || 0)}
                              className="w-14 bg-surface-container-low border-none rounded-lg text-[10px] p-0.5 text-center focus:ring-1 focus:ring-primary/20"
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-sm text-center font-bold text-primary">
                        {formatCurrency(product.custo_unitario || 0)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1 items-center">
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] text-on-surface-variant w-8">Emb:</span>
                            <input 
                              type="number"
                              step="0.01"
                              value={product.custo_embalagem || 0}
                              onChange={e => handleUpdate(product.id, 'custo_embalagem', parseFloat(e.target.value) || 0)}
                              className="w-14 bg-surface-container-low border-none rounded-lg text-[10px] p-0.5 text-center focus:ring-1 focus:ring-primary/20"
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] text-on-surface-variant w-8">Taxa:</span>
                            <input 
                              type="number"
                              step="0.1"
                              value={product.taxa_venda_percentual || 0}
                              onChange={e => handleUpdate(product.id, 'taxa_venda_percentual', parseFloat(e.target.value) || 0)}
                              className="w-14 bg-surface-container-low border-none rounded-lg text-[10px] p-0.5 text-center focus:ring-1 focus:ring-primary/20"
                            />
                            <span className="text-[9px] text-on-surface-variant">%</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] text-on-surface-variant w-8">Imp:</span>
                            <input 
                              type="number"
                              step="0.1"
                              value={product.imposto_percentual || 0}
                              onChange={e => handleUpdate(product.id, 'imposto_percentual', parseFloat(e.target.value) || 0)}
                              className="w-14 bg-surface-container-low border-none rounded-lg text-[10px] p-0.5 text-center focus:ring-1 focus:ring-primary/20"
                            />
                            <span className="text-[9px] text-on-surface-variant">%</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="font-mono text-sm text-on-surface-variant">
                          {formatCurrency(precoSugerido)}
                        </div>
                        <div className="text-[9px] text-on-surface-variant uppercase">
                          {activeMargin.tipo === 'markup' ? 'Markup' : 'Margem Real'} ({activeMargin.margem}%)
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col items-center gap-2">
                          <div className="flex items-center gap-2">
                            <input 
                              type="checkbox"
                              checked={product.usar_preco_manual}
                              onChange={e => handleUpdate(product.id, 'usar_preco_manual', e.target.checked)}
                              className="rounded border-surface-container-high text-primary focus:ring-primary/20"
                            />
                            <span className="text-[10px] text-on-surface-variant uppercase">Manual</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-on-surface-variant">R$</span>
                            <input 
                              type="number"
                              step="0.01"
                              disabled={!product.usar_preco_manual}
                              value={product.usar_preco_manual ? product.preco_venda_manual : product.preco_venda_final}
                              onChange={e => handleUpdate(product.id, 'preco_venda_manual', parseFloat(e.target.value) || 0)}
                              className={`w-24 border-none rounded-lg text-sm p-1 text-center focus:ring-2 focus:ring-primary/20 ${product.usar_preco_manual ? 'bg-surface-container-low font-bold text-primary' : 'bg-transparent text-on-surface-variant'}`}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold ${getMarginColor(product.margem_real_calculada)}`}>
                          {getMarginIcon(product.margem_real_calculada)}
                          {product.margem_real_calculada.toFixed(1)}%
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-surface-container-low p-6 rounded-2xl border border-surface-container-high flex items-start gap-4">
        <div className="p-3 bg-primary/10 rounded-xl text-primary">
          <DollarSign size={24} />
        </div>
        <div className="space-y-1">
          <h4 className="font-bold text-on-surface">Entenda a Margem Real</h4>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            A <strong>Margem Real</strong> é o que sobra no seu bolso após pagar todos os custos. 
            Ela desconta o custo de produção, a embalagem e as taxas automáticas (cartão e impostos). 
            Mantenha seus produtos na zona <span className="text-success font-bold">Verde (35%+)</span> para garantir a sustentabilidade do seu negócio.
          </p>
        </div>
      </div>
    </div>
  );
};
