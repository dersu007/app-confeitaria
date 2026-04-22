import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Utilitário genérico para exportação de dados para CSV compatível com Excel (PT-BR).
 */
export const exportToCSV = <T extends Record<string, unknown>>(
  data: T[],
  columns: Record<string, string>,
  fileNamePrefix: string
) => {
  if (!data || data.length === 0) {
    return false;
  }

  // 1. Definir cabeçalhos (os labels amigáveis das colunas)
  const headers = Object.values(columns);
  const keys = Object.keys(columns);

  // 2. Processar os dados para o formato CSV
  const csvRows = data.map(row => {
    return keys.map(key => {
      let value = key.split('.').reduce((acc, part) => acc && acc[part], row);
      
      // Formatação automática baseada no tipo de dado
      if (value === null || value === undefined) {
        return '""';
      }

      // Se for data (detectada por regex simples ou se a chave contém 'data')
      if (typeof value === 'string' && (key.includes('data') || key.includes('at')) && !isNaN(Date.parse(value))) {
        try {
          return `"${format(new Date(value), 'dd/MM/yyyy HH:mm', { locale: ptBR })}"`;
        } catch {
          return `"${value}"`;
        }
      }

      // Se for número
      if (typeof value === 'number') {
        // Formatar para padrão brasileiro (vírgula como separador decimal)
        // Isso ajuda o Excel a reconhecer como número imediatamente
        const formattedNumber = value.toLocaleString('pt-BR', { 
          minimumFractionDigits: 2, 
          maximumFractionDigits: 2 
        });
        return `"${formattedNumber}"`;
      }

      // Escapar aspas duplas
      const escaped = String(value).replace(/"/g, '""');
      return `"${escaped}"`;
    }).join(';');
  });

  // 3. Montar o conteúdo final com o BOM (Byte Order Mark) para compatibilidade com Excel
  const BOM = '\uFEFF';
  const csvContent = [headers.join(';'), ...csvRows].join('\n');
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  
  // 4. Criar link de download e disparar
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const dateStr = format(new Date(), 'yyyy-MM-dd');
  const fileName = `${fileNamePrefix}_honey_sugar_${dateStr}.csv`;
  
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  return true;
};
