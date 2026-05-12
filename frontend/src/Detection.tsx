import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import api from './lib/api';
import { jsPDF } from 'jspdf';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { 
  ShieldCheck, Upload, AlertTriangle, CheckCircle, 
  RefreshCw, FileText, Zap, Activity, Download 
} from 'lucide-react';

/**
 * Detection Component
 * * Provides a specialized interface for Secondary Analysts to audit network logs.
 * Features:
 * - Drag-and-drop CSV log upload
 * - Real-time chronological visualization of file traffic
 * - AI-powered security grading and threat density analysis
 * - Professional PDF Scorecard generation for reporting
 */

const Detection = () => {
    const [file, setFile] = useState<File | null>(null);
    const [report, setReport] = useState<any>(null);

    // Derives threat density and security rating from the backend report data
    const getThreatStats = (r: any) => {
        const { packets_scanned, anomalies } = r.summary;
        const anomalyPct = packets_scanned > 0 ? (anomalies / packets_scanned) * 100 : 0;
        const securityRating = Math.max(0, 100 - anomalyPct).toFixed(1) + "%";
        return { anomalyPct, securityRating };
    };

    // Returns color class based on safety grade from backend grading logic
    const getGradeColor = (grade: string) => {
        if (grade.startsWith('A')) return 'text-neon-green';
        if (grade === 'B') return 'text-blue-400';
        if (grade === 'C') return 'text-yellow-400';
        if (grade === 'D') return 'text-orange-400';
        return 'text-red-500'; // F
    };

    // Mutation to send the log to the personal-audit endpoint
    const auditMutation = useMutation({
        mutationFn: async (fileToUpload: File) => {
            const formData = new FormData();
            formData.append('file', fileToUpload);
            const { data } = await api.post('/audit-personal-log/', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            return data;
        },
        onSuccess: (data) => {
            setReport(data);
        }
    });

    // --- USER-FRIENDLY PDF EXPORT ENGINE ---
    const downloadPDF = () => {
        if (!report) return;
        const doc = new jsPDF();
        const date = new Date().toLocaleString();
        
        const grade = report.summary.grade;
        let gradeColor = [0, 200, 136]; 
        let gradeContext = "Your network traffic appears clean and secure.";
        
        if (grade === 'B' || grade === 'C') {
            gradeColor = [250, 175, 0]; 
            gradeContext = "Some suspicious background activity noticed. Review recommended.";
        } else if (grade === 'D' || grade === 'F') {
            gradeColor = [239, 68, 68]; 
            gradeContext = "WARNING: High level of malicious activity detected. Action required.";
        }

        doc.setFillColor(15, 23, 42); 
        doc.rect(0, 0, 210, 45, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.setFont("helvetica", "bold");
        doc.text("WARDEN", 20, 22);
        doc.setTextColor(0, 255, 136); 
        doc.setFontSize(12);
        doc.text("PERSONAL CYBERSECURITY SCORECARD", 20, 32);
        doc.setTextColor(150, 150, 150);
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text(`Date: ${date.split(',')[0]}`, 140, 22);
        doc.text(`Report ID: ${report.report_id}`, 140, 28);

        doc.setFillColor(248, 250, 252); 
        doc.rect(20, 55, 170, 45, 'F');
        doc.setTextColor(gradeColor[0], gradeColor[1], gradeColor[2]);
        doc.setFontSize(45);
        doc.setFont("helvetica", "bold");
        doc.text(grade, 35, 85);
        doc.setTextColor(30, 30, 30);
        doc.setFontSize(16);
        doc.text("Security Health Grade", 70, 70);
        doc.setFontSize(11);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(80, 80, 80);
        doc.text(gradeContext, 70, 80);
        doc.text("This grade evaluates the safety of your uploaded network log.", 70, 88);

        doc.setTextColor(30, 30, 30);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("What Did We Find?", 20, 120);
        doc.setFontSize(11);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(60, 60, 60);
        const totalConnections = report.summary.packets_scanned.toLocaleString();
        const badConnections = report.summary.anomalies.toLocaleString();
        doc.text(`• Total Network Interactions Checked: ${totalConnections}`, 25, 130);
        doc.text(`• Suspicious/Harmful Interactions: ${badConnections}`, 25, 138);

        doc.setTextColor(30, 30, 30);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Your Action Plan", 20, 155);
        doc.setFontSize(11);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(60, 60, 60);
        let yPos = 165;
        report.recommendations.forEach((rec: string, i: number) => {
            const splitText = doc.splitTextToSize(`${i + 1}. ${rec}`, 160);
            doc.text(splitText, 25, yPos);
            yPos += (splitText.length * 7) + 3;
        });

        yPos += 10;
        doc.setFillColor(240, 249, 255); 
        doc.rect(20, yPos, 170, 35, 'F');
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("Understanding This Report", 25, yPos + 10);
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(71, 85, 105);
        const explanation = doc.splitTextToSize(
            "Warden's AI engine analyzes your internet traffic for signs of malware, hacking attempts, or suspicious probing. A perfect score means your data flows safely.", 
            160
        );
        doc.text(explanation, 25, yPos + 18);
        doc.setTextColor(150, 150, 150);
        doc.setFontSize(9);
        doc.text("Generated by Warden Educational Security Interface", 105, 285, { align: "center" });

        doc.save(`Warden_Scorecard_${date.split(',')[0].replace(/\//g, '-')}.pdf`);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) setFile(e.target.files[0]);
    };

    const handleUpload = () => {
        if (file) {
            setReport(null); 
            auditMutation.mutate(file);
        }
    };

    const reset = () => {
        setFile(null);
        setReport(null);
    };

    return (
        <div className="p-8 min-h-screen bg-black text-slate-100">
            <div className="mb-8">
                <h1 className="text-4xl font-bold tracking-tight uppercase mb-2">DETECTION</h1>
                <p className="text-sm text-slate-500 font-mono">
                    AI-powered network threat analysis and anomaly detection
                </p>
            </div>

            {!report ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                        <div className="bg-black border border-slate-800 p-8 relative overflow-hidden">
                            <div className="absolute inset-0 opacity-5">
                                <div className="absolute inset-0" style={{
                                    backgroundImage: 'linear-gradient(#00ff88 1px, transparent 1px), linear-gradient(90deg, #00ff88 1px, transparent 1px)',
                                    backgroundSize: '50px 50px'
                                }}></div>
                            </div>

                            <div className="relative z-10">
                                <div className="flex items-start gap-4 mb-8">
                                    <div className="p-4 border-2 border-neon-green bg-neon-green/5">
                                        <ShieldCheck className="w-8 h-8 text-neon-green" />
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-bold uppercase tracking-tight mb-2">Network Log Auditor</h3>
                                        <p className="text-sm text-slate-400 font-mono">
                                            Upload network logs for personal security assessment
                                        </p>
                                    </div>
                                </div>

                                <div className="border-2 border-dashed border-slate-700 hover:border-neon-green/50 transition-colors p-16 text-center mb-6 bg-slate-900/20 relative group">
                                    <input type="file" accept=".csv" onChange={handleFileChange} className="hidden" id="file-upload" />
                                    <label htmlFor="file-upload" className="cursor-pointer">
                                        <div className="flex justify-center mb-6">
                                            <div className="p-6 border border-slate-700 bg-black">
                                                <Upload className="w-16 h-16 text-slate-600" />
                                            </div>
                                        </div>
                                        {file ? (
                                            <div className="inline-flex items-center gap-3 px-6 py-3 border border-neon-green/50 bg-neon-green/5">
                                                <FileText className="w-6 h-6 text-neon-green" />
                                                <div className="text-left">
                                                    <p className="font-mono text-sm text-neon-green font-bold">{file.name}</p>
                                                    <p className="text-xs text-slate-500 font-mono">{(file.size / 1024).toFixed(2)} KB • Ready</p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                <p className="text-lg text-slate-300 font-semibold uppercase">Drop your network log here</p>
                                                <p className="text-sm text-slate-500 font-mono tracking-widest uppercase">Click to browse files</p>
                                            </div>
                                        )}
                                    </label>
                                </div>

                                <div className="flex gap-4">
                                    <label htmlFor="file-upload" className="flex-1 text-center px-6 py-4 bg-slate-900 border border-slate-700 text-slate-300 font-bold text-sm uppercase tracking-wider cursor-pointer hover:bg-slate-800 transition-all">
                                        {file ? "Change File" : "Select Log"}
                                    </label>
                                    {file && (
                                        <button 
                                            onClick={handleUpload}
                                            disabled={auditMutation.isPending}
                                            className="flex-1 px-6 py-4 bg-neon-green text-black font-bold text-sm uppercase tracking-wider hover:bg-neon-green/90 transition-all disabled:opacity-50"
                                        >
                                            {auditMutation.isPending ? "RUNNING AI SCAN..." : "EXECUTE AUDIT"}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <InfoCard icon={<Activity className="text-blue-400" />} title="Real-time Engine" desc="ML anomaly scoring active" />
                        <InfoCard icon={<Zap className="text-purple-400" />} title="Instant Response" desc="Results generated in under 1s" />
                        <div className="bg-gradient-to-br from-neon-green/10 to-transparent border border-neon-green/30 p-6 relative overflow-hidden">
                            <div className="flex items-center justify-between mb-4">
                                <p className="text-[10px] font-bold text-neon-green uppercase tracking-[0.2em]">
                                    Warden Core Health: <span className="animate-pulse">Optimal</span>
                                </p>
                                <Activity className="w-4 h-4 text-neon-green" />
                            </div>
                            <div className="space-y-4">
                                <DiagnosticBar label="AI Core Load" percent="14%" />
                                <DiagnosticBar label="Processing Latency" percent="32ms" />
                            </div>
                            <p className="mt-6 text-[10px] text-slate-600 font-mono text-center uppercase tracking-tighter">
                                RF-MODEL VERSION 1.0.4 - SECURE
                            </p>
                        </div>
                    </div>
                </div>
            ) : (
                /* Results View */
                <div className="space-y-6">
                    <div className={`relative overflow-hidden border-l-4 ${report.is_safe ? 'border-neon-green bg-neon-green/5' : 'border-yellow-500 bg-yellow-500/5'}`}>
                        <div className="relative z-10 p-8 flex items-start justify-between">
                            <div className="flex items-start gap-6">
                                <div className={`p-4 border-2 ${report.is_safe ? 'border-neon-green bg-neon-green/10' : 'border-yellow-500 bg-yellow-500/10'}`}>
                                    {report.is_safe ? <CheckCircle className="w-10 h-10 text-neon-green" /> : <AlertTriangle className="w-10 h-10 text-yellow-400" />}
                                </div>
                                <div>
                                    <h2 className="text-4xl font-bold text-white uppercase mb-2">
                                        {report.is_safe ? "Network Secure" : "Anomalies Found"}
                                    </h2>
                                    <div className="flex items-center gap-4">
                                        <span className="text-xs text-slate-500 font-mono uppercase">Grade:</span>
                                        <span className={`text-2xl font-bold ${getGradeColor(report.summary.grade)}`}>
                                            {report.summary.grade}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <button onClick={downloadPDF} className="px-6 py-3 bg-neon-green text-black font-bold text-xs uppercase flex items-center gap-2 hover:bg-neon-green/80 transition-all">
                                    <Download size={16} /> Export PDF Scorecard
                                </button>
                                <button onClick={reset} className="px-6 py-3 bg-black border border-slate-700 text-slate-300 font-bold text-xs uppercase hover:bg-slate-900 transition-all">
                                    <RefreshCw size={16} className="mr-2" /> New Scan
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <ResultCard label="Packets Scanned" val={report.summary.packets_scanned.toLocaleString()} color="blue" />
                        <ResultCard label="Threats Identified" val={report.summary.anomalies.toLocaleString()} color={report.summary.anomalies > 0 ? "yellow" : "emerald"} />
                        <ResultCard label="Security Rating" val={getThreatStats(report).securityRating} color="neon" />
                    </div>

                    {/* --- FILE TRAFFIC VISUALIZATION (Uploaded File Data Only) --- */}
                    {report.timeline && report.timeline.length > 0 && (
                        <div className="bg-black border border-slate-800 p-8 relative overflow-hidden">
                            <div className="absolute inset-0 opacity-10" style={{ 
                                backgroundImage: 'linear-gradient(#1e293b 1px, transparent 1px), linear-gradient(90deg, #1e293b 1px, transparent 1px)', 
                                backgroundSize: '40px 40px' 
                            }}></div>
                            
                            <div className="relative z-10">
                                <h3 className="text-xl font-bold text-white uppercase mb-6 flex items-center gap-3">
                                    <Activity className="text-neon-green" /> File Traffic Visualization
                                </h3>
                                <div className="h-64 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={report.timeline}>
                                            <defs>
                                                <linearGradient id="colorNormal" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#00ff88" stopOpacity={0.3}/>
                                                    <stop offset="95%" stopColor="#00ff88" stopOpacity={0}/>
                                                </linearGradient>
                                                <linearGradient id="colorThreat" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.5}/>
                                                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                            <XAxis dataKey="segment" stroke="#475569" tick={{fontSize: 10, fill: '#475569'}} />
                                            <YAxis hide />
                                            <Tooltip 
                                                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#fff', borderRadius: '8px' }}
                                                itemStyle={{ fontFamily: 'monospace', fontSize: '12px' }}
                                                labelStyle={{ color: '#94a3b8', fontSize: '10px', textTransform: 'uppercase' }}
                                            />
                                            <Area type="monotone" dataKey="normal" stackId="1" stroke="#00ff88" strokeWidth={2} fill="url(#colorNormal)" name="Normal Packets" />
                                            <Area type="monotone" dataKey="anomalies" stackId="2" stroke="#ef4444" strokeWidth={2} fill="url(#colorThreat)" name="Detected Anomalies" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                                <p className="mt-4 text-[10px] text-slate-600 font-mono text-center uppercase tracking-widest">
                                    Distribution of threat signatures across {report.summary.packets_scanned.toLocaleString()} scanned packets
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="bg-black border border-slate-800 p-8">
                        <h3 className="text-xl font-bold text-white uppercase mb-8 flex items-center gap-3">
                            <FileText className="text-neon-green" /> Safety Recommendations
                        </h3>
                        <div className="grid grid-cols-1 gap-4">
                            {report.recommendations.map((rec: string, i: number) => (
                                <div key={i} className="flex items-start gap-4 p-6 bg-slate-900/30 border-l-4 border-slate-700 hover:border-neon-green/50 transition-all group">
                                    <div className="w-8 h-8 flex items-center justify-center border border-slate-700 text-xs font-mono group-hover:text-neon-green">{i+1}</div>
                                    <p className="text-sm text-slate-400 pt-1 italic">{rec}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- SUB-COMPONENTS ---
const InfoCard = ({ icon, title, desc }: any) => (
    <div className="bg-black border border-slate-800 p-6 flex gap-3">
        <div className="p-2 border border-slate-700">{icon}</div>
        <div>
            <h4 className="text-sm font-bold text-white uppercase">{title}</h4>
            <p className="text-[10px] text-slate-500 font-mono">{desc}</p>
        </div>
    </div>
);

const DiagnosticBar = ({ label, percent }: any) => (
    <div>
        <div className="flex justify-between text-[9px] font-mono text-slate-500 mb-1 uppercase tracking-wider">
            <span>{label}</span>
            <span className="text-neon-green">{percent}</span>
        </div>
        <div className="h-1 w-full bg-slate-800">
            <div className="h-full bg-neon-green shadow-[0_0_8px_#00ff88]" style={{ width: percent }}></div>
        </div>
    </div>
);

const ResultCard = ({ label, val, color }: any) => {
    const colors: any = {
        blue: "text-blue-400 border-blue-500/20",
        yellow: "text-yellow-400 border-yellow-500/20",
        emerald: "text-emerald-400 border-emerald-500/20",
        neon: "text-neon-green border-neon-green/20"
    };
    return (
        <div className={`bg-black border p-6 hover:bg-slate-900/50 transition-all ${colors[color]}`}>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">{label}</p>
            <p className="text-4xl font-bold text-white">{val}</p>
        </div>
    );
};

export default Detection;