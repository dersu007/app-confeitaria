import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, Trash2, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
  variant?: 'danger' | 'warning' | 'info';
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  description,
  confirmLabel = 'Excluir',
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
  isLoading = false,
  variant = 'danger'
}) => {
  if (!isOpen) return null;

  const colors = {
    danger: {
      bg: 'bg-error/10',
      icon: 'text-error',
      button: 'bg-error hover:bg-error/90 shadow-error/20',
      border: 'border-error/20'
    },
    warning: {
      bg: 'bg-amber-100',
      icon: 'text-amber-600',
      button: 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20',
      border: 'border-amber-200'
    },
    info: {
      bg: 'bg-blue-100',
      icon: 'text-blue-600',
      button: 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20',
      border: 'border-blue-200'
    }
  };

  const current = colors[variant];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onCancel}
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        />

        {/* Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative bg-surface-container-lowest w-full max-w-sm rounded-[2rem] shadow-2xl border border-surface-container-high overflow-hidden"
        >
          <div className="p-8">
            <div className="flex flex-col items-center text-center">
              <div className={`w-16 h-16 ${current.bg} ${current.icon} rounded-2xl flex items-center justify-center mb-6`}>
                {variant === 'danger' ? <Trash2 size={32} /> : <AlertCircle size={32} />}
              </div>
              
              <h3 className="text-xl font-bold text-on-surface mb-2 leading-tight">
                {title}
              </h3>
              
              <p className="text-on-surface-variant text-sm leading-relaxed mb-8 px-2">
                {description}
              </p>

              <div className="flex flex-col w-full gap-3">
                <button
                  disabled={isLoading}
                  onClick={onConfirm}
                  className={`w-full py-3.5 ${current.button} text-white font-bold rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2 group disabled:opacity-50`}
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      {confirmLabel}
                    </>
                  )}
                </button>
                
                <button
                  disabled={isLoading}
                  onClick={onCancel}
                  className="w-full py-3.5 bg-surface-container-low text-on-surface-variant font-bold rounded-2xl hover:bg-surface-container-high transition-all text-sm disabled:opacity-50"
                >
                  {cancelLabel}
                </button>
              </div>
            </div>
          </div>

          <button 
            onClick={onCancel}
            className="absolute top-4 right-4 p-2 text-on-surface-variant hover:bg-surface-container-low rounded-full transition-all"
          >
            <X size={18} />
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
