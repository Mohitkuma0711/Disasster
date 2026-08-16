import React, { useState, useEffect, useRef } from 'react';
import { UploadCloud, Film, Play, CheckCircle2, AlertTriangle, ShieldCheck, FileVideo, Clock, XCircle, Sparkles, RefreshCw } from 'lucide-react';

export default function VideoThreatAnalysis() {
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [threats, setThreats] = useState({});
  const [fileToUpload, setFileToUpload] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [activeThreatFilter, setActiveThreatFilter] = useState('all');

  const videoPlayerRef = useRef(null);

  // Fetch real uploaded video jobs from backend API
  const fetchJobs = async () => {
    try {
      const res = await fetch('http://localhost:8000/video-jobs');
      if (res.ok) {
        const data = await res.json();
        setJobs(data || []);
      }
    } catch (err) {
      console.warn("Backend video-jobs endpoint unreachable:", err);
    }
  };

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 4000);
    return () => clearInterval(interval);
  }, []);

  // Fetch Verified Threats for selected Job
  useEffect(() => {
    if (!selectedJob) return;
    async function fetchJobThreats() {
      try {
        const res = await fetch(`http://localhost:8000/video-jobs/${selectedJob.video_id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.verified_threats) {
            setThreats(prev => ({
              ...prev,
              [selectedJob.video_id]: data.verified_threats
            }));
          }
        }
      } catch (err) {
        console.warn("Error fetching verified threats:", err);
      }
    }
    fetchJobThreats();
  }, [selectedJob]);

  // Handle Video File Upload
  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!fileToUpload) return;

    setUploading(true);
    setUploadProgress(25);

    const formData = new FormData();
    formData.append('file', fileToUpload);

    try {
      setUploadProgress(60);
      const res = await fetch('http://localhost:8000/upload-video', {
        method: 'POST',
        body: formData,
      });

      setUploadProgress(90);

      if (res.ok) {
        const data = await res.json();
        setUploadProgress(100);
        setFileToUpload(null);
        fetchJobs();
      } else {
        const errData = await res.json();
        alert(`Upload error: ${errData.detail || 'Failed to upload video'}`);
      }
    } catch (err) {
      alert(`Network error uploading video to http://localhost:8000/upload-video. Ensure backend is running.`);
    } finally {
      setTimeout(() => {
        setUploading(false);
        setUploadProgress(0);
      }, 500);
    }
  };

  // Seek Video Player to timestamp
  const handleJumpToTimecode = (seconds) => {
    if (videoPlayerRef.current) {
      videoPlayerRef.current.currentTime = seconds;
      videoPlayerRef.current.play();
    }
  };

  // Update threat status (Mark Reviewed / False Positive)
  const handleUpdateStatus = async (threatId, newStatus) => {
    const currentThreats = threats[selectedJob?.video_id] || [];
    const updated = currentThreats.map(t => t.id === threatId ? { ...t, status: newStatus } : t);
    
    setThreats(prev => ({
      ...prev,
      [selectedJob.video_id]: updated
    }));

    try {
      await fetch(`http://localhost:8000/video-threats/${threatId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch (err) {
      console.warn("Backend status update offline:", err);
    }
  };

  const jobThreats = selectedJob ? (threats[selectedJob.video_id] || []) : [];
  const filteredThreats = jobThreats.filter(t => {
    if (activeThreatFilter === 'unreviewed') return t.status === 'unreviewed';
    if (activeThreatFilter === 'reviewed') return t.status === 'reviewed';
    return true;
  });

  return (
    <div className="space-y-6 font-mono">
      {/* Module Header */}
      <div className="bg-slate-950/90 border border-amber-900/40 rounded-xl p-5 shadow-2xl backdrop-blur flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Film className="w-5 h-5 text-blue-400" />
            <h2 className="text-xl font-bold font-typewriter text-white uppercase tracking-wide">
              Automated Video Threat Analysis & Gemini 2.0 Flash Verification
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Stage 1 Candidate Detection (YOLOv8 + ByteTrack) &rarr; Stage 2 Gemini 2.0 Flash Vision Verification.
          </p>
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <span className="px-3 py-1 bg-amber-950 text-white border border-amber-800 rounded font-bold">
            STAGE 1: HEURISTICS
          </span>
          <span className="text-slate-500">&rarr;</span>
          <span className="px-3 py-1 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded font-bold flex items-center space-x-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>STAGE 2: GEMINI 2.0 FLASH VERIFIED</span>
          </span>
        </div>
      </div>

      {/* Upload Component */}
      <div className="bg-slate-950/90 border border-amber-900/40 rounded-xl p-5 shadow-2xl backdrop-blur">
        <form onSubmit={handleUploadSubmit} className="space-y-4">
          <div className="text-sm font-bold font-typewriter text-white uppercase flex items-center space-x-2">
            <UploadCloud className="w-4 h-4 text-blue-400" />
            <span>Upload Reconnaissance / Drone Video Recording</span>
          </div>

          <div className="relative border-2 border-dashed border-amber-900/50 hover:border-amber-500/60 rounded-xl p-6 text-center bg-slate-900/40 transition group cursor-pointer">
            <input
              type="file"
              accept="video/mp4,video/mov,video/avi,video/mkv"
              onChange={(e) => setFileToUpload(e.target.files[0] || null)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="flex flex-col items-center justify-center space-y-2">
              <FileVideo className="w-8 h-8 text-blue-400 group-hover:scale-110 transition" />
              <div className="text-xs text-slate-300">
                {fileToUpload ? (
                  <span className="font-bold text-white">{fileToUpload.name} ({(fileToUpload.size / (1024 * 1024)).toFixed(1)} MB)</span>
                ) : (
                  <span>Drag & drop MP4, MOV, or AVI video file here, or click to browse</span>
                )}
              </div>
              <span className="text-[10px] text-slate-500">Supports aerial drone footage, CCTV feeds, and ground camera MP4 recordings</span>
            </div>
          </div>

          {uploading && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-white">
                <span>Uploading video file and starting async Gemini 2.0 Flash analysis...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
                <div className="bg-amber-500 h-full rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!fileToUpload || uploading}
              className="px-5 py-2.5 bg-blue-900 hover:bg-blue-800 text-white border border-blue-700 font-bold rounded-lg shadow-lg shadow-amber-900/30 transition disabled:opacity-50 text-xs flex items-center space-x-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>START GEMINI 2.0 FLASH THREAT ANALYSIS</span>
            </button>
          </div>
        </form>
      </div>

      {/* Video Jobs Gallery Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-bold font-typewriter text-white uppercase tracking-wide flex items-center space-x-2">
            <Film className="w-4 h-4 text-blue-400" />
            <span>Processed Video Jobs ({jobs.length})</span>
          </div>

          <button
            onClick={fetchJobs}
            className="text-xs text-white hover:bg-blue-800 flex items-center space-x-1 bg-blue-950 px-3 py-1.5 rounded-lg border border-blue-700 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>REFRESH LIST</span>
          </button>
        </div>

        {jobs.length === 0 ? (
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-8 text-center text-slate-400 space-y-2">
            <FileVideo className="w-10 h-10 text-slate-600 mx-auto" />
            <div className="font-typewriter text-white font-bold">No uploaded videos yet</div>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Upload an MP4/MOV/AVI video file using the panel above to start candidate detection and Gemini 2.0 Flash vision verification.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {jobs.map((job) => (
              <div
                key={job.video_id}
                onClick={() => setSelectedJob(job)}
                className={`p-4 rounded-xl border transition cursor-pointer flex flex-col justify-between space-y-3 ${
                  selectedJob?.video_id === job.video_id
                    ? 'bg-blue-950/50 border-blue-600 shadow-xl shadow-blue-950/60'
                    : 'bg-slate-950/90 border-amber-900/40 hover:border-amber-700/60'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-bold font-mono text-blue-400 uppercase">
                      {job.video_id}
                    </span>
                    <h4 className="text-sm font-bold font-typewriter text-slate-200 truncate max-w-[260px]">
                      {job.filename}
                    </h4>
                  </div>
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase ${
                    job.status === 'completed' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                    job.status === 'processing' ? 'bg-amber-950 text-white border border-amber-800 animate-pulse' :
                    'bg-slate-900 text-slate-400'
                  }`}>
                    {job.status}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs font-mono text-slate-400 border-t border-slate-900 pt-2">
                  <div className="flex items-center space-x-1">
                    <Clock className="w-3.5 h-3.5 text-blue-400" />
                    <span>{job.duration_sec ? `${job.duration_sec}s` : 'N/A'}</span>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    <span className="px-2 py-0.5 bg-red-950 text-red-300 border border-red-800 rounded font-bold">
                      {job.verified_count || 0} VERIFIED THREATS
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Video Detail & Interactive Review Case Modal */}
      {selectedJob && (
        <div className="bg-slate-950/95 border border-amber-900/60 rounded-xl p-5 shadow-2xl space-y-6 animate-in fade-in duration-300">
          <div className="flex items-center justify-between border-b border-amber-900/40 pb-3">
            <div>
              <span className="text-[10px] font-bold font-mono text-blue-400 uppercase">
                CASE DOSSIER // {selectedJob.video_id}
              </span>
              <h3 className="text-lg font-bold font-typewriter text-white">
                {selectedJob.filename}
              </h3>
            </div>
            <button
              onClick={() => setSelectedJob(null)}
              className="p-1 text-slate-400 hover:text-white rounded"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>

          {/* Player & Scrubber with Verified Markers */}
          <div className="space-y-3">
            <div className="relative rounded-xl overflow-hidden border border-amber-900/50 bg-black aspect-video max-h-[420px]">
              <video
                ref={videoPlayerRef}
                controls
                src={`http://localhost:8000${selectedJob.video_url}`}
                className="w-full h-full object-contain"
              />
            </div>

            {/* Interactive Timeline Scrubber Markers */}
            <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800 space-y-2">
              <div className="text-xs text-blue-300 font-bold uppercase flex items-center space-x-1.5">
                <Play className="w-3.5 h-3.5" />
                <span>Verified Threat Timecode Markers (Click marker to seek video)</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {jobThreats.length === 0 ? (
                  <span className="text-xs text-slate-500 italic">No verified threats confirmed in this video recording.</span>
                ) : (
                  jobThreats.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => handleJumpToTimecode(t.timestamp_sec)}
                      className="px-3 py-1.5 rounded bg-blue-950 hover:bg-blue-900 text-white border border-blue-800 shadow text-xs font-mono transition flex items-center space-x-1.5"
                    >
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
                      <span className="font-bold">{t.timecode}</span>
                      <span>— {t.threat_type}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Verified Threats Evidence Gallery */}
          <div className="space-y-4 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-900/30 pb-3">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h4 className="text-md font-bold font-typewriter text-white uppercase">
                  Gemini 2.0 Flash Verified Threat Screenshots ({filteredThreats.length})
                </h4>
              </div>

              {/* Status Filter Tabs */}
              <div className="flex items-center space-x-1 bg-slate-900 p-1 rounded border border-slate-800 text-xs font-mono">
                <button
                  onClick={() => setActiveThreatFilter('all')}
                  className={`px-2.5 py-1 rounded ${activeThreatFilter === 'all' ? 'bg-blue-900 text-white border border-blue-700 font-bold' : 'text-slate-400'}`}
                >
                  ALL
                </button>
                <button
                  onClick={() => setActiveThreatFilter('unreviewed')}
                  className={`px-2.5 py-1 rounded ${activeThreatFilter === 'unreviewed' ? 'bg-blue-900 text-white border border-blue-700 font-bold' : 'text-slate-400'}`}
                >
                  UNREVIEWED
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredThreats.map((t) => {
                const isSubmerging = t.threat_type.includes('Submerging') || t.threat_type.includes('Trapped');
                const screenshotSrc = t.screenshot_url.startsWith('http') ? t.screenshot_url : `http://localhost:8000${t.screenshot_url}`;
                const reasoning = t.gemini_reasoning || t.gpt4o_mini_reasoning || t.llm_reasoning;

                return (
                  <div
                    key={t.id}
                    className="bg-slate-900/90 border border-amber-900/40 rounded-xl p-4 space-y-3 shadow-xl"
                  >
                    <div className="flex items-start justify-between">
                      <span className={`px-2.5 py-1 text-xs font-bold rounded uppercase ${
                        isSubmerging ? 'bg-red-950 text-red-300 border border-red-800' : 'bg-amber-950 text-white border border-amber-800'
                      }`}>
                        {t.threat_type}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        Timecode: <strong className="text-white">{t.timecode}</strong>
                      </span>
                    </div>

                    {/* Screenshot Frame */}
                    <div className="relative rounded-lg overflow-hidden border border-slate-800 bg-black aspect-video">
                      <img
                        src={screenshotSrc}
                        alt={`Threat at ${t.timecode}`}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Reasoning Snippet */}
                    <div className="text-xs font-mono text-slate-300 bg-slate-950/80 p-2.5 rounded border border-slate-800 space-y-1">
                      <div className="text-emerald-400 font-bold flex items-center space-x-1">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Gemini 2.0 Flash Explanation (YOLO Conf: {Math.round((t.yolo_confidence || 0.90) * 100)}%)</span>
                      </div>
                      <p className="italic text-slate-300 text-[11px]">{reasoning}</p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-between pt-1 font-mono text-xs">
                      {t.status === 'unreviewed' ? (
                        <div className="flex items-center space-x-2 w-full justify-end">
                          <button
                            onClick={() => handleUpdateStatus(t.id, 'false_positive')}
                            className="px-3 py-1.5 rounded bg-blue-950 hover:bg-blue-900 text-white border border-blue-800 text-xs transition"
                          >
                            FALSE POSITIVE
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(t.id, 'reviewed')}
                            className="px-3 py-1.5 rounded bg-blue-900 hover:bg-blue-800 text-white border border-blue-700 shadow-md text-xs transition font-bold"
                          >
                            MARK REVIEWED
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-emerald-400 font-bold uppercase flex items-center space-x-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>STATUS: {t.status.toUpperCase()}</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
