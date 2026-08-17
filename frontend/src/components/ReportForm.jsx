import React, { useState } from 'react';
import { Send, Upload, MapPin, AlertCircle, CheckCircle2, Crosshair } from 'lucide-react';

export default function ReportForm({ onReportSubmitted }) {
  const [lat, setLat] = useState('28.6139');
  const [lng, setLng] = useState('77.2090');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  // Get user's current GPS position
  const handleGetLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLat(pos.coords.latitude.toFixed(6));
          setLng(pos.coords.longitude.toFixed(6));
          setStatusMessage({ type: 'info', text: 'Coordinates updated from GPS.' });
        },
        (err) => {
          setStatusMessage({ type: 'error', text: 'GPS access denied or unavailable.' });
        }
      );
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitting(true);
    setStatusMessage(null);
    onReportSubmitted?.({
      id: `LOCAL-${Date.now().toString().slice(-6)}`,
      lat: Number(lat),
      lng: Number(lng),
      description,
      priority_score: 78.5,
      confidence: 0.92,
      is_inactive: true,
      status: 'unhandled',
      createdAt: new Date().toISOString(),
    });
    setStatusMessage({ type: 'success', text: 'Incident report saved on this device.' });
    setDescription('');
    setPhoto(null);
    setSubmitting(false);
  };

  return (
    <div className="w-full bg-slate-950/90 rounded-xl border border-amber-900/40 p-5 shadow-2xl backdrop-blur">
      <div className="border-b border-amber-900/30 pb-3 mb-4">
        <h2 className="text-lg font-bold font-typewriter text-white flex items-center gap-2 uppercase tracking-wide">
          <MapPin className="w-5 h-5 text-blue-400" />
          Field Incident Report Form (Dispatch Entry)
        </h2>
        <p className="text-xs text-slate-400 font-mono mt-1">
          File a new victim detection or ground reconnaissance observation.
        </p>
      </div>

      {statusMessage && (
        <div className={`mb-4 p-3 rounded text-xs font-mono flex items-center space-x-2 border ${
          statusMessage.type === 'success' ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800' :
          statusMessage.type === 'error' ? 'bg-red-950/80 text-red-300 border-red-800' :
          'bg-amber-950/80 text-white border-amber-800'
        }`}>
          {statusMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 font-mono text-xs">
        {/* Lat / Lng */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-blue-300 mb-1">LATITUDE</label>
            <input
              type="number"
              step="any"
              required
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded p-2.5 text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-blue-300">LONGITUDE</label>
              <button
                type="button"
                onClick={handleGetLocation}
                className="text-[11px] text-blue-300 hover:text-white flex items-center space-x-1"
              >
                <Crosshair className="w-3 h-3" />
                <span>GET GPS</span>
              </button>
            </div>
            <input
              type="number"
              step="any"
              required
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded p-2.5 text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-blue-300 mb-1">INCIDENT OBSERVATION DETAILS</label>
          <textarea
            rows={3}
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe victim condition, hazards, structures, or immediate needs..."
            className="w-full bg-slate-900 border border-slate-700 rounded p-2.5 text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
          />
        </div>

        {/* Photo Upload */}
        <div>
          <label className="block text-blue-300 mb-1">ATTACHMENT / EVIDENCE PHOTO</label>
          <div className="relative border border-dashed border-slate-700 rounded-lg p-3 text-center bg-slate-900/50 hover:border-amber-500/50 transition">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setPhoto(e.target.files[0] || null)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="flex items-center justify-center space-x-2 text-slate-400">
              <Upload className="w-4 h-4 text-blue-400" />
              <span>{photo ? photo.name : 'Click or drop aerial/ground image file here'}</span>
            </div>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 px-4 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold font-typewriter rounded-lg shadow-lg shadow-amber-900/30 transition flex items-center justify-center space-x-2 disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
          <span>{submitting ? 'TRANSMITTING REPORT...' : 'SUBMIT INCIDENT REPORT TO COMMAND'}</span>
        </button>
      </form>
    </div>
  );
}
