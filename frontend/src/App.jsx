import { useState } from 'react'

function App() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-6">
      <div className="max-w-xl w-full bg-slate-800 border border-slate-700 rounded-xl p-8 shadow-2xl text-center">
        <h1 className="text-3xl font-bold text-emerald-400 mb-4">
          Disaster Victim Detection
        </h1>
        <p className="text-slate-400 mb-6">
          Full-stack application skeleton ready for development.
        </p>
        <div className="inline-block px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-lg font-medium text-sm">
          React + Vite + Tailwind CSS Skeleton
        </div>
      </div>
    </div>
  )
}

export default App
