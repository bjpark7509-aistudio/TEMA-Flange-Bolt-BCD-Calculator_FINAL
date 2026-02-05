import React, { useState, useEffect, useRef } from 'react';
import { CalculationResults, FlangeInputs, BoltMaterial, ShellMaterial, TemaBoltInfo, TensioningInfo, GasketType, RingStandard } from '../types';
import { BOLT_TEMP_STEPS, PLATE_TEMP_STEPS, API660_PCC1_STRESS_TABLE } from '../constants';

interface Props {
  inputs: FlangeInputs;
  results: CalculationResults;
  boltMaterials: BoltMaterial[];
  setBoltMaterials: React.Dispatch<React.SetStateAction<BoltMaterial[]>>;
  plateMaterials: ShellMaterial[];
  setPlateMaterials: React.Dispatch<React.SetStateAction<ShellMaterial[]>>;
  temaBoltData: TemaBoltInfo[];
  setTemaBoltData: React.Dispatch<React.SetStateAction<TemaBoltInfo[]>>;
  tensioningData: TensioningInfo[];
  setTensioningData: React.Dispatch<React.SetStateAction<TensioningInfo[]>>;
  gasketTypes: GasketType[];
  setGasketTypes: React.Dispatch<React.SetStateAction<GasketType[]>>;
  ringStandards: RingStandard[];
  setRingStandards: React.Dispatch<React.SetStateAction<RingStandard[]>>;
}

type ForceUnit = 'kN' | 'N' | 'lbf' | 'kgf';
type TabId = 'current' | 'bolts' | 'tensioning' | 'stress' | 'plate_stress' | 'gaskets' | 'rings' | 'pcc1';

export const BoltLoadTable: React.FC<Props> = ({ inputs, results, boltMaterials, setBoltMaterials, plateMaterials, setPlateMaterials, temaBoltData, setTemaBoltData, tensioningData, setTensioningData, gasketTypes, setGasketTypes, ringStandards, setRingStandards }) => {
  const [showBackData, setShowBackData] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('current');
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingKeyNum, setEditingKeyNum] = useState<number | null>(null);

  const [isEditingMaterial, setIsEditingMaterial] = useState<boolean>(false);
  const [editingMaterial, setEditingMaterial] = useState<BoltMaterial | null>(null);

  const [isEditingPlateMaterial, setIsEditingPlateMaterial] = useState<boolean>(false);
  const [editingPlateMaterial, setEditingPlateMaterial] = useState<ShellMaterial | null>(null);

  const [isEditingBoltSpec, setIsEditingBoltSpec] = useState<boolean>(false);
  const [editingBoltSpec, setEditingBoltSpec] = useState<TemaBoltInfo | null>(null);

  const [isEditingTensioningSpec, setIsEditingTensioningSpec] = useState<boolean>(false);
  const [editingTensioningSpec, setEditingTensioningSpec] = useState<TensioningInfo | null>(null);

  const [isEditingGasketFactor, setIsEditingGasketFactor] = useState<boolean>(false);
  const [editingGasketFactor, setEditingGasketFactor] = useState<GasketType | null>(null);

  const [isEditingRingStandard, setIsEditingRingStandard] = useState<boolean>(false);
  const [editingRingStandard, setEditingRingStandard] = useState<RingStandard | null>(null);
  
  const boltFileInputRef = useRef<HTMLInputElement>(null);
  const plateFileInputRef = useRef<HTMLInputElement>(null);
  const temaBoltFileInputRef = useRef<HTMLInputElement>(null);
  const tensioningFileInputRef = useRef<HTMLInputElement>(null);
  const gasketFileInputRef = useRef<HTMLInputElement>(null);
  const ringFileInputRef = useRef<HTMLInputElement>(null);

  const getDefaultForceUnit = (pressureUnit: string): ForceUnit => {
    switch (pressureUnit) {
      case 'PSI': return 'lbf';
      case 'kg/cm²': return 'kgf';
      case 'MPa':
      case 'Bar':
      default: return 'kN';
    }
  };

  const [selectedForceUnit, setSelectedForceUnit] = useState<ForceUnit>(getDefaultForceUnit(inputs.pressureUnit));

  useEffect(() => {
    setSelectedForceUnit(getDefaultForceUnit(inputs.pressureUnit));
  }, [inputs.pressureUnit]);

  const convertForce = (valueInN: number, unit: ForceUnit): number => {
    switch (unit) {
      case 'kN': return valueInN / 1000;
      case 'lbf': return valueInN * 0.224809;
      case 'kgf': return valueInN * 0.101972;
      case 'N':
      default: return valueInN;
    }
  };

  const formatValue = (val: number) => {
    if (selectedForceUnit === 'N') return val.toLocaleString(undefined, { maximumFractionDigits: 0 });
    return val.toLocaleString(undefined, { maximumFractionDigits: 1 });
  };

  const pMpa = (() => {
    const p = inputs.designPressure;
    switch (inputs.pressureUnit) {
      case 'Bar': return p * 0.1;
      case 'PSI': return p * 0.00689476;
      case 'kg/cm²': return p * 0.0980665;
      default: return p;
    }
  })();

  const exportTableToCsv = (filename: string, headers: string[], rows: (string | number | null)[][]) => {
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => {
        const str = String(cell ?? '').replace(/"/g, '""');
        return `"${str}"`;
      }).join(','))
    ].join('\n');

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportStresses = (type: 'bolt' | 'plate') => {
    const data = type === 'bolt' ? boltMaterials : plateMaterials;
    const steps = type === 'bolt' ? BOLT_TEMP_STEPS : PLATE_TEMP_STEPS;
    const headers = ['Material ID', 'Min_Tensile', 'Min_Yield', ...steps.map(t => `${t} °C`)];
    const rows = data.map(m => [m.id, m.minTensile || 0, m.minYield || 0, ...m.stresses]);
    exportTableToCsv(type === 'bolt' ? 'Bolt_Stresses' : 'Plate_Stresses', headers, rows);
  };

  const handleExportBoltSpecs = () => {
    const headers = ['Size (in)', 'R (in)', 'B_min (in)', 'bMinWhc (mm)', 'E (in)', 'Hole dH (mm)', 'Area (mm²)'];
    const rows = temaBoltData.map(b => [b.size, b.R, b.B_min, b.bMinWhc || '-', b.E, b.holeSize, b.tensileArea]);
    exportTableToCsv('Bolt_Specifications_Table_D5', headers, rows);
  };

  const handleExportTensioning = () => {
    const headers = ['Bolt Size (in)', 'B_ten (in)'];
    const rows = tensioningData.map(t => [t.size, t.B_ten]);
    exportTableToCsv('Bolt_Tensioning_Specs', headers, rows);
  };

  const handleExportGaskets = () => {
    const headers = ['Gasket Material', 'Factor m', 'Seating Stress y (PSI)', 'Facing Sketch'];
    const rows = gasketTypes.map(g => [g.id, g.m, g.y, g.sketches]);
    exportTableToCsv('Gasket_Factors', headers, rows);
  };

  const handleExportRings = () => {
    const headers = ['Shell ID Min (mm)', 'Shell ID Max (mm)', 'Min IR Width (mm)', 'Min OR Width (mm)'];
    const rows = ringStandards.map(r => [r.min, r.max === 100000 ? '999999' : r.max, r.irMin, r.orMin]);
    exportTableToCsv('Ring_Standards', headers, rows);
  };

  const totalBoltRootArea = results.singleBoltArea * inputs.boltCount;
  const ringArea = (Math.PI / 4) * (Math.pow(results.seatingOD, 2) - Math.pow(results.seatingID, 2));
  const reducedPassArea = (inputs.passPartAreaReduction / 100) * inputs.passPartitionWidth * inputs.passPartitionLength;
  const totalAg = ringArea + reducedPassArea;

  const sbSelCalc = totalBoltRootArea > 0 ? (inputs.sgT * totalAg) / totalBoltRootArea : 0;
  const valA = Math.min(sbSelCalc, inputs.sbMax || Infinity);
  const valB = Math.max(valA, inputs.sbMin || 0);
  const valC = Math.min(valB, inputs.sfMax || Infinity);
  const sbSelFinal = valC;

  const step5Threshold = totalBoltRootArea > 0 ? inputs.sgMinS * (totalAg / totalBoltRootArea) : 0;
  const step6Numerator = (inputs.sgMinO * totalAg) + ((Math.PI / 4) * pMpa * Math.pow(results.seatingID, 2));
  const step6Denominator = (inputs.g || 1) * totalBoltRootArea;
  const step6Threshold = totalBoltRootArea > 0 ? step6Numerator / step6Denominator : 0;
  const step7Threshold = totalBoltRootArea > 0 ? inputs.sgMax * (totalAg / totalBoltRootArea) : Infinity;
  const step8Threshold = inputs.phiFMax > 0 ? inputs.sfMax * ((inputs.phiGMax || 1) / inputs.phiFMax) : Infinity;

  const isStep5Ok = sbSelFinal >= step5Threshold - 0.001;
  const isStep6Ok = sbSelFinal >= step6Threshold - 0.001;
  const isStep7Ok = inputs.sgMax === 0 ? true : (sbSelFinal <= step7Threshold + 0.001);
  const isStep8Ok = inputs.phiFMax === 0 ? true : (sbSelFinal <= step8Threshold + 0.001);

  const currentBoltRef = temaBoltData.find(b => b.size === inputs.boltSize);
  const currentGasketRef = gasketTypes.find(g => g.id === inputs.gasketType);

  const tableHeaderClass = "px-4 py-3 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 border-b border-slate-200 sticky top-0 z-10 whitespace-nowrap";
  const tableCellClass = "px-4 py-3 text-[10px] font-mono text-slate-700 border-b border-slate-100 whitespace-nowrap";

  // Summary Card Visual Helpers
  const SummaryCard = ({ label, value, unit, className = "" }: { label: string, value: string | number, unit?: string, className?: string }) => (
    <div className={`bg-slate-50/50 p-4 rounded-2xl border border-slate-100 shadow-sm transition-all hover:shadow-md ${className}`}>
      <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{label}</span>
      <span className="text-sm font-black text-slate-700 tabular-nums">
        {value}{unit && <small className="ml-1 text-[10px] font-bold text-slate-400">{unit}</small>}
      </span>
    </div>
  );

  const GasketFactorCard = ({ label, value, className = "" }: { label: string, value: string | number, className?: string }) => (
    <div className={`bg-white p-6 rounded-2xl border-2 border-yellow-100 shadow-sm transition-all ${className}`}>
      <span className="block text-[10px] font-black text-amber-500 uppercase tracking-widest mb-3">{label}</span>
      <span className="text-3xl font-black text-amber-700 tabular-nums">
        {value}
      </span>
    </div>
  );

  const handleAddNewBoltMaterial = () => {
    setEditingId(null);
    const newMat: BoltMaterial = {
      id: "New Material " + (boltMaterials.length + 1),
      minTensile: 0,
      minYield: 0,
      stresses: new Array(BOLT_TEMP_STEPS.length).fill(null)
    };
    setEditingMaterial(newMat);
    setIsEditingMaterial(true);
  };

  const handleEditBoltMaterial = (mat: BoltMaterial) => {
    setEditingId(mat.id);
    setEditingMaterial({ ...mat, stresses: [...mat.stresses] });
    setIsEditingMaterial(true);
  };

  const handleDeleteBoltMaterial = (id: string) => {
    if (id === inputs.boltMaterial) {
      alert("Cannot delete the currently selected bolt material.");
      return;
    }
    if (confirm(`Are you sure you want to delete material "${id}"?`)) {
      setBoltMaterials(prev => prev.filter(m => m.id !== id));
    }
  };

  const saveBoltMaterial = () => {
    if (!editingMaterial) return;
    if (!editingMaterial.id.trim()) {
      alert("Material ID is required.");
      return;
    }
    setBoltMaterials(prev => {
      if (editingId) {
        return prev.map(m => m.id === editingId ? editingMaterial : m);
      }
      return [...prev, editingMaterial];
    });
    setIsEditingMaterial(false);
    setEditingMaterial(null);
    setEditingId(null);
  };

  const handleAddNewPlateMaterial = () => {
    setEditingId(null);
    const newMat: ShellMaterial = {
      id: "New Plate Material " + (plateMaterials.length + 1),
      minTensile: 0,
      minYield: 0,
      stresses: new Array(PLATE_TEMP_STEPS.length).fill(null)
    };
    setEditingPlateMaterial(newMat);
    setIsEditingPlateMaterial(true);
  };

  const handleEditPlateMaterial = (mat: ShellMaterial) => {
    setEditingId(mat.id);
    setEditingPlateMaterial({ ...mat, stresses: [...mat.stresses] });
    setIsEditingPlateMaterial(true);
  };

  const handleDeletePlateMaterial = (id: string) => {
    if (id === inputs.shellMaterial) {
      alert("Cannot delete the currently selected plate material.");
      return;
    }
    if (confirm(`Are you sure you want to delete plate material "${id}"?`)) {
      setPlateMaterials(prev => prev.filter(m => m.id !== id));
    }
  };

  const savePlateMaterial = () => {
    if (!editingPlateMaterial) return;
    if (!editingPlateMaterial.id.trim()) {
      alert("Material ID is required.");
      return;
    }
    setPlateMaterials(prev => {
      if (editingId) {
        return prev.map(m => m.id === editingId ? editingPlateMaterial : m);
      }
      return [...prev, editingPlateMaterial];
    });
    setIsEditingPlateMaterial(false);
    setEditingPlateMaterial(null);
    setEditingId(null);
  };

  const handleAddNewBoltSpec = () => {
    setEditingKeyNum(null);
    const newSpec: TemaBoltInfo = { size: 0, R: 0, B_min: 0, E: 0, holeSize: 0, tensileArea: 0 };
    setEditingBoltSpec(newSpec);
    setIsEditingBoltSpec(true);
  };

  const handleEditBoltSpec = (spec: TemaBoltInfo) => {
    setEditingKeyNum(spec.size);
    setEditingBoltSpec({ ...spec });
    setIsEditingBoltSpec(true);
  };

  const handleDeleteBoltSpec = (size: number) => {
    if (size === inputs.boltSize) {
      alert("Cannot delete the currently selected bolt size.");
      return;
    }
    if (confirm(`Are you sure you want to delete bolt spec for size ${size}"?`)) {
      setTemaBoltData(prev => prev.filter(b => b.size !== size));
    }
  };

  const saveBoltSpec = () => {
    if (!editingBoltSpec) return;
    if (editingBoltSpec.size <= 0) {
      alert("Bolt size must be greater than 0.");
      return;
    }
    setTemaBoltData(prev => {
      if (editingKeyNum !== null) {
        return prev.map(b => b.size === editingKeyNum ? editingBoltSpec : b);
      }
      return [...prev, editingBoltSpec];
    });
    setIsEditingBoltSpec(false);
    setEditingBoltSpec(null);
    setEditingKeyNum(null);
  };

  const handleAddNewTensioningSpec = () => {
    setEditingKeyNum(null);
    const newSpec: TensioningInfo = { size: 0, B_ten: 0 };
    setEditingTensioningSpec(newSpec);
    setIsEditingTensioningSpec(true);
  };

  const handleEditTensioningSpec = (spec: TensioningInfo) => {
    setEditingKeyNum(spec.size);
    setEditingTensioningSpec({ ...spec });
    setIsEditingTensioningSpec(true);
  };

  const handleDeleteTensioningSpec = (size: number) => {
    if (confirm(`Are you sure you want to delete tensioning spec for size ${size}"?`)) {
      setTensioningData(prev => prev.filter(t => t.size !== size));
    }
  };

  const saveTensioningSpec = () => {
    if (!editingTensioningSpec) return;
    if (editingTensioningSpec.size <= 0) {
      alert("Bolt size must be greater than 0.");
      return;
    }
    setTensioningData(prev => {
      if (editingKeyNum !== null) {
        return prev.map(t => t.size === editingKeyNum ? editingTensioningSpec : t);
      }
      return [...prev, editingTensioningSpec];
    });
    setIsEditingTensioningSpec(false);
    setEditingTensioningSpec(null);
    setEditingKeyNum(null);
  };

  const handleAddNewGasketFactor = () => {
    setEditingId(null);
    const newGasket: GasketType = { id: "New Gasket " + (gasketTypes.length + 1), m: 0, y: 0, sketches: "" };
    setEditingGasketFactor(newGasket);
    setIsEditingGasketFactor(true);
  };

  const handleEditGasketFactor = (g: GasketType) => {
    setEditingId(g.id);
    setEditingGasketFactor({ ...g });
    setIsEditingGasketFactor(true);
  };

  const handleDeleteGasketFactor = (id: string) => {
    if (id === inputs.gasketType || id === inputs.passGasketType) {
      alert("Cannot delete the currently selected gasket type.");
      return;
    }
    if (confirm(`Are you sure you want to delete gasket type "${id}"?`)) {
      setGasketTypes(prev => prev.filter(g => g.id !== id));
    }
  };

  const saveGasketFactor = () => {
    if (!editingGasketFactor) return;
    if (!editingGasketFactor.id.trim()) {
      alert("Gasket ID is required.");
      return;
    }
    setGasketTypes(prev => {
      if (editingId) {
        return prev.map(g => g.id === editingId ? editingGasketFactor : g);
      }
      return [...prev, editingGasketFactor];
    });
    setIsEditingGasketFactor(false);
    setEditingGasketFactor(null);
    setEditingId(null);
  };

  const handleAddNewRingStandard = () => {
    setEditingKeyNum(null);
    const newRing: RingStandard = { min: 0, max: 0, irMin: 0, orMin: 0 };
    setEditingRingStandard(newRing);
    setIsEditingRingStandard(true);
  };

  const handleEditRingStandard = (ring: RingStandard) => {
    setEditingKeyNum(ring.min);
    setEditingRingStandard({ ...ring });
    setIsEditingRingStandard(true);
  };

  const handleDeleteRingStandard = (min: number, max: number) => {
    if (confirm(`Are you sure you want to delete ring standard for range ${min} - ${max}?`)) {
      setRingStandards(prev => prev.filter(r => !(r.min === min && r.max === max)));
    }
  };

  const saveRingStandard = () => {
    if (!editingRingStandard) return;
    setRingStandards(prev => {
      if (editingKeyNum !== null) {
        return prev.map(r => r.min === editingKeyNum ? editingRingStandard : r);
      }
      return [...prev, editingRingStandard];
    });
    setIsEditingRingStandard(false);
    setEditingRingStandard(null);
    setEditingKeyNum(null);
  };

  const handleRingCsvUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split(/\r?\n/);
      const data: RingStandard[] = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const cols = line.split(',').map(c => c.trim());
        if (cols.length < 4) continue;
        data.push({
          min: parseFloat(cols[0]) || 0,
          max: parseFloat(cols[1]) || 100000,
          irMin: parseFloat(cols[2]) || 0,
          orMin: parseFloat(cols[3]) || 0
        });
      }
      if (data.length > 0) {
        setRingStandards(data);
        alert(`Imported ${data.length} ring standards.`);
      } else alert("Invalid CSV format.");
    };
    reader.readAsText(file);
    if (event.target) event.target.value = '';
  };

  const handleSaveRingStandardsToLocalStorage = () => {
    localStorage.setItem('flange_calc_ring_standards', JSON.stringify(ringStandards));
    alert('Ring Standards have been saved as default values.');
  };

  const handleGasketCsvUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split(/\r?\n/);
      const data: GasketType[] = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const cols = line.split(',').map(c => c.trim());
        if (cols.length < 3) continue;
        data.push({
          id: cols[0],
          m: parseFloat(cols[1]) || 0,
          y: parseFloat(cols[2]) || 0,
          sketches: cols[3] || ""
        });
      }
      if (data.length > 0) {
        setGasketTypes(data);
        alert(`Imported ${data.length} gasket factors.`);
      } else alert("Invalid CSV format.");
    };
    reader.readAsText(file);
    if (event.target) event.target.value = '';
  };

  const handleSaveGasketTypesToLocalStorage = () => {
    localStorage.setItem('flange_calc_gasket_types', JSON.stringify(gasketTypes));
    alert('Gasket Factors have been saved as default values.');
  };

  const handleTensioningCsvUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split(/\r?\n/);
      const data: TensioningInfo[] = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const cols = line.split(',').map(c => c.trim());
        if (cols.length < 2) continue;
        data.push({ size: parseFloat(cols[0]) || 0, B_ten: parseFloat(cols[1]) || 0 });
      }
      if (data.length > 0) {
        setTensioningData(data);
        alert(`Imported ${data.length} tensioning specifications.`);
      } else alert("Invalid CSV format.");
    };
    reader.readAsText(file);
    if (event.target) event.target.value = '';
  };

  const handleSaveTensioningToLocalStorage = () => {
    localStorage.setItem('flange_calc_tensioning_data', JSON.stringify(tensioningData));
    alert('Bolt Tensioning Specifications have been saved as default values.');
  };

  const handleTemaBoltCsvUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split(/\r?\n/);
      if (lines.length < 2) return;
      const headerRow = lines[0].split(',').map(h => h.trim().toLowerCase());
      const findColIdx = (exactKey: string, partialKeywords: string[]) => {
        const exact = headerRow.indexOf(exactKey.toLowerCase());
        if (exact !== -1) return exact;
        return headerRow.findIndex(h => partialKeywords.some(k => h.toLowerCase().includes(k.toLowerCase())));
      };
      const idxSize = findColIdx('Size (in)', ['size (in)', 'size']);
      const idxR = findColIdx('R (in)', ['r (in)', 'radial', 'r']);
      const idxBmin = findColIdx('B_min (in)', ['b_min (in)', 'b_min', 'b min']);
      const idxBmax = findColIdx('B_max(WHC STD)', ['b_max', 'whc', 'max pitch']);
      const idxE = findColIdx('E (in)', ['e (in)']);
      const idxHole = findColIdx('Hole dH (mm)', ['hole', 'dh', 'hole size']);
      const idxArea = findColIdx('Area (mm²)', ['area (mm²)']);

      if (idxSize === -1) {
        alert("Could not find 'Size (in)' column.");
        return;
      }

      const data: TemaBoltInfo[] = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const cols = line.split(',').map(c => c.trim());
        const getVal = (idx: number) => idx !== -1 && idx < cols.length ? (parseFloat(cols[idx]) || 0) : 0;
        data.push({
          size: getVal(idxSize),
          R: getVal(idxR),
          B_min: getVal(idxBmin),
          E: getVal(idxE),
          holeSize: getVal(idxHole),
          tensileArea: getVal(idxArea),
          bMinWhc: idxBmax !== -1 ? (parseFloat(cols[idxBmax]) || undefined) : undefined
        });
      }
      if (data.length > 0) {
        setTemaBoltData(data);
        alert(`Imported ${data.length} bolt specifications.`);
      } else alert("Invalid CSV format.");
    };
    reader.readAsText(file);
    if (event.target) event.target.value = '';
  };

  const handleSaveTemaBoltToLocalStorage = () => {
    localStorage.setItem('flange_calc_tema_bolt_data', JSON.stringify(temaBoltData));
    alert('Tema Bolt Specifications have been saved as default values.');
  };

  const parseBoltCsv = (text: string): BoltMaterial[] => {
    const lines = text.split(/\r?\n/);
    const startIdx = lines.findIndex(l => {
      const upper = l.toUpperCase();
      return upper.includes('SA-') || upper.includes('SA–') || upper.includes('SB-') || upper.includes('SF-');
    });
    if (startIdx === -1) return [];
    const result: BoltMaterial[] = [];
    for (let i = startIdx; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const cols = line.split(',').map(c => c.trim());
      const id = cols[0];
      const minTensile = parseFloat(cols[1]) || 0;
      const minYield = parseFloat(cols[2]) || 0;
      const stresses = BOLT_TEMP_STEPS.map((_, tempIdx) => {
        const val = cols[3 + tempIdx];
        return (val === undefined || val === '' || val === '...' || val === '…') ? null : parseFloat(val);
      });
      result.push({ id, minTensile, minYield, stresses });
    }
    return result;
  };

  const parsePlateCsvInternal = (text: string): ShellMaterial[] => {
    const lines = text.split(/\r?\n/);
    const startIdx = lines.findIndex(l => {
      const upper = l.toUpperCase();
      return upper.startsWith('SA-') || upper.startsWith('SA–');
    });
    if (startIdx === -1) return [];
    const result: ShellMaterial[] = [];
    for (let i = startIdx; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const cols = line.split(',').map(c => c.trim());
      const id = cols[0];
      const minTensile = parseFloat(cols[3]) || 0;
      const minYield = parseFloat(cols[4]) || 0;
      const stresses = PLATE_TEMP_STEPS.map((_, tempIdx) => {
        const val = cols[5 + tempIdx];
        return (val === undefined || val === '' || val === '...' || val === '…') ? null : parseFloat(val);
      });
      result.push({ id, minTensile, minYield, stresses });
    }
    return result;
  };

  const handleBoltCsvUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = parseBoltCsv(e.target?.result as string);
      if (data.length > 0) {
        setBoltMaterials(data);
        alert(`Imported ${data.length} bolt materials.`);
      } else alert("Invalid Bolt CSV format.");
    };
    reader.readAsText(file);
    if (event.target) event.target.value = '';
  };

  const handlePlateCsvUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = parsePlateCsvInternal(e.target?.result as string);
      if (data.length > 0) {
        setPlateMaterials(data);
        alert(`Imported ${data.length} plate materials.`);
      } else alert("Invalid Plate CSV format.");
    };
    reader.readAsText(file);
    if (event.target) event.target.value = '';
  };

  const handleSaveToLocalStorage = (type: 'bolt' | 'plate') => {
    if (type === 'bolt') {
      localStorage.setItem('flange_calc_bolt_materials', JSON.stringify(boltMaterials));
      alert('Bolt materials have been saved as default values.');
    } else {
      localStorage.setItem('flange_calc_plate_materials', JSON.stringify(plateMaterials));
      alert('Plate materials have been saved as default values.');
    }
  };

  const pccCardClass = "bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2 flex flex-col justify-between";
  const pccFormulaClass = "text-[9px] font-mono text-slate-500 leading-tight";
  const pccLabelClass = "text-[10px] font-black text-slate-800 uppercase tracking-tighter";
  const pccValueClass = "text-sm font-black text-slate-900 tabular-nums text-right";

  return (
    <div className="space-y-8">
      <input type="file" ref={boltFileInputRef} onChange={handleBoltCsvUpload} accept=".csv" className="hidden" />
      <input type="file" ref={plateFileInputRef} onChange={handlePlateCsvUpload} accept=".csv" className="hidden" />
      <input type="file" ref={temaBoltFileInputRef} onChange={handleTemaBoltCsvUpload} accept=".csv" className="hidden" />
      <input type="file" ref={tensioningFileInputRef} onChange={handleTensioningCsvUpload} accept=".csv" className="hidden" />
      <input type="file" ref={gasketFileInputRef} onChange={handleGasketCsvUpload} accept=".csv" className="hidden" />
      <input type="file" ref={ringFileInputRef} onChange={handleRingCsvUpload} accept=".csv" className="hidden" />

      {/* Main ASME Section */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden text-slate-900">
        <div className="bg-slate-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-black text-slate-800 flex items-center gap-3 uppercase tracking-tighter">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-200">
              <i className="fa-solid fa-calculator text-white text-sm"></i>
            </div>
            Bolt Load Calculation (ASME DIV.2 4.16.6)
          </h2>
          <div className="flex items-center gap-4">
            <div className="flex gap-1">
              <span className="text-[10px] bg-sky-100 px-2 py-1 rounded text-sky-700 font-black border border-sky-200 uppercase tracking-tight">m = {results.gasketM}</span>
              <span className="text-[10px] bg-amber-100 px-2 py-1 rounded text-amber-700 font-black border border-amber-200 uppercase tracking-tight">y = {results.gasketY} psi</span>
            </div>
            <select 
              value={selectedForceUnit} 
              onChange={(e) => setSelectedForceUnit(e.target.value as ForceUnit)}
              className="text-[11px] font-black bg-white border border-gray-300 rounded-md px-3 py-1 text-slate-700 focus:ring-2 focus:ring-indigo-500 shadow-sm transition-all"
            >
              {['kN', 'N', 'lbf', 'kgf'].map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <section className="lg:col-span-4 space-y-4">
              <div className="h-full bg-indigo-50/50 rounded-xl border border-indigo-100 p-5">
                <h3 className="text-[11px] font-black text-indigo-700 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                  <i className="fa-solid fa-shapes"></i> G & b Calculation
                </h3>
                <div className="grid grid-cols-1 gap-4">
                  <div className="p-4 bg-white rounded-xl border border-indigo-100 shadow-sm">
                    <div className="text-[9px] font-black text-indigo-400 uppercase mb-2">1. Gasket Mean Dia (G)</div>
                    <div className="text-[10px] font-mono text-black leading-relaxed">
                      {results.b0Width <= 6 ? (
                        <div className="mb-2">
                          <div className="text-[8px] mb-1 font-sans text-black">b₀ ≤ 6: (ID + OD) / 2</div>
                          <div className="flex justify-between font-bold">
                            <span>({results.seatingID.toFixed(1)} + {results.seatingOD.toFixed(1)}) / 2</span>
                          </div>
                        </div>
                      ) : (
                        <div className="mb-2">
                          <div className="text-[8px] mb-1 font-sans text-black font-bold">b₀ &gt; 6: Gasket OD - 2b</div>
                          <div className="flex justify-between font-bold">
                            <span>{results.seatingOD.toFixed(1)} - (2 × {results.bWidth.toFixed(2)})</span>
                          </div>
                        </div>
                      )}
                      <div className="pt-2 border-t border-indigo-50 text-black font-black text-[10px] flex justify-between items-baseline">
                        <span className="font-sans uppercase tracking-tighter text-black">Final G</span>
                        <span className="font-mono">{results.gMeanDia.toFixed(1)} <small className="text-[9px] text-black font-bold">mm</small></span>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 bg-white rounded-xl border border-indigo-100 shadow-sm">
                    <div className="text-[9px] font-black text-indigo-400 uppercase mb-2">2. Basic Width (b₀)</div>
                    <div className="text-[10px] font-mono text-black">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-sans text-[8px] uppercase text-black font-bold">Contact N</span>
                        <span className="font-bold">{results.nWidth.toFixed(2)} mm</span>
                      </div>
                      <div className="pt-2 border-t border-indigo-50 text-black font-black text-[10px] flex justify-between items-baseline">
                         <span className="font-sans uppercase tracking-tighter text-black">Final b₀</span>
                         <span className="font-mono">{results.b0Width.toFixed(2)} <small className="text-[9px] text-black font-bold">mm</small></span>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 bg-white rounded-xl border border-indigo-100 shadow-sm">
                    <div className="text-[9px] font-black text-indigo-400 uppercase mb-2">3. Effective Width (b)</div>
                    <div className="text-[10px] italic mb-2 font-sans text-black font-bold">
                      {results.b0Width > 6 ? "0.5 Cul √ (b₀ / Cul)" : "b = b₀"}
                    </div>
                    <div className="pt-2 border-t border-indigo-50 text-black font-black text-[10px] flex justify-between items-baseline font-mono">
                      <span className="font-sans uppercase text-black tracking-tighter">Final b</span>
                      <span>{results.bWidth.toFixed(2)} <small className="text-[9px] text-black font-bold">mm</small></span>
                    </div>
                  </div>
                </div>
              </div>
            </section>
            <section className="lg:col-span-8 space-y-4">
              <div className="h-full bg-sky-50/50 rounded-xl border border-sky-100 p-5">
                <h3 className="text-[11px] font-black text-sky-700 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                  <i className="fa-solid fa-weight-hanging"></i> Bolt Load Breakdown
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white p-5 rounded-xl border border-sky-100 shadow-sm space-y-4">
                    <div className="text-[11px] font-black text-sky-800 border-b border-sky-50 pb-2 flex justify-between uppercase">
                      <span>Operating (W<sub>o</sub>)</span>
                    </div>
                    <div className="space-y-4">
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <div className="text-[9px] text-black font-bold uppercase mb-1">Hydrostatic Force (H)</div>
                        <div className="text-[9px] font-mono text-black mb-2 leading-tight">
                          0.785 × G² × P <br/>
                          = 0.785 × {results.gMeanDia.toFixed(1)}² × {pMpa.toFixed(3)} MPa
                        </div>
                        <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                          <span className="text-[8px] font-bold text-black">RESULT</span>
                          <span className="font-black text-[11px] text-black">{formatValue(convertForce(results.hForce, selectedForceUnit))} <small className="text-[9px] uppercase text-black font-bold">{selectedForceUnit}</small></span>
                        </div>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <div className="text-[9px] text-black font-bold uppercase mb-1">Gasket Load (H<sub>p</sub>)</div>
                        <div className="text-[9px] font-mono text-black mb-1 leading-tight">
                          [2·b·π·G·m·P] + [2·P·(w_p·L_p·m_p)] <br/>
                          = [2 × {results.bWidth.toFixed(2)} × π × {results.gMeanDia.toFixed(1)} × {results.gasketM} × {pMpa.toFixed(3)}]
                        </div>
                        <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                          <span className="text-[8px] font-bold text-black">RESULT</span>
                          <span className="font-black text-[11px] text-black">{formatValue(convertForce(results.hpForce, selectedForceUnit))} <small className="text-[9px] uppercase text-black font-bold">{selectedForceUnit}</small></span>
                        </div>
                      </div>
                      <div className="pt-2 flex justify-between items-center">
                        <span className="text-[10px] font-black text-sky-800">Total W<sub>o</sub></span>
                        <span className="text-xl font-black text-black">{formatValue(convertForce(results.wm1, selectedForceUnit))}</span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white p-5 rounded-xl border border-amber-100 shadow-sm space-y-4 flex flex-col">
                    <div className="text-[11px] font-black text-amber-800 border-b border-amber-50 pb-2 uppercase">Seating (W<sub>g</sub>)</div>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex-1">
                      <div className="text-[9px] text-black font-bold uppercase mb-1">Seating Gasket Load</div>
                      <div className="text-[9px] font-mono text-black mb-2 leading-tight font-bold">
                        [π·b·G·y] + [w_p·L_p·y_p] <br/>
                        = [π × {results.bWidth.toFixed(2)} × {results.gMeanDia.toFixed(1)} × {results.gMeanDia !== 0 ? (results.gasketY * 0.00689476).toFixed(3) : 0} MPa]
                      </div>
                      <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                        <span className="text-[8px] font-bold text-black">RESULT</span>
                        <span className="font-black text-[11px] text-black">{formatValue(convertForce(results.wm2, selectedForceUnit))} <small className="text-[9px] uppercase text-black font-bold">{selectedForceUnit}</small></span>
                      </div>
                    </div>
                    <div className="pt-6 flex justify-between items-center">
                      <span className="text-[10px] font-black text-amber-800">Total W<sub>g</sub></span>
                      <span className="text-xl font-black text-black">{formatValue(convertForce(results.wm2, selectedForceUnit))}</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* PCC-1 CHECK Section */}
      {inputs.usePcc1Check && (
        <div className="bg-emerald-50/30 rounded-2xl shadow-xl border border-emerald-200 overflow-hidden text-slate-900 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="bg-white px-6 py-4 border-b border-emerald-100 flex justify-between items-center">
             <div className="flex items-center gap-3">
               <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-100">
                 <i className="fa-solid fa-file-invoice text-white text-sm"></i>
               </div>
               <h2 className="text-sm font-black text-emerald-800 uppercase tracking-tighter">PCC-1 Calculation Results</h2>
             </div>
          </div>
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className={pccCardClass}>
                <div className="flex justify-between items-start">
                   <span className={pccLabelClass}>Ag: Gasket Area</span>
                   <i className="fa-solid fa-layer-group text-slate-200 text-xs"></i>
                </div>
                <div className={pccFormulaClass}>
                  [π/4 × ({results.seatingOD.toFixed(1)}² - {results.seatingID.toFixed(1)}²)] + [({inputs.passPartAreaReduction}% / 100) × {inputs.passPartitionWidth} × {inputs.passPartitionLength}]
                </div>
                <div className="flex justify-between items-baseline pt-1 border-t border-slate-50">
                   <span className="text-[8px] font-bold text-slate-400 uppercase">Resulting Area</span>
                   <span className={pccValueClass}>{totalAg.toLocaleString(undefined, { maximumFractionDigits: 0 })} <small className="text-[9px]">mm²</small></span>
                </div>
              </div>
              <div className={pccCardClass}>
                <div className="flex justify-between items-start">
                   <span className={pccLabelClass}>Step 1: Calculated Sbsel</span>
                   <i className="fa-solid fa-bolt-lightning text-slate-200 text-xs"></i>
                </div>
                <div className={pccFormulaClass}>({inputs.sgT} × {totalAg.toFixed(0)}) / ({results.singleBoltArea.toFixed(1)} × {inputs.boltCount})</div>
                <div className="flex justify-between items-baseline pt-1 border-t border-slate-50">
                   <span className="text-[8px] font-bold text-slate-400 uppercase">Calc Value</span>
                   <span className={pccValueClass}>{sbSelCalc.toFixed(1)} <small className="text-[9px]">MPa</small></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Back Data Button Section */}
      <section className="w-full pt-4">
        <div className="flex justify-center">
          <button 
            onClick={() => { setActiveTab('current'); setShowBackData(true); }}
            className="group flex items-center gap-3 bg-slate-900 hover:bg-black text-white px-8 py-3 rounded-full font-black text-xs uppercase tracking-[0.2em] shadow-xl transition-all active:scale-95"
          >
            <i className="fa-solid fa-database group-hover:animate-pulse"></i>
            Check BACK DATA Library
          </button>
        </div>
      </section>

      {showBackData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowBackData(false)}></div>
          <div className="relative w-full max-w-[95vw] lg:max-w-7xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[90vh]">
            <div className="bg-slate-900 text-white p-6 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-sky-500 rounded-xl flex items-center justify-center"><i className="fa-solid fa-book-open"></i></div>
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tighter">Engineering Reference Library</h3>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">TEMA & ASME Standards Database</p>
                </div>
              </div>
              <button onClick={() => setShowBackData(false)} className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center text-white"><i className="fa-solid fa-xmark text-xl"></i></button>
            </div>

            <div className="bg-slate-50 border-b border-slate-200 px-6 flex items-center gap-2 overflow-x-auto shrink-0">
              {(['current', 'bolts', 'tensioning', 'stress', 'plate_stress', 'gaskets', 'rings', 'pcc1'] as TabId[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-4 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 whitespace-nowrap ${
                    activeTab === tab ? 'border-sky-500 text-sky-600' : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {tab === 'current' && 'Calculation Summary'}
                  {tab === 'bolts' && 'Bolt Specs (Table D-5)'}
                  {tab === 'tensioning' && 'Bolt Specs (Tensioning)'}
                  {tab === 'stress' && 'Bolt Stresses'}
                  {tab === 'plate_stress' && 'PLATE STRESS'}
                  {tab === 'gaskets' && 'Gasket Factors (Table 4.16.1)'}
                  {tab === 'rings' && 'Ring Standards'}
                  {tab === 'pcc1' && 'PCC-1 (API 660)'}
                </button>
              ))}
            </div>

            <div className="p-4 lg:p-8 space-y-8 flex-1 overflow-y-auto bg-white">
              {activeTab === 'current' && (
                <div className="animate-in fade-in duration-500 space-y-12">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                    {/* Left Section: Bolt Reference */}
                    <div className="lg:col-span-7 space-y-6">
                       <h4 className="text-xs font-black text-sky-600 uppercase tracking-widest flex items-center gap-2 pb-2 border-b-2 border-sky-100">
                         ACTIVE BOLT REFERENCE
                       </h4>
                       <div className="grid grid-cols-2 gap-4">
                         <SummaryCard label="SELECTED SIZE" value={`${inputs.boltSize}"`} />
                         <SummaryCard label="B-MIN" value={`${currentBoltRef?.B_min || 0}"`} />
                         <SummaryCard label="R (RADIAL RH)" value={`${currentBoltRef?.R || 0}"`} />
                         <SummaryCard label="E (EDGE DIST.)" value={`${currentBoltRef?.E || 0}"`} />
                         <SummaryCard label="HOLE SIZE DH" value={(currentBoltRef?.holeSize || 0).toFixed(3)} unit="mm" />
                         <SummaryCard label="TENSILE AREA" value={(currentBoltRef?.tensileArea || 0).toFixed(1)} unit="mm²" />
                       </div>
                    </div>

                    {/* Right Section: Gasket Factors */}
                    <div className="lg:col-span-5 space-y-6">
                       <h4 className="text-xs font-black text-amber-600 uppercase tracking-widest flex items-center gap-2 pb-2 border-b-2 border-amber-100">
                         ACTIVE GASKET FACTORS
                       </h4>
                       <div className="bg-slate-50/50 p-6 rounded-3xl border border-slate-100 space-y-6">
                         <div>
                           <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">SELECTED TYPE</span>
                           <span className="text-sm font-black text-slate-700 leading-snug">
                             {inputs.gasketType}
                           </span>
                         </div>
                         <div className="grid grid-cols-2 gap-4">
                            <GasketFactorCard label="M FACTOR" value={(currentGasketRef?.m || 0).toFixed(2)} />
                            <GasketFactorCard label="Y FACTOR (PSI)" value={currentGasketRef?.y || 0} />
                         </div>
                       </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'stress' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg">
                    <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Bolt Allowable stress (S) matrix - MPa</h5>
                    <div className="flex gap-2">
                      <button onClick={handleAddNewBoltMaterial} className="bg-indigo-600 hover:bg-indigo-700 text-white text-[9px] font-black uppercase px-3 py-1.5 rounded-lg shadow-sm">Add New</button>
                      <button onClick={() => boltFileInputRef.current?.click()} className="bg-sky-600 hover:bg-sky-700 text-white text-[9px] font-black uppercase px-3 py-1.5 rounded-lg shadow-sm">Upload CSV</button>
                      <button onClick={() => handleExportStresses('bolt')} className="bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-black uppercase px-3 py-1.5 rounded-lg shadow-sm">Export</button>
                      <button onClick={() => handleSaveToLocalStorage('bolt')} className="bg-indigo-500 hover:bg-indigo-600 text-white text-[9px] font-black uppercase px-3 py-1.5 rounded-lg shadow-sm">Save to Defaults</button>
                    </div>
                  </div>
                  <div className="overflow-x-auto border rounded-xl">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-slate-100">
                          <th className={`${tableHeaderClass} border-r text-center`}>Action</th>
                          <th className={`${tableHeaderClass} border-r`}>Material ID</th>
                          {BOLT_TEMP_STEPS.map(temp => <th key={temp} className={`${tableHeaderClass} border-r text-center`}>{temp}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {boltMaterials.map((mat, i) => (
                          <tr key={i} className={mat.id === inputs.boltMaterial ? "bg-sky-50" : i % 2 === 0 ? "bg-white" : "bg-slate-50/30"}>
                            <td className={`${tableCellClass} border-r text-center`}>
                              <div className="flex gap-2 justify-center">
                                <button onClick={() => handleEditBoltMaterial(mat)} className="text-sky-500"><i className="fa-solid fa-pen-to-square"></i></button>
                                <button onClick={() => handleDeleteBoltMaterial(mat.id)} className="text-red-300"><i className="fa-solid fa-trash-can"></i></button>
                              </div>
                            </td>
                            <td className={`${tableCellClass} font-black border-r`}>{mat.id}</td>
                            {BOLT_TEMP_STEPS.map((temp, idx) => <td key={idx} className={`${tableCellClass} border-r text-center`}>{mat.stresses[idx] !== null ? mat.stresses[idx] : ''}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'plate_stress' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg">
                    <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Plate Allowable stress (S) matrix - MPa</h5>
                    <div className="flex gap-2">
                      <button onClick={handleAddNewPlateMaterial} className="bg-indigo-600 hover:bg-indigo-700 text-white text-[9px] font-black uppercase px-3 py-1.5 rounded-lg shadow-sm">Add New</button>
                      <button onClick={() => plateFileInputRef.current?.click()} className="bg-sky-600 hover:bg-sky-700 text-white text-[9px] font-black uppercase px-3 py-1.5 rounded-lg shadow-sm">Upload CSV</button>
                      <button onClick={() => handleExportStresses('plate')} className="bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-black uppercase px-3 py-1.5 rounded-lg shadow-sm">Export</button>
                      <button onClick={() => handleSaveToLocalStorage('plate')} className="bg-indigo-500 hover:bg-indigo-600 text-white text-[9px] font-black uppercase px-3 py-1.5 rounded-lg shadow-sm">Save to Defaults</button>
                    </div>
                  </div>
                  <div className="overflow-x-auto border rounded-xl">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-slate-100">
                          <th className={`${tableHeaderClass} border-r text-center`}>Action</th>
                          <th className={`${tableHeaderClass} border-r`}>Material ID</th>
                          {PLATE_TEMP_STEPS.map(temp => <th key={temp} className={`${tableHeaderClass} border-r text-center`}>{temp}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {plateMaterials.map((mat, i) => (
                          <tr key={i} className={mat.id === inputs.shellMaterial ? "bg-sky-50" : i % 2 === 0 ? "bg-white" : "bg-slate-50/30"}>
                            <td className={`${tableCellClass} border-r text-center`}>
                              <div className="flex gap-2 justify-center">
                                <button onClick={() => handleEditPlateMaterial(mat)} className="text-sky-500"><i className="fa-solid fa-pen-to-square"></i></button>
                                <button onClick={() => handleDeletePlateMaterial(mat.id)} className="text-red-300"><i className="fa-solid fa-trash-can"></i></button>
                              </div>
                            </td>
                            <td className={`${tableCellClass} font-black border-r`}>{mat.id}</td>
                            {PLATE_TEMP_STEPS.map((temp, idx) => <td key={idx} className={`${tableCellClass} border-r text-center`}>{mat.stresses[idx] !== null ? mat.stresses[idx] : ''}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'bolts' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg">
                    <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tema Bolt specifications (Table D-5)</h5>
                    <div className="flex gap-2">
                      <button onClick={handleAddNewBoltSpec} className="bg-indigo-600 hover:bg-indigo-700 text-white text-[9px] font-black uppercase px-3 py-1.5 rounded-lg shadow-sm">Add New</button>
                      <button onClick={() => temaBoltFileInputRef.current?.click()} className="bg-sky-600 hover:bg-sky-700 text-white text-[9px] font-black uppercase px-3 py-1.5 rounded-lg shadow-sm">Upload CSV</button>
                      <button onClick={handleExportBoltSpecs} className="bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-black uppercase px-3 py-1.5 rounded-lg shadow-sm">Export</button>
                      <button onClick={handleSaveTemaBoltToLocalStorage} className="bg-indigo-500 hover:bg-indigo-600 text-white text-[9px] font-black uppercase px-3 py-1.5 rounded-lg shadow-sm">Save to Defaults</button>
                    </div>
                  </div>
                  <div className="overflow-x-auto border rounded-xl">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr>
                          <th className={`${tableHeaderClass} text-center`}>Action</th>
                          <th className={tableHeaderClass}>Size (in)</th>
                          <th className={tableHeaderClass}>R (in)</th>
                          <th className={tableHeaderClass}>B-MIN</th>
                          <th className={tableHeaderClass}>B-MAX</th>
                          <th className={tableHeaderClass}>E (in)</th>
                          <th className={tableHeaderClass}>Hole (mm)</th>
                          <th className={tableHeaderClass}>Area (mm²)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {temaBoltData.map((bolt, i) => (
                          <tr key={i} className={bolt.size === inputs.boltSize ? "bg-sky-50" : ""}>
                            <td className={tableCellClass}><div className="flex gap-2 justify-center"><button onClick={() => handleEditBoltSpec(bolt)} className="text-sky-500"><i className="fa-solid fa-pen-to-square"></i></button><button onClick={() => handleDeleteBoltSpec(bolt.size)} className="text-red-300"><i className="fa-solid fa-trash-can"></i></button></div></td>
                            <td className={`${tableCellClass} font-black`}>{bolt.size}"</td>
                            <td className={tableCellClass}>{bolt.R}</td>
                            <td className={tableCellClass}>{bolt.B_min}</td>
                            <td className={tableCellClass}>{bolt.bMinWhc || '-'}</td>
                            <td className={tableCellClass}>{bolt.E}</td>
                            <td className={tableCellClass}>{bolt.holeSize.toFixed(3)}</td>
                            <td className={tableCellClass}>{bolt.tensileArea.toFixed(1)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'tensioning' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg">
                    <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Bolt Tensioning specifications</h5>
                    <div className="flex gap-2">
                      <button onClick={handleAddNewTensioningSpec} className="bg-indigo-600 hover:bg-indigo-700 text-white text-[9px] font-black uppercase px-3 py-1.5 rounded-lg shadow-sm">Add New</button>
                      <button onClick={() => tensioningFileInputRef.current?.click()} className="bg-sky-600 hover:bg-sky-700 text-white text-[9px] font-black uppercase px-3 py-1.5 rounded-lg shadow-sm">Upload CSV</button>
                      <button onClick={handleExportTensioning} className="bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-black uppercase px-3 py-1.5 rounded-lg shadow-sm">Export</button>
                      <button onClick={handleSaveTensioningToLocalStorage} className="bg-indigo-500 hover:bg-indigo-600 text-white text-[9px] font-black uppercase px-3 py-1.5 rounded-lg shadow-sm">Save to Defaults</button>
                    </div>
                  </div>
                  <div className="overflow-x-auto border rounded-xl max-w-2xl mx-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr>
                          <th className={`${tableHeaderClass} text-center`}>Action</th>
                          <th className={tableHeaderClass}>Bolt Size (in)</th>
                          <th className={tableHeaderClass}>B_ten (in)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tensioningData.map((item, i) => (
                          <tr key={i} className={item.size === inputs.boltSize ? "bg-sky-50" : ""}>
                            <td className={tableCellClass}><div className="flex gap-2 justify-center"><button onClick={() => handleEditTensioningSpec(item)} className="text-sky-500"><i className="fa-solid fa-pen-to-square"></i></button><button onClick={() => handleDeleteTensioningSpec(item.size)} className="text-red-300"><i className="fa-solid fa-trash-can"></i></button></div></td>
                            <td className={`${tableCellClass} font-black`}>{item.size}"</td>
                            <td className={tableCellClass}>{item.B_ten}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'gaskets' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg">
                    <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Gasket Factors (Table 4.16.1)</h5>
                    <div className="flex gap-2">
                      <button onClick={handleAddNewGasketFactor} className="bg-indigo-600 hover:bg-indigo-700 text-white text-[9px] font-black uppercase px-3 py-1.5 rounded-lg shadow-sm">Add New</button>
                      <button onClick={() => gasketFileInputRef.current?.click()} className="bg-sky-600 hover:bg-sky-700 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg shadow-sm">Upload CSV</button>
                      <button onClick={handleExportGaskets} className="bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-black uppercase px-3 py-1.5 rounded-lg shadow-sm">Export</button>
                      <button onClick={handleSaveGasketTypesToLocalStorage} className="bg-indigo-500 hover:bg-indigo-600 text-white text-[9px] font-black uppercase px-3 py-1.5 rounded-lg shadow-sm">Save to Defaults</button>
                    </div>
                  </div>
                  <div className="overflow-x-auto border rounded-xl">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr>
                          <th className={`${tableHeaderClass} border-r text-center`}>Action</th>
                          <th className={`${tableHeaderClass} border-r`}>GASKET MATERIAL</th>
                          <th className={`${tableHeaderClass} border-r text-center`}>m</th>
                          <th className={`${tableHeaderClass} border-r text-center`}>y (PSI)</th>
                          <th className={`${tableHeaderClass} text-center`}>SKETCH</th>
                        </tr>
                      </thead>
                      <tbody>
                        {gasketTypes.map((g, i) => (
                          <tr key={i} className={g.id === inputs.gasketType ? "bg-sky-50" : ""}>
                            <td className={`${tableCellClass} border-r text-center`}><div className="flex gap-2 justify-center"><button onClick={() => handleEditGasketFactor(g)} className="text-sky-500"><i className="fa-solid fa-pen-to-square"></i></button><button onClick={() => handleDeleteGasketFactor(g.id)} className="text-red-300"><i className="fa-solid fa-trash-can"></i></button></div></td>
                            <td className={`${tableCellClass} font-black border-r`}>{g.id}</td>
                            <td className={`${tableCellClass} text-center border-r`}>{g.m.toFixed(2)}</td>
                            <td className={`${tableCellClass} text-center border-r`}>{g.y.toLocaleString()}</td>
                            <td className={`${tableCellClass} text-center italic text-slate-400`}>{g.sketches}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'rings' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg">
                    <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Ring Standards</h5>
                    <div className="flex gap-2">
                      <button onClick={handleAddNewRingStandard} className="bg-indigo-600 hover:bg-indigo-700 text-white text-[9px] font-black uppercase px-3 py-1.5 rounded-lg shadow-sm">Add New</button>
                      <button onClick={() => ringFileInputRef.current?.click()} className="bg-sky-600 hover:bg-sky-700 text-white text-[9px] font-black uppercase px-3 py-1.5 rounded-lg shadow-sm">Upload CSV</button>
                      <button onClick={handleExportRings} className="bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-black uppercase px-3 py-1.5 rounded-lg shadow-sm">Export</button>
                      <button onClick={handleSaveRingStandardsToLocalStorage} className="bg-indigo-500 hover:bg-indigo-600 text-white text-[9px] font-black uppercase px-3 py-1.5 rounded-lg shadow-sm">Save to Defaults</button>
                    </div>
                  </div>
                  <div className="overflow-x-auto border rounded-xl">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr>
                          <th className={`${tableHeaderClass} text-center`}>Action</th>
                          <th className={tableHeaderClass}>Min (mm)</th>
                          <th className={tableHeaderClass}>Max (mm)</th>
                          <th className={tableHeaderClass}>IR (mm)</th>
                          <th className={tableHeaderClass}>OR (mm)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ringStandards.map((ring, i) => (
                          <tr key={i}>
                            <td className={tableCellClass}><div className="flex gap-2 justify-center"><button onClick={() => handleEditRingStandard(ring)} className="text-sky-500"><i className="fa-solid fa-pen-to-square"></i></button><button onClick={() => handleDeleteRingStandard(ring.min, ring.max)} className="text-red-300"><i className="fa-solid fa-trash-can"></i></button></div></td>
                            <td className={tableCellClass}>{ring.min}</td>
                            <td className={tableCellClass}>{ring.max === 100000 ? '∞' : ring.max}</td>
                            <td className={tableCellClass}>{ring.irMin}</td>
                            <td className={tableCellClass}>{ring.orMin}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Editor Modals */}
      {isEditingRingStandard && editingRingStandard && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" onClick={() => setIsEditingRingStandard(false)}></div>
          <div className="relative w-full max-w-lg bg-white rounded-2xl p-6">
            <h3 className="text-lg font-black uppercase mb-6 border-b pb-2">Ring Standard Editor</h3>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-[10px] font-black uppercase">Min ID</label><input type="number" value={editingRingStandard.min} onChange={(e) => setEditingRingStandard({...editingRingStandard, min: parseFloat(e.target.value) || 0})} className="w-full p-2 border rounded" /></div>
              <div><label className="text-[10px] font-black uppercase">Max ID</label><input type="number" value={editingRingStandard.max} onChange={(e) => setEditingRingStandard({...editingRingStandard, max: parseFloat(e.target.value) || 0})} className="w-full p-2 border rounded" /></div>
              <div><label className="text-[10px] font-black uppercase">IR Min</label><input type="number" value={editingRingStandard.irMin} onChange={(e) => setEditingRingStandard({...editingRingStandard, irMin: parseFloat(e.target.value) || 0})} className="w-full p-2 border rounded" /></div>
              <div><label className="text-[10px] font-black uppercase">OR Min</label><input type="number" value={editingRingStandard.orMin} onChange={(e) => setEditingRingStandard({...editingRingStandard, orMin: parseFloat(e.target.value) || 0})} className="w-full p-2 border rounded" /></div>
            </div>
            <div className="mt-8 flex justify-end gap-3"><button onClick={() => setIsEditingRingStandard(false)} className="px-4 py-2 text-[10px] font-black uppercase border rounded">Cancel</button><button onClick={saveRingStandard} className="px-4 py-2 bg-indigo-600 text-white text-[10px] font-black uppercase rounded shadow-lg">Save</button></div>
          </div>
        </div>
      )}

      {isEditingGasketFactor && editingGasketFactor && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" onClick={() => setIsEditingGasketFactor(false)}></div>
          <div className="relative w-full max-w-2xl bg-white rounded-2xl p-6">
            <h3 className="text-lg font-black uppercase mb-6 border-b pb-2">Gasket Editor</h3>
            <div className="grid grid-cols-1 gap-4">
              <div><label className="text-[10px] font-black uppercase">ID / Material</label><input type="text" value={editingGasketFactor.id} onChange={(e) => setEditingGasketFactor({...editingGasketFactor, id: e.target.value})} className="w-full p-2 border rounded" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-[10px] font-black uppercase">m Factor</label><input type="number" value={editingGasketFactor.m} onChange={(e) => setEditingGasketFactor({...editingGasketFactor, m: parseFloat(e.target.value) || 0})} className="w-full p-2 border rounded" /></div>
                <div><label className="text-[10px] font-black uppercase">y Stress (PSI)</label><input type="number" value={editingGasketFactor.y} onChange={(e) => setEditingGasketFactor({...editingGasketFactor, y: parseFloat(e.target.value) || 0})} className="w-full p-2 border rounded" /></div>
              </div>
              <div><label className="text-[10px] font-black uppercase">Sketches</label><input type="text" value={editingGasketFactor.sketches} onChange={(e) => setEditingGasketFactor({...editingGasketFactor, sketches: e.target.value})} className="w-full p-2 border rounded" /></div>
            </div>
            <div className="mt-8 flex justify-end gap-3"><button onClick={() => setIsEditingGasketFactor(false)} className="px-4 py-2 text-[10px] font-black uppercase border rounded">Cancel</button><button onClick={saveGasketFactor} className="px-4 py-2 bg-indigo-600 text-white text-[10px] font-black uppercase rounded shadow-lg">Save</button></div>
          </div>
        </div>
      )}

      {isEditingTensioningSpec && editingTensioningSpec && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" onClick={() => setIsEditingTensioningSpec(false)}></div>
          <div className="relative w-full max-w-md bg-white rounded-2xl p-6">
            <h3 className="text-lg font-black uppercase mb-6 border-b pb-2">Tensioning Editor</h3>
            <div className="space-y-4">
              <div><label className="text-[10px] font-black uppercase">Size (inch)</label><input type="number" value={editingTensioningSpec.size} onChange={(e) => setEditingTensioningSpec({...editingTensioningSpec, size: parseFloat(e.target.value) || 0})} className="w-full p-2 border rounded" /></div>
              <div><label className="text-[10px] font-black uppercase">B_ten (inch)</label><input type="number" value={editingTensioningSpec.B_ten} onChange={(e) => setEditingTensioningSpec({...editingTensioningSpec, B_ten: parseFloat(e.target.value) || 0})} className="w-full p-2 border rounded" /></div>
            </div>
            <div className="mt-8 flex justify-end gap-3"><button onClick={() => setIsEditingTensioningSpec(false)} className="px-4 py-2 text-[10px] font-black uppercase border rounded">Cancel</button><button onClick={saveTensioningSpec} className="px-4 py-2 bg-indigo-600 text-white text-[10px] font-black uppercase rounded shadow-lg">Save</button></div>
          </div>
        </div>
      )}

      {isEditingBoltSpec && editingBoltSpec && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" onClick={() => setIsEditingBoltSpec(false)}></div>
          <div className="relative w-full max-w-2xl bg-white rounded-2xl p-6">
            <h3 className="text-lg font-black uppercase mb-6 border-b pb-2">Bolt Spec Editor</h3>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-[10px] font-black uppercase">Size (in)</label><input type="number" value={editingBoltSpec.size} onChange={(e) => setEditingBoltSpec({...editingBoltSpec, size: parseFloat(e.target.value) || 0})} className="w-full p-2 border rounded" /></div>
              <div><label className="text-[10px] font-black uppercase">R (in)</label><input type="number" value={editingBoltSpec.R} onChange={(e) => setEditingBoltSpec({...editingBoltSpec, R: parseFloat(e.target.value) || 0})} className="w-full p-2 border rounded" /></div>
              <div><label className="text-[10px] font-black uppercase">B_min (in)</label><input type="number" value={editingBoltSpec.B_min} onChange={(e) => setEditingBoltSpec({...editingBoltSpec, B_min: parseFloat(e.target.value) || 0})} className="w-full p-2 border rounded" /></div>
              <div><label className="text-[10px] font-black uppercase">E (in)</label><input type="number" value={editingBoltSpec.E} onChange={(e) => setEditingBoltSpec({...editingBoltSpec, E: parseFloat(e.target.value) || 0})} className="w-full p-2 border rounded" /></div>
              <div><label className="text-[10px] font-black uppercase">Hole (mm)</label><input type="number" value={editingBoltSpec.holeSize} onChange={(e) => setEditingBoltSpec({...editingBoltSpec, holeSize: parseFloat(e.target.value) || 0})} className="w-full p-2 border rounded" /></div>
              <div><label className="text-[10px] font-black uppercase">Area (mm²)</label><input type="number" value={editingBoltSpec.tensileArea} onChange={(e) => setEditingBoltSpec({...editingBoltSpec, tensileArea: parseFloat(e.target.value) || 0})} className="w-full p-2 border rounded" /></div>
              <div className="col-span-2"><label className="text-[10px] font-black uppercase">B_max WHC (mm)</label><input type="number" value={editingBoltSpec.bMinWhc || ''} onChange={(e) => setEditingBoltSpec({...editingBoltSpec, bMinWhc: parseFloat(e.target.value) || undefined})} className="w-full p-2 border rounded" /></div>
            </div>
            <div className="mt-8 flex justify-end gap-3"><button onClick={() => setIsEditingBoltSpec(false)} className="px-4 py-2 text-[10px] font-black uppercase border rounded">Cancel</button><button onClick={saveBoltSpec} className="px-4 py-2 bg-indigo-600 text-white text-[10px] font-black uppercase rounded shadow-lg">Save</button></div>
          </div>
        </div>
      )}

      {isEditingMaterial && editingMaterial && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" onClick={() => setIsEditingMaterial(false)}></div>
          <div className="relative w-full max-w-4xl bg-white rounded-2xl p-6 flex flex-col max-h-[90vh]">
            <h3 className="text-lg font-black uppercase mb-6 border-b pb-2">Bolt Material Editor</h3>
            <div className="overflow-y-auto space-y-6 flex-1">
              <div className="grid grid-cols-3 gap-4">
                <div><label className="text-[10px] font-black uppercase">ID</label><input type="text" value={editingMaterial.id} onChange={(e) => setEditingMaterial({...editingMaterial, id: e.target.value})} className="w-full p-2 border rounded" /></div>
                <div><label className="text-[10px] font-black uppercase">Min Tensile</label><input type="number" value={editingMaterial.minTensile || ''} onChange={(e) => setEditingMaterial({...editingMaterial, minTensile: parseFloat(e.target.value) || 0})} className="w-full p-2 border rounded" /></div>
                <div><label className="text-[10px] font-black uppercase">Min Yield</label><input type="number" value={editingMaterial.minYield || ''} onChange={(e) => setEditingMaterial({...editingMaterial, minYield: parseFloat(e.target.value) || 0})} className="w-full p-2 border rounded" /></div>
              </div>
              <div className="grid grid-cols-8 gap-2">
                {BOLT_TEMP_STEPS.map((temp, idx) => (
                  <div key={temp} className="text-center"><label className="text-[8px] font-black uppercase">{temp}°C</label><input type="number" step="0.1" value={editingMaterial.stresses[idx] === null ? '' : editingMaterial.stresses[idx]} onChange={(e) => { const next = [...editingMaterial.stresses]; next[idx] = e.target.value === '' ? null : parseFloat(e.target.value); setEditingMaterial({...editingMaterial, stresses: next}); }} className="w-full p-1 border rounded text-center text-[10px]" /></div>
                ))}
              </div>
            </div>
            <div className="mt-8 flex justify-end gap-3 pt-4 border-t"><button onClick={() => setIsEditingMaterial(false)} className="px-4 py-2 text-[10px] font-black uppercase border rounded">Cancel</button><button onClick={saveBoltMaterial} className="px-4 py-2 bg-indigo-600 text-white text-[10px] font-black uppercase rounded shadow-lg">Save</button></div>
          </div>
        </div>
      )}

      {isEditingPlateMaterial && editingPlateMaterial && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" onClick={() => setIsEditingPlateMaterial(false)}></div>
          <div className="relative w-full max-w-4xl bg-white rounded-2xl p-6 flex flex-col max-h-[90vh]">
            <h3 className="text-lg font-black uppercase mb-6 border-b pb-2">Plate Material Editor</h3>
            <div className="overflow-y-auto space-y-6 flex-1">
              <div className="grid grid-cols-3 gap-4">
                <div><label className="text-[10px] font-black uppercase">ID</label><input type="text" value={editingPlateMaterial.id} onChange={(e) => setEditingPlateMaterial({...editingPlateMaterial, id: e.target.value})} className="w-full p-2 border rounded" /></div>
                <div><label className="text-[10px] font-black uppercase">Min Tensile</label><input type="number" value={editingPlateMaterial.minTensile || ''} onChange={(e) => setEditingPlateMaterial({...editingPlateMaterial, minTensile: parseFloat(e.target.value) || 0})} className="w-full p-2 border rounded" /></div>
                <div><label className="text-[10px] font-black uppercase">Min Yield</label><input type="number" value={editingPlateMaterial.minYield || ''} onChange={(e) => setEditingPlateMaterial({...editingPlateMaterial, minYield: parseFloat(e.target.value) || 0})} className="w-full p-2 border rounded" /></div>
              </div>
              <div className="grid grid-cols-8 gap-2">
                {PLATE_TEMP_STEPS.map((temp, idx) => (
                  <div key={temp} className="text-center"><label className="text-[8px] font-black uppercase">{temp}°C</label><input type="number" step="0.1" value={editingPlateMaterial.stresses[idx] === null ? '' : editingPlateMaterial.stresses[idx]} onChange={(e) => { const next = [...editingPlateMaterial.stresses]; next[idx] = e.target.value === '' ? null : parseFloat(e.target.value); setEditingPlateMaterial({...editingPlateMaterial, stresses: next}); }} className="w-full p-1 border rounded text-center text-[10px]" /></div>
                ))}
              </div>
            </div>
            <div className="mt-8 flex justify-end gap-3 pt-4 border-t"><button onClick={() => setIsEditingPlateMaterial(false)} className="px-4 py-2 text-[10px] font-black uppercase border rounded">Cancel</button><button onClick={savePlateMaterial} className="px-4 py-2 bg-indigo-600 text-white text-[10px] font-black uppercase rounded shadow-lg">Save</button></div>
          </div>
        </div>
      )}
    </div>
  );
};