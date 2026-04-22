import React, { useState } from 'react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths,
  parseISO
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Clock, User } from 'lucide-react';
import { Pedido } from '../../types';

interface CalendarViewProps {
  pedidos: Pedido[];
  onOrderClick: (pedido: Pedido) => void;
}

export const CalendarView = ({ pedidos, onOrderClick }: CalendarViewProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  const getPedidosForDay = (day: Date) => {
    return pedidos.filter(pedido => {
      if (!pedido.data_entrega) return false;
      const deliveryDate = parseISO(pedido.data_entrega);
      return isSameDay(deliveryDate, day);
    });
  };

  return (
    <div className="bg-surface-container-lowest rounded-3xl border border-surface-container-high shadow-sm overflow-hidden flex flex-col h-full animate-in fade-in duration-500">
      {/* Calendar Header */}
      <div className="p-6 border-b border-surface-container-high flex justify-between items-center bg-surface-container-low/30">
        <h2 className="text-xl font-bold text-on-surface headline">
          {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
        </h2>
        <div className="flex gap-2">
          <button 
            onClick={prevMonth}
            className="p-2 hover:bg-surface-container-high rounded-xl transition-all border border-surface-container-high"
          >
            <ChevronLeft size={20} className="text-on-surface-variant" />
          </button>
          <button 
            onClick={() => setCurrentDate(new Date())}
            className="px-4 py-2 text-xs font-bold text-primary hover:bg-primary/5 rounded-xl transition-all border border-primary/10"
          >
            Hoje
          </button>
          <button 
            onClick={nextMonth}
            className="p-2 hover:bg-surface-container-high rounded-xl transition-all border border-surface-container-high"
          >
            <ChevronRight size={20} className="text-on-surface-variant" />
          </button>
        </div>
      </div>

      {/* Days of Week */}
      <div className="grid grid-cols-7 bg-surface-container-low/50 border-b border-surface-container-high">
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
          <div key={day} className="py-3 text-center">
            <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">{day}</span>
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 flex-grow overflow-y-auto custom-scrollbar">
        {calendarDays.map((day, idx) => {
          const dayPedidos = getPedidosForDay(day);
          const isSelectedMonth = isSameMonth(day, monthStart);
          const isToday = isSameDay(day, new Date());

          return (
            <div 
              key={idx}
              className={`min-h-[120px] p-2 border-r border-b border-surface-container-high last:border-r-0 flex flex-col gap-2 transition-colors ${
                !isSelectedMonth ? 'bg-surface-container-low/20 opacity-40' : 'bg-surface-container-lowest hover:bg-surface-container-low/30'
              }`}
            >
              <div className="flex justify-between items-center mb-1">
                <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-lg ${
                  isToday ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-110' : 'text-on-surface-variant'
                }`}>
                  {format(day, 'd')}
                </span>
                {dayPedidos.length > 0 && (
                  <span className="text-[10px] font-black text-primary bg-primary/10 px-1.5 py-0.5 rounded-md">
                    {dayPedidos.length} {dayPedidos.length === 1 ? 'Pedido' : 'Pedidos'}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-1 overflow-y-auto max-h-[80px] custom-scrollbar-mini">
                {dayPedidos.map(pedido => (
                  <button
                    key={pedido.id}
                    onClick={() => onOrderClick(pedido)}
                    className={`text-left p-1.5 rounded-lg border text-[10px] font-bold transition-all truncate hover:shadow-sm ${
                      pedido.prioridade === 'Urgente' 
                        ? 'bg-error/10 text-error border-error/20 hover:bg-error/20' 
                        : 'bg-primary/5 text-on-surface border-primary/20 hover:bg-primary/10'
                    }`}
                  >
                    <div className="flex items-center gap-1 mb-0.5">
                      <Clock size={10} className="text-primary-variant/50" />
                      <span className="opacity-70">{format(parseISO(pedido.data_pedido), 'HH:mm')}</span>
                    </div>
                    <p className="truncate">{pedido.cliente?.nome}</p>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
