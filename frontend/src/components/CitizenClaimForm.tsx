import React, { useState } from 'react';
import axios from 'axios';
import { Send, FileText, CheckCircle, AlertTriangle, XCircle, Loader2, MapPin } from 'lucide-react';

interface ClaimStatus {
    id: string;
    status: string;
    conflictPercentage?: number;
}

interface CitizenClaimFormProps {
    drawnGeoJSON?: any;
    districtFilter?: string;
    onDistrictChange?: (district: string) => void;
}

const CitizenClaimForm: React.FC<CitizenClaimFormProps> = ({ drawnGeoJSON, districtFilter = "", onDistrictChange }) => {
    const [name, setName] = useState('');
    const [district, setDistrict] = useState(districtFilter);
    const [area, setArea] = useState('');

    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<ClaimStatus | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleDistrictInternal = (val: string) => {
        setDistrict(val);
        if (onDistrictChange) onDistrictChange(val);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const response = await axios.post('http://localhost:5000/api/simulation/claims/submit', {
                citizenName: name,
                district,
                areaRequested: Number(area),
                geojson: drawnGeoJSON // Include the spatially drawn shape if it exists
            });

            if (response.data.claim) {
                setResult({
                    id: response.data.claim.claimId,
                    status: response.data.claim.status,
                    conflictPercentage: response.data.claim.conflictPercentage
                });

                // Clear form on success
                setName('');
                setDistrict('');
                setArea('');
                if (onDistrictChange) onDistrictChange("");
            }
        } catch (err: any) {
            setError(err.response?.data?.error || "Error submitting claim.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 max-w-md mx-auto relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                <FileText className="w-24 h-24" />
            </div>

            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 mb-1 relative z-10">
                <Send className="w-5 h-5 text-indigo-600" />
                Citizen Claim Submission
            </h2>
            <p className="text-sm text-slate-500 mb-6 relative z-10">
                Submit a simulated land claim for verification. Use the Draw tool on the map to provide exact bounds for strict spatial validation.
            </p>

            {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-center gap-2 border border-red-100 relative z-10">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    {error}
                </div>
            )}

            {result && (
                <div className={`mb-6 p-4 rounded-lg border text-sm relative z-10 ${result.status === "Approved" ? "bg-emerald-50 text-emerald-800 border-emerald-100" :
                    result.status === "Flagged" ? "bg-orange-50 text-orange-800 border-orange-100" :
                        "bg-red-50 text-red-800 border-red-100"
                    }`}>
                    <div className="flex items-start gap-2">
                        {result.status === "Approved" ? <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" /> :
                            result.status === "Flagged" ? <AlertTriangle className="w-5 h-5 text-orange-600 shrink-0" /> :
                                <XCircle className="w-5 h-5 text-red-600 shrink-0" />}

                        <div className="flex-1">
                            <p className="font-bold text-base mb-1">Claim {result.id} is {result.status}</p>
                            {result.status === "Flagged" && (
                                <p className="mt-1 font-medium bg-white/50 inline-block px-2 py-1 rounded text-orange-900 border border-orange-200 shadow-sm">
                                    Conflict Severity: <span className="font-bold text-red-600">{result.conflictPercentage}%</span> Severity
                                </p>
                            )}
                            {result.status === "Approved" && (
                                <p>Requested area does not overlap and is within the district's limits.</p>
                            )}
                            {result.status === "Rejected" && (
                                <p>This claim was rejected by a district administrator.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4 relative z-10">

                <div className="flex flex-col gap-1.5 mb-2">
                    <label className="text-sm font-semibold text-slate-700">Spatial Geometry</label>
                    {drawnGeoJSON ? (
                        <div className="flex items-center justify-between bg-emerald-50 text-emerald-700 px-3 py-2 rounded-lg border border-emerald-200 text-sm font-medium">
                            <div className="flex items-center gap-2"><MapPin className="w-4 h-4" /> Polygon Captured</div>
                            <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('activate-draw'))} className="text-xs underline hover:text-emerald-900">Redraw</button>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => window.dispatchEvent(new CustomEvent('activate-draw'))}
                            className="w-full flex items-center justify-center gap-2 py-2 border-2 border-dashed border-slate-300 rounded-lg text-slate-600 bg-slate-50 hover:bg-slate-100 hover:border-slate-400 transition-colors text-sm font-medium"
                        >
                            <MapPin className="w-4 h-4" /> Click to Draw Boundary on Map
                        </button>
                    )}
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-semibold text-slate-700">Citizen Full Name</label>
                    <input
                        required
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="E.g. Ramesh Kumar"
                        className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder:text-slate-400"
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-semibold text-slate-700">District Region</label>
                    <select
                        required
                        value={district}
                        onChange={(e) => handleDistrictInternal(e.target.value)}
                        className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                    >
                        <option value="" disabled>Select a district...</option>
                        <option value="Kandhamal">Kandhamal</option>
                        <option value="Bastar">Bastar</option>
                        <option value="Mandla">Mandla</option>
                        <option value="Gadchiroli">Gadchiroli</option>
                        <option value="Sundargarh">Sundargarh</option>
                        <option value="Koraput">Koraput</option>
                    </select>
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-semibold text-slate-700">Area Requested (Acres)</label>
                    <input
                        required
                        type="number"
                        min="1"
                        max="2000"
                        value={area}
                        onChange={(e) => setArea(e.target.value)}
                        placeholder="E.g. 150 (Auto-calculated if polygon drawn)"
                        className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder:text-slate-400"
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading || !name || !district || !area}
                    className="mt-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Submit Claim for Verification"}
                </button>
            </form>
        </div>
    );
};

export default CitizenClaimForm;
