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

// Initial state for FlangeInputs
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
  gasketPreference: undefined,
};

const App: React.FC = () => {
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

  // Reopen Logic: Load entire inputs state including custom legend from localStorage
  const [inputs, setInputs] = useState<FlangeInputs>(() => {
    const savedInputs = localStorage.getItem('flange_genie_current_inputs');
    if (savedInputs) {
      try {
        const parsed = JSON.parse(savedInputs);
        return { ...initialInputs, ...parsed };
      } catch (e) {
        console.error("Failed to parse saved inputs", e);
      }
    }
    // Fallback to legend-only if full inputs not found
    const savedLegend = localStorage.getItem('flange_genie_custom_legend');
    if (savedLegend) {
      return { ...initialInputs, customLegendUrl: savedLegend };
    }
    return initialInputs;
  });
  
  const [isFixedSizeSearch, setIsFixedSizeSearch] = useState<boolean>(false);
  const [savedRecords, setSavedRecords] = useState<SavedRecord[]>(() => {
    const saved = localStorage.getItem('flange_genie_saved_records');
    try {
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to parse saved records", e);
      return [];
    }
  });
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);

  // Auto-save logic for inputs and legend
  useEffect(() => {
    localStorage.setItem('flange_genie_current_inputs', JSON.stringify(inputs));
    if (inputs.customLegendUrl) {
      localStorage.setItem('flange_genie_custom_legend', inputs.customLegendUrl);
    } else {
      localStorage.removeItem('flange_genie_custom_legend');
    }
  }, [inputs]);

  // Auto-save logic for saved summary list
  useEffect(() => {
    localStorage.setItem('flange_genie_saved_records', JSON.stringify(savedRecords));
  }, [savedRecords]);

  useEffect(() => {
    localStorage.setItem('flange_genie_bolt_materials', JSON.stringify(boltMaterials));
  }, [boltMaterials]);

  useEffect(() => {
    localStorage.setItem('flange_genie_plate_materials', JSON.stringify(plateMaterials));
  }, [plateMaterials]);

  useEffect(() => {
    localStorage.setItem('flange_genie_tema_bolt_data', JSON.stringify(temaBoltData));
  }, [temaBoltData]);

  useEffect(() => {
    localStorage.setItem('flange_genie_tensioning_data', JSON.stringify(tensioningData));
  }, [tensioningData]);

  useEffect(() => {
    localStorage.setItem('flange_genie_gasket_types', JSON.stringify(gasketTypes));
  }, [gasketTypes]);

  useEffect(() => {
    localStorage.setItem('flange_genie_ring_standards', JSON.stringify(ringStandards));
  }, [ringStandards]);

  const calculateFullResults = useCallback((currentInputs: FlangeInputs): CalculationResults => {
    const boltData = temaBoltData.find(b => b.size === currentInputs.boltSize) || temaBoltData[0];
    const tensionData = tensioningData.find(t => t.size === currentInputs.boltSize);
    const ringConfig = ringStandards.find(r => currentInputs.insideDia >= r.min && currentInputs.insideDia <= r.max) || ringStandards[ringStandards.length - 1];

    const innerRingWidth = currentInputs.hasInnerRing ? (currentInputs.innerRingWidthManual || ringConfig.irMin) : 0;
    const outerRingWidth = currentInputs.hasOuterRing ? (currentInputs.outerRingWidthManual || ringConfig.orMin) : 0;
    const effectiveC = currentInputs.cClearance || 2.5;
    const shellGapA = currentInputs.shellGapA !== undefined ? currentInputs.shellGapA : 3.0;
    const bConst = 1.5; 

    const roundedHoleSize = Math.ceil(boltData.holeSize);
    const effectiveBMin = (currentInputs.useHydraulicTensioning && tensionData) 
      ? Math.max(boltData.B_min, tensionData.B_ten) 
      : boltData.B_min;
    
    const bcdMethod1 = Math.ceil((effectiveBMin * 25.4 * currentInputs.boltCount) / Math.PI);
    const radialDistance = boltData.R * 25.4;
    const bcdMethod2 = Math.ceil(currentInputs.insideDia + (2 * currentInputs.g1) + (2 * radialDistance));

    const baseBCDForAutoGasket = Math.max(bcdMethod1, bcdMethod2);
    const autoSeatingOD_BCD = baseBCDForAutoGasket - roundedHoleSize - (2 * effectiveC) - (2 * bConst) - (2 * outerRingWidth);
    const autoSeatingOD_Shell = currentInputs.insideDia + (2 * shellGapA) + (2 * innerRingWidth) + (2 * currentInputs.gasketSeatingWidth);

    let autoSeatingOD = 0;
    if (currentInputs.gasketPreference === 'shell') {
      autoSeatingOD = autoSeatingOD_Shell;
    } else if (currentInputs.gasketPreference === 'bcd') {
      autoSeatingOD = autoSeatingOD_BCD;
    } else {
      autoSeatingOD = Math.max(autoSeatingOD_BCD, autoSeatingOD_Shell);
    }
    
    const autoSeatingID = autoSeatingOD - (2 * currentInputs.gasketSeatingWidth);

    const seatingID = currentInputs.useManualOverride ? currentInputs.manualSeatingID : autoSeatingID;
    const seatingOD = currentInputs.useManualOverride ? currentInputs.manualSeatingOD : autoSeatingOD;
    
    const gasketOD = seatingOD + (currentInputs.hasOuterRing ? (2 * outerRingWidth) : 0);
    const gasketID = seatingID - (currentInputs.hasInnerRing ? (2 * innerRingWidth) : 0);

    const bcdMethod3 = gasketOD + (2 * bConst) + (2 * effectiveC) + roundedHoleSize;
    const bcdTema = Math.max(bcdMethod1, bcdMethod2, bcdMethod3);
    const selectedBcdSource = bcdTema === bcdMethod1 ? 1 : (bcdTema === bcdMethod2 ? 2 : 3);

    const finalBCD = (currentInputs.useManualOverride && currentInputs.actualBCD !== 0) ? currentInputs.actualBCD : bcdTema;
    const edgeDistance = boltData.E * 25.4;
    const odTema = Math.ceil(finalBCD + (2 * edgeDistance));
    const finalOD = (currentInputs.useManualOverride && currentInputs.actualOD !== 0) ? currentInputs.actualOD : odTema;

    const gType = gasketTypes.find(g => g.id === currentInputs.gasketType) || gasketTypes[0];
    const gasketM = (currentInputs.useManualOverride && currentInputs.manualM !== 0) ? currentInputs.manualM : gType.m;
    const gasketY = (currentInputs.useManualOverride && currentInputs.manualY !== 0) ? currentInputs.manualY : gType.y;

    const passGType = gasketTypes.find(g => g.id === currentInputs.passGasketType) || gType;
    const passM = (currentInputs.useManualOverride && currentInputs.manualPassM !== 0) ? currentInputs.manualPassM : passGType.m;
    const passY = (currentInputs.useManualOverride && currentInputs.manualPassY !== 0) ? currentInputs.manualPassY : passGType.y;

    const geometricPitch = (Math.PI * finalBCD) / currentInputs.boltCount;
    const boltSpacingMin = effectiveBMin * 25.4;
    const maxBoltSpacing = WHC_MAX_PITCH_TABLE[currentInputs.boltSize] || (2.5 * currentInputs.boltSize * 25.4 + 12);

    const nWidth = (seatingOD - seatingID) / 2;
    let b0Width = nWidth / 2;
    if (currentInputs.facingSketch.startsWith('1a') || currentInputs.facingSketch.startsWith('1b')) {
      b0Width = nWidth / 2;
    } else if (currentInputs.facingSketch.startsWith('1c') || currentInputs.facingSketch.startsWith('1d')) {
      b0Width = nWidth / 4;
    } else if (currentInputs.facingSketch.startsWith('2')) {
      b0Width = nWidth / 8;
    }

    const Cul = 25.4; 
    const bWidth = b0Width > 6 ? 0.5 * Cul * Math.sqrt(b0Width / Cul) : b0Width;
    const gMeanDia = b0Width > 6 ? seatingOD - (2 * bWidth) : (seatingID + seatingOD) / 2;

    const pMpa = toMpa(currentInputs.designPressure, currentInputs.pressureUnit);
    const hForce = 0.785 * Math.pow(gMeanDia, 2) * pMpa;
    const hpForce = 2 * pMpa * (bWidth * Math.PI * gMeanDia * gasketM + currentInputs.passPartitionWidth * currentInputs.passPartitionLength * passM);
    const wm1 = hForce + hpForce;
    const wm2 = (Math.PI * bWidth * gMeanDia * (gasketY * 0.00689476)) + (currentInputs.passPartitionWidth * currentInputs.passPartitionLength * (passY * 0.00689476));

    const mat = boltMaterials.find(m => m.id === currentInputs.boltMaterial) || boltMaterials[0];
    const ambientAllowableStress = mat.stresses[BOLT_TEMP_STEPS.indexOf(40)] || 138;
    const designAllowableStress = interpolateStress(toCelsius(currentInputs.designTemp, currentInputs.tempUnit), mat.stresses, BOLT_TEMP_STEPS);

    const totalBoltArea = boltData.tensileArea * currentInputs.boltCount;
    const reqAreaOperating = wm1 / (designAllowableStress || 1);
    const reqAreaSeating = wm2 / (ambientAllowableStress || 1);
    const requiredBoltArea = Math.max(reqAreaOperating, reqAreaSeating);

    const shellMat = plateMaterials.find(m => m.id === currentInputs.shellMaterial) || plateMaterials[0];
    const shellStress = interpolateStress(toCelsius(currentInputs.designTemp, currentInputs.tempUnit), shellMat.stresses, PLATE_TEMP_STEPS);

    return {
      bcdMethod1, bcdMethod2, bcdMethod3, selectedBcdSource,
      bcdTema, odTema, boltSpacingMin, maxBoltSpacing, 
      geometricPitch, actualBoltSpacing: maxBoltSpacing,
      spacingOk: geometricPitch >= boltSpacingMin && geometricPitch <= maxBoltSpacing,
      radialDistance, edgeDistance, effectiveC, shellGapA,
      gasketSeatingWidth: nWidth, innerRingWidth, outerRingWidth,
      gasketID, seatingID, seatingOD, gasketOD, finalBCD, finalOD,
      maxRaisedFace: finalBCD - roundedHoleSize - (2 * effectiveC) - (2 * bConst) - (2 * outerRingWidth), 
      boltHoleSize: roundedHoleSize,
      singleBoltArea: boltData.tensileArea, totalBoltArea,
      requiredBoltArea,
      totalBoltLoadAmbient: totalBoltArea * ambientAllowableStress,
      totalBoltLoadDesign: totalBoltArea * designAllowableStress,
      ambientAllowableStress, designAllowableStress,
      effectiveBMin,
      gasketM, gasketY, passM, passY, wm1, wm2, hForce, hpForce, gMeanDia, bWidth, b0Width, nWidth,
      shellStress
    };
  }, [boltMaterials, temaBoltData, tensioningData, gasketTypes, ringStandards, plateMaterials]);

  const results = useMemo(() => {
    return calculateFullResults(inputs);
  }, [inputs, calculateFullResults]);
  
  const pccStatusInfo = useMemo(() => {
    const totalBoltRootArea = results.singleBoltArea * inputs.boltCount;
    const ringArea = (Math.PI / 4) * (Math.pow(results.seatingOD, 2) - Math.pow(results.seatingID, 2));
    const reducedPassArea = (inputs.passPartAreaReduction / 100) * inputs.passPartitionWidth * inputs.passPartitionLength;
    const totalAg = ringArea + reducedPassArea;
    const sbSelCalc = totalBoltRootArea > 0 ? (inputs.sgT * totalAg) / totalBoltRootArea : 0;
    const sbSelFinal = Math.min(Math.max(Math.min(sbSelCalc, inputs.sbMax || Infinity), inputs.sbMin || 0), inputs.sfMax || Infinity);
    const pMpa = toMpa(inputs.designPressure, inputs.pressureUnit);
    const step5Threshold = totalBoltRootArea > 0 ? inputs.sgMinS * (totalAg / totalBoltRootArea) : 0;
    const step6Numerator = (inputs.sgMinO * totalAg) + ((Math.PI / 4) * pMpa * Math.pow(results.seatingID, 2));
    const step6Threshold = totalBoltRootArea > 0 ? step6Numerator / ((inputs.g || 1) * totalBoltRootArea) : 0;
    const step7Threshold = totalBoltRootArea > 0 ? inputs.sgMax * (totalAg / totalBoltRootArea) : Infinity;
    const step8Threshold = inputs.phiFMax > 0 ? inputs.sfMax * ((inputs.phiGMax || 1) / inputs.phiFMax) : Infinity;

    return {
      active: inputs.usePcc1Check,
      safe: (sbSelFinal >= step5Threshold - 0.001) && (sbSelFinal >= step6Threshold - 0.001) && 
            (inputs.sgMax === 0 ? true : (sbSelFinal <= step7Threshold + 0.001)) && 
            (inputs.phiFMax === 0 ? true : (sbSelFinal <= step8Threshold + 0.001))
    };
  }, [inputs, results]);

  const isSafe = results.totalBoltLoadDesign >= Math.max(results.wm1, results.wm2);
  const marginPercent = ((results.totalBoltLoadDesign - Math.max(results.wm1, results.wm2)) / (Math.max(results.wm1, results.wm2) || 1)) * 100;

  const handleInputChange = (updatedInputs: FlangeInputs, changedFieldName: string) => {
    let finalInputs = { ...updatedInputs };

    const geometryTriggers = ['insideDia', 'boltCount', 'boltSize', 'g0', 'cClearance', 'shellGapA', 'gasketSeatingWidth'];
    if (geometryTriggers.includes(changedFieldName)) {
      finalInputs.gasketPreference = undefined;
    }

    const g0Triggers = ['insideDia', 'designTemp', 'tempUnit', 'designPressure', 'pressureUnit', 'shellMaterial', 'jointEfficiency', 'corrosionAllowance'];
    if (g0Triggers.includes(changedFieldName)) {
       const autoG0 = calculateAutoG0(finalInputs, plateMaterials);
       finalInputs.g0 = autoG0;
       finalInputs.g1 = Math.ceil(autoG0 * 1.3 / 3 + autoG0);
    }

    if (changedFieldName === 'boltMaterial' || changedFieldName === 'gasketType') {
      const mat = boltMaterials.find(m => m.id === finalInputs.boltMaterial);
      if (mat && mat.minYield) {
        finalInputs.sbMax = Math.round(mat.minYield * 0.7 * 10) / 10;
        finalInputs.sbMin = Math.round(mat.minYield * 0.4 * 10) / 10;
      }
      
      const gTypeLower = finalInputs.gasketType.toLowerCase();
      if (gTypeLower.includes('grooved')) {
        finalInputs.sgMax = 380;
        finalInputs.sgMinS = 140;
        finalInputs.sgMinO = 97;
      } else if (gTypeLower.includes('corruga')) {
        finalInputs.sgMax = 275;
        finalInputs.sgMinS = 140;
        finalInputs.sgMinO = 97;
      } else if (gTypeLower.includes('spiral')) {
        finalInputs.sgMax = 0;
        finalInputs.sgMinS = 140;
        finalInputs.sgMinO = 97;
      }
    }

    if (g0Triggers.includes(changedFieldName)) {
      setIsFixedSizeSearch(false);
    } else if (changedFieldName === 'boltSize') {
      setIsFixedSizeSearch(true);
    }

    setInputs(finalInputs);
  };

  const handleOptimize = () => {
    const optimizedTargetInputs = { ...inputs, useManualOverride: false, actualBCD: 0, actualOD: 0, manualSeatingID: 0, manualSeatingOD: 0, gasketPreference: undefined };
    let bestSize = optimizedTargetInputs.boltSize;
    let bestCount = optimizedTargetInputs.boltCount;
    let minRequiredLoad = Infinity; 
    let found = false;

    const sizesToSearch = isFixedSizeSearch ? [optimizedTargetInputs.boltSize] : temaBoltData.filter(b => b.size >= 0.75).map(b => b.size);
    const counts = [4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 68, 72, 76, 80];

    for (const size of sizesToSearch) {
      for (const count of counts) {
        const testInputs = { ...optimizedTargetInputs, boltSize: size, boltCount: count };
        const testResults = calculateFullResults(testInputs);
        const req = Math.max(testResults.wm1, testResults.wm2);
        if (testResults.totalBoltLoadDesign >= req && testResults.spacingOk) {
          if (req < minRequiredLoad) {
            minRequiredLoad = req;
            bestSize = size;
            bestCount = count;
            found = true;
          }
        }
      }
    }

    if (found) {
      setInputs(prev => ({ ...prev, boltSize: bestSize, boltCount: bestCount, useManualOverride: false, actualBCD: 0, actualOD: 0, manualSeatingID: 0, manualSeatingOD: 0, gasketPreference: undefined }));
      alert(`Optimization Completed!\nBolt Size: ${bestSize}"\nBolt Count: ${bestCount} EA`);
    } else {
      alert(`No valid configuration found.`);
    }
  };

  const handleResetAndOptimize = () => {
    setIsFixedSizeSearch(false);
    const autoG0 = calculateAutoG0(inputs, plateMaterials);
    // Preserve custom legend during reset
    const updatedInputs = { ...inputs, g0: autoG0, g1: Math.ceil(autoG0 * 1.3 / 3 + autoG0), useManualOverride: false, actualBCD: 0, actualOD: 0, manualSeatingID: 0, manualSeatingOD: 0, gasketPreference: undefined };
    setInputs(updatedInputs);
    handleOptimize();
  };

  const handleGlobalReset = () => {
    // Preserve custom legend during global reset
    const reset = { ...initialInputs, customLegendUrl: inputs.customLegendUrl };
    setInputs(reset);
    setIsFixedSizeSearch(false);
    setEditingRecordId(null);
  };

  const handleClearRecords = () => setSavedRecords([]);

  const handleSaveToList = () => {
    const newRecord: SavedRecord = {
      id: Date.now().toString(),
      originalInputs: { ...inputs },
      itemNo: inputs.itemNo || '-',
      part: inputs.partName || '-',
      id_mm: inputs.insideDia,
      g0: inputs.g0,
      g1: inputs.g1,
      bcd: Math.round(results.finalBCD),
      flangeOd: Math.round(results.finalOD),
      boltSize: `${inputs.boltSize}"`,
      boltEa: inputs.boltCount,
      boltMaterial: inputs.boltMaterial,
      hasOuterRing: inputs.hasOuterRing,
      hasInnerRing: inputs.hasInnerRing,
      gasketRod: parseFloat(results.gasketOD.toFixed(1)),
      gasketOd: parseFloat(results.seatingOD.toFixed(1)),
      gasketId: parseFloat(results.seatingID.toFixed(1)),
      gasketRid: parseFloat(results.gasketID.toFixed(1)),
      gasketType: inputs.gasketType,
      usePcc1: inputs.usePcc1Check,
      sgT: inputs.sgT, sgMinS: inputs.sgMinS, sgMinO: inputs.sgMinO, sgMax: inputs.sgMax,
      sbMax: inputs.sbMax, sbMin: inputs.sbMin, sfMax: inputs.sfMax, phiFMax: inputs.phiFMax,
      phiGMax: inputs.phiGMax, pccG: inputs.g, passPartReduc: inputs.passPartAreaReduction
    };
    setSavedRecords(prev => [...prev, newRecord]);
    setEditingRecordId(null);
  };

  const handleEditSave = () => {
    if (!editingRecordId) return;
    setSavedRecords(prev => prev.map(rec => rec.id === editingRecordId ? { ...rec, originalInputs: { ...inputs }, itemNo: inputs.itemNo || '-', part: inputs.partName || '-', id_mm: inputs.insideDia, g0: inputs.g0, g1: inputs.g1, bcd: Math.round(results.finalBCD), flangeOd: Math.round(results.finalOD), boltSize: `${inputs.boltSize}"`, boltEa: inputs.boltCount, boltMaterial: inputs.boltMaterial } : rec));
    setEditingRecordId(null);
    alert('Record Updated Successfully!');
  };

  const removeRecord = (id: string) => {
    setSavedRecords(prev => prev.filter(r => r.id !== id));
    if (editingRecordId === id) setEditingRecordId(null);
  };

  const editRecord = (record: SavedRecord) => {
    setInputs(record.originalInputs);
    setEditingRecordId(record.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveAll = () => {
    const dataToSave = { inputs, savedRecords, boltMaterials, plateMaterials, temaBoltData, tensioningData, gasketTypes, ringStandards };
    const blob = new Blob([JSON.stringify(dataToSave, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `FlangeData_${Date.now()}.json`; link.click(); URL.revokeObjectURL(url);
  };

  const handleLoadAll = () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file'; fileInput.accept = '.json';
    fileInput.onchange = (e: any) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsedData = JSON.parse(event.target?.result as string);
          if (parsedData.inputs) {
            // Merge loaded inputs with existing custom legend if loaded file lacks one
            setInputs(prev => ({
              ...parsedData.inputs,
              customLegendUrl: parsedData.inputs.customLegendUrl || prev.customLegendUrl
            }));
          }
          if (parsedData.savedRecords) setSavedRecords(parsedData.savedRecords);
        } catch (error) { console.error(error); }
      };
      reader.readAsText(file);
    };
    fileInput.click();
  };

  const exportToExcel = () => {
    if (savedRecords.length === 0) return;
    const headers = ['ITEM NO', 'PART', 'FLG OD', 'FLG ID', 'FLG BCD', 'GSK OD', 'GSK ID', 'g0', 'g1', 'BOLT SIZE', 'BOLT EA', 'MATERIAL', 'TYPE'];
    const rows = savedRecords.map(r => [r.itemNo, r.part, r.flangeOd, r.id_mm, r.bcd, r.gasketOd, r.gasketId, r.g0, r.g1, r.boltSize, r.boltEa, r.boltMaterial, r.gasketType]);
    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `FlangeSummary_${Date.now()}.csv`; link.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 font-sans text-slate-900">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-sky-600 rounded-xl flex items-center justify-center shadow-lg">
              <i className="fa-solid fa-wrench text-white text-2xl"></i>
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-800 tracking-tighter uppercase">Flange Genie</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">TEMA & ASME & PCC-1 Engineering Calculator</p>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          <div className="xl:col-span-4">
            <Calculator 
              inputs={inputs} onInputChange={handleInputChange} onOptimize={handleOptimize} 
              onResetOptimize={handleResetAndOptimize} onGlobalReset={handleGlobalReset}
              onClearRecords={handleClearRecords} onLoad={handleLoadAll}
              results={results} boltMaterials={boltMaterials} plateMaterials={plateMaterials}
              temaBoltData={temaBoltData} gasketTypes={gasketTypes} ringStandards={ringStandards}
            />
          </div>
          <div className="xl:col-span-8 space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
              <ResultTable inputs={inputs} results={results} temaBoltData={temaBoltData} tensioningData={tensioningData} />
              
              <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-xl overflow-hidden flex flex-col w-full relative">
                <div className="p-8 pb-4 flex justify-between items-center relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-sky-600 rounded flex items-center justify-center"><i className="fa-solid fa-chart-simple text-white text-[10px]"></i></div>
                    <h2 className="text-sm font-black text-slate-800 leading-tight uppercase tracking-tight">REPORT</h2>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleSaveToList} className="bg-[#e12e2e] hover:bg-red-700 text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg flex items-center gap-2">
                      <i className="fa-solid fa-floppy-disk"></i> SAVE
                    </button>
                    <button onClick={handleEditSave} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg flex items-center gap-2 border ${editingRecordId ? 'bg-sky-600 border-sky-400 text-white' : 'bg-[#f1f5f9] border-[#e2e8f0] text-[#94a3b8] cursor-not-allowed'}`}>
                      <i className="fa-solid fa-file-pen"></i> EDIT SAVE
                    </button>
                  </div>
                </div>
                <div className="px-8 pb-8 flex flex-col items-center">
                  <div className="w-full h-[1px] bg-gray-100 mb-8"></div>
                  <FlangeDiagram inputs={inputs} results={results} />
                </div>
                <div className="bg-[#0f172a] mx-3 mb-3 p-8 rounded-[2rem] border border-slate-800 shadow-2xl flex flex-col text-white relative">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="h-[1px] flex-1 bg-slate-800"></div>
                    <span className="text-[8px] font-black text-slate-500 tracking-[0.3em] uppercase">Load Analysis</span>
                    <div className="h-[1px] flex-1 bg-slate-800"></div>
                  </div>
                  <div className={`p-6 rounded-[1.5rem] border mb-4 flex items-center gap-6 ${isSafe ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg ${isSafe ? 'bg-[#00c58d]' : 'bg-[#f83a3a]'}`}><i className={`fa-solid ${isSafe ? 'fa-check' : 'fa-xmark'} text-white text-xl`}></i></div>
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <div><div className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Status</div><div className={`text-sm font-black uppercase ${isSafe ? 'text-[#00c58d]' : 'text-[#f83a3a]'}`}>{isSafe ? 'ACCEPTABLE' : 'RECHECK LOAD'}</div></div>
                      <div className="text-right"><div className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Margin</div><div className={`text-xl font-black ${isSafe ? 'text-[#00c58d]' : 'text-[#f83a3a]'}`}>{marginPercent > 0 ? '+' : ''}{marginPercent.toFixed(1)}%</div></div>
                    </div>
                  </div>
                  {inputs.usePcc1Check && (
                    <div className={`p-6 rounded-[1.5rem] border mb-10 flex items-center gap-6 ${pccStatusInfo.safe ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg ${pccStatusInfo.safe ? 'bg-[#00c58d]' : 'bg-[#f83a3a]'}`}><i className={`fa-solid ${pccStatusInfo.safe ? 'fa-check' : 'fa-xmark'} text-white text-xl`}></i></div>
                      <div className="flex-1">
                        <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest">PCC-1 Summary</div>
                        <div className={`text-sm font-black uppercase ${pccStatusInfo.safe ? 'text-[#00c58d]' : 'text-[#f83a3a]'}`}>{pccStatusInfo.safe ? 'PCC-1 VALIDATED' : 'RECHECK PCC'}</div>
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4 relative z-10">
                    <div className="bg-slate-900/50 p-6 rounded-[1.5rem] border border-white/5 space-y-4 text-center">
                      <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest h-8 flex items-center justify-center px-2">Allowable Bolt Root Area</div>
                      <div className="text-lg font-black text-sky-400">{results.totalBoltArea.toFixed(1)} <small className="text-[9px]">mm²</small></div>
                    </div>
                    <div className="bg-slate-900/50 p-6 rounded-[1.5rem] border border-white/5 space-y-4 text-center">
                      <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest h-8 flex items-center justify-center px-2">Required Bolt Root Area</div>
                      <div className="text-lg font-black text-pink-500">{results.requiredBoltArea.toFixed(1)} <small className="text-[9px]">mm²</small></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <BoltLoadTable 
              inputs={inputs} results={results} 
              boltMaterials={boltMaterials} setBoltMaterials={setBoltMaterials} 
              plateMaterials={plateMaterials} setPlateMaterials={setPlateMaterials}
              temaBoltData={temaBoltData} setTemaBoltData={setTemaBoltData}
              tensioningData={tensioningData} setTensioningData={setTensioningData}
              gasketTypes={gasketTypes} setGasketTypes={setGasketTypes}
              ringStandards={ringStandards} setRingStandards={setRingStandards}
            />
          </div>
        </div>

        {savedRecords.length > 0 && (
          <section className="bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
            <div className="bg-slate-900 px-6 py-4 flex justify-between items-center">
              <h3 className="text-lg font-black text-white uppercase tracking-tighter">Calculation Summary List</h3>
              <div className="flex items-center gap-2">
                <button onClick={handleSaveToList} className="bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 rounded-lg text-[10px] font-black uppercase shadow-md flex items-center gap-2 min-w-[100px] justify-center"><i className="fa-solid fa-floppy-disk"></i> SAVE</button>
                <button onClick={handleEditSave} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase shadow-md flex items-center gap-2 border-2 min-w-[100px] justify-center ${editingRecordId ? 'bg-sky-600 border-sky-400 text-white' : 'bg-slate-100 border-slate-200 text-slate-400'}`}><i className="fa-solid fa-file-pen"></i> EDIT SAVE</button>
                <button onClick={handleClearRecords} className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white px-4 py-1 rounded text-[9px] font-black uppercase tracking-widest border border-red-500/50"><i className="fa-solid fa-trash-can"></i> ALL CLEAR</button>
                <button onClick={exportToExcel} className="bg-white/10 hover:bg-white/20 text-white px-3 py-1 rounded text-[9px] font-black uppercase tracking-widest transition-all"><i className="fa-solid fa-file-excel"></i> PRINT</button>
                <button onClick={handleSaveAll} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2"><i className="fa-solid fa-floppy-disk"></i> OUTPUT</button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[10px] font-bold text-center">
                <thead className="bg-slate-50"><tr><th className="border p-2">ITEM NO</th><th className="border p-2">PART</th><th className="border p-2">OD</th><th className="border p-2">ID</th><th className="border p-2">BCD</th><th className="border p-2">SIZE</th><th className="border p-2">EA</th><th className="border p-2">MATERIAL</th><th className="border p-2">ACTION</th></tr></thead>
                <tbody>{savedRecords.map(record => (
                  <tr key={record.id} className={editingRecordId === record.id ? 'bg-indigo-50' : 'hover:bg-slate-50'}>
                    <td className="border p-2">{record.itemNo}</td><td className="border p-2">{record.part}</td><td className="border p-2">{record.flangeOd}</td><td className="border p-2">{record.id_mm}</td><td className="border p-2">{record.bcd}</td><td className="border p-2">{record.boltSize}</td><td className="border p-2">{record.boltEa}</td><td className="border p-2">{record.boltMaterial}</td>
                    <td className="border p-2"><div className="flex gap-2 justify-center"><button onClick={() => editRecord(record)} className="text-sky-600"><i className="fa-solid fa-pen-to-square"></i></button><button onClick={() => removeRecord(record.id)} className="text-red-600"><i className="fa-solid fa-trash-can"></i></button></div></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default App;