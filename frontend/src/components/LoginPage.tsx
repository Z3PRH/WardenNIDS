import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { Shield, Lock, User, Eye, EyeOff, Loader2, AlertCircle, Mail, UserPlus, LogIn } from 'lucide-react';

const LoginPage = () => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const navigate = useNavigate();

  const resetForm = () => {
    setUsername('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setError('');
    setSuccessMsg('');
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const switchMode = (newMode: 'login' | 'register') => {
    resetForm();
    setMode(newMode);
  };

  const handleLogin = async () => {
    const response = await api.post('/token/', { username, password });
    
    // Get the role from your backend (which we fixed to return 'Admin' for superusers)
    const assignedRole = response.data.role || 'secondary';
    
    localStorage.setItem('token', response.data.access);
    localStorage.setItem('userRole', assignedRole);

    if (assignedRole === 'Admin' || assignedRole === 'admin') {
      // Redirect master account directly to the Approvals page
      navigate('/admin/role-approvals');
    } else {
      // Everyone else goes to the dashboard
      navigate('/dashboard');
    }
  };

  const handleRegister = async () => {
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    await api.post('/register/', { username, email, password });
    setSuccessMsg('Account created. You may now log in.');
    setTimeout(() => switchMode('login'), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setIsLoading(true);

    try {
      if (mode === 'login') {
        await handleLogin();
      } else {
        await handleRegister();
      }
    } catch (err: any) {
      console.error("Auth Error:", err);
      const detail = err?.response?.data?.detail || err?.response?.data?.username?.[0] || err?.response?.data?.email?.[0];
      setError(detail || (mode === 'login' ? 'Invalid credentials. Please try again.' : 'Registration failed. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center mb-6">
            <div className="p-4 border-2 border-neon-green">
              <Shield className="w-12 h-12 text-neon-green" strokeWidth={2} />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-neon-green tracking-tight mb-2">
            SENTINEL
          </h1>
          <p className="text-xs text-slate-600 uppercase tracking-[0.15em] font-medium">
            Network Defense System
          </p>
        </div>

        {/* Mode Toggle */}
        <div className="flex mb-0 border border-slate-800">
          <button
            type="button"
            onClick={() => switchMode('login')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold uppercase tracking-widest transition-all ${
              mode === 'login'
                ? 'bg-neon-green text-black'
                : 'bg-black text-slate-600 hover:text-slate-400'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            Login
          </button>
          <button
            type="button"
            onClick={() => switchMode('register')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold uppercase tracking-widest transition-all ${
              mode === 'register'
                ? 'bg-neon-green text-black'
                : 'bg-black text-slate-600 hover:text-slate-400'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            Register
          </button>
        </div>

        {/* Card */}
        <div className="bg-black border border-slate-800 border-t-0 p-8">

          {/* Title */}
          <div className="mb-8">
            <h2 className="text-lg font-bold text-white uppercase tracking-tight mb-1">
              {mode === 'login' ? 'Authentication Required' : 'Create Account'}
            </h2>
            <p className="text-xs text-slate-600 font-mono">
              {mode === 'login'
                ? 'Enter your credentials to access the system'
                : 'Register for system access — subject to admin approval'}
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/5 border border-red-500/30 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-400">
                  {mode === 'login' ? 'Authentication Failed' : 'Registration Failed'}
                </p>
                <p className="text-xs text-red-400/80 mt-1 font-mono">{error}</p>
              </div>
            </div>
          )}

          {/* Success Alert */}
          {successMsg && (
            <div className="mb-6 p-4 bg-green-500/5 border border-green-500/30 flex items-start gap-3">
              <Shield className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm font-medium text-green-400">{successMsg}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Username */}
            <div>
              <label htmlFor="username" className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-2">
                Operator ID
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600" />
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  className="w-full bg-black border border-slate-800 pl-11 pr-4 py-3 text-slate-100 font-mono text-sm placeholder:text-slate-700 focus:outline-none focus:border-neon-green transition-colors"
                  required
                  disabled={isLoading}
                  autoComplete="username"
                />
              </div>
            </div>

            {/* Email — register only */}
            {mode === 'register' && (
              <div>
                <label htmlFor="email" className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter email"
                    className="w-full bg-black border border-slate-800 pl-11 pr-4 py-3 text-slate-100 font-mono text-sm placeholder:text-slate-700 focus:outline-none focus:border-neon-green transition-colors"
                    required
                    disabled={isLoading}
                    autoComplete="email"
                  />
                </div>
              </div>
            )}

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-2">
                Access Key
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full bg-black border border-slate-800 pl-11 pr-12 py-3 text-slate-100 font-mono text-sm placeholder:text-slate-700 focus:outline-none focus:border-neon-green transition-colors"
                  required
                  disabled={isLoading}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 transition-colors"
                  disabled={isLoading}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Confirm Password — register only */}
            {mode === 'register' && (
              <div>
                <label htmlFor="confirmPassword" className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-2">
                  Confirm Access Key
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600" />
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm password"
                    className="w-full bg-black border border-slate-800 pl-11 pr-12 py-3 text-slate-100 font-mono text-sm placeholder:text-slate-700 focus:outline-none focus:border-neon-green transition-colors"
                    required
                    disabled={isLoading}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 transition-colors"
                    disabled={isLoading}
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            )}

            {/* Remember Me — login only */}
            {mode === 'login' && (
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 bg-black border-slate-800 text-neon-green focus:ring-neon-green/50 focus:ring-offset-0"
                    disabled={isLoading}
                  />
                  <span className="text-xs font-mono text-slate-600">Remember device</span>
                </label>
                <button
                  type="button"
                  className="text-xs font-mono text-slate-600 hover:text-slate-400 transition-colors"
                  disabled={isLoading}
                >
                  Forgot password?
                </button>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-neon-green hover:bg-neon-green/90 text-black font-bold text-sm uppercase tracking-wider py-3.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {mode === 'login' ? 'Authenticating...' : 'Creating Account...'}
                </span>
              ) : mode === 'login' ? (
                <span className="flex items-center justify-center gap-2">
                  <Shield className="w-5 h-5" />
                  Initialize Session
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <UserPlus className="w-5 h-5" />
                  Request Access
                </span>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-2 h-2 bg-neon-green rounded-full animate-pulse" />
            <span className="text-xs font-mono text-slate-600 uppercase tracking-wider">
              System Online
            </span>
          </div>
          <p className="text-xs font-mono text-slate-800">
            Secure Connection Established
          </p>
        </div>

        <div className="mt-12 text-center">
          <p className="text-xs font-mono text-slate-800 uppercase tracking-wider">
            Unauthorized access will be prosecuted
          </p>
          <p className="text-xs font-mono text-slate-900 mt-1">
            © 2024 Sentinel Security Systems
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;