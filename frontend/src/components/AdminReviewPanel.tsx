import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { ShieldCheck, AlertTriangle, Check, X, RefreshCw, Layers } from 'lucide-react';

interface SimulatedClaim {
    claimId: string;
    citizenName: string;
    district: string;
    areaRequested: number;
    status: "Submitted" | "Approved" | "Flagged" | "Rejected";
    conflictPercentage: number;
    timestamp: string;
}

const AdminReviewPanel: React.FC = () => {
    const [claims, setClaims] = useState<SimulatedClaim[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const fetchClaims = async () => {
        setLoading(true);
        try {
            const res = await axios.get('http://localhost:5000/api/simulation/claims');
            // Sort by flagged first, then descending time
            const sorted = res.data.sort((a: SimulatedClaim, b: SimulatedClaim) => {
                if (a.status === "Flagged" && b.status !== "Flagged") return -1;
                if (a.status !== "Flagged" && b.status === "Flagged") return 1;
                return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
            });
            setClaims(sorted);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchClaims();
    }, []);

    const handleReview = async (id: string, newStatus: "Approved" | "Rejected") => {
        setActionLoading(id);
        try {
            await axios.patch(`http://localhost:5000/api/simulation/claims/${id}/review`, {
                status: newStatus
            });
            // Refresh list
            fetchClaims();
        } catch (err) {
            console.error("Error updating claim:", err);
            alert("Failed to update claim status.");
        } finally {
            setActionLoading(null);
        }
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden max-w-2xl mx-auto flex flex-col h-[500px]">
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between sticky top-0 z-10">
                <div>
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-indigo-600" />
                        Admin Compliance Review
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">Resolve flagged claims and monitor overrides.</p>
                </div>
                <button
                    onClick={fetchClaims}
                    className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
                    title="Refresh List"
                >
                    <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            <div className="p-0 flex-1 overflow-y-auto bg-slate-50/30">
                {claims.length === 0 && !loading ? (
                    <div className="flex flex-col items-center justify-center p-12 text-center h-full">
                        <Layers className="w-12 h-12 text-slate-200 mb-3" />
                        <h3 className="text-slate-500 font-semibold mb-1">No Simulated Claims Yet</h3>
                        <p className="text-sm text-slate-400">Use the citizen form to generate data.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100 p-4 flex flex-col gap-3">
                        {claims.map((claim) => (
                            <div
                                key={claim.claimId}
                                className={`p-4 rounded-xl border shadow-sm transition-all bg-white
                                    ${claim.status === "Flagged" ? "border-orange-200 ring-1 ring-orange-100" : "border-slate-200"}
                                `}
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-bold text-slate-800 tracking-tight">{claim.claimId}</span>
                                            <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider
                                                ${claim.status === "Approved" ? "bg-emerald-100 text-emerald-700" :
                                                    claim.status === "Flagged" ? "bg-orange-100 text-orange-700 animate-pulse" :
                                                        claim.status === "Rejected" ? "bg-red-100 text-red-700" :
                                                            "bg-slate-100 text-slate-700"
                                                }
                                            `}>
                                                {claim.status}
                                            </span>
                                        </div>
                                        <p className="text-sm text-slate-600 font-medium">{claim.citizenName} • {claim.district}</p>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm font-bold text-slate-700">{claim.areaRequested} Acres</div>
                                        <div className="text-[10px] text-slate-400 uppercase tracking-widest mt-0.5">Requested</div>
                                    </div>
                                </div>

                                {claim.status === "Flagged" && (
                                    <div className="mt-3 mb-4 p-3 rounded-lg bg-orange-50 border border-orange-100 flex items-start gap-2">
                                        <AlertTriangle className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-sm font-semibold text-orange-800 mb-0.5">Land Availability Conflict</p>
                                            <p className="text-xs text-orange-700/80">
                                                This claim exceeds the {claim.district} district limit by <span className="font-bold text-red-600">{claim.conflictPercentage}%</span>. Admin override required.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                <div className="flex gap-2 justify-end border-t border-slate-100 pt-3 mt-1">
                                    {(claim.status === "Flagged" || claim.status === "Submitted") && (
                                        <>
                                            <button
                                                onClick={() => handleReview(claim.claimId, "Rejected")}
                                                disabled={actionLoading === claim.claimId}
                                                className="px-3 py-1.5 rounded-lg text-sm font-semibold border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                                            >
                                                <X className="w-4 h-4" /> Reject
                                            </button>
                                            <button
                                                onClick={() => handleReview(claim.claimId, "Approved")}
                                                disabled={actionLoading === claim.claimId}
                                                className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-sm flex items-center gap-1.5"
                                            >
                                                <Check className="w-4 h-4" /> Approve Override
                                            </button>
                                        </>
                                    )}
                                    {(claim.status === "Approved" || claim.status === "Rejected") && (
                                        <div className="text-xs text-slate-400 font-medium px-2 py-1 flex items-center gap-1">
                                            <Check className="w-3 h-3" /> Resolved
                                        </div>
                                    )}
                                </div>

                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminReviewPanel;
