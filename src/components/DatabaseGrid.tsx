import React, { useState, useEffect, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table';
import { dataService } from '../services/dataService';
import { useAuth } from '../lib/auth';
import { Plus, Trash2, Save, RefreshCw, Search, ClipboardPaste } from 'lucide-react';
import toast from 'react-hot-toast';
import { 
  calculateIngredientUnitPrice
} from '../services/bakeryService';

/*
  SQL PARA SUPABASE (RLS POLICIES):
  
  -- Habilitar RLS para todas as tabelas
  ALTER TABLE ingredientes ENABLE ROW LEVEL SECURITY;
  ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;
  ALTER TABLE produto_ingredientes ENABLE ROW LEVEL SECURITY;
  ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;
  ALTER TABLE despesas_fixas ENABLE ROW LEVEL SECURITY;
  ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

  -- Criar políticas de acesso (Exemplo para ingredientes)
  -- Substitua 'ingredientes' pelo nome de cada tabela
  CREATE POLICY "Permitir tudo para usuários autenticados" ON ingredientes FOR ALL TO authenticated USING (true) WITH CHECK (true);
*/

interface DatabaseGridProps {
  table: string;
  title: string;
  columns: any[];
  onDataChange?: () => void;
}

export const DatabaseGrid = ({ table, title, columns: initialColumns, onDataChange, refreshKey }: DatabaseGridProps & { refreshKey?: number }) => {
  const { user } = useAuth();
  const [data, setData] = useState<any[]>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingRows, setSavingRows] = useState<Set<string>>(new Set());
  const [isRecalculating, setIsRecalculating] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const result = await dataService.getTableData(table);
      setData(result);
    } catch (err: any) {
      console.error(`Erro ao buscar dados da tabela ${table}:`, err);
      toast.error(`Erro ao carregar dados: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [table, refreshKey]);

  const updateRow = async (rowIndex: number, columnId: string, value: any) => {
    const row = data[rowIndex];
    const originalData = [...data];
    let finalValue = value;

    // Type conversion for numeric fields
    const numericFields = [
      'peso_embalagem', 'preco_embalagem', 'preco_por_unidade_base',
      'tempo_producao', 'rendimento_unidades', 'preco_venda_manual',
      'margem_percentual', 'custo_total_calculado', 'quantidade',
      'margem_padrao', 'valor_mensal', 'custo_embalagem', 
      'taxa_venda_percentual', 'imposto_percentual',
      'custo_hora_trabalho', 'custo_fixo_rateado', 'custo_total', 'custo_unitario'
    ];

    const booleanFields = ['usar_margem_categoria', 'usar_preco_manual'];

    if (numericFields.includes(columnId)) {
      if (typeof value === 'string') {
        // Limpeza profissional: remove tudo que não é dígito, vírgula ou ponto
        // Converte vírgula para ponto para garantir o Number()
        const cleanValue = value.replace(/[^\d,.-]/g, '').replace(',', '.');
        finalValue = parseFloat(cleanValue);
      } else {
        finalValue = Number(value);
      }
      if (isNaN(finalValue) || !isFinite(finalValue)) finalValue = 0;
    } else if (booleanFields.includes(columnId)) {
      finalValue = value === 'true' || value === true;
    }

    // Evitar disparar recálculos se o valor não mudou de fato
    if (row[columnId] === finalValue) return;

    const updatedRow = { ...row, [columnId]: finalValue };

    // Business logic for ingredients
    if (table === 'ingredientes') {
      if (columnId === 'preco_embalagem' || columnId === 'peso_embalagem' || columnId === 'unidade_embalagem') {
        updatedRow.preco_por_unidade_base = calculateIngredientUnitPrice(
          updatedRow.preco_embalagem,
          updatedRow.peso_embalagem,
          updatedRow.unidade_embalagem
        );
      }
    }

    // Optimistic Update
    setData(old => old.map((r, index) => index === rowIndex ? updatedRow : r));
    setSavingRows(prev => new Set(prev).add(row.id));

    try {
      const updatePayload: any = { id: row.id, [columnId]: finalValue };
      
      if (table === 'ingredientes' && updatedRow.preco_por_unidade_base !== undefined) {
        updatePayload.preco_por_unidade_base = updatedRow.preco_por_unidade_base;
      }

      await dataService.saveEntity(table, updatePayload);
      
      // Trigger recalculations
      if (table === 'ingredientes' && (columnId === 'preco_embalagem' || columnId === 'peso_embalagem' || columnId === 'unidade_embalagem')) {
        await dataService.recalculateProductsUsingIngredient(row.id);
        if (onDataChange) onDataChange();
      } else if (table === 'produtos' && [
        'categoria_id', 'usar_margem_categoria', 'margem_percentual', 
        'margem_tipo', 'usar_preco_manual', 'preco_venda_manual', 
        'rendimento_unidades', 'tempo_producao',
        'custo_embalagem', 'taxa_venda_percentual', 'imposto_percentual',
        'custo_hora_trabalho', 'custo_fixo_rateado'
      ].includes(columnId)) {
        try {
          await dataService.recalculateProduct(row.id);
          const updatedProduct = await dataService.getProdutoById(row.id);
          if (updatedProduct) {
            setData(old => old.map(r => r.id === row.id ? updatedProduct : r));
          }
        } catch (err) {
          console.error(`Erro ao recalcular produto ${row.id}:`, err);
        }
        if (onDataChange) onDataChange();
      } else if (table === 'categorias' && (columnId === 'margem_padrao' || columnId === 'tipo_margem')) {
        await dataService.recalculateAllProducts();
        if (onDataChange) onDataChange();
      } else {
        if (onDataChange) onDataChange();
      }
    } catch (error: any) {
      console.error(`Erro ao atualizar tabela ${table}, campo ${columnId}:`, error);
      toast.error(`Erro no Banco (${error.code || '?' }): ${error.message}`);
      setData(originalData);
    } finally {
      setSavingRows(prev => {
        const next = new Set(prev);
        next.delete(row.id);
        return next;
      });
    }
  };

  // Whitelist de colunas permitidas por tabela para evitar erro PGRST204
  const getAllowedColumns = (tableName: string): string[] => {
    switch (tableName) {
      case 'ingredientes':
        return ['nome', 'descricao', 'fornecedor', 'unidade_embalagem', 'peso_embalagem', 'preco_embalagem', 'preco_por_unidade_base', 'user_id'];
      case 'produtos':
        return [
          'nome', 'descricao', 'categoria_id', 'rendimento_unidades', 
          'tempo_producao', 'custo_hora_trabalho', 'custo_fixo_rateado',
          'usar_margem_categoria', 'margem_percentual', 'margem_tipo', 
          'usar_preco_manual', 'preco_venda_manual', 'user_id',
          'custo_embalagem', 'taxa_venda_percentual', 'imposto_percentual',
          'custo_total', 'custo_unitario', 'custo_total_calculado'
        ];
      case 'categorias':
        return ['nome', 'margem_padrao', 'tipo_margem', 'user_id'];
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

    let rawNewRow: any = { user_id: user.id };

    // Valores padrão por tabela
    switch (table) {
      case 'ingredientes':
        rawNewRow = { ...rawNewRow, nome: 'Novo Ingrediente', unidade_embalagem: 'g', peso_embalagem: 1000, preco_embalagem: 0, preco_por_unidade_base: 0 };
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

    // Limpeza final: Apenas colunas permitidas
    const allowed = getAllowedColumns(table);
    const cleanNewRow = Object.keys(rawNewRow)
      .filter(key => allowed.includes(key))
      .reduce((obj: any, key) => {
        obj[key] = rawNewRow[key];
        return obj;
      }, {});

    try {
      const result = await dataService.insertEntities(table, [cleanNewRow]);
      
      if (result && result.length > 0) {
        setData(old => [result[0], ...old]);
        toast.success('Adicionado com sucesso');
        if (onDataChange) onDataChange();
      }
    } catch (err: any) {
      console.error('Exceção ao adicionar registro:', err);
      toast.error(`Erro inesperado: ${err.message}`);
    }
  };

  const deleteRow = async (id: string) => {
    try {
      await dataService.deleteEntity(table, id);
      setData(old => old.filter(row => row.id !== id));
      toast.success('Deletado');
      if (onDataChange) onDataChange();
    } catch (err: any) {
      console.error('Erro ao deletar:', err);
      if (err.code === '23503') {
        toast.error('Não é possível excluir: este item está sendo usado em um produto ou ficha técnica.');
      } else {
        toast.error(`Erro no Banco (${err.code || '?'}): ${err.message}`);
      }
    }
  };

  const handleRecalculateAll = async () => {
    if (isRecalculating) return;
    
    setIsRecalculating(true);
    const loadingToast = toast.loading('Recalculando todos os produtos...');
    try {
      await dataService.recalculateAllProducts();
      await fetchData();
      toast.success('Todos os produtos foram recalculados!', { id: loadingToast });
      if (onDataChange) onDataChange();
    } catch (err: any) {
      console.error('Erro no recálculo global:', err);
      toast.error(`Erro no recálculo: ${err.message}`, { id: loadingToast });
    } finally {
      setIsRecalculating(false);
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) {
      return;
    }

    e.preventDefault();
    const clipboardData = e.clipboardData.getData('text');
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
        cats?.forEach((c: any) => {
          categoryMap[c.nome.toLowerCase()] = c.id;
        });
      }

      const editableColumns = initialColumns.filter(col => 
        (col.accessorKey || col.id) && 
        col.id !== 'actions' &&
        col.accessorKey !== 'preco_por_unidade_base' &&
        col.accessorKey !== 'custo_total_calculado' &&
        col.accessorKey !== 'margem_real_calculada'
      );
      
      const allowed = getAllowedColumns(table);
      const rowsToInsert = [];
      
      for (const rowText of rows) {
        const cells = rowText.split('\t');
        if (cells.length < 1 && cells[0].trim() === '') continue;

        const rawRowData: any = { user_id: user?.id };
        
        for (let index = 0; index < editableColumns.length; index++) {
          const col = editableColumns[index];
          if (cells[index] !== undefined) {
            const key = col.accessorKey || col.id;
            let value: any = cells[index].trim();
            
            if (key === 'categoria_id' && isNaN(value as any)) {
              const catId = categoryMap[value.toLowerCase()];
              if (catId) {
                value = catId;
              } else if (value && value.length > 1) {
                const newCat = await dataService.saveEntity('categorias', { nome: value, user_id: user?.id });
                if (newCat) {
                  categoryMap[value.toLowerCase()] = newCat.id;
                  value = newCat.id;
                }
              } else {
                value = null;
              }
            }

            if (key === 'unidade_embalagem') {
              const unit = value.toLowerCase();
              if (unit.includes('grama') || unit === 'g') value = 'g';
              else if (unit.includes('quilo') || unit === 'kg') value = 'kg';
              else if (unit.includes('mili') || unit === 'ml') value = 'ml';
              else if (unit.includes('litro') || unit === 'l') value = 'l';
              else if (unit.includes('unid') || unit === 'un') value = 'un';
            }

            const stringFields = [
              'nome', 'descricao', 'fornecedor', 'unidade_embalagem', 
              'margem_tipo', 'categoria_id', 'email', 'telefone', 
              'data_nascimento', 'observacoes', 'segmento', 'categoria',
              'tipo_margem'
            ];

            const booleanFields = ['usar_margem_categoria', 'usar_preco_manual'];
            
            if (booleanFields.includes(key)) {
              const lowerVal = value.toString().toLowerCase();
              value = lowerVal === 'sim' || lowerVal === 'true' || lowerVal === '1' || lowerVal === 's';
            } else if (!stringFields.includes(key)) {
              const cleanValue = value.toString().replace(/[^\d,-]/g, '').replace(',', '.');
              if (!isNaN(cleanValue as any) && cleanValue !== '') {
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
          rawRowData.preco_por_unidade_base = calculateIngredientUnitPrice(
            rawRowData.preco_embalagem || 0,
            rawRowData.peso_embalagem || 1000,
            rawRowData.unidade_embalagem || 'g'
          );
        }
        
        if (table === 'produtos') {
          rawRowData.usar_margem_categoria = rawRowData.usar_margem_categoria ?? true;
          rawRowData.margem_percentual = rawRowData.margem_percentual || 30;
          rawRowData.margem_tipo = rawRowData.margem_tipo || 'markup';
          rawRowData.rendimento_unidades = rawRowData.rendimento_unidades || 1;
        }

        if (table === 'categorias') {
          rawRowData.margem_padrao = rawRowData.margem_padrao || 100;
          rawRowData.tipo_margem = rawRowData.tipo_margem || 'markup';
        }

        // Limpeza final do objeto de importação
        const cleanRowData = Object.keys(rawRowData)
          .filter(key => allowed.includes(key))
          .reduce((obj: any, key) => {
            obj[key] = rawRowData[key];
            return obj;
          }, {});

        rowsToInsert.push(cleanRowData);
      }

      if (rowsToInsert.length === 0) {
        toast.dismiss(loadingToast);
        return;
      }

      const insertedData = await dataService.insertEntities(table, rowsToInsert);
      
      if (insertedData && insertedData.length > 0) {
        setData(prev => [...insertedData, ...prev]);
        
        if (table === 'ingredientes' || table === 'categorias') {
          await dataService.recalculateAllProducts();
        }

        toast.success(`${insertedData.length} registros importados!`, { id: loadingToast });
        if (onDataChange) onDataChange();
      } else {
        toast.dismiss(loadingToast);
      }
    } catch (error: any) {
      console.error('Erro ao colar dados:', error);
      toast.error(`Erro na importação (${error.code || '?'}): ${error.message}`, { id: loadingToast });
    }
  };

  const tableInstance = useReactTable({
    data,
    columns: [
      ...initialColumns,
      {
        id: 'actions',
        header: '',
        cell: ({ row }: any) => (
          <button 
            onClick={() => deleteRow(row.original.id)}
            className="p-1 text-on-surface-variant hover:text-error transition-colors"
          >
            <Trash2 size={16} />
          </button>
        ),
      }
    ],
    state: {
      globalFilter,
    },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    meta: {
      updateData: (rowIndex: number, columnId: string, value: any) => {
        updateRow(rowIndex, columnId, value);
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
          
          {(table === 'produtos' || table === 'ingredientes' || table === 'categorias') && (
            <button 
              onClick={handleRecalculateAll}
              disabled={isRecalculating}
              title="Recalcular todos os custos e preços"
              className="flex items-center gap-2 px-4 py-2 bg-surface-container-high text-on-surface font-bold rounded-lg text-sm hover:bg-surface-container-highest transition-all disabled:opacity-50"
            >
              <RefreshCw size={16} className={isRecalculating ? 'animate-spin' : ''} /> 
              {isRecalculating ? 'Recalculando...' : 'Recalcular Tudo'}
            </button>
          )}

          <button 
            onClick={fetchData}
            className="p-2 text-on-surface-variant hover:bg-surface-container-low rounded-lg transition-all"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div 
        onClick={() => {
          const container = document.getElementById(`grid-container-${table}`);
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
            O sistema criará automaticamente todos os registros.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse table-auto min-w-[1200px]">
          <thead>
            {tableInstance.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id} className="bg-surface-container-low/50">
                {headerGroup.headers.map(header => (
                  <th key={header.id} className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest border-r border-b border-surface-container-high last:border-r-0 whitespace-nowrap">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-surface-container-high">
            {tableInstance.getRowModel().rows.map(row => (
              <tr key={row.id} className={`hover:bg-surface-container-low/30 transition-colors group ${savingRows.has((row.original as any).id) ? 'opacity-60 bg-primary/5' : ''}`}>
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} className="px-2 py-1 text-sm border-r border-surface-container-high last:border-r-0 h-10 relative whitespace-nowrap">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    {savingRows.has((row.original as any).id) && cell.column.id === 'actions' && (
                      <div className="absolute inset-0 flex items-center justify-center bg-surface-container-lowest/50">
                        <RefreshCw size={14} className="animate-spin text-primary" />
                      </div>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="p-3 bg-surface-container-low/30 border-t border-surface-container-high text-[10px] text-on-surface-variant italic">
        Dica: Você pode copiar dados do Excel/Google Sheets e colar (Ctrl+V) aqui para cadastrar vários itens de uma vez.
      </div>
    </div>
  );
};

// Editable Cell Component
export const EditableCell = ({ getValue, row: { index }, column: { id }, table }: any) => {
  const initialValue = getValue();
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const onBlur = () => {
    if (value !== initialValue) {
      table.options.meta?.updateData(index, id, value);
    }
  };

  return (
    <input
      value={value ?? ''}
      onChange={e => setValue(e.target.value)}
      onBlur={onBlur}
      className="w-full bg-transparent border-none focus:ring-1 focus:ring-primary/30 rounded px-1 -mx-1 py-1 outline-none"
    />
  );
};

// Select Cell Component
export const SelectCell = ({ getValue, row: { index }, column: { id }, table, options }: any) => {
  const initialValue = getValue();
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    table.options.meta?.updateData(index, id, newValue);
  };

  return (
    <select
      value={value ?? ''}
      onChange={onChange}
      className="w-full bg-transparent border-none focus:ring-1 focus:ring-primary/30 rounded px-1 -mx-1 py-1 outline-none cursor-pointer"
    >
      {options.map((opt: any) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
};

// Category Cell Component (with inline creation)
export const CategoryCell = ({ getValue, row: { index }, column: { id }, table }: any) => {
  const { user } = useAuth();
  const initialValue = getValue();
  const [value, setValue] = useState(initialValue);
  const [categories, setCategories] = useState<any[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newCategory, setNewCategory] = useState('');

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const data = await dataService.getTableData('categorias');
      setCategories(data || []);
    } catch (err) {
      console.error('Erro ao buscar categorias:', err);
    }
  };

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const onChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === 'new') {
      setIsCreating(true);
    } else {
      setValue(val);
      table.options.meta?.updateData(index, id, val);
    }
  };

  const handleCreate = async () => {
    if (!newCategory.trim()) return;
    
    try {
      const created = await dataService.saveEntity('categorias', { nome: newCategory, user_id: user?.id });
      if (created) {
        setCategories(prev => [...prev, created].sort((a, b) => a.nome.localeCompare(b.nome)));
        setValue(created.id);
        table.options.meta?.updateData(index, id, created.id);
        setIsCreating(false);
        setNewCategory('');
        toast.success('Categoria criada');
      }
    } catch (error: any) {
      console.error('Erro ao criar categoria:', error);
      toast.error(`Erro ao criar categoria: ${error.message}`);
    }
  };

  if (isCreating) {
    return (
      <div className="flex items-center gap-1">
        <input
          autoFocus
          value={newCategory}
          onChange={e => setNewCategory(e.target.value)}
          className="w-full bg-white border border-primary/30 rounded px-1 py-1 text-xs outline-none"
          placeholder="Nome..."
        />
        <button onClick={handleCreate} className="p-1 text-primary hover:bg-primary/10 rounded"><Save size={14} /></button>
        <button onClick={() => setIsCreating(false)} className="p-1 text-on-surface-variant hover:bg-surface-container-low rounded"><Trash2 size={14} /></button>
      </div>
    );
  }

  return (
    <select
      value={value ?? ''}
      onChange={onChange}
      className="w-full bg-transparent border-none focus:ring-1 focus:ring-primary/30 rounded px-1 -mx-1 py-1 outline-none cursor-pointer"
    >
      <option value="">Sem Categoria</option>
      {categories.map(cat => (
        <option key={cat.id} value={cat.id}>{cat.nome}</option>
      ))}
      <option value="new" className="text-primary font-bold">+ Nova Categoria</option>
    </select>
  );
};
