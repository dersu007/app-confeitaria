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
  LogOut,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../lib/auth';
import { dataService } from '../services/dataService';
import { cacheService } from '../services/cacheService';
import { Ingrediente } from '../types';

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
  const [criticalStockCount, setCriticalStockCount] = React.useState(0);
  const [openOrdersCount, setOpenOrdersCount] = React.useState(0);
  const [noCategoryCount, setNoCategoryCount] = React.useState(0);
  const [isRecalculating, setIsRecalculating] = React.useState(false);

  const fetchNotificationData = async () => {
    try {
      const [ingredients, products, orders] = await Promise.all([
        dataService.getIngredientes(),
        dataService.getProdutos(),
        dataService.getPedidos()
      ]);

      // 1. Estoque Crítico
      const stockCount = ingredients.filter(i => (i.estoque_atual || 0) <= (i.estoque_minimo || 0)).length;
      setCriticalStockCount(stockCount);

      // 2. Produtos Sem Categoria
      const noCatCount = products.filter(p => !p.categoria_id).length;
      setNoCategoryCount(noCatCount);

      // 3. Pedidos Abertos (Status diferente de Concluído e Cancelado)
      const openCount = orders.filter(o => o.status !== 'Concluído' && o.status !== 'Cancelado').length;
      setOpenOrdersCount(openCount);

    } catch (err) {
      console.error('Erro ao buscar dados de notificação:', err);
    }
  };

  React.useEffect(() => {
    fetchNotificationData();
    // Refresh every 5 minutes
    const interval = setInterval(fetchNotificationData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleGlobalRecalculate = async () => {
    if (isRecalculating) return;

    setIsRecalculating(true);
    const loadingToast = toast.loading('Calculando custos e margens de todos os produtos...', {
      style: {
        borderRadius: '12px',
        background: '#fff',
        color: '#6a4a2b',
        fontWeight: 'bold',
        border: '1px solid #efe0cd'
      }
    });

    try {
      // Usar recalculateEverything para garantir que clientes também sejam atualizados se necessário
      // Mas o usuário pediu especificamente recalculateAllProducts. Vou usar recalculateAllProducts
      // para ser fiel ao pedido, mas garantindo que ele seja visível.
      await dataService.recalculateAllProducts();
      
      // Invalida todos os caches para garantir que as telas mostrem dados novos
      cacheService.invalidateCache();
      
      // Atualiza os contadores das notificações
      await fetchNotificationData();
      
      toast.success('Sincronização concluída com sucesso! ✨', { id: loadingToast });
    } catch (error: any) {
      console.error('Erro no recálculo global:', error);
      toast.error(`Falha na sincronização: ${error.message}`, { id: loadingToast });
    } finally {
      setIsRecalculating(false);
    }
  };

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
          <span className="headline">Honey Sugar</span>
          <span className="text-xs font-medium text-on-surface-variant opacity-70">Gestão Profissional</span>
        </div>
        
        <nav className="flex-grow space-y-1">
          <SidebarLink to="/" icon={LayoutDashboard}>Painel</SidebarLink>
          <SidebarLink to="/pedidos" icon={ShoppingCart}>Pedidos</SidebarLink>
          <SidebarLink to="/produtos" icon={Cake}>Produtos</SidebarLink>
          <SidebarLink to="/insumos" icon={Database}>Insumos</SidebarLink>
          <SidebarLink to="/categorias" icon={Tags}>Categorias</SidebarLink>
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
            <div className="relative">
              <button 
                onClick={() => {
                  const totalNotifications = criticalStockCount + openOrdersCount + noCategoryCount;
                  
                  if (totalNotifications > 0) {
                    let message = 'Resumo de Atenção:\n';
                    if (criticalStockCount > 0) message += `• ${criticalStockCount} insumo(s) com estoque crítico\n`;
                    if (openOrdersCount > 0) message += `• ${openOrdersCount} pedido(s) em aberto\n`;
                    if (noCategoryCount > 0) message += `• ${noCategoryCount} produto(s) sem categoria\n`;

                    toast(message.trim(), {
                      icon: '🔔',
                      duration: 5000,
                      style: {
                        borderRadius: '12px',
                        background: '#fff',
                        color: '#6a4a2b',
                        fontWeight: '600',
                        fontSize: '13px',
                        border: '1px solid #efe0cd',
                        whiteSpace: 'pre-line'
                      }
                    });
                  } else {
                    toast.success('Tudo em ordem por aqui! ✨');
                  }
                }}
                className="p-2 text-on-surface-variant hover:bg-slate-50 rounded-full transition-all relative"
                title="Notificações"
              >
                <Bell size={20} />
                {(criticalStockCount + openOrdersCount + noCategoryCount) > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-error text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-bounce">
                    {criticalStockCount + openOrdersCount + noCategoryCount}
                  </span>
                )}
              </button>
            </div>
            <button 
              onClick={handleGlobalRecalculate}
              disabled={isRecalculating}
              className={`p-2 text-on-surface-variant hover:bg-slate-50 rounded-full transition-all ${isRecalculating ? 'opacity-50 cursor-not-allowed' : ''}`}
              title="Sincronizar dados e recalcular custos globais"
            >
              <History size={20} className={isRecalculating ? 'animate-spin text-primary' : ''} />
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
