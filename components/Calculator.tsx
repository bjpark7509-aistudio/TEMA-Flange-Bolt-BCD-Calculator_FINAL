
import React, { useState, useRef, useEffect } from 'react';
import { FlangeInputs, CalculationResults, BoltMaterial, ShellMaterial, TemaBoltInfo, GasketType, RingStandard } from '../types';

interface Props {
  inputs: FlangeInputs;
  onInputChange: (updatedInputs: FlangeInputs, changedFieldName: string) => void;
  onOptimize?: (customInputs?: FlangeInputs) => void;
  onResetOptimize?: () => void;
  onGlobalReset?: () => void;
  onClearRecords?: () => void;
  onLoad?: () => void;
  results: CalculationResults;
  boltMaterials: BoltMaterial[];
  plateMaterials: ShellMaterial[];
  temaBoltData: TemaBoltInfo[];
  gasketTypes: GasketType[];
  ringStandards: RingStandard[];
}

export const Calculator: React.FC<Props> = ({ inputs, onInputChange, onOptimize, onResetOptimize, onGlobalReset, onClearRecords, onLoad, results, boltMaterials, plateMaterials, temaBoltData, gasketTypes, ringStandards }) => {
  const [isLegendZoomed, setIsLegendZoomed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [localManualValues, setLocalManualValues] = useState({
    actualBCD: inputs.actualBCD,
    actualOD: inputs.actualOD,
    manualM: inputs.manualM,
    manualY: inputs.manualY,
    manualPassM: inputs.manualPassM,
    manualPassY: inputs.manualPassY,
    manualSeatingID: inputs.manualSeatingID,
    manualSeatingOD: inputs.manualSeatingOD,
  });

  useEffect(() => {
    setLocalManualValues({
      actualBCD: inputs.actualBCD,
      actualOD: inputs.actualOD,
      manualM: inputs.manualM,
      manualY: inputs.manualY,
      manualPassM: inputs.manualPassM,
      manualPassY: inputs.manualPassY,
      manualSeatingID: inputs.manualSeatingID,
      manualSeatingOD: inputs.manualSeatingOD,
    });
  }, [inputs.actualBCD, inputs.actualOD, inputs.manualM, inputs.manualY, inputs.manualPassM, inputs.manualPassY, inputs.manualSeatingID, inputs.manualSeatingOD, inputs.useManualOverride]);

  const updatePcc1Values = (gasketType: string, currentInputs: FlangeInputs) => {
    const typeLower = gasketType.toLowerCase();
    let nextInputs = { ...currentInputs };

    if (typeLower.includes('grooved')) {
      nextInputs.sgMax = 380;
      nextInputs.sgMinS = 140;
      nextInputs.sgMinO = 97;
    } else if (typeLower.includes('corruga')) {
      nextInputs.sgMax = 275;
      nextInputs.sgMinS = 140;
      nextInputs.sgMinO = 97;
    } else if (typeLower.includes('spiral')) {
      nextInputs.sgMax = 0;
      nextInputs.sgMinS = 140;
      nextInputs.sgMinO = 97;
    }

    const mat = boltMaterials.find(m => m.id === nextInputs.boltMaterial);
    if (mat && mat.minYield) {
      nextInputs.sbMax = Math.round(mat.minYield * 0.7 * 10) / 10;
      nextInputs.sbMin = Math.round(mat.minYield * 0.4 * 10) / 10;
    }
    return nextInputs;
  };

  const manualFieldNames = ['actualBCD', 'actualOD', 'manualM', 'manualY', 'manualPassM', 'manualPassY', 'manualSeatingID', 'manualSeatingOD'];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    if (manualFieldNames.includes(name)) {
      setLocalManualValues(prev => ({
        ...prev,
        [name]: parseFloat(value) || 0
      }));
      return;
    }
    let nextInputs = { ...inputs };
    if (type === 'checkbox') {
      nextInputs = { ...nextInputs, [name]: (e.target as HTMLInputElement).checked };
    } else if (['tempUnit', 'pressureUnit', 'shellMaterial', 'boltMaterial', 'gasketType', 'passGasketType', 'facingSketch', 'itemNo', 'partName'].includes(name)) {
      nextInputs = { ...nextInputs, [name]: value };
      if (nextInputs.usePcc1Check && (name === 'gasketType' || name === 'boltMaterial')) {
        nextInputs = updatePcc1Values(nextInputs.gasketType, nextInputs);
      }
    } else {
      const val = parseFloat(value) || 0;
      nextInputs = { ...nextInputs, [name]: val };
      if (name === 'g0') {
        nextInputs.g1 = Math.ceil(val * 1.3 / 3 + val);
      }
    }
    onInputChange(nextInputs, name);
  };

  // Improved trigger to ensure local UI changes are included in optimization
  const handleTriggerOptimize = () => {
    const combinedInputs = { ...inputs, ...localManualValues };
    onOptimize?.(combinedInputs);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onInputChange({ ...inputs, customLegendUrl: reader.result as string }, 'customLegendUrl');
      };
      reader.readAsDataURL(file);
    }
  };

  const clearCustomLegend = (e: React.MouseEvent) => {
    e.stopPropagation();
    onInputChange({ ...inputs, customLegendUrl: undefined }, 'customLegendUrl');
  };

  const toggleManualMode = () => onInputChange({ ...inputs, useManualOverride: !inputs.useManualOverride }, 'useManualOverride');
  const togglePcc1Check = () => {
    let nextInputs = { ...inputs, usePcc1Check: !inputs.usePcc1Check };
    if (nextInputs.usePcc1Check) nextInputs = updatePcc1Values(inputs.gasketType, nextInputs);
    onInputChange(nextInputs, 'usePcc1Check');
  };
  const toggleHydraulicTensioning = () => onInputChange({ ...inputs, useHydraulicTensioning: !inputs.useHydraulicTensioning }, 'useHydraulicTensioning');

  const applyGasketBounds = (id: number, od: number, preference: 'bcd' | 'shell') => {
    const nextInputs = {
      ...inputs,
      gasketPreference: preference,
      manualSeatingID: parseFloat(id.toFixed(2)),
      manualSeatingOD: parseFloat(od.toFixed(2))
    };
    onInputChange(nextInputs, 'apply_gasket_logic');
    setLocalManualValues(prev => ({
      ...prev,
      manualSeatingID: parseFloat(id.toFixed(2)),
      manualSeatingOD: parseFloat(od.toFixed(2))
    }));
  };

  const resetGasketStandard = () => {
    const nextInputs = {
      ...inputs,
      cClearance: 2.5,
      shellGapA: 3.0,
      innerRingWidthManual: 0,
      outerRingWidthManual: 0,
      hasInnerRing: true,
      hasOuterRing: true,
      useManualOverride: inputs.useManualOverride,
      gasketPreference: undefined, 
      manualM: 0, manualY: 0, manualPassM: 0, manualPassY: 0,
      manualSeatingID: 0, manualSeatingOD: 0,
      actualBCD: 0, actualOD: 0,
      useHydraulicTensioning: false,
      passPartitionWidth: 0, passPartitionLength: 0, passPartAreaReduction: 50,
      phiFMax: 0.32, phiGMax: 1, g: 0.7
    };
    onInputChange(nextInputs, 'reset');
  };

  const inputClass = "w-full px-3 py-2 bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-sky-500 transition-all text-sm font-mono";
  const disabledInputClass = "w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-gray-400 cursor-not-allowed text-sm opacity-60";
  const selectClass = "px-2 py-2 bg-gray-50 border border-gray-300 rounded-md focus:ring-2 focus:ring-sky-500 transition-all text-xs font-bold";
  const labelClass = "block text-[11px] font-bold text-gray-500 mb-1 uppercase tracking-wider";

  const ringConfig = ringStandards.find(r => inputs.insideDia >= r.min && inputs.insideDia <= r.max) || ringStandards[ringStandards.length-1];
  const currentIR = inputs.hasInnerRing ? (inputs.innerRingWidthManual || ringConfig.irMin) : 0;

  const s1OD = results.maxRaisedFace; 
  const s2OD = inputs.insideDia + (2 * (inputs.shellGapA || 3.0)) + (2 * currentIR) + (2 * inputs.gasketSeatingWidth); 

  const isSug1Active = inputs.useManualOverride ? Math.abs(localManualValues.manualSeatingOD - s1OD) < 0.1 : Math.abs(results.seatingOD - s1OD) < 0.1;
  const isSug2Active = !isSug1Active && (inputs.useManualOverride ? Math.abs(localManualValues.manualSeatingOD - s2OD) < 0.1 : Math.abs(results.seatingOD - s2OD) < 0.1);

  const filteredBolts = temaBoltData.filter(b => b.size >= 0.75);

  const LegendSVG = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 600 320" className={className} style={{backgroundColor: 'black'}}>
      <defs>
        <pattern id="hatch-white" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="white" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="600" height="320" fill="black" />
      <g stroke="#0000ff" strokeWidth="1.2">
        <line x1="10" y1="140" x2="185" y2="140" /> <line x1="10" y1="180" x2="185" y2="180" />
        <line x1="10" y1="210" x2="185" y2="210" /> <line x1="10" y1="280" x2="185" y2="280" />
        <line x1="10" y1="310" x2="185" y2="310" /> <line x1="20" y1="140" x2="20" y2="180" />
        <line x1="20" y1="210" x2="20" y2="280" /> <line x1="20" y1="280" x2="20" y2="310" />
        <line x1="365" y1="15" x2="590" y2="15" /> <line x1="365" y1="90" x2="590" y2="90" />
        <line x1="365" y1="225" x2="590" y2="225" /> <line x1="510" y1="265" x2="590" y2="265" />
        <line x1="510" y1="310" x2="590" y2="310" /> <line x1="585" y1="15" x2="585" y2="90" />
        <line x1="585" y1="90" x2="585" y2="225" /> <line x1="585" y1="225" x2="585" y2="265" />
        <line x1="585" y1="265" x2="585" y2="310" /> <line x1="185" y1="210" x2="245" y2="210" />
        <line x1="185" y1="280" x2="245" y2="280" />
      </g>
      <g stroke="white" strokeWidth="1.5" fill="none">
        <path d="M 185,15 L 360,15 L 360,130 L 225,130 L 225,180 L 185,180 Z" />
        <line x1="185" y1="55" x2="360" y2="55" /> <line x1="185" y1="90" x2="360" y2="90" />
        <path d="M 225,210 L 225,310 L 515,310 L 515,265 L 360,225 L 360,130" />
      </g>
      <g>
        <rect x="200" y="210" width="25" height="70" fill="red" />
        <rect x="200" y="210" width="25" height="70" fill="url(#hatch-white)" />
      </g>
      <g>
        <line x1="140" y1="90" x2="600" y2="90" stroke="red" strokeWidth="1.8" strokeDasharray="14 4 2 4" />
        <text x="310" y="90" fill="white" fontSize="24" fontWeight="900" textAnchor="middle" dominantBaseline="middle" fontFamily="Arial">BCD</text>
      </g>
      <g fill="white" fontSize="20" fontWeight="bold" fontFamily="Arial">
        <text x="35" y="155">C</text> <text x="30" y="195">1.5MM</text>
        <text x="160" y="248" textAnchor="end">GASKET</text> <text x="35" y="295">A</text>
        <text x="570" y="55" textAnchor="end">E</text> <text x="570" y="160" textAnchor="end">R</text>
        <text x="570" y="245" textAnchor="end">G1</text> <text x="570" y="290" textAnchor="end">G0</text>
      </g>
    </svg>
  );

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      <div className="flex justify-between items-center mb-4 border-b pb-3">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2 uppercase tracking-tighter">
          <i className="fa-solid fa-sliders text-sky-600"></i> INPUT Data
        </h2>
        <div className="flex gap-2">
           <button onClick={() => fileInputRef.current?.click()} className="text-[9px] bg-slate-800 hover:bg-black text-white px-3 py-1.5 rounded-full font-black flex items-center gap-2 transition-all shadow-sm">
            <i className="fa-solid fa-image-portrait"></i> Legend Change
          </button>
          <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
        </div>
      </div>

      <div className="mb-6 p-4 bg-white rounded-xl border border-gray-200 overflow-hidden relative shadow-lg cursor-zoom-in hover:border-sky-300 transition-colors group" onClick={() => setIsLegendZoomed(true)}>
        {inputs.customLegendUrl ? (
          <div className="relative w-full flex justify-center">
            <img src={inputs.customLegendUrl} alt="Custom Legend" className="w-full h-auto max-h-[320px] object-contain rounded" />
            <button onClick={clearCustomLegend} className="absolute top-2 right-2 bg-red-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-[10px] hover:bg-red-700 opacity-0 group-hover:opacity-100 transition-opacity">
              <i className="fa-solid fa-trash-can"></i>
            </button>
          </div>
        ) : (
          <LegendSVG className="w-full h-auto" />
        )}
      </div>

      {isLegendZoomed && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" onClick={() => setIsLegendZoomed(false)}></div>
          <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl p-6 overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-4 border-b pb-3">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Engineering Legend</h3>
              <button onClick={() => setIsLegendZoomed(false)} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-all"><i className="fa-solid fa-xmark text-lg"></i></button>
            </div>
            <div className="bg-white rounded-lg p-2 overflow-auto max-h-[75vh] flex justify-center">
               {inputs.customLegendUrl ? <img src={inputs.customLegendUrl} alt="Custom Legend Enlarged" className="w-full h-auto object-contain" /> : <LegendSVG className="w-full h-auto" />}
            </div>
          </div>
        </div>
      )}
      
      <div className="space-y-6">
        <section className="space-y-3 bg-red-50 p-4 rounded-lg border border-red-100 shadow-sm">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-xs font-black text-red-600 border-l-4 border-red-500 pl-2 uppercase tracking-tighter">Design Condition</h3>
            <div className="flex gap-1">
              <button onClick={onLoad} className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-sm"><i className="fa-solid fa-cloud-arrow-up"></i> LOAD</button>
              <button onClick={onGlobalReset} className="bg-slate-700 hover:bg-black text-white px-3 py-1 rounded text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-sm"><i className="fa-solid fa-rotate-left"></i> RESET</button>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelClass}>ITEM NO</label><input type="text" name="itemNo" value={inputs.itemNo || ''} onChange={handleChange} className={inputClass} /></div>
            <div><label className={labelClass}>PART</label><input type="text" name="partName" value={inputs.partName || ''} onChange={handleChange} className={inputClass} /></div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelClass}>Pressure</label><div className="flex gap-1"><input type="number" name="designPressure" value={inputs.designPressure} onChange={handleChange} className={inputClass} /><select name="pressureUnit" value={inputs.pressureUnit} onChange={handleChange} className={selectClass}><option value="MPa">MPa</option><option value="Bar">Bar</option><option value="PSI">PSI</option><option value="kg/cm²">kg/cm²</option></select></div></div>
            <div><label className={labelClass}>Temp</label><div className="flex gap-1"><input type="number" name="designTemp" value={inputs.designTemp} onChange={handleChange} className={inputClass} /><select name="tempUnit" value={inputs.tempUnit} onChange={handleChange} className={selectClass}><option value="°C">°C</option><option value="°F">°F</option><option value="K">K</option></select></div></div>
          </div>

          <div className="pt-2 grid grid-cols-2 gap-4">
            <div><label className={labelClass}>Joint Efficiency (E)</label><select name="jointEfficiency" value={inputs.jointEfficiency} onChange={handleChange} className={inputClass}><option value="1">1.0</option><option value="0.85">0.85</option></select></div>
            <div><label className={labelClass}>Corrosion (mm)</label><input type="number" name="corrosionAllowance" value={inputs.corrosionAllowance} onChange={handleChange} className={inputClass} /></div>
          </div>

          <div className="pt-2"><label className={labelClass}>Shell Material</label><select name="shellMaterial" value={inputs.shellMaterial} onChange={handleChange} className={inputClass}>{plateMaterials.map(mat => <option key={mat.id} value={mat.id}>{mat.id}</option>)}</select></div>
          <div className="pt-2"><label className={labelClass}>Bolt Material</label><select name="boltMaterial" value={inputs.boltMaterial} onChange={handleChange} className={inputClass}>{boltMaterials.map(mat => <option key={mat.id} value={mat.id}>{mat.id}</option>)}</select></div>
          <div className="pt-2"><label className={labelClass}>Facing Sketch</label><select name="facingSketch" value={inputs.facingSketch} onChange={handleChange} className={inputClass}>{["1a: Flat Face / Groove", "1b: Flat Face", "1c: Tongue & Groove", "1d: Flat Face w/ Nubbin", "2: Ring Joint"].map(sk => <option key={sk} value={sk}>{sk}</option>)}</select></div>
          <div className="pt-2"><label className={labelClass}>Gasket Type (Flange)</label><select name="gasketType" value={inputs.gasketType} onChange={handleChange} className={inputClass}>{gasketTypes.map(g => <option key={g.id} value={g.id}>{g.id}</option>)}</select></div>
          <div className="pt-2"><label className={labelClass}>Gasket Type (Pass)</label><select name="passGasketType" value={inputs.passGasketType} onChange={handleChange} className={inputClass}>{gasketTypes.map(g => <option key={g.id} value={g.id}>{g.id}</option>)}</select></div>
        </section>

        <section className="space-y-3 bg-slate-50 p-4 rounded-lg border border-slate-100">
          <h3 className="text-xs font-black text-slate-500 border-l-4 border-slate-400 pl-2 mb-3 uppercase tracking-tighter flex justify-between items-center">
            <span>Shell & Hub Geometry</span>
            <div className="flex items-center gap-1">
              <button onClick={handleTriggerOptimize} className="text-[9px] bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded-full font-black flex items-center gap-1 transition-all shadow-sm"><i className="fa-solid fa-play text-[7px]"></i> START</button>
              <button onClick={onResetOptimize} className="text-[9px] bg-slate-600 hover:bg-slate-700 text-white px-3 py-1 rounded-full font-black flex items-center gap-1 transition-all shadow-sm"><i className="fa-solid fa-rotate-left text-[7px]"></i> F-RESET</button>
            </div>
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelClass}>Shell I.D (mm)</label><input type="number" name="insideDia" value={inputs.insideDia} onChange={handleChange} className={inputClass} /></div>
            <div><label className={labelClass}>Bolt Count (EA)</label><input type="number" name="boltCount" value={inputs.boltCount} onChange={handleChange} className={inputClass} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelClass}>g0 (mm)</label><input type="number" name="g0" value={inputs.g0} onChange={handleChange} className={inputClass} /></div>
            <div><label className={labelClass}>g1 (mm)</label><input type="number" name="g1" value={inputs.g1.toFixed(0)} readOnly className={`${inputClass} bg-slate-100 font-bold text-sky-700 cursor-not-allowed`} /></div>
          </div>

          <div className="flex justify-end pt-1"><button onClick={resetGasketStandard} className="text-[9px] bg-sky-600 hover:bg-sky-700 text-white px-4 py-1.5 rounded-full font-black flex items-center gap-2 shadow-md transition-all"><i className="fa-solid fa-rotate-left"></i> GASKET RESET</button></div>

          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelClass}>Shell Gap A (mm)</label><input type="number" name="shellGapA" value={inputs.shellGapA} onChange={handleChange} className={inputClass} /></div>
            <div><label className={labelClass}>Clearance C (mm)</label><input type="number" name="cClearance" value={inputs.cClearance} onChange={handleChange} className={inputClass} /></div>
          </div>
          <div className="grid grid-cols-1 gap-4"><div><label className={labelClass}>Contact Width N (mm)</label><input type="number" name="gasketSeatingWidth" value={inputs.gasketSeatingWidth} onChange={handleChange} className={inputClass} /></div></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelClass}>Pass Part W (mm)</label><input type="number" name="passPartitionWidth" value={inputs.passPartitionWidth} onChange={handleChange} className={inputClass} /></div>
            <div><label className={labelClass}>Pass Part L(mm)</label><input type="number" name="passPartitionLength" value={inputs.passPartitionLength} onChange={handleChange} className={inputClass} /></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            <div className="space-y-2"><div className="flex items-center gap-2"><input type="checkbox" name="hasInnerRing" checked={inputs.hasInnerRing} onChange={handleChange} /><label className={labelClass}>Inner Ring</label></div><input type="number" name="innerRingWidthManual" value={inputs.innerRingWidthManual || results.innerRingWidth} onChange={handleChange} disabled={!inputs.hasInnerRing} className={!inputs.hasInnerRing ? disabledInputClass : inputClass} /></div>
            <div className="space-y-2"><div className="flex items-center gap-2"><input type="checkbox" name="hasOuterRing" checked={inputs.hasOuterRing} onChange={handleChange} /><label className={labelClass}>Outer Ring</label></div><input type="number" name="outerRingWidthManual" value={inputs.outerRingWidthManual || results.outerRingWidth} onChange={handleChange} disabled={!inputs.hasOuterRing} className={!inputs.hasOuterRing ? disabledInputClass : inputClass} /></div>
          </div>
          <div><label className={labelClass}>Bolt Size (inch)</label><select name="boltSize" value={inputs.boltSize} onChange={handleChange} className={inputClass}>{filteredBolts.map(bolt => <option key={bolt.size} value={bolt.size}>{bolt.size}"</option>)}</select></div>
          
          <div className="pt-2">
            <button
              type="button"
              onClick={toggleHydraulicTensioning}
              className={`w-full py-2.5 px-4 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 border-2 ${inputs.useHydraulicTensioning ? 'bg-sky-600 border-sky-600 text-white shadow-lg' : 'bg-white border-slate-200 text-slate-400'}`}
            >
              <i className="fa-solid fa-oil-can"></i> HYDRAULIC BOLT TENSIONING
            </button>
          </div>
        </section>

        <section className="space-y-3 bg-sky-50/50 p-4 rounded-lg border border-sky-100 shadow-sm">
          <h3 className="text-xs font-black text-sky-600 border-l-4 border-sky-500 pl-2 mb-3 uppercase tracking-tighter">Gasket / Clearance Logic</h3>
          <div className="grid grid-cols-1 gap-3">
            <button onClick={() => applyGasketBounds(results.maxRaisedFace - (inputs.gasketSeatingWidth * 2), results.maxRaisedFace, 'bcd')} className={`p-2.5 border rounded-lg text-left transition-all ${isSug1Active ? 'bg-indigo-800 border-indigo-900 text-white shadow-lg' : 'bg-white border-indigo-100 hover:bg-indigo-50'}`}>
              <span className="block text-[7px] font-black uppercase mb-1">GASKET SEATING OD (BASED ON BCD)</span>
              <span className="text-sm font-black">{s1OD.toFixed(0)} mm</span>
            </button>
            <button onClick={() => applyGasketBounds(s2OD - (inputs.gasketSeatingWidth * 2), s2OD, 'shell')} className={`p-2.5 border rounded-lg text-left transition-all ${isSug2Active ? 'bg-sky-800 border-sky-900 text-white shadow-lg' : 'bg-white border-sky-100 hover:bg-sky-50'}`}>
              <span className="block text-[7px] font-black uppercase mb-1">GASKET SEATING OD (BASED ON SHELL ID)</span>
              <span className="text-sm font-black">{Math.ceil(s2OD).toFixed(0)} mm</span>
            </button>
          </div>
        </section>

        <section className="pt-4 border-t border-dashed space-y-4">
          <div className={`overflow-hidden rounded-2xl border transition-all duration-500 ${inputs.useManualOverride ? 'border-amber-500 shadow-xl' : 'border-slate-200'}`}>
            <button 
              type="button" 
              onClick={toggleManualMode} 
              className={`w-full py-3 px-4 text-[11px] font-black uppercase tracking-wider transition-all flex items-center justify-between gap-2 ${inputs.useManualOverride ? 'bg-amber-600 text-white shadow-inner' : 'bg-white text-slate-400 hover:bg-slate-50'}`}
            >
              <span className="flex items-center gap-2"><i className={`fa-solid ${inputs.useManualOverride ? 'fa-lock-open' : 'fa-lock'}`}></i> MANUAL INPUT</span>
              {inputs.useManualOverride && <i className="fa-solid fa-circle-check text-[10px]"></i>}
            </button>
            
            {inputs.useManualOverride && (
              <div className="bg-amber-50/20 p-5 space-y-5 animate-in slide-in-from-top-2 duration-300">
                <div className="grid grid-cols-2 gap-4">
                  <div><label className={labelClass}>BCD (MM)</label><input type="number" name="actualBCD" value={localManualValues.actualBCD} onChange={handleChange} className={inputClass} /></div>
                  <div><label className={labelClass}>FLANGE OD (MM)</label><input type="number" name="actualOD" value={localManualValues.actualOD} onChange={handleChange} className={inputClass} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className={labelClass}>GASKET M</label><input type="number" name="manualM" value={localManualValues.manualM} onChange={handleChange} className={inputClass} /></div>
                  <div><label className={labelClass}>GASKET Y (PSI)</label><input type="number" name="manualY" value={localManualValues.manualY} onChange={handleChange} className={inputClass} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className={labelClass}>GASKET M(PASS)</label><input type="number" name="manualPassM" value={localManualValues.manualPassM} onChange={handleChange} className={inputClass} /></div>
                  <div><label className={labelClass}>GASKET Y(PASS) (PSI)</label><input type="number" name="manualPassY" value={localManualValues.manualPassY} onChange={handleChange} className={inputClass} /></div>
                </div>
                <div className="space-y-2">
                  <label className={labelClass}>GASKET OD/ID</label>
                  <div className="grid grid-cols-2 gap-4">
                    <input type="number" name="manualSeatingOD" value={localManualValues.manualSeatingOD} onChange={handleChange} placeholder="OD" className={inputClass} />
                    <input type="number" name="manualSeatingID" value={localManualValues.manualSeatingID} onChange={handleChange} placeholder="ID" className={inputClass} />
                  </div>
                </div>
                <div className="pt-2">
                  <button 
                    type="button" 
                    onClick={handleTriggerOptimize} 
                    className="w-full py-3 rounded-2xl text-[12px] font-black uppercase tracking-widest bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
                  >
                    <i className="fa-solid fa-play text-[10px]"></i> START
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className={`overflow-hidden rounded-2xl border transition-all duration-500 ${inputs.usePcc1Check ? 'border-[#059669] shadow-xl' : 'border-slate-200'}`}>
            <button 
              type="button" 
              onClick={togglePcc1Check} 
              className={`w-full py-3 px-4 text-[11px] font-black uppercase tracking-wider transition-all flex items-center justify-between gap-2 ${inputs.usePcc1Check ? 'bg-[#008d62] text-white shadow-inner' : 'bg-white text-slate-400 hover:bg-slate-50'}`}
            >
              <span className="flex items-center gap-2"><i className="fa-solid fa-list-ul"></i> PCC-1 CHECK</span>
              {inputs.usePcc1Check && <i className="fa-solid fa-circle-check text-[10px]"></i>}
            </button>

            {inputs.usePcc1Check && (
              <div className="bg-white p-5 space-y-4 border border-[#dcfce7] rounded-b-2xl animate-in slide-in-from-top-2 duration-300">
                <div className="grid grid-cols-2 gap-4">
                  <div><label className={labelClass}>SGT (MPA)</label><input type="number" name="sgT" value={inputs.sgT} onChange={handleChange} className={inputClass} /></div>
                  <div><label className={labelClass}>SGMIN-S (MPA)</label><input type="number" name="sgMinS" value={inputs.sgMinS} onChange={handleChange} className={inputClass} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className={labelClass}>SGMIN-O (MPA)</label><input type="number" name="sgMinO" value={inputs.sgMinO} onChange={handleChange} className={inputClass} /></div>
                  <div><label className={labelClass}>SGMAX (MPA)</label><input type="number" name="sgMax" value={inputs.sgMax} onChange={handleChange} className={inputClass} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className={labelClass}>SBMAX (MPA) <span className="text-[8px] lowercase font-black text-sky-500 tracking-normal">(70% Yield)</span></label><input type="number" name="sbMax" value={inputs.sbMax} onChange={handleChange} className={inputClass} /></div>
                  <div><label className={labelClass}>SBMIN (MPA) <span className="text-[8px] lowercase font-black text-sky-500 tracking-normal">(40% Yield)</span></label><input type="number" name="sbMin" value={inputs.sbMin} onChange={handleChange} className={inputClass} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className={labelClass}>SFMAX (MPA)</label><input type="number" name="sfMax" value={inputs.sfMax} onChange={handleChange} className={inputClass} /></div>
                  <div><label className={labelClass}>ΦFMAX (DEG)</label><input type="number" step="0.01" name="phiFMax" value={inputs.phiFMax} onChange={handleChange} className={inputClass} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className={labelClass}>ΦGMAX (DEG)</label><input type="number" step="0.01" name="phiGMax" value={inputs.phiGMax} onChange={handleChange} className={inputClass} /></div>
                  <div><label className={labelClass}>FRACTION OF GASKET</label><input type="number" step="0.1" name="g" value={inputs.g} onChange={handleChange} className={inputClass} /></div>
                </div>
                <div className="grid grid-cols-1">
                   <div><label className={labelClass}>PASS PART REDUCTION (%)</label><input type="number" name="passPartAreaReduction" value={inputs.passPartAreaReduction} onChange={handleChange} className={inputClass} /></div>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
