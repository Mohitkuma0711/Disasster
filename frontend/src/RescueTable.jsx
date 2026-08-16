import React, { useState, useRef } from 'react';
import { Crosshair } from 'lucide-react';

const validateCoords = (lat, lng) => {
  const latNum = Number(lat);
  const lngNum = Number(lng);
  if (isNaN(latNum) || isNaN(lngNum)) return { valid: false, reason: 'Not a number' };
  if (latNum < -90 || latNum > 90) return { valid: false, reason: 'Latitude must be between -90 and 90' };
  if (lngNum < -180 || lngNum > 180) return { valid: false, reason: 'Longitude must be between -180 and 180' };
  return { valid: true };
};

const getGeolocation = () => {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      },
      () => {
        resolve(null);
      }
    );
  });
};

export default function RescueTable() {
  const [requests, setRequests] = useState([]);
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [description, setDescription] = useState('');
  const [statusMessage, setStatusMessage] = useState(null);
  const [gpsPosition, setGpsPosition] = useState(null);

  const inputRef = useRef(null);

  const handleSubmit = async () => {
    const validation = validateCoords(lat, lng);
    if (!validation.valid) {
      setStatusMessage({
        type: 'error',
        text: validation.reason,
      });
      return;
    }

    const effectiveLat = gpsPosition ? gpsPosition.latitude : Number(lat);
    const effectiveLng = gpsPosition ? gpsPosition.longitude : Number(lng);

    const newRequest = {
      id: `R-${Date.now()}`,
      lat: effectiveLat,
      lng: effectiveLng,
      description: description || 'No description provided',
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    setRequests(prev => [newRequest, ...prev]);
    setLat('');
    setLng('');
    setDescription('');
    setGpsPosition(null);
    setStatusMessage({
      type: 'success',
      text: 'Rescue request submitted.',
    });

    inputRef.current?.focus();
  };

  const handleGetGps = async () => {
    setStatusMessage(null);
    const pos = await getGeolocation();
    if (pos) {
      setLat(pos.latitude.toFixed(6));
      setLng(pos.longitude.toFixed(6));
      setGpsPosition(pos);
      setStatusMessage({
        type: 'success',
        text: 'Coordinates updated from GPS.',
      });
    } else {
      setStatusMessage({
        type: 'error',
        text: 'GPS access denied or unavailable.',
      });
    }
  };

  const handleMarkRescued = (requestId) => {
    setRequests(prev =>
      prev.map((r) =>
        r.id === requestId
          ? { ...r, status: 'rescued', rescuedAt: new Date().toISOString() }
          : r
      )
    );
  };

  const sortedRequests = [...requests].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );

  return (
    <div className="w-full bg-slate-950/90 rounded-xl border border-amber-900/40 p-6 shadow-2xl backdrop-blur">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold font-typewriter text-white uppercase tracking-wide">
          <span className="text-blue-400">Rescue Request Log</span>
        </h2>
        <div className="flex items-center space-x-2">
          <span className="text-xs text-slate-400">Submitted: {new Date().toLocaleString()}</span>
        </div>
      </div>

      {statusMessage && (
        <div className={`mb-3 p-3 rounded text-xs font-mono flex items-center space-x-2 border ${
          statusMessage.type === 'success'
            ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
            : 'bg-red-950/80 text-red-300 border-red-800'
        }`}>
          {statusMessage.type === 'success'
            ? <span className="w-4 h-4 flex-shrink-0" />
            : <span className="w-4 h-4 flex-shrink-0" />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Empty State */}
      {sortedRequests.length === 0 && (
        <div className="py-12 text-center text-slate-500 font-mono">
          <span className="text-4xl mb-3">📡</span>
          <p className="font-typewriter">No rescue requests yet</p>
          <p className="text-slate-600">Submit coordinates to begin tracking</p>
        </div>
      )}

      {/* Table */}
      {sortedRequests.length > 0 && (
        <div className="overflow-x-auto border border-slate-800 rounded-lg">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/80 text-blue-300 font-mono text-xs uppercase border-b border-amber-900/40">
                <th className="py-3 px-4">ID</th>
                <th className="py-3 px-4">LAT / LNG</th>
                <th className="py-3 px-4">DESCRIPTION</th>
                <th className="py-3 px-4">SUBMITTED</th>
                <th className="py-3 px-4 text-right">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 font-mono text-xs text-slate-200">
              {sortedRequests.map((req) => (
                <tr
                  key={req.id}
                  onClick={() => handleMarkRescued(req.id)}
                  className="hover:bg-amber-950/20 transition cursor-pointer"
                >
                  <td className="py-3 px-4 font-typewriter text-white font-bold">
                    {req.id}
                  </td>

                  <td className="py-3 px-4 text-slate-300">
                    {Number(req.lat).toFixed(4)}, {Number(req.lng).toFixed(4)}
                  </td>

                  <td className="py-3 px-4">
                    {req.description}
                  </td>

                  <td className="py-3 px-4 text-slate-300 text-xs">
                    {new Date(req.createdAt).toLocaleString()}
                  </td>

                  <td className="py-3 px-4 text-right">
                    <span
                      className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded font-bold ${
                        req.status === 'rescued'
                          ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500'
                          : 'bg-amber-600/20 text-amber-300 border border-amber-500'
                        }`}
                    >
                      {req.status.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Form */}
      <div className="mt-6 pt-5 border-t border-amber-900/30">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          className="space-y-3 font-mono text-xs"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-blue-300 mb-1">LATITUDE</label>
              <input
                type="number"
                step="any"
                placeholder="e.g. 28.6139"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded p-2.5 text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                required
              />
            </div>
            <div>
              <label className="block text-blue-300 mb-1">LONGITUDE</label>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 77.2090"
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2.5 text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                  required
                />
                <button
                  type="button"
                  onClick={handleGetGps}
                  className="px-2 py-1 text-[10px] text-blue-300 hover:text-white flex items-center space-x-1 bg-blue-950 rounded border border-blue-800 font-bold transition"
                >
                  <Crosshair className="w-3.5 h-3.5" />
                  <span>GET GPS</span>
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-blue-300 mb-1">OBSERVATION DETAILS</label>
            <textarea
              rows={2}
              placeholder="Describe victim condition, hazards, or immediate needs..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded p-2.5 text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={!lat.trim() || !lng.trim()}
              className="w-full py-3 px-4 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold font-typewriter rounded-lg shadow-lg shadow-amber-900/30 transition flex items-center justify-center space-x-2"
            >
              <span className="w-4 h-4" />
              <span>SUBMIT RESCUE REQUEST</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}