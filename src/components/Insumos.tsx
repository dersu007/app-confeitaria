import React, { useState } from 'react';
import { DatabaseGrid, EditableCell, SelectCell } from './DatabaseGrid';
import { createColumnHelper } from '@tanstack/react-table';
import { Database, RefreshCw, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { dataService } from '../services/dataService';
import { formatCurrency } from '../services/bakeryService';

const columnHelper = createColumnHelper<any>();

export const Insumos = () => {
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = () => setRefreshKey(prev => prev + 1);

  const recalculateAll = async () => {
    const loadingToast = toast.loading('Recalculando custos...');
    try {
      await dataService.recalculateAllProducts();
      refresh();
      toast.success('Custos recalculados com sucesso!', { id: loadingToast });
    } catch (error) {
      toast.error('Erro ao recalcular', { id: loadingToast });
    }
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
      header: 'Estoque Atual', 
      cell: (props: any) => {
        const { estoque_atual, estoque_minimo } = props.row.original;
        const isCritical = estoque_atual <= estoque_minimo;
        return (
          <div className="flex items-center gap-2">
            <input
              value={props.getValue() ?? ''}
              onChange={e => props.table.options.meta?.updateData(props.row.original.id, props.column.id, e.target.value)}
              className={`w-full bg-transparent border-none focus:ring-1 focus:ring-primary/30 rounded px-1 -mx-1 py-1 outline-none font-medium ${isCritical ? 'text-error font-bold' : ''}`}
            />
            {isCritical && <AlertTriangle size={14} className="text-error animate-pulse" />}
          </div>
        );
      }
    }),
    columnHelper.accessor('estoque_minimo', { header: 'Estoque Mín.', cell: EditableCell }),
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
      </div>

      <div className="relative">
        <DatabaseGrid 
          table="ingredientes" 
          title="Base de Ingredientes" 
          columns={ingredientColumns} 
          onDataChange={recalculateAll} 
          refreshKey={refreshKey} 
        />
      </div>
    </div>
  );
};
