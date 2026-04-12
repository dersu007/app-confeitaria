import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { BaseDeDados } from './components/BaseDeDados';
import { Clientes } from './components/CRM/Clientes';
import { Pedidos } from './components/Pedidos';
import { Produtos } from './components/Produtos';
import { Precificacao } from './components/Precificacao';
import { Toaster } from 'react-hot-toast';
import { Login } from './components/Login';
import { Register } from './components/Register';
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

          {/* Protected Routes */}
          <Route path="/" element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
            <Route index element={<Dashboard />} />
            <Route path="base-de-dados" element={<BaseDeDados />} />
            <Route path="clientes" element={<Clientes />} />
            <Route path="pedidos" element={<Pedidos />} />
            <Route path="produtos" element={<Produtos />} />
            <Route path="precificacao" element={<Precificacao />} />
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
