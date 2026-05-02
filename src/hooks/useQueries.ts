import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dataService } from '../services/dataService';
import { Produto, Ingrediente, Categoria, Pedido, Cliente, DespesaFixa, CategoriaExtra, MovimentacaoEstoque } from '../types';
import { validateProductIntegrity } from '../services/bakeryService';
import toast from 'react-hot-toast';

// --- PRODUTOS ---

export const useProdutos = () => {
  return useQuery({
    queryKey: ['produtos'],
    queryFn: () => dataService.getProdutos(),
  });
};

export const useProduto = (id: string | null) => {
  return useQuery({
    queryKey: ['produto', id],
    queryFn: () => id ? dataService.getProdutoById(id) : null,
    enabled: !!id,
  });
};

export const useSaveProduto = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (produto: Partial<Produto>) => dataService.saveProduto(produto),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      queryClient.invalidateQueries({ queryKey: ['produto', data.id] });
    },
  });
};

export const useDeleteProduto = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => dataService.deleteProduto(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      queryClient.removeQueries({ queryKey: ['produto', id] });
    },
  });
};

export const useDuplicateProduto = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => dataService.duplicateProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      toast.success('Produto duplicado com sucesso!');
    },
  });
};

// --- INGREDIENTES ---

export const useIngredientes = () => {
  return useQuery({
    queryKey: ['ingredientes'],
    queryFn: () => dataService.getIngredientes(),
  });
};

export const useSaveIngrediente = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ingrediente: Partial<Ingrediente>) => dataService.saveIngrediente(ingrediente),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ingredientes'] });
      queryClient.invalidateQueries({ queryKey: ['produtos'] }); // Costs changed
    },
  });
};

// --- CATEGORIAS ---

export const useCategorias = () => {
  return useQuery({
    queryKey: ['categorias'],
    queryFn: () => dataService.getCategorias(),
  });
};

export const useSaveCategoria = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (categoria: Partial<Categoria>) => dataService.saveCategoria(categoria),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categorias'] });
      queryClient.invalidateQueries({ queryKey: ['produtos'] }); // Margins might change
    },
  });
};

export const useCategoriasExtras = () => {
  return useQuery<CategoriaExtra[]>({
    queryKey: ['categorias_extras'],
    queryFn: () => dataService.getCategoriasExtras(),
  });
};

// --- PEDIDOS ---

export const usePedidos = () => {
  return useQuery({
    queryKey: ['pedidos'],
    queryFn: () => dataService.getPedidos(),
  });
};

export const useSaveOrder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (pedido: Partial<Pedido>) => dataService.savePedido(pedido),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      queryClient.invalidateQueries({ queryKey: ['ingredientes'] });
    },
  });
};

export const useUpdatePedidoStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ pedidoId, status }: { pedidoId: string, status: Pedido['status'] }) => 
      dataService.updatePedidoStatus(pedidoId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      queryClient.invalidateQueries({ queryKey: ['ingredientes'] });
    },
  });
};

// --- ESTOQUE ---

export const useMovimentacoesEstoque = (insumoId?: string) => {
  return useQuery({
    queryKey: ['movimentacoes_estoque', insumoId],
    queryFn: () => dataService.getMovimentacoesEstoque(insumoId),
  });
};

export const useSaveMovimentacaoEstoque = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (movimentacao: Partial<MovimentacaoEstoque>) => dataService.saveMovimentacaoEstoque(movimentacao),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['movimentacoes_estoque'] });
      queryClient.invalidateQueries({ queryKey: ['ingredientes'] });
    },
  });
};

// --- CLIENTES ---

export const useClientes = () => {
  return useQuery({
    queryKey: ['clientes'],
    queryFn: () => dataService.getClientes(),
  });
};

export const useSaveCliente = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (cliente: Partial<Cliente>) => dataService.saveCliente(cliente),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
    },
  });
};

export const useDeleteCliente = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => dataService.deleteCliente(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
    },
  });
};

export const useDespesasFixas = () => {
  return useQuery({
    queryKey: ['despesas_fixas'],
    queryFn: () => dataService.getDespesasFixas(),
  });
};

export const useSaveDespesaFixa = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (despesa: Partial<DespesaFixa>) => dataService.saveDespesaFixa(despesa),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['despesas_fixas'] });
    },
  });
};

// --- RECALCULATION ---

export const useRecalculateEverything = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => dataService.recalculateEverything(),
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success('Toda a base foi recalculada e sincronizada!');
    },
  });
};

export const useRecalculateProduct = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => dataService.recalculateProduct(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      queryClient.invalidateQueries({ queryKey: ['produto', id] });
      toast.success('Produto recalculado!');
    },
  });
};

// --- GENERIC TABLE DATA ---

export const useTableData = (table: string) => {
  return useQuery({
    queryKey: [table],
    queryFn: () => dataService.getTableData(table),
  });
};

export const useGlobalNotifications = () => {
  return useQuery({
    queryKey: ['global_notifications'],
    queryFn: async () => {
      const [ingredients, products, orders] = await Promise.all([
        dataService.getIngredientes(),
        dataService.getProdutos(),
        dataService.getPedidos()
      ]);

      const criticalStockCount = ingredients.filter(i => (i.estoque_atual || 0) <= (i.estoque_minimo || 0)).length;
      
      const integrityIssues = products
        .map(p => ({ product: p, errors: validateProductIntegrity(p) }))
        .filter(item => item.errors.length > 0);

      const openOrdersCount = orders.filter(o => o.status !== 'Concluído' && o.status !== 'Cancelado').length;

      return {
        criticalStockCount,
        integrityIssues,
        openOrdersCount
      };
    },
    refetchInterval: 5 * 60 * 1000, // 5 minutes
    staleTime: 60 * 1000, // 1 minute
  });
};

export const useSaveEntity = (table: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (entity: Record<string, unknown>) => dataService.saveEntity(table, entity),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [table] });
      // Cross-table invalidations
      if (['ingredientes', 'categorias', 'produto_ingredientes'].includes(table)) {
        queryClient.invalidateQueries({ queryKey: ['produtos'] });
      }
      if (table === 'pedidos') {
        queryClient.invalidateQueries({ queryKey: ['clientes'] });
      }
    },
  });
};

export const useDeleteEntity = (table: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => dataService.deleteEntity(table, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [table] });
      if (['ingredientes', 'categorias', 'produto_ingredientes'].includes(table)) {
        queryClient.invalidateQueries({ queryKey: ['produtos'] });
      }
    },
  });
};

export const useInsertEntities = (table: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ entities }: { entities: Record<string, unknown>[] }) => dataService.insertEntities(table, entities),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [table] });
      if (['ingredientes', 'categorias', 'produto_ingredientes'].includes(table)) {
        queryClient.invalidateQueries({ queryKey: ['produtos'] });
      }
    },
  });
};
