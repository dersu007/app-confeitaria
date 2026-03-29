import React, { useEffect, useState } from 'react';
import { 
  Receipt, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  AlertTriangle,
  ArrowRight
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
import { formatCurrency } from '../services/bakeryService';
import { supabase } from '../lib/supabase';
import { Produto } from '../types';

const KPICard = ({ title, value, change, icon: Icon, trend }: any) => (
  <div className="bg-surface-container-lowest p-6 rounded-xl border border-surface-container-high flex flex-col gap-4 shadow-sm">
    <div className="flex justify-between items-start">
      <div className="p-2 bg-primary-container/30 rounded-lg text-primary">
        <Icon size={24} />
      </div>
      {change && (
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

export const Dashboard = () => {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const { data } = await supabase.from('produtos').select('*');
      if (data) setProdutos(data);
      setLoading(false);
    };
    fetchData();
  }, []);

  const data = [
    { name: 'Seg', vendas: 400 },
    { name: 'Ter', vendas: 550 },
    { name: 'Qua', vendas: 450 },
    { name: 'Qui', vendas: 750 },
    { name: 'Sex', vendas: 600 },
    { name: 'Sab', vendas: 850 },
    { name: 'Dom', vendas: 950 },
  ];

  const pieData = [
    { name: 'Pães Artesanais', value: 55 },
    { name: 'Confeitaria', value: 30 },
    { name: 'Salgados', value: 15 },
  ];

  const COLORS = ['#2b6a57', '#b0f0d8', '#efe0cd'];

  const lowMarginProducts = produtos.filter(p => p.margem_real_calculada < 40);

  return (
    <div className="space-y-8">
      {/* Summary Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard title="Total de Pedidos" value="1,248" change="+12%" trend="up" icon={Receipt} />
        <KPICard title="Faturamento Mensal" value="R$ 42.850" change="+8.4%" trend="up" icon={Wallet} />
        <KPICard title="Lucro Líquido" value="R$ 12.420" change="-2.1%" trend="down" icon={Wallet} />
        <KPICard title="Fornadas Ativas" value="6" icon={Receipt} />
      </div>

      {/* Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-surface-container-lowest p-8 rounded-xl border border-surface-container-high shadow-sm">
          <div className="flex justify-between items-end mb-8">
            <div>
              <h2 className="text-xl font-bold headline text-on-surface">Previsão de Vendas</h2>
              <p className="text-sm text-on-surface-variant">Análise preditiva baseada nos últimos 30 dias</p>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e1e3e2" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#5d605f' }} />
                <YAxis hide />
                <Tooltip cursor={{ fill: '#f3f4f3' }} />
                <Bar dataKey="vendas" fill="#2b6a57" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-8 rounded-xl border border-surface-container-high shadow-sm flex flex-col">
          <h2 className="text-xl font-bold headline text-on-surface mb-2">Distribuição</h2>
          <p className="text-sm text-on-surface-variant mb-8">Vendas por categoria</p>
          <div className="flex-grow flex items-center justify-center">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={pieData}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-3 mt-8">
            {pieData.map((item, i) => (
              <div key={item.name} className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i] }}></div>
                  <span className="text-xs font-semibold">{item.name}</span>
                </div>
                <span className="text-xs font-bold">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Alerts & Recent */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface-container-lowest rounded-xl border border-surface-container-high overflow-hidden shadow-sm">
          <div className="p-8 border-b border-surface-container-high">
            <h2 className="text-xl font-bold headline text-on-surface flex items-center gap-2">
              <AlertTriangle className="text-error" size={20} />
              Alertas de Margem
            </h2>
            <p className="text-sm text-on-surface-variant">Produtos com margem real abaixo de 40%</p>
          </div>
          <div className="p-4">
            {lowMarginProducts.length > 0 ? (
              <div className="space-y-2">
                {lowMarginProducts.map(p => (
                  <div key={p.id} className="flex justify-between items-center p-3 bg-error-container/5 rounded-lg border border-error-container/10">
                    <span className="font-bold">{p.nome}</span>
                    <span className="text-error font-extrabold">{p.margem_real_calculada.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center py-8 text-on-surface-variant italic">Nenhum alerta no momento.</p>
            )}
          </div>
        </div>

        <div className="bg-surface-container-lowest rounded-xl border border-surface-container-high overflow-hidden shadow-sm">
          <div className="p-8 flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold headline text-on-surface">Pedidos Recentes</h2>
              <p className="text-sm text-on-surface-variant">Acompanhamento em tempo real</p>
            </div>
            <button className="text-primary font-bold text-sm flex items-center gap-1 hover:underline">
              Ver Todos <ArrowRight size={14} />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-surface-container-low/50">
                  <th className="px-8 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">ID</th>
                  <th className="px-8 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Cliente</th>
                  <th className="px-8 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-high">
                <tr className="hover:bg-surface-container-low/30 transition-colors">
                  <td className="px-8 py-5 text-sm font-bold font-mono">#BK-9402</td>
                  <td className="px-8 py-5 text-sm font-semibold">Ana Martins</td>
                  <td className="px-8 py-5 text-sm font-bold text-right">R$ 84,50</td>
                </tr>
                <tr className="hover:bg-surface-container-low/30 transition-colors">
                  <td className="px-8 py-5 text-sm font-bold font-mono">#BK-9401</td>
                  <td className="px-8 py-5 text-sm font-semibold">Ricardo Costa</td>
                  <td className="px-8 py-5 text-sm font-bold text-right">R$ 42,00</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
