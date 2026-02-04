
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Calculator } from './components/Calculator';
import { ResultTable } from './components/ResultTable';
import { FlangeDiagram } from './components/FlangeDiagram';
import { BoltLoadTable } from './components/BoltLoadTable';
import { TEMA_BOLT_DATA as INITIAL_TEMA_BOLT_DATA, GASKET_RING_TABLE as INITIAL_RING_STANDARDS, ASME_BOLT_MATERIALS as INITIAL_BOLT_MATERIALS, BOLT_TEMP_STEPS, PLATE_TEMP_STEPS, GASKET_TYPES as INITIAL_GASKET_TYPES, WHC_MAX_PITCH_TABLE, HYDRAULIC_TENSIONING_DATA as INITIAL_TENSIONING_DATA, ASME_SHELL_MATERIALS as INITIAL_SHELL_MATERIALS } from './constants';
import { CalculationResults, FlangeInputs, BoltMaterial, ShellMaterial, TemaBoltInfo, TensioningInfo, GasketType, RingStandard } from './types';

interface SavedRecord {
  id: string;
  originalInputs: FlangeInputs;
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
  gasketPreference: undefined,
};

const App: React.FC = () => {
  const importFileInputRef = useRef<HTMLInputElement>(null);
  
  const [boltMaterials, setBoltMaterials] = useState<BoltMaterial[]>(() => {
    const saved = localStorage.getItem('flange_calc_bolt_materials');
    return saved ? JSON.parse(saved) : INITIAL_BOLT_MATERIALS;
  });
  
  const [plateMaterials, setPlateMaterials] = useState<ShellMaterial[]>(() => {
    const saved = localStorage.getItem('flange_calc_plate_materials');
    return saved ? JSON.parse(saved) : INITIAL_SHELL_MATERIALS;
  });

  const [temaBoltData, setTemaBoltData] = useState<TemaBoltInfo[]>(() => {
    const saved = localStorage.getItem('flange_calc_tema_bolt_data');
    return saved ? JSON.parse(saved) : INITIAL_TEMA_BOLT_DATA;
  });

  const [tensioningData, setTensioningData] = useState<TensioningInfo[]>(() => {
    const saved = localStorage.getItem('flange_calc_tensioning_data');
    return saved ? JSON.parse(saved) : INITIAL_TENSIONING_DATA;
  });

  const [gasketTypes, setGasketTypes] = useState<GasketType[]>(() => {
    const saved = localStorage.getItem('flange_calc_gasket_types');
    return saved ? JSON.parse(saved) : INITIAL_GASKET_TYPES;
  });

  const [ringStandards, setRingStandards] = useState<RingStandard[]>(() => {
    const saved = localStorage.getItem('flange_calc_ring_standards');
    return saved ? JSON.parse(saved) : INITIAL_RING_STANDARDS;
  });

  const [inputs, setInputs] = useState<FlangeInputs>(() => {
    const savedInputs = localStorage.getItem('flange_calc_current_inputs');
    if (savedInputs) {
      try {
        const parsed = JSON.parse(savedInputs);
        return { ...initialInputs, ...parsed };
      } catch (e) {
        console.error("Failed to parse saved inputs", e);
      }
    }
    return initialInputs;
  });

  const [savedRecords, setSavedRecords] = useState<SavedRecord[]>(() => {
    const saved = localStorage.getItem('flange_calc_saved_records');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [isFixedSizeSearch, setIsFixedSizeSearch] = useState<boolean>(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('flange_calc_current_inputs', JSON.stringify(inputs));
  }, [inputs]);

  useEffect(() => {
    localStorage.setItem('flange_calc_saved_records', JSON.stringify(savedRecords));
  }, [savedRecords]);

  useEffect(() => {
    localStorage.setItem('flange_calc_bolt_materials', JSON.stringify(boltMaterials));
  }, [boltMaterials]);

  useEffect(() => {
    localStorage.setItem('flange_calc_plate_materials', JSON.stringify(plateMaterials));
  }, [plateMaterials]);

  useEffect(() => {
    localStorage.setItem('flange_calc_tema_bolt_data', JSON.stringify(temaBoltData));
  }, [temaBoltData]);

  useEffect(() => {
    localStorage.setItem('flange_calc_tensioning_data', JSON.stringify(tensioningData));
  }, [tensioningData]);

  useEffect(() => {
    localStorage.setItem('flange_calc_gasket_types', JSON.stringify(gasketTypes));
  }, [gasketTypes]);

  useEffect(() => {
    localStorage.setItem('flange_calc_ring_standards', JSON.stringify(ringStandards));
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

    const boltHoleSizeVal = Math.ceil(boltData.holeSize);
    const effectiveBMin = (currentInputs.useHydraulicTensioning && tensionData) 
      ? Math.max(boltData.B_min, tensionData.B_ten) 
      : boltData.B_min;
    
    const bcdMethod1 = Math.ceil((effectiveBMin * 25.4 * currentInputs.boltCount) / Math.PI);
    const radialDistance = boltData.R * 25.4;
    const bcdMethod2 = Math.ceil(currentInputs.insideDia + (2 * currentInputs.g1) + (2 * radialDistance));

    const baseBCDForAutoGasket = Math.max(bcdMethod1, bcdMethod2);
    const autoSeatingOD_BCD = baseBCDForAutoGasket - boltHoleSizeVal - (2 * effectiveC) - (2 * bConst) - (2 * outerRingWidth);
    const autoSeatingOD_Shell = currentInputs.insideDia + (2 * shellGapA) + (2 * innerRingWidth) + (2 * currentInputs.gasketSeatingWidth);

    let autoSeatingOD = 0;
    if (currentInputs.gasketPreference === 'shell') {
      autoSeatingOD = autoSeatingOD_Shell;
    } else if (currentInputs.gasketPreference === 'bcd') {
      autoSeatingOD = autoSeatingOD_BCD;
    } else {
      autoSeatingOD = Math.max(autoSeatingOD_BCD, autoSeatingOD_Shell);
    }
    
    autoSeatingOD = Math.ceil(autoSeatingOD);
    const autoSeatingID = Math.ceil(autoSeatingOD - (2 * currentInputs.gasketSeatingWidth));

    const seatingID = (currentInputs.useManualOverride && currentInputs.manualSeatingID !== 0) ? currentInputs.manualSeatingID : autoSeatingID;
    const seatingOD = (currentInputs.useManualOverride && currentInputs.manualSeatingOD !== 0) ? currentInputs.manualSeatingOD : autoSeatingOD;
    
    const gasketOD = seatingOD + (currentInputs.hasOuterRing ? (2 * outerRingWidth) : 0);
    const gasketID = seatingID - (currentInputs.hasInnerRing ? (2 * innerRingWidth) : 0);

    const bcdMethod3 = Math.ceil(
      currentInputs.insideDia + 
      (2 * shellGapA) + 
      (2 * innerRingWidth) + 
      (2 * currentInputs.gasketSeatingWidth) + 
      (2 * outerRingWidth) + 
      (2 * bConst) + 
      (2 * effectiveC) + 
      boltHoleSizeVal
    );

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
      maxRaisedFace: Math.ceil(finalBCD - boltHoleSizeVal - (2 * effectiveC) - (2 * bConst) - (2 * outerRingWidth)), 
      boltHoleSize: boltHoleSizeVal,
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
    
    const valA = Math.min(sbSelCalc, inputs.sbMax || Infinity);
    const valB = Math.max(valA, inputs.sbMin || 0);
    const valC = Math.min(valB, inputs.sfMax || Infinity);
    const sbSelFinal = valC;
    
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
            (inputs.phiFMax === 0 ? true : (sbSelFinal <= step8Threshold + 0.001)),
      sbSelFinal
    };
  }, [inputs, results]);

  const isSafe = results.totalBoltLoadDesign >= Math.max(results.wm1, results.wm2);
  const marginPercent = ((results.totalBoltLoadDesign - Math.max(results.wm1, results.wm2)) / (Math.max(results.wm1, results.wm2) || 1)) * 100;

  const handleInputChange = (updatedInputs: FlangeInputs, changedFieldName: string) => {
    let finalInputs = { ...updatedInputs };

    if (changedFieldName === 'boltSize') {
      setIsFixedSizeSearch(true);
    } else {
      const hubHubTriggers = ['insideDia', 'designPressure', 'designTemp', 'shellMaterial', 'g0'];
      if (hubHubTriggers.includes(changedFieldName)) {
        setIsFixedSizeSearch(false);
      }
    }

    const g0Triggers = ['insideDia', 'designTemp', 'tempUnit', 'designPressure', 'pressureUnit', 'shellMaterial', 'jointEfficiency', 'corrosionAllowance'];
    if (g0Triggers.includes(changedFieldName)) {
       const autoG0 = calculateAutoG0(finalInputs, plateMaterials);
       finalInputs.g0 = autoG0;
       finalInputs.g1 = Math.ceil(autoG0 * 1.3 / 3 + autoG0);
    }

    setInputs(finalInputs);
  };

  const handleOptimize = () => {
    let bestSize = inputs.boltSize;
    let bestCount = inputs.boltCount;
    let minMargin = Infinity; 
    let minDimensionScore = Infinity;
    let found = false;

    const sizesToSearch = isFixedSizeSearch ? [inputs.boltSize] : temaBoltData.filter(b => b.size >= 0.75).map(b => b.size);
    const boltCounts = [4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 68, 72, 76, 80];

    for (const size of sizesToSearch) {
      for (const count of boltCounts) {
        const testInputs = { ...inputs, boltSize: size, boltCount: count };
        const testResults = calculateFullResults(testInputs);
        
        const isAreaSafe = testResults.totalBoltArea >= testResults.requiredBoltArea;
        const isSpacingOk = testResults.spacingOk;

        if (isAreaSafe && isSpacingOk) {
          const loadReq = Math.max(testResults.wm1, testResults.wm2);
          const margin = (testResults.totalBoltLoadDesign - loadReq) / (loadReq || 1);
          const currentBcd = testResults.finalBCD;
          const currentSeatingOD = testResults.maxRaisedFace; 

          if (isFixedSizeSearch) {
            if (!found || count < bestCount) {
              bestCount = count;
              minMargin = margin;
              found = true;
            }
          } else if (inputs.gasketPreference === 'shell' || inputs.useManualOverride) {
            if (margin >= 0 && margin < minMargin) {
              minMargin = margin;
              bestSize = size;
              bestCount = count;
              found = true;
            }
          } else {
            const dimensionScore = currentBcd + currentSeatingOD;
            if (!found || dimensionScore < minDimensionScore || (dimensionScore === minDimensionScore && margin < minMargin)) {
              minDimensionScore = dimensionScore;
              minMargin = margin;
              bestSize = size;
              bestCount = count;
              found = true;
            }
          }
        }
      }
    }

    if (found) {
      setInputs(prev => ({ ...prev, boltSize: bestSize, boltCount: bestCount }));
      alert(`Optimization Completed!\nSize: ${bestSize}"\nCount: ${bestCount} EA\nMargin: ${(minMargin * 100).toFixed(2)}%`);
    } else {
      alert(`No valid configuration found. Consider relaxing constraints.`);
    }
  };

  const handleResetAndOptimize = () => {
    setIsFixedSizeSearch(false);
    const autoG0 = calculateAutoG0(inputs, plateMaterials);
    const updatedInputs = { 
      ...inputs, 
      g0: autoG0, 
      g1: Math.ceil(autoG0 * 1.3 / 3 + autoG0), 
      useManualOverride: false, 
      actualBCD: 0, 
      actualOD: 0, 
      manualSeatingID: 0, 
      manualSeatingOD: 0, 
      gasketPreference: undefined 
    };
    setInputs(updatedInputs);
    setTimeout(handleOptimize, 100); 
  };

  const handleGlobalReset = () => {
    const preservedLegendUrl = inputs.customLegendUrl;
    setInputs({ ...initialInputs, customLegendUrl: preservedLegendUrl });
    setIsFixedSizeSearch(false);
    setEditingRecordId(null);
  };

  const handleClearRecords = () => {
     if(window.confirm('Calculation Summary List에 있는 모든 데이터를 삭제하시겠습니까?')) {
        setSavedRecords([]);
        setEditingRecordId(null);
     }
  };

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
    alert('Record Updated!');
  };

  const removeRecord = (id: string) => setSavedRecords(prev => prev.filter(r => r.id !== id));

  const editRecord = (record: SavedRecord) => {
    setInputs(record.originalInputs);
    setEditingRecordId(record.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveAll = () => {
    const data = { 
      inputs, 
      savedRecords, 
      boltMaterials, 
      plateMaterials, 
      temaBoltData, 
      tensioningData, 
      gasketTypes, 
      ringStandards,
      timestamp: Date.now()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `FlangeProject_${inputs.itemNo || 'Unsaved'}_${Date.now()}.json`; link.click(); URL.revokeObjectURL(url);
  };

  const handleImportAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        
        // Critical state restoration
        if (data.inputs) setInputs(data.inputs);
        if (data.savedRecords && Array.isArray(data.savedRecords)) {
          setSavedRecords(data.savedRecords);
        }
        
        // Library restoration
        if (data.boltMaterials) setBoltMaterials(data.boltMaterials);
        if (data.plateMaterials) setPlateMaterials(data.plateMaterials);
        if (data.temaBoltData) setTemaBoltData(data.temaBoltData);
        if (data.tensioningData) setTensioningData(data.tensioningData);
        if (data.gasketTypes) setGasketTypes(data.gasketTypes);
        if (data.ringStandards) setRingStandards(data.ringStandards);
        
        setEditingRecordId(null);
        alert('Project and ITEM LIST Reloaded Successfully!');
      } catch (err) {
        console.error(err);
        alert('Failed to load project file. Please check if the file is a valid JSON output from this tool.');
      }
    };
    reader.readAsText(file);
    event.target.value = ''; 
  };

  const exportToExcel = () => {
    if (savedRecords.length === 0) return;
    const headers = ['ITEM NO', 'PART', 'FLG OD', 'FLG ID', 'FLG BCD', 'GSK OD', 'GSK ID', 'g0', 'g1', 'BOLT SIZE', 'BOLT EA', 'MATERIAL', 'TYPE'];
    const rows = savedRecords.map(r => [r.itemNo, r.part, r.flangeOd, r.id_mm, r.bcd, r.gasketOd, r.id_mm, r.g0, r.g1, r.boltSize, r.boltEa, r.boltMaterial, r.gasketType]);
    const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `FlangeSummary_${Date.now()}.csv`; link.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 font-sans text-slate-900">
      <input 
        type="file" 
        ref={importFileInputRef} 
        onChange={handleImportAll} 
        accept=".json" 
        className="hidden" 
      />
      
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-sky-600 rounded-xl flex items-center justify-center shadow-lg">
              <i className="fa-solid fa-wrench text-white text-2xl"></i>
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-800 tracking-tighter uppercase">flange calculation</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">TEMA & ASME & PCC-1 Engineering Tool</p>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          <div className="xl:col-span-4">
            <Calculator 
              inputs={inputs} onInputChange={handleInputChange} onOptimize={handleOptimize} 
              onResetOptimize={handleResetAndOptimize} onGlobalReset={handleGlobalReset}
              onClearRecords={handleClearRecords} onLoad={() => importFileInputRef.current?.click()}
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
                    <button onClick={handleSaveToList} className="bg-[#e12e2e] hover:bg-red-700 text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg flex items-center gap-2"><i className="fa-solid fa-floppy-disk"></i> SAVE</button>
                    <button onClick={handleEditSave} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg flex items-center gap-2 border ${editingRecordId ? 'bg-sky-600 border-sky-400 text-white' : 'bg-[#f1f5f9] border-[#e2e8f0] text-[#94a3b8] cursor-not-allowed'}`}><i className="fa-solid fa-file-pen"></i> EDIT SAVE</button>
                  </div>
                </div>
                <div className="px-8 pb-8 flex flex-col items-center">
                  <div className="w-full h-[1px] bg-gray-100 mb-8"></div>
                  <FlangeDiagram inputs={inputs} results={results} />
                </div>
                <div className="bg-[#0f172a] mx-3 mb-3 p-8 rounded-[2rem] border border-slate-800 shadow-2xl flex flex-col text-white relative">
                  <div className="flex items-center gap-4 mb-6"><div className="h-[1px] flex-1 bg-white/10"></div><span className="text-[10px] font-black text-slate-500 tracking-[0.3em] uppercase">LOAD ANALYSIS</span><div className="h-[1px] flex-1 bg-white/10"></div></div>
                  
                  <div className="p-4 rounded-3xl border border-slate-800 bg-[#161e31] flex items-center gap-5 mb-3 transition-all">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg shrink-0 ${isSafe ? 'bg-[#00c58d]' : 'bg-[#f83a3a]'}`}>
                      <i className={`fa-solid ${isSafe ? 'fa-check' : 'fa-xmark'} text-white text-lg`}></i>
                    </div>
                    <div className="flex-1 flex justify-between items-center">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-bold text-[#525f7a] uppercase tracking-widest">STATUS</span>
                        <span className={`text-sm font-black uppercase tracking-tight ${isSafe ? 'text-[#00c58d]' : 'text-[#f83a3a]'}`}>
                          {isSafe ? 'ACCEPTABLE' : 'RECHECK LOAD'}
                        </span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-[9px] font-bold text-[#525f7a] uppercase tracking-widest">MARGIN</span>
                        <span className={`text-xl font-black tracking-tighter ${isSafe ? 'text-[#00c58d]' : 'text-[#f83a3a]'}`}>
                          {marginPercent > 0 ? '+' : ''}{marginPercent.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {inputs.usePcc1Check && (
                    <div className="p-4 rounded-3xl border border-slate-800 bg-[#161e31] flex items-center gap-5 mb-3 transition-all animate-in fade-in slide-in-from-top-1 duration-300">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg shrink-0 ${pccStatusInfo.safe ? 'bg-[#00c58d]' : 'bg-[#f83a3a]'}`}>
                        <i className={`fa-solid ${pccStatusInfo.safe ? 'fa-check' : 'fa-xmark'} text-white text-lg`}></i>
                      </div>
                      <div className="flex-1 flex justify-between items-center">
                        <div className="flex flex-col">
                          <span className="text-[9px] font-bold text-[#525f7a] uppercase tracking-widest">PCC-1 SUMMARY</span>
                          <span className={`text-sm font-black uppercase tracking-tight ${pccStatusInfo.safe ? 'text-[#00c58d]' : 'text-[#f83a3a]'}`}>
                            {pccStatusInfo.safe ? 'ACCEPTABLE' : 'RECHECK PCC'}
                          </span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-[9px] font-bold text-[#525f7a] uppercase tracking-widest">SELECTED Sb</span>
                          <span className={`text-xl font-black tracking-tighter ${pccStatusInfo.safe ? 'text-[#00c58d]' : 'text-[#f83a3a]'}`}>
                            {pccStatusInfo.sbSelFinal.toFixed(1)}<small className="text-[10px] ml-1">MPa</small>
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 relative z-10 mt-6">
                    <div className="bg-slate-900/50 p-6 rounded-[1.5rem] border border-white/5 space-y-4 text-center"><div className="text-[8px] font-black text-slate-500 uppercase tracking-widest h-8 flex items-center justify-center px-2">Total Bolt Root Area</div><div className="text-lg font-black text-sky-400">{results.totalBoltArea.toFixed(1)} <small className="text-[9px]">mm²</small></div></div>
                    <div className="bg-slate-900/50 p-6 rounded-[1.5rem] border border-white/5 space-y-4 text-center"><div className="text-[8px] font-black text-slate-500 uppercase tracking-widest h-8 flex items-center justify-center px-2">Required Bolt Root Area</div><div className="text-lg font-black text-pink-500">{results.requiredBoltArea.toFixed(1)} <small className="text-[9px]">mm²</small></div></div>
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
            <div className="bg-[#0f172a] px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-4">
                <h3 className="text-lg font-black text-white uppercase tracking-tighter">Calculation Summary List</h3>
              </div>
              <div className="flex flex-wrap items-center justify-center md:justify-end gap-2">
                <button onClick={handleSaveToList} className="bg-[#e12e2e] hover:bg-red-700 text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg flex items-center gap-2"><i className="fa-solid fa-floppy-disk"></i> SAVE</button>
                <button onClick={handleEditSave} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg flex items-center gap-2 border ${editingRecordId ? 'bg-sky-600 border-sky-400 text-white' : 'bg-[#f1f5f9] border-[#e2e8f0] text-[#94a3b8] cursor-not-allowed'}`}><i className="fa-solid fa-file-pen"></i> EDIT SAVE</button>
                <button onClick={handleClearRecords} className="bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-lg"><i className="fa-solid fa-trash-can"></i> ALL DELETE</button>
                <button onClick={exportToExcel} className="bg-slate-800 hover:bg-black text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 border border-white/10 shadow-lg"><i className="fa-solid fa-file-excel"></i> PRINT</button>
                <button onClick={handleSaveAll} className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-lg"><i className="fa-solid fa-floppy-disk"></i> OUTPUT</button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[10px] font-bold text-center">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="border-x p-3 uppercase text-slate-500 tracking-tight">ITEM NO</th>
                    <th className="border-x p-3 uppercase text-slate-500 tracking-tight">PART</th>
                    <th className="border-x p-3 uppercase text-slate-500 tracking-tight">OD</th>
                    <th className="border-x p-3 uppercase text-slate-500 tracking-tight">ID</th>
                    <th className="border-x p-3 uppercase text-slate-500 tracking-tight">BCD</th>
                    <th className="border-x p-3 uppercase text-slate-500 tracking-tight">SIZE</th>
                    <th className="border-x p-3 uppercase text-slate-500 tracking-tight">EA</th>
                    <th className="border-x p-3 uppercase text-slate-500 tracking-tight">MATERIAL</th>
                    <th className="border-x p-3 uppercase text-slate-500 tracking-tight">ACTION</th>
                  </tr>
                </thead>
                <tbody>{savedRecords.map(record => (
                  <tr key={record.id} className={`${editingRecordId === record.id ? 'bg-indigo-50/50' : 'hover:bg-slate-50'} transition-colors border-b`}>
                    <td className="border-x p-3 font-mono">{record.itemNo}</td>
                    <td className="border-x p-3">{record.part}</td>
                    <td className="border-x p-3 font-mono">{record.flangeOd}</td>
                    <td className="border-x p-3 font-mono">{record.id_mm}</td>
                    <td className="border-x p-3 font-mono">{record.bcd}</td>
                    <td className="border-x p-3 font-mono">{record.boltSize}</td>
                    <td className="border-x p-3 font-mono">{record.boltEa}</td>
                    <td className="border-x p-3 font-black text-slate-600">{record.boltMaterial}</td>
                    <td className="border-x p-3">
                      <div className="flex gap-3 justify-center">
                        <button onClick={() => editRecord(record)} className="text-sky-600 hover:text-sky-800 transition-colors"><i className="fa-solid fa-pen-to-square"></i></button>
                        <button onClick={() => removeRecord(record.id)} className="text-red-600 hover:text-red-800 transition-colors"><i className="fa-solid fa-trash-can"></i></button>
                      </div>
                    </td>
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
