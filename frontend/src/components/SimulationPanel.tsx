import React, { useState } from 'react';
import { X, Users, Shield } from 'lucide-react';
import CitizenClaimForm from './CitizenClaimForm';
import AdminReviewPanel from './AdminReviewPanel';

interface SimulationPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

const SimulationPanel: React.FC<SimulationPanelProps> = ({ isOpen, onClose }) => {
    // Role Toggle State
    const [role, setRole] = useState<'citizen' | 'admin'>('citizen');

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
                    <div className="flex items-center gap-3">
                        <div className="bg-indigo-100 p-2 rounded-lg">
                            <Layers className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-800 tracking-tight">System Simulation Layer</h2>
                            <p className="text-xs text-slate-500 font-medium uppercase tracking-widest">Phase 5 Extension</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Role Toggle */}
                        <div className="flex bg-slate-200 p-1 rounded-lg">
                            <button
                                onClick={() => setRole('citizen')}
                                className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${role === 'citizen' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                <Users className="w-4 h-4" /> Citizen Portal
                            </button>
                            <button
                                onClick={() => setRole('admin')}
                                className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${role === 'admin' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                <Shield className="w-4 h-4" /> Admin Console
                            </button>
                        </div>

                        <div className="w-px h-8 bg-slate-200 mx-1"></div>

                        <button
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 rounded-full transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto bg-slate-50/50 p-6">
                    {role === 'citizen' ? (
                        <div className="animate-in slide-in-from-bottom-4 duration-300">
                            <CitizenClaimForm />
                        </div>
                    ) : (
                        <div className="animate-in slide-in-from-bottom-4 duration-300">
                            <AdminReviewPanel />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// Lucide icon import needed locally
import { Layers } from 'lucide-react';

export default SimulationPanel;
