import React, { useState, useEffect, useMemo } from 'react';
import { 
  ColumnDef,
  getCoreRowModel,
  flexRender,
  Row,
  Table,
} from '@tanstack/react-table';
import { dataService } from '../services/dataService';
import { useAuth } from '../lib/auth';
import { useTableData, useSaveEntity, useDeleteEntity, useInsertEntities } from '../hooks/useQueries';
import { Plus, Trash2, Save, Search, ClipboardPaste } from 'lucide-react';
import toast from 'react-hot-toast';
import { useReactTable } from '@tanstack/react-table';
import { 
  calculateIngredientUnitPrice
} from '../services/bakeryService';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { useQueryClient } from '@tanstack/react-query';
import { Ingrediente } from '../types';

interface DatabaseGridProps<TData extends { id: string } & Record<string, unknown>> {
  table: string;
  title: string;
  columns: ColumnDef<TData, unknown>[];
  onDataChange?: () => void;
  showArchived?: boolean;
}

export const DatabaseGrid = <TData extends { id: string } & Record<string, unknown>>({ table, title, columns: initialColumns, onDataChange, showArchived = false }: DatabaseGridProps<TData>) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // React Query Hooks
  const { data: rawData = [], isLoading: loading } = useTableData(table);
  const saveEntityMutation = useSaveEntity(table);
  const deleteEntityMutation = useDeleteEntity(table);
  const insertEntitiesMutation = useInsertEntities(table);

  const [data, setData] = useState<TData[]>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [savingRows, setSavingRows] = useState<Set<string>>(new Set());
  
  // States for Deletion Flow
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSecondaryConfirm, setShowSecondaryConfirm] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<TData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Sync internal data state with React Query data
  useEffect(() => {
    setData(rawData as TData[]);
  }, [rawData]);

  const updateRow = async (rowId: string, columnId: string, value: unknown) => {
    const row = data.find(r => r.id === rowId);
    if (!row) return;
    let finalValue: unknown = value;

    // Type conversion for numeric fields
    const numericFields = [
      'peso_embalagem', 'preco_embalagem', 'preco_por_unidade_base',
      'tempo_producao', 'rendimento_unidades', 'preco_venda_manual',
      'margem_percentual', 'quantidade',
      'margem_padrao', 'valor_mensal', 'custo_embalagem', 
      'taxa_venda_percentual', 'imposto_percentual',
      'custo_hora_trabalho', 'custo_fixo_rateado', 'custo_total', 'custo_unitario',
      'estoque_minimo', 'estoque_atual'
    ];

    const booleanFields = ['usar_margem_categoria', 'usar_preco_manual', 'ativo'];

    if (numericFields.includes(columnId)) {
      if (typeof value === 'string') {
        const cleanValue = value.replace(/[^\d,.-]/g, '').replace(',', '.');
        finalValue = parseFloat(cleanValue);
      } else {
        finalValue = Number(value);
      }
      if (isNaN(finalValue) || !isFinite(finalValue)) finalValue = 0;
    } else if (booleanFields.includes(columnId)) {
      finalValue = value === 'true' || value === true;
    }

    if ((row as Record<string, unknown>)[columnId] === finalValue) return;

    const updatedRow = { ...row, [columnId]: finalValue } as TData;

    if (table === 'ingredientes') {
      const ing = updatedRow as unknown as Ingrediente;
      if (columnId === 'preco_embalagem' || columnId === 'peso_embalagem' || columnId === 'unidade_embalagem') {
        const preco_base = calculateIngredientUnitPrice(
          ing.preco_embalagem,
          ing.peso_embalagem,
          ing.unidade_embalagem
        );
        (updatedRow as unknown as Record<string, unknown>).preco_por_unidade_base = preco_base;
      }
    }

    // Optimistic UI Update locally
    setData(old => old.map(r => r.id === rowId ? updatedRow : r));
    setSavingRows(prev => new Set(prev).add(rowId));

    try {
      const updatePayload: Record<string, unknown> = { id: rowId, [columnId]: finalValue };
      const rowAsMap = updatedRow as unknown as Record<string, unknown>;
      if (table === 'ingredientes' && rowAsMap.preco_por_unidade_base !== undefined) {
        updatePayload.preco_por_unidade_base = rowAsMap.preco_por_unidade_base;
      }

      await saveEntityMutation.mutateAsync(updatePayload);
      
      // Post-save logic (recalculations)
      if (table === 'ingredientes' && (columnId === 'preco_embalagem' || columnId === 'peso_embalagem' || columnId === 'unidade_embalagem')) {
        await dataService.recalculateProductsUsingIngredient(rowId);
        queryClient.invalidateQueries({ queryKey: ['produtos'] });
      } else if (table === 'produtos' && [
        'categoria_id', 'usar_margem_categoria', 'margem_percentual', 
        'margem_tipo', 'usar_preco_manual', 'preco_venda_manual', 
        'rendimento_unidades', 'tempo_producao',
        'custo_embalagem', 'taxa_venda_percentual', 'imposto_percentual',
        'custo_hora_trabalho', 'custo_fixo_rateado'
      ].includes(columnId)) {
        await dataService.recalculateProduct(rowId);
        queryClient.invalidateQueries({ queryKey: ['produtos'] });
        queryClient.invalidateQueries({ queryKey: ['produto', rowId] });
      } else if (table === 'categorias' && (columnId === 'margem_padrao' || columnId === 'tipo_margem')) {
        await dataService.recalculateAllProducts();
        queryClient.invalidateQueries({ queryKey: ['produtos'] });
      }
      
      // Call parent skip if provided
      if (onDataChange) onDataChange();
      
    } catch (error: unknown) {
      console.error(`Erro ao atualizar tabela ${table}, campo ${columnId}:`, error);
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      toast.error(`Erro no Banco: ${message}`);
      setData(old => old.map(r => r.id === rowId ? row : r));
    } finally {
      setSavingRows(prev => {
        const next = new Set(prev);
        next.delete(rowId);
        return next;
      });
    }
  };

  const getAllowedColumns = (tableName: string): string[] => {
    switch (tableName) {
      case 'ingredientes':
        return ['nome', 'descricao', 'fornecedor', 'unidade_embalagem', 'peso_embalagem', 'preco_embalagem', 'preco_por_unidade_base', 'estoque_minimo', 'estoque_atual', 'user_id'];
      case 'produtos':
        return [
          'nome', 'descricao', 'categoria_id', 'rendimento_unidades', 
          'tempo_producao', 'custo_hora_trabalho', 'custo_fixo_rateado',
          'usar_margem_categoria', 'margem_percentual', 'margem_tipo', 
          'usar_preco_manual', 'preco_venda_manual', 'user_id',
          'custo_embalagem', 'taxa_venda_percentual', 'imposto_percentual',
          'custo_total', 'custo_unitario',
          'imagem_url', 'modo_preparo', 'ativo'
        ];
      case 'categorias':
        return ['nome', 'margem_padrao', 'tipo_margem', 'user_id', 'ativo'];
      case 'despesas_fixas':
        return ['descricao', 'valor_mensal', 'categoria', 'user_id'];
      case 'clientes':
        return [
          'nome', 'telefone', 'email', 'cpf_cnpj', 'data_nascimento', 
          'endereco', 'cidade', 'estado', 'cep', 'observacoes', 'segmento', 'user_id'
        ];
      default:
        return ['user_id'];
    }
  };

  const addRow = async () => {
    if (!user?.id) {
      toast.error('Você precisa estar logado para adicionar itens');
      return;
    }

    let rawNewRow: Record<string, unknown> = { user_id: user.id };
    switch (table) {
      case 'ingredientes':
        rawNewRow = { ...rawNewRow, nome: 'Novo Ingrediente', unidade_embalagem: 'g', peso_embalagem: 1000, preco_embalagem: 0, preco_por_unidade_base: 0, estoque_minimo: 0, estoque_atual: 0 };
        break;
      case 'produtos':
        rawNewRow = { ...rawNewRow, nome: 'Novo Produto', rendimento_unidades: 1, tempo_producao: 0, usar_margem_categoria: true, margem_percentual: 30, margem_tipo: 'markup' };
        break;
      case 'categorias':
        rawNewRow = { ...rawNewRow, nome: 'Nova Categoria', margem_padrao: 100, tipo_margem: 'markup' };
        break;
      case 'despesas_fixas':
        rawNewRow = { ...rawNewRow, descricao: 'Nova Despesa', valor_mensal: 0, categoria: 'Geral' };
        break;
      case 'clientes':
        rawNewRow = { ...rawNewRow, nome: 'Novo Cliente', segmento: 'Novo' };
        break;
      default:
        rawNewRow = { ...rawNewRow, nome: 'Novo Item' };
    }

    const allowed = getAllowedColumns(table);
    const cleanNewRow = Object.keys(rawNewRow)
      .filter(key => allowed.includes(key))
      .reduce((obj: Record<string, unknown>, key) => {
        obj[key] = rawNewRow[key];
        return obj;
      }, {});

    try {
      await insertEntitiesMutation.mutateAsync({ entities: [cleanNewRow] });
      toast.success('Adicionado com sucesso');
      if (onDataChange) onDataChange();
    } catch (err: unknown) {
      console.error('Exceção ao adicionar registro:', err);
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      toast.error(`Erro inesperado: ${message}`);
    }
  };

  const deleteRow = async () => {
    if (!itemToDelete) return;
    
    setIsDeleting(true);
    try {
      await deleteEntityMutation.mutateAsync(itemToDelete.id);
      setData(old => old.filter(row => row.id !== itemToDelete.id));
      toast.success('Excluído com sucesso');
      if (onDataChange) onDataChange();
      setShowDeleteConfirm(false);
      setShowSecondaryConfirm(false);
      setItemToDelete(null);
    } catch (err: unknown) {
      console.error('Erro ao deletar:', err);
      if (err && typeof err === 'object' && 'code' in err && err.code === '23503') {
        const errorMsg = table === 'categorias' 
          ? 'Não é possível excluir: esta categoria está sendo usada em um ou mais produtos.'
          : table === 'ingredientes'
          ? 'Não é possível excluir: este insumo está sendo usado em uma ficha técnica.'
          : 'Não é possível excluir: este item possui vínculos ativos.';
        toast.error(errorMsg);
      } else {
        const message = err instanceof Error ? err.message : 'Erro desconhecido';
        toast.error(`Erro: ${message}`);
      }
      setShowDeleteConfirm(false);
      setShowSecondaryConfirm(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleStartDelete = (row: TData) => {
    setItemToDelete(row);
    setShowDeleteConfirm(true);
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    if (e.target instanceof window.HTMLInputElement || e.target instanceof window.HTMLSelectElement) {
      return;
    }

    e.preventDefault();
    const clipboardData = e.clipboardData.getData('text') || '';
    const rawRows = clipboardData.split(/\r?\n/);
    const rows = rawRows.filter(row => {
      const trimmed = row.trim();
      if (!trimmed) return false;
      const lower = trimmed.toLowerCase();
      if (lower.startsWith('nome\t') || lower.startsWith('descrição\t') || lower.startsWith('ingrediente\t')) return false;
      return true;
    });
    
    if (rows.length === 0) return;
    const loadingToast = toast.loading(`Importando ${rows.length} registros...`);
    
    try {
      let categoryMap: Record<string, string> = {};
      if (table === 'produtos') {
        const cats = await dataService.getTableData('categorias');
        cats?.forEach((c: Record<string, unknown>) => {
          categoryMap[(c.nome as string).toLowerCase()] = c.id as string;
        });
      }

      const editableColumns = initialColumns.filter(col => {
        const accessor = (col as { accessorKey?: string })?.accessorKey || col.id;
        return accessor && 
               accessor !== 'actions' &&
               accessor !== 'preco_por_unidade_base' &&
               accessor !== 'margem_real_calculada';
      });
      
      const allowed = getAllowedColumns(table);
      const rowsToInsert: Record<string, unknown>[] = [];
      
      for (const rowText of rows) {
        if (!rowText) continue;
        const cells = rowText.split('\t');
        if (cells.length < 1 && cells[0].trim() === '') continue;

        const rawRowData: Record<string, unknown> = { user_id: user?.id };
        for (let index = 0; index < editableColumns.length; index++) {
          const col = editableColumns[index];
          if (cells[index] !== undefined) {
            const cellCol = col as { accessorKey?: string, id?: string };
            const key = cellCol.accessorKey || cellCol.id;
            if (!key) continue;
            let value: unknown = cells[index].trim();
            
            if (key === 'categoria_id' && isNaN(Number(value))) {
              const catId = categoryMap[(value as string).toLowerCase()];
              if (catId) {
                value = catId;
              } else if (value && (value as string).length > 1) {
                const newCat = await dataService.saveEntity('categorias', { nome: value, user_id: user?.id });
                if (newCat) {
                  categoryMap[(value as string).toLowerCase()] = newCat.id;
                  value = newCat.id;
                }
              } else {
                value = null;
              }
            }

            const stringFields = ['nome', 'descricao', 'fornecedor', 'unidade_embalagem', 'margem_tipo', 'categoria_id', 'email', 'telefone', 'data_nascimento', 'observacoes', 'segmento', 'categoria', 'tipo_margem'];
            const booleanFields = ['usar_margem_categoria', 'usar_preco_manual', 'ativo'];
            
            if (booleanFields.includes(key)) {
              const lowerVal = value?.toString().toLowerCase();
              value = lowerVal === 'sim' || lowerVal === 'true' || lowerVal === '1' || lowerVal === 's';
            } else if (!stringFields.includes(key)) {
              const cleanValue = value?.toString().replace(/[^\d,-]/g, '').replace(',', '.');
              if (cleanValue !== undefined && !isNaN(Number(cleanValue)) && cleanValue !== '') {
                value = Number(cleanValue);
              }
            }
            rawRowData[key] = value;
          }
        }

        if (table === 'ingredientes') {
          rawRowData.unidade_embalagem = rawRowData.unidade_embalagem || 'g';
          rawRowData.peso_embalagem = rawRowData.peso_embalagem || 1000;
          rawRowData.preco_embalagem = rawRowData.preco_embalagem || 0;
          rawRowData.preco_por_unidade_base = calculateIngredientUnitPrice(rawRowData.preco_embalagem || 0, rawRowData.peso_embalagem || 1000, rawRowData.unidade_embalagem || 'g');
        }
        
        if (table === 'produtos') {
          rawRowData.usar_margem_categoria = rawRowData.usar_margem_categoria ?? true;
          rawRowData.margem_percentual = rawRowData.margem_percentual || 30;
          rawRowData.margem_tipo = rawRowData.margem_tipo || 'markup';
          rawRowData.rendimento_unidades = rawRowData.rendimento_unidades || 1;
          rawRowData.ativo = true;
        }

        if (table === 'categorias') {
          rawRowData.margem_padrao = rawRowData.margem_padrao || 100;
          rawRowData.tipo_margem = rawRowData.tipo_margem || 'markup';
          rawRowData.ativo = true;
        }

        const cleanRowData = Object.keys(rawRowData)
          .filter(key => allowed.includes(key))
          .reduce((obj: Record<string, unknown>, key) => {
            obj[key] = rawRowData[key];
            return obj;
          }, {});

        rowsToInsert.push(cleanRowData);
      }

      if (rowsToInsert.length === 0) {
        toast.dismiss(loadingToast);
        return;
      }

      const insertedData = await insertEntitiesMutation.mutateAsync({ entities: rowsToInsert });
      if (insertedData && insertedData.length > 0) {
        if (table === 'ingredientes' || table === 'categorias') {
          await dataService.recalculateAllProducts();
          queryClient.invalidateQueries({ queryKey: ['produtos'] });
        }
        toast.success(`${insertedData.length} registros importados!`, { id: loadingToast });
        if (onDataChange) onDataChange();
      } else {
        toast.dismiss(loadingToast);
      }
    } catch (error: unknown) {
      console.error('Erro ao colar dados:', error);
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      toast.error(`Erro na importação: ${message}`, { id: loadingToast });
    }
  };

  const filteredData = useMemo(() => {
    if (showArchived) {
      return data.filter(item => item.ativo === false);
    }
    return data.filter(item => item.ativo !== false);
  }, [data, showArchived]);

  const tableInstance = useReactTable<TData>({
    data: filteredData,
    columns: [
      ...initialColumns,
      {
        id: 'actions',
        header: '',
        cell: ({ row }: { row: Row<TData> }) => (
          <button 
            onClick={() => handleStartDelete(row.original)}
            className="p-1 text-on-surface-variant hover:text-error transition-colors"
          >
            <Trash2 size={16} />
          </button>
        ),
      } as ColumnDef<TData, unknown>
    ],
    state: {
      globalFilter,
    },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    meta: {
      updateData: (rowId: string, columnId: string, value: unknown) => {
        updateRow(rowId, columnId, value);
      },
    },
  });

  return (
    <div 
      id={`grid-container-${table}`}
      className="bg-surface-container-lowest rounded-xl border border-surface-container-high shadow-sm overflow-hidden outline-none"
      onPaste={handlePaste}
      tabIndex={0}
    >
      <div className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-surface-container-high">
        <h2 className="text-xl font-bold headline text-on-surface">{title}</h2>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-grow md:w-64">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
            <input
              value={globalFilter ?? ''}
              onChange={e => setGlobalFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-surface-container-low border-none rounded-lg text-sm focus:ring-2 focus:ring-primary/20"
              placeholder="Filtrar..."
            />
          </div>
          <button 
            onClick={addRow}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white font-bold rounded-lg text-sm hover:opacity-90 transition-all"
          >
            <Plus size={16} /> Adicionar
          </button>
        </div>
      </div>

      <div 
        onClick={() => {
          const container = window.document.getElementById(`grid-container-${table}`);
          container?.focus();
          toast('Pronto para colar! Use Ctrl+V agora.', { icon: '📋' });
        }}
        className="mx-6 mt-4 mb-2 p-4 border-2 border-dashed border-primary/20 rounded-xl bg-primary/5 flex items-center justify-center gap-4 cursor-pointer hover:border-primary/40 hover:bg-primary/10 transition-all group"
      >
        <div className="p-3 bg-white rounded-xl shadow-sm group-hover:scale-110 transition-transform">
          <ClipboardPaste size={24} className="text-primary" />
        </div>
        <div className="text-left">
          <p className="text-sm font-bold text-primary">Área de Importação Rápida (Excel / Google Sheets)</p>
          <p className="text-[10px] text-on-surface-variant max-w-md">
            Clique aqui e cole (<kbd className="bg-surface-container-high px-1 rounded">Ctrl+V</kbd>) seus dados copiados da planilha. 
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        {loading && data.length === 0 ? (
          <div className="p-12 text-center text-on-surface-variant italic">Carregando dados...</div>
        ) : (
          <table className="w-full text-left border-collapse table-auto min-w-[1800px]">
            <thead>
              {tableInstance.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id} className="bg-surface-container-low/50">
                  {headerGroup.headers.map(header => (
                    <th key={header.id} className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest border-r border-b border-surface-container-high last:border-r-0 whitespace-nowrap min-w-[120px]">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-surface-container-high">
              {tableInstance.getRowModel().rows.map(row => (
                <tr key={row.id} className={`hover:bg-surface-container-low/30 transition-colors group ${savingRows.has(row.original.id) ? 'opacity-60 bg-primary/5' : ''} ${row.original.ativo === false ? 'opacity-50 grayscale-[0.5]' : ''}`}>
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="px-4 py-2 text-sm border-r border-surface-container-high last:border-r-0 h-12 relative whitespace-nowrap overflow-hidden text-ellipsis max-w-[300px]">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
              {tableInstance.getRowModel().rows.length === 0 && !loading && (
                <tr>
                  <td colSpan={initialColumns.length + 1} className="p-12 text-center text-on-surface-variant italic">Nenhum dado encontrado</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog 
        isOpen={showDeleteConfirm}
        title={table === 'categorias' ? "Confirmar Exclusão de Categoria?" : "Excluir Registro?"}
        description={`Tem certeza que deseja excluir "${itemToDelete?.nome || itemToDelete?.descricao || 'este item'}"?`}
        confirmLabel={table === 'categorias' ? "Continuar" : "Excluir"}
        onConfirm={() => {
          if (table === 'categorias') {
            setShowDeleteConfirm(false);
            setTimeout(() => setShowSecondaryConfirm(true), 300);
          } else {
            deleteRow();
          }
        }}
        onCancel={() => { setShowDeleteConfirm(false); setItemToDelete(null); }}
        variant="warning"
      />

      <ConfirmDialog 
        isOpen={showSecondaryConfirm}
        title="DUPLA CONFIRMAÇÃO"
        description="Atenção: Excluir uma categoria pode impactar a organização de seus produtos. Tem certeza ABSOLUTA que deseja prosseguir?"
        confirmLabel="Sim, Excluir Definitivamente"
        onConfirm={deleteRow}
        onCancel={() => { setShowSecondaryConfirm(false); setItemToDelete(null); }}
        isLoading={isDeleting}
        variant="danger"
      />
    </div>
  );
};

interface CellProps {
  getValue: () => unknown;
  row: Row<{ id: string } & Record<string, unknown>>;
  column: { id: string };
  table: Table<{ id: string } & Record<string, unknown>>;
}

export const EditableCell = ({ getValue, row, column: { id }, table }: CellProps) => {
  const initialValue = getValue();
  const [value, setValue] = useState(initialValue);
  const [prevInitialValue, setPrevInitialValue] = useState(initialValue);

  if (initialValue !== prevInitialValue) {
    setPrevInitialValue(initialValue);
    setValue(initialValue);
  }

  const onBlur = () => { 
    if (value !== initialValue) {
      (table.options.meta as { updateData: (rowId: string, colId: string, val: unknown) => void } | undefined)?.updateData(row.original.id, id, value);
    }
  };
  return (
    <input value={value ?? ''} onChange={e => setValue(e.target.value)} onBlur={onBlur} className="w-full bg-transparent border-none focus:ring-1 focus:ring-primary/30 rounded px-1 -mx-1 py-1 outline-none" />
  );
};

interface SelectCellProps extends CellProps {
  options: { value: string; label: string }[];
}

export const SelectCell = ({ getValue, row, column: { id }, table, options }: SelectCellProps) => {
  const initialValue = getValue();
  const [value, setValue] = useState(initialValue);
  const [prevInitialValue, setPrevInitialValue] = useState(initialValue);

  if (initialValue !== prevInitialValue) {
    setPrevInitialValue(initialValue);
    setValue(initialValue);
  }

  const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    (table.options.meta as { updateData: (rowId: string, colId: string, val: unknown) => void } | undefined)?.updateData(row.original.id, id, newValue);
  };
  return (
    <select value={value ?? ''} onChange={onChange} className="w-full bg-transparent border-none focus:ring-1 focus:ring-primary/30 rounded px-1 -mx-1 py-1 outline-none cursor-pointer">
      {options.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
    </select>
  );
};

export const CategoryCell = ({ getValue, row, column: { id }, table }: CellProps) => {
  const { user } = useAuth();
  const initialValue = getValue();
  const [value, setValue] = useState(initialValue);
  const { data: categories = [] } = useTableData('categorias');
  const [isCreating, setIsCreating] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const queryClient = useQueryClient();

  const [prevInitialValue, setPrevInitialValue] = useState(initialValue);

  if (initialValue !== prevInitialValue) {
    setPrevInitialValue(initialValue);
    setValue(initialValue);
  }

  const onChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === 'new') setIsCreating(true);
    else { 
      setValue(val); 
      (table.options.meta as { updateData: (rowId: string, colId: string, val: unknown) => void } | undefined)?.updateData(row.original.id, id, val); 
    }
  };

  const handleCreate = async () => {
    if (!newCategory.trim()) return;
    try {
      const created = await dataService.saveEntity('categorias', { nome: newCategory, user_id: user?.id });
      if (created) {
        queryClient.invalidateQueries({ queryKey: ['categorias'] });
        setValue(created.id);
        (table.options.meta as { updateData: (rowId: string, colId: string, val: unknown) => void } | undefined)?.updateData(row.original.id, id, created.id);
        setIsCreating(false);
        setNewCategory('');
        toast.success('Categoria criada');
      }
    } catch (error: unknown) {
      console.error('Erro ao criar categoria:', error);
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      toast.error(`Erro ao criar categoria: ${message}`);
    }
  };

  if (isCreating) {
    return (
      <div className="flex items-center gap-1">
        <input autoFocus value={newCategory} onChange={e => setNewCategory(e.target.value)} className="w-full bg-white border border-primary/30 rounded px-1 py-1 text-xs outline-none" placeholder="Nome..." />
        <button onClick={handleCreate} className="p-1 text-primary hover:bg-primary/10 rounded"><Save size={14} /></button>
        <button onClick={() => setIsCreating(false)} className="p-1 text-on-surface-variant hover:bg-surface-container-low rounded"><Trash2 size={14} /></button>
      </div>
    );
  }
  return (
    <select value={value ?? ''} onChange={onChange} className="w-full bg-transparent border-none focus:ring-1 focus:ring-primary/30 rounded px-1 -mx-1 py-1 outline-none cursor-pointer">
      <option value="">Sem Categoria</option>
      {(categories as Record<string, unknown>[]).map((cat) => (<option key={cat.id as string} value={cat.id as string}>{cat.nome as string}</option>))}
      <option value="new" className="text-primary font-bold">+ Nova Categoria</option>
    </select>
  );
};
