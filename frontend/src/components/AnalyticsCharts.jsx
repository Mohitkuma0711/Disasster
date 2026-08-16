import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { BarChart3, PieChart as PieIcon } from 'lucide-react';

export default function AnalyticsCharts({ victims = [] }) {
  // Compute priority score distribution
  const highPriority = victims.filter(v => (v.priority_score || 0) > 70 && v.status !== 'rescued').length;
  const medPriority = victims.filter(v => (v.priority_score || 0) >= 40 && (v.priority_score || 0) <= 70 && v.status !== 'rescued').length;
  const lowPriority = victims.filter(v => (v.priority_score || 0) < 40 && v.status !== 'rescued').length;
  const rescuedCount = victims.filter(v => v.status === 'rescued').length;

  const priorityData = [
    { name: 'HIGH (>70)', count: highPriority, color: '#ef4444' },
    { name: 'MED (40-70)', count: medPriority, color: '#f59e0b' },
    { name: 'LOW (<40)', count: lowPriority, color: '#eab308' },
    { name: 'RESCUED', count: rescuedCount, color: '#10b981' },
  ];

  const statusData = [
    { name: 'Active Unhandled', value: victims.filter(v => v.status !== 'rescued').length, color: '#f59e0b' },
    { name: 'Rescued', value: rescuedCount, color: '#10b981' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Priority Distribution Chart */}
      <div className="bg-slate-950/90 rounded-xl border border-amber-900/40 p-4 shadow-xl">
        <div className="flex items-center space-x-2 mb-3 border-b border-amber-900/30 pb-2">
          <BarChart3 className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-bold font-typewriter text-white uppercase">
            Priority Score Triage Spectrum
          </h3>
        </div>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={priorityData}>
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} fontFamily="Courier Prime" />
              <YAxis stroke="#94a3b8" fontSize={11} fontFamily="Courier Prime" />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#78350f', color: '#fef3c7', fontFamily: 'Courier Prime' }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {priorityData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Rescue Status Pie Chart */}
      <div className="bg-slate-950/90 rounded-xl border border-amber-900/40 p-4 shadow-xl">
        <div className="flex items-center space-x-2 mb-3 border-b border-amber-900/30 pb-2">
          <PieIcon className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-bold font-typewriter text-white uppercase">
            Operation Rescue Status Ratio
          </h3>
        </div>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={statusData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={55}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              >
                {statusData.map((entry, index) => (
                  <Cell key={`pie-cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#78350f', color: '#fef3c7', fontFamily: 'Courier Prime' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
