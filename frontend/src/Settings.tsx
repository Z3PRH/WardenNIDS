import React, { useState, useEffect } from 'react';
import { Shield, Key, AlertTriangle, CheckCircle, Clock, X } from 'lucide-react';
import api from './lib/api';

const Settings = () => {
  const [passcode, setPasscode] = useState('');
  const [currentRole, setCurrentRole] = useState('secondary');
  const [statusMsg, setStatusMsg] = useState<{type: 'success' | 'error' | 'info' | '', text: string}>({type: '', text: ''});
  const [isLoading, setIsLoading] = useState(false);
  
  // Request status states
  const [requestStatus, setRequestStatus] = useState<'none' | 'pending' | 'approved' | 'rejected'>('none');
  const [requestId, setRequestId] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [requestedAt, setRequestedAt] = useState<string>('');

  // Load the current role and request status on mount
  useEffect(() => {
    const savedRole = localStorage.getItem('userRole') || 'secondary';
    setCurrentRole(savedRole);
    
    // Fetch current upgrade request status
    fetchUpgradeRequestStatus();
    
    // Poll for status updates every 30 seconds
    const interval = setInterval(fetchUpgradeRequestStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchUpgradeRequestStatus = async () => {
    try {
      const response = await api.get('/my-upgrade-request/');
      
      if (response.data.status === 'none') {
        setRequestStatus('none');
        setRequestId(null);
        setRejectionReason('');
      } else {
        setRequestStatus(response.data.status as 'pending' | 'approved' | 'rejected');
        setRequestId(response.data.request_id);
        
        if (response.data.status === 'approved') {
          // Update local role since user was approved
          localStorage.setItem('userRole', 'primary');
          setCurrentRole('primary');
          setStatusMsg({type: 'success', text: 'Your role has been upgraded to Primary Analyst!'});
        } else if (response.data.status === 'rejected') {
          setRejectionReason(response.data.rejection_reason || 'No reason provided');
        }
        
        if (response.data.requested_at) {
          setRequestedAt(new Date(response.data.requested_at).toLocaleString());
        }
      }
    } catch (err: any) {
      // No request found is ok, just keep current status
    }
  };

  const handleUpgrade = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setStatusMsg({type: '', text: ''});

    try {
      const response = await api.post('/upgrade-role/', { passcode });
      
      setRequestStatus('pending');
      setRequestId(response.data.request_id);
      setRequestedAt(new Date().toLocaleString());
      
      setStatusMsg({type: 'info', text: response.data.message});
      setPasscode('');
      
    } catch (err: any) {
      setStatusMsg({
        type: 'error', 
        text: err.response?.data?.error || 'Authorization denied. Invalid passcode.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelRequest = async () => {
    if (!requestId) return;
    
    try {
      await api.post(`/role-upgrade-requests/${requestId}/cancel/`);
      setRequestStatus('none');
      setRequestId(null);
      setStatusMsg({type: 'success', text: 'Request cancelled. You can submit a new one anytime.'});
    } catch (err: any) {
      setStatusMsg({
        type: 'error',
        text: err.response?.data?.error || 'Failed to cancel request'
      });
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

      {/* Request Status Display */}
      {requestStatus === 'pending' && (
        <div className="bg-slate-900 border border-blue-500/30 p-6 rounded-lg mb-8 bg-blue-500/10">
          <h2 className="text-lg text-blue-400 font-mono uppercase mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5" /> Upgrade Request Pending
          </h2>
          <div className="space-y-3">
            <p className="text-sm text-slate-300">
              Your role upgrade request is awaiting admin approval. You will be notified once it is reviewed.
            </p>
            <p className="text-xs text-slate-500">
              Submitted: {requestedAt}
            </p>
            <button
              onClick={handleCancelRequest}
              className="bg-red-900 hover:bg-red-800 text-white font-mono px-4 py-2 rounded text-sm transition-colors flex items-center gap-2"
            >
              <X className="w-4 h-4" /> Cancel Request
            </button>
          </div>
        </div>
      )}

      {requestStatus === 'rejected' && (
        <div className="bg-slate-900 border border-red-500/30 p-6 rounded-lg mb-8 bg-red-500/10">
          <h2 className="text-lg text-red-400 font-mono uppercase mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" /> Request Rejected
          </h2>
          <div className="space-y-3">
            <div className="bg-slate-800 p-3 rounded border border-slate-700">
              <p className="text-xs text-slate-400 font-mono">Admin Reason:</p>
              <p className="text-sm text-slate-300 mt-1">{rejectionReason}</p>
            </div>
            <p className="text-xs text-slate-500">
              You can submit a new request below.
            </p>
          </div>
        </div>
      )}

      {requestStatus === 'approved' && (
        <div className="bg-slate-900 border border-green-500/30 p-6 rounded-lg mb-8 bg-green-500/10">
          <h2 className="text-lg text-green-400 font-mono uppercase mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5" /> Request Approved
          </h2>
          <p className="text-sm text-slate-300">
            Your role upgrade has been approved by an administrator. Please refresh the page to access all primary analyst features.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 bg-neon-green hover:bg-neon-green/80 text-black font-mono px-6 py-2 rounded transition-colors"
          >
            Refresh Page
          </button>
        </div>
      )}

      {/* Privilege Escalation Form (Hidden if request is pending/approved) */}
      {(requestStatus === 'none' || requestStatus === 'rejected') && currentRole !== 'primary' && (
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-lg">
          <h2 className="text-lg text-slate-400 font-mono uppercase mb-4 flex items-center gap-2">
            <Key className="w-5 h-5" /> Request Primary Analyst Access
          </h2>
          
          <form onSubmit={handleUpgrade} className="space-y-4">
            <div>
              <label className="block text-sm font-mono text-slate-500 mb-2">Enter Authorization Passcode</label>
              <input 
                type="password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                className="w-full bg-black border border-slate-700 p-3 text-neon-green font-mono focus:outline-none focus:border-neon-green transition-colors"
                placeholder="••••••••••••••••"
                required
                disabled={isLoading}
              />
            </div>
            
            <button 
              type="submit" 
              disabled={isLoading}
              className="bg-slate-800 hover:bg-slate-700 text-white font-mono px-6 py-3 rounded transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Submitting...' : 'Submit Request'}
            </button>
          </form>

          {/* Feedback Messages */}
          {statusMsg.text && (
            <div className={`mt-4 p-4 flex items-start gap-3 border ${
              statusMsg.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 
              statusMsg.type === 'info' ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' :
              'bg-red-500/10 border-red-500/30 text-red-400'
            }`}>
              {statusMsg.type === 'success' ? <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" /> : 
               statusMsg.type === 'info' ? <Clock className="w-5 h-5 flex-shrink-0 mt-0.5" /> :
               <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />}
              <p className="font-mono text-sm">{statusMsg.text}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Settings;