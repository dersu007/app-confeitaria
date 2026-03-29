import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import { UserPlus, Mail, Lock, Loader2, ArrowLeft } from 'lucide-react';

export const Register = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast.error('As senhas não coincidem.');
      return;
    }

    if (password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;

      if (data.user && !data.session) {
        toast.success('Conta criada! Verifique seu email para confirmar o cadastro.', {
          duration: 6000,
        });
      } else {
        toast.success('Conta criada com sucesso!');
      }
      
      // Pequeno delay para garantir que o usuário veja o feedback antes de mudar de página
      setTimeout(() => {
        navigate('/login');
      }, 1500);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao criar conta. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border border-surface-container-high">
        <Link to="/login" className="inline-flex items-center gap-2 text-on-surface-variant hover:text-primary mb-8 transition-colors text-sm font-medium group">
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          Voltar para login
        </Link>

        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <UserPlus className="text-primary" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-on-surface headline">Criar Conta</h1>
          <p className="text-on-surface-variant text-sm mt-2">Comece a gerenciar sua confeitaria profissionalmente</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-6">
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
            <label className="text-sm font-medium text-on-surface-variant ml-1">Senha</label>
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

          <div className="space-y-2">
            <label className="text-sm font-medium text-on-surface-variant ml-1">Confirmar Senha</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
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
            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Cadastrar'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-on-surface-variant text-sm">
            Já tem uma conta?{' '}
            <Link to="/login" className="text-primary font-bold hover:underline">
              Entrar
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
