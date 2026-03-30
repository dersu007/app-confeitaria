import React, { useState, useEffect } from 'react';
import { dataService } from '../services/dataService';
import { Pedido, Cliente } from '../types';
import { 
  ShoppingBag, 
  Plus, 
  Search, 
  Filter, 
  LayoutGrid, 
  List, 
  Download, 
  RefreshCw,
  MoreHorizontal,
  ChevronRight,
  Clock,
  Package,
  AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCurrency } from '../services/bakeryService';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { KanbanBoard } from './Orders/KanbanBoard';
import { OrderModal } from './Orders/OrderModal';
import { OrderDetails } from './Orders/OrderDetails';

export const Pedidos = () => {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('Todos');
  
  const [showModal, setShowModal] = useState(false);
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    fetchPedidos();
  }, []);

  const fetchPedidos = async () => {
    setLoading(true);
    try {
      const data = await dataService.getPedidos();
      setPedidos(data);
    } catch (error) {
      console.error('Erro ao carregar pedidos:', error);
      toast.error('Erro ao carregar pedidos');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (pedidoId: string, newStatus: Pedido['status']) => {
    try {
      await dataService.updatePedidoStatus(pedidoId, newStatus);
      setPedidos(prev => prev.map(p => p.id === pedidoId ? { ...p, status: newStatus } : p));
      toast.success(`Pedido movido para ${newStatus}`);
    } catch (error) {
      toast.error('Erro ao atualizar status');
    }
  };

  const filteredPedidos = pedidos.filter(p => {
    const matchesSearch = p.cliente?.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         p.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'Todos' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Em preparação': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'Pronto': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'Em entrega': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Concluído': return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'Cancelado': return 'bg-error/10 text-error border-error/20';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold text-on-surface flex items-center gap-3">
            <ShoppingBag className="text-primary" /> Gestão de Pedidos
          </h1>
          <p className="text-on-surface-variant text-sm">Controle sua produção e entregas em tempo real.</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <div className="flex bg-surface-container-low p-1 rounded-xl border border-surface-container-high">
            <button 
              onClick={() => setViewMode('kanban')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'kanban' ? 'bg-white shadow-sm text-primary' : 'text-on-surface-variant hover:text-primary'}`}
            >
              <LayoutGrid size={18} />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-primary' : 'text-on-surface-variant hover:text-primary'}`}
            >
              <List size={18} />
            </button>
          </div>
          <button 
            onClick={() => { setSelectedPedido(null); setShowModal(true); }}
            className="flex-grow md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
          >
            <Plus size={18} /> Novo Pedido
          </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-surface-container-lowest p-4 rounded-2xl border border-surface-container-high shadow-sm flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-grow w-full">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <input 
            type="text"
            placeholder="Buscar por cliente ou número do pedido..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-surface-container-low border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          {['Todos', 'Em preparação', 'Pronto', 'Em entrega', 'Concluído'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${statusFilter === s ? 'bg-primary text-white border-primary shadow-md' : 'bg-surface-container-low text-on-surface-variant border-surface-container-high hover:text-primary'}`}
            >
              {s}
            </button>
          ))}
        </div>
        <button 
          onClick={fetchPedidos}
          className="p-2.5 text-on-surface-variant hover:bg-surface-container-low rounded-xl transition-all border border-surface-container-high"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-grow overflow-hidden">
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center gap-4 text-on-surface-variant">
            <RefreshCw size={48} className="animate-spin opacity-20" />
            <p className="text-sm font-medium">Carregando seus pedidos...</p>
          </div>
        ) : viewMode === 'kanban' ? (
          <div className="h-full overflow-y-auto pr-2 custom-scrollbar">
            <KanbanBoard 
              pedidos={filteredPedidos} 
              onStatusChange={handleStatusChange}
              onOrderClick={(p) => { setSelectedPedido(p); setShowDetails(true); }}
            />
          </div>
        ) : (
          <div className="bg-surface-container-lowest rounded-2xl border border-surface-container-high shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low/50 border-b border-surface-container-high">
                  <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Pedido</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Cliente</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Status</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest text-center">Itens</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Total</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-high">
                {filteredPedidos.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-12 text-center text-on-surface-variant italic">Nenhum pedido encontrado.</td></tr>
                ) : (
                  filteredPedidos.map((pedido) => (
                    <tr key={pedido.id} className="hover:bg-surface-container-low/30 transition-colors group">
                      <td className="px-6 py-4">
                        <p className="font-mono text-xs text-on-surface-variant">#{pedido.id.slice(0, 8)}</p>
                        <p className="text-[10px] text-on-surface-variant mt-0.5">
                          {format(parseISO(pedido.data_pedido), 'dd/MM/yyyy HH:mm')}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                            {pedido.cliente?.nome.charAt(0)}
                          </div>
                          <p className="font-bold text-on-surface text-sm">{pedido.cliente?.nome}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${getStatusBadge(pedido.status)}`}>
                          {pedido.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-1.5 text-xs text-on-surface">
                          <Package size={14} className="text-on-surface-variant" />
                          {pedido.itens?.length || 0}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-bold text-sm text-on-surface">{formatCurrency(pedido.valor_total)}</p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => { setSelectedPedido(pedido); setShowDetails(true); }}
                          className="p-2 text-on-surface-variant hover:bg-surface-container-low rounded-lg transition-all"
                        >
                          <ChevronRight size={18} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {showModal && (
        <OrderModal 
          pedido={selectedPedido} 
          onClose={() => setShowModal(false)} 
          onSave={() => { fetchPedidos(); setShowModal(false); }} 
        />
      )}

      {showDetails && selectedPedido && (
        <OrderDetails 
          pedido={selectedPedido} 
          onClose={() => setShowDetails(false)} 
          onEdit={() => { setShowDetails(false); setShowModal(true); }} 
        />
      )}
    </div>
  );
};
