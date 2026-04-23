import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';
import api from '../lib/api';

interface RoleUpgradeRequest {
  request_id: number;
  username: string;
  requested_at: string;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string;
}

const AdminRoleApprovals = () => {
  const [requests, setRequests] = useState<RoleUpgradeRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    fetchPendingRequests();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchPendingRequests, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchPendingRequests = async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/role-upgrade-requests/');
      setRequests(response.data);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch requests');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (requestId: number) => {
    try {
      setIsSubmitting(true);
      await api.post(`/role-upgrade-requests/${requestId}/approve/`);
      setMessage({ type: 'success', text: 'Request approved successfully' });
      fetchPendingRequests();
      setSelectedRequest(null);
      setRejectionReason('');
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to approve request' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async (requestId: number) => {
    if (!rejectionReason.trim()) {
      setMessage({ type: 'error', text: 'Please provide a rejection reason' });
      return;
    }

    try {
      setIsSubmitting(true);
      await api.post(`/role-upgrade-requests/${requestId}/reject/`, { 
        rejection_reason: rejectionReason 
      });
      setMessage({ type: 'success', text: 'Request rejected successfully' });
      fetchPendingRequests();
      setSelectedRequest(null);
      setRejectionReason('');
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to reject request' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (isLoading && requests.length === 0) {
    return (
      <div className="p-8 max-w-6xl mx-auto text-slate-200">
        <div className="text-center text-slate-400">Loading pending requests...</div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto text-slate-200">
      <h1 className="text-3xl font-bold mb-8 flex items-center gap-3">
        <Clock className="text-neon-green w-8 h-8" />
        Role Upgrade Requests
      </h1>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded flex items-start gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p className="font-mono text-sm">{error}</p>
        </div>
      )}

      {/* Status Message */}
      {message && (
        <div className={`mb-6 p-4 flex items-start gap-3 border rounded ${
          message.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
            : 'bg-red-500/10 border-red-500/30 text-red-400'
        }`}>
          {message.type === 'success' 
            ? <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            : <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          }
          <p className="font-mono text-sm">{message.text}</p>
        </div>
      )}

      {/* Requests Table */}
      {requests.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-lg text-center">
          <p className="text-slate-400 font-mono">No pending upgrade requests</p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-800 border-b border-slate-700">
              <tr>
                <th className="text-left p-4 font-mono text-sm text-slate-400">Username</th>
                <th className="text-left p-4 font-mono text-sm text-slate-400">Requested</th>
                <th className="text-left p-4 font-mono text-sm text-slate-400">Status</th>
                <th className="text-right p-4 font-mono text-sm text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => (
                <React.Fragment key={req.request_id}>
                  <tr className="border-b border-slate-700 hover:bg-slate-800/50 transition-colors">
                    <td className="p-4 font-mono text-sm text-neon-green">{req.username}</td>
                    <td className="p-4 font-mono text-sm text-slate-300">{formatDate(req.requested_at)}</td>
                    <td className="p-4 font-mono text-sm">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        req.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                        req.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {req.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      {req.status === 'pending' && (
                        <button
                          onClick={() => setSelectedRequest(req.request_id)}
                          className="bg-blue-900 hover:bg-blue-800 text-blue-300 font-mono px-3 py-1 rounded text-sm transition-colors"
                        >
                          Review
                        </button>
                      )}
                    </td>
                  </tr>

                  {/* Expanded Detail Row */}
                  {selectedRequest === req.request_id && req.status === 'pending' && (
                    <tr className="bg-slate-800/50 border-b border-slate-700">
                      <td colSpan={4} className="p-6">
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-mono text-slate-400 mb-2">
                              Rejection Reason (Required if rejecting)
                            </label>
                            <textarea
                              value={rejectionReason}
                              onChange={(e) => setRejectionReason(e.target.value)}
                              className="w-full bg-black border border-slate-700 p-3 text-slate-300 font-mono focus:outline-none focus:border-slate-600 transition-colors rounded"
                              placeholder="Enter reason for rejection (e.g., 'Insufficient credentials', 'Pending security review', etc.)"
                              rows={3}
                            />
                          </div>

                          <div className="flex gap-3 justify-end">
                            <button
                              onClick={() => setSelectedRequest(null)}
                              className="bg-slate-700 hover:bg-slate-600 text-slate-300 font-mono px-4 py-2 rounded transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleReject(req.request_id)}
                              disabled={isSubmitting || !rejectionReason.trim()}
                              className="bg-red-900 hover:bg-red-800 text-white font-mono px-4 py-2 rounded transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                              <XCircle className="w-4 h-4" />
                              Reject
                            </button>
                            <button
                              onClick={() => handleApprove(req.request_id)}
                              disabled={isSubmitting}
                              className="bg-green-900 hover:bg-green-800 text-white font-mono px-4 py-2 rounded transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                              <CheckCircle className="w-4 h-4" />
                              Approve
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 text-sm text-slate-500 font-mono">
        <p>Showing {requests.length} pending request{requests.length !== 1 ? 's' : ''}</p>
        <p>Last updated: {new Date().toLocaleTimeString()}</p>
      </div>
    </div>
  );
};

export default AdminRoleApprovals;
