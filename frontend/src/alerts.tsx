import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from './lib/api'; 
import { Shield, Check, Ban, Lock, XCircle, ChevronDown, ChevronUp, AlertOctagon, ArrowRight } from 'lucide-react';

const Alerts = () => {
  const queryClient = useQueryClient();
  
  // The 4 main views
  const [filter, setFilter] = useState<'all' | 'active' | 'quarantined' | 'zeroday'>('quarantined');
  const [expandedAlerts, setExpandedAlerts] = useState<number[]>([]);

  // --- ROLE BASED ACCESS CONTROL ---
  const userRole = localStorage.getItem('userRole') || 'secondary';
  const isPrimary = userRole === 'primary';

  // --- QUERIES & MUTATIONS ---
  const { data: alerts, isLoading, error } = useQuery({
    queryKey: ['alerts', 'all'],
    queryFn: async () => {
      try {
        const { data } = await api.get('/alerts/'); 
        return data.data || data; 
      } catch (err) {
        console.error('Failed to fetch alerts:', err);
        throw err;
      }
    },
    refetchInterval: 10000,
  });

  const acknowledgeMutation = useMutation({
    mutationFn: async (alertId: number) => {
      await api.patch(`/alerts/${alertId}/acknowledge/`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts'] })
  });

  const blockIpMutation = useMutation({
    mutationFn: async ({ ip, alertId }: { ip: string, alertId: number }) => {
      await api.post('/block_ip/', { ip, alert_id: alertId });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts'] })
  });

  const falsePositiveMutation = useMutation({
    mutationFn: async (alertId: number) => {
      await api.patch(`/alerts/${alertId}/false_positive/`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts'] })
  });

  const toggleExpand = (id: number) => {
    setExpandedAlerts(prev => prev.includes(id) ? prev.filter(aId => aId !== id) : [...prev, id]);
  };

  // ==========================================
  // STRICT MUTUAL EXCLUSIVITY FILTER
  // ==========================================
  const filteredAlerts = alerts?.filter((alert: any) => {
    const alertStatus = (alert.status || '').toLowerCase().trim();
    const threatType = (alert.threat_type || alert.severity || '').toLowerCase().trim();
    
    const isBlocked = alertStatus === 'blocked';
    const isAcked = alertStatus === 'acknowledged';
    const isFP = alertStatus === 'false positive';
    
    const isZeroDay = threatType.includes('unknown') || threatType.includes('zero-day');
    const isQuarantinedStatus = alertStatus === 'quarantined';

    if (filter === 'active') {
      return !isBlocked && !isAcked && !isFP && !isQuarantinedStatus && !isZeroDay;
    }
    
    if (filter === 'quarantined') {
      return isQuarantinedStatus && !isZeroDay && !isBlocked && !isFP;
    }
    
    if (filter === 'zeroday') {
      return isZeroDay && !isBlocked && !isFP;
    }
    
    return true; 
  });

  if (error) return <div className="p-8 text-red-500 font-bold">ERROR: Failed to load alerts</div>;
  if (isLoading) return <div className="p-8 text-emerald-500 font-bold">LOADING ALERTS...</div>;

  return (
    <div className="p-8 space-y-8 bg-black min-h-screen text-slate-100">
      
      {/* PAGE HEADER */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-bold tracking-tight uppercase text-white mb-2">INCIDENT COMMAND</h1>
          <p className="text-slate-500 font-mono text-sm">
            {filteredAlerts?.length || 0} items in current view
          </p>
        </div>
        
        {/* FILTER TOGGLES */}
        <div className="flex flex-col items-end gap-3">
          <div className={`px-4 py-1 text-[10px] font-bold tracking-widest uppercase border ${
            isPrimary ? 'border-emerald-500 text-emerald-500' : 'border-slate-500 text-slate-500'
          }`}>
            CLEARANCE: {isPrimary ? 'PRIMARY ANALYST' : 'SECONDARY ANALYST (LOCKED)'}
          </div>

          <div className="flex gap-2">
            {[
              { id: 'all', label: 'ALL' },
              { id: 'active', label: 'KNOWN ATTACKS' },
              { id: 'quarantined', label: 'QUARANTINED' },
              { id: 'zeroday', label: 'POSSIBLE ZERO-DAY' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id as any)}
                className={`px-4 py-2 text-[10px] font-bold tracking-widest uppercase transition-all ${
                  filter === tab.id 
                    ? 'bg-emerald-600 text-black' 
                    : 'bg-transparent border border-slate-800 text-slate-400 hover:border-slate-600'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ALERTS LIST */}
      <div className="space-y-4">
        {filteredAlerts?.map((alert: any) => {
          const alertId = alert.id || alert.alert_id;
          const sourceIp = alert.traffic?.source_ip || alert.traffic?.src_ip || 'Unknown IP';
          const destIp = alert.traffic?.destination_ip || alert.traffic?.dst_ip || 'Unknown IP';
          const protocol = alert.traffic?.protocol || 'TCP';
          const packetCount = alert.traffic?.packet_count || 0;
          const byteCount = alert.traffic?.byte_count || 0;
          const threatTypeRaw = alert.threat_type || alert.severity || 'Unknown Threat';
          const confidence = alert.traffic?.anomaly_score || alert.confidence || 0.95;
          
          const alertStatus = (alert.status || '').toLowerCase().trim();
          const isBlocked = alertStatus === 'blocked';
          const isAcked = alertStatus === 'acknowledged';
          const isFP = alertStatus === 'false positive';
          const isQuarantinedStatus = alertStatus === 'quarantined';
          
          const isZeroDay = threatTypeRaw.toLowerCase().includes('unknown') || threatTypeRaw.toLowerCase().includes('zero-day');
          const isExpanded = expandedAlerts.includes(alertId);

          return (
            <div 
              key={alertId}
              className={`
                relative p-6 border transition-all
                ${isBlocked ? 'border-red-500/30 bg-red-950/10' : 
                  isFP ? 'border-slate-700 bg-slate-900/20 opacity-60' :
                  isZeroDay ? 'border-fuchsia-500/50 bg-fuchsia-950/10' : 
                  isQuarantinedStatus ? 'border-amber-500/50 bg-amber-950/10' :
                  isAcked ? 'border-emerald-500/30 bg-black/40' : 
                  'border-red-500/60 bg-black/60'
                }
              `}
            >
              <div className="flex items-start justify-between gap-6">
                
                {/* LEFT: ICON & CONTENT */}
                <div className="flex items-start gap-6 flex-1 cursor-pointer" onClick={() => toggleExpand(alertId)}>
                  <div className={`p-3 border mt-1 ${
                    isBlocked ? 'border-red-500/50 text-red-500' :
                    isFP ? 'border-slate-500 text-slate-500' :
                    isZeroDay ? 'border-fuchsia-500/60 text-fuchsia-500' :
                    isQuarantinedStatus ? 'border-amber-500/60 text-amber-500' :
                    isAcked ? 'border-emerald-500/50 text-emerald-500' : 
                    'border-red-500/60 text-red-500'
                  }`}>
                    {isBlocked ? <Ban size={20} /> : isFP ? <XCircle size={20} /> : (isQuarantinedStatus || isZeroDay) ? <AlertOctagon size={20} /> : <Shield size={20} />}
                  </div>
                  
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3">
                      
                      <span className={`text-[10px] font-bold px-2 py-0.5 border uppercase tracking-wider ${
                        isZeroDay ? 'border-fuchsia-500/50 text-fuchsia-400 bg-fuchsia-500/10' :
                        isQuarantinedStatus ? 'border-amber-500/50 text-amber-500 bg-amber-500/10' :
                        'border-red-500/50 text-red-500 bg-red-500/10'
                      }`}>
                        {isZeroDay ? 'ZERO-DAY ANOMALY' : isQuarantinedStatus ? 'AI QUARANTINE' : threatTypeRaw}
                      </span>

                      {isFP && <span className="text-[10px] text-slate-500 font-bold tracking-wider">FALSE POSITIVE</span>}
                      {isBlocked && <span className="text-[10px] text-red-500 font-bold tracking-wider">IP BLOCKED</span>}
                    </div>

                    <div>
                      <h3 className="text-base font-normal text-white flex items-center gap-2">
                        <span className="font-mono text-emerald-400">{sourceIp}</span>
                        <ArrowRight size={14} className="text-slate-500" />
                        <span className="font-mono text-blue-400">{destIp}</span>
                      </h3>
                      
                      <div className="flex items-center gap-6 mt-2">
                        <span className="text-[10px] text-slate-500 font-mono tracking-wider">
                          CONFIDENCE: <span className={confidence > 0.9 ? "text-red-400" : "text-amber-400"}>{(confidence * 100).toFixed(1)}%</span>
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono tracking-wider">
                          PROTOCOL: <span className="text-slate-300">{protocol}</span>
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono tracking-wider">
                          PACKETS: <span className="text-slate-300">{packetCount.toLocaleString()}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* RIGHT: ACTION BUTTONS (RBAC Protected) */}
                <div className="flex-shrink-0 flex gap-2 items-center">
                  {!isPrimary ? (
                    <div className="flex items-center gap-2 px-4 py-2 border border-slate-800 text-slate-600 text-[10px] font-bold tracking-widest uppercase">
                      <Lock size={14} /> LOCKED
                    </div>
                  ) : (
                    <>
                      {/* 1. ZERO-DAY ACTIONS (Heavy Incident Response) */}
                      {isZeroDay && !isBlocked && !isFP && (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); window.alert("PCAP Download Initiated for Alert " + alertId); }} 
                            className="flex items-center gap-2 px-4 py-2 bg-transparent border border-fuchsia-600/50 hover:border-fuchsia-400 text-fuchsia-300 text-[10px] font-bold tracking-widest uppercase transition-colors"
                          >
                            <Shield size={14} /> ANALYZE PCAP
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); blockIpMutation.mutate({ ip: sourceIp, alertId }); }}
                            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold tracking-widest uppercase transition-colors shadow-[0_0_10px_rgba(220,38,38,0.3)]"
                          >
                            <AlertOctagon size={14} /> ISOLATE NETWORK
                          </button>
                        </>
                      )}

                      {/* 2. STANDARD QUARANTINE ACTIONS (Judge & Jury) */}
                      {isQuarantinedStatus && !isZeroDay && !isBlocked && !isFP && (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); falsePositiveMutation.mutate(alertId); }}
                            className="flex items-center gap-2 px-4 py-2 bg-transparent border border-slate-600 hover:border-slate-400 text-slate-300 text-[10px] font-bold tracking-widest uppercase transition-colors"
                          >
                            <XCircle size={14} /> FALSE POSITIVE
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); blockIpMutation.mutate({ ip: sourceIp, alertId }); }}
                            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold tracking-widest uppercase transition-colors"
                          >
                            <Ban size={14} /> VERIFY & BLOCK
                          </button>
                        </>
                      )}

                      {/* 3. ACTIVE KNOWN THREAT BUTTONS */}
                      {!isQuarantinedStatus && !isZeroDay && !isBlocked && !isFP && (
                        <>
                          {!isAcked && (
                            <button
                              onClick={(e) => { e.stopPropagation(); acknowledgeMutation.mutate(alertId); }}
                              className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black text-[10px] font-bold tracking-widest uppercase transition-colors"
                            >
                              <Check size={14} /> ACKNOWLEDGE
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); blockIpMutation.mutate({ ip: sourceIp, alertId }); }}
                            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold tracking-widest uppercase transition-colors"
                          >
                            <Ban size={14} /> BLOCK IP
                          </button>
                        </>
                      )}
                    </>
                  )}
                  
                  <button onClick={(e) => { e.stopPropagation(); toggleExpand(alertId); }} className="p-2 text-slate-500 hover:text-white transition-colors">
                    {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </button>
                </div>
              </div>

              {/* THE DEEP DIVE */}
              {isExpanded && (
                <div className="mt-6 pt-4 border-t border-slate-800/50 grid grid-cols-4 gap-6 animate-in fade-in slide-in-from-top-2">
                  <div>
                    <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">TOTAL BYTES</p>
                    <p className="text-slate-300 font-mono text-sm">{byteCount.toLocaleString()} B</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">TIMESTAMP</p>
                    <p className="text-slate-300 font-mono text-sm">
                      {new Date(alert.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">ALERT ID</p>
                    <p className="text-slate-500 font-mono text-sm">WRDN-ALRT-{alertId}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">DATA LABEL</p>
                    <p className="text-slate-500 font-mono text-sm">{threatTypeRaw}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filteredAlerts?.length === 0 && (
          <div className="p-16 text-center border border-dashed border-slate-800">
            <Shield size={48} className="mx-auto text-slate-800 mb-4" />
            <p className="text-slate-500 font-mono text-sm uppercase tracking-widest">No alerts matching current filter.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Alerts;