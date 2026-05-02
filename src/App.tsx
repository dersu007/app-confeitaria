import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { Insumos } from './components/Insumos';
import { Categorias } from './components/Categorias';
import { Financeiro } from './components/Financeiro';
import { Clientes } from './components/CRM/Clientes';
import { Pedidos } from './components/Pedidos';
import { Produtos } from './components/Produtos';
import { Precificacao } from './components/Precificacao';
import { Estoque } from './components/Estoque';
import { Toaster } from 'react-hot-toast';
import { Package, Info } from 'lucide-react';
import { Login } from './components/Login';
import { Register } from './components/Register';
import { ResetPassword } from './components/ResetPassword';
import { AuthProvider } from './lib/auth';
import { ProtectedRoute } from './components/ProtectedRoute';

export default function App() {
  return (
    <AuthProvider>
      <Toaster position="top-right" />
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Protected Routes */}
          <Route path="/" element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
            <Route index element={<Dashboard />} />
            <Route path="insumos" element={<Insumos />} />
            <Route path="categorias" element={<Categorias />} />
            <Route path="financeiro" element={<Financeiro />} />
            <Route path="clientes" element={<Clientes />} />
            <Route path="pedidos" element={<Pedidos />} />
            <Route path="produtos" element={<Produtos />} />
            <Route path="precificacao" element={<Precificacao />} />
            <Route path="estoque" element={<Estoque />} />
            <Route path="ia" element={
              <div className="flex flex-col items-center justify-center h-[60vh] text-on-surface-variant gap-4">
                <div className="p-4 bg-primary/10 text-primary rounded-full">
                  <Package size={48} />
                </div>
                <div className="text-center">
                  <h2 className="text-2xl font-bold mb-1 text-on-surface">Assistente IA</h2>
                  <p>Funcionalidade em desenvolvimento. Em breve você poderá gerenciar sua confeitaria com inteligência artificial.</p>
                </div>
              </div>
            } />
            <Route path="configuracoes" element={
              <div className="flex flex-col items-center justify-center h-[60vh] text-on-surface-variant gap-4">
                <div className="p-4 bg-primary/10 text-primary rounded-full">
                  <Info size={48} />
                </div>
                <div className="text-center">
                  <h2 className="text-2xl font-bold mb-1 text-on-surface">Configurações</h2>
                  <p>Em breve você poderá ajustar as preferências do Honey Sugar aqui.</p>
                </div>
              </div>
            } />
            <Route path="*" element={
              <div className="flex flex-col items-center justify-center h-[60vh] text-on-surface-variant">
                <h2 className="text-2xl font-bold mb-2">Página em Construção</h2>
                <p>Esta funcionalidade será implementada em breve.</p>
              </div>
            } />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
