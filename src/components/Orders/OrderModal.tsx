import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Cliente, Produto, Pedido, PedidoItem, PedidoExtra, CategoriaExtra } from '../../types';
import { 
  X, 
  Plus, 
  Trash2, 
  Search, 
  Package, 
  DollarSign, 
  Tag, 
  Info,
  ChevronDown,
  PlusCircle,
  Calendar,
  Clock
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCurrency, calculateUnitCost } from '../../services/bakeryService';

interface OrderModalProps {
  pedido?: Pedido | null;
  onClose: () => void;
  onSave: () => void;
}

export const OrderModal = ({ pedido, onClose, onSave }: OrderModalProps) => {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [extraCategories, setExtraCategories] = useState<CategoriaExtra[]>([]);
  
  const [clienteId, setClienteId] = useState(pedido?.cliente_id || '');
  const [dataPedido, setDataPedido] = useState(pedido?.data_pedido ? new Date(pedido.data_pedido).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState(pedido?.status || 'Em preparação');
  const [prioridade, setPrioridade] = useState(pedido?.prioridade || 'Padrão');
  const [observacoes, setObservacoes] = useState(pedido?.observacoes || '');
  const [tempoEstimado, setTempoEstimado] = useState(pedido?.tempo_estimado || '');

  const [itens, setItens] = useState<Partial<PedidoItem>[]>(pedido?.itens || []);
  const [extras, setExtras] = useState<Partial<PedidoExtra>[]>(pedido?.extras || []);
  
  const [productSearch, setProductSearch] = useState('');
  const [showProductResults, setShowProductResults] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    const [
      { data: clientsData },
      { data: productsData },
      { data: extrasCatsData }
    ] = await Promise.all([
      supabase.from('clientes').select('*').order('nome'),
      supabase.from('produtos').select('*').order('nome'),
      supabase.from('categorias_extras').select('*').order('nome')
    ]);

    setClientes(clientsData || []);
    setProdutos(productsData || []);
    setExtraCategories(extrasCatsData || []);
  };

  const addItem = (produto: Produto) => {
    const unitCost = calculateUnitCost(produto.custo_total_calculado, produto.rendimento_unidades);
    const newItem: Partial<PedidoItem> = {
      produto_id: produto.id,
      quantidade: 1,
      preco_unitario: produto.preco_venda_final,
      custo_unitario: unitCost,
      subtotal: produto.preco_venda_final,
      produto: produto
    };
    setItens([...itens, newItem]);
    setProductSearch('');
    setShowProductResults(false);
  };

  const updateItemQuantity = (index: number, qty: number) => {
    const newItens = [...itens];
    const item = newItens[index];
    if (item) {
      item.quantidade = qty;
      item.subtotal = qty * (item.preco_unitario || 0);
      setItens(newItens);
    }
  };

  const removeItem = (index: number) => {
    setItens(itens.filter((_, i) => i !== index));
  };

  const addExtra = () => {
    setExtras([...extras, { descricao: '', categoria: '', valor: 0 }]);
  };

  const updateExtra = (index: number, field: keyof PedidoExtra, value: any) => {
    const newExtras = [...extras];
    newExtras[index] = { ...newExtras[index], [field]: value };
    setExtras(newExtras);
  };

  const removeExtra = (index: number) => {
    setExtras(extras.filter((_, i) => i !== index));
  };

  const totalProdutos = itens.reduce((acc, item) => acc + (item.subtotal || 0), 0);
  const totalExtras = extras.reduce((acc, extra) => acc + (Number(extra.valor) || 0), 0);
  const valorTotal = totalProdutos + totalExtras;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clienteId) {
      toast.error('Selecione um cliente');
      return;
    }
    if (itens.length === 0) {
      toast.error('Adicione pelo menos um produto');
      return;
    }

    const loadingToast = toast.loading('Salvando pedido...');

    try {
      const pedidoData = {
        cliente_id: clienteId,
        data_pedido: new Date(dataPedido).toISOString(),
        status,
        prioridade,
        observacoes,
        tempo_estimado: tempoEstimado,
        valor_total: valorTotal
      };

      let pedidoId = pedido?.id;

      if (pedidoId) {
        const { error: updateError } = await supabase.from('pedidos').update(pedidoData).eq('id', pedidoId);
        if (updateError) throw updateError;
        
        // Clear existing items and extras for update (simplest way)
        await Promise.all([
          supabase.from('pedidos_itens').delete().eq('pedido_id', pedidoId),
          supabase.from('pedidos_extras').delete().eq('pedido_id', pedidoId)
        ]);
      } else {
        const { data: newPedido, error: insertError } = await supabase.from('pedidos').insert([pedidoData]).select();
        if (insertError) throw insertError;
        pedidoId = newPedido[0].id;
      }

      // Insert items
      const itemsToInsert = itens.map(item => ({
        pedido_id: pedidoId,
        produto_id: item.produto_id,
        quantidade: item.quantidade,
        preco_unitario: item.preco_unitario,
        custo_unitario: item.custo_unitario,
        subtotal: item.subtotal
      }));

      const { error: itemsError } = await supabase.from('pedidos_itens').insert(itemsToInsert);
      if (itemsError) throw itemsError;

      // Insert extras
      if (extras.length > 0) {
        const extrasToInsert = extras.map(extra => ({
          pedido_id: pedidoId,
          descricao: extra.descricao,
          categoria: extra.categoria,
          valor: extra.valor
        }));
        const { error: extrasError } = await supabase.from('pedidos_extras').insert(extrasToInsert);
        if (extrasError) throw extrasError;
      }

      toast.success('Pedido salvo com sucesso!', { id: loadingToast });
      onSave();
    } catch (error: any) {
      console.error('Erro ao salvar pedido:', error);
      toast.error(`Erro ao salvar: ${error.message}`, { id: loadingToast });
    }
  };

  const filteredProducts = produtos.filter(p => 
    p.nome.toLowerCase().includes(productSearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface-container-lowest w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden border border-surface-container-high flex flex-col animate-in fade-in zoom-in duration-200">
        <div className="p-6 border-b border-surface-container-high flex justify-between items-center bg-surface-container-low/50">
          <div>
            <h2 className="text-xl font-bold text-on-surface">{pedido ? 'Editar Pedido' : 'Novo Pedido'}</h2>
            <p className="text-xs text-on-surface-variant">Preencha os detalhes e adicione os itens do pedido.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface-container-high rounded-full transition-all">
            <X size={20} className="text-on-surface-variant" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-grow overflow-y-auto p-6 space-y-8">
          {/* Basic Info Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest flex items-center gap-1.5">
                <Tag size={12} /> Cliente *
              </label>
              <select 
                required
                value={clienteId}
                onChange={e => setClienteId(e.target.value)}
                className="w-full px-4 py-2.5 bg-surface-container-low border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Selecione um cliente</option>
                {clientes.map(c => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest flex items-center gap-1.5">
                <Calendar size={12} /> Data do Pedido
              </label>
              <input 
                type="date"
                value={dataPedido}
                onChange={e => setDataPedido(e.target.value)}
                className="w-full px-4 py-2.5 bg-surface-container-low border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest flex items-center gap-1.5">
                <Clock size={12} /> Tempo Estimado
              </label>
              <input 
                type="text"
                placeholder="Ex: 45 min, 2 dias"
                value={tempoEstimado}
                onChange={e => setTempoEstimado(e.target.value)}
                className="w-full px-4 py-2.5 bg-surface-container-low border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest flex items-center gap-1.5">
                Status
              </label>
              <select 
                value={status}
                onChange={e => setStatus(e.target.value as any)}
                className="w-full px-4 py-2.5 bg-surface-container-low border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20"
              >
                <option value="Em preparação">Em preparação</option>
                <option value="Pronto">Pronto</option>
                <option value="Em entrega">Em entrega</option>
                <option value="Concluído">Concluído</option>
                <option value="Cancelado">Cancelado</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest flex items-center gap-1.5">
                Prioridade
              </label>
              <select 
                value={prioridade}
                onChange={e => setPrioridade(e.target.value as any)}
                className="w-full px-4 py-2.5 bg-surface-container-low border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20"
              >
                <option value="Baixa">Baixa</option>
                <option value="Padrão">Padrão</option>
                <option value="Urgente">Urgente</option>
              </select>
            </div>
          </div>

          {/* Products Section */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
                <Package size={16} className="text-primary" /> Produtos do Pedido
              </h3>
              <div className="relative w-64">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                <input 
                  type="text"
                  placeholder="Buscar produto..."
                  value={productSearch}
                  onChange={e => {
                    setProductSearch(e.target.value);
                    setShowProductResults(true);
                  }}
                  onFocus={() => setShowProductResults(true)}
                  className="w-full pl-9 pr-4 py-2 bg-surface-container-low border-none rounded-xl text-xs focus:ring-2 focus:ring-primary/20"
                />
                {showProductResults && productSearch && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-surface-container-lowest border border-surface-container-high rounded-xl shadow-xl z-10 max-h-48 overflow-y-auto">
                    {filteredProducts.length === 0 ? (
                      <p className="p-3 text-xs text-on-surface-variant italic">Nenhum produto encontrado.</p>
                    ) : (
                      filteredProducts.map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => addItem(p)}
                          className="w-full p-3 text-left hover:bg-surface-container-low flex justify-between items-center border-b border-surface-container-high last:border-none"
                        >
                          <div>
                            <p className="text-xs font-bold text-on-surface">{p.nome}</p>
                            <p className="text-[10px] text-on-surface-variant">{formatCurrency(p.preco_venda_final)}</p>
                          </div>
                          <Plus size={14} className="text-primary" />
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-surface-container-low/30 rounded-2xl border border-surface-container-high overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low/50 border-b border-surface-container-high">
                    <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Produto</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest text-center">Qtd</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Preço Un.</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Subtotal</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-high">
                  {itens.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-xs text-on-surface-variant italic">
                        Nenhum produto adicionado.
                      </td>
                    </tr>
                  ) : (
                    itens.map((item, index) => (
                      <tr key={index} className="hover:bg-surface-container-low/50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="text-xs font-bold text-on-surface">{item.produto?.nome}</p>
                          <p className="text-[10px] text-on-surface-variant">Custo: {formatCurrency(item.custo_unitario || 0)}</p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <input 
                              type="number"
                              min="0.1"
                              step="0.1"
                              value={item.quantidade}
                              onChange={e => updateItemQuantity(index, Number(e.target.value))}
                              className="w-16 px-2 py-1 bg-surface-container-low border-none rounded-lg text-xs text-center focus:ring-1 focus:ring-primary/30"
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-on-surface">
                          {formatCurrency(item.preco_unitario || 0)}
                        </td>
                        <td className="px-4 py-3 text-xs font-bold text-primary">
                          {formatCurrency(item.subtotal || 0)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button 
                            type="button"
                            onClick={() => removeItem(index)}
                            className="p-1.5 text-on-surface-variant hover:text-error hover:bg-error/10 rounded-lg transition-all"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Extras Section */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
                <DollarSign size={16} className="text-primary" /> Custos Adicionais
              </h3>
              <button 
                type="button"
                onClick={addExtra}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container-low text-primary text-[10px] font-bold rounded-lg hover:bg-surface-container-high transition-all border border-surface-container-high"
              >
                <PlusCircle size={14} /> Adicionar Extra
              </button>
            </div>

            <div className="space-y-3">
              {extras.length === 0 ? (
                <div className="p-6 border-2 border-dashed border-surface-container-high rounded-2xl text-center">
                  <p className="text-xs text-on-surface-variant italic">Nenhum custo adicional registrado.</p>
                </div>
              ) : (
                extras.map((extra, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-surface-container-low/30 rounded-2xl border border-surface-container-high items-end animate-in slide-in-from-top-2 duration-200">
                    <div className="md:col-span-2 space-y-1">
                      <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Descrição</label>
                      <input 
                        type="text"
                        placeholder="Ex: Embalagem de presente, Taxa de entrega"
                        value={extra.descricao}
                        onChange={e => updateExtra(index, 'descricao', e.target.value)}
                        className="w-full px-4 py-2 bg-surface-container-low border-none rounded-xl text-xs focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Categoria</label>
                      <div className="relative">
                        <input 
                          list={`extra-cats-${index}`}
                          type="text"
                          placeholder="Categoria..."
                          value={extra.categoria}
                          onChange={e => updateExtra(index, 'categoria', e.target.value)}
                          className="w-full px-4 py-2 bg-surface-container-low border-none rounded-xl text-xs focus:ring-2 focus:ring-primary/20"
                        />
                        <datalist id={`extra-cats-${index}`}>
                          {extraCategories.map(c => (
                            <option key={c.id} value={c.nome} />
                          ))}
                        </datalist>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-grow space-y-1">
                        <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Valor (R$)</label>
                        <input 
                          type="number"
                          step="0.01"
                          value={extra.valor}
                          onChange={e => updateExtra(index, 'valor', Number(e.target.value))}
                          className="w-full px-4 py-2 bg-surface-container-low border-none rounded-xl text-xs focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                      <button 
                        type="button"
                        onClick={() => removeExtra(index)}
                        className="p-2 text-on-surface-variant hover:text-error hover:bg-error/10 rounded-xl transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Observations Section */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest flex items-center gap-1.5">
              <Info size={12} /> Observações do Pedido
            </label>
            <textarea 
              rows={3}
              value={observacoes}
              onChange={e => setObservacoes(e.target.value)}
              placeholder="Observações internas ou detalhes especiais..."
              className="w-full px-4 py-3 bg-surface-container-low border-none rounded-2xl text-sm focus:ring-2 focus:ring-primary/20 resize-none"
            />
          </div>
        </form>

        {/* Footer with Totals */}
        <div className="p-6 border-t border-surface-container-high bg-surface-container-low/50 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex gap-8">
            <div className="text-center md:text-left">
              <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Subtotal Produtos</p>
              <p className="text-lg font-bold text-on-surface">{formatCurrency(totalProdutos)}</p>
            </div>
            <div className="text-center md:text-left">
              <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Custos Extras</p>
              <p className="text-lg font-bold text-on-surface">{formatCurrency(totalExtras)}</p>
            </div>
            <div className="text-center md:text-left">
              <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Valor Total</p>
              <p className="text-2xl font-black text-primary">{formatCurrency(valorTotal)}</p>
            </div>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <button 
              type="button"
              onClick={onClose}
              className="flex-grow md:flex-none px-8 py-3 bg-surface-container-high text-on-surface font-bold rounded-2xl hover:bg-surface-container-highest transition-all"
            >
              Cancelar
            </button>
            <button 
              onClick={handleSubmit}
              className="flex-grow md:flex-none px-12 py-3 bg-primary text-white font-bold rounded-2xl hover:bg-primary/90 transition-all shadow-xl shadow-primary/20"
            >
              Finalizar Pedido
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
