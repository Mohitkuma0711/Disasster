import ChatbotWidget from './components/ChatbotWidget';
import React, { useState, useEffect } from 'react';
import MapView from './components/MapView';
import PriorityQueue from './components/PriorityQueue';
import ReportForm from './components/ReportForm';
import AnalyticsCharts from './components/AnalyticsCharts';
import ClimateRiskModule from './components/ClimateRiskModule';
import VideoThreatAnalysis from './components/VideoThreatAnalysis';
import PhotoLocationPage from './components/PhotoLocationPage';
import { Shield, Radio, Cpu, Database, MapPin, Globe as GlobeIcon, Film, Camera, Activity, Radar, AlertTriangle, Zap, Sun, Moon } from 'lucide-react';

const LOCAL_VICTIMS_KEY = 'disaster-rescue-project:victims';

const missionPills = [
  { label: 'Live telemetry', value: '12 nodes online', icon: Radar },
  { label: 'Threat signal', value: 'Elevated', icon: AlertTriangle },
  { label: 'Response tempo', value: '92% readiness', icon: Activity },
  { label: 'Grid uptime', value: '99.4%', icon: Zap },
];

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
  const [victims, setVictims] = useState(() => {
    try {
      const savedVictims = localStorage.getItem(LOCAL_VICTIMS_KEY);
      return savedVictims ? JSON.parse(savedVictims) : INITIAL_DEMO_VICTIMS;
    } catch {
      return INITIAL_DEMO_VICTIMS;
    }
  });
  const [selectedVictim, setSelectedVictim] = useState(null);
  const [currentModule, setCurrentModule] = useState('victim-triage'); // 'victim-triage', 'photo-location', 'climate-risk', or 'video-analysis'
  const [currentUtcTime, setCurrentUtcTime] = useState(() => new Date());
  const [theme, setTheme] = useState(() => {
    try {
      const savedTheme = localStorage.getItem('disaster-theme');
      return savedTheme || 'night';
    } catch {
      return 'night';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_VICTIMS_KEY, JSON.stringify(victims));
    } catch {
      // The queue continues to work for the current session if storage is unavailable.
    }
  }, [victims]);

  useEffect(() => {
    try {
      localStorage.setItem('disaster-theme', theme);
    } catch {
      // Ignore storage issues for non-persistent environments.
    }
  }, [theme]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentUtcTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleReportSubmitted = (newVictim) => {
    setVictims(prev => [newVictim, ...prev]);
  };

  const handleVictimRescued = (victimId, rescuedAt) => {
    setVictims(prev => prev.map(victim => (
      victim.id === victimId
        ? { ...victim, status: 'rescued', rescuedAt }
        : victim
    )));
    setSelectedVictim(prev => (
      prev?.id === victimId
        ? { ...prev, status: 'rescued', rescuedAt }
        : prev
    ));
  };

  return (
    <div className={`app-shell min-h-screen pb-12 ${theme === 'day' ? 'theme-day' : 'theme-night'}`}>
      <header className="topbar">
        <div className="max-w-7xl mx-auto flex flex-col xl:flex-row xl:items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="badge-mark" aria-label="Status badge">
              <Shield className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="hero-title">Obsidian Command</h1>
                <span className="status-pill">SIH // EVIDENTIAL COMMAND</span>
              </div>
              <p className="hero-subtitle">
                Incident command center for triage, photo intelligence, climate risk, and rapid field assessment.
              </p>
            </div>
          </div>

          <div className="nav-panel">
            <button
              onClick={() => setCurrentModule('victim-triage')}
              className={`nav-tab ${currentModule === 'victim-triage' ? 'is-active' : ''}`}
            >
              <MapPin className="w-4 h-4" />
              <span>Overview</span>
            </button>

            <button
              onClick={() => setCurrentModule('photo-location')}
              className={`nav-tab ${currentModule === 'photo-location' ? 'is-active' : ''}`}
            >
              <Camera className="w-4 h-4" />
              <span>Location</span>
            </button>

            <button
              onClick={() => setCurrentModule('video-analysis')}
              className={`nav-tab ${currentModule === 'video-analysis' ? 'is-active' : ''}`}
            >
              <Film className="w-4 h-4" />
              <span>Video</span>
            </button>

            <button
              onClick={() => setCurrentModule('climate-risk')}
              className={`nav-tab ${currentModule === 'climate-risk' ? 'is-active' : ''}`}
            >
              <GlobeIcon className="w-4 h-4" />
              <span>Climate</span>
            </button>

            <button
              type="button"
              onClick={() => setTheme(theme === 'night' ? 'day' : 'night')}
              className="theme-toggle"
              aria-label="Toggle day and night mode"
              title={theme === 'night' ? 'Switch to day mode' : 'Switch to night mode'}
            >
              {theme === 'night' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              <span>{theme === 'night' ? 'Day' : 'Night'}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 mt-8 space-y-6">
        {currentModule === 'victim-triage' && (
          <>
            <section className="hero-panel glass-panel">
              <div className="hero-copy">
                <div className="eyebrow">Mission overview</div>
                <h2>Field intelligence engine</h2>
                <p>
                  Real-time victim detection, field reporting, and priority triage for damaged areas, flood zones, and emergency response corridors.
                </p>
              </div>

              <div className="mission-strip">
                {missionPills.map(({ label, value, icon: Icon }) => (
                  <div key={label} className="mission-pill">
                    <div className="pill-icon"><Icon className="w-4 h-4" /></div>
                    <div>
                      <span>{label}</span>
                      <strong>{value}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="overview-grid">
              <div className="glass-panel overview-panel overview-panel-large">
                <div className="eyebrow">Live analytics</div>
                <div className="stat-grid">
                  <div className="stat-card">
                    <span className="stat-label">Active alerts</span>
                    <strong>{victims.filter(v => v.status !== 'rescued').length}</strong>
                  </div>
                  <div className="stat-card">
                    <span className="stat-label">Priority queue</span>
                    <strong>{Math.max(...victims.map(v => Number(v.priority_score || 0)), 0).toFixed(1)}</strong>
                  </div>
                  <div className="stat-card">
                    <span className="stat-label">Response tempo</span>
                    <strong>92%</strong>
                  </div>
                </div>
              </div>

              <div className="glass-panel overview-panel">
                <div className="eyebrow">Command pulse</div>
                <div className="mini-list">
                  <div>
                    <span className="mini-label">Triage state</span>
                    <strong>Operational</strong>
                  </div>
                  <div>
                    <span className="mini-label">Response grid</span>
                    <strong>Sector 7</strong>
                  </div>
                  <div>
                    <span className="mini-label">Last sync</span>
                    <strong>{currentUtcTime.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false })} IST</strong>
                  </div>
                </div>
              </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <MapView victims={victims} onSelectVictim={setSelectedVictim} theme={theme} />
              </div>
              <div>
                <ReportForm onReportSubmitted={handleReportSubmitted} />
              </div>
            </div>

            <AnalyticsCharts victims={victims} />

            <PriorityQueue
              victims={victims}
              onVictimSelect={setSelectedVictim}
              onVictimRescued={handleVictimRescued}
            />
          </>
        )}

        {currentModule === 'photo-location' && <PhotoLocationPage />}

        {currentModule === 'video-analysis' && <VideoThreatAnalysis />}

        {currentModule === 'climate-risk' && <ClimateRiskModule />}

        <ChatbotWidget victims={victims} />
      </main>
    </div>
  );
}
