import React from 'react';
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects
} from '@dnd-kit/core';
import { 
  arrayMove, 
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Pedido } from '../../types';
import { formatCurrency } from '../../services/bakeryService';
import { ptBR } from 'date-fns/locale';
import { format, parseISO } from 'date-fns';
import { Calendar as CalendarIcon, Clock, User, Package, AlertCircle } from 'lucide-react';

interface KanbanBoardProps {
  pedidos: Pedido[];
  onStatusChange: (pedidoId: string, newStatus: Pedido['status']) => void;
  onOrderClick: (pedido: Pedido) => void;
}

const COLUMNS: Pedido['status'][] = ['Em preparação', 'Pronto', 'Em entrega', 'Concluído', 'Cancelado'];

export const KanbanBoard = ({ pedidos, onStatusChange, onOrderClick }: KanbanBoardProps) => {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    // If dropped over a column
    if (COLUMNS.includes(overId as Pedido['status'])) {
      onStatusChange(activeId, overId as Pedido['status']);
    } 
    // If dropped over another item
    else {
      const overPedido = pedidos.find(p => p.id === overId);
      if (overPedido && overPedido.status !== pedidos.find(p => p.id === activeId)?.status) {
        onStatusChange(activeId, overPedido.status);
      }
    }
  };

  return (
    <DndContext 
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 h-full min-h-[600px]">
        {COLUMNS.map(status => (
          <KanbanColumn 
            key={status} 
            status={status} 
            pedidos={pedidos.filter(p => p.status === status)} 
            onOrderClick={onOrderClick}
          />
        ))}
      </div>
    </DndContext>
  );
};

const KanbanColumn: React.FC<{ status: Pedido['status'], pedidos: Pedido[], onOrderClick: (p: Pedido) => void }> = ({ status, pedidos, onOrderClick }) => {
  const { setNodeRef } = useSortable({ id: status || 'unknown' });

  const getStatusColor = (s: string) => {
    switch (s) {
      case 'Em preparação': return 'bg-amber-500';
      case 'Pronto': return 'bg-emerald-500';
      case 'Em entrega': return 'bg-blue-500';
      case 'Concluído': return 'bg-slate-500';
      case 'Cancelado': return 'bg-error';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div ref={setNodeRef} className="flex flex-col gap-4 bg-surface-container-low/30 rounded-3xl p-4 border border-surface-container-high min-h-[500px]">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${getStatusColor(status)}`} />
          <h3 className="font-bold text-sm text-on-surface">{status}</h3>
        </div>
        <span className="px-2 py-0.5 bg-surface-container-high rounded-full text-[10px] font-bold text-on-surface-variant">
          {pedidos.length}
        </span>
      </div>

      <SortableContext items={pedidos.map(p => p.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-3">
          {pedidos.map(pedido => (
            <SortableOrderCard 
              key={pedido.id} 
              pedido={pedido} 
              onClick={() => onOrderClick(pedido)} 
            />
          ))}
          {pedidos.length === 0 && (
            <div className="py-12 text-center border-2 border-dashed border-surface-container-high rounded-2xl">
              <p className="text-[10px] text-on-surface-variant italic">Arraste aqui</p>
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
};

const SortableOrderCard: React.FC<{ pedido: Pedido, onClick: () => void }> = ({ pedido, onClick }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: pedido.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 100 : 1,
  };

  const getPriorityColor = (p?: string) => {
    switch (p) {
      case 'Urgente': return 'bg-error/10 text-error border-error/20';
      case 'Baixa': return 'bg-slate-100 text-slate-600 border-slate-200';
      default: return 'bg-primary/10 text-primary border-primary/20';
    }
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      {...listeners}
      onClick={onClick}
      className="bg-surface-container-lowest p-4 rounded-2xl border border-surface-container-high shadow-sm hover:shadow-md hover:border-primary/30 transition-all cursor-pointer group"
    >
      <div className="flex justify-between items-start mb-3">
        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wider ${getPriorityColor(pedido.prioridade)}`}>
          {pedido.prioridade || 'Padrão'}
        </span>
        <p className="text-[10px] font-mono text-on-surface-variant">#{pedido.id.slice(0, 5)}</p>
      </div>

      <h4 className="font-bold text-sm text-on-surface mb-1 group-hover:text-primary transition-colors">
        {pedido.cliente?.nome || 'Cliente Indefinido'}
      </h4>

      <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-surface-container-high">
        <div className="flex items-center gap-1.5 text-[10px] text-on-surface-variant">
          <Package size={12} />
          <span>{pedido.itens?.length || 0} itens</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-on-surface-variant font-bold">
          <CalendarIcon size={12} className="text-primary" />
          <span>Entrega: {format(parseISO(pedido.data_entrega), 'dd/MM/yy')}</span>
        </div>
      </div>

      <div className="mt-3 flex justify-between items-center">
        <p className="text-sm font-black text-on-surface">{formatCurrency(pedido.valor_total)}</p>
        {pedido.prioridade === 'Urgente' && (
          <AlertCircle size={14} className="text-error animate-pulse" />
        )}
      </div>
    </div>
  );
};
