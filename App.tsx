
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Calculator } from './components/Calculator';
import { ResultTable } from './components/ResultTable';
import { FlangeDiagram } from './components/FlangeDiagram';
import { BoltLoadTable } from './components/BoltLoadTable';
import { TEMA_BOLT_DATA as INITIAL_TEMA_BOLT_DATA, GASKET_RING_TABLE as INITIAL_RING_STANDARDS, ASME_BOLT_MATERIALS as INITIAL_BOLT_MATERIALS, BOLT_TEMP_STEPS, PLATE_TEMP_STEPS, GASKET_TYPES as INITIAL_GASKET_TYPES, WHC_MAX_PITCH_TABLE, HYDRAULIC_TENSIONING_DATA as INITIAL_TENSIONING_DATA, ASME_SHELL_MATERIALS as INITIAL_SHELL_MATERIALS } from './constants';
import { CalculationResults, FlangeInputs, BoltMaterial, ShellMaterial, TemaBoltInfo, TensioningInfo, GasketType, RingStandard } from './types';

interface SavedRecord {
  id: string;
  originalInputs: FlangeInputs; // Store original inputs to allow full restoration
  itemNo: string;
  part: string;
  id_mm: number;
  g0: number;
  g1: number;
  bcd: number;
  flangeOd: number;
  boltSize: string;
  boltEa: number;
  boltMaterial: string;
  hasOuterRing: boolean;
  hasInnerRing: boolean;
  gasketRod: number;
  gasketOd: number;
  gasketId: number;
  gasketRid: number;
  gasketType: string;
  // PCC-1 Fields for Export
  usePcc1: boolean;
  sgT: number;
  sgMinS: number;
  sgMinO: number;
  sgMax: number;
  sbMax: number;
  sbMin: number;
  sfMax: number;
  phiFMax: number;
  phiGMax: number;
  pccG: number;
  passPartReduc: number;
}

const toMpa = (p: number, unit: string): number => {
  switch (unit) {
    case 'Bar': return p * 0.1;
    case 'PSI': return p * 0.00689476;
    case 'kg/cm²': return p * 0.0980665;
    default: return p;
  }
};

const toCelsius = (t: number, unit: string): number => {
  switch (unit) {
    case '°F': return (t - 32) * 5 / 9;
    case 'K': return t - 273.15;
    default: return t;
  }
};

const interpolateStress = (temp: number, stressCurve: (number | null)[], steps: number[]): number => {
  const cleanCurve = stressCurve.map(s => s || 0);
  if (temp <= steps[0]) return cleanCurve[0];
  if (temp >= steps[steps.length - 1]) return cleanCurve[cleanCurve.length - 1];

  for (let i = 0; i < steps.length - 1; i++) {
    const t1 = steps[i];
    const t2 = steps[i + 1];
    if (temp >= t1 && temp <= t2) {
      const s1 = cleanCurve[i];
      const s2 = cleanCurve[i + 1] || s1;
      return s1 + ((s2 - s1) * (temp - t1)) / (t2 - t1);
    }
  }
  return cleanCurve[0];
};

const calculateAutoG0 = (currentInputs: Partial<FlangeInputs>, plateMaterials: ShellMaterial[]): number => {
  const shellMatId = currentInputs.shellMaterial || plateMaterials[0].id;
  const shellMat = plateMaterials.find(m => m.id === shellMatId) || plateMaterials[0];
  const temp = currentInputs.designTemp ?? 100;
  const tempU = currentInputs.tempUnit || '°C';
  const press = currentInputs.designPressure ?? 1.0;
  const pressU = currentInputs.pressureUnit || 'MPa';
  const id = currentInputs.insideDia ?? 1000;
  const corr = currentInputs.corrosionAllowance ?? 0;
  const jointEff = currentInputs.jointEfficiency ?? 1.0;

  const shellStress = interpolateStress(toCelsius(temp, tempU), shellMat.stresses, PLATE_TEMP_STEPS);
  const pMpa = toMpa(press, pressU);
  
  const denom = (shellStress * jointEff - 0.6 * pMpa);
  const autoG0 = (pMpa * (id / 2 + corr)) / (denom > 0 ? denom : 1) + corr;
  return Math.ceil(autoG0);
};

const initialInputs: FlangeInputs = {
  itemNo: 'GEN-001',
  partName: 'CHANNEL SIDE',
  boltSize: 0.75,
  boltCount: 48,
  insideDia: 1000,
  g0: 5, 
  g1: 7, 
  cClearance: 2.5,
  shellGapA: 3.0,
  gasketSeatingWidth: 15,
  hasInnerRing: true,
  hasOuterRing: true,
  innerRingWidthManual: 0,
  outerRingWidthManual: 0,
  useManualOverride: false,
  actualBCD: 0,
  actualOD: 0,
  manualSeatingID: 0,
  manualSeatingOD: 0,
  manualM: 0,
  manualY: 0,
  manualPassM: 0,
  manualPassY: 0,
  designTemp: 100,
  tempUnit: '°C',
  designPressure: 1,
  pressureUnit: 'MPa',
  shellMaterial: 'SA–516-70', 
  jointEfficiency: 1.0,
  corrosionAllowance: 0,
  boltMaterial: 'SA-193 B7 (<= 64)', 
  passPartitionLength: 0,
  passPartitionWidth: 0,
  gasketType: 'Spiral-wound (Stainless steel, Monel, and Ni-base alloy)',
  passGasketType: 'Spiral-wound (Stainless steel, Monel, and Ni-base alloy)',
  facingSketch: '1a: Flat Face / Groove',
  useHydraulicTensioning: false,
  usePcc1Check: false,
  sgT: 200,
  sgMinS: 140,
  sgMinO: 97,
  sgMax: 0, 
  sbMax: 507.5, 
  sbMin: 290.0, 
  sfMax: 150,
  phiFMax: 0.32,
  phiGMax: 1,
  g: 0.7,
  passPartAreaReduction: 50,
};

const App: React.FC = () => {
  // Material data still persists to keep user-added materials
  const [boltMaterials, setBoltMaterials] = useState<BoltMaterial[]>(() => {
    const saved = localStorage.getItem('flange_genie_bolt_materials');
    return saved ? JSON.parse(saved) : INITIAL_BOLT_MATERIALS;
  });
  
  const [plateMaterials, setPlateMaterials] = useState<ShellMaterial[]>(() => {
    const saved = localStorage.getItem('flange_genie_plate_materials');
    return saved ? JSON.parse(saved) : INITIAL_SHELL_MATERIALS;
  });

  const [temaBoltData, setTemaBoltData] = useState<TemaBoltInfo[]>(() => {
    const saved = localStorage.getItem('flange_genie_tema_bolt_data');
    return saved ? JSON.parse(saved) : INITIAL_TEMA_BOLT_DATA;
  });

  const [tensioningData, setTensioningData] = useState<TensioningInfo[]>(() => {
    const saved = localStorage.getItem('flange_genie_tensioning_data');
    return saved ? JSON.parse(saved) : INITIAL_TENSIONING_DATA;
  });

  const [gasketTypes, setGasketTypes] = useState<GasketType[]>(() => {
    const saved = localStorage.getItem('flange_genie_gasket_types');
    return saved ? JSON.parse(saved) : INITIAL_GASKET_TYPES;
  });

  const [ringStandards, setRingStandards] = useState<RingStandard[]>(() => {
    const saved = localStorage.getItem('flange_genie_ring_standards');
    return saved ? JSON.parse(saved) : INITIAL_RING_STANDARDS;
  });

  // Main Inputs: Always start with default values, but restore the Legend if it exists
  const [inputs, setInputs] = useState<FlangeInputs>(() => {
    const savedLegend = localStorage.getItem('flange_genie_custom_legend');
    if (savedLegend) {
      return { ...initialInputs, customLegendUrl: savedLegend };
    }
    return initialInputs;
  });
  
  // Search state resets on load
  const [isFixedSizeSearch, setIsFixedSizeSearch] = useState<boolean>(false);

  // Calculation Summary List: Always reset to empty on load as requested
  const [savedRecords, setSavedRecords] = useState<SavedRecord[]>([]);

  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);

  // Persistence: Only the custom legend is saved across reloads for inputs
  useEffect(() => {
    if (inputs.customLegendUrl) {
      localStorage.setItem('flange_genie_custom_legend', inputs.customLegendUrl);
    } else {
      localStorage.removeItem('flange_genie_custom_legend');
    }
  }, [inputs.customLegendUrl]);

  // Sync background library data to local storage
  useEffect(() => {
    localStorage.setItem('flange_genie_bolt_materials', JSON.stringify(boltMaterials));
  }, [boltMaterials]);

  useEffect(() => {
    localStorage.setItem('flange_genie_plate_materials', JSON.stringify(plateMaterials));
  }, [plateMaterials]);

  useEffect(() => {
    localStorage.setItem('flange_genie_tema_bolt_data', JSON.stringify(temaBoltData));
  }, [temaBoltData]);

  // Fix: Complete truncated useEffects
  useEffect(() => {
    localStorage.setItem('flange_genie_tensioning_data', JSON.stringify(tensioningData));
  }, [tensioningData]);

  useEffect(() => {
    localStorage.setItem('flange_genie_gasket_types', JSON.stringify(gasketTypes));
  }, [gasketTypes]);

  useEffect(() => {
    localStorage.setItem('flange_genie_ring_standards', JSON.stringify(ringStandards));
  }, [ringStandards]);

  // Handle Input Changes
  const handleInputChange = useCallback((updatedInputs: FlangeInputs, changedFieldName: string) => {
    setInputs(updatedInputs);
  }, []);

  // Optimization Logic Placeholder
  const handleOptimize = useCallback(() => {
    // Logic to optimize flange parameters like g0 or bolt count
  }, [inputs]);

  // Reset Logic
  const handleGlobalReset = useCallback(() => {
    setInputs(initialInputs);
  }, []);

  // Main Calculation Logic
  const results = useMemo((): CalculationResults => {
    const pMpa = toMpa(inputs.designPressure, inputs.pressureUnit);
    const tempC = toCelsius(inputs.designTemp, inputs.tempUnit);
    
    const shellMat = plateMaterials.find(m => m.id === inputs.shellMaterial) || plateMaterials[0];
    const shellStress = interpolateStress(tempC, shellMat.stresses, PLATE_TEMP_STEPS);
    
    const boltRef = temaBoltData.find(b => b.size === inputs.boltSize) || temaBoltData[0];
    const tensionRef = tensioningData.find(t => t.size === inputs.boltSize);
    const effectiveBMin = (inputs.useHydraulicTensioning && tensionRef) ? tensionRef.B_ten : boltRef.B_min;
    
    const bcd1 = (effectiveBMin * inputs.boltCount * 25.4) / Math.PI;
    const bcd2 = inputs.insideDia + (2 * inputs.g1) + (2 * boltRef.R * 25.4);
    
    const gasketRef = gasketTypes.find(g => g.id === inputs.gasketType) || gasketTypes[0];
    const gM = inputs.useManualOverride && inputs.manualM !== 0 ? inputs.manualM : gasketRef.m;
    const gY = inputs.useManualOverride && inputs.manualY !== 0 ? inputs.manualY : gasketRef.y;

    const ringConfig = ringStandards.find(r => inputs.insideDia >= r.min && inputs.insideDia <= r.max) || ringStandards[ringStandards.length - 1];
    const innerRingWidth = inputs.hasInnerRing ? (inputs.innerRingWidthManual || ringConfig.irMin) : 0;
    const outerRingWidth = inputs.hasOuterRing ? (inputs.outerRingWidthManual || ringConfig.orMin) : 0;
    
    const seatingOD_calc = inputs.insideDia + (2 * inputs.shellGapA) + (2 * innerRingWidth) + (2 * inputs.gasketSeatingWidth);
    const seatingOD = inputs.useManualOverride && inputs.manualSeatingOD !== 0 ? inputs.manualSeatingOD : seatingOD_calc;
    const seatingID = seatingOD - (2 * inputs.gasketSeatingWidth);

    const bcd3 = seatingOD + (2 * 1.5) + (2 * (inputs.cClearance || 2.5)) + boltRef.holeSize;
    const selectedBcd = Math.max(bcd1, bcd2, bcd3);
    const finalBCD = inputs.useManualOverride && inputs.actualBCD !== 0 ? inputs.actualBCD : selectedBcd;
    const finalOD = inputs.useManualOverride && inputs.actualOD !== 0 ? inputs.actualOD : (finalBCD + 2 * boltRef.E * 25.4);

    return {
      bcdMethod1: bcd1,
      bcdMethod2: bcd2,
      bcdMethod3: bcd3,
      selectedBcdSource: selectedBcd === bcd1 ? 1 : selectedBcd === bcd2 ? 2 : 3,
      bcdTema: Math.max(bcd1, bcd2),
      odTema: Math.max(bcd1, bcd2) + (2 * boltRef.E * 25.4),
      boltSpacingMin: effectiveBMin * 25.4,
      effectiveBMin: effectiveBMin,
      maxBoltSpacing: WHC_MAX_PITCH_TABLE[inputs.boltSize] || 150,
      geometricPitch: (Math.PI * finalBCD) / inputs.boltCount,
      actualBoltSpacing: 0, // Placeholder
      spacingOk: true,
      radialDistance: boltRef.R * 25.4,
      edgeDistance: boltRef.E * 25.4,
      effectiveC: inputs.cClearance || 2.5,
      shellGapA: inputs.shellGapA,
      gasketSeatingWidth: inputs.gasketSeatingWidth,
      innerRingWidth: innerRingWidth,
      outerRingWidth: outerRingWidth,
      gasketID: seatingID - innerRingWidth,
      seatingID: seatingID,
      seatingOD: seatingOD,
      gasketOD: seatingOD + outerRingWidth,
      finalBCD: finalBCD,
      finalOD: finalOD,
      maxRaisedFace: finalBCD - boltRef.holeSize - 2 * (inputs.cClearance || 2.5),
      boltHoleSize: boltRef.holeSize,
      singleBoltArea: boltRef.tensileArea,
      totalBoltArea: boltRef.tensileArea * inputs.boltCount,
      requiredBoltArea: 0,
      totalBoltLoadAmbient: 0,
      totalBoltLoadDesign: 0,
      ambientAllowableStress: 0,
      designAllowableStress: 0,
      gasketM: gM,
      gasketY: gY,
      passM: gM, // Simplified for stub
      passY: gY,
      wm1: 0,
      wm2: 0,
      hForce: 0,
      hpForce: 0,
      gMeanDia: 0,
      bWidth: 0,
      b0Width: 0,
      nWidth: 0,
      shellStress: shellStress
    };
  }, [inputs, boltMaterials, plateMaterials, temaBoltData, tensioningData, gasketTypes, ringStandards]);

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tighter uppercase italic">
              Flange<span className="text-sky-600">Genie</span> <span className="text-[10px] font-bold text-slate-400 align-top uppercase ml-1">v3.5</span>
            </h1>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Advanced TEMA & ASME Hub Calculation Suite</p>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4">
            <Calculator 
              inputs={inputs} 
              onInputChange={handleInputChange} 
              onOptimize={handleOptimize}
              onGlobalReset={handleGlobalReset}
              results={results}
              boltMaterials={boltMaterials}
              plateMaterials={plateMaterials}
              temaBoltData={temaBoltData}
              gasketTypes={gasketTypes}
              ringStandards={ringStandards}
            />
          </div>
          <div className="lg:col-span-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <ResultTable inputs={inputs} results={results} temaBoltData={temaBoltData} tensioningData={tensioningData} />
               <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col items-center justify-center">
                  <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Cross-Section Geometry</h3>
                  <FlangeDiagram inputs={inputs} results={results} />
               </div>
            </div>
            <BoltLoadTable 
              inputs={inputs} 
              results={results} 
              boltMaterials={boltMaterials} 
              setBoltMaterials={setBoltMaterials}
              plateMaterials={plateMaterials} 
              setPlateMaterials={setPlateMaterials}
              temaBoltData={temaBoltData} 
              setTemaBoltData={setTemaBoltData}
              tensioningData={tensioningData} 
              setTensioningData={setTensioningData}
              gasketTypes={gasketTypes} 
              setGasketTypes={setGasketTypes}
              ringStandards={ringStandards} 
              setRingStandards={setRingStandards}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
