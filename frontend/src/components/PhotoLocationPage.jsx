import React, { useMemo, useState } from 'react';
import { Camera, MapPin, Upload, CheckCircle2, AlertCircle, Clock3 } from 'lucide-react';

export default function PhotoLocationPage() {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const locationSummary = useMemo(() => {
    if (!result?.location) return null;
    return {
      latitude: Number(result.location.latitude),
      longitude: Number(result.location.longitude),
    };
  }, [result]);

  const handleFileChange = async (selectedFile) => {
    if (!selectedFile) {
      setFile(null);
      setPreviewUrl('');
      setResult(null);
      setError('');
      return;
    }

    setFile(selectedFile);
    setError('');
    setLoading(true);
    setResult(null);

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const nextPreviewUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(nextPreviewUrl);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('http://localhost:8000/location-from-photo', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.detail || 'Unable to extract location from photo.');
      }

      setResult(data);
      if (!data.gps_found) {
        setError('No GPS metadata was found in this photo. Try a photo taken on a smartphone with location tagging enabled.');
      }
    } catch (err) {
      setError(err.message || 'Photo analysis failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-950/90 border border-amber-900/40 rounded-2xl p-6 shadow-2xl backdrop-blur">
      <div className="flex items-center justify-between border-b border-amber-900/30 pb-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-amber-400">
            <Camera className="w-5 h-5" />
            <h2 className="text-xl font-bold font-typewriter uppercase tracking-wide text-white">Location from Photo</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            Upload a geo-tagged image to extract camera metadata and GPS coordinates.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="relative border border-dashed border-slate-700 rounded-xl bg-slate-900/60 p-6 text-center hover:border-amber-500/70 transition">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="flex flex-col items-center justify-center space-y-3">
              <div className="p-3 rounded-full bg-blue-950/80 border border-blue-700/60">
                <Upload className="w-6 h-6 text-blue-300" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-200">
                  {loading ? 'Analyzing photo…' : file ? file.name : 'Upload evidence image'}
                </p>
                <p className="text-xs text-slate-400 font-mono">Supported: JPG, PNG, and other common image files</p>
              </div>
            </div>
          </div>

          {previewUrl && (
            <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
              <img src={previewUrl} alt="Uploaded preview" className="w-full h-72 object-cover" />
            </div>
          )}
        </div>

        <div className="space-y-4">
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-800 bg-red-950/70 p-3 text-red-200 text-xs font-mono">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!result && !loading && !error && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 text-sm text-slate-300 font-mono">
              Upload a photo to inspect its embedded location metadata.
            </div>
          )}

          {result && (
            <div className="space-y-4">
              <div className="rounded-xl border border-emerald-800 bg-emerald-950/60 p-4">
                <div className="flex items-center gap-2 text-emerald-300 mb-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-xs font-mono uppercase tracking-wide">Photo analysis complete</span>
                </div>
                <p className="text-xs text-slate-300 font-mono">{result.filename}</p>
              </div>

              {locationSummary ? (
                <div className="rounded-xl border border-blue-800 bg-blue-950/50 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-blue-300">
                    <MapPin className="w-4 h-4" />
                    <span className="text-xs font-mono uppercase tracking-wide">Detected coordinates</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm text-slate-100">
                    <div className="bg-slate-900/60 rounded p-3">
                      <p className="text-[10px] uppercase text-slate-400">Latitude</p>
                      <p className="font-bold">{locationSummary.latitude.toFixed(6)}</p>
                    </div>
                    <div className="bg-slate-900/60 rounded p-3">
                      <p className="text-[10px] uppercase text-slate-400">Longitude</p>
                      <p className="font-bold">{locationSummary.longitude.toFixed(6)}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-amber-800 bg-amber-950/60 p-4 text-amber-200 text-xs font-mono">
                  No geotag coordinates were detected in the photo metadata.
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-3">
                  <p className="text-[10px] uppercase text-slate-400 mb-1">Camera make</p>
                  <p className="text-sm text-slate-100">{result.camera?.make || 'Unknown'}</p>
                </div>
                <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-3">
                  <p className="text-[10px] uppercase text-slate-400 mb-1">Camera model</p>
                  <p className="text-sm text-slate-100">{result.camera?.model || 'Unknown'}</p>
                </div>
                <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-3 sm:col-span-2">
                  <div className="flex items-center gap-2 text-slate-300 mb-1">
                    <Clock3 className="w-4 h-4" />
                    <p className="text-[10px] uppercase text-slate-400">Capture time</p>
                  </div>
                  <p className="text-sm text-slate-100">{result.capture_time || 'Not available'}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
