import React from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { X, Save, AlertTriangle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { dataService } from '../../services/dataService';
import { Ingrediente } from '../../types';

const ingredienteSchema = z.object({
  nome: z.string().min(3, 'O nome deve ter no mínimo 3 caracteres'),
  unidade_embalagem: z.enum(['g', 'kg', 'ml', 'l', 'un']),
  peso_embalagem: z.coerce.number().min(0.001, 'A quantidade da embalagem deve ser maior que zero'),
  preco_embalagem: z.coerce.number().min(0, 'O preço deve ser positivo'),
  estoque_minimo: z.coerce.number().min(0, 'O estoque mínimo deve ser positivo'),
  estoque_atual: z.coerce.number().min(0, 'O estoque atual deve ser positivo'),
  fornecedor: z.string().optional().nullable(),
  descricao: z.string().optional().nullable()
});

type IngredienteFormData = z.infer<typeof ingredienteSchema>;

interface IngredienteModalProps {
  ingrediente?: Ingrediente | null;
  onClose: () => void;
  onSave: () => void;
}

export const IngredienteModal = ({ ingrediente, onClose, onSave }: IngredienteModalProps) => {
  const isEditing = !!ingrediente;
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<IngredienteFormData>({
    resolver: zodResolver(ingredienteSchema) as any,
    defaultValues: {
      nome: ingrediente?.nome || '',
      unidade_embalagem: (ingrediente?.unidade_embalagem as any) || 'g',
      peso_embalagem: ingrediente?.peso_embalagem || 1000,
      preco_embalagem: ingrediente?.preco_embalagem || 0,
      estoque_minimo: ingrediente?.estoque_minimo || 0,
      estoque_atual: ingrediente?.estoque_atual || 0,
      fornecedor: ingrediente?.fornecedor || '',
      descricao: ingrediente?.descricao || ''
    },
  });

  const onSubmit: SubmitHandler<IngredienteFormData> = async (formData) => {
    setIsSubmitting(true);
    const loadingToast = toast.loading(isEditing ? 'Atualizando insumo...' : 'Cadastrando insumo...');
    
    try {
      // Garantir compatibilidade com a interface Ingrediente
      const mappedUnidadeBase = (formData.unidade_embalagem === 'kg' || formData.unidade_embalagem === 'g') ? 'g' : 
                               (formData.unidade_embalagem === 'l' || formData.unidade_embalagem === 'ml') ? 'ml' : 'un';

      const payload: Partial<Ingrediente> = {
        ...ingrediente,
        nome: formData.nome,
        unidade_embalagem: formData.unidade_embalagem,
        unidade_base: mappedUnidadeBase as any,
        peso_embalagem: formData.peso_embalagem,
        preco_embalagem: formData.preco_embalagem,
        estoque_minimo: formData.estoque_minimo,
        estoque_atual: formData.estoque_atual,
        fornecedor: formData.fornecedor || null,
        descricao: formData.descricao || null,
      };

      await dataService.saveIngrediente(payload);
      
      toast.success(isEditing ? 'Insumo atualizado!' : 'Insumo cadastrado!', { id: loadingToast });
      onSave();
    } catch (error: any) {
      console.error('Erro ao salvar insumo:', error);
      toast.error(`Erro ao salvar: ${error.message}`, { id: loadingToast });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="bg-primary p-6 text-white flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold headline">
              {isEditing ? 'Editar Insumo' : 'Novo Insumo'}
            </h2>
            <p className="text-xs opacity-80">Preencha os dados básicos do seu ingrediente</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-full transition-all"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-8 space-y-6">
          <div className="space-y-4">
            {/* Nome */}
            <div>
              <label className="text-[10px] uppercase font-bold text-on-surface-variant block mb-1 ml-1">
                Nome do Ingrediente
              </label>
              <input
                {...register('nome')}
                placeholder="Ex: Farinha de Trigo Especial"
                className={`w-full px-4 py-3 rounded-xl border ${errors.nome ? 'border-error ring-1 ring-error' : 'border-surface-container-high'} bg-surface-container-low focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm`}
              />
              {errors.nome && (
                <span className="text-[10px] text-error font-bold mt-1 ml-1 block">
                  {errors.nome.message}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Unidade */}
              <div>
                <label className="text-[10px] uppercase font-bold text-on-surface-variant block mb-1 ml-1">
                  Unidade da Embalagem
                </label>
                <select
                  {...register('unidade_embalagem')}
                  className="w-full px-4 py-3 rounded-xl border border-surface-container-high bg-surface-container-low focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm appearance-none cursor-pointer"
                >
                  <option value="g">Gramas (g)</option>
                  <option value="kg">Quilos (kg)</option>
                  <option value="ml">Mililitros (ml)</option>
                  <option value="l">Litros (L)</option>
                  <option value="un">Unidades (un)</option>
                </select>
              </div>

              {/* Peso/Qtd Embalagem */}
              <div>
                <label className="text-[10px] uppercase font-bold text-on-surface-variant block mb-1 ml-1">
                  Quantidade p/ Embalagem
                </label>
                <input
                  type="number"
                  step="any"
                  {...register('peso_embalagem')}
                  placeholder="Ex: 1000"
                  className={`w-full px-4 py-3 rounded-xl border ${errors.peso_embalagem ? 'border-error ring-1 ring-error' : 'border-surface-container-high'} bg-surface-container-low focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm`}
                />
                {errors.peso_embalagem && (
                  <span className="text-[10px] text-error font-bold mt-1 ml-1 block">
                    {errors.peso_embalagem.message}
                  </span>
                )}
              </div>
            </div>

            {/* Preço Embalagem */}
            <div>
              <label className="text-[10px] uppercase font-bold text-on-surface-variant block mb-1 ml-1">
                Preço Comercial da Embalagem (R$)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('preco_embalagem')}
                placeholder="0,00"
                className={`w-full px-4 py-3 rounded-xl border ${errors.preco_embalagem ? 'border-error ring-1 ring-error' : 'border-surface-container-high'} bg-surface-container-low focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm`}
              />
              {errors.preco_embalagem && (
                <span className="text-[10px] text-error font-bold mt-1 ml-1 block">
                  {errors.preco_embalagem.message}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Estoque Atual */}
              <div>
                <label className="text-[10px] uppercase font-bold text-on-surface-variant block mb-1 ml-1">
                  Estoque Atual
                </label>
                <input
                  type="number"
                  step="any"
                  {...register('estoque_atual')}
                  className={`w-full px-4 py-3 rounded-xl border ${errors.estoque_atual ? 'border-error ring-1 ring-error' : 'border-surface-container-high'} bg-surface-container-low focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm`}
                />
                {errors.estoque_atual && (
                  <span className="text-[10px] text-error font-bold mt-1 ml-1 block">
                    {errors.estoque_atual.message}
                  </span>
                )}
              </div>

              {/* Estoque Mínimo */}
              <div>
                <label className="text-[10px] uppercase font-bold text-on-surface-variant block mb-1 ml-1">
                  Estoque Mínimo (Alerta)
                </label>
                <input
                  type="number"
                  step="any"
                  {...register('estoque_minimo')}
                  className={`w-full px-4 py-3 rounded-xl border ${errors.estoque_minimo ? 'border-error ring-1 ring-error' : 'border-surface-container-high'} bg-surface-container-low focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm`}
                />
                {errors.estoque_minimo && (
                  <span className="text-[10px] text-error font-bold mt-1 ml-1 block">
                    {errors.estoque_minimo.message}
                  </span>
                )}
              </div>
            </div>

            {/* Fornecedor */}
            <div>
              <label className="text-[10px] uppercase font-bold text-on-surface-variant block mb-1 ml-1">
                Fornecedor (Opcional)
              </label>
              <input
                {...register('fornecedor')}
                placeholder="Nome do fornecedor ou mercado"
                className="w-full px-4 py-3 rounded-xl border border-surface-container-high bg-surface-container-low focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 rounded-xl font-bold text-sm text-on-surface-variant hover:bg-surface-container-high transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-3 bg-primary text-white px-8 py-3 rounded-xl font-bold text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
            >
              {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              {isEditing ? 'Salvar Alterações' : 'Cadastrar Insumo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
