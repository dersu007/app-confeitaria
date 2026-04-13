import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Cake, 
  ShoppingCart, 
  BookOpen, 
  CreditCard, 
  Users, 
  Sparkles, 
  Calculator, 
  Settings,
  Database,
  Tags,
  Search,
  Bell,
  History,
  LogOut
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../lib/auth';

const SidebarLink = ({ to, icon: Icon, children }: { to: string, icon: any, children: React.ReactNode }) => (
  <NavLink 
    to={to}
    className={({ isActive }) => `
      flex items-center gap-3 px-4 py-3 transition-all duration-200 rounded-lg
      ${isActive 
        ? 'bg-white text-primary font-bold shadow-sm translate-x-1' 
        : 'text-on-surface-variant hover:text-primary hover:bg-primary-container/20'}
    `}
  >
    <Icon size={20} />
    <span className="font-headline text-sm tracking-tight">{children}</span>
  </NavLink>
);

export const Layout = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Sessão encerrada');
      navigate('/login');
    } catch (error) {
      toast.error('Erro ao sair');
    }
  };

  return (
    <div className="flex min-h-screen bg-surface">
      
      {/* Sidebar */}
      <aside className="h-screen w-64 fixed left-0 top-0 bg-slate-50 border-r border-surface-container-high flex flex-col p-4 gap-2 z-50">
        <div className="text-primary font-bold text-lg mb-8 px-4 flex flex-col">
          <span className="headline">The Digital Boulangerie</span>
          <span className="text-xs font-medium text-on-surface-variant opacity-70">Gestão Profissional</span>
        </div>
        
        <nav className="flex-grow space-y-1">
          <SidebarLink to="/" icon={LayoutDashboard}>Painel</SidebarLink>
          <SidebarLink to="/produtos" icon={Cake}>Produtos</SidebarLink>
          <SidebarLink to="/insumos" icon={Database}>Insumos</SidebarLink>
          <SidebarLink to="/categorias" icon={Tags}>Categorias</SidebarLink>
          <SidebarLink to="/pedidos" icon={ShoppingCart}>Pedidos</SidebarLink>
          <SidebarLink to="/financeiro" icon={CreditCard}>Financeiro</SidebarLink>
          <SidebarLink to="/clientes" icon={Users}>Clientes</SidebarLink>
          <SidebarLink to="/ia" icon={Sparkles}>Assistente IA</SidebarLink>
          <SidebarLink to="/precificacao" icon={Calculator}>Precificação</SidebarLink>
        </nav>
        
        <div className="mt-auto pt-4 border-t border-surface-container-high space-y-1">
          <SidebarLink to="/configuracoes" icon={Settings}>Configurações</SidebarLink>
          <button 
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 py-3 text-on-surface-variant hover:text-destructive hover:bg-destructive/10 transition-all duration-200 rounded-lg"
          >
            <LogOut size={20} />
            <span className="font-headline text-sm tracking-tight">Sair</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-64 flex-grow relative">
        {/* Top Header */}
        <header className="fixed top-0 right-0 w-[calc(100%-16rem)] z-40 bg-white/70 backdrop-blur-xl flex justify-between items-center px-8 py-4 border-b border-surface-container-high">
          <div className="flex items-center gap-4 bg-surface-container-low px-4 py-2 rounded-full w-96">
            <Search size={18} className="text-on-surface-variant" />
            <input 
              className="bg-transparent border-none focus:ring-0 text-sm w-full placeholder:text-on-surface-variant/60" 
              placeholder="Buscar pedidos ou produtos..." 
              type="text"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <button className="p-2 text-on-surface-variant hover:bg-slate-50 rounded-full transition-all">
              <Bell size={20} />
            </button>
            <button className="p-2 text-on-surface-variant hover:bg-slate-50 rounded-full transition-all">
              <History size={20} />
            </button>
            <div className="h-8 w-px bg-surface-container-high mx-2"></div>
            <div className="flex items-center gap-3 pl-2">
              <div className="text-right">
                <p className="text-xs font-bold headline text-on-surface truncate max-w-[120px]">
                  {user?.email?.split('@')[0] || 'Mestre Padeiro'}
                </p>
                <p className="text-[10px] text-on-surface-variant">Admin</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-primary-container overflow-hidden">
                <img 
                  alt="Profile" 
                  src="https://images.unsplash.com/photo-1556157382-97eda2d62296?auto=format&fit=crop&q=80&w=100" 
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="pt-24 px-8 pb-12">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
