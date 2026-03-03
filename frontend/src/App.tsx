import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// IMPORTS
import LoginPage from '../src/components/LoginPage';
import SidebarLayout from './components/sidebarlayout'; 
import Dashboard from './Dashboard';              
import Analytics from './analytics';  
import Training from './training';
import Alerts from './alerts';            
import Settings from './Settings';   
import Detection from './Detection';         

const queryClient = new QueryClient();

/**
 * UPDATED PROTECTED ROUTE
 * Handles both Authentication (Token) and Authorization (Role)
 */
const ProtectedRoute = ({ 
  children, 
  requiredRole 
}: { 
  children: React.ReactNode, 
  requiredRole?: 'primary' | 'secondary' 
}) => {
  const token = localStorage.getItem('token');
  const userRole = localStorage.getItem('userRole');

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // RBAC Check: If a specific role is required but user doesn't match
  if (requiredRole && userRole !== requiredRole) {
    // Primary analysts trying to go to Detection, or Secondary trying to go to Training
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

const App = () => { 
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Routes>
          {/* PUBLIC ROUTE */}
          <Route path="/login" element={<LoginPage />} />

          {/* SHARED PROTECTED LAYOUT */}
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <SidebarLayout /> 
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="alerts" element={<Alerts />} />
            <Route path="settings" element={<Settings />} />

            {/* SECONDARY ONLY: Personal Audit Tool */}
            <Route 
              path="detection" 
              element={
                <ProtectedRoute requiredRole="secondary">
                  <Detection/>
                </ProtectedRoute>
              }
            />

            {/* PRIMARY ONLY: Admin Tools */}
            <Route 
              path="analytics" 
              element={
                <ProtectedRoute requiredRole="primary">
                  <Analytics />
                </ProtectedRoute>
              }
            />
            <Route 
              path="training" 
              element={
                <ProtectedRoute requiredRole="primary">
                  <Training />
                </ProtectedRoute>
              }
            />
          </Route>
        </Routes>
      </Router>
    </QueryClientProvider>
  );
};

export default App;