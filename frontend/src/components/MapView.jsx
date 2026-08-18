import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import { ShieldAlert, AlertTriangle, CheckCircle, Navigation } from 'lucide-react';

// Custom Leaflet marker icons by priority score
const createMarkerIcon = (priorityScore, isRescued) => {
  if (isRescued) {
    return L.divIcon({
      className: 'custom-leaflet-marker',
      html: `<div class="w-7 h-7 rounded-full bg-emerald-600/90 border-2 border-emerald-300 flex items-center justify-center text-white shadow-lg shadow-emerald-900/50">
               <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
             </div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
  }

  let bgColor = 'bg-yellow-500';
  let borderColor = 'border-yellow-200';
  let pulseColor = 'bg-yellow-400';

  if (priorityScore > 70) {
    bgColor = 'bg-red-600';
    borderColor = 'border-red-200';
    pulseColor = 'bg-red-500';
  } else if (priorityScore >= 40) {
    bgColor = 'bg-amber-500';
    borderColor = 'border-amber-200';
    pulseColor = 'bg-amber-400';
  }

  return L.divIcon({
    className: 'custom-leaflet-marker',
    html: `<div class="relative flex items-center justify-center">
             ${priorityScore > 70 ? `<span class="animate-ping absolute inline-flex h-8 w-8 rounded-full ${pulseColor} opacity-75"></span>` : ''}
             <div class="relative w-8 h-8 rounded-full ${bgColor} border-2 ${borderColor} flex items-center justify-center text-slate-950 font-bold text-xs shadow-xl shadow-black/80 font-mono">
               ${Math.round(priorityScore)}
             </div>
           </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
};

export default function MapView({ victims = [], onSelectVictim }) {
  const [center] = useState([28.6139, 77.2090]); // Default Delhi coordinates or center of detections

  return (
    <div className="relative w-full h-[calc(100vh-180px)] min-h-[540px] rounded-2xl overflow-hidden border border-amber-900/40 bg-slate-950 shadow-2xl shadow-black/90">
      {/* Evidence Board Top Bar */}
      <div className="absolute top-0 left-0 right-0 z-[1000] bg-slate-950/90 backdrop-blur border-b border-amber-900/40 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Navigation className="w-4 h-4 text-blue-400 animate-pulse" />
          <span className="font-typewriter text-sm tracking-wider text-white uppercase">
            GIS Tactical Map & Target Distribution
          </span>
        </div>
        
        {/* Map Priority Legend */}
        <div className="flex items-center space-x-4 text-xs font-mono">
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded-full bg-red-600 border border-red-200"></span>
            <span className="text-red-300">HIGH (&gt;70)</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded-full bg-amber-500 border border-amber-200"></span>
            <span className="text-white">MED (40-70)</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded-full bg-yellow-500 border border-yellow-200"></span>
            <span className="text-yellow-300">LOW (&lt;40)</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded-full bg-emerald-600 border border-emerald-200"></span>
            <span className="text-emerald-300">RESCUED</span>
          </div>
        </div>
      </div>

      {/* Leaflet Map */}
      <MapContainer
        center={center}
        zoom={13}
        scrollWheelZoom={true}
        style={{ width: '100%', height: '100%', paddingTop: '42px' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        {victims.map((victim) => {
          const lat = Number(victim.lat || (victim.coordinates && victim.coordinates[0]) || 28.6139);
          const lng = Number(victim.lng || (victim.coordinates && victim.coordinates[1]) || 77.2090);
          const score = Number(victim.priority_score || 0);
          const isRescued = victim.status === 'rescued';

          return (
            <React.Fragment key={victim.id || victim.track_id}>
              {/* Highlight Circle for High Priority */}
              {score > 70 && !isRescued && (
                <Circle
                  center={[lat, lng]}
                  radius={200}
                  pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.15, weight: 1 }}
                />
              )}

              <Marker
                position={[lat, lng]}
                icon={createMarkerIcon(score, isRescued)}
                eventHandlers={{
                  click: () => onSelectVictim && onSelectVictim(victim),
                }}
              >
                <Popup>
                  <div className="space-y-2 p-1 min-w-[200px]">
                    <div className="flex items-center justify-between border-b border-amber-900/50 pb-1.5">
                      <span className="font-bold text-white text-sm">
                        CASE #{victim.track_id || victim.id?.slice(0, 8)}
                      </span>
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                        isRescued ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                        score > 70 ? 'bg-red-950 text-red-300 border border-red-800' :
                        score >= 40 ? 'bg-amber-950 text-white border border-amber-800' :
                        'bg-yellow-950 text-yellow-300 border border-yellow-800'
                      }`}>
                        {isRescued ? 'RESCUED' : `PRIORITY: ${Math.round(score)}`}
                      </span>
                    </div>

                    <div className="text-xs space-y-1 text-slate-300 font-mono">
                      <div><strong className="text-blue-300">Lat/Lng:</strong> {lat.toFixed(4)}, {lng.toFixed(4)}</div>
                      <div><strong className="text-blue-300">Status:</strong> {victim.is_inactive ? 'STATIONARY (IMPACTED)' : 'MOVING'}</div>
                      {victim.description && (
                        <div className="pt-1 text-[11px] italic text-white border-t border-slate-800">
                          "{victim.description}"
                        </div>
                      )}
                    </div>
                  </div>
                </Popup>
              </Marker>
            </React.Fragment>
          );
        })}
      </MapContainer>
    </div>
  );
}
