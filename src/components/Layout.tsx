import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Cake, 
  ShoppingCart, 
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
  AlertTriangle,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../lib/auth';
import { dataService } from '../services/dataService';
import { validateProductIntegrity } from '../services/bakeryService';
import { useQueryClient } from '@tanstack/react-query';
import { Produto } from '../types';
import { ErrorBoundary } from 'react-error-boundary';
import { ErrorFallback } from './ui/ErrorFallback';
import { logErrorToBackend } from '../utils/errorUtils';

const SidebarLink = ({ to, icon: Icon, children }: { to: string, icon: React.ElementType, children: React.ReactNode }) => (
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
  const queryClient = useQueryClient();
  const [criticalStockCount, setCriticalStockCount] = React.useState(0);
  const [openOrdersCount, setOpenOrdersCount] = React.useState(0);
  const [integrityIssues, setIntegrityIssues] = React.useState<{product: Produto, errors: string[]}[]>([]);
  const [isRecalculating, setIsRecalculating] = React.useState(false);
  const [showNotifications, setShowNotifications] = React.useState(false);

  const fetchNotificationData = React.useCallback(async () => {
    try {
      const [ingredients, products, orders] = await Promise.all([
        dataService.getIngredientes(),
        dataService.getProdutos(),
        dataService.getPedidos()
      ]);

      // 1. Estoque Crítico
      const stockCount = ingredients.filter(i => (i.estoque_atual || 0) <= (i.estoque_minimo || 0)).length;
      setCriticalStockCount(stockCount);

      // 2. Integridade de Produtos
      const integrityIssues = products
        .map(p => ({ product: p, errors: validateProductIntegrity(p) }))
        .filter(item => item.errors.length > 0);
      setIntegrityIssues(integrityIssues);

      // 3. Pedidos Abertos (Status diferente de Concluído e Cancelado)
      const openCount = orders.filter(o => o.status !== 'Concluído' && o.status !== 'Cancelado').length;
      setOpenOrdersCount(openCount);

    } catch (err) {
      console.error('Erro ao buscar dados de notificação:', err);
    }
  }, []);

  React.useEffect(() => {
    Promise.resolve().then(() => fetchNotificationData());
    // Refresh every 5 minutes
    const interval = window.setInterval(fetchNotificationData, 5 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, [fetchNotificationData]);

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
      await dataService.recalculateEverything();
      
      // Invalida todos os caches do React Query
      queryClient.invalidateQueries();
      
      // Atualiza os contadores das notificações
      await fetchNotificationData();
      
      toast.success('Sincronização concluída com sucesso! ✨', { id: loadingToast });
    } catch (error: unknown) {
      console.error('Erro no recálculo global:', error);
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      toast.error(`Falha na sincronização: ${message}`, { id: loadingToast });
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Sessão encerrada');
      navigate('/login');
    } catch {
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
          <SidebarLink to="/estoque" icon={History}>Estoque</SidebarLink>
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
                onClick={() => setShowNotifications(!showNotifications)}
                className={`p-2 text-on-surface-variant hover:bg-slate-50 rounded-full transition-all relative ${showNotifications ? 'bg-slate-50 text-primary' : ''}`}
                title="Notificações"
              >
                <Bell size={20} />
                {(criticalStockCount + openOrdersCount + integrityIssues.length) > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-error text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-bounce">
                    {criticalStockCount + openOrdersCount + integrityIssues.length}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown */}
              {showNotifications && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowNotifications(false)}
                  ></div>
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-surface-container-high z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-4 bg-surface-container-low/50 border-b border-surface-container-high flex justify-between items-center">
                      <h3 className="font-bold headline text-on-surface text-sm">Notificações</h3>
                      <span className="text-[10px] uppercase font-bold text-on-surface-variant px-2 py-0.5 bg-surface-container-high rounded-full">
                        {criticalStockCount + openOrdersCount + integrityIssues.length} Alertas
                      </span>
                    </div>

                    <div className="max-h-96 overflow-y-auto">
                      {/* Integrity Issues - Priority */}
                      {integrityIssues.map((item) => (
                        <div 
                          key={item.product.id}
                          className="p-4 hover:bg-surface-container-low transition-colors border-b border-surface-container-high last:border-0"
                        >
                          <div className="flex items-start gap-3">
                            <div className="p-2 bg-error/10 text-error rounded-lg shrink-0">
                              <AlertTriangle size={16} />
                            </div>
                            <div className="flex-grow min-w-0">
                              <p className="text-xs font-bold text-on-surface truncate">
                                {item.product.nome}
                              </p>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {item.errors.map((err, i) => (
                                  <span key={i} className="text-[9px] font-medium text-error bg-error/5 px-1.5 py-0.5 rounded">
                                    {err}
                                  </span>
                                ))}
                              </div>
                              <button 
                                onClick={() => {
                                  setShowNotifications(false);
                                  navigate(`/produtos?edit=${item.product.id}`);
                                }}
                                className="mt-2 flex items-center gap-1 text-[10px] font-bold text-primary hover:underline"
                              >
                                <ExternalLink size={10} /> Corrigir agora
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* Stock Alerts */}
                      {criticalStockCount > 0 && (
                        <div className="p-4 hover:bg-surface-container-low transition-colors border-b border-surface-container-high bg-amber-50/30">
                          <div className="flex items-start gap-3">
                            <div className="p-2 bg-amber-100 text-amber-700 rounded-lg shrink-0">
                              <Database size={16} />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-on-surface">Estoque Crítico</p>
                              <p className="text-[10px] text-on-surface-variant mt-0.5">
                                {criticalStockCount} insumos abaixo do estoque mínimo.
                              </p>
                              <button 
                                onClick={() => {
                                  setShowNotifications(false);
                                  navigate('/insumos');
                                }}
                                className="mt-2 flex items-center gap-1 text-[10px] font-bold text-amber-700 hover:underline"
                              >
                                Ver insumos <ChevronRight size={10} />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Open Orders */}
                      {openOrdersCount > 0 && (
                        <div className="p-4 hover:bg-surface-container-low transition-colors border-b border-surface-container-high">
                          <div className="flex items-start gap-3">
                            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg shrink-0">
                              <ShoppingCart size={16} />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-on-surface">Pedidos em Aberto</p>
                              <p className="text-[10px] text-on-surface-variant mt-0.5">
                                Você tem {openOrdersCount} pedido(s) aguardando processamento.
                              </p>
                              <button 
                                onClick={() => {
                                  setShowNotifications(false);
                                  navigate('/pedidos');
                                }}
                                className="mt-2 text-[10px] font-bold text-blue-600 hover:underline"
                              >
                                Ver fila de pedidos
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {criticalStockCount === 0 && openOrdersCount === 0 && integrityIssues.length === 0 && (
                        <div className="p-8 text-center">
                          <Sparkles size={32} className="mx-auto text-primary/30 mb-2" />
                          <p className="text-xs text-on-surface-variant font-medium">Tudo em ordem por aqui!</p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
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
          <ErrorBoundary
            FallbackComponent={ErrorFallback}
            onReset={() => {
              // Reset any state that might have caused the error
              queryClient.invalidateQueries();
            }}
            onError={logErrorToBackend}
          >
            <Outlet />
          </ErrorBoundary>
        </div>
      </main>
    </div>
  );
};
