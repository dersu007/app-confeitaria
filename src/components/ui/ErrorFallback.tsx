import React from 'react';
import { AlertTriangle, RefreshCw, ChevronRight } from 'lucide-react';

interface ErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

export const ErrorFallback = ({ error, resetErrorBoundary }: ErrorFallbackProps) => {
  return (
    <div className="min-h-[400px] w-full flex items-center justify-center p-6 bg-surface-container-lowest rounded-3xl border border-error/20 my-4 animate-in fade-in zoom-in duration-300">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="inline-flex p-4 bg-error/10 text-error rounded-2xl">
          <AlertTriangle size={48} />
        </div>
        
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-on-surface">Ops! Algo deu errado</h2>
          <p className="text-on-surface-variant text-sm">
            Ocorreu um erro inesperado ao carregar esta parte da aplicação. Não se preocupe, seus dados estão seguros.
          </p>
        </div>

        <div className="p-4 bg-surface-container-low rounded-xl text-left border border-surface-container-high overflow-hidden group">
          <div className="flex items-center gap-2 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-2">
            <span className="w-2 h-2 bg-error rounded-full"></span>
            Detalhes do Erro
          </div>
          <pre className="text-xs font-mono text-error/80 whitespace-pre-wrap break-all bg-black/5 p-2 rounded max-h-32 overflow-y-auto">
            {error.message || 'Erro desconhecido'}
          </pre>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={resetErrorBoundary}
            className="flex items-center gap-2 px-8 py-3 bg-primary text-white font-bold rounded-2xl hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 group"
          >
            <RefreshCw size={18} className="group-active:animate-spin" />
            Tentar Novamente
          </button>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-8 py-3 bg-surface-container-high text-on-surface font-bold rounded-2xl hover:bg-surface-container-highest transition-all"
          >
            Recarregar Página
            <ChevronRight size={16} />
          </button>
        </div>
        
        <p className="text-[10px] text-on-surface-variant italic">
          O erro foi registrado e nossa equipe técnica será notificada.
        </p>
      </div>
    </div>
  );
};
