import React, { useState } from 'react';
import { DatabaseGrid, EditableCell, SelectCell } from './DatabaseGrid';
import { createColumnHelper } from '@tanstack/react-table';
import { Database, RefreshCw, AlertTriangle, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { dataService } from '../services/dataService';
import { useRecalculateEverything } from '../hooks/useQueries';
import { formatCurrency } from '../services/bakeryService';
import { format } from 'date-fns';
import { Ingrediente } from '../types';
import { exportToCSV } from '../utils/csvUtils';

const columnHelper = createColumnHelper<Ingrediente>();

export const Insumos = () => {
  const [isExporting, setIsExporting] = useState(false);
  const recalculateEverythingMutation = useRecalculateEverything();

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const data = await dataService.getIngredientes();
      
      const mappedData = data.map(item => ({
        nome: item.nome,
        unidade_base: item.unidade_base === 'g' ? 'Gramas (g)' : item.unidade_base === 'ml' ? 'Mililitros (ml)' : 'Unidades (un)',
        peso_embalagem: item.peso_embalagem,
        preco_embalagem: item.preco_embalagem,
        preco_por_unidade_base: item.preco_por_unidade_base,
        fornecedor: item.fornecedor || 'Não informado',
        estoque_minimo: item.estoque_minimo || 0,
        estoque_atual: item.estoque_atual || 0,
        data_atualizacao: item.data_atualizacao ? format(new Date(item.data_atualizacao), 'dd/MM/yyyy') : '-'
      }));

      const success = exportToCSV(
        mappedData,
        {
          nome: 'Nome',
          unidade_base: 'Unidade Base',
          peso_embalagem: 'Peso da Embalagem',
          preco_embalagem: 'Preço da Embalagem',
          preco_por_unidade_base: 'Preço por Unidade Base',
          fornecedor: 'Fornecedor',
          estoque_minimo: 'Estoque Mínimo',
          estoque_atual: 'Estoque Atual',
          data_atualizacao: 'Data de Atualização'
        },
        'insumos_completo'
      );
      if (success) toast.success('Relatório completo de insumos exportado!');
    } catch {
      toast.error('Erro ao exportar CSV');
    } finally {
      setIsExporting(false);
    }
  };

  const recalculateAll = async () => {
    recalculateEverythingMutation.mutate();
  };

  const ingredientColumns = [
    columnHelper.accessor('nome', { header: 'Nome', cell: EditableCell }),
    columnHelper.accessor('unidade_embalagem', { 
      header: 'Unid. Emb.', 
      cell: (props) => (
        <SelectCell 
          {...props} 
          options={[
            { value: 'g', label: 'Gramas (g)' },
            { value: 'kg', label: 'Quilos (kg)' },
            { value: 'ml', label: 'Mililitros (ml)' },
            { value: 'l', label: 'Litros (L)' },
            { value: 'un', label: 'Unidades (un)' },
          ]} 
        />
      )
    }),
    columnHelper.accessor('peso_embalagem', { header: 'Qtd. Emb.', cell: EditableCell }),
    columnHelper.accessor('preco_embalagem', { header: 'Preço Emb.', cell: EditableCell }),
    columnHelper.accessor('estoque_atual', { 
      header: 'Saldo Atual', 
      cell: (props) => {
        const { estoque_atual, estoque_minimo, unidade_base } = props.row.original;
        const isCritical = estoque_atual <= estoque_minimo;
        return (
          <div className="flex items-center gap-2" title="Alterar saldo apenas via aba Estoque">
            <span className={`font-bold ${isCritical ? 'text-error' : 'text-on-surface'}`}>
              {estoque_atual} {unidade_base}
            </span>
            {isCritical && <AlertTriangle size={14} className="text-error animate-pulse" />}
          </div>
        );
      }
    }),
    columnHelper.accessor('estoque_minimo_unidades', { 
      header: 'Estoque Mín.', 
      cell: (info) => (
        <span className="text-xs font-medium text-on-surface-variant">
          {info.getValue() || 0} un
        </span>
      )
    }),
    columnHelper.accessor('preco_por_unidade_base', { 
      header: 'Custo g/ml', 
      cell: info => <span className="font-mono text-[10px] text-primary">{formatCurrency(info.getValue() || 0)}</span> 
    }),
    columnHelper.accessor('fornecedor', { header: 'Fornecedor', cell: EditableCell }),
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold headline text-primary flex items-center gap-2">
          <Database size={24} /> Gestão de Insumos
          </h2>
          <p className="text-sm text-on-surface-variant">Gerencie sua base de ingredientes e custos base</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={recalculateAll}
            disabled={recalculateEverythingMutation.isPending}
            className="flex items-center gap-2 bg-surface-container-low text-primary px-4 py-3 rounded-xl font-bold border border-primary/20 hover:bg-primary/5 transition-all text-sm disabled:opacity-50"
            title="Recalcula custos de todos os produtos"
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

      <div className="relative">
        <DatabaseGrid 
          table="ingredientes" 
          title="Base de Ingredientes" 
          columns={ingredientColumns} 
          onDataChange={recalculateAll} 
        />
      </div>
    </div>
  );
};
