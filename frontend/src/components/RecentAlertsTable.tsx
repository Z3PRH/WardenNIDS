import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  ShieldAlert, 
  Shield, 
  Ban,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface Alert {
  id: string | number;
  timestamp: string;
  src_ip: string;
  dst_ip: string;
  protocol: string;
  packet_count: number;
  threat_level: 'Normal' | 'Known Attack' | 'Zero-Day Suspected';
  confidence: number;
}

interface RecentAlertsTableProps {
  alerts: Alert[];
  onBlockIP: (ip: string, alertId: string | number) => Promise<void>;
}

const RecentAlertsTable: React.FC<RecentAlertsTableProps> = ({ 
  alerts, 
  onBlockIP 
}) => {
  const [blockingIPs, setBlockingIPs] = useState<Set<string>>(new Set());
  const [blockedIPs, setBlockedIPs] = useState<Set<string>>(new Set());

  const getThreatBadge = (threatLevel: string, confidence: number) => {
    switch (threatLevel) {
      case 'Zero-Day Suspected':
        return (
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 border border-red-500/60 text-red-400 bg-red-500/10 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
              <ShieldAlert className="w-3 h-3" />
              CRITICAL
            </span>
            <span className="text-xs font-mono text-red-400">
              {(confidence * 100).toFixed(0)}%
            </span>
          </div>
        );
      case 'Known Attack':
        return (
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 border border-yellow-500/60 text-yellow-400 bg-yellow-500/10 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
              <ShieldAlert className="w-3 h-3" />
              WARNING
            </span>
            <span className="text-xs font-mono text-yellow-400">
              {(confidence * 100).toFixed(0)}%
            </span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 border border-neon-green/60 text-neon-green bg-neon-green/10 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Shield className="w-3 h-3" />
              NORMAL
            </span>
            <span className="text-xs font-mono text-neon-green">
              {(confidence * 100).toFixed(0)}%
            </span>
          </div>
        );
    }
  };

  const handleBlockIP = async (ip: string, alertId: string | number) => {
    setBlockingIPs(prev => new Set(prev).add(ip));
    
    try {
      await onBlockIP(ip, alertId);
      setBlockedIPs(prev => new Set(prev).add(ip));
    } catch (error) {
      console.error('Failed to block IP:', error);
    } finally {
      setBlockingIPs(prev => {
        const newSet = new Set(prev);
        newSet.delete(ip);
        return newSet;
      });
    }
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      // Try to parse the timestamp
      const date = new Date(timestamp);
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        // If invalid, return the original string or a placeholder
        return timestamp || 'N/A';
      }
      
      // Format: "M/D/YYYY, H:MM:SS AM/PM"
      return date.toLocaleString('en-US', { 
        month: 'numeric',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
    } catch (error) {
      console.error('Error formatting timestamp:', error);
      return timestamp || 'N/A';
    }
  };

  return (
    <div className="bg-black border border-slate-800 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="p-3 border border-red-500/60">
            <ShieldAlert className="w-6 h-6 text-red-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight uppercase">
              RECENT ALERTS
            </h3>
            <p className="text-xs text-slate-600 font-mono mt-0.5">
              {alerts.length} active threat{alerts.length !== 1 ? 's' : ''} detected
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-900/50 border border-slate-800">
          <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
          <span className="text-xs font-mono text-slate-400 uppercase tracking-wider font-bold">
            Monitoring
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-800 hover:bg-transparent">
              <TableHead className="text-slate-600 font-mono text-[11px] uppercase tracking-widest font-bold">
                Timestamp
              </TableHead>
              <TableHead className="text-slate-600 font-mono text-[11px] uppercase tracking-widest font-bold">
                Source IP
              </TableHead>
              <TableHead className="text-slate-600 font-mono text-[11px] uppercase tracking-widest font-bold">
                Destination IP
              </TableHead>
              <TableHead className="text-slate-600 font-mono text-[11px] uppercase tracking-widest font-bold">
                Protocol
              </TableHead>
              <TableHead className="text-slate-600 font-mono text-[11px] uppercase tracking-widest font-bold text-right">
                Packets
              </TableHead>
              <TableHead className="text-slate-600 font-mono text-[11px] uppercase tracking-widest font-bold">
                Threat Level
              </TableHead>
              <TableHead className="text-slate-600 font-mono text-[11px] uppercase tracking-widest font-bold text-center">
                Action
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {alerts.length === 0 ? (
              <TableRow>
                <TableCell 
                  colSpan={7} 
                  className="text-center py-12 text-slate-600 font-mono text-sm"
                >
                  <div className="flex flex-col items-center gap-3">
                    <Shield className="w-10 h-10 text-slate-800" />
                    <span>No active threats detected</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              alerts.map((alert) => {
                const isBlocking = blockingIPs.has(alert.src_ip);
                const isBlocked = blockedIPs.has(alert.src_ip);
                
                return (
                  <TableRow 
                    key={alert.id}
                    className="border-slate-800 hover:bg-slate-900/20 transition-colors"
                  >
                    <TableCell className="font-mono text-xs text-slate-400">
                      {formatTimestamp(alert.timestamp)}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-neon-green font-bold">
                      {alert.src_ip}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-slate-300">
                      {alert.dst_ip}
                    </TableCell>
                    <TableCell>
                      <span className="px-3 py-1 bg-slate-900 text-slate-400 text-xs font-mono border border-slate-800">
                        {alert.protocol}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-sm text-slate-400 text-right">
                      {alert.packet_count.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {getThreatBadge(alert.threat_level, alert.confidence)}
                    </TableCell>
                    <TableCell className="text-center">
                      {isBlocked ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled
                          className="bg-slate-900 border-slate-800 text-slate-600 hover:bg-slate-900 cursor-not-allowed"
                        >
                          <CheckCircle2 className="w-4 h-4 mr-1.5" />
                          Blocked
                        </Button>
                      ) : (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleBlockIP(alert.src_ip, alert.id)}
                          disabled={isBlocking}
                          className="bg-red-600 hover:bg-red-700 text-white font-mono text-xs uppercase tracking-wider border border-red-500/50 transition-all"
                        >
                          {isBlocking ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                              Blocking...
                            </>
                          ) : (
                            <>
                              <Ban className="w-4 h-4 mr-1.5" />
                              Block IP
                            </>
                          )}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default RecentAlertsTable;