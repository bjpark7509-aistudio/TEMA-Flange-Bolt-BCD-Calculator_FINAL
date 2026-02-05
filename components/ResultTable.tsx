import React, { useState } from 'react';
import { CalculationResults, FlangeInputs, TemaBoltInfo, TensioningInfo } from '../types';

interface Props {
  inputs: FlangeInputs;
  results: CalculationResults;
  temaBoltData: TemaBoltInfo[];
  tensioningData: TensioningInfo[];
}

export const ResultTable: React.FC<Props> = ({ inputs, results, temaBoltData, tensioningData }) => {
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

  // Visual Styles for the breakdown cards
  const breakdownLabelClass = "text-[11px] font-bold text-slate-700 uppercase";
  const breakdownValueClass = "text-[12px] font-black text-slate-900 tabular-nums";
  const breakdownUnderlineClass = "border-b-2 border-sky-100 pb-0.5 px-1";

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
            {results.bcdMethod1.toFixed(0)} <small className="text-[10px] text-black font-bold">mm</small>
          </div>
        </div>

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
            {results.bcdMethod2.toFixed(0)} <small className="text-[10px] text-black font-bold">mm</small>
          </div>
        </div>

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
            {results.bcdMethod3.toFixed(0)} <small className="text-[10px] text-black font-bold">mm</small>
          </div>
        </div>
      </div>

      {/* Breakdown Section: Styled as per reference image */}
      <div className="space-y-4 pt-2">
        {/* Card 1: Gasket Breakdown */}
        <div className="bg-sky-50/40 p-5 rounded-2xl border border-sky-100 shadow-sm space-y-4">
          <h3 className="text-[11px] font-black text-sky-800 uppercase tracking-widest flex items-center gap-2">
            <i className="fa-solid fa-circle-info opacity-40"></i> Gasket Breakdown
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className={breakdownLabelClass}>Inner Ring (IR):</span>
              <span className={breakdownValueClass}>{results.innerRingWidth.toFixed(1)} mm</span>
            </div>
            <div className="flex justify-between items-center">
              <span className={breakdownLabelClass}>Outer Ring (OR):</span>
              <span className={breakdownValueClass}>{results.outerRingWidth.toFixed(1)} mm</span>
            </div>
            <div className="w-full h-px bg-sky-200/50 my-2"></div>
            <div className="flex justify-between items-center">
              <span className={breakdownLabelClass}>Gasket Seal OD:</span>
              <span className={`${breakdownValueClass} ${breakdownUnderlineClass}`}>{results.seatingOD.toFixed(0)} mm</span>
            </div>
            <div className="flex justify-between items-center">
              <span className={breakdownLabelClass}>Gasket Seal ID:</span>
              <span className={`${breakdownValueClass} ${breakdownUnderlineClass}`}>{results.seatingID.toFixed(0)} mm</span>
            </div>
            <div className="flex justify-between items-center pt-2">
              <span className="text-[11px] font-black text-slate-800 uppercase">Total Gasket O.D</span>
              <span className="text-[14px] font-black text-slate-900">{results.gasketOD.toFixed(1)} mm</span>
            </div>
          </div>
        </div>

        {/* Card 2: Flange OD */}
        <div className="bg-amber-50/40 p-5 rounded-2xl border border-amber-100 shadow-sm space-y-4">
          <h3 className="text-[11px] font-black text-amber-800 uppercase tracking-widest flex items-center gap-2">
            <i className="fa-solid fa-expand opacity-40"></i> Flange OD
          </h3>
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold italic text-amber-600">Formula:</span>
              <span className="text-[10px] font-bold text-amber-800">BCD + (2 × E)</span>
            </div>
            <div className="w-full h-px bg-amber-200/50 my-2"></div>
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-bold text-slate-700 font-mono">
                {results.finalBCD.toFixed(1)} + (2 × {results.edgeDistance.toFixed(2)})
              </span>
              <span className="text-[14px] font-black text-slate-900 flex items-center gap-1">
                <span className="text-amber-600 font-bold">=</span> {results.finalOD.toFixed(0)} <small className="text-[10px] font-black uppercase">mm</small>
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Minimum Hub Thickness */}
        <div className="bg-indigo-50/40 p-5 rounded-2xl border border-indigo-100 shadow-sm space-y-4">
          <h3 className="text-[11px] font-black text-indigo-800 uppercase tracking-widest flex items-center gap-2">
            <i className="fa-solid fa-calculator opacity-40"></i> Minimum Hub Thickness (g₀)
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-start gap-4">
              <span className="text-[10px] font-bold italic text-indigo-500">Formula:</span>
              <span className="text-[9px] font-mono text-indigo-800 text-right">(P · (ID/2 + Corr)) / (S · E - 0.6 · P) + Corr</span>
            </div>
            <div className="w-full h-px bg-indigo-200/50 my-1"></div>
            <div className="flex justify-between items-center">
              <span className={breakdownLabelClass}>Shell Allowable Stress (S):</span>
              <span className={breakdownValueClass}>{results.shellStress.toFixed(1)} MPa</span>
            </div>
            <div className="flex justify-between items-center pt-1">
              <span className="text-[11px] font-black text-indigo-700 uppercase">Final g₀ (Rounded Up):</span>
              <span className="text-[14px] font-black text-indigo-600 flex items-center gap-1">
                <span className="font-bold">=</span> {inputs.g0} <small className="text-[10px] font-black uppercase">mm</small>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
