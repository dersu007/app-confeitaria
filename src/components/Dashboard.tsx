import React, { useState, useMemo } from 'react';
import { 
  Receipt, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  AlertTriangle,
  ArrowRight,
  Users,
  Loader2,
  FileBarChart
} from 'lucide-react';
import { toast } from 'react-hot-toast';
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
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameDay, 
  startOfYear, 
  eachMonthOfInterval,
  isSameMonth,
  endOfWeek,
  eachWeekOfInterval,
  isWithinInterval,
  parseISO
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCurrency } from '../services/bakeryService';
import { ErrorBoundary } from 'react-error-boundary';
import { ErrorFallback } from './ui/ErrorFallback';
import { logErrorToBackend } from '../utils/errorUtils';
import { useProdutos, usePedidos, useClientes, useDespesasFixas } from '../hooks/useQueries';

interface KPICardProps {
  title: string;
  value: string | number;
  change?: string | number;
  icon: React.ElementType;
  trend?: 'up' | 'down';
}

const KPICard = ({ title, value, change, icon: Icon, trend }: KPICardProps) => (
  <div id={`kpi-${title.toLowerCase().replace(/\s/g, '-')}`} className="bg-surface-container-lowest p-6 rounded-xl border border-surface-container-high flex flex-col gap-4 shadow-sm">
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

export const Dashboard = () => {
  const { data: produtos = [], isLoading: loadingProd } = useProdutos();
  const { data: pedidos = [], isLoading: loadingPed } = usePedidos();
  const { data: _clientes = [] } = useClientes();
  const { data: despesas = [], isLoading: loadingDesp } = useDespesasFixas();
  
  const [isExporting, setIsExporting] = useState(false);
  const [periodoVisao, setPeriodoVisao] = useState<PeriodoVisao>('Diário');
  
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const loading = loadingProd || loadingPed || loadingDesp;

  const stats = useMemo(() => {
    const filteredOrders = pedidos.filter(p => {
      const dateStr = p.data_pedido;
      if (!dateStr) return false;
      const d = parseISO(dateStr);
      return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear && p.status === 'Concluído';
    });

    const faturamentoMensal = filteredOrders.reduce((acc, p) => acc + (p.valor_total || 0), 0);
    
    let monthlyCosts = 0;
    filteredOrders.forEach(p => {
      p.itens?.forEach(item => {
        monthlyCosts += (item.custo_unitario || 0) * (item.quantidade || 0);
      });
    });

    const totalDespesasFixas = despesas.reduce((acc, d) => acc + (d.valor_mensal || 0), 0);
    const lucroLiquido = faturamentoMensal - monthlyCosts - totalDespesasFixas;

    const pedidosAtivosCount = pedidos.filter(p => 
      ['Em preparação', 'Pronto', 'Em entrega'].includes(p.status)
    ).length;

    const totalConcluidos = filteredOrders.length;
    const ticketMedio = totalConcluidos > 0 ? faturamentoMensal / totalConcluidos : 0;

    return {
      faturamentoMensal,
      lucroLiquido,
      pedidosAtivos: pedidosAtivosCount,
      ticketMedio,
      totalPedidos: filteredOrders.length
    };
  }, [pedidos, despesas, selectedMonth, selectedYear]);

  const salesEvolution = useMemo(() => {
    const baseDate = new Date(selectedYear, selectedMonth, 1);
    const filteredOrders = pedidos.filter(p => {
      const dateStr = p.data_pedido;
      if (!dateStr) return false;
      const d = parseISO(dateStr);
      return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear && p.status === 'Concluído';
    });

    if (periodoVisao === 'Diário') {
      const daysInMonth = eachDayOfInterval({
        start: startOfMonth(baseDate),
        end: endOfMonth(baseDate)
      });

      return daysInMonth.map(day => {
        const total = filteredOrders
          .filter(p => isSameDay(parseISO(p.data_pedido), day))
          .reduce((acc, p) => acc + (p.valor_total || 0), 0);
        
        return {
          name: format(day, 'dd/MM'),
          faturamento: total
        };
      });
    }

    if (periodoVisao === 'Semanal') {
      const monthStart = startOfMonth(baseDate);
      const monthEnd = endOfMonth(baseDate);
      const weeks = eachWeekOfInterval({ start: monthStart, end: monthEnd }, { weekStartsOn: 0 });

      return weeks.map((weekStart, index) => {
        const weekEnd = endOfWeek(weekStart, { weekStartsOn: 0 });
        const total = filteredOrders
          .filter(p => {
            const dateStr = p.data_pedido;
            if (!dateStr) return false;
            return isWithinInterval(parseISO(dateStr), { start: weekStart, end: weekEnd });
          })
          .reduce((acc, p) => acc + (p.valor_total || 0), 0);
        
        return {
          name: `Sem ${index + 1}`,
          faturamento: total
        };
      });
    }

    if (periodoVisao === 'Mensal') {
      const yearStart = startOfYear(baseDate);
      const yearEnd = new Date(selectedYear, 11, 31);
      const months = eachMonthOfInterval({ start: yearStart, end: yearEnd });

      return months.map(month => {
        const total = pedidos
          .filter(p => {
            const dateStr = p.data_pedido;
            if (!dateStr) return false;
            return p.status === 'Concluído' && isSameMonth(parseISO(dateStr), month);
          })
          .reduce((acc, p) => acc + (p.valor_total || 0), 0);
        
        return {
          name: format(month, 'MMM', { locale: ptBR }),
          faturamento: total
        };
      });
    }

    return [];
  }, [pedidos, periodoVisao, selectedMonth, selectedYear]);

  const categoryDistribution = useMemo(() => {
    const categoryTotals: Record<string, number> = {};
    let totalValue = 0;

    pedidos
      .filter(p => {
        const dateStr = p.data_pedido;
        if (!dateStr) return false;
        const d = parseISO(dateStr);
        return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear && p.status === 'Concluído';
      })
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
        percentage: totalValue > 0 ? Math.round((value / totalValue) * 360) / 360 : 0
      }))
      .sort((a, b) => b.value - a.value);

    return sortedData.map(d => ({
      ...d,
      percentage: totalValue > 0 ? Math.round((d.value / totalValue) * 100) : 0
    }));
  }, [pedidos, selectedMonth, selectedYear]);

  const topProducts = useMemo(() => {
    const productSales: Record<string, { nome: string, total: number, qtd: number }> = {};

    pedidos
      .filter(p => {
        const dateStr = p.data_pedido;
        if (!dateStr) return false;
        const d = parseISO(dateStr);
        return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear && p.status === 'Concluído';
      })
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
  }, [pedidos, selectedMonth, selectedYear]);

  const recentOrders = useMemo(() => {
    return [...pedidos]
      .filter(p => {
        const dateStr = p.data_pedido;
        if (!dateStr) return false;
        const d = parseISO(dateStr);
        return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
      })
      .sort((a, b) => {
        const dateA = a.data_pedido;
        const dateB = b.data_pedido;
        if (!dateA || !dateB) return 0;
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      })
      .slice(0, 5);
  }, [pedidos, selectedMonth, selectedYear]);

  const COLORS = ['#2b6a57', '#6a4a2b', '#d2b48c', '#efe0cd', '#b0f0d8', '#8a9a5b'];

  const lowMarginProducts = produtos.filter(p => p.margem_real_calculada < 40);

  const exportDashboardReport = async () => {
    setIsExporting(true);
    try {
      const monthLabel = format(new Date(selectedYear, selectedMonth, 1), 'MMMM', { locale: ptBR });
      const yearLabel = selectedYear.toString();
      const BOM = '\uFEFF';
      const sep = ';';

      let csvContent = "";

      csvContent += `SEÇÃO 1: RESUMO FINANCEIRO (${monthLabel}/${yearLabel})\n`;
      csvContent += `KPI${sep}Valor\n`;
      csvContent += `Faturamento Mensal${sep}${stats.faturamentoMensal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}\n`;
      csvContent += `Lucro Líquido${sep}${stats.lucroLiquido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}\n`;
      csvContent += `Ticket Médio${sep}${stats.ticketMedio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}\n`;
      csvContent += `Pedidos no Período${sep}${stats.totalPedidos}\n\n`;

      csvContent += "SEÇÃO 2: PERFORMANCE POR CATEGORIA\n";
      csvContent += `Categoria${sep}Faturamento${sep}Percentual\n`;
      categoryDistribution.forEach(cat => {
        csvContent += `${cat.name}${sep}${cat.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}${sep}${cat.percentage}%\n`;
      });
      csvContent += "\n";

      csvContent += `SEÇÃO 3: HISTÓRICO DE VENDAS (${periodoVisao})\n`;
      csvContent += `Período${sep}Faturamento\n`;
      salesEvolution.forEach(item => {
        csvContent += `${item.name}${sep}${item.faturamento.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}\n`;
      });

      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const fileName = `relatorio_gestao_honey_sugar_${monthLabel.toLowerCase()}_${yearLabel}.csv`;
      
      link.setAttribute('href', url);
      link.setAttribute('download', fileName);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success('Relatório gerado com sucesso!');
    } catch (error) {
      console.error('Erro ao exportar relatório:', error);
      toast.error('Erro ao gerar relatório.');
    } finally {
      setIsExporting(false);
    }
  };

  const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const anos = Array.from({ length: 5 }, (_, i) => 2024 + i);

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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex flex-col md:flex-row gap-6 items-start md:items-center w-full md:w-auto">
          <div>
            <h1 className="text-3xl font-black text-on-surface headline">Dashboard</h1>
            <p className="text-on-surface-variant text-sm font-medium">Gestão inteligente e análise de resultados</p>
          </div>
          
          <div className="flex gap-2 bg-surface-container-low p-1.5 rounded-2xl border border-surface-container-high shadow-sm">
            <select 
              id="select-month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="bg-transparent border-none text-xs font-bold text-on-surface focus:ring-0 cursor-pointer pl-2 pr-8"
            >
              {meses.map((mes, index) => (
                <option key={index} value={index}>{mes}</option>
              ))}
            </select>
            <div className="w-px h-4 bg-surface-container-high self-center"></div>
            <select 
              id="select-year"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-transparent border-none text-xs font-bold text-on-surface focus:ring-0 cursor-pointer pl-2 pr-8"
            >
              {anos.map(ano => (
                <option key={ano} value={ano}>{ano}</option>
              ))}
            </select>
          </div>
        </div>

        <button 
          id="btn-export-report"
          onClick={exportDashboardReport}
          disabled={isExporting}
          className="flex items-center gap-2 px-6 py-3 bg-primary text-white font-bold rounded-2xl hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed w-full md:w-auto justify-center"
        >
          {isExporting ? <Loader2 size={18} className="animate-spin" /> : <FileBarChart size={18} />}
          Baixar Relatório
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard title="Pedidos Ativos" value={stats.pedidosAtivos} icon={Receipt} />
        <KPICard title="Faturamento Mensal" value={formatCurrency(stats.faturamentoMensal)} icon={Wallet} />
        <KPICard title="Lucro Líquido" value={formatCurrency(stats.lucroLiquido)} icon={TrendingUp} trend={stats.lucroLiquido >= 0 ? 'up' : 'down'} />
        <KPICard title="Ticket Médio" value={formatCurrency(stats.ticketMedio)} icon={Users} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div id="sales-evolution-chart" className="lg:col-span-2 bg-surface-container-lowest p-8 rounded-xl border border-surface-container-high shadow-sm">
          <ErrorBoundary FallbackComponent={ErrorFallback} onError={logErrorToBackend}>
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
          </ErrorBoundary>
        </div>

        <div id="category-distribution-chart" className="bg-surface-container-lowest p-8 rounded-xl border border-surface-container-high shadow-sm flex flex-col">
          <ErrorBoundary FallbackComponent={ErrorFallback} onError={logErrorToBackend}>
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
                    {categoryDistribution.map((_, index) => (
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
          </ErrorBoundary>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div id="top-products-card" className="bg-surface-container-lowest rounded-xl border border-surface-container-high overflow-hidden shadow-sm flex flex-col">
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

        <div id="recent-orders-table" className="lg:col-span-2 bg-surface-container-lowest rounded-xl border border-surface-container-high overflow-hidden shadow-sm">
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
                        <span className="text-[10px] text-on-surface-variant">{format(parseISO(pedido.data_pedido || pedido.created_at || new Date().toISOString()), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</span>
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

      {lowMarginProducts.length > 0 && (
        <div id="margin-alerts" className="bg-white rounded-xl border border-error-container/20 overflow-hidden shadow-lg shadow-error/5">
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
