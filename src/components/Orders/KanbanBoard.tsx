import React from 'react';
import { 
  useDroppable,
  useDraggable,
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  defaultDropAnimationSideEffects
} from '@dnd-kit/core';
import { 
  sortableKeyboardCoordinates, 
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Pedido } from '../../types';
import { formatCurrency } from '../../services/bakeryService';
import { format, parseISO } from 'date-fns';
import { Calendar as CalendarIcon, Package, AlertCircle } from 'lucide-react';

interface KanbanBoardProps {
  pedidos: Pedido[];
  onStatusChange: (pedidoId: string, newStatus: Pedido['status']) => void;
  onOrderClick: (pedido: Pedido) => void;
}

const COLUMNS: Pedido['status'][] = ['Em preparação', 'Pronto', 'Em entrega', 'Concluído', 'Cancelado'];

export const KanbanBoard = ({ pedidos, onStatusChange, onOrderClick }: KanbanBoardProps) => {
  const [activeId, setActiveId] = React.useState<string | null>(null);

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

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    
    if (!over) return;

    const pedidoId = active.id as string;
    const newStatus = over.id as Pedido['status'];

    if (COLUMNS.includes(newStatus)) {
      const pedido = pedidos.find(p => p.id === pedidoId);
      if (pedido && pedido.status !== newStatus) {
        onStatusChange(pedidoId, newStatus);
      }
    }
  };

  const activePedido = activeId ? pedidos.find(p => p.id === activeId) : null;

  return (
    <DndContext 
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
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

      <DragOverlay dropAnimation={{
        sideEffects: defaultDropAnimationSideEffects({
          styles: {
            active: {
              opacity: '0.5',
            },
          },
        }),
      }}>
        {activePedido ? (
          <div className="opacity-80 scale-105 rotate-2 shadow-2xl pointer-events-none">
            <OrderCard pedido={activePedido} onClick={() => {}} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

const KanbanColumn: React.FC<{ status: Pedido['status'], pedidos: Pedido[], onOrderClick: (p: Pedido) => void }> = ({ status, pedidos, onOrderClick }) => {
  const { setNodeRef, isOver } = useDroppable({ id: status });

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
    <div 
      ref={setNodeRef} 
      className={`flex flex-col gap-4 bg-surface-container-low/30 rounded-3xl p-4 border transition-all duration-300 min-h-[500px] ${
        isOver ? 'border-primary bg-primary/5 shadow-inner scale-[1.02]' : 'border-surface-container-high'
      }`}
    >
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${getStatusColor(status)}`} />
          <h3 className="font-bold text-sm text-on-surface">{status}</h3>
        </div>
        <span className="px-2 py-0.5 bg-surface-container-high rounded-full text-[10px] font-bold text-on-surface-variant">
          {pedidos.length}
        </span>
      </div>

      <div className="flex flex-col gap-3 flex-grow">
        {pedidos.map(pedido => (
          <DraggableOrderCard 
            key={pedido.id} 
            pedido={pedido} 
            onClick={() => onOrderClick(pedido)} 
          />
        ))}
        {pedidos.length === 0 && (
          <div className={`flex-grow flex items-center justify-center border-2 border-dashed rounded-2xl transition-colors ${
            isOver ? 'border-primary/50 text-primary' : 'border-surface-container-high text-on-surface-variant'
          }`}>
            <p className="text-[10px] italic">Arraste aqui</p>
          </div>
        )}
      </div>
    </div>
  );
};

const DraggableOrderCard: React.FC<{ pedido: Pedido, onClick: () => void }> = ({ pedido, onClick }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: pedido.id,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0 : 1,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      {...listeners}
      onClick={() => {
        // Prevent click if dragging
        if (transform) return;
        onClick();
      }}
    >
      <OrderCard pedido={pedido} onClick={onClick} />
    </div>
  );
};

const OrderCard: React.FC<{ pedido: Pedido, onClick: () => void }> = ({ pedido }) => {
  const getPriorityColor = (p?: string) => {
    switch (p) {
      case 'Urgente': return 'bg-error/10 text-error border-error/20';
      case 'Baixa': return 'bg-slate-100 text-slate-600 border-slate-200';
      default: return 'bg-primary/10 text-primary border-primary/20';
    }
  };

  return (
    <div className="bg-surface-container-lowest p-4 rounded-2xl border border-surface-container-high shadow-sm hover:shadow-md hover:border-primary/30 transition-all cursor-pointer group select-none">
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
          <span>Entrega: {pedido.data_entrega ? format(parseISO(pedido.data_entrega), 'dd/MM/yy') : '-'}</span>
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
