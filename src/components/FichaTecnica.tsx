import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { Produto, ProdutoIngrediente, Ingrediente } from '../types';
import { 
  formatCurrency, 
  calculateRecipeIngredientCost, 
  recalculateProduct
} from '../services/bakeryService';
import { X, Trash2, Plus, RefreshCw, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

/*
  SQL PARA SUPABASE (RLS POLICIES):
  
  -- Habilitar RLS para todas as tabelas
  ALTER TABLE ingredientes ENABLE ROW LEVEL SECURITY;
  ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;
  ALTER TABLE produto_ingredientes ENABLE ROW LEVEL SECURITY;
  ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;
  ALTER TABLE despesas_fixas ENABLE ROW LEVEL SECURITY;
  ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

  -- Criar políticas de acesso (Exemplo para produto_ingredientes)
  CREATE POLICY "Permitir tudo para usuários autenticados" ON produto_ingredientes FOR ALL TO authenticated USING (true) WITH CHECK (true);
  CREATE POLICY "Permitir tudo para usuários autenticados" ON ingredientes FOR ALL TO authenticated USING (true) WITH CHECK (true);
  CREATE POLICY "Permitir tudo para usuários autenticados" ON produtos FOR ALL TO authenticated USING (true) WITH CHECK (true);
  CREATE POLICY "Permitir tudo para usuários autenticados" ON categorias FOR ALL TO authenticated USING (true) WITH CHECK (true);
*/

interface FichaTecnicaProps {
  product: Produto;
  onClose: () => void;
  onUpdate: () => void;
}

export const FichaTecnica = ({ product: initialProduct, onClose, onUpdate }: FichaTecnicaProps) => {
  const { user } = useAuth();
  const [ingredients, setIngredients] = useState<Ingrediente[]>([]);
  const [produtoIngredientes, setProdutoIngredientes] = useState<ProdutoIngrediente[]>([]);
  const [currentProduct, setCurrentProduct] = useState<Produto>(initialProduct);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    fetchData();
  }, [initialProduct.id]);

  const fetchData = async () => {
    if (!initialProduct.id) return;
    setLoading(true);
    try {
      const [ingRes, recRes, prodRes] = await Promise.all([
        supabase.from('ingredientes').select('*').order('nome'),
        supabase.from('produto_ingredientes').select('*, ingrediente:ingredientes(*)').eq('produto_id', initialProduct.id),
        supabase.from('produtos').select('*').eq('id', initialProduct.id).single()
      ]);

      if (ingRes.error) throw ingRes.error;
      if (recRes.error) throw recRes.error;
      if (prodRes.error) throw prodRes.error;

      setIngredients(ingRes.data || []);
      setProdutoIngredientes(recRes.data || []);
      setCurrentProduct(prodRes.data);
    } catch (error: any) {
      console.error('Erro ao carregar dados da ficha técnica:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const addItem = async () => {
    if (!initialProduct.id || !user?.id) return;
    if (ingredients.length === 0) {
      toast.error('Cadastre ingredientes primeiro');
      return;
    }

    setIsAdding(true);
    const firstIngredient = ingredients[0];
    const availableUnits = getAvailableUnits(firstIngredient.id);
    const initialUnit = availableUnits[0] || 'g';
    
    const newItem = {
      produto_id: initialProduct.id,
      ingrediente_id: firstIngredient.id,
      quantidade: 0,
      unidade: initialUnit,
      custo_calculado: 0,
      user_id: user.id
    };

    try {
      const { data, error } = await supabase
        .from('produto_ingredientes')
        .insert([newItem])
        .select('*, ingrediente:ingredientes(*)');

      if (error) throw error;
      
      if (data && data.length > 0) {
        setProdutoIngredientes(prev => [...prev, data[0]]);
        await updateProductTotals();
        toast.success('Ingrediente adicionado');
      }
    } catch (err: any) {
      console.error('Erro ao adicionar ingrediente:', err);
      toast.error('Erro ao adicionar ingrediente');
    } finally {
      setIsAdding(false);
    }
  };

  const updateItem = async (id: string, field: string, value: any) => {
    const item = produtoIngredientes.find(i => i.id === id);
    if (!item) return;

    let ingredientId = item.ingrediente_id;
    let quantity = item.quantidade;
    let unit = item.unidade;

    if (field === 'ingrediente_id') {
      ingredientId = value;
      const availableUnits = getAvailableUnits(value);
      if (!availableUnits.includes(unit)) {
        unit = availableUnits[0];
      }
    } else if (field === 'quantidade') {
      quantity = Number(value) || 0;
    } else if (field === 'unidade') {
      unit = value;
    }

    const ingredient = ingredients.find(ing => ing.id === ingredientId);
    const custo_calculado = ingredient 
      ? calculateRecipeIngredientCost(quantity, unit, ingredient.preco_por_unidade_base)
      : 0;

    const updatePayload = {
      ingrediente_id: ingredientId,
      quantidade: quantity,
      unidade: unit,
      custo_calculado
    };

    // Optimistic Update
    setProdutoIngredientes(prev => prev.map(i => i.id === id ? { ...i, ...updatePayload, ingrediente: ingredient } : i));

    try {
      const { error } = await supabase.from('produto_ingredientes').update(updatePayload).eq('id', id);
      if (error) throw error;
      await updateProductTotals();
    } catch (err: any) {
      console.error('Erro ao atualizar item:', err);
      toast.error('Erro ao salvar alteração');
      fetchData(); // Reverter para o estado do banco
    }
  };

  const deleteItem = async (id: string) => {
    try {
      const { error } = await supabase.from('produto_ingredientes').delete().eq('id', id);
      if (error) throw error;
      
      setProdutoIngredientes(prev => prev.filter(i => i.id !== id));
      await updateProductTotals();
      toast.success('Removido da ficha');
    } catch (err: any) {
      console.error('Erro ao deletar item:', err);
      toast.error('Erro ao remover item');
    }
  };

  const updateProductTotals = async () => {
    try {
      const updatedProduct = await recalculateProduct(initialProduct.id, supabase);
      if (updatedProduct) {
        setCurrentProduct(updatedProduct);
      }
      onUpdate();
    } catch (error: any) {
      console.error('Erro ao recalcular totais do produto:', error);
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
            <h2 className="text-xl font-bold headline text-primary">Ficha Técnica: {currentProduct.nome}</h2>
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
                      type="text"
                      value={item.quantidade}
                      onChange={(e) => {
                        const val = e.target.value.replace(',', '.');
                        if (!isNaN(val as any)) {
                          updateItem(item.id, 'quantidade', parseFloat(val) || 0);
                        }
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
              <AlertCircle size={32} className="mx-auto opacity-20 mb-2" />
              <p>Nenhum ingrediente adicionado ainda.</p>
            </div>
          )}

          <button
            onClick={addItem}
            disabled={isAdding}
            className="mt-4 flex items-center gap-2 text-primary font-bold text-sm hover:underline disabled:opacity-50"
          >
            {isAdding ? <RefreshCw size={16} className="animate-spin" /> : <Plus size={16} />} 
            {isAdding ? 'Adicionando...' : 'Adicionar Ingrediente'}
          </button>
        </div>

        <div className="p-6 border-t border-surface-container-high bg-surface-container-low flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="bg-white px-4 py-2 rounded-xl border border-surface-container-high shadow-sm">
              <span className="text-[10px] uppercase font-bold text-on-surface-variant block">Custo Total do Produto</span>
              <span className="text-xl font-bold text-primary">{formatCurrency(totalCost)}</span>
            </div>
            <div className="bg-white px-4 py-2 rounded-xl border border-surface-container-high shadow-sm">
              <span className="text-[10px] uppercase font-bold text-on-surface-variant block">Custo por Unidade ({currentProduct.rendimento_unidades})</span>
              <span className="text-xl font-bold text-on-surface">{formatCurrency(totalCost / (currentProduct.rendimento_unidades || 1))}</span>
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
