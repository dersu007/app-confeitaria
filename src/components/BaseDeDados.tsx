import React, { useState } from 'react';
import { DatabaseGrid, EditableCell, SelectCell, CategoryCell } from './DatabaseGrid';
import { createColumnHelper } from '@tanstack/react-table';
import { RefreshCw, BookOpen, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { dataService } from '../services/dataService';
import { formatCurrency } from '../services/bakeryService';
import { FichaTecnica } from './FichaTecnica';
import { Precificacao } from './Precificacao';

const columnHelper = createColumnHelper<any>();

export const BaseDeDados = () => {
  const [activeTab, setActiveTab] = useState<'ingredientes' | 'produtos' | 'categorias' | 'despesas' | 'clientes'>('ingredientes');
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = () => setRefreshKey(prev => prev + 1);

  const recalculateAll = async () => {
    const loadingToast = toast.loading('Recalculando tudo...');
    try {
      await dataService.recalculateAllProducts();
      refresh();
      toast.success('Recalculado com sucesso!', { id: loadingToast });
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

  const productColumns = [
    columnHelper.accessor('nome', { header: 'Nome', cell: EditableCell }),
    columnHelper.accessor('categoria_id', { header: 'Categoria', cell: CategoryCell }),
    columnHelper.accessor('tempo_producao', { header: 'Tempo Prod. (Horas)', cell: EditableCell }),
    columnHelper.accessor('rendimento_unidades', { header: 'Rendimento', cell: EditableCell }),
    columnHelper.accessor('id', {
      header: 'Ficha Técnica',
      cell: ({ row }) => (
        <button 
          onClick={() => setSelectedProduct(row.original)}
          className="flex items-center gap-1 text-primary hover:underline text-xs font-bold"
        >
          <BookOpen size={14} /> Ficha Técnica
        </button>
      )
    })
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

  const expenseColumns = [
    columnHelper.accessor('descricao', { header: 'Descrição', cell: EditableCell }),
    columnHelper.accessor('valor_mensal', { header: 'Valor Mensal', cell: EditableCell }),
    columnHelper.accessor('categoria', { header: 'Categoria', cell: EditableCell }),
  ];

  const clientColumns = [
    columnHelper.accessor('nome', { header: 'Nome', cell: EditableCell }),
    columnHelper.accessor('telefone', { header: 'Telefone', cell: EditableCell }),
    columnHelper.accessor('email', { header: 'Email', cell: EditableCell }),
    columnHelper.accessor('cpf_cnpj', { header: 'CPF/CNPJ', cell: EditableCell }),
    columnHelper.accessor('data_nascimento', { header: 'Nascimento (AAAA-MM-DD)', cell: EditableCell }),
    columnHelper.accessor('endereco', { header: 'Endereço', cell: EditableCell }),
    columnHelper.accessor('cidade', { header: 'Cidade', cell: EditableCell }),
    columnHelper.accessor('estado', { header: 'UF', cell: EditableCell }),
    columnHelper.accessor('cep', { header: 'CEP', cell: EditableCell }),
    columnHelper.accessor('observacoes', { header: 'Observações', cell: EditableCell }),
    columnHelper.accessor('segmento', { 
      header: 'Segmento', 
      cell: (props) => (
        <SelectCell 
          {...props} 
          options={[
            { value: 'Novo', label: 'Novo' },
            { value: 'Frequente', label: 'Frequente' },
            { value: 'VIP', label: 'VIP' },
            { value: 'Inativo', label: 'Inativo' },
          ]} 
        />
      )
    }),
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex gap-2 bg-surface-container-low p-1 rounded-xl border border-surface-container-high">
          <button 
            onClick={() => setActiveTab('ingredientes')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'ingredientes' ? 'bg-white shadow-sm text-primary' : 'text-on-surface-variant hover:text-primary'}`}
          >
            Ingredientes
          </button>
          <button 
            onClick={() => setActiveTab('produtos')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'produtos' ? 'bg-white shadow-sm text-primary' : 'text-on-surface-variant hover:text-primary'}`}
          >
            Produtos
          </button>
          <button 
            onClick={() => setActiveTab('categorias')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'categorias' ? 'bg-white shadow-sm text-primary' : 'text-on-surface-variant hover:text-primary'}`}
          >
            Categorias
          </button>
          <button 
            onClick={() => setActiveTab('despesas')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'despesas' ? 'bg-white shadow-sm text-primary' : 'text-on-surface-variant hover:text-primary'}`}
          >
            Despesas
          </button>
          <button 
            onClick={() => setActiveTab('clientes')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'clientes' ? 'bg-white shadow-sm text-primary' : 'text-on-surface-variant hover:text-primary'}`}
          >
            Clientes
          </button>
        </div>

      </div>

      <div className="relative">
        {activeTab === 'ingredientes' && <DatabaseGrid table="ingredientes" title="Base de Ingredientes" columns={ingredientColumns} onDataChange={recalculateAll} refreshKey={refreshKey} />}
        {activeTab === 'produtos' && <DatabaseGrid table="produtos" title="Base de Produtos" columns={productColumns} onDataChange={recalculateAll} refreshKey={refreshKey} />}
        {activeTab === 'categorias' && <DatabaseGrid table="categorias" title="Categorias de Produtos" columns={categoryColumns} onDataChange={recalculateAll} refreshKey={refreshKey} />}
        {activeTab === 'despesas' && <DatabaseGrid table="despesas_fixas" title="Despesas Fixas Mensais" columns={expenseColumns} onDataChange={recalculateAll} refreshKey={refreshKey} />}
        {activeTab === 'clientes' && <DatabaseGrid table="clientes" title="Base de Clientes" columns={clientColumns} onDataChange={recalculateAll} refreshKey={refreshKey} />}
      </div>

      {selectedProduct && (
        <FichaTecnica 
          product={selectedProduct} 
          onClose={() => setSelectedProduct(null)} 
          onUpdate={recalculateAll}
        />
      )}
    </div>
  );
};
