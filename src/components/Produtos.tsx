import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { dataService } from '../services/dataService';
import { 
  Plus, 
  Search, 
  Package, 
  Trash2, 
  Edit2, 
  ChevronRight, 
  Clock, 
  TrendingUp, 
  TrendingDown, 
  Calculator, 
  ArrowLeft,
  PieChart,
  FileText,
  Download,
  Settings,
  X,
  BookOpen,
  Loader2,
  Copy,
  LayoutGrid,
  List,
  AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Produto, Categoria, ProdutoIngrediente } from '../types';
import { formatCurrency, calculateUnitCost, calculateProductPricing, validateProductIntegrity } from '../services/bakeryService';
import { PieChart as RePieChart, Pie, Cell, ResponsiveContainer, Tooltip as ReTooltip } from 'recharts';
import { ProductModal } from './Produtos/ProductModal';
import { DEFAULT_PRODUCT_IMAGE } from '../constants';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { exportToCSV } from '../utils/csvUtils';

export const Produtos = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCriticalOnly, setShowCriticalOnly] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Produto | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [productIngredients, setProductIngredients] = useState<ProdutoIngrediente[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [productToEdit, setProductToEdit] = useState<Produto | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Produto | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    fetchData();
  }, []);

  // Handle URL edit parameter
  useEffect(() => {
    if (produtos.length > 0) {
      const editId = searchParams.get('edit');
      if (editId) {
        const product = produtos.find(p => p.id === editId);
        if (product) {
          setProductToEdit(product);
          setShowModal(true);
          // Sync URL: instead of deleting, just ensure we don't loop
          // Actually, removing it is cleaner for the user
          const nextParams = new URLSearchParams(searchParams);
          nextParams.delete('edit');
          setSearchParams(nextParams, { replace: true });
        }
      }
    }
  }, [produtos, searchParams]);

  const handleExportCSV = () => {
    setIsExporting(true);
    try {
      const exportData = produtos.map(p => ({
        nome: p.nome,
        categoria: categorias.find(c => c.id === p.categoria_id)?.nome || 'Sem Categoria',
        rendimento: p.rendimento_unidades,
        peso_final: p.peso_final_produto,
        tempo_producao: `${p.tempo_producao_valor} ${p.tempo_producao_unidade}`,
        custo_hora: p.custo_hora_trabalho,
        custo_mao_obra: p.custo_mao_obra,
        custo_fixo: p.custo_fixo_rateado,
        custo_embalagem: p.custo_embalagem,
        custo_total: p.custo_total,
        custo_unitario: p.custo_unitario,
        margem_real: p.margem_real_calculada,
        preco_venda: p.preco_venda_final,
        modo_preparo: (p.modo_preparo || '').replace(/\n/g, ' ')
      }));

      const success = exportToCSV(
        exportData,
        {
          nome: 'Nome',
          categoria: 'Categoria',
          rendimento: 'Rendimento (Unidades)',
          peso_final: 'Peso Final (g)',
          tempo_producao: 'Tempo de Produção',
          custo_hora: 'Custo Hora Trabalho',
          custo_mao_obra: 'Custo Mão de Obra',
          custo_fixo: 'Custo Fixo Rateado',
          custo_embalagem: 'Custo Embalagem',
          custo_total: 'Custo Total',
          custo_unitario: 'Custo Unitário',
          margem_real: 'Margem de Lucro Real (%)',
          preco_venda: 'Preço de Venda Final',
          modo_preparo: 'Modo de Preparo'
        },
        'produtos_detalhado'
      );
      if (success) toast.success('Relatório detalhado de produtos exportado!');
    } catch (error) {
      toast.error('Erro ao exportar CSV');
    } finally {
      setIsExporting(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [prodRes, catRes] = await Promise.all([
        dataService.getProdutos(),
        dataService.getCategorias()
      ]);
      
      setProdutos(prodRes);
      setCategorias(catRes);
    } catch (error) {
      toast.error('Erro ao carregar dados');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProductIngredients = async (productId: string) => {
    try {
      const data = await dataService.getProdutoIngredientes(productId);
      setProductIngredients(data);
    } catch (err) {
      console.error('Erro inesperado ao carregar ficha técnica:', err);
      toast.error('Erro ao carregar ficha técnica');
    }
  };

  const handleProductClick = async (product: Produto) => {
    setSelectedProduct(product);
    setShowDetail(true);
    await fetchProductIngredients(product.id);
  };

  const handleAddProduct = () => {
    setProductToEdit(null);
    setShowModal(true);
  };

  const handleEditProduct = (e: React.MouseEvent, product: Produto) => {
    e.stopPropagation();
    setProductToEdit(product);
    setShowModal(true);
  };

  const handleDuplicateProduct = async (e: React.MouseEvent, product: Produto) => {
    e.stopPropagation();
    const loadingToast = toast.loading('Duplicando produto...');
    try {
      const duplicated = await dataService.duplicateProduct(product.id);
      toast.success('Produto duplicado com sucesso!', { id: loadingToast });
      await fetchData();
      
      // Open the modal with the new product for further edits if desired
      setProductToEdit(duplicated);
      setShowModal(true);
    } catch (error) {
      console.error('Erro ao duplicar produto:', error);
      toast.error('Ocorreu um erro ao duplicar o produto.', { id: loadingToast });
    }
  };

  const handleDeleteProduct = async () => {
    if (!productToDelete) return;

    setIsDeleting(true);
    try {
      await dataService.deleteProduto(productToDelete.id);
      toast.success('Produto excluído com sucesso');
      setShowDetail(false);
      setShowDeleteConfirm(false);
      fetchData();
    } catch (error: any) {
      console.error('Erro ao excluir produto:', error);
      toast.error(error.message || 'Erro ao excluir o produto. Verifique se ele está vinculado a pedidos.');
    } finally {
      setIsDeleting(false);
      setProductToDelete(null);
    }
  };

  const filteredProdutos = useMemo(() => {
    return produtos.filter(p => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = p.nome.toLowerCase().includes(searchLower) || 
                           (p.modo_preparo?.toLowerCase().includes(searchLower));
      
      const matchesCategory = selectedCategory === 'all' || p.categoria_id === selectedCategory;
      
      const isCritical = validateProductIntegrity(p).length > 0;
      const matchesCritical = !showCriticalOnly || isCritical;

      return matchesSearch && matchesCategory && matchesCritical;
    });
  }, [produtos, searchTerm, showCriticalOnly, selectedCategory]);

  const getCategoryName = (catId: string) => {
    return categorias.find(c => c.id === catId)?.nome || 'Sem Categoria';
  };

  if (showDetail && selectedProduct) {
    return (
      <>
        <ProductDetail 
          product={selectedProduct} 
          ingredients={productIngredients} 
          onBack={() => setShowDetail(false)} 
          onEdit={(product) => {
            setProductToEdit(product);
            setShowModal(true);
          }}
          onDelete={(product) => {
            setProductToDelete(product);
            setShowDeleteConfirm(true);
          }}
          onDuplicate={(e, product) => handleDuplicateProduct(e, product)}
          onRefresh={async () => {
            const data = await dataService.getProdutoById(selectedProduct.id);
            setSelectedProduct(data);
            await fetchData();
          }}
        />
        {showModal && (
          <ProductModal 
            produto={productToEdit}
            onClose={() => setShowModal(false)}
            onDelete={async (id) => {
              setProductToDelete(productToEdit);
              setShowDeleteConfirm(true);
              setShowModal(false);
            }}
            onSave={async () => {
              setShowModal(false);
              await fetchData();
              
              // Explicitly fetch the updated product to ensure UI is in sync
              if (selectedProduct?.id) {
                try {
                  const data = await dataService.getProdutoById(selectedProduct.id);
                  setSelectedProduct(data);
                } catch (error) {
                  console.error('Error refreshing product:', error);
                }
              }
            }}
          />
        )}
      </>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold headline text-on-surface">Produtos</h1>
          <p className="text-sm text-on-surface-variant">Gerencie seu catálogo de produtos e precificação</p>
        </div>
        <div className="flex gap-3">
          <div className="flex bg-surface-container-low p-1 rounded-xl border border-surface-container-high transition-all">
            <button 
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-primary' : 'text-on-surface-variant hover:text-primary'}`}
              title="Visualização em Grade"
            >
              <LayoutGrid size={18} />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-primary' : 'text-on-surface-variant hover:text-primary'}`}
              title="Visualização em Lista"
            >
              <List size={18} />
            </button>
          </div>
          <button 
            onClick={handleExportCSV}
            disabled={isExporting}
            className="hidden sm:flex items-center gap-2 bg-white text-on-surface px-4 py-3 rounded-xl font-bold border border-surface-container-high shadow-m hover:bg-surface-container-low transition-all text-sm disabled:opacity-50"
          >
            <Download size={18} /> Exportar CSV
          </button>
          <button 
            onClick={handleAddProduct}
            className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all text-sm"
          >
            <Plus size={20} /> Novo Produto
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 bg-surface-container-low px-4 py-3 rounded-xl border border-surface-container-high">
        <div className="flex items-center gap-3 flex-grow">
          <Search size={20} className="text-on-surface-variant" />
          <input 
            type="text" 
            placeholder="Buscar produtos ou descrição..." 
            className="bg-transparent border-none focus:ring-0 text-sm flex-grow"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-3">
          <div className="h-6 w-px bg-surface-container-high hidden md:block"></div>
          
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-white border-none rounded-lg text-xs font-bold text-on-surface-variant px-3 py-2 shadow-sm focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer"
            style={{ backgroundImage: 'none' }}
          >
            <option value="all">Todas as Categorias</option>
            {categorias.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.nome}</option>
            ))}
          </select>

          <div className="h-6 w-px bg-surface-container-high"></div>
          
          <button
            onClick={() => setShowCriticalOnly(!showCriticalOnly)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all shrink-0 ${showCriticalOnly ? 'bg-error text-white shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
          >
            <AlertTriangle size={14} className={showCriticalOnly ? '' : 'text-error'} />
            <span className="hidden sm:inline">⚠️ Necessita Correção</span>
            <span className="sm:hidden">Correção</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 size={40} className="text-primary animate-spin opacity-40" />
          <p className="text-sm text-on-surface-variant font-medium">Carregando seu catálogo...</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProdutos.map(produto => (
            <div 
              key={produto.id} 
              onClick={() => handleProductClick(produto)}
              className="bg-white rounded-2xl shadow-sm border border-surface-container-high hover:shadow-md transition-all group cursor-pointer overflow-hidden flex flex-col"
            >
              <div className="aspect-video bg-surface-container-low relative overflow-hidden">
                <img 
                  src={produto.imagem_url || DEFAULT_PRODUCT_IMAGE} 
                  alt={produto.nome} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = DEFAULT_PRODUCT_IMAGE;
                  }}
                />
                
                {validateProductIntegrity(produto).length > 0 && (
                  <div 
                    className="absolute top-3 left-3 p-1.5 bg-white/90 backdrop-blur-sm rounded-full text-error border border-error/20 shadow-sm animate-pulse"
                    title={`Erros:\n${validateProductIntegrity(produto).join('\n')}`}
                  >
                    <AlertTriangle size={16} />
                  </div>
                )}

                <div className="absolute top-3 right-3 flex flex-col gap-2 scale-0 group-hover:scale-100 transition-transform origin-right duration-300">
                  <div className="px-2 py-1 bg-white/90 backdrop-blur-sm rounded-lg text-[10px] font-bold text-primary border border-primary/20 text-center shadow-sm">
                    {getCategoryName(produto.categoria_id)}
                  </div>
                  <button 
                    onClick={(e) => handleDuplicateProduct(e, produto)}
                    className="p-2 bg-primary text-white rounded-lg shadow-lg hover:bg-primary/90 transition-all flex items-center justify-center border border-white/20"
                    title="Duplicar Produto"
                  >
                    <Copy size={14} />
                  </button>
                </div>
              </div>
              
              <div className="p-5 flex-grow flex flex-col">
                <h3 className="text-lg font-bold headline text-on-surface mb-1 truncate">{produto.nome}</h3>
                <div className="flex items-center gap-2 text-[10px] text-on-surface-variant mb-4">
                  <Clock size={12} />
                  <span>{produto.tempo_producao_valor ? `${produto.tempo_producao_valor} ${produto.tempo_producao_unidade === 'horas' ? 'h' : 'min'}` : '--'}</span>
                  <span className="mx-1">•</span>
                  <span>{produto.rendimento_unidades} un</span>
                </div>
                
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-surface-container-high">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-on-surface-variant block">Custo Unit.</span>
                    <span className="text-sm font-bold text-on-surface">
                      {formatCurrency(produto.custo_unitario || 0)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-on-surface-variant block">Preço Venda</span>
                    <span className="text-lg font-bold text-primary">{formatCurrency(produto.preco_venda_final)}</span>
                  </div>
                </div>
                
                <div className="mt-4 flex items-center justify-between">
                  <div className={`flex items-center gap-1 text-xs font-bold ${produto.margem_real_calculada >= 40 ? 'text-primary' : 'text-error'}`}>
                    {produto.margem_real_calculada >= 40 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    <span>{produto.margem_real_calculada.toFixed(1)}% margem</span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-bold text-primary">
                    <BookOpen size={12} /> Ver Detalhes
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-surface-container-lowest rounded-2xl border border-surface-container-high shadow-m overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low/50 border-b border-surface-container-high">
                  <th className="px-6 py-5 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Produto</th>
                  <th className="px-6 py-5 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Categoria</th>
                  <th className="px-6 py-5 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Preço Venda</th>
                  <th className="px-6 py-5 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Custo Total</th>
                  <th className="px-6 py-5 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest text-center">Margem (%)</th>
                  <th className="px-6 py-5 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest text-center">Lucro (R$)</th>
                  <th className="px-6 py-5 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Tempo</th>
                  <th className="px-6 py-5 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-high">
                {filteredProdutos.map(produto => {
                  const profit = produto.preco_venda_final - (produto.custo_total || 0);
                  return (
                    <tr 
                      key={produto.id} 
                      onClick={() => handleProductClick(produto)}
                      className={`hover:bg-surface-container-low/30 transition-colors group cursor-pointer ${validateProductIntegrity(produto).length > 0 ? 'bg-error/5' : ''}`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-lg overflow-hidden bg-surface-container-low flex-shrink-0 relative">
                            <img 
                              src={produto.imagem_url || DEFAULT_PRODUCT_IMAGE} 
                              alt={produto.nome}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                            {validateProductIntegrity(produto).length > 0 && (
                              <div className="absolute inset-0 bg-error/20 flex items-center justify-center">
                                <AlertTriangle size={16} className="text-error" />
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-on-surface text-sm sm:text-base">{produto.nome}</p>
                              {validateProductIntegrity(produto).length > 0 && (
                                <AlertTriangle size={14} className="text-error" title={validateProductIntegrity(produto).join('\n')} />
                              )}
                            </div>
                            <p className="text-[10px] text-on-surface-variant italic">Rend: {produto.rendimento_unidades} un</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 bg-surface-container-low rounded-lg text-[10px] font-bold text-primary border border-primary/10">
                          {getCategoryName(produto.categoria_id)}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-bold text-primary text-sm whitespace-nowrap">
                        {formatCurrency(produto.preco_venda_final)}
                      </td>
                      <td className="px-6 py-4 font-medium text-on-surface-variant text-sm whitespace-nowrap">
                        {formatCurrency(produto.custo_total || 0)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className={`inline-flex items-center gap-1 text-xs font-bold ${produto.margem_real_calculada >= 40 ? 'text-primary' : 'text-error'}`}>
                          {produto.margem_real_calculada >= 40 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                          <span>{produto.margem_real_calculada.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`text-sm font-bold ${profit > 0 ? 'text-primary' : 'text-error'}`}>
                          {formatCurrency(profit)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-[11px] text-on-surface-variant">
                          <Clock size={14} />
                          <span>{produto.tempo_producao_valor ? `${produto.tempo_producao_valor}${produto.tempo_producao_unidade === 'horas' ? 'h' : 'm'}` : '--'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={(e) => handleDuplicateProduct(e, produto)}
                            className="p-2 text-on-surface-variant hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                            title="Duplicar"
                          >
                            <Copy size={16} />
                          </button>
                          <button 
                            onClick={(e) => handleEditProduct(e, produto)}
                            className="p-2 text-on-surface-variant hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                            title="Editar"
                          >
                            <Edit2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {filteredProdutos.length === 0 && !loading && (
        <div className="text-center py-20 bg-surface-container-low rounded-3xl border-2 border-dashed border-surface-container-high animate-in fade-in duration-500">
          <Package size={48} className="mx-auto text-on-surface-variant/30 mb-4" />
          <h3 className="text-lg font-bold text-on-surface mb-1">Nenhum produto encontrado</h3>
          <p className="text-on-surface-variant text-sm max-w-xs mx-auto">
            {selectedCategory !== 'all' 
              ? "Não existem itens cadastrados nesta categoria com os filtros atuais." 
              : "Tente ajustar sua busca ou filtros para encontrar o que procura."}
          </p>
          {(searchTerm || selectedCategory !== 'all' || showCriticalOnly) && (
            <button 
              onClick={() => {
                setSearchTerm('');
                setSelectedCategory('all');
                setShowCriticalOnly(false);
              }}
              className="mt-6 text-primary font-bold text-sm hover:underline"
            >
              Limpar todos os filtros
            </button>
          )}
        </div>
      )}

      {showModal && (
        <ProductModal 
          produto={productToEdit}
          onClose={() => setShowModal(false)}
          onDelete={async (id) => {
            setProductToDelete(productToEdit);
            setShowDeleteConfirm(true);
            setShowModal(false);
          }}
          onSave={async () => {
            setShowModal(false);
            await fetchData();
            
            // If we are in detail view, refresh the selected product
            if (showDetail && selectedProduct?.id) {
              try {
                const data = await dataService.getProdutoById(selectedProduct.id);
                setSelectedProduct(data);
              } catch (error) {
                console.error('Error refreshing product:', error);
              }
            }
          }}
        />
      )}

      {/* global ConfirmDialog for products */}
      <ConfirmDialog 
        isOpen={showDeleteConfirm}
        title="Excluir Produto?"
        description={`Você tem certeza que deseja excluir "${productToDelete?.nome}"? Isso removerá a ficha técnica permanentemente.`}
        onConfirm={handleDeleteProduct}
        onCancel={() => { setShowDeleteConfirm(false); setProductToDelete(null); }}
        isLoading={isDeleting}
      />
    </div>
  );
};

const ProductDetail = ({ 
  product, 
  ingredients, 
  onBack, 
  onEdit, 
  onDelete,
  onDuplicate,
  onRefresh
}: { 
  product: Produto, 
  ingredients: ProdutoIngrediente[], 
  onBack: () => void, 
  onEdit: (product: Produto) => void,
  onDelete: (product: Produto) => void,
  onDuplicate: (e: React.MouseEvent, product: Produto) => void,
  onRefresh: () => Promise<void>
}) => {
  const laborCost = product.custo_mao_obra || 0;
  const fixedCost = product.custo_fixo_rateado || 0;
  const ingredientsCost = Math.max(0, product.custo_total - laborCost - fixedCost);
  const unitCost = product.custo_unitario || 0;
  
  const handleRemoveImage = async () => {
    const loadingToast = toast.loading('Removendo imagem...');
    try {
      await dataService.saveProduto({ ...product, imagem_url: null });
      toast.success('Imagem removida', { id: loadingToast });
      await onRefresh();
    } catch (error) {
      toast.error('Erro ao remover imagem', { id: loadingToast });
    }
  };

  const pieData = [
    { name: 'Insumos', value: product.custo_total > 0 ? (ingredientsCost / product.custo_total) * 100 : 0, color: '#2b6a57' },
    { name: 'Mão de Obra', value: product.custo_total > 0 ? (laborCost / product.custo_total) * 100 : 0, color: '#6a4a2b' },
    { name: 'Custos Fixos', value: product.custo_total > 0 ? (fixedCost / product.custo_total) * 100 : 0, color: '#efe0cd' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex justify-between items-center">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors font-bold"
        >
          <ArrowLeft size={20} /> Voltar para lista
        </button>
        <div className="flex gap-3">
          <button 
            onClick={(e) => onDuplicate(e, product)}
            className="flex items-center gap-2 bg-surface-container-high text-on-surface px-4 py-2 rounded-xl font-bold hover:bg-surface-container-highest transition-all border border-surface-container-highest"
            title="Duplicar este produto"
          >
            <Copy size={18} /> Duplicar
          </button>
          <button 
            onClick={() => onDelete(product)}
            className="flex items-center gap-2 bg-error/10 text-error px-4 py-2 rounded-xl font-bold hover:bg-error/20 transition-all border border-error/20"
          >
            <Trash2 size={18} /> Excluir
          </button>
          <button 
            onClick={() => onEdit(product)}
            className="flex items-center gap-2 bg-surface-container-high text-on-surface px-4 py-2 rounded-xl font-bold hover:bg-surface-container-highest transition-all"
          >
            <Settings size={18} /> Configurar
          </button>
          <button 
            onClick={() => onEdit(product)}
            className="flex items-center gap-2 bg-primary text-white px-6 py-2 rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all"
          >
            <Edit2 size={18} /> Editar Produto
          </button>
        </div>
      </div>

      {/* Hero Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Product Image & Main Info */}
        <div className="relative aspect-square lg:aspect-auto lg:h-[450px] rounded-3xl overflow-hidden shadow-2xl group">
          <img 
            src={product.imagem_url || DEFAULT_PRODUCT_IMAGE} 
            alt={product.nome} 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.target as HTMLImageElement).src = DEFAULT_PRODUCT_IMAGE;
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-8">
            <span className="bg-primary text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full w-fit mb-3">
              Honey Sugar
            </span>
            <h1 className="text-4xl font-extrabold headline text-white mb-2 leading-tight">
              {product.nome}
            </h1>
          </div>
          
          {product.imagem_url && (
            <button 
              onClick={handleRemoveImage}
              className="absolute top-4 right-4 p-3 bg-white/20 backdrop-blur-md text-white rounded-xl opacity-0 group-hover:opacity-100 transition-all hover:bg-error hover:text-white"
              title="Remover Imagem"
            >
              <Trash2 size={20} />
            </button>
          )}
        </div>

        {/* Right: Quick Stats & Pricing */}
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-6 rounded-2xl border border-surface-container-high shadow-sm">
              <span className="text-[10px] uppercase font-bold text-on-surface-variant block mb-2">Tempo Total</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold headline text-on-surface">{product.tempo_producao_valor || '--'}</span>
                <span className="text-xs font-bold text-on-surface-variant uppercase">{product.tempo_producao_unidade || 'HORAS'}</span>
              </div>
              <p className="text-[10px] text-on-surface-variant mt-2 italic">Incluindo fermentação fria</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-surface-container-high shadow-sm">
              <span className="text-[10px] uppercase font-bold text-on-surface-variant block mb-2">Rendimento</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold headline text-on-surface">{product.rendimento_unidades}</span>
                <span className="text-xs font-bold text-on-surface-variant">UNIDADES</span>
              </div>
              <p className="text-[10px] text-on-surface-variant mt-2 italic">Aprox. {product.peso_final_produto}g por unidade</p>
            </div>
          </div>

          <div className="bg-primary p-8 rounded-2xl shadow-xl shadow-primary/20 text-white relative overflow-hidden">
            <div className="relative z-10">
              <span className="text-[10px] uppercase font-bold opacity-70 block mb-2">Preço Sugerido</span>
              <h2 className="text-5xl font-extrabold headline mb-2">{formatCurrency(product.preco_venda_final)}</h2>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full w-fit">
                  <TrendingUp size={14} />
                  <span className="text-xs font-bold">
                    Margem: {product.margem_real_calculada.toFixed(0)}% 
                    ({product.usar_margem_categoria ? 'Categoria' : 'Manual'})
                  </span>
                </div>
                <p className="text-[10px] opacity-80 italic ml-1">Lucro real após pagamento de mão de obra</p>
              </div>
            </div>
            <Calculator className="absolute -right-8 -bottom-8 text-white/10 w-48 h-48 rotate-12" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-surface-container-low p-4 rounded-2xl flex items-center gap-4 border border-surface-container-high">
              <div className="p-2 bg-white rounded-lg text-primary shadow-sm">
                <Calculator size={20} />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-on-surface-variant block">Peso da Massa</span>
                <span className="text-lg font-bold text-on-surface">{(product.peso_final_produto * product.rendimento_unidades / 1000).toFixed(3)}kg</span>
              </div>
            </div>
            <div className="bg-surface-container-low p-4 rounded-2xl flex items-center gap-4 border border-surface-container-high">
              <div className="p-2 bg-white rounded-lg text-primary shadow-sm">
                <TrendingUp size={20} />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-on-surface-variant block">Custo Unitário</span>
                <span className="text-lg font-bold text-on-surface">{formatCurrency(unitCost)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Ingredients Table */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white rounded-3xl border border-surface-container-high shadow-sm overflow-hidden">
            <div className="p-6 border-b border-surface-container-high flex justify-between items-center bg-surface-container-low/30">
              <div className="flex items-center gap-3">
                <FileText className="text-primary" size={24} />
                <h2 className="text-xl font-bold headline text-on-surface">Tabela de Insumos & Custos</h2>
              </div>
              <div className="flex gap-2">
                <button className="p-2 hover:bg-surface-container-high rounded-lg text-on-surface-variant transition-all">
                  <Download size={18} />
                </button>
                <button className="bg-primary text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-primary/90 transition-all">
                  Editar Lista
                </button>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low/10">
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Ingrediente</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant text-center">Qtde.</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant text-center">Unid.</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant text-right">Custo Unit.</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant text-right">Custo Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-high">
                  {ingredients.map((item) => (
                    <tr key={item.id} className="hover:bg-surface-container-low/20 transition-colors">
                      <td className="px-6 py-4 font-bold text-on-surface text-sm">{item.ingrediente?.nome}</td>
                      <td className="px-6 py-4 text-center font-mono text-sm">{item.quantidade}</td>
                      <td className="px-6 py-4 text-center">
                        <span className="px-2 py-1 bg-surface-container-low rounded text-[10px] font-bold text-on-surface-variant">
                          {item.unidade}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-sm text-on-surface-variant">
                        {formatCurrency(item.ingrediente?.preco_por_unidade_base || 0)}
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-sm font-bold text-primary">
                        {formatCurrency(item.custo_calculado)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-surface-container-low/30">
                    <td colSpan={4} className="px-6 py-6 text-right text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                      Total Insumos
                    </td>
                    <td className="px-6 py-6 text-right text-2xl font-extrabold text-primary headline">
                      {formatCurrency(ingredientsCost)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Modo de Preparo */}
          <div className="bg-white rounded-3xl border border-surface-container-high shadow-sm p-8">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-2 bg-primary-container/30 rounded-xl text-primary">
                <Calculator size={24} />
              </div>
              <h2 className="text-2xl font-bold headline text-on-surface">Modo de Preparo</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                  {product.modo_preparo ? (
                    <div className="prose prose-sm max-w-none text-on-surface-variant">
                      {product.modo_preparo.split('\n').map((step, i) => (
                        <div key={i} className="flex gap-6 mb-8 group">
                          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary-container/20 text-primary flex items-center justify-center font-bold text-lg group-hover:bg-primary group-hover:text-white transition-all">
                            {i + 1}
                          </div>
                          <div>
                            <p className="leading-relaxed">{step}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-on-surface-variant italic">Nenhum modo de preparo cadastrado.</p>
                  )}
            </div>
          </div>
        </div>

        {/* Right: Breakdown & Labor */}
        <div className="space-y-8">
          {/* Cost Composition */}
          <div className="bg-white rounded-3xl border border-surface-container-high shadow-sm p-8">
            <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant mb-8">Composição de Custos</h3>
            <div className="h-64 w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <RePieChart>
                  <Pie
                    data={pieData}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={8}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <ReTooltip 
                    formatter={(value: number) => [`${value.toFixed(1)}%`, 'Porcentagem']}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                </RePieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-3xl font-extrabold headline text-on-surface">100%</span>
              </div>
            </div>
            
            <div className="space-y-4 mt-8">
              {pieData.map((item) => (
                <div key={item.name} className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                    <span className="text-xs font-bold text-on-surface-variant">{item.name} ({item.value.toFixed(1)}%)</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-on-surface">
                    {formatCurrency(product.custo_total ? (product.custo_total * item.value / 100) : 0)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Labor & Operation */}
          <div className="bg-white rounded-3xl border border-surface-container-high shadow-sm p-8">
            <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant mb-8">Detalhamento de Custos Operacionais</h3>
            
            <div className="space-y-6">
              <div className="bg-surface-container-low p-5 rounded-2xl border border-surface-container-high">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-on-surface-variant block">Mão de Obra</span>
                    <span className="text-lg font-bold text-on-surface">{product.tempo_producao_valor || 0} {product.tempo_producao_unidade}</span>
                    <p className="text-[10px] text-on-surface-variant">Custo/Hora: {formatCurrency(product.custo_hora_trabalho || 0)}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-on-surface-variant block">Custo Total MO</span>
                    <span className="text-lg font-bold text-primary">{formatCurrency(laborCost)}</span>
                  </div>
                </div>
                <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-primary h-full transition-all duration-500" 
                    style={{ width: `${product.custo_total > 0 ? (laborCost / product.custo_total) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="bg-surface-container-low p-5 rounded-2xl border border-surface-container-high flex justify-between items-center">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-on-surface-variant block">Embalagem</span>
                    <span className="text-sm font-bold text-on-surface">Custo por Unidade</span>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-primary">{formatCurrency(product.custo_embalagem || 0)}</span>
                  </div>
                </div>

                <div className="bg-surface-container-low p-5 rounded-2xl border border-surface-container-high flex justify-between items-center">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-on-surface-variant block">Custos Fixos (Rateio)</span>
                    <span className="text-sm font-bold text-on-surface">Rateio Proporcional</span>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-primary">{formatCurrency(fixedCost)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
