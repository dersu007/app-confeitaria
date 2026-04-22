import { z } from 'zod';

export const productSchema = z.object({
  nome: z.string()
    .min(3, 'O nome deve ter pelo menos 3 caracteres')
    .max(100, 'O nome deve ter no máximo 100 caracteres'),
  categoria_id: z.string().min(1, 'Selecione uma categoria'),
  rendimento_unidades: z.number()
    .int('O rendimento deve ser um número inteiro')
    .positive('O rendimento deve ser maior que zero'),
  tempo_producao_valor: z.number().min(0, 'O tempo de produção deve ser zero ou maior'),
  tempo_producao_unidade: z.enum(['horas', 'minutos']),
  usar_margem_categoria: z.boolean(),
  margem_percentual: z.number().min(0, 'A margem deve ser zero ou maior'),
  margem_tipo: z.enum(['markup', 'margem_real']),
  usar_preco_manual: z.boolean(),
  preco_venda_manual: z.number()
    .min(0, 'O preço de venda deve ser zero ou maior'),
  custo_embalagem: z.number().min(0, 'O custo de embalagem deve ser zero ou maior'),
  taxa_venda_percentual: z.number().min(0, 'A taxa de venda deve ser zero ou maior'),
  imposto_percentual: z.number().min(0, 'O imposto deve ser zero ou maior'),
  imagem_url: z.string().url('Insira uma URL válida para a imagem').or(z.literal('')),
  modo_preparo: z.string(),
  ativo: z.boolean(),
});

export type ProductFormValues = z.infer<typeof productSchema>;
