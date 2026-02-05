import React, { useState } from 'react';
import { CalculationResults, FlangeInputs, TemaBoltInfo, TensioningInfo } from '../types';

interface Props {
  inputs: FlangeInputs;
  results: CalculationResults;
  temaBoltData: TemaBoltInfo[];
  tensioningData: TensioningInfo[];
}

export const ResultTable: React.FC<Props> = ({ inputs, results, temaBoltData, tensioningData }) => {
  // Set the default state of the DETAIL button to false (unchecked/collapsed)
  const [showDetails, setShowDetails] = useState(false);
  const boltRef = temaBoltData.find(b => b.size === inputs.boltSize);
  const tensionRef = tensioningData.find(t => t.size === inputs.boltSize);

  // Spacing logic
  const physicalPitch = results.geometricPitch;
  const isPitchTooSmall = physicalPitch < results.boltSpacingMin - 0.1;
  const isPitchTooLarge = physicalPitch > results.maxBoltSpacing + 0.1;
  const spacingStatus = isPitchTooSmall ? "PITCH TOO SMALL" : (isPitchTooLarge ? "PITCH TOO LARGE" : "PITCH OK");
  const spacingStatusColor = isPitchTooSmall || isPitchTooLarge ? "bg-red-500" : "bg-emerald-500";
  const pitchValueColor = isPitchTooSmall || isPitchTooLarge ? "text-red-600" : "text-emerald-600";

  const cardBaseClass = "bg-slate-50/50 p-4 rounded-xl border border-slate-100 transition-all shadow-sm";
  const cardActiveBaseClass = "bg-sky-50/50 p-4 rounded-xl border border-sky-200 transition-all shadow-md ring-1 ring-sky-100";
  
  const titleClass = "text-[11px] font-black text-sky-700 uppercase tracking-tight mb-2 block";
  const detailTextClass = "text-[9px] font-bold text-black uppercase tracking-tight leading-tight mb-1";
  const substitutionTextClass = "text-[9px] font-bold text-black lowercase italic tracking-tight mb-3";
  const resultTextClass = "text-sm font-black text-slate-700 tabular-nums flex items-baseline gap-1";

  // Check if tensioning is active and providing the limiting value
  const isTensioningActive = inputs.useHydraulicTensioning && tensionRef && tensionRef.B_ten >= (boltRef?.B_min || 0);
  const bVarLabel = isTensioningActive ? "B_ten" : "B_min";

  // Derive MPa pressure for display
  const pMpa = (() => {
    const p = inputs.designPressure;
    switch (inputs.pressureUnit) {
      case 'Bar': return p * 0.1;
      case 'PSI': return p * 0.00689476;
      case 'kg/cm²': return p * 0.0980665;
      default: return p;
    }
  })();

  // Intermediate values for g0 calculation following updated process: (P·(ID/2+Corr)) / (S·E - 0.6·P) + Corr
  const g0Numerator = pMpa * (inputs.insideDia / 2 + inputs.corrosionAllowance);
  const g0Denominator = (results.shellStress * inputs.jointEfficiency - 0.6 * pMpa);
  const g0ResultBeforeCorr = g0Numerator / (g0Denominator || 1);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 uppercase tracking-tighter">
          <i className="fa-solid fa-list-ol text-sky-600"></i> BCD Calculation
        </h2>
        <button 
          onClick={() => setShowDetails(!showDetails)}
          className={`text-[8px] font-black px-4 py-1.5 rounded-full transition-all flex items-center gap-2 border ${
            showDetails 
            ? 'bg-sky-600 text-white border-sky-600 shadow-md shadow-sky-100' 
            : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'
          }`}
        >
          <i className={`fa-solid ${showDetails ? 'fa-eye-slash' : 'fa-eye'}`}></i>
          DETAIL
        </button>
      </div>

      {/* Method Cards */}
      <div className="grid grid-cols-1 gap-3">
        {/* Method 1 */}
        <div className={results.selectedBcdSource === 1 ? cardActiveBaseClass : cardBaseClass}>
          <div className="flex justify-between items-start mb-1">
            <span className={titleClass}>1. TEMA MIN PITCH</span>
            {results.selectedBcdSource === 1 && (
              <span className="text-[8px] bg-sky-600 text-white px-2 py-0.5 rounded-full font-black uppercase">MAX</span>
            )}
          </div>
          
          {showDetails && (
            <div className="animate-in fade-in duration-300">
              <div className={detailTextClass}>({bVarLabel} × Bolt EA) / π</div>
              <div className={substitutionTextClass}>
                ({results.effectiveBMin.toFixed(4)}" × {inputs.boltCount}) / π =
              </div>
            </div>
          )}
          
          <div className={resultTextClass}>
            {results.bcdMethod1.toFixed(0)} <small className="text-[10px] text-black">mm</small>
          </div>
        </div>

        {/* Method 2 */}
        <div className={results.selectedBcdSource === 2 ? cardActiveBaseClass : cardBaseClass}>
          <div className="flex justify-between items-start mb-1">
            <span className={titleClass}>2. HUB / RADIAL LOGIC</span>
            {results.selectedBcdSource === 2 && (
              <span className="text-[8px] bg-sky-600 text-white px-2 py-0.5 rounded-full font-black uppercase">MAX</span>
            )}
          </div>

          {showDetails && (
            <div className="animate-in fade-in duration-300">
              <div className={detailTextClass}>ID + (g1 × 2) + (R × 2)</div>
              <div className={substitutionTextClass}>
                {inputs.insideDia} + ({inputs.g1} × 2) + ({boltRef?.R.toFixed(4)}" × 2) =
              </div>
            </div>
          )}

          <div className={resultTextClass}>
            {results.bcdMethod2.toFixed(0)} <small className="text-[10px] text-black">mm</small>
          </div>
        </div>

        {/* Method 3 */}
        <div className={results.selectedBcdSource === 3 ? cardActiveBaseClass : cardBaseClass}>
          <div className="flex justify-between items-start mb-1">
            <span className={titleClass}>3. GASKET & CLEARANCE</span>
            {results.selectedBcdSource === 3 && (
              <span className="text-[8px] bg-sky-600 text-white px-2 py-0.5 rounded-full font-black uppercase">MAX</span>
            )}
          </div>

          {showDetails && (
            <div className="animate-in fade-in duration-300">
              <div className={detailTextClass}>ID + 2*A + 2*IR + 2*N + 2*OR + 1.5*2 + 2*C + BoltHole</div>
              <div className={substitutionTextClass}>
                {inputs.insideDia} + (2 × {results.shellGapA}) + (2 × {results.innerRingWidth}) + (2 × {inputs.gasketSeatingWidth}) + (2 × {results.outerRingWidth}) + 3 + (2 × {results.effectiveC}) + {results.boltHoleSize.toFixed(0)} =
              </div>
            </div>
          )}

          <div className={resultTextClass}>
            {results.bcdMethod3.toFixed(0)} <small className="text-[10px] text-black">mm</small>
          </div>
        </div>
      </div>

      {/* Bolt Spacing Info */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex justify-between items-center mb-1">
          <h3 className="text-[9px] font-black text-black uppercase tracking-widest flex items-center gap-2">
            <i className="fa-solid fa-arrows-left-right text-slate-400"></i> Bolt Spacing Info
          </h3>
          <span className={`${spacingStatusColor} text-white text-[8px] font-black px-2 py-0.5 rounded uppercase`}>
            {spacingStatus}
          </span>
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px] font-bold">
            <span className="text-black">Min Allowable Pitch:</span>
            <span className="text-black tabular-nums">{results.boltSpacingMin.toFixed(2)} mm</span>
          </div>
          <div className="flex justify-between text-[10px] font-bold">
            <span className="text-black italic">Geometric Pitch:</span>
            <span className="text-black tabular-nums">{physicalPitch.toFixed(2)} mm</span>
          </div>
          <div className="flex justify-between text-[10px] font-bold border-t border-slate-50 pt-1.5">
            <span className="text-black italic">Max bolt pitch (WHC Standard):</span>
            <span className="text-black tabular-nums border-b border-dotted border-black">{results.maxBoltSpacing.toFixed(2)} mm</span>
          </div>
        </div>
      </div>

      {/* Gasket Breakdown */}
      <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 space-y-3">
        <h3 className="text-[9px] font-black text-black uppercase tracking-widest flex items-center gap-2 mb-2">
          <i className="fa-solid fa-circle-info text-slate-400"></i> Gasket Breakdown
        </h3>
        <div className="space-y-2">
          <div className="flex justify-between text-[10px] font-bold">
            <span className="text-black">Inner Ring (IR):</span>
            <span className="text-black">{results.innerRingWidth.toFixed(1)} mm</span>
          </div>
          <div className="flex justify-between text-[10px] font-bold">
            <span className="text-black">Outer Ring (OR):</span>
            <span className="text-black">{results.outerRingWidth.toFixed(1)} mm</span>
          </div>
          
          <div className="pt-2 border-t border-slate-200/50 space-y-2">
            <div>
              <div className="flex justify-between items-baseline">
                <span className="text-[10px] font-bold text-sky-700">Gasket Seal OD:</span>
                <span className="text-[11px] font-black text-sky-800 border-b-2 border-sky-200 tabular-nums">{results.seatingOD.toFixed(0)} mm</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-baseline">
                <span className="text-[10px] font-bold text-sky-700">Gasket Seal ID:</span>
                <span className="text-[11px] font-black text-sky-800 border-b-2 border-sky-200 tabular-nums">{results.seatingID.toFixed(0)} mm</span>
              </div>
            </div>
            
            <div className="pt-2">
              <div className="flex justify-between items-baseline">
                <span className="text-[10px] font-black text-slate-800 uppercase">TOTAL GASKET O.D</span>
                <span className="text-[11px] font-black text-slate-900 tabular-nums">{results.gasketOD.toFixed(1)} mm</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Flange OD Section */}
      <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100/50 space-y-3">
        <h3 className="text-[9px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-2">
          <i className="fa-solid fa-expand"></i> Flange OD
        </h3>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-amber-500 italic">Formula:</span>
            <span className="text-[10px] font-black text-slate-700">BCD + (2 × E)</span>
          </div>
          <div className="flex justify-between items-center border-t border-amber-200/50 pt-2">
            <span className="text-[10px] font-bold text-black tabular-nums">
              {results.finalBCD.toFixed(1)} + (2 × {results.edgeDistance.toFixed(2)})
            </span>
            <span className="text-sm font-black text-amber-700 flex items-baseline gap-1">
              = {results.finalOD.toFixed(0)} <small className="text-[10px] text-black">mm</small>
            </span>
          </div>
        </div>
      </div>

      {/* g0 Calculation Section */}
      <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 space-y-3 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-500">
        <h3 className="text-[9px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2">
          <i className="fa-solid fa-calculator"></i> Minimum Hub Thickness (g₀)
        </h3>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-indigo-500 italic">Formula:</span>
            <span className="text-[10px] font-black text-slate-700 font-mono tracking-tighter">(P·(ID/2+Corr)) / (S·E - 0.6·P) + Corr</span>
          </div>
          <div className="pt-2 border-t border-indigo-200/50">
             {showDetails && (
               <div className="mb-2 p-2 bg-white/60 rounded border border-indigo-50 space-y-2">
                  <div>
                    <div className="text-[9px] font-bold text-black uppercase mb-1">Process Substitution:</div>
                    <div className="text-[9px] font-mono text-slate-600 leading-relaxed italic">
                      ({pMpa.toFixed(3)} × ({inputs.insideDia}/2 + {inputs.corrosionAllowance})) / ({results.shellStress.toFixed(1)} × {inputs.jointEfficiency} - 0.6 × {pMpa.toFixed(3)}) + {inputs.corrosionAllowance}
                    </div>
                  </div>
                  <div className="pt-1 border-t border-indigo-50/50">
                    <div className="text-[9px] font-bold text-black uppercase mb-1">Numerical Result:</div>
                    <div className="text-[9px] font-mono text-indigo-600 font-black">
                      {g0Numerator.toFixed(3)} / {g0Denominator.toFixed(3)} + {inputs.corrosionAllowance}
                      <span className="ml-2 text-slate-400">= {g0ResultBeforeCorr.toFixed(3)} + {inputs.corrosionAllowance}</span>
                    </div>
                  </div>
               </div>
             )}
             <div className="flex justify-between text-[10px] font-bold mb-1">
                <span className="text-slate-500">Shell Allowable Stress (S):</span>
                <span className="text-slate-700">{results.shellStress.toFixed(1)} MPa</span>
             </div>
             <div className="flex justify-between items-center border-t border-indigo-100/50 pt-1 mt-1">
               <span className="text-[10px] font-bold text-black uppercase">Final g₀ (rounded up):</span>
               <span className="text-sm font-black text-indigo-700 flex items-baseline gap-1">
                 = {inputs.g0} <small className="text-[10px] text-black">mm</small>
               </span>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};