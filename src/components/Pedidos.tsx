import React, { useState } from 'react';
import { Pedido } from '../types';
import { 
  ShoppingBag, 
  Plus, 
  Search, 
  LayoutGrid, 
  List, 
  Download, 
  RefreshCw,
  ChevronRight,
  Package,
  Calendar as CalendarIcon,
  Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCurrency } from '../services/bakeryService';
import { format, parseISO } from 'date-fns';
import { KanbanBoard } from './Orders/KanbanBoard';
import { OrderModal } from './Orders/OrderModal';
import { OrderDetails } from './Orders/OrderDetails';
import { CalendarView } from './Orders/CalendarView';
import { exportToCSV } from '../utils/csvUtils';
import { usePedidos, useUpdatePedidoStatus, useRecalculateEverything } from '../hooks/useQueries';

export const Pedidos = () => {
  const { data: pedidos = [], isLoading: loading } = usePedidos();
  const updateStatusMutation = useUpdatePedidoStatus();
  const recalculateEverythingMutation = useRecalculateEverything();

  const [viewMode, setViewMode] = useState<'kanban' | 'list' | 'calendar'>('kanban');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('Todos');
  
  const [showModal, setShowModal] = useState(false);
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleExportCSV = () => {
    setIsExporting(true);
    try {
      const mappedData = pedidos.map(p => ({
        id: p.id,
        data_pedido: format(parseISO(p.data_pedido), 'dd/MM/yyyy HH:mm'),
        data_entrega: format(parseISO(p.data_entrega), 'dd/MM/yyyy'),
        cliente: p.cliente?.nome || 'Cliente Removido',
        status: p.status,
        prioridade: p.prioridade || 'Normal',
        valor_total: p.valor_total,
        observacoes: (p.observacoes || '').replace(/\n/g, ' ')
      }));

      const success = exportToCSV(
        mappedData,
        {
          id: 'ID do Pedido',
          data_pedido: 'Data do Pedido',
          data_entrega: 'Data de Entrega',
          cliente: 'Nome do Cliente',
          status: 'Status',
          prioridade: 'Prioridade',
          valor_total: 'Valor Total',
          observacoes: 'Observações'
        },
        'pedidos_completo'
      );
      if (success) toast.success('Relatório completo de pedidos exportado!');
    } catch (error: unknown) {
      console.error('Erro ao exportar CSV:', error);
      toast.error('Erro ao exportar CSV');
    } finally {
      setIsExporting(false);
    }
  };

  const handleRecalculate = async () => {
    recalculateEverythingMutation.mutate();
  };

  const handleStatusChange = async (pedidoId: string, newStatus: Pedido['status']) => {
    updateStatusMutation.mutate({ pedidoId, status: newStatus });
  };

  const filteredPedidos = pedidos.filter(p => {
    const matchesSearch = p.cliente?.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         p.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'Todos' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: Pedido['status']) => {
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
            <button 
              onClick={() => setViewMode('calendar')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'calendar' ? 'bg-white shadow-sm text-primary' : 'text-on-surface-variant hover:text-primary'}`}
            >
              <CalendarIcon size={18} />
            </button>
          </div>
          <button 
            onClick={handleExportCSV}
            disabled={isExporting}
            className="hidden md:flex items-center gap-2 bg-white text-on-surface px-4 py-2.5 rounded-xl font-bold border border-surface-container-high shadow-sm hover:bg-surface-container-low transition-all text-xs disabled:opacity-50"
          >
            <Download size={18} /> Exportar CSV
          </button>
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
          {['Todos', 'Em preparação', 'Pronto', 'Em entrega', 'Concluído', 'Cancelado'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${statusFilter === s ? 'bg-primary text-white border-primary shadow-md' : 'bg-surface-container-low text-on-surface-variant border-surface-container-high hover:text-primary'}`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex gap-2 ml-auto">
          <button 
            onClick={handleRecalculate}
            disabled={recalculateEverythingMutation.isPending}
            className="flex items-center gap-2 px-4 py-2.5 bg-surface-container-low text-primary font-bold rounded-xl border border-primary/20 hover:bg-primary/5 transition-all text-xs disabled:opacity-50"
            title="Sincroniza custos de produtos e métricas de clientes"
          >
            <RefreshCw size={16} className={recalculateEverythingMutation.isPending ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">{recalculateEverythingMutation.isPending ? 'Recalculando...' : 'Recalcular Tudo'}</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-grow overflow-hidden">
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center gap-4 text-on-surface-variant">
            <Loader2 size={48} className="animate-spin opacity-20" />
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
        ) : viewMode === 'calendar' ? (
          <div className="h-full">
            <CalendarView 
              pedidos={filteredPedidos}
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
                  <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Entrega</th>
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
                        <p className="font-bold text-xs text-on-surface flex items-center gap-2">
                          <CalendarIcon size={12} className="text-primary" />
                          {format(parseISO(pedido.data_entrega), 'dd/MM/yyyy')}
                        </p>
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
          onSave={() => { setShowModal(false); }} 
        />
      )}

      {showDetails && selectedPedido && (
        <OrderDetails 
          pedido={selectedPedido} 
          onClose={() => setShowDetails(false)} 
          onEdit={() => { setShowDetails(false); setShowModal(true); }} 
          onDelete={() => { setShowDetails(false); }}
        />
      )}
    </div>
  );
};
