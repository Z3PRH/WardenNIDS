import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import { Activity } from 'lucide-react';

interface TrafficDataPoint {
  timestamp: string;
  packetCount: number;
  anomalyCount?: number;
}

interface LiveTrafficChartProps {
  data: TrafficDataPoint[];
  timeWindow?: string;
}

const LiveTrafficChart: React.FC<LiveTrafficChartProps> = ({ 
  data, 
  timeWindow = 'Last 5 minutes' 
}) => {
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-black border border-neon-green/30 p-3 shadow-xl">
          <p className="text-slate-400 text-xs font-mono mb-1">
            {payload[0].payload.timestamp}
          </p>
          <p className="text-neon-green font-mono text-sm font-bold">
            Packets: {payload[0].value.toLocaleString()}
          </p>
          {payload[1] && (
            <p className="text-red-400 font-mono text-sm font-bold">
              Anomalies: {payload[1].value}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-black border border-slate-800 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="p-3 border border-neon-green/60">
            <Activity className="w-6 h-6 text-neon-green" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight uppercase">
              LIVE TRAFFIC MONITOR
            </h3>
            <p className="text-xs text-slate-600 font-mono mt-0.5">{timeWindow}</p>
          </div>
        </div>
        
        {/* Live indicator */}
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-neon-green rounded-full animate-pulse" />
          <span className="text-xs font-mono text-neon-green uppercase tracking-wider font-bold">
            Live
          </span>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={360}>
        <AreaChart
          data={data}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="packetGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#00ff88" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#00ff88" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="anomalyGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
            </linearGradient>
          </defs>
          
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke="#1e293b" 
            vertical={false}
          />
          
          <XAxis
            dataKey="timestamp"
            stroke="#475569"
            style={{ fontSize: '11px', fontFamily: 'monospace' }}
            tickLine={false}
          />
          
          <YAxis
            stroke="#475569"
            style={{ fontSize: '11px', fontFamily: 'monospace' }}
            tickLine={false}
            tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
          />
          
          <Tooltip content={<CustomTooltip />} />
          
          {/* Packet count area */}
          <Area
            type="monotone"
            dataKey="packetCount"
            stroke="#00ff88"
            strokeWidth={2}
            fill="url(#packetGradient)"
            animationDuration={300}
          />
          
          {/* Anomaly count line */}
          <Line
            type="monotone"
            dataKey="anomalyCount"
            stroke="#ef4444"
            strokeWidth={2}
            dot={{ fill: '#ef4444', r: 3 }}
            activeDot={{ r: 5, fill: '#ef4444' }}
            animationDuration={300}
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex items-center justify-center gap-8 mt-6 pt-6 border-t border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-neon-green" />
          <span className="text-xs font-mono text-slate-500 uppercase tracking-wider">Packet Volume</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-500" />
          <span className="text-xs font-mono text-slate-500 uppercase tracking-wider">Anomalies</span>
        </div>
      </div>
    </div>
  );
};

export default LiveTrafficChart;