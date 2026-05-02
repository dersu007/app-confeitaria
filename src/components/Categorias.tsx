import React, { useState } from 'react';
import { DatabaseGrid, EditableCell, SelectCell } from './DatabaseGrid';
import { createColumnHelper } from '@tanstack/react-table';
import { Tags, RefreshCw, Archive, ArchiveRestore, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useProdutos, useRecalculateEverything, useSaveEntity } from '../hooks/useQueries';

import { Categoria } from '../types';
import { Row, Table } from '@tanstack/react-table';

const columnHelper = createColumnHelper<Categoria>();

const ArchiveCell = ({ getValue, row, table: _tableInstance }: { getValue: () => boolean | undefined, row: Row<Categoria>, table: Table<Categoria> }) => {
  const initialValue = getValue();
  const [loading, setLoading] = useState(false);
  const { data: produtos = [] } = useProdutos();
  const saveCategoryMutation = useSaveEntity('categorias');

  const handleToggle = async () => {
    const categoryId = row.original.id;
    const isCurrentlyActive = initialValue !== false;
    const willArchive = isCurrentlyActive;

    if (willArchive) {
      setLoading(true);
      const activeProductsInCategory = produtos.filter(p => p.categoria_id === categoryId && p.ativo !== false);
      
      if (activeProductsInCategory.length > 0) {
        toast.error(
          "Esta categoria possui produtos ativos. Arquive os produtos antes ou mova-os de categoria.",
          { duration: 5000, icon: <AlertCircle className="text-error" /> }
        );
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    saveCategoryMutation.mutate({ id: categoryId, ativo: !isCurrentlyActive }, {
      onSuccess: () => {
        toast.success(`Categoria ${!isCurrentlyActive ? 'ativada' : 'arquivada'} com sucesso!`);
        setLoading(false);
      },
      onError: (error) => {
        console.error('Erro ao alternar status da categoria:', error);
        toast.error('Erro ao atualizar status.');
        setLoading(false);
      }
    });
  };

  return (
    <div className="flex justify-center">
      <button
        onClick={handleToggle}
        disabled={loading}
        className={`p-2 rounded-lg transition-all ${initialValue === false ? 'bg-amber-500 text-white' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
        title={initialValue === false ? 'Restaurar Categoria' : 'Arquivar Categoria'}
      >
        {initialValue === false ? (
          <ArchiveRestore size={16} className={loading ? 'animate-pulse' : ''} />
        ) : (
          <Archive size={16} className={loading ? 'animate-pulse' : ''} />
        )}
      </button>
    </div>
  );
};

export const Categorias = () => {
  const [viewStatus, setViewStatus] = useState<'ativos' | 'arquivados'>('ativos');
  const recalculateEverythingMutation = useRecalculateEverything();

  const recalculateAll = async () => {
    recalculateEverythingMutation.mutate();
  };

  const categoryColumns = React.useMemo(() => [
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
    columnHelper.accessor('ativo', { 
      header: 'Arquivar', 
      cell: ArchiveCell
    }),
  ], []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold headline text-primary flex items-center gap-2">
            <Tags size={24} /> Categorias de Produtos
          </h2>
          <p className="text-sm text-on-surface-variant">Gerencie as categorias e defina margens padrão para seus produtos</p>
        </div>
        <div className="flex gap-3">
          <div className="flex bg-surface-container-high p-1 rounded-xl border border-surface-container-highest">
            <button
              onClick={() => setViewStatus('ativos')}
              className={`px-4 py-3 rounded-lg text-[11px] font-black transition-all ${viewStatus === 'ativos' ? 'bg-primary text-white shadow-sm' : 'text-on-surface-variant hover:text-primary'}`}
            >
              ATIVOS
            </button>
            <button
              onClick={() => setViewStatus('arquivados')}
              className={`px-4 py-3 rounded-lg text-[11px] font-black transition-all ${viewStatus === 'arquivados' ? 'bg-surface-container-highest text-white shadow-sm' : 'text-on-surface-variant hover:text-primary'}`}
            >
              ARQUIVADOS
            </button>
          </div>
          <button 
            onClick={recalculateAll}
            disabled={recalculateEverythingMutation.isPending}
            className="flex items-center gap-2 bg-surface-container-low text-primary px-4 py-3 rounded-xl font-bold border border-primary/20 hover:bg-primary/5 transition-all text-sm disabled:opacity-50"
            title="Recalcula custos de todos os produtos vinculados"
          >
            <RefreshCw size={18} className={recalculateEverythingMutation.isPending ? 'animate-spin' : ''} /> Recalcular Tudo
          </button>
        </div>
      </div>

      <div className="relative">
        <DatabaseGrid 
          table="categorias" 
          title="Gestão de Categorias" 
          columns={categoryColumns} 
          onDataChange={recalculateAll} 
          showArchived={viewStatus === 'arquivados'}
        />
      </div>
    </div>
  );
};
