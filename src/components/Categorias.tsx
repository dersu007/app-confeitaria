import React, { useState } from 'react';
import { DatabaseGrid, EditableCell, SelectCell } from './DatabaseGrid';
import { createColumnHelper } from '@tanstack/react-table';
import { Tags } from 'lucide-react';
import toast from 'react-hot-toast';
import { dataService } from '../services/dataService';

const columnHelper = createColumnHelper<any>();

export const Categorias = () => {
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

  const categoryColumns = [
    columnHelper.accessor('nome', { header: 'Nome', cell: EditableCell }),
    columnHelper.accessor('margem_padrao', { header: 'Margem Padrão %', cell: EditableCell }),
    columnHelper.accessor('tipo_margem', { 
      header: 'Tipo Margem', 
      cell: (props) => (
        <SelectCell 
          {...props} 
          options={[
            { value: 'markup', label: 'Markup' },
            { value: 'margem_real', label: 'Margem Real' },
          ]} 
        />
      )
    }),
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold headline text-primary flex items-center gap-2">
            <Tags size={24} /> Categorias de Produtos
          </h2>
          <p className="text-sm text-on-surface-variant">Gerencie as categorias e defina margens padrão para seus produtos</p>
        </div>
      </div>

      <div className="relative">
        <DatabaseGrid 
          table="categorias" 
          title="Gestão de Categorias" 
          columns={categoryColumns} 
          onDataChange={recalculateAll} 
          refreshKey={refreshKey} 
        />
      </div>
    </div>
  );
};
