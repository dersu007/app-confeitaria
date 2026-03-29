import React, { useState, useEffect, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, Save, RefreshCw, Search, ClipboardPaste } from 'lucide-react';
import toast from 'react-hot-toast';
import { 
  calculateIngredientUnitPrice, 
  recalculateProductsUsingIngredient, 
  recalculateProduct, 
  recalculateAllProducts 
} from '../services/bakeryService';

interface DatabaseGridProps {
  table: string;
  title: string;
  columns: any[];
  onDataChange?: () => void;
}

export const DatabaseGrid = ({ table, title, columns: initialColumns, onDataChange }: DatabaseGridProps) => {
  const [data, setData] = useState<any[]>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingRows, setSavingRows] = useState<Set<string>>(new Set());

  const fetchData = async () => {
    setLoading(true);
    const { data: result, error } = await supabase.from(table).select('*').order('created_at', { ascending: false });
    if (error) {
      toast.error('Erro ao carregar dados');
    } else {
      setData(result || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [table]);

  const updateRow = async (rowIndex: number, columnId: string, value: any) => {
    const row = data[rowIndex];
    const originalData = [...data];
    let finalValue = value;

    // Type conversion for numeric fields
    const numericFields = [
      'peso_embalagem', 'preco_embalagem', 'preco_por_unidade_base',
      'tempo_producao_valor', 'rendimento_unidades', 'preco_venda_manual',
      'margem_percentual', 'custo_total_calculado', 'quantidade',
      'margem_padrao', 'valor_mensal'
    ];

    const booleanFields = ['usar_margem_categoria', 'usar_preco_manual'];

    if (numericFields.includes(columnId)) {
      if (typeof value === 'string') {
        // Improved parsing: remove currency symbols, spaces, handle Brazilian decimal
        const cleanValue = value.replace(/[^\d,-]/g, '').replace(',', '.');
        finalValue = Number(cleanValue);
      } else {
        finalValue = Number(value);
      }
      if (isNaN(finalValue)) finalValue = 0;
    } else if (booleanFields.includes(columnId)) {
      finalValue = value === 'true' || value === true;
    }

    // Evitar disparar recálculos se o valor não mudou de fato (ex: 10 vs 10.0)
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
      const updatePayload: any = { [columnId]: finalValue };
      
      // Se for ingrediente e mudou preço/peso, envia também o preço unitário calculado
      if (table === 'ingredientes' && updatedRow.preco_por_unidade_base !== undefined) {
        updatePayload.preco_por_unidade_base = updatedRow.preco_por_unidade_base;
      }

      const { error } = await supabase.from(table).update(updatePayload).eq('id', row.id);
      
      if (error) throw error;

      // Trigger recalculations
      if (table === 'ingredientes' && (columnId === 'preco_embalagem' || columnId === 'peso_embalagem' || columnId === 'unidade_embalagem')) {
        await recalculateProductsUsingIngredient(row.id, supabase);
        if (onDataChange) onDataChange();
      } else if (table === 'produtos' && [
        'categoria_id', 'usar_margem_categoria', 'margem_percentual', 
        'margem_tipo', 'usar_preco_manual', 'preco_venda_manual', 
        'rendimento_unidades', 'tempo_producao_unidade' // Adicionado unidade de tempo
      ].includes(columnId)) {
        try {
          const updatedProduct = await recalculateProduct(row.id, supabase);
          if (updatedProduct) {
            setData(old => old.map(r => r.id === row.id ? updatedProduct : r));
          }
        } catch (err) {
          toast.error(`Erro ao recalcular produto: ${row.nome || row.id}`);
        }
        if (onDataChange) onDataChange();
      } else if (table === 'categorias' && (columnId === 'margem_padrao' || columnId === 'tipo_margem')) {
        await recalculateAllProducts(supabase);
        if (onDataChange) onDataChange();
      } else {
        if (onDataChange) onDataChange();
      }
    } catch (error: any) {
      console.error(`Erro ao atualizar tabela ${table}, campo ${columnId}:`, error);
      toast.error(`Erro ao atualizar: ${error.message}`);
      setData(originalData); // Reversão de estado em caso de erro (v004 fix)
    } finally {
      setSavingRows(prev => {
        const next = new Set(prev);
        next.delete(row.id);
        return next;
      });
    }
  };

  const addRow = async () => {
    // Garante valores padrão para evitar erros de restrição (NOT NULL) no banco
    const newRow: any = {
      nome: 'Novo Item',
      descricao: '',
      fornecedor: '',
      unidade_embalagem: 'un',
      peso_embalagem: 0,
      preco_embalagem: 0,
      preco_por_unidade_base: 0,
      tempo_producao_valor: 0,
      tempo_producao_unidade: 'horas',
      rendimento_unidades: 1,
      margem_percentual: 0,
      margem_tipo: 'markup',
      usar_margem_categoria: true,
      usar_preco_manual: false,
      preco_venda_manual: 0,
      custo_total_calculado: 0,
      preco_venda_final: 0,
      margem_real_calculada: 0,
      valor_mensal: 0,
      segmento: '',
      telefone: '',
      email: '',
      observacoes: ''
    };
    
    // Ajustes específicos por tabela
    if (table === 'despesas_fixas') {
      newRow.descricao = 'Nova Despesa';
    } else if (table === 'clientes') {
      newRow.nome = 'Novo Cliente';
      newRow.segmento = 'Novo';
    } else if (table === 'ingredientes') {
      newRow.unidade_embalagem = 'g';
      newRow.peso_embalagem = 1000;
    } else if (table === 'produtos') {
      newRow.margem_percentual = 30;
    } else if (table === 'categorias') {
      newRow.margem_padrao = 100;
      newRow.tipo_margem = 'markup';
    }

    const { data: result, error } = await supabase.from(table).insert([newRow]).select();
    
    if (error) {
      // Log detalhado para diagnosticar Foreign Key ou restrições de banco
      console.error(`ERRO CRÍTICO ao adicionar na tabela ${table}:`, {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        payload: newRow
      });
      toast.error(`Erro ao adicionar: ${error.message}`);
    } else if (result && result.length > 0) {
      setData(old => [result[0], ...old]);
      toast.success('Adicionado com sucesso');
    }
  };

  const deleteRow = async (id: string) => {
    try {
      const { error } = await supabase.from(table).delete().eq('id', id);
      
      if (error) {
        // Tratamento robusto para violação de chave estrangeira (Foreign Key Constraint)
        if (error.code === '23503') {
          toast.error('Não é possível excluir: este item está sendo usado em um produto ou ficha técnica.');
          return;
        }
        throw error;
      }

      setData(old => old.filter(row => row.id !== id));
      toast.success('Deletado');
    } catch (err: any) {
      console.error('Erro ao deletar:', err);
      toast.error(`Erro ao deletar: ${err.message || 'Erro desconhecido'}`);
    }
  };

  const handleRecalculateAll = async () => {
    const loadingToast = toast.loading('Recalculando todos os produtos...');
    try {
      await recalculateAllProducts(supabase);
      await fetchData(); // Atualiza o grid com os novos valores
      toast.success('Todos os produtos foram recalculados!', { id: loadingToast });
      if (onDataChange) onDataChange();
    } catch (err: any) {
      console.error('Erro no recálculo global:', err);
      toast.error('Erro ao recalcular produtos.', { id: loadingToast });
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    // Only handle paste if not currently focused on an input/select (to avoid double handling)
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) {
      return;
    }

    e.preventDefault();
    const clipboardData = e.clipboardData.getData('text');
    const rawRows = clipboardData.split(/\r?\n/);
    
    // Filter out empty rows and skip headers
    const rows = rawRows.filter(row => {
      const trimmed = row.trim();
      if (!trimmed) return false;
      // Skip common header keywords
      const lower = trimmed.toLowerCase();
      if (lower.startsWith('nome\t') || lower.startsWith('descrição\t') || lower.startsWith('ingrediente\t')) return false;
      return true;
    });
    
    if (rows.length === 0) return;

    const loadingToast = toast.loading(`Importando ${rows.length} registros...`);
    
    try {
      // Fetch categories once if we are in products to map names to IDs
      let categoryMap: Record<string, string> = {};
      if (table === 'produtos') {
        const { data: cats } = await supabase.from('categorias').select('id, nome');
        cats?.forEach(c => {
          categoryMap[c.nome.toLowerCase()] = c.id;
        });
      }

      // Only map to columns that are actually editable (have an accessorKey and are not calculated)
      const editableColumns = initialColumns.filter(col => 
        (col.accessorKey || col.id) && 
        col.id !== 'actions' &&
        col.accessorKey !== 'preco_por_unidade_base' &&
        col.accessorKey !== 'custo_total_calculado' &&
        col.accessorKey !== 'margem_real_calculada'
      );
      
      const rowsToInsert = [];
      
      for (const rowText of rows) {
        const cells = rowText.split('\t');
        if (cells.length < 2 && cells[0].trim() === '') continue; // Skip empty rows

        const rowData: any = {};
        
        for (let index = 0; index < editableColumns.length; index++) {
          const col = editableColumns[index];
          if (cells[index] !== undefined) {
            const key = col.accessorKey || col.id;
            let value: any = cells[index].trim();
            
            // Handle Category mapping (name to ID)
            if (key === 'categoria_id' && isNaN(value as any)) {
              const catId = categoryMap[value.toLowerCase()];
              if (catId) {
                value = catId;
              } else if (value && value.length > 1) {
                // Create new category on the fly
                const { data: newCat } = await supabase.from('categorias').insert([{ nome: value }]).select();
                if (newCat && newCat[0]) {
                  categoryMap[value.toLowerCase()] = newCat[0].id;
                  value = newCat[0].id;
                }
              } else {
                value = null;
              }
            }

            // Handle Unit mapping
            if (key === 'unidade_embalagem') {
              const unit = value.toLowerCase();
              if (unit.includes('grama') || unit === 'g') value = 'g';
              else if (unit.includes('quilo') || unit === 'kg') value = 'kg';
              else if (unit.includes('mili') || unit === 'ml') value = 'ml';
              else if (unit.includes('litro') || unit === 'l') value = 'l';
              else if (unit.includes('unid') || unit === 'un') value = 'un';
            }

            // Basic type conversion for numbers
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
            
            rowData[key] = value;
          }
        }

        // Add default values based on table
        if (table === 'ingredientes') {
          rowData.unidade_embalagem = rowData.unidade_embalagem || 'g';
          rowData.peso_embalagem = rowData.peso_embalagem || 1000;
          rowData.preco_embalagem = rowData.preco_embalagem || 0;
          
          // Calculate unit price if possible
          rowData.preco_por_unidade_base = calculateIngredientUnitPrice(
            rowData.preco_embalagem || 0,
            rowData.peso_embalagem || 1000,
            rowData.unidade_embalagem || 'g'
          );
        }
        
        if (table === 'produtos') {
          rowData.usar_margem_categoria = rowData.usar_margem_categoria ?? true;
          rowData.margem_percentual = rowData.margem_percentual || 30;
          rowData.margem_tipo = rowData.margem_tipo || 'markup';
          rowData.rendimento_unidades = rowData.rendimento_unidades || 1;
        }

        if (table === 'categorias') {
          rowData.margem_padrao = rowData.margem_padrao || 100;
          rowData.tipo_margem = rowData.tipo_margem || 'markup';
        }

        rowsToInsert.push(rowData);
      }

      if (rowsToInsert.length === 0) {
        toast.dismiss(loadingToast);
        return;
      }

      const { data: insertedData, error } = await supabase.from(table).insert(rowsToInsert).select();
      
      if (error) throw error;

      setData(prev => [...(insertedData || []), ...prev]);
      
      // Trigger recalculations after bulk import
      if (table === 'ingredientes') {
        await recalculateAllProducts(supabase);
      } else if (table === 'categorias') {
        await recalculateAllProducts(supabase);
      }

      toast.success(`${insertedData?.length || 0} registros importados!`, { id: loadingToast });
      if (onDataChange) onDataChange();
    } catch (error: any) {
      console.error('Erro ao colar dados:', error);
      toast.error(`Erro na importação: ${error.message}`, { id: loadingToast });
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
      tabIndex={0} // Make it focusable to receive paste events
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
          
          {/* Botão Recalcular Tudo restaurado */}
          {(table === 'produtos' || table === 'ingredientes' || table === 'categorias') && (
            <button 
              onClick={handleRecalculateAll}
              title="Recalcular todos os custos e preços"
              className="flex items-center gap-2 px-4 py-2 bg-surface-container-high text-on-surface font-bold rounded-lg text-sm hover:bg-surface-container-highest transition-all"
            >
              <RefreshCw size={16} /> Recalcular Tudo
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

      {/* Prominent Paste Zone */}
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
        <table className="w-full text-left border-collapse table-fixed min-w-[800px]">
          <thead>
            {tableInstance.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id} className="bg-surface-container-low/50">
                {headerGroup.headers.map(header => (
                  <th key={header.id} className="px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest border-r border-b border-surface-container-high last:border-r-0">
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
                  <td key={cell.id} className="px-2 py-1 text-sm border-r border-surface-container-high last:border-r-0 h-10 relative">
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
  const initialValue = getValue();
  const [value, setValue] = useState(initialValue);
  const [categories, setCategories] = useState<any[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newCategory, setNewCategory] = useState('');

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    const { data } = await supabase.from('categorias').select('*').order('nome');
    setCategories(data || []);
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
    
    const { data, error } = await supabase.from('categorias').insert([{ nome: newCategory }]).select();
    if (error) {
      toast.error('Erro ao criar categoria');
    } else {
      const created = data[0];
      setCategories(prev => [...prev, created].sort((a, b) => a.nome.localeCompare(b.nome)));
      setValue(created.id);
      table.options.meta?.updateData(index, id, created.id);
      setIsCreating(false);
      setNewCategory('');
      toast.success('Categoria criada');
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
