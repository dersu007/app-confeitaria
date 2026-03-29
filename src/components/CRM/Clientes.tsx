import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Cliente, Pedido } from '../../types';
import { 
  Users, 
  UserPlus, 
  Search, 
  Filter, 
  Download, 
  MoreHorizontal, 
  Calendar, 
  TrendingUp, 
  Lightbulb,
  ChevronRight,
  Star,
  Clock,
  ShoppingBag
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCurrency } from '../../services/bakeryService';
import { format, differenceInDays, parseISO, isAfter, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const Clientes = () => {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'Todos' | 'VIP' | 'Frequente' | 'Novo' | 'Inativo'>('Todos');
  const [showModal, setShowModal] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);

  useEffect(() => {
    fetchClientes();
  }, []);

  const fetchClientes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .order('nome');
    
    if (error) {
      toast.error('Erro ao carregar clientes');
    } else {
      setClientes(data || []);
    }
    setLoading(false);
  };

  const filteredClientes = clientes.filter(c => {
    const matchesSearch = c.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         c.telefone?.includes(searchTerm);
    const matchesFilter = activeFilter === 'Todos' || c.segmento === activeFilter;
    return matchesSearch && matchesFilter;
  });

  const getSegmentColor = (segmento: string) => {
    switch (segmento) {
      case 'VIP': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'Frequente': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Novo': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'Inativo': return 'bg-slate-100 text-slate-700 border-slate-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const calculateRebuyProbability = (cliente: Cliente) => {
    if (!cliente.ultima_compra) return 0;
    const daysSinceLast = differenceInDays(new Date(), parseISO(cliente.ultima_compra));
    const frequency = cliente.total_pedidos / Math.max(1, differenceInDays(new Date(), parseISO(cliente.data_cadastro)) / 30);
    
    // Simple heuristic: high if frequent and bought recently
    let score = 0;
    if (daysSinceLast < 7) score += 40;
    else if (daysSinceLast < 15) score += 20;
    else if (daysSinceLast > 60) score -= 20;

    score += Math.min(60, frequency * 20);
    
    return Math.max(5, Math.min(95, score));
  };

  const getUpcomingBirthdays = () => {
    const today = new Date();
    return clientes.filter(c => {
      if (!c.data_nascimento) return false;
      const bday = parseISO(c.data_nascimento);
      const bdayThisYear = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());
      const diff = differenceInDays(bdayThisYear, today);
      return diff >= 0 && diff <= 30;
    }).sort((a, b) => {
      const bdayA = parseISO(a.data_nascimento!);
      const bdayB = parseISO(b.data_nascimento!);
      return bdayA.getMonth() - bdayB.getMonth() || bdayA.getDate() - bdayB.getDate();
    });
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full">
      {/* Main Content */}
      <div className="flex-grow space-y-6">
        {/* Header & Stats */}
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-bold text-on-surface">Gestão de Clientes</h1>
            <p className="text-on-surface-variant text-sm">Acompanhe o relacionamento e fidelidade da sua base.</p>
          </div>
          <button 
            onClick={() => { setEditingCliente(null); setShowModal(true); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
          >
            <UserPlus size={18} /> Novo Cliente
          </button>
        </div>

        {/* Filters & Search */}
        <div className="bg-surface-container-lowest p-4 rounded-2xl border border-surface-container-high shadow-sm flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-grow w-full">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
            <input 
              type="text"
              placeholder="Buscar por nome, email ou telefone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-surface-container-low border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="flex gap-1 bg-surface-container-low p-1 rounded-xl border border-surface-container-high w-full md:w-auto overflow-x-auto">
            {['Todos', 'VIP', 'Frequente', 'Novo', 'Inativo'].map((f) => (
              <button
                key={f}
                onClick={() => setActiveFilter(f as any)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${activeFilter === f ? 'bg-white shadow-sm text-primary' : 'text-on-surface-variant hover:text-primary'}`}
              >
                {f}
              </button>
            ))}
          </div>
          <button className="p-2.5 text-on-surface-variant hover:bg-surface-container-low rounded-xl transition-all border border-surface-container-high">
            <Download size={18} />
          </button>
        </div>

        {/* Table */}
        <div className="bg-surface-container-lowest rounded-2xl border border-surface-container-high shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low/50 border-b border-surface-container-high">
                <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Cliente</th>
                <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest text-center">Pedidos</th>
                <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">LTV (Total)</th>
                <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Última Compra</th>
                <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-high">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-on-surface-variant">Carregando clientes...</td></tr>
              ) : filteredClientes.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-on-surface-variant">Nenhum cliente encontrado.</td></tr>
              ) : (
                filteredClientes.map((cliente) => (
                  <tr key={cliente.id} className="hover:bg-surface-container-low/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                          {cliente.nome.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-on-surface text-sm">{cliente.nome}</p>
                          <p className="text-xs text-on-surface-variant">{cliente.email || cliente.telefone || 'Sem contato'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${getSegmentColor(cliente.segmento)}`}>
                        {cliente.segmento}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center font-medium text-sm text-on-surface">
                      {cliente.total_pedidos}
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-bold text-sm text-on-surface">{formatCurrency(cliente.valor_total_gasto)}</p>
                      <p className="text-[10px] text-on-surface-variant">Ticket: {formatCurrency(cliente.ticket_medio)}</p>
                    </td>
                    <td className="px-6 py-4">
                      {cliente.ultima_compra ? (
                        <div>
                          <p className="text-sm text-on-surface">{format(parseISO(cliente.ultima_compra), 'dd MMM yyyy', { locale: ptBR })}</p>
                          <p className="text-[10px] text-on-surface-variant">{cliente.dias_desde_ultima_compra} dias atrás</p>
                        </div>
                      ) : (
                        <span className="text-xs text-on-surface-variant italic">Nunca comprou</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => { setEditingCliente(cliente); setShowModal(true); }}
                        className="p-2 text-on-surface-variant hover:bg-surface-container-low rounded-lg transition-all"
                      >
                        <MoreHorizontal size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sidebar Insights */}
      <div className="w-full lg:w-80 space-y-6">
        {/* Upcoming Birthdays */}
        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container-high shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-pink-100 text-pink-600 rounded-lg">
              <Calendar size={18} />
            </div>
            <h3 className="font-bold text-on-surface">Aniversariantes</h3>
          </div>
          <div className="space-y-3">
            {getUpcomingBirthdays().length === 0 ? (
              <p className="text-xs text-on-surface-variant italic">Nenhum aniversário nos próximos 30 dias.</p>
            ) : (
              getUpcomingBirthdays().map(c => (
                <div key={c.id} className="flex items-center justify-between p-2 hover:bg-surface-container-low rounded-xl transition-all">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-pink-50 flex items-center justify-center text-pink-500 text-xs font-bold">
                      {c.nome.charAt(0)}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-on-surface">{c.nome}</p>
                      <p className="text-[10px] text-on-surface-variant">
                        {format(parseISO(c.data_nascimento!), 'dd/MM')}
                      </p>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-on-surface-variant" />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Repurchase Probability */}
        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container-high shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
              <TrendingUp size={18} />
            </div>
            <h3 className="font-bold text-on-surface">Tendência de Recompra</h3>
          </div>
          <div className="space-y-4">
            {clientes.slice(0, 3).map(c => {
              const prob = calculateRebuyProbability(c);
              return (
                <div key={c.id} className="space-y-1.5">
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                    <span className="text-on-surface">{c.nome}</span>
                    <span className={prob > 70 ? 'text-emerald-600' : prob > 40 ? 'text-blue-600' : 'text-amber-600'}>
                      {prob}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-surface-container-high rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-1000 ${prob > 70 ? 'bg-emerald-500' : prob > 40 ? 'bg-blue-500' : 'bg-amber-500'}`}
                      style={{ width: `${prob}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Product Suggestions */}
        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container-high shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
              <Lightbulb size={18} />
            </div>
            <h3 className="font-bold text-on-surface">Sugestão de Produto</h3>
          </div>
          <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-white rounded-lg shadow-sm">
                <ShoppingBag size={16} className="text-amber-600" />
              </div>
              <p className="text-xs font-bold text-amber-900">Combo Café da Manhã</p>
            </div>
            <p className="text-[10px] text-amber-800 leading-relaxed">
              Baseado no histórico de 12 clientes VIPs, este combo tem 85% de chance de conversão para novos clientes.
            </p>
            <button className="mt-3 w-full py-1.5 bg-white text-amber-900 text-[10px] font-bold rounded-lg border border-amber-200 hover:bg-amber-100 transition-all">
              Ver Detalhes
            </button>
          </div>
        </div>
      </div>

      {/* Modal Placeholder */}
      {showModal && (
        <ClienteModal 
          cliente={editingCliente} 
          onClose={() => setShowModal(false)} 
          onSave={() => { fetchClientes(); setShowModal(false); }} 
        />
      )}
    </div>
  );
};

// Cliente Modal Component
const ClienteModal = ({ cliente, onClose, onSave }: { cliente: Cliente | null, onClose: () => void, onSave: () => void }) => {
  const [formData, setFormData] = useState({
    nome: cliente?.nome || '',
    email: cliente?.email || '',
    telefone: cliente?.telefone || '',
    data_nascimento: cliente?.data_nascimento || '',
    observacoes: cliente?.observacoes || ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clean up data: convert empty strings to null for optional fields
    const submissionData = {
      nome: formData.nome,
      email: formData.email || null,
      telefone: formData.telefone || null,
      data_nascimento: formData.data_nascimento || null,
      observacoes: formData.observacoes || null
    };

    const { error } = cliente 
      ? await supabase.from('clientes').update(submissionData).eq('id', cliente.id)
      : await supabase.from('clientes').insert([submissionData]);

    if (error) {
      console.error('Erro detalhado do Supabase:', error);
      toast.error(`Erro ao salvar: ${error.message}`);
    } else {
      toast.success(cliente ? 'Cliente atualizado' : 'Cliente cadastrado');
      onSave();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface-container-lowest w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-surface-container-high animate-in fade-in zoom-in duration-200">
        <div className="p-6 border-b border-surface-container-high flex justify-between items-center">
          <h2 className="text-xl font-bold text-on-surface">{cliente ? 'Editar Cliente' : 'Novo Cliente'}</h2>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface">Fechar</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Nome Completo *</label>
            <input 
              required
              type="text" 
              value={formData.nome}
              onChange={e => setFormData({...formData, nome: e.target.value})}
              className="w-full px-4 py-2.5 bg-surface-container-low border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Email</label>
              <input 
                type="email" 
                value={formData.email}
                onChange={e => setFormData({...formData, email: e.target.value})}
                className="w-full px-4 py-2.5 bg-surface-container-low border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Telefone</label>
              <input 
                type="text" 
                value={formData.telefone}
                onChange={e => setFormData({...formData, telefone: e.target.value})}
                className="w-full px-4 py-2.5 bg-surface-container-low border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Data de Nascimento</label>
            <input 
              type="date" 
              value={formData.data_nascimento}
              onChange={e => setFormData({...formData, data_nascimento: e.target.value})}
              className="w-full px-4 py-2.5 bg-surface-container-low border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Observações</label>
            <textarea 
              rows={3}
              value={formData.observacoes}
              onChange={e => setFormData({...formData, observacoes: e.target.value})}
              className="w-full px-4 py-2.5 bg-surface-container-low border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20 resize-none"
            />
          </div>
          <div className="pt-4 flex gap-3">
            <button 
              type="button"
              onClick={onClose}
              className="flex-grow py-3 bg-surface-container-low text-on-surface font-bold rounded-xl hover:bg-surface-container-high transition-all"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              className="flex-grow py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
            >
              Salvar Cliente
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
