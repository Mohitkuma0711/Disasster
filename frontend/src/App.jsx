import React, { useState, useEffect } from 'react';
import MapView from './components/MapView';
import PriorityQueue from './components/PriorityQueue';
import ReportForm from './components/ReportForm';
import AnalyticsCharts from './components/AnalyticsCharts';
import { Shield, Radio, Activity, RefreshCw, AlertOctagon, Cpu, Database } from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';

// Initial realistic demo dataset for evidence board presentation
const INITIAL_DEMO_VICTIMS = [
  {
    id: 'V-1001',
    track_id: 1,
    lat: 28.6139,
    lng: 77.2090,
    confidence: 0.95,
    is_inactive: true,
    priority_score: 93.3,
    status: 'unhandled',
    description: 'Trapped beneath collapsed structural debris near main intersection. High priority.',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'V-1002',
    track_id: 2,
    lat: 28.6180,
    lng: 77.2150,
    confidence: 0.88,
    is_inactive: true,
    priority_score: 84.5,
    status: 'unhandled',
    description: 'Immobilized individual detected by aerial drone thermal feed.',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'V-1003',
    track_id: 3,
    lat: 28.6110,
    lng: 77.2020,
    confidence: 0.76,
    is_inactive: false,
    priority_score: 56.2,
    status: 'unhandled',
    description: 'Moving victim signaling towards search party.',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'V-1004',
    track_id: 4,
    lat: 28.6250,
    lng: 77.2210,
    confidence: 0.91,
    is_inactive: true,
    priority_score: 72.8,
    status: 'unhandled',
    description: 'Stationary target near flooded perimeter zone.',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'V-1005',
    track_id: 5,
    lat: 28.6050,
    lng: 77.1950,
    confidence: 0.65,
    is_inactive: false,
    priority_score: 38.4,
    status: 'rescued',
    description: 'Evacuated by Sector 4 medical response team.',
    createdAt: new Date().toISOString(),
  },
];

export default function App() {
  const [victims, setVictims] = useState(INITIAL_DEMO_VICTIMS);
  const [selectedVictim, setSelectedVictim] = useState(null);
  const [activeTab, setActiveTab] = useState('board');
  const [wsConnected, setWsConnected] = useState(true);

  // Firestore real-time listener
  useEffect(() => {
    let unsubscribe = () => {};
    try {
      const victimsRef = collection(db, 'victims');
      unsubscribe = onSnapshot(victimsRef, (snapshot) => {
        if (!snapshot.empty) {
          const docs = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setVictims(docs);
        }
      }, (err) => {
        console.warn("Firestore snapshot fallback to demo dataset:", err);
      });
    } catch (e) {
      console.warn("Firebase offline or not configured:", e);
    }
    return () => unsubscribe();
  }, []);

  // Handle new report submission
  const handleReportSubmitted = (newVictim) => {
    setVictims(prev => [newVictim, ...prev]);
  };

  return (
    <div className="min-h-screen bg-[#070a10] text-amber-100 font-mono pb-12">
      {/* Top Tactical Command Header */}
      <header className="bg-slate-950/95 border-b border-amber-900/50 sticky top-0 z-[2000] backdrop-blur px-4 py-3 shadow-2xl">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          
          {/* Title & Classification Banner */}
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-amber-950/80 border border-amber-600/50 rounded-lg shadow-lg">
              <Shield className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-bold font-typewriter tracking-wider text-amber-300 uppercase">
                  DISASTER VICTIM DETECTION
                </h1>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-red-950 text-red-400 border border-red-800/80 rounded uppercase">
                  CLASSIFIED // EVIDENTIAL
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Incident Command Center & Automated Triage Intelligence System
              </p>
            </div>
          </div>

          {/* Live System Status Badges */}
          <div className="flex items-center space-x-4 text-xs">
            {/* Live Feed Status */}
            <div className="flex items-center space-x-2 bg-slate-900/80 px-3 py-1.5 rounded border border-slate-800">
              <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
              <span className="text-slate-300">WEBSOCKET:</span>
              <span className="text-emerald-400 font-bold">ONLINE</span>
            </div>

            {/* YOLOv8 + ByteTrack Status */}
            <div className="flex items-center space-x-2 bg-slate-900/80 px-3 py-1.5 rounded border border-slate-800">
              <Cpu className="w-4 h-4 text-amber-400" />
              <span className="text-slate-300">YOLOv8 + ByteTrack:</span>
              <span className="text-amber-400 font-bold">ACTIVE</span>
            </div>

            {/* Database Status */}
            <div className="flex items-center space-x-2 bg-slate-900/80 px-3 py-1.5 rounded border border-slate-800">
              <Database className="w-4 h-4 text-cyan-400" />
              <span className="text-slate-300">FIRESTORE:</span>
              <span className="text-cyan-400 font-bold">SYNCED</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 mt-6 space-y-6">
        
        {/* Top Row: Map & Report Form */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <MapView victims={victims} onSelectVictim={setSelectedVictim} />
          </div>
          <div>
            <ReportForm onReportSubmitted={handleReportSubmitted} />
          </div>
        </div>

        {/* Analytics Charts */}
        <AnalyticsCharts victims={victims} />

        {/* Priority Queue Log Table */}
        <PriorityQueue victims={victims} onVictimSelect={setSelectedVictim} />
      </main>
    </div>
  );
}
