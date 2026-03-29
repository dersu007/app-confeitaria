import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { Produto, ProdutoIngrediente, Ingrediente } from '../types';
import { 
  formatCurrency, 
  calculateRecipeIngredientCost, 
  calculateProductPricing, 
  calculateUnitCost,
  resolveProductMargin,
  recalculateProduct
} from '../services/bakeryService';
import { X, Trash2, Plus } from 'lucide-react';
import toast from 'react-hot-toast';

interface FichaTecnicaProps {
  product: Produto;
  onClose: () => void;
  onUpdate: () => void;
}

export const FichaTecnica = ({ product, onClose, onUpdate }: FichaTecnicaProps) => {
  const { user } = useAuth();
  const [ingredients, setIngredients] = useState<Ingrediente[]>([]);
  const [produtoIngredientes, setProdutoIngredientes] = useState<ProdutoIngrediente[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [product.id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ingRes, recRes] = await Promise.all([
        supabase.from('ingredientes').select('*').order('nome'),
        supabase.from('produto_ingredientes').select('*').eq('produto_id', product.id)
      ]);

      if (ingRes.error) {
        console.error('Erro ao buscar ingredientes:', ingRes.error);
        toast.error('Erro ao carregar ingredientes');
      }
      if (recRes.error) {
        console.error('Erro ao buscar itens da receita:', recRes.error);
        toast.error('Erro ao carregar itens da receita');
      }

      setIngredients(ingRes.data || []);
      setProdutoIngredientes(recRes.data || []);
    } catch (error) {
      console.error('Erro ao carregar dados da ficha técnica:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const addItem = async () => {
    if (ingredients.length === 0) {
      toast.error('Cadastre ingredientes primeiro');
      return;
    }

    const newItem = {
      produto_id: product.id,
      ingrediente_id: ingredients[0].id,
      quantidade: 0,
      unidade: 'g',
      custo_calculado: 0,
      user_id: user?.id
    };

    try {
      const { data, error } = await supabase.from('produto_ingredientes').insert([newItem]).select();
      if (error) {
        console.error('Erro detalhado ao adicionar ingrediente:', error);
        toast.error(`Erro ao adicionar: ${error.message || 'Erro desconhecido'}`);
      } else if (data && data.length > 0) {
        setProdutoIngredientes([...produtoIngredientes, data[0]]);
        await updateProductTotals();
        toast.success('Ingrediente adicionado');
      }
    } catch (err: any) {
      console.error('Exceção ao adicionar ingrediente:', err);
      toast.error(`Erro inesperado: ${err.message}`);
    }
  };

  const updateItem = async (id: string, field: string, value: any) => {
    const item = produtoIngredientes.find(i => i.id === id);
    if (!item) return;

    const ingredientId = field === 'ingrediente_id' ? value : item.ingrediente_id;
    const ingredient = ingredients.find(ing => ing.id === ingredientId);
    
    const updatedItem = { ...item, [field]: value };
    
    if (ingredient) {
      updatedItem.custo_calculado = calculateRecipeIngredientCost(
        updatedItem.quantidade,
        updatedItem.unidade,
        ingredient.preco_por_unidade_base
      );
    }

    const { error } = await supabase.from('produto_ingredientes').update(updatedItem).eq('id', id);
    if (error) {
      toast.error('Erro ao atualizar');
    } else {
      const newItems = produtoIngredientes.map(i => i.id === id ? updatedItem : i);
      setProdutoIngredientes(newItems);
      
      // Recalculate product total cost and pricing
      await updateProductTotals();
    }
  };

  const deleteItem = async (id: string) => {
    const { error } = await supabase.from('produto_ingredientes').delete().eq('id', id);
    if (error) {
      toast.error('Erro ao remover');
    } else {
      const newItems = produtoIngredientes.filter(i => i.id !== id);
      setProdutoIngredientes(newItems);
      await updateProductTotals();
    }
  };

  const updateProductTotals = async () => {
    try {
      await recalculateProduct(product.id, supabase);
      onUpdate();
    } catch (error) {
      console.error('Erro ao recalcular totais do produto:', error);
      toast.error('Erro ao atualizar totais');
    }
  };

  const totalCost = produtoIngredientes.reduce((acc, item) => acc + (item.custo_calculado || 0), 0);

  const getAvailableUnits = (ingredientId: string) => {
    const ingredient = ingredients.find(i => i.id === ingredientId);
    if (!ingredient) return ['g', 'kg'];
    
    const unit = ingredient.unidade_embalagem?.toLowerCase();
    if (unit === 'l' || unit === 'ml') return ['ml', 'l'];
    if (unit === 'un') return ['un'];
    return ['g', 'kg'];
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="p-6 border-b border-surface-container-high flex justify-between items-center bg-surface-container-low">
          <div>
            <h2 className="text-xl font-bold headline text-primary">Ficha Técnica: {product.nome}</h2>
            <p className="text-xs text-on-surface-variant">Configure os ingredientes e proporções da receita</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface-container-high rounded-full transition-all">
            <X size={20} />
          </button>
        </div>

        <div className="flex-grow overflow-y-auto p-6">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-surface-container-high">
                <th className="py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Ingrediente</th>
                <th className="py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant w-32">Quantidade</th>
                <th className="py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant w-24">Unidade</th>
                <th className="py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant w-32">Custo</th>
                <th className="py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-high">
              {produtoIngredientes.map(item => (
                <tr key={item.id} className="group">
                  <td className="py-3 pr-4">
                    <select
                      value={item.ingrediente_id}
                      onChange={(e) => updateItem(item.id, 'ingrediente_id', e.target.value)}
                      className="w-full bg-surface-container-low border-none rounded-lg text-sm p-2 focus:ring-2 focus:ring-primary/20"
                    >
                      {ingredients.map(ing => (
                        <option key={ing.id} value={ing.id}>{ing.nome}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3 pr-4">
                    <input
                      type="number"
                      value={item.quantidade}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        updateItem(item.id, 'quantidade', isNaN(val) ? 0 : val);
                      }}
                      className="w-full bg-surface-container-low border-none rounded-lg text-sm p-2 focus:ring-2 focus:ring-primary/20"
                    />
                  </td>
                  <td className="py-3 pr-4">
                    <select
                      value={item.unidade}
                      onChange={(e) => updateItem(item.id, 'unidade', e.target.value)}
                      className="w-full bg-surface-container-low border-none rounded-lg text-sm p-2 focus:ring-2 focus:ring-primary/20"
                    >
                      {getAvailableUnits(item.ingrediente_id).map(u => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3 font-mono text-sm text-primary">
                    {formatCurrency(item.custo_calculado || 0)}
                  </td>
                  <td className="py-3">
                    <button 
                      onClick={() => deleteItem(item.id)}
                      className="p-1 text-on-surface-variant hover:text-error transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {produtoIngredientes.length === 0 && !loading && (
            <div className="text-center py-12 text-on-surface-variant">
              <p>Nenhum ingrediente adicionado ainda.</p>
            </div>
          )}

          <button
            onClick={addItem}
            className="mt-4 flex items-center gap-2 text-primary font-bold text-sm hover:underline"
          >
            <Plus size={16} /> Adicionar Ingrediente
          </button>
        </div>

        <div className="p-6 border-t border-surface-container-high bg-surface-container-low flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="bg-white px-4 py-2 rounded-xl border border-surface-container-high shadow-sm">
              <span className="text-[10px] uppercase font-bold text-on-surface-variant block">Custo Total do Produto</span>
              <span className="text-xl font-bold text-primary">{formatCurrency(totalCost)}</span>
            </div>
            <div className="bg-white px-4 py-2 rounded-xl border border-surface-container-high shadow-sm">
              <span className="text-[10px] uppercase font-bold text-on-surface-variant block">Custo por Unidade ({product.rendimento_unidades})</span>
              <span className="text-xl font-bold text-on-surface">{formatCurrency(totalCost / (product.rendimento_unidades || 1))}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-8 py-3 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all"
          >
            Concluído
          </button>
        </div>
      </div>
    </div>
  );
};
