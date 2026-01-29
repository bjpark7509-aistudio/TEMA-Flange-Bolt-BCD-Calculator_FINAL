import React from 'react';
import { CalculationResults, FlangeInputs } from '../types';

interface Props {
  inputs: FlangeInputs;
  results: CalculationResults;
}

export const FlangeDiagram: React.FC<Props> = ({ inputs, results }) => {
  const size = 260; 
  const padding = 15; 
  const centerX = size / 2;
  const centerY = size / 2;
  
  const maxDim = Math.max(results.finalOD, results.finalBCD + 40);
  const scale = (size - (padding * 2)) / maxDim;

  const rOD = (results.finalOD / 2) * scale;
  const rBCD = (results.finalBCD / 2) * scale;
  const rID = (inputs.insideDia / 2) * scale;
  
  const rGasketID = (results.gasketID / 2) * scale;     // Start of Inner Ring
  const rSeatingID = (results.seatingID / 2) * scale;   // End of IR / Start of Seating
  const rSeatingOD = (results.seatingOD / 2) * scale;   // End of Seating / Start of OR
  const rGasketOD = (results.gasketOD / 2) * scale;     // End of Outer Ring

  const getRingPath = (innerR: number, outerR: number) => {
    return `M ${centerX-outerR},${centerY} A ${outerR},${outerR} 0 1,1 ${centerX+outerR},${centerY} A ${outerR},${outerR} 0 1,1 ${centerX-outerR},${centerY}
            M ${centerX-innerR},${centerY} A ${innerR},${innerR} 0 1,0 ${centerX+innerR},${centerY} A ${innerR},${innerR} 0 1,0 ${centerX-innerR},${centerY}`;
  };

  const bolts = Array.from({ length: inputs.boltCount }).map((_, i) => {
    const angle = (i * 360 / inputs.boltCount - 90) * (Math.PI / 180);
    return {
      x: centerX + rBCD * Math.cos(angle),
      y: centerY + rBCD * Math.sin(angle)
    };
  });

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="drop-shadow-xl">
        <defs>
          <radialGradient id="flangeGrad" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
            <stop offset="0%" stopColor="#f1f5f9" />
            <stop offset="100%" stopColor="#cbd5e1" />
          </radialGradient>
          <filter id="innerShadow">
             <feComponentTransfer in="SourceAlpha">
               <feFuncA type="table" tableValues="1 0" />
             </feComponentTransfer>
             <feGaussianBlur stdDeviation="3" />
             <feOffset dx="0" dy="2" result="offsetblur" />
             <feFlood floodColor="black" floodOpacity="0.1" />
             <feComposite in2="offsetblur" operator="in" />
             <feComposite in2="SourceAlpha" operator="in" />
             <feMerge>
               <feMergeNode />
               <feMergeNode in="SourceGraphic" />
             </feMerge>
          </filter>
        </defs>

        <circle cx={centerX} cy={centerY} r={rOD} fill="url(#flangeGrad)" stroke="#94a3b8" strokeWidth="2" />
        
        {bolts.map((bolt, i) => (
          <circle key={`hole-${i}`} cx={bolt.x} cy={bolt.y} r={Math.max(1.2, 3 * scale * 5)} fill="#cbd5e1" stroke="#94a3b8" strokeWidth="0.5" />
        ))}

        <path d={getRingPath(rGasketID, rSeatingID)} fill="#64748b" opacity="0.4" stroke="#475569" strokeWidth="0.5" />
        <path d={getRingPath(rSeatingID, rSeatingOD)} fill="#0ea5e9" opacity="0.8" stroke="#0369a1" strokeWidth="1" filter="url(#innerShadow)" />
        <path d={getRingPath(rSeatingOD, rGasketOD)} fill="#64748b" opacity="0.4" stroke="#475569" strokeWidth="0.5" />

        <circle cx={centerX} cy={centerY} r={rID} fill="#ffffff" stroke="#1e293b" strokeWidth="2" />

        <circle cx={centerX} cy={centerY} r={rBCD} fill="none" stroke="#0284c7" strokeWidth="1" strokeDasharray="6 4" opacity="0.5" />

        {bolts.map((bolt, i) => (
          <g key={`bolt-${i}`}>
             <circle cx={bolt.x} cy={bolt.y} r={Math.max(1.2, 3 * scale * 8)} fill="#334155" />
             <circle cx={bolt.x - 0.5} cy={bolt.y - 0.5} r={Math.max(0.4, 1.2 * scale * 8)} fill="#94a3b8" opacity="0.3" />
          </g>
        ))}

        <line x1={centerX - 6} y1={centerY} x2={centerX + 6} y2={centerY} stroke="#64748b" strokeWidth="1" opacity="0.5" />
        <line x1={centerX} y1={centerY - 6} x2={centerX} y2={centerY + 6} stroke="#64748b" strokeWidth="1" opacity="0.5" />
      </svg>
      
      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-[8px] text-slate-500 uppercase tracking-widest font-black">
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-slate-200 border border-slate-400"></span> Flange Body</div>
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-sky-500"></span> Seating Element</div>
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-slate-400"></span> Ring Metal</div>
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-slate-700"></span> Bolt Head</div>
      </div>
    </div>
  );
};