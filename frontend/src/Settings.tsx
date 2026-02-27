import React, { useState, useEffect } from 'react';
import { Shield, Key, AlertTriangle, CheckCircle } from 'lucide-react';
import api from './lib/api'; // Make sure this path matches where your Axios instance is

const Settings = () => {
  const [passcode, setPasscode] = useState('');
  const [currentRole, setCurrentRole] = useState('secondary');
  const [statusMsg, setStatusMsg] = useState<{type: 'success' | 'error' | '', text: string}>({type: '', text: ''});
  const [isLoading, setIsLoading] = useState(false);

  // Load the current role from memory when the page opens
  useEffect(() => {
    const savedRole = localStorage.getItem('userRole') || 'secondary';
    setCurrentRole(savedRole);
  }, []);

  const handleUpgrade = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setStatusMsg({type: '', text: ''});

    try {
      // Send the passcode to the Django backend
      const response = await api.post('/upgrade-role/', { passcode });
      
      // If successful, update local storage and the screen
      localStorage.setItem('userRole', 'primary');
      setCurrentRole('primary');
      
      setStatusMsg({type: 'success', text: response.data.message});
      setPasscode(''); // clear input box
      
      // Force a tiny delay and reload so the sidebar catches the new role instantly
      setTimeout(() => {
        window.location.reload(); 
      }, 1500);

    } catch (err: any) {
      setStatusMsg({
        type: 'error', 
        text: err.response?.data?.error || 'Authorization denied. Invalid passcode.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto text-slate-200">
      <h1 className="text-3xl font-bold mb-8 flex items-center gap-3">
        <Shield className="text-neon-green w-8 h-8" /> 
        System Configuration
      </h1>

      {/* Current Status Card */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-lg mb-8">
        <h2 className="text-lg text-slate-400 font-mono uppercase mb-4">Current Authorization Level</h2>
        <div className="flex items-center gap-4">
          <div className={`px-4 py-2 rounded font-mono font-bold tracking-widest uppercase ${currentRole === 'primary' ? 'bg-neon-green text-black' : 'bg-slate-700 text-slate-300'}`}>
            {currentRole} Analyst
          </div>
          <p className="text-sm text-slate-500">
            {currentRole === 'primary' 
              ? "You have full system access, including threat resolution and model configuration." 
              : "Read-only access. System monitoring only."}
          </p>
        </div>
      </div>

      {/* Privilege Escalation Form (Hidden if already Primary) */}
      {currentRole !== 'primary' && (
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-lg">
          <h2 className="text-lg text-slate-400 font-mono uppercase mb-4 flex items-center gap-2">
            <Key className="w-5 h-5" /> Privilege Escalation
          </h2>
          
          <form onSubmit={handleUpgrade} className="space-y-4">
            <div>
              <label className="block text-sm font-mono text-slate-500 mb-2">Enter Override Passcode</label>
              <input 
                type="password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                className="w-full bg-black border border-slate-700 p-3 text-neon-green font-mono focus:outline-none focus:border-neon-green transition-colors"
                placeholder="****-****-****"
                required
              />
            </div>
            
            <button 
              type="submit" 
              disabled={isLoading}
              className="bg-slate-800 hover:bg-slate-700 text-white font-mono px-6 py-3 rounded transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Verifying...' : 'Request Escalation'}
            </button>
          </form>

          {/* Feedback Messages */}
          {statusMsg.text && (
            <div className={`mt-4 p-4 flex items-start gap-3 border ${statusMsg.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
              {statusMsg.type === 'success' ? <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" /> : <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />}
              <p className="font-mono text-sm">{statusMsg.text}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Settings;