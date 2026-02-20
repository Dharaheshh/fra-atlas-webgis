import { useState } from 'react';
import MapComponent from './components/MapComponent';
import DashboardPanel from './components/DashboardPanel';
import SimulationPanel from './components/SimulationPanel';
import { LayoutDashboard, Layers } from 'lucide-react';

function App() {
    const [showDashboard, setShowDashboard] = useState(true);
    const [showSimulation, setShowSimulation] = useState(false);

    // Phase 6 Shared Spatial State
    const [drawnPoly, setDrawnPoly] = useState<any>(null);
    const [activeSimDistrict, setActiveSimDistrict] = useState<string>("Kandhamal");

    return (
        <div className="h-screen w-full flex flex-col bg-slate-50 overflow-hidden relative">
            <header className="bg-emerald-800 text-white p-4 shadow-md z-[1001] flex justify-between items-center relative shrink-0">
                <div>
                    <h1 className="text-xl font-bold tracking-tight">FRA WebGIS Decision Support System</h1>
                    <p className="text-emerald-200 text-xs mt-1">Forest Rights Act Monitoring</p>
                </div>
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setShowSimulation(true)}
                        className="hidden sm:flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-lg border border-indigo-400 font-semibold shadow-sm transition-all text-sm"
                    >
                        <Layers className="w-4 h-4" /> Governance Conflict Engine
                    </button>

                    <div className="hidden md:block text-emerald-100 text-sm font-medium bg-emerald-900/50 px-3 py-1 rounded-full border border-emerald-700">
                        Governance Dashboard Early Preview
                    </div>

                    <button
                        onClick={() => setShowDashboard(!showDashboard)}
                        className={`p-2 rounded-md transition-colors ${showDashboard ? 'bg-emerald-700 hover:bg-emerald-600 text-white' : 'bg-white hover:bg-emerald-50 text-emerald-800'}`}
                        title="Toggle Analytics Dashboard"
                    >
                        <LayoutDashboard className="w-5 h-5" />
                    </button>
                </div>
            </header>

            <main className="flex-1 flex w-full relative h-[calc(100vh-76px)] overflow-hidden">
                <MapComponent
                    isSimulationMode={showSimulation}
                    onSimulationShapeDrawn={(geo) => setDrawnPoly(geo)}
                    simulationActiveDistrict={activeSimDistrict}
                />

                {/* Dashboard Slide-in Overlay */}
                <div className={`absolute top-0 right-0 h-full transition-transform duration-300 ease-in-out shadow-2xl z-[1000] border-l border-slate-200 bg-white ${showDashboard ? 'translate-x-0' : 'translate-x-full'}`}>
                    <DashboardPanel />
                </div>

                {/* Phase 6 Isloated Simulation Overlay */}
                <SimulationPanel
                    isOpen={showSimulation}
                    onClose={() => setShowSimulation(false)}
                    drawnGeoJSON={drawnPoly}
                    districtFilter={activeSimDistrict}
                    onDistrictChange={(d) => setActiveSimDistrict(d)}
                />
            </main>
        </div>
    );
}

export default App;
