import React from 'react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { Activity } from 'lucide-react';
import type { TrafficPoint } from '../Dashboard'; 

interface LiveTrafficChartProps {
  data: TrafficPoint[];
  timeWindow?: string;
}

const LiveTrafficChart: React.FC<LiveTrafficChartProps> = ({ 
  data, 
  timeWindow = 'Last 5 minutes' 
}) => {
  
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const val = payload[0].value;
      const color = payload[0].stroke;
      const name = payload[0].name;
      
      return (
        <div className="bg-black border border-slate-700 p-3 shadow-xl min-w-[170px]">
          <p className="text-slate-400 text-[10px] font-mono mb-2 pb-1 border-b border-slate-800">
            {label}
          </p>
          <div className="flex justify-between gap-4">
            <span className="font-mono text-xs uppercase" style={{ color }}>{name}</span>
            <span className="font-mono text-xs font-bold" style={{ color }}>{val.toLocaleString()}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-black border border-slate-800 p-6">
      
      {/* HEADER */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="p-3 border border-neon-green/60">
            <Activity className="w-6 h-6 text-neon-green" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight uppercase">
              LIVE TELEMETRY FEED
            </h3>
            <p className="text-xs text-slate-600 font-mono mt-0.5">{timeWindow}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-neon-green rounded-full animate-pulse" />
          <span className="text-xs font-mono text-neon-green uppercase tracking-wider font-bold">
            Live
          </span>
        </div>
      </div>

      {/* STACKED TELEMETRY CHARTS */}
      <div className="space-y-4">
        
        {/* 1. NORMAL FLOW (GREEN) */}
        <div className="relative">
          <div className="absolute top-0 left-12 z-10 flex items-center gap-2">
            <div className="w-2 h-2 bg-neon-green" />
            <h4 className="text-[10px] font-mono text-neon-green uppercase tracking-widest">Normal Background Flow</h4>
          </div>
          <ResponsiveContainer width="100%" height={120}>
            {/* syncId connects all 3 charts together */}
            <AreaChart data={data} syncId="trafficSync" margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorNormal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00ff88" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#00ff88" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="timestamp" hide />
              <YAxis stroke="#475569" style={{ fontSize: '10px', fontFamily: 'monospace' }} tickLine={false} width={50} tickFormatter={(v) => v > 0 ? `${(v/1000).toFixed(0)}k` : '0'} />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#334155', strokeWidth: 1, strokeDasharray: '3 3' }} />
              <Area type="monotone" name="Normal Packets" dataKey="normalPackets" stroke="#00ff88" fill="url(#colorNormal)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* 2. QUARANTINED FLOW (ORANGE) */}
        <div className="relative">
          <div className="absolute top-0 left-12 z-10 flex items-center gap-2">
            <div className="w-2 h-2 bg-orange-500" />
            <h4 className="text-[10px] font-mono text-orange-500 uppercase tracking-widest">Quarantined / Zero-Day Suspicion</h4>
          </div>
          <ResponsiveContainer width="100%" height={120}>
            <AreaChart data={data} syncId="trafficSync" margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorQuarantine" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="timestamp" hide />
              <YAxis stroke="#475569" style={{ fontSize: '10px', fontFamily: 'monospace' }} tickLine={false} width={50} tickFormatter={(v) => v > 0 ? `${(v/1000).toFixed(0)}k` : '0'} />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#334155', strokeWidth: 1, strokeDasharray: '3 3' }} />
              <Area type="monotone" name="Quarantined" dataKey="quarantinePackets" stroke="#f97316" fill="url(#colorQuarantine)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* 3. BLOCKED FLOW (RED) */}
        <div className="relative">
          <div className="absolute top-0 left-12 z-10 flex items-center gap-2">
            <div className="w-2 h-2 bg-red-500" />
            <h4 className="text-[10px] font-mono text-red-500 uppercase tracking-widest">Active Blocked Attacks</h4>
          </div>
          {/* Bottom chart is slightly taller to fit the X-Axis time labels */}
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={data} syncId="trafficSync" margin={{ top: 20, right: 10, left: 0, bottom: 20 }}>
              <defs>
                <linearGradient id="colorBlocked" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="timestamp" stroke="#475569" style={{ fontSize: '10px', fontFamily: 'monospace' }} tickLine={false} dy={10} />
              <YAxis stroke="#475569" style={{ fontSize: '10px', fontFamily: 'monospace' }} tickLine={false} width={50} tickFormatter={(v) => v > 0 ? `${(v/1000).toFixed(0)}k` : '0'} />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#334155', strokeWidth: 1, strokeDasharray: '3 3' }} />
              <Area type="monotone" name="Blocked Attacks" dataKey="blockedPackets" stroke="#ef4444" fill="url(#colorBlocked)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

      </div>
    </div>
  );
};

export default LiveTrafficChart;