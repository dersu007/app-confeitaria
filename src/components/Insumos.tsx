import React, { useState } from 'react';
import { DatabaseGrid, EditableCell, SelectCell } from './DatabaseGrid';
import { createColumnHelper } from '@tanstack/react-table';
import { Database, RefreshCw, AlertTriangle, Plus, Edit2, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { dataService } from '../services/dataService';
import { formatCurrency } from '../services/bakeryService';
import { format } from 'date-fns';
import { IngredienteModal } from './Insumos/IngredienteModal';
import { Ingrediente } from '../types';
import { exportToCSV } from '../utils/csvUtils';

const columnHelper = createColumnHelper<Ingrediente>();

export const Insumos = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [selectedIngrediente, setSelectedIngrediente] = useState<Ingrediente | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const refresh = () => setRefreshKey(prev => prev + 1);

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
    } catch (error) {
      toast.error('Erro ao exportar CSV');
    } finally {
      setIsExporting(false);
    }
  };

  const handleAdd = () => {
    setSelectedIngrediente(null);
    setShowModal(true);
  };

  const handleEdit = (ingrediente: Ingrediente) => {
    setSelectedIngrediente(ingrediente);
    setShowModal(true);
  };

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
    {
      id: 'edit_action',
      header: '',
      cell: ({ row }: any) => (
        <button 
          onClick={() => handleEdit(row.original)}
          className="p-1 text-on-surface-variant hover:text-primary transition-colors"
          title="Editar Insumo"
        >
          <Edit2 size={16} />
        </button>
      ),
    },
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
        <div className="flex gap-3">
          <button 
            onClick={handleExportCSV}
            disabled={isExporting}
            className="flex items-center gap-2 bg-white text-on-surface px-4 py-3 rounded-xl font-bold border border-surface-container-high shadow-sm hover:bg-surface-container-low transition-all text-sm disabled:opacity-50"
          >
            <Download size={18} /> Exportar CSV
          </button>
          <button 
            onClick={handleAdd}
            className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-xl font-bold font-headline shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all text-sm"
          >
            <Plus size={18} /> Novo Insumo
          </button>
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

      {showModal && (
        <IngredienteModal 
          ingrediente={selectedIngrediente}
          onClose={() => setShowModal(false)}
          onSave={() => {
            setShowModal(false);
            refresh();
          }}
        />
      )}
    </div>
  );
};
