import React, { useState } from 'react';
import { CalculationResults, FlangeInputs, TemaBoltInfo, TensioningInfo } from '../types';

interface Props {
  inputs: FlangeInputs;
  results: CalculationResults;
  temaBoltData: TemaBoltInfo[];
  tensioningData: TensioningInfo[];
}

export const ResultTable: React.FC<Props> = ({ inputs, results, temaBoltData, tensioningData }) => {
  // Set the default state of the DETAIL button to false
  const [showDetails, setShowDetails] = useState(false);
  const boltRef = temaBoltData.find(b => b.size === inputs.boltSize);
  const tensionRef = tensioningData.find(t => t.size === inputs.boltSize);

  // Spacing logic
  const physicalPitch = results.geometricPitch;
  const isPitchTooSmall = physicalPitch < results.boltSpacingMin - 0.1;
  const isPitchTooLarge = physicalPitch > results.maxBoltSpacing + 0.1;
  const spacingStatus = isPitchTooSmall ? "PITCH TOO SMALL" : (isPitchTooLarge ? "PITCH TOO LARGE" : "PITCH OK");
  const spacingStatusColor = isPitchTooSmall || isPitchTooLarge ? "bg-red-500" : "bg-emerald-500";

  const cardBaseClass = "bg-slate-50/50 p-4 rounded-xl border border-slate-100 transition-all shadow-sm";
  const cardActiveBaseClass = "bg-sky-50/50 p-4 rounded-xl border border-sky-200 transition-all shadow-md ring-1 ring-sky-100";
  
  const titleClass = "text-[11px] font-black text-sky-700 uppercase tracking-tight mb-2 block";
  const detailTextClass = "text-[9px] font-bold text-black uppercase tracking-tight leading-tight mb-1";
  const substitutionTextClass = "text-[9px] font-bold text-black lowercase italic tracking-tight mb-3";
  const resultTextClass = "text-sm font-black text-slate-700 tabular-nums flex items-baseline gap-1";

  // Check if tensioning is active
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

  // Intermediate values for hub/shell calculation
  const g0Numerator = pMpa * (inputs.insideDia / 2 + inputs.corrosionAllowance);
  const g0Denominator = (results.shellStress * inputs.jointEfficiency - 0.6 * pMpa);
  const g0ResultBeforeCorr = g0Numerator / (g0Denominator || 1);
  const g0FinalResult = g0ResultBeforeCorr + inputs.corrosionAllowance;

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

      {/* Breakdown Section */}
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
          <div className="flex justify-between text-[10px] font-bold">
            <span className="text-black">Seating ID/OD:</span>
            <span className="text-black">{results.seatingID.toFixed(1)} / {results.seatingOD.toFixed(1)} mm</span>
          </div>
        </div>

        {/* Hub Thickness Section */}
        <h3 className="text-[9px] font-black text-black uppercase tracking-widest flex items-center gap-2 mb-2 mt-4">
          <i className="fa-solid fa-tower-observation text-slate-400"></i> Hub Thickness (g1)
        </h3>
        <div className="space-y-2">
          {showDetails && (
            <div className="bg-white/50 p-2 rounded border border-slate-100 mb-2 animate-in fade-in">
              <div className={detailTextClass}>(P · (ID/2 + Corr)) / (S · E - 0.6 · P) + Corr</div>
              <div className={substitutionTextClass}>
                ({pMpa.toFixed(3)} · ({inputs.insideDia/2} + {inputs.corrosionAllowance})) / ({results.shellStress.toFixed(1)} · {inputs.jointEfficiency} - 0.6 · {pMpa.toFixed(3)}) + {inputs.corrosionAllowance} =
              </div>
            </div>
          )}
          <div className="flex justify-between text-[10px] font-bold">
            <span className="text-black">Calculated Shell Thickness (g₀):</span>
            <span className="text-black">{g0FinalResult.toFixed(2)} mm</span>
          </div>
          <div className="flex justify-between text-xs font-black pt-1 border-t border-slate-200">
            <span className="text-sky-700 uppercase">Final Hub Thickness (g1):</span>
            <span className="text-sky-700">{inputs.g1} mm</span>
          </div>
        </div>
      </div>
    </div>
  );
};