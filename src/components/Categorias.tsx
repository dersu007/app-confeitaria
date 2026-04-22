import React, { useState } from 'react';
import { DatabaseGrid, EditableCell, SelectCell } from './DatabaseGrid';
import { createColumnHelper } from '@tanstack/react-table';
import { Tags, RefreshCw, Archive, ArchiveRestore, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { dataService } from '../services/dataService';
import { Produto } from '../types';

const columnHelper = createColumnHelper<any>();

const ArchiveCell = ({ getValue, row, column: { id }, table }: any) => {
  const initialValue = getValue();
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    const categoryId = row.original.id;
    const isCurrentlyActive = initialValue !== false;
    const willArchive = isCurrentlyActive;

    if (willArchive) {
      setLoading(true);
      try {
        const products = await dataService.getProdutos();
        const activeProductsInCategory = products.filter(p => p.categoria_id === categoryId && p.ativo !== false);
        
        if (activeProductsInCategory.length > 0) {
          toast.error(
            "Esta categoria possui produtos ativos. Arquive os produtos antes ou mova-os de categoria.",
            { duration: 5000, icon: <AlertCircle className="text-error" /> }
          );
          setLoading(false);
          return;
        }
      } catch (error) {
        console.error('Erro ao verificar produtos da categoria:', error);
        toast.error('Erro ao validar arquivamento.');
        setLoading(false);
        return;
      }
    }

    try {
      await dataService.saveEntity('categorias', { id: categoryId, ativo: !isCurrentlyActive });
      table.options.meta?.updateData(categoryId, id, !isCurrentlyActive);
      toast.success(`Categoria ${!isCurrentlyActive ? 'ativada' : 'arquivada'} com sucesso!`);
    } catch (error) {
      console.error('Erro ao alternar status da categoria:', error);
      toast.error('Erro ao atualizar status.');
    } finally {
      setLoading(false);
    }
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
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [viewStatus, setViewStatus] = useState<'ativos' | 'arquivados'>('ativos');

  const refresh = () => setRefreshKey(prev => prev + 1);

  const recalculateAll = async () => {
    setIsRecalculating(true);
    const loadingToast = toast.loading('Recalculando toda a base...');
    try {
      await dataService.recalculateEverything();
      refresh();
      toast.success('Custos recalculados com sucesso!', { id: loadingToast });
    } catch (error) {
      toast.error('Erro ao recalcular', { id: loadingToast });
    } finally {
      setIsRecalculating(false);
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
    columnHelper.accessor('ativo', { 
      header: 'Arquivar', 
      cell: ArchiveCell
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
            disabled={isRecalculating}
            className="flex items-center gap-2 bg-surface-container-low text-primary px-4 py-3 rounded-xl font-bold border border-primary/20 hover:bg-primary/5 transition-all text-sm disabled:opacity-50"
            title="Recalcula custos de todos os produtos vinculados"
          >
            <RefreshCw size={18} className={isRecalculating ? 'animate-spin' : ''} /> Recalcular Tudo
          </button>
        </div>
      </div>

      <div className="relative">
        <DatabaseGrid 
          table="categorias" 
          title="Gestão de Categorias" 
          columns={categoryColumns} 
          onDataChange={recalculateAll} 
          refreshKey={refreshKey}
          showArchived={viewStatus === 'arquivados'}
        />
      </div>
    </div>
  );
};
