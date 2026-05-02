import React, { useState, useMemo } from 'react';
import { 
  Package, 
  PlusCircle, 
  ArrowUpRight, 
  ArrowDownRight, 
  Search,
  Loader2,
  ShoppingBag,
  History,
  Download,
  Tag,
  Calendar,
  X,
  AlertTriangle
} from 'lucide-react';
import { 
  useIngredientes, 
  useMovimentacoesEstoque, 
  useSaveMovimentacaoEstoque,
  useCategorias
} from '../hooks/useQueries';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import { Ingrediente } from '../types';
import { exportToCSV } from '../utils/csvUtils';
import { formatStockValue } from '../services/bakeryService';

const EmptyState = ({ message }: { message: string }) => (
  <div className="py-20 text-center animate-in fade-in zoom-in duration-300">
    <div className="bg-surface-container-low w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 border border-surface-container-high">
      <Package size={40} className="text-on-surface-variant opacity-20" />
    </div>
    <h3 className="text-lg font-bold text-on-surface headline">{message}</h3>
    <p className="text-on-surface-variant text-sm font-medium mt-1">Experimente ajustar os filtros de busca ou categoria.</p>
  </div>
);

export const Estoque = () => {
  const [activeTab, setActiveTab] = useState<'ativos' | 'arquivados' | 'historico'>('ativos');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [onlyCritical, setOnlyCritical] = useState(false);
  
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [selectedInsumo, setSelectedInsumo] = useState<Ingrediente | null>(null);
  const [quantity, setQuantity] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [viewHistoryInsumo, setViewHistoryInsumo] = useState<Ingrediente | null>(null);

  const { data: ingredientes = [], isLoading: loadingInsumos } = useIngredientes();
  const { data: categorias = [] } = useCategorias();
  const { data: todasMovimentacoes = [], isLoading: loadingMovs } = useMovimentacoesEstoque();
  const saveMovMutation = useSaveMovimentacaoEstoque();

  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInsumo || !quantity || Number(quantity) <= 0) {
      toast.error('Preencha os campos corretamente');
      return;
    }

    setIsSaving(true);
    try {
      await saveMovMutation.mutateAsync({
        insumo_id: selectedInsumo.id,
        quantidade: Number(quantity),
        tipo: 'entrada',
        origem: 'compra',
      });
      toast.success('Entrada registrada!');
      setShowEntryModal(false);
      setSelectedInsumo(null);
      setQuantity('');
    } catch (error: any) {
      console.error(error);
      const errorMessage = error.message || 'Erro ao registrar entrada';
      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredInsumos = useMemo(() => {
    return ingredientes.filter(i => {
      const matchesSearch = i.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           (i.fornecedor?.toLowerCase() || '').includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || i.categoria_id === selectedCategory;
      const matchesCritical = !onlyCritical || ((i.estoque_atual || 0) <= (i.estoque_minimo || 0));
      const matchesActive = activeTab === 'ativos' ? (i.ativo !== false) : (i.ativo === false);
      
      return matchesSearch && matchesCategory && matchesCritical && matchesActive;
    });
  }, [ingredientes, searchTerm, selectedCategory, onlyCritical, activeTab]);

  const filteredMovs = useMemo(() => {
    return todasMovimentacoes.filter(m => 
      (m.insumo?.nome || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [todasMovimentacoes, searchTerm]);

  const handleExportCSV = () => {
    const dataToExport = filteredInsumos.map(i => ({
      Insumo: i.nome,
      Categoria: i.categoria?.nome || 'Principal',
      Unidade: i.unidade_base,
      'Saldo Atual': i.estoque_atual,
      'Saldo Formatado': formatStockValue(i.estoque_atual, i.unidade_base),
      'Mínimo (Unidades)': i.estoque_minimo_unidades,
      'Mínimo Total': i.estoque_minimo,
      Fornecedor: i.fornecedor || '-',
      Status: i.estoque_atual <= i.estoque_minimo ? 'Crítico' : 'Normal',
      'Última Atualização': i.data_atualizacao ? format(parseISO(i.data_atualizacao), 'dd/MM/yyyy HH:mm') : '-'
    }));

    exportToCSV(dataToExport, {
      Insumo: 'Insumo',
      Categoria: 'Categoria',
      Unidade: 'Unidade',
      'Saldo Atual': 'Saldo Atual (Base)',
      'Saldo Formatado': 'Saldo Formatado',
      'Mínimo (Unidades)': 'Mínimo (Unidades)',
      'Mínimo Total': 'Mínimo Total',
      Fornecedor: 'Fornecedor',
      Status: 'Status',
      'Última Atualização': 'Última Atualização'
    }, `estoque_${activeTab}`);
    toast.success('Exportação concluída!');
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-on-surface headline flex items-center gap-3">
            <Package size={32} className="text-primary" /> Painel de Estoque
          </h1>
          <p className="text-on-surface-variant mt-1 font-medium">Controle de insumos e rastreabilidade de consumos.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleExportCSV}
            className="flex items-center gap-2 bg-white text-on-surface px-4 py-3 rounded-2xl font-bold border border-surface-container-high shadow-sm hover:bg-surface-container-low transition-all text-sm"
          >
            <Download size={18} /> Exportar
          </button>
          <button 
            onClick={() => {
              setSelectedInsumo(null);
              setShowEntryModal(true);
            }}
            className="bg-primary text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:shadow-lg hover:shadow-primary/20 transition-all active:scale-95 text-sm"
          >
            <PlusCircle size={20} /> Lançar Compra
          </button>
        </div>
      </div>

      <div className="flex bg-surface-container-low p-1.5 rounded-2xl w-fit">
        {[
          { id: 'ativos', label: 'Estoque Ativo' },
          { id: 'arquivados', label: 'Arquivados' },
          { id: 'historico', label: 'Histórico Geral' }
        ].map((tab) => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id as 'ativos' | 'arquivados' | 'historico')}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === tab.id ? 'bg-white text-primary shadow-sm' : 'text-on-surface-variant hover:bg-white/50'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-grow">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={20} />
          <input 
            type="text" 
            placeholder="Buscar insumo ou fornecedor..."
            className="w-full pl-12 pr-4 py-4 bg-white border-none rounded-3xl shadow-sm focus:ring-2 focus:ring-primary/20 transition-all font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        {activeTab !== 'historico' && (
          <>
            <div className="relative min-w-[200px]">
              <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full pl-11 pr-4 py-4 bg-white border-none rounded-3xl shadow-sm focus:ring-2 focus:ring-primary/20 appearance-none font-bold text-sm cursor-pointer"
              >
                <option value="all">Todas Categorias</option>
                {categorias.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.nome}</option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setOnlyCritical(!onlyCritical)}
              className={`px-6 py-4 rounded-3xl font-bold text-sm transition-all flex items-center gap-2 shadow-sm ${onlyCritical ? 'bg-error text-white' : 'bg-white text-on-surface hover:bg-surface-container-low'}`}
            >
              <AlertTriangle size={18} />
              Apenas Críticos
            </button>
          </>
        )}
      </div>

      {(activeTab === 'ativos' || activeTab === 'arquivados') ? (
        <div className="bg-white rounded-3xl border border-surface-container-high shadow-sm overflow-hidden animate-in fade-in duration-300">
          <div className="overflow-x-auto">
            {loadingInsumos ? (
              <div className="py-20 text-center"><Loader2 className="animate-spin text-primary mx-auto" size={40} /></div>
            ) : filteredInsumos.length === 0 ? (
              <EmptyState message={searchTerm ? 'Nenhum insumo encontrado para sua busca' : 'Nenhum insumo cadastrado neste status'} />
            ) : (
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead>
                  <tr className="bg-surface-container-low/50">
                    <th className="px-6 py-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest border-b border-surface-container-high">Insumo</th>
                    <th className="px-6 py-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest border-b border-surface-container-high">Categoria</th>
                    <th className="px-6 py-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest border-b border-surface-container-high">Unidade</th>
                    <th className="px-6 py-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest border-b border-surface-container-high text-right">Saldo Atual</th>
                    <th className="px-6 py-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest border-b border-surface-container-high text-right">Mínimo</th>
                    <th className="px-6 py-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest border-b border-surface-container-high">Fornecedor</th>
                    <th className="px-6 py-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest border-b border-surface-container-high text-center">Status</th>
                    <th className="px-6 py-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest border-b border-surface-container-high">Última At.</th>
                    <th className="px-6 py-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest border-b border-surface-container-high text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-high">
                  {filteredInsumos.map((insumo, idx) => {
                    const isCritical = (insumo.estoque_atual || 0) <= (insumo.estoque_minimo || 0);
                    return (
                      <tr key={insumo.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-surface-container-lowest/30'} hover:bg-primary/5 transition-colors group`}>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-xl border ${isCritical ? 'bg-error/5 border-error/20 text-error' : 'bg-primary/5 border-primary/20 text-primary'}`}>
                              <Package size={18} />
                            </div>
                            <span className="font-bold text-on-surface">{insumo.nome}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2.5 py-1 bg-surface-container-high text-on-surface-variant text-[10px] font-black rounded-full uppercase border border-surface-container-high">
                            {insumo.categoria?.nome || 'Principal'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs font-medium text-on-surface-variant">{insumo.unidade_base}</td>
                        <td className={`px-6 py-4 text-sm text-right ${isCritical ? 'text-error font-black' : 'text-on-surface font-bold'}`}>
                          {formatStockValue(insumo.estoque_atual || 0, insumo.unidade_embalagem)}
                        </td>
                        <td className="px-6 py-4 text-xs text-on-surface-variant text-right font-medium">
                          {insumo.estoque_minimo_unidades} un
                        </td>
                        <td className="px-6 py-4 text-xs text-on-surface-variant truncate max-w-[150px]">{insumo.fornecedor || '-'}</td>
                        <td className="px-6 py-4 text-center">
                          {isCritical ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-error/10 text-error text-[10px] font-black rounded-full uppercase border border-error/20">
                              <AlertTriangle size={12} /> Crítico
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-success/10 text-success text-[10px] font-black rounded-full uppercase border border-success/20">
                              ✅ Normal
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-[10px] font-medium text-on-surface-variant">
                          {insumo.data_atualizacao ? format(parseISO(insumo.data_atualizacao), "dd/MM/yyyy HH:mm") : 'Sem registros'}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-end gap-2">
                            <button 
                              onClick={() => {
                                setSelectedInsumo(insumo);
                                setShowEntryModal(true);
                              }}
                              className="p-2 text-primary hover:bg-primary/10 rounded-xl transition-all"
                              title="Lançar entrada rápida"
                            >
                              <PlusCircle size={18} />
                            </button>
                            <button 
                              onClick={() => setViewHistoryInsumo(insumo)}
                              className="p-2 text-on-surface-variant hover:bg-surface-container-high rounded-xl transition-all"
                              title="Ver histórico"
                            >
                              <History size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-surface-container-high shadow-sm overflow-hidden animate-in fade-in duration-300">
          <div className="overflow-x-auto">
            {loadingMovs ? (
              <div className="py-20 text-center"><Loader2 className="animate-spin text-primary mx-auto" size={32} /></div>
            ) : filteredMovs.length === 0 ? (
              <EmptyState message="Nenhuma movimentação registrada" />
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low/50">
                    <th className="px-6 py-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest border-b border-surface-container-high">Data</th>
                    <th className="px-6 py-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest border-b border-surface-container-high">Insumo</th>
                    <th className="px-6 py-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest border-b border-surface-container-high text-center">Tipo</th>
                    <th className="px-6 py-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest border-b border-surface-container-high text-right">Qtd.</th>
                    <th className="px-6 py-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest border-b border-surface-container-high">Origem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-high">
                  {filteredMovs.map((mov) => (
                    <tr key={mov.id} className="hover:bg-surface-container-low/30 transition-colors">
                      <td className="px-6 py-4 text-xs text-on-surface-variant">{format(parseISO(mov.created_at), "dd/MM HH:mm")}</td>
                      <td className="px-6 py-4 text-sm font-bold text-on-surface">{mov.insumo?.nome}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${mov.tipo === 'entrada' ? 'bg-success/10 text-success border-success/20' : 'bg-error/10 text-error border-error/20'}`}>
                          {mov.tipo === 'entrada' ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                          {mov.tipo}
                        </span>
                      </td>
                      <td className={`px-6 py-4 text-sm font-black text-right ${mov.tipo === 'entrada' ? 'text-success' : 'text-error'}`}>
                        {mov.tipo === 'entrada' ? '+' : '-'}{formatStockValue(mov.quantidade, mov.insumo?.unidade_embalagem || '')}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[9px] font-bold px-2 py-0.5 bg-surface-container-high rounded text-on-surface-variant uppercase">
                          {mov.origem.replace('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Quick Entry Modal */}
      {showEntryModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-surface-container-high overflow-hidden animate-in zoom-in duration-300">
            <div className="p-8 border-b border-surface-container-high bg-surface-container-low/30 flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary text-white rounded-2xl">
                  <ShoppingBag size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-on-surface headline">Lançar Entrada</h2>
                  <p className="text-xs text-on-surface-variant font-bold uppercase tracking-widest">Procedimento de Abastecimento</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setShowEntryModal(false);
                  setSelectedInsumo(null);
                }} 
                className="p-2 hover:bg-white rounded-full transition-all text-on-surface-variant hover:text-error"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSaveEntry} className="p-8 space-y-6">
              {!selectedInsumo ? (
                <div>
                  <label className="block text-[10px] font-black text-on-surface-variant uppercase tracking-widest mb-2 ml-1">Selecionar Insumo</label>
                  <select 
                    autoFocus
                    className="w-full p-4 bg-surface-container-low border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer"
                    onChange={(e) => {
                      const found = ingredientes.find(i => i.id === e.target.value);
                      if (found) setSelectedInsumo(found);
                    }}
                  >
                    <option value="">Escolha um ingrediente...</option>
                    {ingredientes.filter(i => i.ativo !== false).map(i => (
                      <option key={i.id} value={i.id}>{i.nome}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10">
                  <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">Insumo Selecionado</p>
                  <p className="text-lg font-bold text-on-surface">{selectedInsumo.nome}</p>
                  <p className="text-xs text-on-surface-variant font-medium mt-1">Saldo Atual: {formatStockValue(selectedInsumo.estoque_atual || 0, selectedInsumo.unidade_embalagem)}</p>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-black text-on-surface-variant uppercase tracking-widest mb-2 ml-1 text-primary">
                  Quantidade para Entrada em {selectedInsumo?.unidade_embalagem || 'un'}
                </label>
                <div className="relative">
                  <input 
                    type="number"
                    step="any"
                    autoFocus={!!selectedInsumo}
                    placeholder="0.00"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full p-6 bg-surface-container-low border-none rounded-3xl text-3xl font-black text-primary placeholder:text-primary/20 focus:ring-2 focus:ring-primary/20"
                  />
                  {selectedInsumo && (
                    <span className="absolute right-6 top-1/2 -translate-y-1/2 font-black text-primary/40 uppercase pointer-events-none">
                      {selectedInsumo.unidade_embalagem}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-[10px] font-medium text-on-surface-variant italic">
                  * O sistema converterá automaticamente para {selectedInsumo?.unidade_base} ao salvar.
                </p>
              </div>

              <button 
                type="submit"
                disabled={isSaving}
                className="w-full bg-primary text-white p-6 rounded-3xl font-black text-lg hover:shadow-xl hover:shadow-primary/30 transition-all active:scale-[0.98] disabled:opacity-50 flex justify-center items-center gap-3"
              >
                {isSaving ? <Loader2 className="animate-spin" size={24} /> : (
                  <>
                    <PlusCircle size={24} />
                    Confirmar Abastecimento
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* History Side Panel/Modal */}
      {viewHistoryInsumo && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setViewHistoryInsumo(null)}></div>
          <div className="relative w-full max-w-xl bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-500">
            <div className="p-8 border-b border-surface-container-high flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-primary/10 text-primary rounded-2xl">
                  <History size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-on-surface">Histórico: {viewHistoryInsumo.nome}</h2>
                  <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Rastreabilidade Completa</p>
                </div>
              </div>
              <button 
                onClick={() => setViewHistoryInsumo(null)}
                className="p-3 text-on-surface-variant hover:bg-surface-container-low rounded-2xl"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-grow overflow-y-auto p-4">
              <MovHistoryContent insumoId={viewHistoryInsumo.id} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const MovHistoryContent = ({ insumoId }: { insumoId: string }) => {
  const { data: movs = [], isLoading } = useMovimentacoesEstoque(insumoId);

  if (isLoading) return <div className="p-20 text-center"><Loader2 className="animate-spin text-primary mx-auto" size={32} /></div>;

  return (
    <div className="space-y-4">
      {movs.map((mov) => (
        <div key={mov.id} className="p-6 bg-surface-container-low/50 rounded-3xl border border-surface-container-high transition-all hover:bg-white hover:border-primary/20 group">
          <div className="flex justify-between items-start mb-3">
            <div className={`p-2 rounded-xl border ${mov.tipo === 'entrada' ? 'bg-success/5 border-success/20 text-success' : 'bg-error/5 border-error/20 text-error'}`}>
              {mov.tipo === 'entrada' ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
            </div>
            <p className="text-xs font-bold text-on-surface-variant flex items-center gap-1.5">
              <Calendar size={12} />
              {format(parseISO(mov.created_at), "dd/MM/yyyy HH:mm")}
            </p>
          </div>
          <div className="flex justify-between items-end">
            <div>
              <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest mb-0.5">Origem</p>
              <p className="text-sm font-bold text-on-surface capitalize">{mov.origem.replace('_', ' ')}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest mb-0.5">Quantidade</p>
              <p className={`text-xl font-black ${mov.tipo === 'entrada' ? 'text-success' : 'text-error'}`}>
                {mov.tipo === 'entrada' ? '+' : '-'}{formatStockValue(mov.quantidade, mov.insumo?.unidade_base || '')}
              </p>
            </div>
          </div>
        </div>
      ))}
      {movs.length === 0 && (
        <div className="p-12 text-center text-on-surface-variant italic">Nenhum registro de movimentação encontrado.</div>
      )}
    </div>
  );
};
