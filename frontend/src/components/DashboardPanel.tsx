import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { AlertTriangle, CheckCircle, Clock, ShieldAlert, Activity, Sparkles, FileText, Loader2 } from 'lucide-react';


interface AnalyticsData {
    summary: {
        total_claims: number;
        approved_claims: number;
        pending_claims: number;
        conflict_claims: number;
        approved_pct: number;
        pending_pct: number;
    };
    districts: {
        district: string;
        total_claims: number;
        pending: number;
        conflicts: number;
        risk_score: number;
        risk_level: string;
    }[];
}

const COLORS = ['#22c55e', '#eab308', '#ef4444'];

const DashboardPanel: React.FC = () => {
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);

    // AI Report State
    const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
    const [generatingReport, setGeneratingReport] = useState(false);
    const [reportText, setReportText] = useState<string | null>(null);
    const [reportError, setReportError] = useState<string | null>(null);

    // Phase 6 Spatial Alert State
    const [spatialAlert, setSpatialAlert] = useState<{ active: boolean; district: string; severity: number; id: string } | null>(null);
    const alertedClaimIdRef = useRef<string | null>(null);

    const fetchAnalytics = () => {
        axios.get('http://localhost:5000/api/simulation/analytics')
            .then(response => {
                setData(response.data);
                setLoading(false);
            })
            .catch(error => {
                console.error("Error fetching analytics data:", error);
                setLoading(false);
            });
    };

    const checkSpatialConflicts = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/simulation/claims');
            const claims = res.data;

            // Find any claim with > 10% severity
            const highConflictClaim = claims.find((c: any) => c.status === "Flagged" && c.conflictPercentage > 10);

            if (highConflictClaim) {
                if (alertedClaimIdRef.current !== highConflictClaim.claimId) {
                    alertedClaimIdRef.current = highConflictClaim.claimId;

                    // Just update the UI badge/alert to inform the admin
                    setSpatialAlert({
                        active: true,
                        district: highConflictClaim.district,
                        severity: highConflictClaim.conflictPercentage,
                        id: highConflictClaim.claimId
                    });
                }
            } else {
                alertedClaimIdRef.current = null;
                setSpatialAlert(null);
            }
        } catch (e) { /* ignore silently in polling */ }
    }

    useEffect(() => {
        fetchAnalytics();
        checkSpatialConflicts();

        // Poll every 3 seconds for live updates
        const interval = setInterval(() => {
            fetchAnalytics();
            checkSpatialConflicts();
        }, 3000);

        return () => clearInterval(interval);
    }, []);

    const handleGenerateReport = (district: string) => {
        setGeneratingReport(true);
        setReportError(null);
        setReportText(null);

        axios.get(`http://localhost:5000/api/report/${district}`)
            .then(response => {
                if (response.data.error) {
                    setReportError(response.data.error);
                } else {
                    setReportText(response.data.reportText);
                }
            })
            .catch(err => {
                setReportError(err.response?.data?.error || "Failed to connect to the AI Engine.");
            })
            .finally(() => {
                setGeneratingReport(false);
            });
    };

    if (loading || !data) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-white border-l border-slate-200">
                <div className="flex flex-col items-center text-slate-400">
                    <Activity className="w-8 h-8 animate-spin mb-2" />
                    <p>Loading Analytics Engine...</p>
                </div>
            </div>
        );
    }

    const pieData = [
        { name: 'Approved', value: data.summary.approved_claims },
        { name: 'Pending', value: data.summary.pending_claims },
        { name: 'Conflict / Protected', value: data.summary.conflict_claims },
    ];

    return (
        <div className="w-[400px] sm:w-[500px] h-full bg-white border-l border-slate-200 shadow-xl overflow-y-auto flex flex-col z-[1000] relative scrollbar-thin scrollbar-thumb-slate-200">
            <div className="p-5 border-b border-slate-100 bg-slate-50 sticky top-0 z-10 hidden sm:block">
                <h2 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-emerald-600" />
                    Governance Analytics
                </h2>
                <p className="text-sm text-slate-500 mt-1">Real-time FRA implementation metrics</p>
            </div>

            <div className="p-5 flex-1 flex flex-col gap-6">

                <div className="p-5 flex-1 flex flex-col gap-6">

                    {/* Phase 6 Spatial Conflict Auto-Trigger Alert */}
                    {spatialAlert && spatialAlert.active && (
                        <div className="bg-red-600 text-white p-4 rounded-xl shadow-lg border border-red-700 animate-in slide-in-from-top-4 relative overflow-hidden flex items-center gap-3">
                            <div className="absolute top-0 right-0 p-2 opacity-10">
                                <AlertTriangle className="w-24 h-24" />
                            </div>
                            <AlertTriangle className="w-8 h-8 shrink-0 animate-pulse text-red-200" />
                            <div>
                                <h3 className="font-bold text-lg uppercase tracking-wider mb-0.5">High Spatial Conflict Detected</h3>
                                <p className="text-sm font-medium text-red-100">
                                    Overlap Severity: <span className="text-white font-bold bg-red-800/50 px-1.5 py-0.5 rounded">{spatialAlert.severity}%</span> in {spatialAlert.district}
                                </p>
                                <p className="text-xs text-red-200 mt-1 flex items-center gap-1">
                                    <Sparkles className="w-3 h-3" /> Auto-triggering AI governance review...
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Top KPI Cards */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 shadow-sm transition-all hover:shadow-md">
                            <div className="flex items-center gap-2 text-slate-500 mb-2">
                                <CheckCircle className="w-4 h-4 text-emerald-500" />
                                <span className="text-xs font-semibold uppercase tracking-wider">Total Claims</span>
                            </div>
                            <div className="text-3xl font-bold text-slate-800">{data.summary.total_claims}</div>
                        </div>

                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 shadow-sm transition-all hover:shadow-md">
                            <div className="flex items-center gap-2 text-slate-500 mb-2">
                                <ShieldAlert className="w-4 h-4 text-red-500" />
                                <span className="text-xs font-semibold uppercase tracking-wider">Conflicts</span>
                            </div>
                            <div className="text-3xl font-bold text-red-600">{data.summary.conflict_claims}</div>
                        </div>

                        <div className="col-span-2 bg-gradient-to-r from-yellow-50 to-orange-50 p-4 rounded-xl border border-yellow-100 flex items-center justify-between shadow-sm transition-all hover:shadow-md">
                            <div>
                                <div className="flex items-center gap-2 text-yellow-700 mb-1">
                                    <Clock className="w-4 h-4 text-yellow-600" />
                                    <span className="text-xs font-semibold uppercase tracking-wider">Pending Verification</span>
                                </div>
                                <div className="text-2xl font-bold text-yellow-800">{data.summary.pending_pct}%</div>
                            </div>
                            <div className="text-right text-yellow-700 text-sm opacity-80 font-medium">
                                {data.summary.pending_claims} total cases
                            </div>
                        </div>
                    </div>

                    {/* Charts Section */}
                    <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm hover:shadow-md transition-shadow">
                        <h3 className="text-sm font-semibold text-slate-700 mb-4 uppercase tracking-wider flex items-center gap-2">
                            Status Distribution
                        </h3>
                        <div className="h-[200px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {pieData.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                                        itemStyle={{ fontWeight: 'bold' }}
                                    />
                                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Risk Ranking Table */}
                    <div className="bg-white rounded-xl border border-slate-100 p-0 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-orange-500" />
                                Region Risk Ranking
                            </h3>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50/50 text-slate-500 border-b border-slate-100">
                                    <tr>
                                        <th className="px-4 py-3 font-medium">District</th>
                                        <th className="px-4 py-3 font-medium text-right">Score</th>
                                        <th className="px-4 py-3 font-medium text-center">Risk Level</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {data.districts.map((district, idx) => (
                                        <tr
                                            key={idx}
                                            onClick={() => setSelectedDistrict(district.district)}
                                            className={`transition-colors cursor-pointer ${selectedDistrict === district.district ? 'bg-indigo-50/80 hover:bg-indigo-100/80 border-l-2 border-l-indigo-500' : 'hover:bg-slate-50 border-l-2 border-l-transparent'}`}
                                            title={`Click to generate AI report for ${district.district}`}
                                        >
                                            <td className="px-4 py-3 font-medium text-slate-700 flex items-center gap-2">
                                                {district.district}
                                                {selectedDistrict === district.district && <Sparkles className="w-3 h-3 text-indigo-500 animate-pulse" />}
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono text-slate-500">{district.risk_score}</td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider font-bold leading-none inline-flex 
                        ${district.risk_level === 'High' ? 'bg-red-100 text-red-700 ring-1 ring-red-200' :
                                                        district.risk_level === 'Moderate' ? 'bg-orange-100 text-orange-700 ring-1 ring-orange-200' :
                                                            'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200'}`}>
                                                    {district.risk_level}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* AI Compliance Report Generator */}
                    <div className="mt-1 mb-6 bg-gradient-to-br from-indigo-50 via-white to-purple-50 rounded-xl border border-indigo-100 p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
                        {/* Subtle background decoration */}
                        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                            <Sparkles className="w-24 h-24" />
                        </div>

                        <h3 className="text-sm font-bold text-indigo-900 mb-3 uppercase tracking-wider flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-purple-500" />
                            AI Compliance Engine
                        </h3>

                        {!selectedDistrict ? (
                            <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-indigo-100 rounded-lg bg-white/40">
                                <FileText className="w-8 h-8 text-indigo-200 mb-2" />
                                <p className="text-sm text-indigo-500 text-center font-medium">
                                    Select a district from the risk table above<br />to generate a compliance summary.
                                </p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-4 relative z-10">
                                <div className="flex items-center justify-between bg-white/60 p-3 rounded-lg border border-indigo-50">
                                    <span className="text-sm font-medium text-indigo-900 flex items-center gap-2">
                                        Target Region: <strong className="text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded">{selectedDistrict}</strong>
                                    </span>
                                    <button
                                        onClick={() => handleGenerateReport(selectedDistrict)}
                                        disabled={generatingReport}
                                        className="bg-indigo-600 hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-100 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm active:scale-95"
                                    >
                                        {generatingReport ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                                        Generate Report
                                    </button>
                                </div>

                                {/* Report Output Box */}
                                {(reportText || reportError) && (
                                    <div className="mt-2 bg-white rounded-lg p-5 border border-indigo-100 shadow-sm text-sm 
                                animate-in fade-in slide-in-from-bottom-2 duration-500 relative">
                                        {reportError ? (
                                            <div className="flex items-start gap-2 text-red-600 bg-red-50 p-3 rounded-md border border-red-100">
                                                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                                                <p className="font-medium">{reportError}</p>
                                            </div>
                                        ) : (
                                            <div className="prose prose-sm prose-indigo max-w-none 
                                    prose-p:leading-relaxed prose-p:text-slate-600 
                                    prose-headings:font-bold prose-headings:text-slate-800
                                    prose-strong:text-indigo-800
                                    prose-li:text-slate-600 marker:text-indigo-400">
                                                <div className="whitespace-pre-wrap">{reportText || ""}</div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardPanel;
