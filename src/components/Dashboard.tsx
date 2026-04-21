import React, { useEffect, useState, useMemo } from 'react';
import { 
  Receipt, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  AlertTriangle,
  ArrowRight,
  Package,
  Users,
  Loader2,
  Calendar
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  format, 
  subDays, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameDay, 
  startOfYear, 
  eachMonthOfInterval,
  isSameMonth,
  startOfWeek,
  endOfWeek,
  eachWeekOfInterval,
  isWithinInterval
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { dataService } from '../services/dataService';
import { Produto, Pedido, Cliente, DespesaFixa } from '../types';
import { formatCurrency } from '../services/bakeryService';

const KPICard = ({ title, value, change, icon: Icon, trend }: any) => (
  <div className="bg-surface-container-lowest p-6 rounded-xl border border-surface-container-high flex flex-col gap-4 shadow-sm">
    <div className="flex justify-between items-start">
      <div className="p-2 bg-primary-container/30 rounded-lg text-primary">
        <Icon size={24} />
      </div>
      {change !== undefined && (
        <span className={`flex items-center text-xs font-bold px-2 py-1 rounded-full ${trend === 'up' ? 'text-primary bg-primary-container/20' : 'text-error bg-error-container/10'}`}>
          {change} {trend === 'up' ? <TrendingUp size={12} className="ml-1" /> : <TrendingDown size={12} className="ml-1" />}
        </span>
      )}
    </div>
    <div>
      <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">{title}</p>
      <h3 className="text-3xl font-extrabold headline mt-1">{value}</h3>
    </div>
  </div>
);

type PeriodoVisao = 'Diário' | 'Semanal' | 'Mensal';

const parseISO = (dateStr: string) => {
  return new Date(dateStr);
};

export const Dashboard = () => {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [despesas, setDespesas] = useState<DespesaFixa[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodoVisao, setPeriodoVisao] = useState<PeriodoVisao>('Diário');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [prodRes, pedRes, cliRes, despRes] = await Promise.all([
          dataService.getProdutos(),
          dataService.getPedidos(),
          dataService.getClientes(),
          dataService.getDespesasFixas()
        ]);
        setProdutos(prodRes);
        setPedidos(pedRes);
        setClientes(cliRes);
        setDespesas(despRes);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const stats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthlyOrders = pedidos.filter(p => {
      const d = parseISO(p.data_pedido);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear && p.status === 'Concluído';
    });

    const faturamentoMensal = monthlyOrders.reduce((acc, p) => acc + (p.valor_total || 0), 0);
    
    let monthlyCosts = 0;
    monthlyOrders.forEach(p => {
      p.itens?.forEach(item => {
        monthlyCosts += (item.custo_unitario || 0) * (item.quantidade || 0);
      });
    });

    const totalDespesasFixas = despesas.reduce((acc, d) => acc + (d.valor_mensal || 0), 0);
    const lucroLiquido = faturamentoMensal - monthlyCosts - totalDespesasFixas;

    const pedidosAtivos = pedidos.filter(p => 
      ['Pendente', 'Em preparação', 'Pronto', 'Em entrega'].includes(p.status)
    ).length;

    const totalConcluidos = pedidos.filter(p => p.status === 'Concluído').length;
    const faturamentoTotal = pedidos.filter(p => p.status === 'Concluído').reduce((acc, p) => acc + (p.valor_total || 0), 0);
    const ticketMedio = totalConcluidos > 0 ? faturamentoTotal / totalConcluidos : 0;

    return {
      faturamentoMensal,
      lucroLiquido,
      pedidosAtivos,
      ticketMedio,
      totalPedidos: pedidos.length
    };
  }, [pedidos, despesas]);

  const salesEvolution = useMemo(() => {
    const now = new Date();
    const completedOrders = pedidos.filter(p => p.status === 'Concluído');

    if (periodoVisao === 'Diário') {
      const last14Days = eachDayOfInterval({
        start: subDays(now, 13),
        end: now
      });

      return last14Days.map(day => {
        const total = completedOrders
          .filter(p => isSameDay(parseISO(p.data_pedido), day))
          .reduce((acc, p) => acc + (p.valor_total || 0), 0);
        
        return {
          name: format(day, 'dd/MM'),
          faturamento: total
        };
      });
    }

    if (periodoVisao === 'Semanal') {
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);
      const weeks = eachWeekOfInterval({ start: monthStart, end: monthEnd }, { weekStartsOn: 0 });

      return weeks.map((weekStart, index) => {
        const weekEnd = endOfWeek(weekStart, { weekStartsOn: 0 });
        const total = completedOrders
          .filter(p => isWithinInterval(parseISO(p.data_pedido), { start: weekStart, end: weekEnd }))
          .reduce((acc, p) => acc + (p.valor_total || 0), 0);
        
        return {
          name: `Sem ${index + 1}`,
          faturamento: total
        };
      });
    }

    if (periodoVisao === 'Mensal') {
      const yearStart = startOfYear(now);
      const months = eachMonthOfInterval({ start: yearStart, end: now });

      return months.map(month => {
        const total = completedOrders
          .filter(p => isSameMonth(parseISO(p.data_pedido), month))
          .reduce((acc, p) => acc + (p.valor_total || 0), 0);
        
        return {
          name: format(month, 'MMM', { locale: ptBR }),
          faturamento: total
        };
      });
    }

    return [];
  }, [pedidos, periodoVisao]);

  const categoryDistribution = useMemo(() => {
    const categoryTotals: Record<string, number> = {};
    let totalValue = 0;

    pedidos
      .filter(p => p.status === 'Concluído')
      .forEach(p => {
        p.itens?.forEach(item => {
          const catName = item.produto?.categoria?.nome || 'Sem Categoria';
          const val = item.subtotal || 0;
          categoryTotals[catName] = (categoryTotals[catName] || 0) + val;
          totalValue += val;
        });
      });

    const sortedData = Object.entries(categoryTotals)
      .map(([name, value]) => ({
        name,
        value,
        percentage: totalValue > 0 ? Math.round((value / totalValue) * 100) : 0
      }))
      .sort((a, b) => b.value - a.value);

    if (sortedData.length <= 5) return sortedData;

    const top5 = sortedData.slice(0, 5);
    const othersValue = sortedData.slice(5).reduce((acc, item) => acc + item.value, 0);
    const othersPercentage = totalValue > 0 ? Math.round((othersValue / totalValue) * 100) : 0;

    return [...top5, { name: 'Outras', value: othersValue, percentage: othersPercentage }];
  }, [pedidos]);

  const topProducts = useMemo(() => {
    const productSales: Record<string, { nome: string, total: number, qtd: number }> = {};

    pedidos
      .filter(p => p.status === 'Concluído')
      .forEach(p => {
        p.itens?.forEach(item => {
          if (!item.produto_id) return;
          if (!productSales[item.produto_id]) {
            productSales[item.produto_id] = { nome: item.produto?.nome || 'Produto Removido', total: 0, qtd: 0 };
          }
          productSales[item.produto_id].total += (item.subtotal || 0);
          productSales[item.produto_id].qtd += (item.quantidade || 0);
        });
      });

    return Object.values(productSales)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [pedidos]);

  const recentOrders = useMemo(() => {
    return [...pedidos]
      .sort((a, b) => new Date(b.data_pedido).getTime() - new Date(a.data_pedido).getTime())
      .slice(0, 5);
  }, [pedidos]);

  const COLORS = ['#2b6a57', '#6a4a2b', '#d2b48c', '#efe0cd', '#b0f0d8', '#8a9a5b'];

  const lowMarginProducts = produtos.filter(p => p.margem_real_calculada < 40);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 size={48} className="text-primary animate-spin" />
        <p className="text-on-surface-variant font-medium animate-pulse">Carregando inteligência de negócio...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Summary Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard title="Pedidos Ativos" value={stats.pedidosAtivos} icon={Receipt} />
        <KPICard title="Faturamento Mensal" value={formatCurrency(stats.faturamentoMensal)} icon={Wallet} />
        <KPICard title="Lucro Líquido" value={formatCurrency(stats.lucroLiquido)} icon={TrendingUp} trend={stats.lucroLiquido >= 0 ? 'up' : 'down'} />
        <KPICard title="Ticket Médio" value={formatCurrency(stats.ticketMedio)} icon={Users} />
      </div>

      {/* Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-surface-container-lowest p-8 rounded-xl border border-surface-container-high shadow-sm">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-8">
            <div>
              <h2 className="text-xl font-bold headline text-on-surface">Evolução de Vendas</h2>
              <p className="text-sm text-on-surface-variant">Visão {periodoVisao.toLowerCase()} de faturamento</p>
            </div>
            
            <div className="flex bg-surface-container-low p-1 rounded-xl border border-surface-container-high shadow-inner">
              {(['Diário', 'Semanal', 'Mensal'] as PeriodoVisao[]).map((periodo) => (
                <button
                  key={periodo}
                  onClick={() => setPeriodoVisao(periodo)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    periodoVisao === periodo 
                      ? 'bg-white text-primary shadow-sm ring-1 ring-black/5' 
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {periodo}
                </button>
              ))}
            </div>
          </div>
          
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesEvolution}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e1e3e2" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#5d605f', fontWeight: 600 }} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#5d605f' }}
                  tickFormatter={(val) => `R$${val >= 1000 ? (val/1000).toFixed(1) + 'k' : val}`}
                />
                <Tooltip 
                  cursor={{ fill: '#f3f4f3', opacity: 0.4 }} 
                  formatter={(value: number) => [formatCurrency(value), 'Faturamento']}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 8px 30px rgba(0,0,0,0.12)', padding: '12px' }}
                  itemStyle={{ fontWeight: 700, fontSize: '12px' }}
                  labelStyle={{ fontWeight: 800, marginBottom: '4px', color: '#2b6a57' }}
                />
                <Bar 
                  dataKey="faturamento" 
                  fill="#2b6a57" 
                  radius={[6, 6, 0, 0]} 
                  animationBegin={200}
                  animationDuration={1000}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-8 rounded-xl border border-surface-container-high shadow-sm flex flex-col">
          <div className="mb-8">
            <h2 className="text-xl font-bold headline text-on-surface">Distribuição</h2>
            <p className="text-sm text-on-surface-variant">Faturamento por categoria</p>
          </div>
          
          <div className="flex-grow flex items-center justify-center relative">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={categoryDistribution}
                  innerRadius={70}
                  outerRadius={95}
                  paddingAngle={6}
                  dataKey="value"
                  animationBegin={400}
                  animationDuration={1200}
                >
                  {categoryDistribution.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={COLORS[index % COLORS.length]} 
                      stroke="none"
                    />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => [formatCurrency(value), 'Faturamento']}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[10px] uppercase font-bold text-on-surface-variant tracking-widest">Total</span>
              <span className="text-lg font-black text-on-surface">100%</span>
            </div>
          </div>
          
          <div className="space-y-3 mt-8">
            {categoryDistribution.map((item, i) => (
              <div key={item.name} className="flex justify-between items-center group">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                  <span className="text-xs font-bold text-on-surface group-hover:text-primary transition-colors">{item.name}</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-black text-on-surface">{item.percentage}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Products & Recent Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-surface-container-lowest rounded-xl border border-surface-container-high overflow-hidden shadow-sm flex flex-col">
          <div className="p-8 border-b border-surface-container-high bg-surface-container-low/30">
            <h2 className="text-xl font-bold headline text-on-surface flex items-center gap-2">
              <TrendingUp className="text-primary" size={20} />
              Top 5 Produtos
            </h2>
            <p className="text-sm text-on-surface-variant">Produtos mais rentáveis</p>
          </div>
          <div className="p-6 flex-grow">
            {topProducts.length > 0 ? (
              <div className="space-y-4">
                {topProducts.map((p, i) => (
                  <div key={i} className="flex items-center justify-between p-4 hover:bg-surface-container-low/50 transition-all rounded-2xl group border border-transparent hover:border-surface-container-high">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                        i === 0 ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-110' : 'bg-surface-container-high text-on-surface-variant'
                      }`}>
                        {i + 1}
                      </div>
                      <span className="text-sm font-bold text-on-surface group-hover:text-primary transition-colors">{p.nome}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-black block text-on-surface">{formatCurrency(p.total)}</span>
                      <span className="text-[10px] font-bold text-on-surface-variant uppercase">{p.qtd} vendidos</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center py-8 text-on-surface-variant italic">Sem dados de vendas.</p>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 bg-surface-container-lowest rounded-xl border border-surface-container-high overflow-hidden shadow-sm">
          <div className="p-8 flex justify-between items-center border-b border-surface-container-high">
            <div>
              <h2 className="text-xl font-bold headline text-on-surface">Últimos Pedidos</h2>
              <p className="text-sm text-on-surface-variant">Fluxo de caixa recente</p>
            </div>
            <button className="bg-surface-container-high text-on-surface px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-surface-container-highest transition-all shadow-sm">
              Lista Completa <ArrowRight size={14} />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-surface-container-low/50">
                  <th className="px-8 py-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest border-r border-surface-container-high/50">ID</th>
                  <th className="px-8 py-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest border-r border-surface-container-high/50">Cliente</th>
                  <th className="px-8 py-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest border-r border-surface-container-high/50">Status</th>
                  <th className="px-8 py-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest text-right">Valor Final</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-high">
                {recentOrders.map(pedido => (
                  <tr key={pedido.id} className="hover:bg-surface-container-low/30 transition-colors group">
                    <td className="px-8 py-5 text-xs font-bold font-mono text-on-surface-variant border-r border-surface-container-high/50">#{pedido.id.slice(0, 8).toUpperCase()}</td>
                    <td className="px-8 py-5">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-on-surface">{pedido.cliente?.nome || 'Cliente não identificado'}</span>
                        <span className="text-[10px] text-on-surface-variant">{format(parseISO(pedido.data_pedido), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5 border-r border-surface-container-high/50">
                      <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider ${
                        pedido.status === 'Concluído' ? 'bg-primary/10 text-primary' : 
                        pedido.status === 'Cancelado' ? 'bg-error/10 text-error' : 
                        'bg-surface-container-low text-on-surface-variant'
                      }`}>
                        {pedido.status}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-sm font-black text-right text-on-surface tabular-nums">
                      {formatCurrency(pedido.valor_total)}
                    </td>
                  </tr>
                ))}
                {recentOrders.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-8 py-10 text-center text-on-surface-variant italic">Nenhum pedido registrado no sistema.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Margin Alerts */}
      {lowMarginProducts.length > 0 && (
        <div className="bg-white rounded-xl border border-error-container/20 overflow-hidden shadow-lg shadow-error/5">
          <div className="p-8 border-b border-error-container/10 bg-error-container/5 flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold headline text-error flex items-center gap-2">
                <AlertTriangle size={24} />
                Alertas de Margem Crítica
              </h2>
              <p className="text-sm text-error/70 font-medium">Produtos com lucro líquido real abaixo de 40%</p>
            </div>
            <div className="px-3 py-1 bg-error text-white text-xs font-black rounded-full shadow-lg shadow-error/20 animate-bounce">
              {lowMarginProducts.length} ITENS
            </div>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {lowMarginProducts.map(p => (
                <div key={p.id} className="group relative overflow-hidden bg-surface-container-low p-5 rounded-2xl border border-surface-container-high hover:border-error/30 transition-all">
                  <div className="flex flex-col gap-2 relative z-10">
                    <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">{p.nome}</span>
                    <div className="flex items-end gap-2">
                      <span className="text-2xl font-black text-error">{p.margem_real_calculada.toFixed(1)}%</span>
                      <TrendingDown className="text-error mb-1" size={16} />
                    </div>
                  </div>
                  <div className="absolute right-[-10px] bottom-[-10px] opacity-5 group-hover:opacity-10 transition-opacity">
                    <AlertTriangle size={80} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
