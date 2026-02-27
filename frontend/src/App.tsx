import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// IMPORTS
import LoginPage from '../src/components/LoginPage';
import SidebarLayout from './components/sidebarlayout'; // The Wrapper
import Dashboard from './Dashboard';              // The Content
import Analytics from './analytics';  
import Training from './training';
import Alerts from './alerts';            // The Content
import Settings from './Settings';   
import Detection from './Detection';    // The Content     

const queryClient = new QueryClient();

// PROTECTED ROUTE WRAPPER
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem('token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

const App = () => { 
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Routes>
          {/* 1. PUBLIC ROUTE (Login) */}
          <Route path="/login" element={<LoginPage />} />

          {/* 2. PROTECTED WRAPPER (SidebarLayout) */}
          {/* This Route wraps everything that needs the Sidebar */}
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <SidebarLayout /> 
              </ProtectedRoute>
            }
          >
            {/* 3. CHILD ROUTES (Render inside SidebarLayout's <Outlet />) */}
            
            {/* Redirect root "/" to "/dashboard" */}
            <Route index element={<Navigate to="/dashboard" replace />} />
            
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="training" element={<Training />} />
            
            {/* Add placeholders for other sidebar links so they don't 404 */}
            <Route path="detection" element={<Detection/>}/>
            <Route path="alerts" element={<Alerts />} />
            
            {/* 4. ADDED SETTINGS ROUTE */}
            <Route path="settings" element={<Settings />} />
          </Route>

        </Routes>
      </Router>
    </QueryClientProvider>
  );
};

export default App;