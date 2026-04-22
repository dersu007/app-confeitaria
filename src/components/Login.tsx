import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import { LogIn, Mail, Lock, Loader2 } from 'lucide-react';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      toast.success('Bem-vindo de volta!');
      setTimeout(() => {
        navigate(from, { replace: true });
      }, 1000);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao entrar. Verifique suas credenciais.';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleRecoverPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/reset-password',
      });

      if (error) throw error;

      toast.success('Link de recuperação enviado para o seu e-mail!');
      setIsRecovering(false);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao enviar e-mail de recuperação.';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border border-surface-container-high">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <LogIn className="text-primary" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-on-surface headline text-primary">Honey Sugar</h1>
          <p className="text-on-surface-variant text-sm mt-2 text-center text-balance font-medium">
            {isRecovering 
              ? 'Informe seu e-mail para receber o link de recuperação' 
              : 'Gestão Inteligente para sua Confeitaria'}
          </p>
        </div>

        {isRecovering ? (
          <form onSubmit={handleRecoverPassword} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-on-surface-variant ml-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-surface border border-surface-container-high rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  placeholder="seu@email.com"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-white py-3 rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : 'Enviar Link de Recuperação'}
            </button>

            <button
              type="button"
              onClick={() => setIsRecovering(false)}
              className="w-full text-primary font-bold text-sm hover:underline"
            >
              Voltar para o Login
            </button>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-on-surface-variant ml-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-surface border border-surface-container-high rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  placeholder="seu@email.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between ml-1">
                <label className="text-sm font-medium text-on-surface-variant">Senha</label>
                <button
                  type="button"
                  onClick={() => setIsRecovering(true)}
                  className="text-xs text-primary hover:underline font-medium"
                >
                  Esqueci minha senha
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-surface border border-surface-container-high rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-white py-3 rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : 'Entrar'}
            </button>
          </form>
        )}

        <div className="mt-8 text-center">
          <p className="text-on-surface-variant text-sm">
            Não tem uma conta?{' '}
            <Link to="/register" className="text-primary font-bold hover:underline">
              Criar conta
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
