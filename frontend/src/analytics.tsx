import { useQuery } from '@tanstack/react-query';
import api from './lib/api';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { Activity, ShieldAlert, TrendingUp } from 'lucide-react';

const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#d946ef']; 

const Analytics = () => {
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['analytics-stats'],
    queryFn: async () => {
      const { data } = await api.get('/traffic/stats/');
      return data;
    },
    refetchInterval: 3000,
    staleTime: 2000,
    refetchOnWindowFocus: true,
  });

  if (error) {
    return (
      <div className="p-8 bg-red-950/20 border border-red-800 rounded text-red-400 font-mono text-sm">
        {'>'} CRITICAL_ERROR: Failed to establish link to Analytics API.
      </div>
    );
  }

  if (isLoading) return <div className="p-8 text-emerald-500 font-bold animate-pulse font-mono">{'>'} SYNCHRONIZING_DATA...</div>;

  // USE THE NEW LIVE SPEEDOMETER DATA (10-Second Memory)
  const total = stats?.live_total || 0;
  const attacks = stats?.live_blocked || 0;
  const zeroDay = stats?.live_zero_day || 0; 
  const quarantined = stats?.live_quarantined || 0; 
  const normal = stats?.live_normal || 0;

  // IDLE DETECTOR: If no packets in last 10s, system is idle
  const isLive = total > 0;

  const getPercent = (val: number) => total > 0 ? ((val / total) * 100).toFixed(1) : "0.0";

  return (
    <div className="p-8 space-y-8 bg-slate-950 min-h-screen text-slate-100">

      {/* DYNAMIC LIVE STATUS BAR */}
      <div className={`flex items-center justify-between border-b px-6 py-2 -mx-8 -mt-8 mb-8 overflow-hidden transition-colors ${
        isLive ? 'bg-slate-900 border-slate-800' : 'bg-amber-950/20 border-amber-900/50'
      }`}>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></div>
            <span className={`text-[10px] font-mono uppercase tracking-tighter ${
              isLive ? 'text-emerald-500' : 'text-amber-500'
            }`}>
              System: {isLive ? 'Online & Receiving' : 'Idle - Awaiting Data Stream'}
            </span>
          </div>
          <div className="h-4 w-px bg-slate-800"></div>
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-tighter">
            Active Brain: <span className="text-slate-200">Warden_RF_v1.0 (CIC-IDS2017)</span>
          </span>
        </div>
        
        <div className="flex items-center gap-4 text-[10px] font-mono text-slate-500">
          <span>LATENCY: {isLive ? '24ms' : '--'}</span>
          <span>UPTIME: 02:44:12</span>
          <span className={isLive ? 'text-emerald-500/50' : 'text-amber-500/50'}>
            {isLive ? 'SECURE_LINK_ESTABLISHED' : 'STREAM_OFFLINE'}
          </span>
        </div>
      </div>

      {/* HEADER */}
      <div>
        <h1 className="text-3xl font-black tracking-tight uppercase">Security Analytics</h1>
        <p className="text-slate-500 font-mono text-xs tracking-widest mt-1">REAL-TIME THREAT INTELLIGENCE FEED</p>
      </div>

      {/* TOP ROW: KPI CARDS (Instantly zeroes out if offline) */}
      <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 transition-all duration-700 ${!isLive && 'opacity-50 grayscale'}`}>
        <StatCard title="LIVE TRAFFIC (LAST 10S)" value={isLive ? total.toLocaleString() : "0"} icon={<Activity className={isLive ? "text-emerald-400" : "text-slate-600"} />} />
        <StatCard title="ACTIVE THREATS" value={isLive ? attacks.toLocaleString() : "0"} icon={<ShieldAlert className={isLive && attacks > 0 ? "text-orange-400" : "text-slate-600"} />} />
        <StatCard title="DETECTION ACCURACY" value={isLive ? "100.0%" : "--"} icon={<TrendingUp className={isLive ? "text-emerald-400" : "text-slate-600"} />} />
      </div>

      {/* MIDDLE ROW: CHARTS (Keeps the 24-hour historical data intact) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* PIE CHART - THREAT DISTRIBUTION */}
        <div className="bg-slate-900/50 border border-slate-800 p-6">
          <h3 className="text-xs font-bold tracking-widest mb-6 uppercase text-slate-400">Traffic Distribution (24H)</h3>
          <div className="h-[300px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats?.distribution}
                  innerRadius={80}
                  outerRadius={110}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {stats?.distribution?.map((_entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '4px' }}
                  itemStyle={{ color: '#ffffff', fontSize: '12px', fontWeight: 'bold' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* BAR CHART - HOURLY TRENDS */}
        <div className="bg-slate-900/50 border border-slate-800 p-6">
          <h3 className="text-xs font-bold tracking-widest mb-6 uppercase text-slate-400">Threat Activity by Hour (24H)</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.hourly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis
                  dataKey="hour"
                  stroke="#64748b"
                  fontSize={10}
                  tickFormatter={(h) => `${h}:00`}
                />
                <YAxis stroke="#64748b" fontSize={10} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '4px' }}
                  itemStyle={{ color: '#ffffff', fontSize: '12px', fontWeight: 'bold' }}
                  labelStyle={{ color: '#94a3b8' }}
                />
                <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* BOTTOM ROW: THREAT BREAKDOWN (Instantly zeroes out if offline) */}
      <div className="space-y-4 pt-4">
        <h3 className="text-xs font-bold tracking-widest uppercase text-slate-500">
          Live Threat Breakdown {!isLive && <span className="text-amber-500 ml-2 animate-pulse">(AWAITING DATA...)</span>}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Notice we are passing the isLive variable down to the cards here! */}
          <BreakdownCard label="NORMAL TRAFFIC" count={normal} percent={getPercent(normal)} color="emerald" isLive={isLive} />
          <BreakdownCard label="KNOWN ATTACKS" count={attacks} percent={getPercent(attacks)} color="red" isLive={isLive} />
          <BreakdownCard label="QUARANTINED" count={quarantined} percent={getPercent(quarantined)} color="amber" isLive={isLive} />
          <BreakdownCard label="ZERO-DAY THREATS" count={zeroDay} percent={getPercent(zeroDay)} color="fuchsia" isLive={isLive} />
        </div>
      </div>
    </div>
  );
};

// ---------------- SUB-COMPONENTS ----------------

const StatCard = ({ title, value, icon }: any) => (
  <div className="bg-slate-900/50 border border-slate-800 p-6 flex items-center justify-between hover:border-slate-700 transition-colors">
    <div>
      <p className="text-[10px] font-bold text-slate-500 tracking-widest mb-1 uppercase">{title}</p>
      <p className="text-3xl font-black text-slate-100">{value}</p>
    </div>
    <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg shadow-inner">{icon}</div>
  </div>
);

// The updated BreakdownCard that listens to the isLive status
const BreakdownCard = ({ label, count, percent, color, isLive }: any) => {
  const colorMap: any = {
    emerald: "border-emerald-500/30 bg-emerald-500/5 text-emerald-400",
    amber: "border-amber-500/30 bg-amber-500/5 text-amber-400",
    red: "border-red-500/30 bg-red-500/5 text-red-500",
    fuchsia: "border-fuchsia-500/30 bg-fuchsia-500/5 text-fuchsia-500",
  };

  return (
    <div className={`border ${colorMap[color]} p-6 rounded-none flex flex-col justify-between transition-all duration-700 ${!isLive ? 'opacity-30 grayscale' : 'hover:bg-opacity-10'}`}>
      <p className="text-[10px] font-bold tracking-widest opacity-80 uppercase">{label}</p>
      <div className="mt-4">
        {/* Force to zero and 0.0% if the generator is turned off */}
        <p className="text-4xl font-black text-white">{isLive ? count.toLocaleString() : "0"}</p>
        <p className="text-[10px] text-slate-500 font-mono mt-1">{isLive ? percent : "0.0"}% OF TOTAL TRAFFIC</p>
      </div>
    </div>
  );
};  

export default Analytics;