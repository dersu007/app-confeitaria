import React, { useState } from 'react';
import { DatabaseGrid, EditableCell, SelectCell } from './DatabaseGrid';
import { createColumnHelper } from '@tanstack/react-table';
import { Package, Tags, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { dataService } from '../services/dataService';
import { formatCurrency } from '../services/bakeryService';

const columnHelper = createColumnHelper<any>();

export const Insumos = () => {
  const [activeTab, setActiveTab] = useState<'ingredientes' | 'categorias'>('ingredientes');
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
    columnHelper.accessor('preco_por_unidade_base', { 
      header: 'Custo g/ml', 
      cell: info => <span className="font-mono text-[10px] text-primary">{formatCurrency(info.getValue() || 0)}</span> 
    }),
    columnHelper.accessor('fornecedor', { header: 'Fornecedor', cell: EditableCell }),
  ];

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
            <Package size={24} /> Gestão de Insumos e Categorias
          </h2>
          <p className="text-sm text-on-surface-variant">Gerencie sua base de ingredientes e organize seus produtos</p>
        </div>
        
        <div className="flex gap-2 bg-surface-container-low p-1 rounded-xl border border-surface-container-high">
          <button 
            onClick={() => setActiveTab('ingredientes')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'ingredientes' ? 'bg-white shadow-sm text-primary' : 'text-on-surface-variant hover:text-primary'}`}
          >
            <Package size={16} /> Ingredientes
          </button>
          <button 
            onClick={() => setActiveTab('categorias')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'categorias' ? 'bg-white shadow-sm text-primary' : 'text-on-surface-variant hover:text-primary'}`}
          >
            <Tags size={16} /> Categorias
          </button>
        </div>
      </div>

      <div className="relative">
        {activeTab === 'ingredientes' && (
          <DatabaseGrid 
            table="ingredientes" 
            title="Base de Ingredientes" 
            columns={ingredientColumns} 
            onDataChange={recalculateAll} 
            refreshKey={refreshKey} 
          />
        )}
        {activeTab === 'categorias' && (
          <DatabaseGrid 
            table="categorias" 
            title="Categorias de Produtos" 
            columns={categoryColumns} 
            onDataChange={recalculateAll} 
            refreshKey={refreshKey} 
          />
        )}
      </div>
    </div>
  );
};
