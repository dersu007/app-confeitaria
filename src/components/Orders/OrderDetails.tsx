import React from 'react';
import { Pedido, PedidoItem, PedidoExtra } from '../../types';
import { 
  X, 
  Package, 
  DollarSign, 
  Calendar, 
  Clock, 
  Tag, 
  Info,
  TrendingUp,
  ChevronRight,
  User,
  ShoppingBag,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { formatCurrency } from '../../services/bakeryService';
import { dataService } from '../../services/dataService';
import toast from 'react-hot-toast';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface OrderDetailsProps {
  pedido: Pedido;
  onClose: () => void;
  onEdit: () => void;
  onDelete?: () => void;
}

export const OrderDetails = ({ pedido, onClose, onEdit, onDelete }: OrderDetailsProps) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await dataService.deleteEntity('pedidos', pedido.id);
      toast.success('Pedido excluído com sucesso');
      onDelete?.();
      onClose();
    } catch (error) {
      toast.error('Erro ao excluir pedido');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const totalCusto = pedido.itens?.reduce((acc, item) => acc + (item.custo_unitario * item.quantidade), 0) || 0;
  const margem = pedido.valor_total - totalCusto;
  const margemPercentual = (margem / pedido.valor_total) * 100;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface-container-lowest w-full max-w-3xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden border border-surface-container-high flex flex-col animate-in fade-in zoom-in duration-200">
        <div className="p-6 border-b border-surface-container-high flex justify-between items-center bg-surface-container-low/50">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 text-primary rounded-2xl">
              <ShoppingBag size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-on-surface">Pedido #{pedido.id.slice(0, 8)}</h2>
              <p className="text-xs text-on-surface-variant">
                {format(parseISO(pedido.data_pedido), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2.5 text-error hover:bg-error/10 rounded-xl transition-all"
              title="Excluir Pedido"
            >
              <Trash2 size={20} />
            </button>
            <button 
              onClick={onEdit}
              className="px-4 py-2 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition-all text-xs"
            >
              Editar Pedido
            </button>
            <button onClick={onClose} className="p-2 hover:bg-surface-container-high rounded-full transition-all">
              <X size={20} className="text-on-surface-variant" />
            </button>
          </div>
        </div>

        {/* Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="absolute inset-0 z-[60] bg-surface/80 backdrop-blur-sm flex items-center justify-center p-6 bg-slate-900/40">
            <div className="bg-white p-8 rounded-3xl shadow-2xl border border-surface-container-high max-w-sm w-full text-center animate-in zoom-in duration-200">
              <div className="w-16 h-16 bg-error/10 text-error rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-xl font-bold text-on-surface mb-2">Excluir Pedido?</h3>
              <p className="text-on-surface-variant text-sm mb-8 leading-relaxed">
                Esta ação não pode ser desfeita. O histórico do pedido e as métricas do cliente serão afetados.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-3 bg-surface-container-low text-on-surface font-bold rounded-xl hover:bg-surface-container-high transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-3 bg-error text-white font-bold rounded-xl hover:bg-error/90 transition-all shadow-lg shadow-error/20 flex items-center justify-center gap-2"
                >
                  {isDeleting ? 'Excluindo...' : 'Sim, Excluir'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex-grow overflow-y-auto p-8 space-y-10">
          {/* Header Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-surface-container-low/50 p-5 rounded-3xl border border-surface-container-high">
              <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1 flex items-center gap-1.5">
                <User size={12} /> Cliente
              </p>
              <p className="font-bold text-on-surface">{pedido.cliente?.nome}</p>
              <p className="text-xs text-on-surface-variant mt-1">{pedido.cliente?.telefone || 'Sem contato'}</p>
            </div>
            <div className="bg-surface-container-low/50 p-5 rounded-3xl border border-surface-container-high">
              <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1 flex items-center gap-1.5">
                <Clock size={12} /> Status & Prioridade
              </p>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded-full border border-primary/20">
                  {pedido.status}
                </span>
                <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full border border-amber-200">
                  {pedido.prioridade}
                </span>
              </div>
              <p className="text-xs text-on-surface-variant mt-1.5">Estimativa: {pedido.tempo_estimado || 'N/A'}</p>
            </div>
            <div className="bg-primary/5 p-5 rounded-3xl border border-primary/10">
              <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1 flex items-center gap-1.5">
                <TrendingUp size={12} /> Margem Estimada
              </p>
              <p className="text-xl font-black text-primary">{formatCurrency(margem)}</p>
              <p className="text-xs font-bold text-primary/70 mt-1">{margemPercentual.toFixed(1)}% de margem</p>
            </div>
          </div>

          {/* Items Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
              <Package size={16} className="text-primary" /> Produtos do Pedido
            </h3>
            <div className="bg-surface-container-low/30 rounded-3xl border border-surface-container-high overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low/50 border-b border-surface-container-high">
                    <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Produto</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest text-center">Qtd</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Preço Un.</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-high">
                  {pedido.itens?.map((item, index) => (
                    <tr key={index} className="hover:bg-surface-container-low/50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-on-surface">{item.produto?.nome}</p>
                        <p className="text-[10px] text-on-surface-variant">Custo: {formatCurrency(item.custo_unitario)}</p>
                      </td>
                      <td className="px-6 py-4 text-center text-sm font-medium text-on-surface">
                        {item.quantidade}
                      </td>
                      <td className="px-6 py-4 text-sm text-on-surface">
                        {formatCurrency(item.preco_unitario)}
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-bold text-primary">
                        {formatCurrency(item.subtotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Extras Section */}
          {pedido.extras && pedido.extras.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
                <DollarSign size={16} className="text-primary" /> Custos Adicionais
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pedido.extras.map((extra, index) => (
                  <div key={index} className="p-4 bg-surface-container-low/30 rounded-2xl border border-surface-container-high flex justify-between items-center">
                    <div>
                      <p className="text-xs font-bold text-on-surface">{extra.descricao}</p>
                      <p className="text-[10px] text-on-surface-variant uppercase tracking-widest mt-0.5">{extra.categoria}</p>
                    </div>
                    <p className="text-sm font-bold text-on-surface">{formatCurrency(extra.valor)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Observations */}
          {pedido.observacoes && (
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
                <Info size={16} className="text-primary" /> Observações
              </h3>
              <div className="p-5 bg-surface-container-low/30 rounded-3xl border border-surface-container-high">
                <p className="text-sm text-on-surface-variant leading-relaxed italic">
                  "{pedido.observacoes}"
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-8 border-t border-surface-container-high bg-surface-container-low/50 flex justify-between items-center">
          <div>
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Total do Pedido</p>
            <p className="text-3xl font-black text-primary">{formatCurrency(pedido.valor_total)}</p>
          </div>
          <button 
            onClick={onClose}
            className="px-10 py-3 bg-surface-container-high text-on-surface font-bold rounded-2xl hover:bg-surface-container-highest transition-all"
          >
            Fechar Detalhes
          </button>
        </div>
      </div>
    </div>
  );
};
