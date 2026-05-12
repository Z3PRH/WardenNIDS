import React, { useState,  } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import LiveTrafficChart from './components/LiveTrafficChart';
import RecentAlertsTable from './components/RecentAlertsTable';
import type { Alert } from './components/RecentAlertsTable';
import { Shield, ShieldAlert, Activity, AlertTriangle, TrendingUp, Bell, CheckCircle, X, Clock } from 'lucide-react';
import api from './lib/api'; 

// --- 1. INTERFACES MATCHING DJANGO ---

export interface TrafficPoint {
  timestamp: string;
  normalPackets: number;
  quarantinePackets: number;
  blockedPackets: number;
}

interface UpgradeRequest {
  request_id: number;
  username: string;
  requested_at: string;
  status: string;
}

const fetchTrafficData = async (): Promise<TrafficPoint[]> => {
  try {
    const { data } = await api.get('/traffic/live/');
    const traffic = Array.isArray(data) ? data : [];
    return traffic.map((point: any) => {
      const date = new Date(point.timestamp);
      const timeStr = date.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' });
      
      const score = point.anomaly_score || 0;
      const pkts = point.packet_count || 0;

      return {
        timestamp: timeStr,
        normalPackets: score < 0.80 ? pkts : 0,
        quarantinePackets: score >= 0.80 && score < 0.90 ? pkts : 0,
        blockedPackets: score >= 0.90 ? pkts : 0,
      };
    });
  } catch (error) {
    console.error('Failed to fetch live traffic:', error);
    return [];
  }
};

// Fetch pending role upgrade requests (admin/primary only)
const fetchPendingRequests = async (): Promise<UpgradeRequest[]> => {
  try {
    const { data } = await api.get('/role-upgrade-requests/');
    return data || [];
  } catch (error) {
    console.error('Failed to fetch pending requests:', error);
    return [];
  }
};

// Maps the backend severity string → RecentAlertsTable threat_level enum
const parseThreatLevel = (severity: string): Alert['threat_level'] => {
  if (!severity) return 'Normal';
  const s = severity.toLowerCase();
  if (s.includes('zero-day') || s.includes('critical')) return 'Zero-Day Suspected';
  if (s.includes('ddos') || s.includes('high') || s.includes('warning') ||
      s.includes('known') || s.includes('signature')) return 'Known Attack';
  return 'Normal';
};

// Priority weight for sorting — higher = shown first
const THREAT_PRIORITY: Record<string, number> = {
  'Zero-Day Suspected': 3,
  'Known Attack':       2,
  'Normal':             1,
};

const fetchAlerts = async (): Promise<Alert[]> => {
  try {
    const { data } = await api.get('/alerts/recent/');
    const alerts = data.alerts || [];

    const mapped: Alert[] = alerts.map((alert: any) => {
      const rawSeverity = alert.severity || alert.threat_level || alert.threat_type || '';
      const confidence  = parseFloat(alert.traffic?.anomaly_score ?? alert.confidence ?? '0') || 0;
      return {
        id:           alert.alert_id || alert.id,
        timestamp:    alert.created_at || new Date().toISOString(),
        src_ip:       alert.traffic?.src_ip || alert.traffic?.source_ip || 'Unknown IP',
        dst_ip:       alert.traffic?.dst_ip || alert.traffic?.destination_ip || 'Unknown IP',
        protocol:     alert.traffic?.protocol || 'TCP',
        packet_count: alert.traffic?.packet_count || 0,
        threat_level: parseThreatLevel(rawSeverity),
        confidence,
        severity: rawSeverity,
      };
    });

    return mapped.sort((a, b) => {
      const priorityDiff = (THREAT_PRIORITY[b.threat_level] ?? 1) - (THREAT_PRIORITY[a.threat_level] ?? 1);
      if (priorityDiff !== 0) return priorityDiff;
      const confidenceDiff = b.confidence - a.confidence;
      if (Math.abs(confidenceDiff) > 0.01) return confidenceDiff;
      return b.packet_count - a.packet_count;
    });

  } catch (error) {
    console.error('Failed to fetch recent alerts:', error);
    return [];
  }
};

const blockIP = async ({ ip, alertId }: { ip: string; alertId: number }) => {
  await api.post('/block_ip/', { ip, alert_id: alertId });
};

// --- 2. PENDING REQUESTS PANEL COMPONENT ---

interface PendingRequestsPanelProps {
  requests: UpgradeRequest[];
  onApprove: (requestId: number) => Promise<void>;
  onReject: (requestId: number) => Promise<void>;
  isLoading: boolean;
}

const PendingRequestsPanel: React.FC<PendingRequestsPanelProps> = ({ requests, onApprove, onReject, isLoading }) => {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState<Record<number, string>>({});

  if (requests.length === 0) return null;

  return (
    <div className="bg-slate-900/50 border border-blue-500/40 p-6 rounded-lg mb-8 backdrop-blur-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="relative">
          <Bell className="w-6 h-6 text-blue-400" />
          <div className="absolute -top-1 -right-2 bg-blue-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
            {requests.length}
          </div>
        </div>
        <h2 className="text-lg font-bold text-blue-400 uppercase tracking-wide">
          Pending Role Upgrade Requests
        </h2>
      </div>

      <div className="space-y-3">
        {requests.map((req) => (
          <div key={req.request_id} className="bg-slate-800/50 border border-slate-700 p-4 rounded">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="font-mono text-white font-bold">{req.username}</p>
                <p className="text-xs text-slate-400 mt-1">
                  Requested: {new Date(req.requested_at).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setExpandedId(expandedId === req.request_id ? null : req.request_id)}
                className="text-blue-400 hover:text-blue-300 text-sm font-mono transition-colors"
              >
                {expandedId === req.request_id ? 'Hide' : 'Actions'}
              </button>
            </div>

            {expandedId === req.request_id && (
              <div className="mt-4 pt-4 border-t border-slate-700 space-y-3">
                <div className="bg-slate-900 p-3 rounded border border-slate-700">
                  <p className="text-xs text-slate-400 font-mono mb-2">REJECTION REASON (if rejecting):</p>
                  <textarea
                    data-request-id={req.request_id}
                    data-type="rejection"
                    value={rejectReason[req.request_id] || ''}
                    onChange={(e) => setRejectReason({ ...rejectReason, [req.request_id]: e.target.value })}
                    placeholder="Explain why this request is being rejected..."
                    className="w-full bg-black border border-slate-700 p-2 text-slate-100 text-xs font-mono rounded focus:border-red-500 focus:outline-none"
                    rows={2}
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => onApprove(req.request_id)}
                    disabled={isLoading}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white font-mono text-sm py-2 rounded transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Approve
                  </button>
                  <button
                    onClick={() => onReject(req.request_id)}
                    disabled={isLoading || !rejectReason[req.request_id]?.trim()}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white font-mono text-sm py-2 rounded transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    Reject
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// --- 3. MAIN DASHBOARD COMPONENT ---

const Dashboard: React.FC = () => {
  const queryClient = useQueryClient();
  const userRole = localStorage.getItem('userRole');
  const isPrimary = userRole === 'primary';
  const isAdmin = userRole === 'Admin';
  const canApproveRequests = isPrimary || isAdmin;

  const { data: trafficData = [] } = useQuery<TrafficPoint[]>({
    queryKey: ['traffic', 'live'],
    queryFn: fetchTrafficData,
    refetchInterval: 5000,     
  });

  const { data: pendingRequests = [] } = useQuery<UpgradeRequest[]>({
    queryKey: ['upgrade-requests', 'pending'],
    queryFn: fetchPendingRequests,
    refetchInterval: 15000,
    enabled: canApproveRequests, // Only fetch if user can approve
  });

  const { data: alerts = [] } = useQuery<Alert[]>({
    queryKey: ['alerts', 'recent'],
    queryFn: fetchAlerts,
    refetchInterval: 10000,    
  });

  const blockIPMutation = useMutation({
    mutationFn: blockIP,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts', 'recent'] });
    },
  });

  const approveMutation = useMutation({
    mutationFn: (requestId: number) => api.post(`/role-upgrade-requests/${requestId}/approve/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['upgrade-requests', 'pending'] });
      alert('Request approved successfully!');
    },
    onError: (error: any) => {
      const message = error.response?.data?.error || error.message || 'Failed to approve request';
      console.error('Approve error:', message);
      alert(`Error: ${message}`);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ requestId, reason }: { requestId: number; reason: string }) =>
      api.post(`/role-upgrade-requests/${requestId}/reject/`, { rejection_reason: reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['upgrade-requests', 'pending'] });
      alert('Request rejected successfully!');
    },
    onError: (error: any) => {
      const message = error.response?.data?.error || error.message || 'Failed to reject request';
      console.error('Reject error:', message);
      alert(`Error: ${message}`);
    },
  });

  // --- DYNAMIC STAT CALCULATIONS ---
  const latestPoint = trafficData.length > 0 ? trafficData[trafficData.length - 1] : null;
  const currentPacketCount = latestPoint 
    ? (latestPoint.normalPackets + latestPoint.quarantinePackets + latestPoint.blockedPackets) 
    : 0;

  let statusText = 'NORMAL';
  let statusColor = 'text-neon-green';
  let borderColor = 'border-neon-green/60';
  let StatusIcon = Shield;
  let shadowGlow = '';
  let statusSubtext = 'Network secure';

  if (latestPoint && latestPoint.blockedPackets > 0) {
    statusText = 'CRITICAL';
    statusColor = 'text-red-500';
    borderColor = 'border-red-500/60';
    StatusIcon = ShieldAlert;
    shadowGlow = 'shadow-[0_0_20px_rgba(239,68,68,0.15)] border-red-500/30';
    statusSubtext = 'Active threats blocked';
  } else if (latestPoint && latestPoint.quarantinePackets > 0) {
    statusText = 'ELEVATED';
    statusColor = 'text-orange-500';
    borderColor = 'border-orange-500/60';
    StatusIcon = AlertTriangle;
    shadowGlow = 'shadow-[0_0_20px_rgba(249,115,22,0.1)] border-orange-500/30';
    statusSubtext = 'Suspicious flows quarantined';
  }

  const estimatedFlows = Math.max(0, Math.floor(currentPacketCount / 12));
  const queueAnomalies = alerts.filter(a => a.threat_level !== 'Normal').length;

  return (
    <div className="p-8 min-h-screen bg-black">
      {/* HEADER SECTION */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white tracking-tight uppercase mb-2">
          DASHBOARD
        </h1>
        <p className="text-sm text-slate-500 font-mono">
          Real-time network monitoring and threat detection
        </p>
      </div>

      {/* PENDING REQUESTS PANEL (Primary/Admin only) */}
      {canApproveRequests && pendingRequests.length > 0 && (
        <PendingRequestsPanel
          requests={pendingRequests}
          onApprove={async (requestId) => {
            try {
              await approveMutation.mutateAsync(requestId);
            } catch (error) {
              console.error('Error approving request:', error);
            }
          }}
          onReject={async (requestId) => {
            try {
              const textarea = document.querySelector(`textarea[data-request-id="${requestId}"]`) as HTMLTextAreaElement;
              const reason = textarea?.value?.trim();
              if (!reason) {
                alert('Please provide a rejection reason');
                return;
              }
              await rejectMutation.mutateAsync({ requestId, reason });
            } catch (error) {
              console.error('Error rejecting request:', error);
            }
          }}
          isLoading={approveMutation.isPending || rejectMutation.isPending}
        />
      )}

      {/* STATS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        
        {/* Threat Level Card */}
        <div className={`bg-black border p-6 transition-all duration-500 ${shadowGlow || 'border-slate-800'}`}>
          <div className="flex items-start justify-between mb-4">
            <div className={`p-3 border ${borderColor}`}>
              <StatusIcon className={`w-6 h-6 ${statusColor} transition-colors`} />
            </div>
          </div>
          <p className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-2">
            Threat Level
          </p>
          <p className={`text-2xl font-bold mb-1 transition-colors ${statusColor}`}>
            {statusText}
          </p>
          <p className="text-xs font-mono text-slate-600">
            {statusSubtext}
          </p>
        </div>

        {/* Active Flows Card */}
        <div className="bg-black border border-slate-800 p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 border border-blue-500/60">
              <Activity className="w-6 h-6 text-blue-400" />
            </div>
          </div>
          <p className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-2">
            Active Flows
          </p>
          <p className="text-2xl font-bold text-blue-400 mb-1">
            {estimatedFlows.toLocaleString()}
          </p>
          <p className="text-xs font-mono text-slate-600">
            estimated live connections
          </p>
        </div>

        {/* Anomalies Queue Card */}
        <div className="bg-black border border-slate-800 p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 border border-yellow-500/60">
              <AlertTriangle className="w-6 h-6 text-yellow-400" />
            </div>
          </div>
          <p className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-2">
            Alert Queue
          </p>
          <p className="text-2xl font-bold text-yellow-400 mb-1">
            {queueAnomalies}
          </p>
          <p className="text-xs font-mono text-slate-600">
            awaiting analyst review
          </p>
        </div>

        {/* Throughput Card */}
        <div className="bg-black border border-slate-800 p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 border border-purple-500/60">
              <TrendingUp className="w-6 h-6 text-purple-400" />
            </div>
          </div>
          <p className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-2">
            Throughput
          </p>
          <p className="text-2xl font-bold text-purple-400 mb-1">
            {(currentPacketCount / 1000).toFixed(1)}K
          </p>
          <p className="text-xs font-mono text-slate-600">
            packets/sec
          </p>
        </div>
      </div>

      {/* FULL WIDTH TRAFFIC CHART */}
      <div className="mb-8">
        <LiveTrafficChart data={trafficData} />
      </div>

      {/* FULL WIDTH ALERTS TABLE */}
      <div>
        <RecentAlertsTable
          alerts={alerts}
          onBlockIP={async (ip, id) => {
            await blockIPMutation.mutateAsync({ ip, alertId: typeof id === 'string' ? parseInt(id) : id });
          }}
        />
      </div>
    </div>
  );
};

export default Dashboard;