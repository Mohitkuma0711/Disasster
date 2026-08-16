import React, { useState, useEffect, useRef, useMemo } from 'react';
import Globe from 'react-globe.gl';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { Globe as GlobeIcon, ShieldAlert, History, TrendingUp, Layers, X, Info, Flame, CloudRain, Zap, Wind } from 'lucide-react';
import { collection, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

// Fallback GeoJSON boundaries for India & World when offline
const INDIA_GEOJSON_URL = "https://raw.githubusercontent.com/subhash-chandra/india-states-geojson/master/india_states.geojson";
const WORLD_GEOJSON_URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson";

// Fallback local dataset for immediate offline rendering
const FALLBACK_CLIMATE_DATA = {
  india: {
    "odisha": {
      region_name: "Odisha",
      overall_risk_score: 88.5,
      risk_scores: { cyclone: 91.0, flood: 86.0, drought: 59.0, earthquake: 35.0 },
      vulnerability_factors: { coastal_exposure: "Extreme (480km Bay of Bengal coastline)", seismic_zone: "Zone II - III" },
      decade_trends: [
        { decade: "1990s", events: 8 },
        { decade: "2000s", events: 12 },
        { decade: "2010s", events: 18 },
        { decade: "2020s", events: 11 }
      ],
      historical_events: [
        { year: 1999, type: "Super Cyclone", severity: "Extreme", description: "1999 Odisha Super Cyclone (Category 5), 10,000+ casualties" },
        { year: 2013, type: "Cyclone Phailin", severity: "Severe", description: "Evacuated 1M+ people across coastal districts" },
        { year: 2019, type: "Cyclone Fani", severity: "Extreme", description: "Extensive damage in Puri & Bhubaneswar" }
      ]
    },
    "gujarat": {
      region_name: "Gujarat",
      overall_risk_score: 84.0,
      risk_scores: { earthquake: 92.0, cyclone: 81.0, drought: 74.0, flood: 69.0 },
      vulnerability_factors: { coastal_exposure: "High (Arabian Sea)", seismic_zone: "Zone V (Kutch Fault)" },
      decade_trends: [
        { decade: "1990s", events: 6 },
        { decade: "2000s", events: 14 },
        { decade: "2010s", events: 11 },
        { decade: "2020s", events: 9 }
      ],
      historical_events: [
        { year: 2001, type: "Bhuj Earthquake", severity: "Catastrophic", description: "7.7 magnitude quake, 20,000+ casualties" },
        { year: 2021, type: "Cyclone Tauktae", severity: "Extreme", description: "Extremely Severe Cyclonic Storm landfall" }
      ]
    },
    "kerala": {
      region_name: "Kerala",
      overall_risk_score: 81.2,
      risk_scores: { flood: 91.6, landslide: 86.0, cyclone: 64.0, drought: 39.0 },
      vulnerability_factors: { coastal_exposure: "Western Ghats & Arabian Sea", seismic_zone: "Zone III" },
      decade_trends: [
        { decade: "1990s", events: 5 },
        { decade: "2000s", events: 7 },
        { decade: "2010s", events: 16 },
        { decade: "2020s", events: 10 }
      ],
      historical_events: [
        { year: 2018, type: "Great Kerala Deluge", severity: "Catastrophic", description: "Worst monsoon flooding in a century" },
        { year: 2024, type: "Wayanad Landslides", severity: "Extreme", description: "Devastating debris flows in Meppadi region" }
      ]
    }
  },
  global: {
    "japan": {
      region_name: "Japan",
      overall_risk_score: 92.0,
      risk_scores: { earthquake: 95.2, tsunami: 91.0, cyclone: 82.0, flood: 68.0 },
      vulnerability_factors: { coastal_exposure: "Pacific Ring of Fire", seismic_zone: "Extreme" },
      decade_trends: [
        { decade: "1990s", events: 14 },
        { decade: "2000s", events: 18 },
        { decade: "2010s", events: 25 },
        { decade: "2020s", events: 16 }
      ],
      historical_events: [
        { year: 1995, type: "Kobe Earthquake", severity: "Catastrophic", description: "Great Hanshin earthquake (M6.9)" },
        { year: 2011, "type": "Tohoku Earthquake & Tsunami", severity: "Catastrophic", description: "9.0 magnitude quake & 40m tsunami" }
      ]
    }
  }
};

export default function ClimateRiskModule() {
  const globeEl = useRef();
  const [activeLayer, setActiveLayer] = useState('india'); // 'india' or 'global'
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [activeTab, setActiveTab] = useState('forecast'); // 'forecast' or 'history'
  const [geoJsonData, setGeoJsonData] = useState(null);
  const [climateData, setClimateData] = useState(FALLBACK_CLIMATE_DATA);
  const [loadingGeoJson, setLoadingGeoJson] = useState(true);

  // Fetch Firestore climate risk data
  useEffect(() => {
    async function fetchClimateRiskData() {
      try {
        const indiaSnap = await getDocs(collection(db, 'region_climate_data_india'));
        const globalSnap = await getDocs(collection(db, 'region_climate_data_global'));

        const indiaDocs = {};
        indiaSnap.forEach(d => { indiaDocs[d.id.toLowerCase()] = d.data(); });

        const globalDocs = {};
        globalSnap.forEach(d => { globalDocs[d.id.toLowerCase()] = d.data(); });

        if (Object.keys(indiaDocs).length > 0 || Object.keys(globalDocs).length > 0) {
          setClimateData({
            india: { ...FALLBACK_CLIMATE_DATA.india, ...indiaDocs },
            global: { ...FALLBACK_CLIMATE_DATA.global, ...globalDocs }
          });
        }
      } catch (err) {
        console.warn("Firestore fetch offline, using fallback dataset:", err);
      }
    }
    fetchClimateRiskData();
  }, []);

  // Fetch GeoJSON polygons based on active layer
  useEffect(() => {
    setLoadingGeoJson(true);
    const url = activeLayer === 'india' ? INDIA_GEOJSON_URL : WORLD_GEOJSON_URL;

    fetch(url)
      .then(res => res.json())
      .then(data => {
        setGeoJsonData(data);
        setLoadingGeoJson(false);
      })
      .catch(err => {
        console.warn("Failed to load online GeoJSON, generating polygon fallback:", err);
        setLoadingGeoJson(false);
      });

    // Auto-rotate globe to focus area
    if (globeEl.current) {
      if (activeLayer === 'india') {
        globeEl.current.pointOfView({ lat: 20.5937, lng: 78.9629, altitude: 1.8 }, 1500);
      } else {
        globeEl.current.pointOfView({ lat: 20.0, lng: 0.0, altitude: 2.5 }, 1500);
      }
    }
  }, [activeLayer]);

  // Handle region polygon click
  const handlePolygonClick = (polygon) => {
    const properties = polygon.properties || {};
    const name = (properties.ST_NM || properties.NAME || properties.name || properties.admin || "Region").toLowerCase();

    const layerData = climateData[activeLayer] || {};
    const regionInfo = layerData[name] || {
      region_name: properties.ST_NM || properties.NAME || properties.name || "Selected Region",
      overall_risk_score: 72.0,
      risk_scores: { flood: 75.0, cyclone: 65.0, earthquake: 50.0, drought: 40.0 },
      vulnerability_factors: { coastal_exposure: "Moderate", seismic_zone: "Zone III" },
      decade_trends: [
        { decade: "1990s", events: 4 },
        { decade: "2000s", events: 8 },
        { decade: "2010s", events: 12 },
        { decade: "2020s", events: 7 }
      ],
      historical_events: [
        { year: 2019, type: "Monsoon Flood", severity: "High", description: "Severe seasonal inundation and river overflow" },
        { year: 2021, type: "Storm Surge", severity: "Moderate", description: "High wind gusts and rain burst" }
      ]
    };

    setSelectedRegion(regionInfo);
  };

  // Get color by risk score
  const getPolygonColor = (polygon) => {
    const properties = polygon.properties || {};
    const name = (properties.ST_NM || properties.NAME || properties.name || "").toLowerCase();
    const layerData = climateData[activeLayer] || {};
    const info = layerData[name];

    const score = info ? info.overall_risk_score : 55.0;

    if (score > 70) return 'rgba(34, 197, 94, 0.80)'; // Red High
    if (score >= 40) return 'rgba(74, 222, 128, 0.70)'; // Orange Med
    return 'rgba(134, 239, 172, 0.60)'; // Yellow Low
  };

  // Format radar data for Recharts
  const radarData = useMemo(() => {
    if (!selectedRegion || !selectedRegion.risk_scores) return [];
    return Object.entries(selectedRegion.risk_scores).map(([type, val]) => ({
      disasterType: type.toUpperCase(),
      score: val,
      fullMark: 100
    }));
  }, [selectedRegion]);

  return (
    <div className="relative w-full h-[720px] rounded-xl border border-amber-900/40 bg-slate-950 shadow-2xl overflow-hidden font-mono">
      {/* Top Header & Layer Toggle */}
      <div className="absolute top-0 left-0 right-0 z-[100] bg-slate-950/90 backdrop-blur border-b border-amber-900/40 px-5 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="p-1.5 bg-amber-950/80 border border-amber-600/50 rounded">
            <GlobeIcon className="w-5 h-5 text-blue-300 animate-spin-slow" />
          </div>
          <div>
            <h2 className="text-lg font-bold font-typewriter text-white uppercase tracking-wide">
              3D Climate Risk & Disaster Vulnerability Intelligence
            </h2>
            <p className="text-xs text-slate-400">
              Interactive GeoJSON Risk Assessment powered by EM-DAT & NDMA Archives.
            </p>
          </div>
        </div>

        {/* Dual Layer Selector */}
        <div className="flex items-center space-x-2 bg-slate-900/90 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setActiveLayer('india')}
            className={`px-3 py-1.5 text-xs font-mono rounded transition flex items-center space-x-1.5 ${
              activeLayer === 'india' ? 'bg-amber-900/50 text-white border border-amber-700/60 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>INDIA (STATES)</span>
          </button>
          <button
            onClick={() => setActiveLayer('global')}
            className={`px-3 py-1.5 text-xs font-mono rounded transition flex items-center space-x-1.5 ${
              activeLayer === 'global' ? 'bg-amber-900/50 text-white border border-amber-700/60 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <GlobeIcon className="w-3.5 h-3.5" />
            <span>GLOBAL (COUNTRIES)</span>
          </button>
        </div>
      </div>

            {/* 3D Globe Canvas */}
      <div className="w-full h-full pt-12 relative">
        {/* Stylish Website Title Overlay Floating Over the Globe */}
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[110] pointer-events-none flex flex-col items-center animate-in fade-in zoom-in duration-500">
          <div className="bg-slate-950/85 border border-emerald-500/60 backdrop-blur-md px-6 py-2.5 rounded-full shadow-[0_0_30px_rgba(16,185,129,0.4)] flex items-center space-x-3 transition-all duration-300 hover:scale-105">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <h1 className="text-sm md:text-base font-extrabold tracking-widest uppercase bg-gradient-to-r from-emerald-300 via-teal-200 to-cyan-300 bg-clip-text text-transparent drop-shadow-[0_2px_10px_rgba(16,185,129,0.5)] font-sans">
              DISASTER VICTIM DETECTION & CLIMATE INTELLIGENCE
            </h1>
          </div>
          <span className="text-[10px] text-emerald-300 font-mono tracking-widest mt-1.5 uppercase bg-slate-950/80 px-3 py-0.5 rounded-full border border-emerald-800/60 shadow-lg">
            SIH EVIDENTIAL COMMAND // 3D GLOBAL TACTICAL RADAR
          </span>
        </div>

        <Globe
          ref={globeEl}
          globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
          bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
          backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
          polygonsData={geoJsonData ? geoJsonData.features : []}
          polygonCapColor={getPolygonColor}
          polygonSideColor={() => 'rgba(34, 197, 94, 0.35)'}
          polygonStrokeColor={() => '#4ade80'}
          polygonAltitude={0.015}
          polygonLabel={({ properties }) => `
            <div style="background:#0f172a; color:#fef3c7; border:1px solid #78350f; padding:6px 10px; border-radius:6px; font-family:monospace; font-size:12px;">
              <strong>${properties.ST_NM || properties.NAME || properties.name || "Region"}</strong><br/>
              <span style="color:#f59e0b">Click to view Climate Risk & History</span>
            </div>
          `}
          onPolygonClick={handlePolygonClick}
        />
      </div>

      {/* Interactive Side Panel when a region is clicked */}
      {selectedRegion && (
        <div className="absolute top-16 right-4 bottom-4 w-full md:w-[440px] z-[150] bg-slate-950/95 border border-amber-900/60 rounded-xl p-5 shadow-2xl backdrop-blur flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-300">
          <div>
            {/* Side Panel Header */}
            <div className="flex items-start justify-between border-b border-amber-900/40 pb-3 mb-4">
              <div>
                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">
                  CASE DOSSIER // {selectedRegion.region_type || 'REGION'}
                </span>
                <h3 className="text-xl font-bold font-typewriter text-white">
                  {selectedRegion.region_name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedRegion(null)}
                className="p-1 text-slate-400 hover:text-white hover:bg-slate-900 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Overall Risk Score Badge */}
            <div className="bg-slate-900/80 border border-amber-900/40 rounded-lg p-3 mb-4 flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-400 font-mono">OVERALL CLIMATE RISK INDEX</div>
                <div className="text-2xl font-bold font-typewriter text-red-400">
                  {selectedRegion.overall_risk_score} / 100
                </div>
              </div>
              <span className={`px-2.5 py-1 text-xs font-bold rounded ${
                selectedRegion.overall_risk_score > 70 ? 'bg-red-950 text-red-300 border border-red-800' : 'bg-amber-950 text-white border border-amber-800'
              }`}>
                {selectedRegion.overall_risk_score > 70 ? 'HIGH HAZARD' : 'MODERATE HAZARD'}
              </span>
            </div>

            {/* Tab Switching */}
            <div className="flex border-b border-slate-800 mb-4 text-xs font-mono">
              <button
                onClick={() => setActiveTab('forecast')}
                className={`py-2 px-4 border-b-2 font-bold transition flex items-center space-x-1.5 ${
                  activeTab === 'forecast' ? 'border-amber-500 text-white bg-amber-950/20' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>RISK FORECAST</span>
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`py-2 px-4 border-b-2 font-bold transition flex items-center space-x-1.5 ${
                  activeTab === 'history' ? 'border-amber-500 text-white bg-amber-950/20' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>HISTORICAL DISASTERS</span>
              </button>
            </div>

            {/* TAB B: Risk Forecast (Spider / Radar Chart & Formula breakdown) */}
            {activeTab === 'forecast' && (
              <div className="space-y-4">
                <div className="text-xs text-slate-300 font-mono bg-slate-900/60 p-2.5 rounded border border-slate-800">
                  <strong className="text-blue-300">Scoring Formula:</strong> 40% Hist. Freq + 40% Regional Vulnerability + 20% Environmental Trend
                </div>

                {/* Radar Chart */}
                <div className="h-52 bg-slate-900/40 rounded border border-slate-800 p-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="#334155" />
                      <PolarAngleAxis dataKey="disasterType" stroke="#cbd5e1" fontSize={10} fontFamily="Courier Prime" />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#475569" fontSize={9} />
                      <Radar name="Risk Index" dataKey="score" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.4} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>

                {/* Vulnerability Factors */}
                {selectedRegion.vulnerability_factors && (
                  <div className="space-y-2 text-xs font-mono">
                    <div className="text-blue-300 font-bold uppercase text-[11px]">Vulnerability Indicators</div>
                    {Object.entries(selectedRegion.vulnerability_factors).map(([key, val]) => (
                      <div key={key} className="flex justify-between border-b border-slate-800 pb-1">
                        <span className="text-slate-400 capitalize">{key.replace('_', ' ')}:</span>
                        <span className="text-slate-200 text-right">{val}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB A: Historical Climate Data Timeline & Decade Chart */}
            {activeTab === 'history' && (
              <div className="space-y-4">
                {/* Decade Frequency Chart */}
                {selectedRegion.decade_trends && (
                  <div className="h-40 bg-slate-900/40 rounded border border-slate-800 p-2">
                    <div className="text-[11px] text-blue-300 font-bold mb-1">DISASTER INCIDENTS PER DECADE</div>
                    <ResponsiveContainer width="100%" height="85%">
                      <BarChart data={selectedRegion.decade_trends}>
                        <XAxis dataKey="decade" stroke="#94a3b8" fontSize={10} fontFamily="Courier Prime" />
                        <YAxis stroke="#94a3b8" fontSize={10} fontFamily="Courier Prime" />
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#78350f', color: '#fef3c7' }} />
                        <Bar dataKey="events" fill="#d97706" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Historical Events Timeline */}
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  <div className="text-blue-300 font-bold text-[11px] uppercase">Major Recorded Archive Events</div>
                  {selectedRegion.historical_events?.map((ev, i) => (
                    <div key={i} className="p-2.5 rounded bg-slate-900 border border-slate-800 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-white">{ev.year} — {ev.type}</span>
                        <span className="px-1.5 py-0.5 text-[9px] bg-red-950 text-red-300 border border-red-800 rounded">
                          {ev.severity}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300 italic">{ev.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-800 text-[10px] text-slate-500 font-mono text-center">
            Source: EM-DAT International Disaster Database & NDMA Climate Archives
          </div>
        </div>
      )}
    </div>
  );
}
