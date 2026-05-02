import React, { useState } from 'react';
import { DatabaseGrid, EditableCell } from './DatabaseGrid';
import { createColumnHelper } from '@tanstack/react-table';
import { CreditCard, TrendingDown, TrendingUp, DollarSign, Download, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { dataService } from '../services/dataService';
import { useDespesasFixas, useRecalculateEverything } from '../hooks/useQueries';
import { formatCurrency } from '../services/bakeryService';
import { exportToCSV } from '../utils/csvUtils';

import { DespesaFixa } from '../types';

const columnHelper = createColumnHelper<DespesaFixa>();

export const Financeiro = () => {
  const { data: despesas = [] } = useDespesasFixas();
  const recalculateEverythingMutation = useRecalculateEverything();
  const [isExporting, setIsExporting] = useState(false);
  const totalExpenses = despesas.reduce((acc, curr) => acc + (Number(curr.valor_mensal) || 0), 0);

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const data = await dataService.getDespesasFixas();
      
      const mappedData = data.map(item => ({
        descricao: item.descricao,
        categoria: item.categoria,
        valor_mensal: item.valor_mensal
      }));

      const success = exportToCSV(
        mappedData,
        {
          descricao: 'Descrição',
          categoria: 'Categoria',
          valor_mensal: 'Valor Mensal'
        },
        'despesas_fixas_completo'
      );
      if (success) toast.success('Relatório de despesas fixas exportado!');
    } catch {
      toast.error('Erro ao exportar CSV');
    } finally {
      setIsExporting(false);
    }
  };

  const handleRecalculate = async () => {
    recalculateEverythingMutation.mutate();
  };

  const expenseColumns = React.useMemo(() => [
    columnHelper.accessor('descricao', { header: 'Descrição', cell: EditableCell }),
    columnHelper.accessor('valor_mensal', { header: 'Valor Mensal', cell: EditableCell }),
    columnHelper.accessor('categoria', { header: 'Categoria', cell: EditableCell }),
  ], []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold headline text-primary flex items-center gap-2">
            <CreditCard size={24} /> Gestão Financeira
          </h2>
          <p className="text-sm text-on-surface-variant">Controle suas despesas fixas e saúde financeira</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleRecalculate}
            disabled={recalculateEverythingMutation.isPending}
            className="flex items-center gap-2 bg-surface-container-low text-primary px-4 py-3 rounded-xl font-bold border border-primary/20 hover:bg-primary/5 transition-all text-sm disabled:opacity-50"
            title="Recalcula todos os custos e sincroniza a base"
          >
            <RefreshCw size={18} className={recalculateEverythingMutation.isPending ? 'animate-spin' : ''} /> Recalcular Tudo
          </button>
          <button 
            onClick={handleExportCSV}
            disabled={isExporting}
            className="flex items-center gap-2 bg-white text-on-surface px-4 py-3 rounded-xl font-bold border border-surface-container-high shadow-sm hover:bg-surface-container-low transition-all text-sm disabled:opacity-50"
          >
            <Download size={18} /> Exportar CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-surface-container-high shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-error/10 rounded-lg text-error">
              <TrendingDown size={20} />
            </div>
            <span className="text-sm font-bold text-on-surface-variant uppercase tracking-wider">Despesas Fixas</span>
          </div>
          <p className="text-3xl font-bold text-on-surface">{formatCurrency(totalExpenses)}</p>
          <p className="text-xs text-on-surface-variant mt-1">Total acumulado mensal</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-surface-container-high shadow-sm opacity-60">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-success/10 rounded-lg text-success">
              <TrendingUp size={20} />
            </div>
            <span className="text-sm font-bold text-on-surface-variant uppercase tracking-wider">Faturamento (Prev)</span>
          </div>
          <p className="text-3xl font-bold text-on-surface">R$ 0,00</p>
          <p className="text-xs text-on-surface-variant mt-1">Módulo em desenvolvimento</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-surface-container-high shadow-sm opacity-60">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <DollarSign size={20} />
            </div>
            <span className="text-sm font-bold text-on-surface-variant uppercase tracking-wider">Ponto de Equilíbrio</span>
          </div>
          <p className="text-3xl font-bold text-on-surface">R$ 0,00</p>
          <p className="text-xs text-on-surface-variant mt-1">Módulo em desenvolvimento</p>
        </div>
      </div>

      <div className="relative">
        <DatabaseGrid 
          table="despesas_fixas" 
          title="Despesas Fixas Mensais" 
          columns={expenseColumns} 
          onDataChange={handleRecalculate} 
        />
      </div>
    </div>
  );
};
