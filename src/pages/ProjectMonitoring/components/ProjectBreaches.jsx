import React from 'react';
import { AlertOctagon, AlertTriangle, Clock, ShieldAlert, ChevronRight } from 'lucide-react';

export default function ProjectBreaches({ breachMetrics, onSelectMetric }) {
  if (!breachMetrics) return null;

  const { breaches = [], dueDates = [], crExceptions = [] } = breachMetrics;

  const totalBreachCount =
    breaches.reduce((acc, curr) => acc + curr.count, 0) +
    dueDates.reduce((acc, curr) => acc + curr.count, 0) +
    crExceptions.reduce((acc, curr) => acc + curr.count, 0);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-red-500/10 text-red-400 rounded-xl border border-red-500/20">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <span>Project Breaches & Governance Exceptions</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-300 font-mono border border-red-500/30">
                {totalBreachCount} Total Exceptions
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Automated detection of SDLC SLA breaches, schedule risks, and Change Request governance issues.
            </p>
          </div>
        </div>
      </div>

      {/* 3 Main Summary Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card 11: Breaches */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-xl flex flex-col">
          <div className="p-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertOctagon className="w-5 h-5 text-red-400" />
              <h3 className="text-sm font-bold text-slate-100">Project Breaches</h3>
            </div>
            <span className="text-xs font-mono px-2 py-0.5 bg-red-500/10 text-red-400 rounded border border-red-500/20">
              Card 11
            </span>
          </div>

          <div className="p-3 divide-y divide-slate-800/60 flex-1">
            {breaches.map((item) => (
              <div
                key={item.id}
                onClick={() => onSelectMetric && onSelectMetric(item.label, item.records, item.isCR)}
                className="py-3 px-3 hover:bg-slate-800/50 rounded-lg cursor-pointer transition-colors flex items-center justify-between group"
              >
                <div className="flex items-center gap-2.5 pr-2">
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-red-400 group-hover:translate-x-0.5 transition-all shrink-0" />
                  <span className="text-xs font-medium text-slate-300 group-hover:text-slate-100">
                    {item.label}
                  </span>
                </div>
                <span
                  className={`text-xs font-mono font-bold px-2.5 py-1 rounded-full border ${
                    item.count > 0
                      ? 'bg-red-500/20 text-red-300 border-red-500/40'
                      : 'bg-slate-800/80 text-slate-500 border-slate-700/50'
                  }`}
                >
                  {item.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Card 12: Due Dates */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-xl flex flex-col">
          <div className="p-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-400" />
              <h3 className="text-sm font-bold text-slate-100">Project Due Dates</h3>
            </div>
            <span className="text-xs font-mono px-2 py-0.5 bg-amber-500/10 text-amber-400 rounded border border-amber-500/20">
              Card 12
            </span>
          </div>

          <div className="p-3 divide-y divide-slate-800/60 flex-1">
            {dueDates.map((item) => (
              <div
                key={item.id}
                onClick={() => onSelectMetric && onSelectMetric(item.label, item.records, item.isCR)}
                className="py-3.5 px-3 hover:bg-slate-800/50 rounded-lg cursor-pointer transition-colors flex items-center justify-between group"
              >
                <div className="flex items-center gap-2.5 pr-2">
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all shrink-0" />
                  <span className="text-xs font-medium text-slate-300 group-hover:text-slate-100">
                    {item.label}
                  </span>
                </div>
                <span
                  className={`text-xs font-mono font-bold px-2.5 py-1 rounded-full border ${
                    item.count > 0
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-slate-800/80 text-slate-500 border-slate-700/50'
                  }`}
                >
                  {item.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Card 13: CR Exceptions */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-xl flex flex-col">
          <div className="p-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-purple-400" />
              <h3 className="text-sm font-bold text-slate-100">CR Exceptions</h3>
            </div>
            <span className="text-xs font-mono px-2 py-0.5 bg-purple-500/10 text-purple-400 rounded border border-purple-500/20">
              Card 13
            </span>
          </div>

          <div className="p-3 divide-y divide-slate-800/60 flex-1">
            {crExceptions.map((item) => (
              <div
                key={item.id}
                onClick={() => onSelectMetric && onSelectMetric(item.label, item.records, item.isCR)}
                className="py-3 px-3 hover:bg-slate-800/50 rounded-lg cursor-pointer transition-colors flex items-center justify-between group"
              >
                <div className="flex items-center gap-2.5 pr-2">
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-purple-400 group-hover:translate-x-0.5 transition-all shrink-0" />
                  <span className="text-xs font-medium text-slate-300 group-hover:text-slate-100">
                    {item.label}
                  </span>
                </div>
                <span
                  className={`text-xs font-mono font-bold px-2.5 py-1 rounded-full border ${
                    item.count > 0
                      ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                      : 'bg-slate-800/80 text-slate-500 border-slate-700/50'
                  }`}
                >
                  {item.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
