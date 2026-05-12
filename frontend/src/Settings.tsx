import React, { useState, useEffect } from 'react';
import { Shield, Key, AlertTriangle, CheckCircle, Clock, X, History, Settings as SettingsIcon } from 'lucide-react';
import api from './lib/api';

const Settings = () => {
  const [passcode, setPasscode] = useState('');
  const [currentRole, setCurrentRole] = useState('secondary');
  const [statusMsg, setStatusMsg] = useState<{type: 'success' | 'error' | 'info' | '', text: string}>({type: '', text: ''});
  const [isLoading, setIsLoading] = useState(false);
  
  // Notice we now accept 'string' to handle our custom 'promoted' and 'demoted' statuses
  const [requestStatus, setRequestStatus] = useState<string>('none');
  const [requestId, setRequestId] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [requestedAt, setRequestedAt] = useState<string>('');
  
  const [dismissedRejection, setDismissedRejection] = useState(false);
  const [dismissedApproved, setDismissedApproved] = useState(false);
  
  const [requestHistory, setRequestHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const userRole = localStorage.getItem('userRole') || 'secondary';
  const isAdmin = userRole === 'Admin' || userRole === 'admin';

  useEffect(() => {
    setCurrentRole(userRole);
    if (!isAdmin) {
      fetchUpgradeRequestStatus();
      fetchRequestHistory();
    }
  }, [userRole, isAdmin]);

  const fetchUpgradeRequestStatus = async () => {
    try {
      const response = await api.get('/my-upgrade-request/');
      const backendRole = response.data.current_role || localStorage.getItem('userRole') || 'secondary';
      if (backendRole !== localStorage.getItem('userRole')) {
        localStorage.setItem('userRole', backendRole);
      }
      setCurrentRole(backendRole);
      
      if (response.data.status !== 'none') {
        setRequestStatus(response.data.status);
        setRequestId(response.data.request_id);
        
        // Map rejection_reason for both rejects AND demotions
        if (response.data.status === 'rejected' || response.data.status === 'demoted') {
           setRejectionReason(response.data.rejection_reason || 'Administrative Action');
        }
        if (response.data.requested_at) setRequestedAt(new Date(response.data.requested_at).toLocaleString());
      }
    } catch (err) { console.error(err); }
  };

  const fetchRequestHistory = async () => {
    try {
      const response = await api.get('/my-upgrade-request-history/');
      setRequestHistory(response.data || []);
    } catch (err) { console.error(err); }
  };

  const handleUpgrade = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const response = await api.post('/upgrade-role/', { passcode });
      setRequestStatus('pending');
      setRequestId(response.data.request_id);
      setRequestedAt(new Date().toLocaleString());
      setPasscode('');
    } catch (err) { setStatusMsg({type: 'error', text: 'Invalid Passcode'}); }
    finally { setIsLoading(false); }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto text-slate-200">
      <div className="flex items-center gap-4 mb-8 border-b border-slate-800 pb-6">
        <SettingsIcon className="w-8 h-8 text-neon-green" />
        <h1 className="text-3xl font-bold tracking-tight uppercase">
          {isAdmin ? 'Central Host Configuration' : 'System Configuration'}
        </h1>
      </div>

      {isAdmin && (
        <div className="space-y-6 mb-12">
          <div className="bg-slate-900 border border-red-900/30 p-6 rounded-lg bg-red-900/5">
            <h2 className="text-lg text-red-400 font-mono uppercase mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5" /> Central Authority Controls
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button className="border border-red-900/50 hover:bg-red-900/20 text-red-400 font-mono py-3 rounded transition-colors">
                FLUSH SYSTEM LOGS
              </button>
              <button className="border border-red-900/50 hover:bg-red-900/20 text-red-400 font-mono py-3 rounded transition-colors">
                RESET API GATEWAY
              </button>
            </div>
          </div>
        </div>
      )}

      {!isAdmin && (
        <div className="space-y-8">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-lg">
            <h2 className="text-lg text-slate-400 font-mono uppercase mb-4">Authorization Level</h2>
            <div className={`px-4 py-2 rounded font-mono font-bold inline-block ${currentRole === 'primary' ? 'bg-neon-green/10 text-neon-green border border-neon-green/20' : 'bg-slate-800 text-slate-300 border border-slate-700'}`}>
              {currentRole.toUpperCase()} ANALYST
            </div>
          </div>

          {/* Pending Alert */}
          {requestStatus === 'pending' && (
            <div className="bg-blue-500/10 border border-blue-500/30 p-6 rounded-lg">
              <h2 className="text-blue-400 font-mono uppercase flex items-center gap-2">
                <Clock className="w-5 h-5" /> Request ID: {requestId} - Pending
              </h2>
              <p className="text-xs text-slate-400 mt-2 font-mono">Submitted on: {requestedAt}</p>
            </div>
          )}

          {/* Rejected Alert */}
          {requestStatus === 'rejected' && !dismissedRejection && (
            <div className="bg-red-500/10 border border-red-500/30 p-6 rounded-lg relative">
              <button onClick={() => setDismissedRejection(true)} className="absolute top-4 right-4 text-red-400 hover:text-white transition-colors"><X /></button>
              <h2 className="text-red-400 font-mono uppercase flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" /> Upgrade Denied
              </h2>
              <p className="text-sm text-slate-300 mt-2 font-mono">Reason: {rejectionReason}</p>
            </div>
          )}

          {/* Demoted Alert */}
          {requestStatus === 'demoted' && !dismissedRejection && (
            <div className="bg-red-900/20 border border-red-500/50 p-6 rounded-lg relative">
              <button onClick={() => setDismissedRejection(true)} className="absolute top-4 right-4 text-red-400 hover:text-white transition-colors"><X /></button>
              <h2 className="text-red-400 font-mono uppercase flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" /> Authorization Revoked
              </h2>
              <p className="text-sm text-slate-300 mt-2 font-mono">
                You have been demoted to Secondary Analyst.
              </p>
              <p className="text-xs text-red-300/70 mt-1 font-mono">Reason: {rejectionReason}</p>
            </div>
          )}

          {/* Approved / Promoted Alert */}
          {(requestStatus === 'approved' || requestStatus === 'promoted') && !dismissedApproved && (
            <div className="bg-neon-green/10 border border-neon-green/30 p-6 rounded-lg relative">
              <button onClick={() => setDismissedApproved(true)} className="absolute top-4 right-4 text-neon-green hover:text-white transition-colors"><X /></button>
              <h2 className="text-neon-green font-mono uppercase flex items-center gap-2">
                <CheckCircle className="w-5 h-5" /> Privileges Escalated
              </h2>
              <p className="text-sm text-slate-300 mt-2 font-mono">
                You now have full access to Primary Analyst tools (Training, Analytics, and Alerts).
              </p>
            </div>
          )}

          {/* Upgrade Request Form (Now allows demoted users to request again) */}
          {['none', 'rejected', 'demoted'].includes(requestStatus) && currentRole !== 'primary' && (
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-lg">
              <h2 className="text-lg text-slate-400 font-mono uppercase mb-4 flex items-center gap-2">
                <Key className="w-5 h-5" /> Escalate Privileges
              </h2>
              <form onSubmit={handleUpgrade} className="space-y-4">
                <input 
                  type="password" value={passcode} onChange={(e) => setPasscode(e.target.value)}
                  className="w-full bg-black border border-slate-700 p-3 text-neon-green font-mono focus:border-neon-green outline-none"
                  placeholder="AUTHORIZATION PASSCODE" required
                />
                {statusMsg.text && <p className="text-xs text-red-400 font-mono">{statusMsg.text}</p>}
                <button type="submit" disabled={isLoading} className="bg-slate-800 hover:bg-slate-700 text-white font-mono px-6 py-3 rounded transition-colors">
                  {isLoading ? 'SUBMITTING...' : 'SUBMIT REQUEST'}
                </button>
              </form>
            </div>
          )}

          {/* Request History */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-lg">
            <button onClick={() => setShowHistory(!showHistory)} className="flex items-center justify-between w-full uppercase font-mono text-slate-400 hover:text-slate-300 transition-colors">
              <div className="flex items-center gap-3"><History className="w-5 h-5" /> Request History</div>
              <span className="bg-slate-800 px-3 py-1 rounded text-xs border border-slate-700">[{requestHistory.length}]</span>
            </button>
            {showHistory && (
              <div className="mt-4 border-t border-slate-700 pt-4 space-y-2">
                {requestHistory.map((req, i) => (
                  <div key={i} className="text-xs font-mono p-3 bg-black/30 border border-slate-800 rounded flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div className="flex flex-col">
                      <span className={`font-bold ${
                        ['approved', 'promoted'].includes(req.status) ? 'text-neon-green' :
                        ['rejected', 'demoted'].includes(req.status) ? 'text-red-400' :
                        'text-blue-400'
                      }`}>
                        {req.status.toUpperCase()}
                      </span>
                      {req.rejection_reason && (
                        <span className="text-[10px] text-slate-500 mt-0.5">{req.rejection_reason}</span>
                      )}
                    </div>
                    <span className="text-slate-500 whitespace-nowrap">{new Date(req.requested_at).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;