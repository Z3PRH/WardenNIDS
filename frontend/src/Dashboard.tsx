import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import LiveTrafficChart from './components/LiveTrafficChart';
import RecentAlertsTable from './components/RecentAlertsTable';
import type { Alert } from './components/RecentAlertsTable';
import { Shield, Activity, AlertTriangle, TrendingUp } from 'lucide-react';
import api from './lib/api'; // Make sure this path points to your axios instance

// --- 1. INTERFACES MATCHING DJANGO ---

interface TrafficPoint {
  timestamp: string;
  packetCount: number;
  anomalyCount: number;
}

const fetchTrafficData = async (): Promise<TrafficPoint[]> => {
  try {
    const { data } = await api.get('/traffic/live/');
    const traffic = data.data || [];
    
    // Map exactly to Django's TrafficViewSet 'live' response
    return traffic.map((point: any) => ({
      timestamp: point.timestamp,
      packetCount: point.packetCount, 
      anomalyCount: point.anomalyCount,
    }));
  } catch (error) {
    console.error('Failed to fetch live traffic:', error);
    return [];
  }
};

const fetchAlerts = async (): Promise<Alert[]> => {
  try {
    const { data } = await api.get('/alerts/recent/');
    const alerts = data.alerts || [];
    
    return alerts.map((alert: any) => ({
      id: alert.alert_id || alert.id,
      timestamp: alert.created_at || new Date().toISOString(),
      
      // Pulling from the newly nested traffic object
      src_ip: alert.traffic?.source_ip || alert.traffic?.src_ip || 'Unknown IP',
      dst_ip: alert.traffic?.destination_ip || alert.traffic?.dst_ip || 'Unknown IP',
      protocol: alert.traffic?.protocol || 'TCP',
      packet_count: alert.traffic?.packet_count || 0,
      
      threat_level: alert.threat_level || alert.threat_type || alert.severity || 'Normal',
      
      // THE FIX: Provide a proper decimal so the UI renders 95% instead of 9500%
      confidence: alert.traffic?.anomaly_score || alert.confidence || 0.95, 
    }));
  } catch (error) {
    console.error('Failed to fetch recent alerts:', error);
    return [];
  }
};

const blockIP = async ({ ip, alertId }: { ip: string; alertId: number }) => {
  // Matched to the Django block_ip endpoint
  await api.post('/block_ip/', { ip, alert_id: alertId });
};

// --- 2. MAIN DASHBOARD COMPONENT ---

const Dashboard: React.FC = () => {
  const queryClient = useQueryClient();

  const { data: trafficData = [] } = useQuery<TrafficPoint[]>({
    queryKey: ['traffic', 'live'],
    queryFn: fetchTrafficData,
    refetchInterval: 5000,     // Refetch every 5 seconds for the live graph effect
  });

  const { data: alerts = [] } = useQuery<Alert[]>({
    queryKey: ['alerts', 'recent'],
    queryFn: fetchAlerts,
    refetchInterval: 10000,    // Refetch alerts every 10 seconds
  });

  const blockIPMutation = useMutation({
    mutationFn: blockIP,
    onSuccess: () => {
      // Instantly refresh the table when an IP is blocked
      queryClient.invalidateQueries({ queryKey: ['alerts', 'recent'] });
    },
  });

  // Stats Calculations
  const currentPacketCount = trafficData.length > 0
    ? trafficData[trafficData.length - 1].packetCount
    : 0;

  const totalAnomalies = alerts.filter(a => a.threat_level !== 'Normal').length;
  // Dynamically check for high severity
  const criticalThreats = alerts.filter(a => a.threat_level.toLowerCase().includes('ddos') || a.threat_level.toLowerCase().includes('injection')).length;
  const activeFlows = alerts.length;

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

      {/* STATS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        
        {/* Threat Level Card */}
        <div className="bg-black border border-slate-800 p-6">
          <div className="flex items-start justify-between mb-4">
            <div className={`p-3 border ${
              criticalThreats > 0 ? 'border-red-500/60' : 'border-neon-green/60'
            }`}>
              <Shield className={`w-6 h-6 ${
                criticalThreats > 0 ? 'text-red-500' : 'text-neon-green'
              }`} />
            </div>
          </div>
          <p className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-2">
            Threat Level
          </p>
          <p className={`text-2xl font-bold mb-1 ${
            criticalThreats > 0 ? 'text-red-400' : 'text-neon-green'
          }`}>
            {criticalThreats > 0 ? 'CRITICAL' : 'NORMAL'}
          </p>
          <p className="text-xs font-mono text-slate-600">
            {criticalThreats} critical alert{criticalThreats !== 1 ? 's' : ''}
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
            {activeFlows.toLocaleString()}
          </p>
          <p className="text-xs font-mono text-slate-600">
            monitored connections
          </p>
        </div>

        {/* Anomalies Card */}
        <div className="bg-black border border-slate-800 p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 border border-yellow-500/60">
              <AlertTriangle className="w-6 h-6 text-yellow-400" />
            </div>
          </div>
          <p className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-2">
            Anomalies
          </p>
          <p className="text-2xl font-bold text-yellow-400 mb-1">
            {totalAnomalies}
          </p>
          <p className="text-xs font-mono text-slate-600">
            in recent history
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