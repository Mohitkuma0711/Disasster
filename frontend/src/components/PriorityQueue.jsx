import React, { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { CheckCircle2, ArrowUpDown, MapPin, Activity, ShieldAlert, UserCheck } from 'lucide-react';

export default function PriorityQueue({ victims, onVictimSelect, onVictimRescued }) {
  const [sortField, setSortField] = useState('priority_score');
  const [sortAsc, setSortAsc] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [updatingId, setUpdatingId] = useState(null);

  // Handle Mark Rescued in Firestore
  const handleMarkRescued = async (e, victimId) => {
    e.stopPropagation();
    setUpdatingId(victimId);
    const rescuedAt = new Date().toISOString();
    try {
      const victimRef = doc(db, 'victims', victimId);
      await updateDoc(victimRef, {
        status: 'rescued',
        rescuedAt,
      });
      onVictimRescued?.(victimId, rescuedAt);
    } catch (err) {
      console.warn("Firestore update error; rescue was saved locally for this session:", err);
      // Keep the demo/offline interface functional when Firestore is unavailable.
      onVictimRescued?.(victimId, rescuedAt);
    } finally {
      setUpdatingId(null);
    }
  };

  // Filter & Sort Victims
  const filtered = victims.filter(v => {
    if (statusFilter === 'active') return v.status !== 'rescued';
    if (statusFilter === 'rescued') return v.status === 'rescued';
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    let valA = a[sortField] ?? 0;
    let valB = b[sortField] ?? 0;
    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();

    if (valA < valB) return sortAsc ? -1 : 1;
    if (valA > valB) return sortAsc ? 1 : -1;
    return 0;
  });

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  return (
    <div className="w-full bg-slate-950/90 rounded-xl border border-amber-900/40 p-5 shadow-2xl backdrop-blur">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5 border-b border-amber-900/30 pb-4">
        <div>
          <h2 className="text-xl font-bold font-typewriter text-white flex items-center gap-2 tracking-wide uppercase">
            <ShieldAlert className="w-5 h-5 text-blue-400" />
            Tactical Priority Log & Dispatch Queue
          </h2>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Real-time victim triage queue ordered by AI Priority Index (DBSCAN + Inactivity + Hazard Proximity).
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center space-x-2 font-mono text-xs bg-slate-900/80 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-md transition ${
              statusFilter === 'all' ? 'bg-amber-900/40 text-white border border-amber-700/50' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            ALL ({victims.length})
          </button>
          <button
            onClick={() => setStatusFilter('active')}
            className={`px-3 py-1.5 rounded-md transition ${
              statusFilter === 'active' ? 'bg-amber-900/40 text-white border border-amber-700/50' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            ACTIVE UNHANDLED ({victims.filter(v => v.status !== 'rescued').length})
          </button>
          <button
            onClick={() => setStatusFilter('rescued')}
            className={`px-3 py-1.5 rounded-md transition ${
              statusFilter === 'rescued' ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            RESCUED ({victims.filter(v => v.status === 'rescued').length})
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-slate-800 rounded-lg">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-900/80 text-blue-300 font-mono text-xs uppercase border-b border-amber-900/40">
              <th className="py-3 px-4 cursor-pointer hover:text-white" onClick={() => toggleSort('track_id')}>
                <div className="flex items-center space-x-1">
                  <span>CASE ID</span>
                  <ArrowUpDown className="w-3.5 h-3.5 opacity-60" />
                </div>
              </th>
              <th className="py-3 px-4 cursor-pointer hover:text-white" onClick={() => toggleSort('priority_score')}>
                <div className="flex items-center space-x-1">
                  <span>PRIORITY SCORE</span>
                  <ArrowUpDown className="w-3.5 h-3.5 opacity-60" />
                </div>
              </th>
              <th className="py-3 px-4">LOCATION COORDS</th>
              <th className="py-3 px-4 cursor-pointer hover:text-white" onClick={() => toggleSort('confidence')}>
                <div className="flex items-center space-x-1">
                  <span>CONFIDENCE</span>
                  <ArrowUpDown className="w-3.5 h-3.5 opacity-60" />
                </div>
              </th>
              <th className="py-3 px-4">INACTIVITY</th>
              <th className="py-3 px-4">STATUS</th>
              <th className="py-3 px-4 text-right">ACTION</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80 font-mono text-xs text-slate-200">
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-500 font-mono">
                  No incident cases match the selected filter.
                </td>
              </tr>
            ) : (
              sorted.map((v) => {
                const isRescued = v.status === 'rescued';
                const score = Number(v.priority_score || 0);

                return (
                  <tr
                    key={v.id || v.track_id}
                    onClick={() => onVictimSelect && onVictimSelect(v)}
                    className="hover:bg-amber-950/20 transition cursor-pointer group"
                  >
                    {/* Case ID */}
                    <td className="py-3 px-4 font-typewriter text-white font-bold group-hover:text-white">
                      #{v.track_id ? `TRK-${v.track_id}` : v.id?.slice(0, 8).toUpperCase()}
                    </td>

                    {/* Priority Score Stamp */}
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded font-bold text-xs ${
                        isRescued
                          ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                          : score > 70
                          ? 'bg-red-950 text-red-300 border border-red-800 animate-pulse'
                          : score >= 40
                          ? 'bg-amber-950 text-white border border-amber-800'
                          : 'bg-yellow-950 text-yellow-300 border border-yellow-800'
                      }`}>
                        {Math.round(score)} / 100
                      </span>
                    </td>

                    {/* Coordinates */}
                    <td className="py-3 px-4 text-slate-300 flex items-center space-x-1">
                      <MapPin className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                      <span>
                        {Number(v.lat || (v.coordinates && v.coordinates[0]) || 0).toFixed(4)},{' '}
                        {Number(v.lng || (v.coordinates && v.coordinates[1]) || 0).toFixed(4)}
                      </span>
                    </td>

                    {/* Confidence */}
                    <td className="py-3 px-4 text-slate-300">
                      <div className="flex items-center space-x-2">
                        <div className="w-16 bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-amber-400 h-full rounded-full"
                            style={{ width: `${Math.round((v.confidence || 0.85) * 100)}%` }}
                          />
                        </div>
                        <span className="text-[11px]">{Math.round((v.confidence || 0.85) * 100)}%</span>
                      </div>
                    </td>

                    {/* Inactivity Status */}
                    <td className="py-3 px-4">
                      {v.is_inactive ? (
                        <span className="inline-flex items-center space-x-1 text-red-400 font-semibold text-[11px]">
                          <Activity className="w-3.5 h-3.5" />
                          <span>STATIONARY</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">MOVING</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4">
                      {isRescued ? (
                        <span className="inline-flex items-center space-x-1 text-emerald-400 text-[11px] font-bold">
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>RESCUED</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 text-white text-[11px]">
                          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
                          <span>UNHANDLED</span>
                        </span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      {!isRescued ? (
                        <button
                          disabled={updatingId === v.id}
                          onClick={(e) => handleMarkRescued(e, v.id)}
                          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/40 text-xs font-mono transition disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{updatingId === v.id ? 'SAVING...' : 'MARK RESCUED'}</span>
                        </button>
                      ) : (
                        <span className="text-slate-500 text-[11px] italic">Completed</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
