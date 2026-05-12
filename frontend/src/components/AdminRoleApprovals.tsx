import React, { useState, useEffect } from 'react';
import { Users, Database, History, Trash2, ShieldCheck, AlertCircle, Loader2, Edit2, X, Clock, User, Calendar, FileText } from 'lucide-react';
import api from '../lib/api';

// ==================== Data Interfaces ====================
interface UserProfile {
  id: number;
  username: string;
  email: string;
  role: 'Admin' | 'primary' | 'secondary';
}

interface TrainedModel {
  id: number;
  model_name: string;
  accuracy: number;
  f1_score: number;
  dataset_schema: string;
  trained_on: string;
  trained_by?: string; 
  file_size?: string;
  version?: string;
}

interface SystemActivity {
  id: number;
  user: string;
  action: string;
  timestamp: string;
  details: string;
}

interface DeleteModalState {
  isOpen: boolean;
  user: UserProfile | null;
  reason: string;
  isSubmitting: boolean;
}

interface RoleChangeModalState {
  isOpen: boolean;
  user: UserProfile | null;
  newRole: 'primary' | 'secondary' | 'Admin';
  reason: string;
  isSubmitting: boolean;
}

// ==================== Utility Functions ====================
const formatDate = (dateValue: string | undefined | null, format: 'date' | 'datetime' = 'date'): string => {
  if (!dateValue) return 'N/A';
  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return 'N/A';
    if (format === 'datetime') {
      return date.toLocaleString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
    }
    return date.toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  } catch (e) {
    return 'Invalid Date';
  }
};

const AdminRoleApprovals = () => {
  const [activeTab, setActiveTab] = useState<'personnel' | 'models' | 'history'>('personnel');
  const [personnel, setPersonnel] = useState<UserProfile[]>([]);
  const [models, setModels] = useState<TrainedModel[]>([]);
  const [history, setHistory] = useState<SystemActivity[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  const [deleteModal, setDeleteModal] = useState<DeleteModalState>({
    isOpen: false, user: null, reason: '', isSubmitting: false,
  });
  
  const [roleChangeModal, setRoleChangeModal] = useState<RoleChangeModalState>({
    isOpen: false, user: null, newRole: 'secondary', reason: '', isSubmitting: false,
  });

  useEffect(() => {
    fetchAdminData();
    setSuccessMessage('');
  }, [activeTab]);

  const fetchAdminData = async () => {
    setIsLoading(true);
    setError('');
    try {
      if (activeTab === 'personnel') {
        const res = await api.get('/admin/users/');
        setPersonnel(res.data || []);
      } else if (activeTab === 'models') {
        const res = await api.get('/admin/models/');
        setModels(res.data || []);
      } else if (activeTab === 'history') {
        const res = await api.get('/admin/system-history/');
        setHistory(res.data || []);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'System access restricted. Admin credentials required.');
    } finally {
      setIsLoading(false);
    }
  };

  const openDeleteModal = (user: UserProfile) => {
    setDeleteModal({ isOpen: true, user, reason: '', isSubmitting: false });
  };

  const closeDeleteModal = () => {
    setDeleteModal({ isOpen: false, user: null, reason: '', isSubmitting: false });
  };

  const handleConfirmDelete = async () => {
    if (!deleteModal.user || !deleteModal.reason.trim()) {
      alert('Please provide a reason for deletion.');
      return;
    }
    
    setDeleteModal(prev => ({ ...prev, isSubmitting: true }));
    try {
      await api.delete(`/admin/users/${deleteModal.user.id}/`, {
        data: { reason: deleteModal.reason },
      });
      setPersonnel(personnel.filter(u => u.id !== deleteModal.user?.id));
      setSuccessMessage(`User "${deleteModal.user.username}" has been deleted.`);
      closeDeleteModal();
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete user.');
    } finally {
      setDeleteModal(prev => ({ ...prev, isSubmitting: false }));
    }
  };

  const openRoleChangeModal = (user: UserProfile) => {
    const rolesAvailable: Array<'primary' | 'secondary' | 'Admin'> = user.role === 'Admin' 
      ? ['primary', 'secondary', 'Admin'] 
      : user.role === 'primary' 
      ? ['primary', 'secondary'] 
      : ['secondary', 'primary'];
    
    setRoleChangeModal({ 
      isOpen: true, user, newRole: rolesAvailable[0], reason: '', isSubmitting: false 
    });
  };

  const closeRoleChangeModal = () => {
    setRoleChangeModal({ isOpen: false, user: null, newRole: 'secondary', reason: '', isSubmitting: false });
  };

  const handleConfirmRoleChange = async () => {
    if (!roleChangeModal.user || !roleChangeModal.reason.trim()) {
      alert('Please provide a reason for role change.');
      return;
    }
    
    setRoleChangeModal(prev => ({ ...prev, isSubmitting: true }));
    try {
      await api.patch(`/admin/users/${roleChangeModal.user.id}/`, {
        role: roleChangeModal.newRole,
        reason: roleChangeModal.reason,
      });
      setPersonnel(personnel.map(u => 
        u.id === roleChangeModal.user?.id 
          ? { ...u, role: roleChangeModal.newRole as 'Admin' | 'primary' | 'secondary' }
          : u
      ));
      setSuccessMessage(`User "${roleChangeModal.user.username}" role changed to ${roleChangeModal.newRole.toUpperCase()}.`);
      closeRoleChangeModal();
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to change user role.');
    } finally {
      setRoleChangeModal(prev => ({ ...prev, isSubmitting: false }));
    }
  };

  const handleDeleteModel = async (id: number) => {
    if (!window.confirm("Permanently remove this trained dataset from the engine?")) return;
    try {
      await api.delete(`/admin/models/${id}/`);
      setModels(models.filter(m => m.id !== id));
    } catch (err) {
      alert("Failed to delete dataset.");
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto text-slate-200">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <ShieldCheck className="text-neon-green w-8 h-8" />
            Infrastructure Management
          </h1>
          <p className="text-xs text-slate-500 font-mono mt-1 uppercase tracking-widest">Central Host Control Panel</p>
        </div>

        <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-lg">
          <button onClick={() => setActiveTab('personnel')} className={`px-4 py-2 rounded-md text-xs font-mono transition-all ${activeTab === 'personnel' ? 'bg-neon-green/10 text-neon-green border border-neon-green/20' : 'text-slate-500 hover:text-slate-300 border border-transparent'}`}>
            <Users className="w-3 h-3 inline mr-2" />PERSONNEL
          </button>
          <button onClick={() => setActiveTab('models')} className={`px-4 py-2 rounded-md text-xs font-mono transition-all ${activeTab === 'models' ? 'bg-neon-green/10 text-neon-green border border-neon-green/20' : 'text-slate-500 hover:text-slate-300 border border-transparent'}`}>
            <Database className="w-3 h-3 inline mr-2" />MODELS
          </button>
          <button onClick={() => setActiveTab('history')} className={`px-4 py-2 rounded-md text-xs font-mono transition-all ${activeTab === 'history' ? 'bg-neon-green/10 text-neon-green border border-neon-green/20' : 'text-slate-500 hover:text-slate-300 border border-transparent'}`}>
            <History className="w-3 h-3 inline mr-2" />WEEK HISTORY
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded flex items-center gap-3 font-mono text-sm">
          <AlertCircle className="w-5 h-5" /> {error}
        </div>
      )}

      {successMessage && (
        <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 text-neon-green rounded flex items-center gap-3 font-mono text-sm">
          <ShieldCheck className="w-5 h-5" /> {successMessage}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-neon-green" /></div>
      ) : (
        <div className="min-h-[400px]">
          {/* PERSONNEL TAB */}
          {activeTab === 'personnel' && (
            <div className="space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
                <div className="flex items-center gap-2 text-slate-400 text-sm mb-4 font-mono">
                  <Users className="w-4 h-4 text-neon-green" />
                  <span>Total Operators: <strong className="text-white">{personnel.length}</strong></span>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-sm">
                    <thead className="bg-slate-800/50 text-slate-500 uppercase text-[10px] tracking-tighter border-b border-slate-800">
                      <tr>
                        <th className="p-3">Operator ID</th>
                        <th className="p-3">Contact</th>
                        <th className="p-3">Role</th>
                        <th className="p-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {personnel.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-6 text-center text-slate-500">
                            <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            No operators found
                          </td>
                        </tr>
                      ) : (
                        personnel.map(u => (
                          <tr key={u.id} className="border-b border-slate-800 hover:bg-slate-800/20 transition-colors">
                            <td className="p-3 text-white font-bold">{u.username}</td>
                            <td className="p-3 text-slate-400 text-xs">{u.email}</td>
                            <td className="p-3">
                              <span className={`px-2 py-1 rounded text-[10px] border font-semibold ${
                                u.role === 'Admin' ? 'bg-red-950/50 text-red-400 border-red-900/50' : 
                                u.role === 'primary' ? 'bg-neon-green/20 text-neon-green border-neon-green/30' : 
                                'bg-slate-800 text-slate-300 border-slate-700'
                              }`}>
                                {u.role.toUpperCase()}
                              </span>
                            </td>
                            <td className="p-3 flex justify-center gap-2">
                              <button 
                                onClick={() => openRoleChangeModal(u)}
                                className="text-neon-green hover:text-white transition-colors p-1.5 hover:bg-slate-800 rounded"
                                title="Change Role"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button 
                                onClick={() => openDeleteModal(u)}
                                className="text-red-400 hover:text-white transition-colors p-1.5 hover:bg-slate-800 rounded"
                                title="Delete User"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* MODELS TAB */}
          {activeTab === 'models' && (
            <div className="space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
                <div className="flex items-center gap-2 text-slate-400 text-sm mb-6 font-mono">
                  <Database className="w-4 h-4 text-neon-green" />
                  <span>Trained Models: <strong className="text-white">{models.length}</strong></span>
                </div>

                {models.length === 0 ? (
                  <div className="text-center py-12">
                    <Database className="w-12 h-12 mx-auto mb-3 opacity-30 text-neon-green" />
                    <p className="text-slate-500 font-mono text-sm">No trained models available</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {models.map(m => (
                      <div key={m.id} className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden hover:border-neon-green/30 transition-colors">
                        <div className="bg-slate-800/80 p-4 border-b border-slate-700">
                          <div className="flex justify-between items-start gap-2">
                            <div className="flex-1">
                              <h3 className="text-white font-bold text-sm">{m.model_name}</h3>
                              <p className="text-slate-500 text-[11px] font-mono uppercase mt-1">Version: {m.version || '1.0'}</p>
                            </div>
                            <button onClick={() => handleDeleteModel(m.id)} className="text-slate-600 hover:text-red-500 transition-colors p-1.5 hover:bg-slate-700 rounded">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>

                        <div className="p-4 space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-slate-800/40 p-3 rounded border border-slate-700/50">
                              <span className="block text-[10px] text-slate-400 uppercase font-mono mb-1">Schema</span>
                              <span className="text-slate-200 font-mono text-xs">{m.dataset_schema}</span>
                            </div>
                            <div className="bg-slate-800/40 p-3 rounded border border-slate-700/50">
                              <span className="block text-[10px] text-slate-400 uppercase font-mono mb-1">File Size</span>
                              <span className="text-slate-200 font-mono text-xs">{m.file_size || 'N/A'}</span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-slate-800/40 p-3 rounded border border-slate-700/50">
                              <span className="flex items-center gap-1 text-[10px] text-slate-400 uppercase font-mono mb-1">
                                <User className="w-3 h-3" /> Trained By
                              </span>
                              <span className="text-neon-green font-mono text-xs">{m.trained_by || 'System'}</span>
                            </div>
                            <div className="bg-slate-800/40 p-3 rounded border border-slate-700/50">
                              <span className="flex items-center gap-1 text-[10px] text-slate-400 uppercase font-mono mb-1">
                                <Calendar className="w-3 h-3" /> Trained On
                              </span>
                              <span className="text-slate-200 font-mono text-xs">{formatDate(m.trained_on, 'date')}</span>
                            </div>
                          </div>

                          <div className="border-t border-slate-700 pt-3">
                            <p className="text-[10px] text-slate-400 uppercase font-mono mb-2">Performance Metrics</p>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <div className="flex justify-between items-center mb-1">
                                  <span className="text-[10px] text-slate-400">Accuracy</span>
                                  <span className="text-neon-green font-mono text-xs font-bold">{m.accuracy}%</span>
                                </div>
                                <div className="w-full bg-slate-800 rounded-full h-1.5">
                                  <div className="bg-neon-green h-1.5 rounded-full" style={{ width: `${m.accuracy}%` }}></div>
                                </div>
                              </div>
                              <div>
                                <div className="flex justify-between items-center mb-1">
                                  <span className="text-[10px] text-slate-400">F1 Score</span>
                                  <span className="text-neon-green font-mono text-xs font-bold">{m.f1_score}</span>
                                </div>
                                <div className="w-full bg-slate-800 rounded-full h-1.5">
                                  <div className="bg-neon-green h-1.5 rounded-full" style={{ width: `${Math.min(m.f1_score * 100, 100)}%` }}></div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* HISTORY TAB */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
                <div className="flex items-center gap-2 text-slate-400 text-sm mb-6 font-mono">
                  <History className="w-4 h-4 text-neon-green" />
                  <span>System Activity: <strong className="text-white">{history.length}</strong></span>
                </div>

                {history.length === 0 ? (
                  <div className="text-center py-12">
                    <History className="w-12 h-12 mx-auto mb-3 opacity-30 text-neon-green" />
                    <p className="text-slate-500 font-mono text-sm">No activity recorded</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {history.map(log => (
                      <div key={log.id} className="bg-slate-800/40 border border-slate-700 rounded-lg p-4 hover:bg-slate-800/60 transition-colors">
                        <div className="flex flex-wrap md:flex-nowrap gap-4 justify-between mb-3">
                          <div className="min-w-[150px]">
                            <span className="block text-[10px] text-slate-500 uppercase font-mono mb-1">Timestamp</span>
                            <span className="text-slate-300 font-mono text-sm">{formatDate(log.timestamp, 'datetime')}</span>
                          </div>
                          <div className="min-w-[150px]">
                            <span className="flex items-center gap-1 text-[10px] text-slate-500 uppercase font-mono mb-1">
                              <User className="w-3 h-3" /> Performed By
                            </span>
                            <span className="text-neon-green font-mono text-sm">{log.user}</span>
                          </div>
                          <div className="min-w-[150px]">
                            <span className="block text-[10px] text-slate-400 uppercase font-mono mb-1">Action</span>
                            <span className={`inline-block px-2 py-1 rounded text-[10px] font-semibold ${
                              log.action.includes('DELETE') ? 'bg-red-950/50 text-red-400 border border-red-900/30' :
                              log.action.includes('UPLOAD') || log.action.includes('TRAIN') ? 'bg-neon-green/10 text-neon-green border border-neon-green/20' :
                              log.action.includes('ROLE') || log.action.includes('MODIFY') ? 'bg-slate-800 text-white border border-slate-600' :
                              'bg-slate-800 text-slate-300 border border-slate-700'
                            }`}>
                              {log.action}
                            </span>
                          </div>
                        </div>
                        
                        {/* Details Container - Fixed Unbound Overflow Issue */}
                        <div className="bg-black/40 p-3 rounded border border-slate-700/50 mt-2">
                          <span className="flex items-center gap-1 text-[10px] text-slate-500 uppercase font-mono mb-1">
                            <FileText className="w-3 h-3" /> Details
                          </span>
                          {/* break-words ensures long text strings stay bound inside the box */}
                          <p className="text-slate-400 font-mono text-xs break-words whitespace-pre-wrap leading-relaxed">
                            {log.details}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODALS */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-red-400 flex items-center gap-2">
                <Trash2 size={20} /> Delete User
              </h2>
              <button onClick={closeDeleteModal} className="text-slate-500 hover:text-slate-300">
                <X size={20} />
              </button>
            </div>
            <div className="bg-red-900/20 border border-red-900/30 p-3 rounded text-red-300 text-sm font-mono">
              ⚠️ PERMANENT ACTION: This will permanently delete user <strong>{deleteModal.user?.username}</strong>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2 uppercase">Reason for Deletion</label>
              <textarea 
                value={deleteModal.reason}
                onChange={(e) => setDeleteModal(prev => ({ ...prev, reason: e.target.value }))}
                placeholder="e.g., Violation of policies..."
                className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-200 font-mono text-sm focus:outline-none focus:border-red-500"
                rows={4}
              />
            </div>
            <div className="flex gap-3 pt-4 border-t border-slate-800">
              <button onClick={closeDeleteModal} className="flex-1 px-4 py-2 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded transition-colors" disabled={deleteModal.isSubmitting}>
                Cancel
              </button>
              <button onClick={handleConfirmDelete} className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 transition-colors text-white rounded flex items-center justify-center gap-2" disabled={deleteModal.isSubmitting || !deleteModal.reason.trim()}>
                {deleteModal.isSubmitting ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {roleChangeModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-neon-green flex items-center gap-2">
                <Edit2 size={20} /> Modify User Role
              </h2>
              <button onClick={closeRoleChangeModal} className="text-slate-500 hover:text-slate-300"><X size={20} /></button>
            </div>
            <div className="bg-neon-green/10 border border-neon-green/20 p-3 rounded text-neon-green text-sm font-mono">
              Changing role for user <strong>{roleChangeModal.user?.username}</strong><br />
              Current Role: <span className="text-white">{roleChangeModal.user?.role.toUpperCase()}</span>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2 uppercase">New Role</label>
              <select 
                value={roleChangeModal.newRole}
                onChange={(e) => setRoleChangeModal(prev => ({ ...prev, newRole: e.target.value as 'primary' | 'secondary' | 'Admin' }))}
                className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-200 font-mono text-sm focus:outline-none focus:border-neon-green"
              >
                <option value="primary">PRIMARY</option>
                <option value="secondary">SECONDARY</option>
                {roleChangeModal.user?.role === 'Admin' && <option value="Admin">ADMIN</option>}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2 uppercase">Reason for Change</label>
              <textarea 
                value={roleChangeModal.reason}
                onChange={(e) => setRoleChangeModal(prev => ({ ...prev, reason: e.target.value }))}
                placeholder="e.g., Performance evaluation..."
                className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-200 font-mono text-sm focus:outline-none focus:border-neon-green"
                rows={4}
              />
            </div>
            <div className="flex gap-3 pt-4 border-t border-slate-800">
              <button onClick={closeRoleChangeModal} className="flex-1 px-4 py-2 bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors rounded" disabled={roleChangeModal.isSubmitting}>Cancel</button>
              <button onClick={handleConfirmRoleChange} className="flex-1 px-4 py-2 bg-neon-green hover:bg-neon-green/80 text-black font-bold transition-colors rounded flex items-center justify-center gap-2" disabled={roleChangeModal.isSubmitting || !roleChangeModal.reason.trim()}>
                {roleChangeModal.isSubmitting ? <Loader2 className="animate-spin" size={16} /> : <Edit2 size={16} />}
                Confirm Change
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminRoleApprovals;