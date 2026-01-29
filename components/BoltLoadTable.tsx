
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
  
  // State for Material CRUD
  const [isEditingMaterial, setIsEditingMaterial] = useState<boolean>(false);
  const [editingMaterial, setEditingMaterial] = useState<BoltMaterial | null>(null);

  const [isEditingPlateMaterial, setIsEditingPlateMaterial] = useState<boolean>(false);
  const [editingPlateMaterial, setEditingPlateMaterial] = useState<ShellMaterial | null>(null);

  // State for Bolt Spec CRUD (Table D-5)
  const [isEditingBoltSpec, setIsEditingBoltSpec] = useState<boolean>(false);
  const [editingBoltSpec, setEditingBoltSpec] = useState<TemaBoltInfo | null>(null);

  // State for Tensioning CRUD
  const [isEditingTensioningSpec, setIsEditingTensioningSpec] = useState<boolean>(false);
  const [editingTensioningSpec, setEditingTensioningSpec] = useState<TensioningInfo | null>(null);

  // State for Gasket Factor CRUD
  const [isEditingGasketFactor, setIsEditingGasketFactor] = useState<boolean>(false);
  const [editingGasketFactor, setEditingGasketFactor] = useState<GasketType | null>(null);

  // State for Ring Standard CRUD
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

  // --- CSV Export Logic ---
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
  const isAllSafe = isStep5Ok && isStep6Ok && isStep7Ok && isStep8Ok && sbSelFinal <= (inputs.sbMax || Infinity) && sbSelFinal >= (inputs.sbMin || 0);

  const currentBoltRef = temaBoltData.find(b => b.size === inputs.boltSize);

  const tableHeaderClass = "px-4 py-3 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 border-b border-slate-200 sticky top-0 z-10 whitespace-nowrap";
  const tableCellClass = "px-4 py-3 text-[10px] font-mono text-slate-700 border-b border-slate-100 whitespace-nowrap";

  // Bolt Material CRUD Handlers
  const handleAddNewBoltMaterial = () => {
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
      const filtered = prev.filter(m => m.id !== editingMaterial.id);
      return [...filtered, editingMaterial];
    });
    setIsEditingMaterial(false);
    setEditingMaterial(null);
  };

  // Plate Material CRUD Handlers
  const handleAddNewPlateMaterial = () => {
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
      const filtered = prev.filter(m => m.id !== editingPlateMaterial.id);
      return [...filtered, editingPlateMaterial];
    });
    setIsEditingPlateMaterial(false);
    setEditingPlateMaterial(null);
  };

  // --- Bolt Spec CRUD (Table D-5) Handlers ---
  const handleAddNewBoltSpec = () => {
    const newSpec: TemaBoltInfo = {
      size: 0,
      R: 0,
      B_min: 0,
      E: 0,
      holeSize: 0,
      tensileArea: 0
    };
    setEditingBoltSpec(newSpec);
    setIsEditingBoltSpec(true);
  };

  const handleEditBoltSpec = (spec: TemaBoltInfo) => {
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
      const filtered = prev.filter(b => b.size !== editingBoltSpec.size);
      const updated = [...filtered, editingBoltSpec].sort((a, b) => a.size - b.size);
      return updated;
    });
    setIsEditingBoltSpec(false);
    setEditingBoltSpec(null);
  };

  // --- Tensioning CRUD Handlers ---
  const handleAddNewTensioningSpec = () => {
    const newSpec: TensioningInfo = {
      size: 0,
      B_ten: 0
    };
    setEditingTensioningSpec(newSpec);
    setIsEditingTensioningSpec(true);
  };

  const handleEditTensioningSpec = (spec: TensioningInfo) => {
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
      const filtered = prev.filter(t => t.size !== editingTensioningSpec.size);
      const updated = [...filtered, editingTensioningSpec].sort((a, b) => a.size - b.size);
      return updated;
    });
    setIsEditingTensioningSpec(false);
    setEditingTensioningSpec(null);
  };

  // --- Gasket Factor CRUD Handlers ---
  const handleAddNewGasketFactor = () => {
    const newGasket: GasketType = {
      id: "New Gasket " + (gasketTypes.length + 1),
      m: 0,
      y: 0,
      sketches: ""
    };
    setEditingGasketFactor(newGasket);
    setIsEditingGasketFactor(true);
  };

  const handleEditGasketFactor = (g: GasketType) => {
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
      const filtered = prev.filter(g => g.id !== editingGasketFactor.id);
      return [...filtered, editingGasketFactor];
    });
    setIsEditingGasketFactor(false);
    setEditingGasketFactor(null);
  };

  // --- Ring Standard CRUD Handlers ---
  const handleAddNewRingStandard = () => {
    const newRing: RingStandard = {
      min: 0,
      max: 0,
      irMin: 0,
      orMin: 0
    };
    setEditingRingStandard(newRing);
    setIsEditingRingStandard(true);
  };

  const handleEditRingStandard = (ring: RingStandard) => {
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
      const filtered = prev.filter(r => !(r.min === editingRingStandard.min && r.max === editingRingStandard.max));
      const updated = [...filtered, editingRingStandard].sort((a, b) => a.min - b.min);
      return updated;
    });
    setIsEditingRingStandard(false);
    setEditingRingStandard(null);
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
        setRingStandards(data.sort((a, b) => a.min - b.min));
        alert(`Imported ${data.length} ring standards.`);
      } else alert("Invalid CSV format.");
    };
    reader.readAsText(file);
    if (event.target) event.target.value = '';
  };

  const handleSaveRingStandardsToLocalStorage = () => {
    localStorage.setItem('flange_genie_ring_standards', JSON.stringify(ringStandards));
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
    localStorage.setItem('flange_genie_gasket_types', JSON.stringify(gasketTypes));
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
        setTensioningData(data.sort((a, b) => a.size - b.size));
        alert(`Imported ${data.length} tensioning specifications.`);
      } else alert("Invalid CSV format.");
    };
    reader.readAsText(file);
    if (event.target) event.target.value = '';
  };

  const handleSaveTensioningToLocalStorage = () => {
    localStorage.setItem('flange_genie_tensioning_data', JSON.stringify(tensioningData));
    alert('Bolt Tensioning Specifications have been saved as default values.');
  };

  const handleTemaBoltCsvUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split(/\r?\n/);
      const data: TemaBoltInfo[] = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const cols = line.split(',').map(c => c.trim());
        if (cols.length < 6) continue;
        data.push({
          size: parseFloat(cols[0]) || 0,
          R: parseFloat(cols[1]) || 0,
          B_min: parseFloat(cols[2]) || 0,
          E: parseFloat(cols[3]) || 0,
          holeSize: parseFloat(cols[4]) || 0,
          tensileArea: parseFloat(cols[5]) || 0,
          bMinWhc: parseFloat(cols[6]) || undefined
        });
      }
      if (data.length > 0) {
        setTemaBoltData(data.sort((a, b) => a.size - b.size));
        alert(`Imported ${data.length} bolt specifications.`);
      } else alert("Invalid CSV format.");
    };
    reader.readAsText(file);
    if (event.target) event.target.value = '';
  };

  const handleSaveTemaBoltToLocalStorage = () => {
    localStorage.setItem('flange_genie_tema_bolt_data', JSON.stringify(temaBoltData));
    alert('Tema Bolt Specifications have been saved as default values.');
  };

  // BOLT STRESS (2025ED) CSV 파싱 로직: ID(0), Tensile(1), Yield(2), Stresses(3+)
  const parseBoltCsv = (text: string): BoltMaterial[] => {
    const lines = text.split(/\r?\n/);
    const startIdx = lines.findIndex(l => {
      const upper = l.toUpperCase();
      // 'SA-', 'SB-', 'SF-' 등으로 시작하는 데이터 행 찾기 (첫 열 기준)
      return upper.includes('SA-') || upper.includes('SA–') || upper.includes('SB-') || upper.includes('SF-');
    });
    if (startIdx === -1) return [];

    const result: BoltMaterial[] = [];
    for (let i = startIdx; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const cols = line.split(',').map(c => c.trim());
      // 엑셀 양식: ID(0), Tensile(1), Yield(2), 40(3), 65(4), 100(5), 125(6)...
      const id = cols[0];
      const minTensile = parseFloat(cols[1]) || 0;
      const minYield = parseFloat(cols[2]) || 0;
      const stresses = BOLT_TEMP_STEPS.map((_, tempIdx) => {
        const val = cols[3 + tempIdx];
        // '...', '…' (Ellipsis) 및 빈 칸을 null로 처리
        return (val === undefined || val === '' || val === '...' || val === '…') ? null : parseFloat(val);
      });
      result.push({ id, minTensile, minYield, stresses });
    }
    return result;
  };

  // PLATE STRESS (2023ED) CSV 파싱 로직: ID(0), PNo(1), GNo(2), Tensile(3), Yield(4), Stresses(5+)
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
      // 엑셀 양식: ID(0), P-No(1), Group(2), Tensile(3), Yield(4), 40(5), 65(6)...
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
        alert(`Imported ${data.length} bolt materials matching CSV order.`);
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
        alert(`Imported ${data.length} plate materials matching CSV order.`);
      } else alert("Invalid Plate CSV format.");
    };
    reader.readAsText(file);
    if (event.target) event.target.value = '';
  };

  const handleSaveToLocalStorage = (type: 'bolt' | 'plate') => {
    if (type === 'bolt') {
      localStorage.setItem('flange_genie_bolt_materials', JSON.stringify(boltMaterials));
      alert('Bolt materials have been saved as default values.');
    } else {
      localStorage.setItem('flange_genie_plate_materials', JSON.stringify(plateMaterials));
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
                          {inputs.passPartitionWidth > 0 && (
                            <span className="block mt-1">
                              + [2 × {pMpa.toFixed(3)} × ({inputs.passPartitionWidth} × {inputs.passPartitionLength} × {results.passM})]
                            </span>
                          )}
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
                    <div className="text-[11px] font-black text-amber-800 border-b border-amber-50 pb-2 uppercase">
                      Seating (W<sub>g</sub>)
                    </div>
                    
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex-1">
                      <div className="text-[9px] text-black font-bold uppercase mb-1">Seating Gasket Load</div>
                      <div className="text-[9px] font-mono text-black mb-2 leading-tight font-bold">
                        [π·b·G·y] + [w_p·L_p·y_p] <br/>
                        = [π × {results.bWidth.toFixed(2)} × {results.gMeanDia.toFixed(1)} × {results.gMeanDia !== 0 ? (results.gasketY * 0.00689476).toFixed(3) : 0} MPa]
                        {inputs.passPartitionWidth > 0 && (
                          <span className="block mt-1">
                            + [{inputs.passPartitionWidth} × {inputs.passPartitionLength} × {(results.passY * 0.00689476).toFixed(3)} MPa]
                          </span>
                        )}
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
                <div className={pccFormulaClass}>
                   ({inputs.sgT} × {totalAg.toLocaleString(undefined, { maximumFractionDigits: 0 })}) / ({results.singleBoltArea.toFixed(1)} × {inputs.boltCount})
                </div>
                <div className="flex justify-between items-baseline pt-1 border-t border-slate-50">
                   <span className="text-[8px] font-bold text-slate-400 uppercase">Calc Value</span>
                   <span className={pccValueClass}>{sbSelCalc.toFixed(1)} <small className="text-[9px]">MPa</small></span>
                </div>
              </div>
            </div>

            <div className="bg-white/50 border border-indigo-100 rounded-2xl p-6 space-y-6">
               <h4 className="text-[11px] font-black text-indigo-800 uppercase tracking-[0.2em] border-b border-indigo-50 pb-2">Selection Sbsel</h4>
               
               <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className={pccCardClass}>
                    <span className={pccLabelClass}>Step 2: Sbsel = min[Step 1, Sbmax]</span>
                    <div className={pccFormulaClass}>min[{sbSelCalc.toFixed(1)}, {inputs.sbMax}]</div>
                    <div className="flex justify-between items-baseline pt-1 border-t border-slate-50">
                       <span className="text-[8px] font-bold text-slate-400 uppercase">Step 2 Result</span>
                       <span className="text-xs font-black text-indigo-700">{valA.toFixed(1)} MPa</span>
                    </div>
                  </div>

                  <div className={pccCardClass}>
                    <span className={pccLabelClass}>Step 3: Sbsel = max[Step 2, Sbmin]</span>
                    <div className={pccFormulaClass}>max[{valA.toFixed(1)}, {inputs.sbMin}]</div>
                    <div className="flex justify-between items-baseline pt-1 border-t border-slate-50">
                       <span className="text-[8px] font-bold text-slate-400 uppercase">Step 3 Result</span>
                       <span className="text-xs font-black text-indigo-700">{valB.toFixed(1)} MPa</span>
                    </div>
                  </div>

                  <div className={pccCardClass}>
                    <span className={pccLabelClass}>Step 4: Sbsel = min[Step 3, Sfmax]</span>
                    <div className={pccFormulaClass}>min[{valB.toFixed(1)}, {inputs.sfMax}]</div>
                    <div className="flex justify-between items-baseline pt-1 border-t border-slate-50">
                       <span className="text-[8px] font-bold text-slate-400 uppercase">Step 4 Result</span>
                       <span className="text-xs font-black text-indigo-700">{valC.toFixed(1)} MPa</span>
                    </div>
                  </div>

                  <div className={pccCardClass}>
                    <span className={pccLabelClass}>Sbsel: Final Result</span>
                    <div className={pccFormulaClass}>Selection derived from Steps 2 to 4</div>
                    <div className="flex justify-between items-baseline pt-1 border-t border-slate-50">
                       <span className="text-[8px] font-bold text-slate-400 uppercase">Final Value</span>
                       <span className="text-sm font-black text-indigo-700">{sbSelFinal.toFixed(1)} MPa</span>
                    </div>
                  </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-stretch">
                  <div className="md:col-span-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className={`p-4 rounded-xl border flex flex-col justify-between ${isStep5Ok ? 'bg-white border-slate-200' : 'bg-red-50 border-red-200'}`}>
                      <span className={pccLabelClass}>Step 5: Sbsel ≥ Sgmin-S [Ag / (Ab×nb)]</span>
                      <div className={pccFormulaClass}>{sbSelFinal.toFixed(1)} ≥ {inputs.sgMinS} × [{totalAg.toFixed(0)} / {totalBoltRootArea.toFixed(0)}] = {step5Threshold.toFixed(1)}</div>
                      <div className="flex justify-between items-center pt-2 border-t border-slate-50">
                         <span className="text-[8px] font-bold uppercase text-slate-400">Status</span>
                         <span className={`text-[10px] font-black ${isStep5Ok ? 'text-emerald-600' : 'text-red-600'}`}>{isStep5Ok ? 'OK' : 'Not OK'}</span>
                      </div>
                    </div>

                    <div className={`p-4 rounded-xl border flex flex-col justify-between ${isStep6Ok ? 'bg-white border-slate-200' : 'bg-red-50 border-red-200'}`}>
                      <span className={pccLabelClass}>Step 6: Sbsel ≥ (Sgmin-O Ag + ...)</span>
                      <div className={pccFormulaClass}>{sbSelFinal.toFixed(1)} ≥ ({inputs.sgMinO}×{totalAg.toFixed(0)} + (π/4)×{pMpa.toFixed(2)}×{results.seatingID.toFixed(0)}²) / ({inputs.g}×{totalBoltRootArea.toFixed(0)}) = {step6Threshold.toFixed(1)}</div>
                      <div className="flex justify-between items-center pt-2 border-t border-slate-50">
                         <span className="text-[8px] font-bold uppercase text-slate-400">Status</span>
                         <span className={`text-[10px] font-black ${isStep6Ok ? 'text-emerald-600' : 'text-red-600'}`}>{isStep6Ok ? 'OK' : 'Not OK'}</span>
                      </div>
                    </div>

                    <div className={`p-4 rounded-xl border flex flex-col justify-between ${isStep7Ok ? 'bg-white border-slate-200' : 'bg-red-50 border-red-200'}`}>
                      <span className={pccLabelClass}>Step 7: Sbsel ≤ Sgmax [Ag / (Ab×nb)]</span>
                      <div className={pccFormulaClass}>{sbSelFinal.toFixed(1)} ≤ {inputs.sgMax} × [{totalAg.toFixed(0)} / {totalBoltRootArea.toFixed(0)}] = {step7Threshold.toFixed(1)}</div>
                      <div className="flex justify-between items-center pt-2 border-t border-slate-50">
                         <span className="text-[8px] font-bold uppercase text-slate-400">Status</span>
                         <span className={`text-[10px] font-black ${isStep7Ok ? 'text-emerald-600' : 'text-red-600'}`}>{isStep7Ok ? 'OK' : 'Not OK'}</span>
                      </div>
                    </div>

                    <div className={`p-4 rounded-xl border flex flex-col justify-between ${isStep8Ok ? 'bg-white border-slate-200' : 'bg-red-50 border-red-200'}`}>
                      <span className={pccLabelClass}>Step 8: Sbsel ≤ Sfmax (Φg/Φf)</span>
                      <div className={pccFormulaClass}>{sbSelFinal.toFixed(1)} ≤ {inputs.sfMax} × ({inputs.phiGMax} / {inputs.phiFMax}) = {step8Threshold.toFixed(1)}</div>
                      <div className="flex justify-between items-center pt-2 border-t border-slate-50">
                         <span className="text-[8px] font-bold uppercase text-slate-400">Status</span>
                         <span className={`text-[10px] font-black ${isStep8Ok ? 'text-emerald-600' : 'text-red-600'}`}>{isStep8Ok ? 'OK' : 'Not OK'}</span>
                      </div>
                    </div>
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
          <div className="relative w-full max-w-[95vw] lg:max-w-7xl bg-white rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col h-[90vh]">
            <div className="bg-slate-900 text-white p-6 flex justify-between items-center border-b border-white/10 shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-sky-500 rounded-xl flex items-center justify-center shadow-lg shadow-sky-500/20">
                  <i className="fa-solid fa-book-open text-lg"></i>
                </div>
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tighter">Engineering Reference Library</h3>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">TEMA & ASME Standards Database</p>
                </div>
              </div>
              <button onClick={() => setShowBackData(false)} className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center text-white transition-all">
                <i className="fa-solid fa-xmark text-xl"></i>
              </button>
            </div>

            <div className="bg-slate-50 border-b border-slate-200 px-6 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
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

            <div className="p-4 lg:p-8 space-y-8 flex-1 overflow-y-auto custom-scrollbar bg-white">
              {activeTab === 'current' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-sky-600 uppercase tracking-widest border-b border-sky-100 pb-2">Active Bolt Reference</h4>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: "Selected Size", val: `${inputs.boltSize}"` },
                        { label: "B-MIN", val: `${currentBoltRef?.B_min}"` },
                        { label: "R (Radial Rh)", val: `${currentBoltRef?.R}"` },
                        { label: "E (Edge Dist.)", val: `${currentBoltRef?.E}"` },
                        { label: "Hole Size dH", val: `${currentBoltRef?.holeSize.toFixed(1)} mm` },
                        { label: "Tensile Area", val: `${(currentBoltRef?.tensileArea || 0).toFixed(1)} mm²` }
                      ].map((item, idx) => (
                        <div key={idx} className="bg-slate-50 p-3 rounded-xl border border-slate-100 shadow-sm">
                          <span className="block text-[8px] font-black text-slate-400 uppercase mb-1">{item.label}</span>
                          <span className="text-sm font-black text-slate-700 font-mono">{item.val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-amber-600 uppercase tracking-widest border-b border-amber-100 pb-2">Active Gasket Factors</h4>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 shadow-sm space-y-4">
                      <div>
                        <span className="block text-[8px] font-black text-slate-400 uppercase mb-2">Selected Type</span>
                        <span className="text-xs font-black text-slate-700">{inputs.gasketType}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white p-3 rounded-lg border border-amber-100">
                          <span className="block text-[8px] font-black text-amber-500 uppercase mb-1">M Factor</span>
                          <span className="text-xl font-black text-amber-700">{results.gasketM.toFixed(2)}</span>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-amber-100">
                          <span className="block text-[8px] font-black text-amber-500 uppercase mb-1">Y Factor (PSI)</span>
                          <span className="text-xl font-black text-amber-700">{results.gasketY}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'stress' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <div className="flex items-center gap-4">
                      <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Bolt Allowable stress (S) matrix - MPa</h5>
                      <div className="flex gap-2">
                        <button onClick={handleAddNewBoltMaterial} className="bg-indigo-600 hover:bg-indigo-700 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-sm transition-all active:scale-95">
                          <i className="fa-solid fa-plus"></i> Add New Material
                        </button>
                        <button onClick={() => boltFileInputRef.current?.click()} className="bg-sky-600 hover:bg-sky-700 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-sm transition-all active:scale-95">
                          <i className="fa-solid fa-file-excel"></i> Upload CSV
                        </button>
                        <button onClick={() => handleExportStresses('bolt')} className="bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-sm transition-all active:scale-95">
                          <i className="fa-solid fa-file-excel"></i> OUTPUT
                        </button>
                        <button onClick={() => handleSaveToLocalStorage('bolt')} className="bg-indigo-500 hover:bg-indigo-600 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-sm transition-all active:scale-95">
                          <i className="fa-solid fa-floppy-disk"></i> SAVE
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="overflow-x-auto border rounded-xl shadow-lg relative bg-white">
                    <table className="w-full border-collapse border-spacing-0">
                      <thead>
                        <tr className="bg-slate-100">
                          <th className={`${tableHeaderClass} sticky left-0 z-20 bg-slate-100 border-r min-w-[50px] text-center`}>Action</th>
                          <th className={`${tableHeaderClass} sticky left-[50px] z-20 bg-slate-100 border-r min-w-[200px]`}>Material ID</th>
                          <th className={`${tableHeaderClass} border-r text-emerald-600`}>Min_Tensile</th>
                          <th className={`${tableHeaderClass} border-r text-emerald-600`}>Min_Yield</th>
                          {BOLT_TEMP_STEPS.map(temp => <th key={temp} className={`${tableHeaderClass} border-r text-center`}>{temp}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {boltMaterials.map((mat, i) => (
                          <tr key={i} className={mat.id === inputs.boltMaterial ? "bg-sky-50" : i % 2 === 0 ? "bg-white" : "bg-slate-50/30"}>
                            <td className={`${tableCellClass} sticky left-0 z-10 border-r text-center ${mat.id === inputs.boltMaterial ? 'bg-sky-100' : 'bg-inherit'}`}>
                              <div className="flex items-center justify-center gap-2">
                                <button onClick={() => handleEditBoltMaterial(mat)} className="text-sky-500 hover:text-sky-700 transition-colors"><i className="fa-solid fa-pen-to-square"></i></button>
                                <button onClick={() => handleDeleteBoltMaterial(mat.id)} className="text-slate-300 hover:text-red-500 transition-colors"><i className="fa-solid fa-trash-can"></i></button>
                              </div>
                            </td>
                            <td className={`${tableCellClass} sticky left-[50px] z-10 font-black text-xs border-r ${mat.id === inputs.boltMaterial ? 'bg-sky-100' : 'bg-inherit'}`}>{mat.id}</td>
                            <td className={`${tableCellClass} border-r text-center font-bold text-slate-500`}>{mat.minTensile || '-'}</td>
                            <td className={`${tableCellClass} border-r text-center font-bold text-slate-500`}>{mat.minYield || '-'}</td>
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
                  <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <div className="flex items-center gap-4">
                      <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Plate Allowable stress (S) matrix - MPa</h5>
                      <div className="flex gap-2">
                        <button onClick={handleAddNewPlateMaterial} className="bg-indigo-600 hover:bg-indigo-700 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-sm transition-all active:scale-95">
                          <i className="fa-solid fa-plus"></i> Add New Material
                        </button>
                        <button onClick={() => plateFileInputRef.current?.click()} className="bg-sky-600 hover:bg-sky-700 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-sm transition-all active:scale-95">
                          <i className="fa-solid fa-file-excel"></i> Upload CSV
                        </button>
                        <button onClick={() => handleExportStresses('plate')} className="bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-sm transition-all active:scale-95">
                          <i className="fa-solid fa-file-excel"></i> OUTPUT
                        </button>
                        <button onClick={() => handleSaveToLocalStorage('plate')} className="bg-indigo-500 hover:bg-indigo-600 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-sm transition-all active:scale-95">
                          <i className="fa-solid fa-floppy-disk"></i> SAVE
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="overflow-x-auto border rounded-xl shadow-lg relative bg-white">
                    <table className="w-full border-collapse border-spacing-0">
                      <thead>
                        <tr className="bg-slate-100">
                          <th className={`${tableHeaderClass} sticky left-0 z-20 bg-slate-100 border-r min-w-[50px] text-center`}>Action</th>
                          <th className={`${tableHeaderClass} sticky left-[50px] z-20 bg-slate-100 border-r min-w-[200px]`}>Material ID</th>
                          <th className={`${tableHeaderClass} border-r text-emerald-600`}>Min_Tensile</th>
                          <th className={`${tableHeaderClass} border-r text-emerald-600`}>Min_Yield</th>
                          {PLATE_TEMP_STEPS.map(temp => <th key={temp} className={`${tableHeaderClass} border-r text-center`}>{temp}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {plateMaterials.map((mat, i) => (
                          <tr key={i} className={mat.id === inputs.shellMaterial ? "bg-sky-50" : i % 2 === 0 ? "bg-white" : "bg-slate-50/30"}>
                            <td className={`${tableCellClass} sticky left-0 z-10 border-r text-center ${mat.id === inputs.shellMaterial ? 'bg-sky-100' : 'bg-inherit'}`}>
                              <div className="flex items-center justify-center gap-2">
                                <button onClick={() => handleEditPlateMaterial(mat)} className="text-sky-500 hover:text-sky-700 transition-colors"><i className="fa-solid fa-pen-to-square"></i></button>
                                <button onClick={() => handleDeletePlateMaterial(mat.id)} className="text-slate-300 hover:text-red-500 transition-colors"><i className="fa-solid fa-trash-can"></i></button>
                              </div>
                            </td>
                            <td className={`${tableCellClass} sticky left-[50px] z-10 font-black text-xs border-r ${mat.id === inputs.shellMaterial ? 'bg-sky-100' : 'bg-inherit'}`}>{mat.id}</td>
                            <td className={`${tableCellClass} border-r text-center font-bold text-slate-500`}>{mat.minTensile || '-'}</td>
                            <td className={`${tableCellClass} border-r text-center font-bold text-slate-500`}>{mat.minYield || '-'}</td>
                            {PLATE_TEMP_STEPS.map((temp, idx) => <td key={idx} className={`${tableCellClass} border-r text-center`}>{mat.stresses[idx] !== null ? mat.stresses[idx] : ''}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'pcc1' && (
                <div className="space-y-6">
                  <div className="flex flex-col gap-2">
                    <h4 className="text-[14px] font-black text-slate-800 uppercase tracking-tight">Table 3—Assembly Gasket Stress</h4>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">PCC-1 (API 660) Engineering Reference</p>
                  </div>
                  <div className="overflow-x-auto border rounded-xl shadow-sm">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr>
                          <th className={`${tableHeaderClass} min-w-[200px]`}>Peripheral Gasket Type</th>
                          <th className={tableHeaderClass}>Max Permissible Stress (Sgmax)<br/><span className="lowercase font-bold opacity-60">MPa (psi)</span></th>
                          <th className={tableHeaderClass}>Min Seating Stress (Sgmin-S)<br/><span className="lowercase font-bold opacity-60">MPa (psi)</span></th>
                          <th className={tableHeaderClass}>Min Operating Stress (Sgmin-O)<br/><span className="lowercase font-bold opacity-60">MPa (psi)</span></th>
                        </tr>
                      </thead>
                      <tbody>
                        {API660_PCC1_STRESS_TABLE.map((row, i) => (
                          <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/30"}>
                            <td className={`${tableCellClass} font-black text-slate-800 border-r`}>{row.type}</td>
                            <td className={`${tableCellClass} border-r text-center font-bold`}>{row.sgMax}</td>
                            <td className={`${tableCellClass} border-r text-center font-bold`}>{row.sgMinS}</td>
                            <td className={`${tableCellClass} text-center font-bold`}>{row.sgMinO}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'bolts' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <div className="flex items-center gap-4">
                      <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tema Bolt specifications (Table D-5)</h5>
                      <div className="flex gap-2">
                        <button onClick={handleAddNewBoltSpec} className="bg-indigo-600 hover:bg-indigo-700 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-sm transition-all active:scale-95">
                          <i className="fa-solid fa-plus"></i> Add New Bolt
                        </button>
                        <button onClick={() => temaBoltFileInputRef.current?.click()} className="bg-sky-600 hover:bg-sky-700 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-sm transition-all active:scale-95">
                          <i className="fa-solid fa-file-excel"></i> Upload CSV
                        </button>
                        <button onClick={handleExportBoltSpecs} className="bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-sm transition-all active:scale-95">
                          <i className="fa-solid fa-file-excel"></i> OUTPUT
                        </button>
                        <button onClick={handleSaveTemaBoltToLocalStorage} className="bg-indigo-500 hover:bg-indigo-600 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-sm transition-all active:scale-95">
                          <i className="fa-solid fa-floppy-disk"></i> SAVE
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="overflow-x-auto border rounded-xl shadow-sm">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr>
                          <th className={`${tableHeaderClass} text-center`}>Action</th>
                          <th className={tableHeaderClass}>Size (in)</th>
                          <th className={tableHeaderClass}>R (in)</th>
                          <th className={tableHeaderClass}>B-MIN</th>
                          <th className={tableHeaderClass}>B-MAX(WHC STD)</th>
                          <th className={tableHeaderClass}>E (in)</th>
                          <th className={tableHeaderClass}>Hole dH (mm)</th>
                          <th className={tableHeaderClass}>Area (mm²)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {temaBoltData.map((bolt, i) => (
                          <tr key={i} className={bolt.size === inputs.boltSize ? "bg-sky-50" : ""}>
                            <td className={`${tableCellClass} text-center`}>
                              <div className="flex items-center justify-center gap-2">
                                <button onClick={() => handleEditBoltSpec(bolt)} className="text-sky-500 hover:text-sky-700 transition-colors"><i className="fa-solid fa-pen-to-square"></i></button>
                                <button onClick={() => handleDeleteBoltSpec(bolt.size)} className="text-slate-300 hover:text-red-500 transition-colors"><i className="fa-solid fa-trash-can"></i></button>
                              </div>
                            </td>
                            <td className={`${tableCellClass} font-black`}>{bolt.size}"</td>
                            <td className={tableCellClass}>{bolt.R}</td>
                            <td className={tableCellClass}>{bolt.B_min}</td>
                            <td className={`${tableCellClass} font-black text-sky-600`}>{bolt.bMinWhc || '-'}</td>
                            <td className={tableCellClass}>{bolt.E}</td>
                            <td className={tableCellClass}>{bolt.holeSize.toFixed(1)}</td>
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
                  <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <div className="flex items-center gap-4">
                      <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Bolt Tensioning specifications</h5>
                      <div className="flex gap-2">
                        <button onClick={handleAddNewTensioningSpec} className="bg-indigo-600 hover:bg-indigo-700 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-sm transition-all active:scale-95">
                          <i className="fa-solid fa-plus"></i> Add New Spec
                        </button>
                        <button onClick={() => tensioningFileInputRef.current?.click()} className="bg-sky-600 hover:bg-sky-700 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-sm transition-all active:scale-95">
                          <i className="fa-solid fa-file-excel"></i> Upload CSV
                        </button>
                        <button onClick={handleExportTensioning} className="bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-sm transition-all active:scale-95">
                          <i className="fa-solid fa-file-excel"></i> OUTPUT
                        </button>
                        <button onClick={handleSaveTensioningToLocalStorage} className="bg-indigo-500 hover:bg-indigo-600 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-sm transition-all active:scale-95">
                          <i className="fa-solid fa-floppy-disk"></i> SAVE
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="overflow-x-auto border rounded-xl shadow-sm max-w-2xl mx-auto bg-white">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr>
                          <th className={`${tableHeaderClass} text-center`}>Action</th>
                          <th className={tableHeaderClass}>Bolt Size (in)</th>
                          <th className={tableHeaderClass}>B_ten (in)</th>
                          <th className={tableHeaderClass}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tensioningData.map((item, i) => (
                          <tr key={i} className={item.size === inputs.boltSize ? "bg-sky-50" : ""}>
                            <td className={`${tableCellClass} text-center`}>
                              <div className="flex items-center justify-center gap-2">
                                <button onClick={() => handleEditTensioningSpec(item)} className="text-sky-500 hover:text-sky-700 transition-colors"><i className="fa-solid fa-pen-to-square"></i></button>
                                <button onClick={() => handleDeleteTensioningSpec(item.size)} className="text-slate-300 hover:text-red-500 transition-colors"><i className="fa-solid fa-trash-can"></i></button>
                              </div>
                            </td>
                            <td className={`${tableCellClass} font-black`}>{item.size}"</td>
                            <td className={tableCellClass}>{item.B_ten}</td>
                            <td className={tableCellClass}>
                              {item.size === inputs.boltSize ? (
                                <span className="text-[8px] bg-sky-600 text-white px-1.5 py-0.5 rounded-full font-black">ACTIVE</span>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'gaskets' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <div className="flex items-center gap-4">
                      <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Gasket Factors (Table 4.16.1)</h5>
                      <div className="flex gap-2">
                        <button onClick={handleAddNewGasketFactor} className="bg-indigo-600 hover:bg-indigo-700 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-sm transition-all active:scale-95">
                          <i className="fa-solid fa-plus"></i> Add New Gasket
                        </button>
                        <button onClick={() => gasketFileInputRef.current?.click()} className="bg-sky-600 hover:bg-sky-700 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-sm transition-all active:scale-95">
                          <i className="fa-solid fa-file-excel"></i> Upload CSV
                        </button>
                        <button onClick={handleExportGaskets} className="bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-sm transition-all active:scale-95">
                          <i className="fa-solid fa-file-excel"></i> OUTPUT
                        </button>
                        <button onClick={handleSaveGasketTypesToLocalStorage} className="bg-indigo-500 hover:bg-indigo-600 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-sm transition-all active:scale-95">
                          <i className="fa-solid fa-floppy-disk"></i> SAVE
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="overflow-x-auto border rounded-xl shadow-sm">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr>
                          <th rowSpan={2} className={`${tableHeaderClass} border-r text-center`}>Action</th>
                          <th rowSpan={2} className={`${tableHeaderClass} border-r`}>GASKET MATERIAL</th>
                          <th rowSpan={2} className={`${tableHeaderClass} border-r text-center`}>GASKET FACTOR, m</th>
                          <th colSpan={2} className={`${tableHeaderClass} border-r border-b text-center`}>MIN. DESIGN SEATING STRESS, y</th>
                          <th rowSpan={2} className={`${tableHeaderClass} text-center`}>FACING SKETCH</th>
                        </tr>
                        <tr>
                          <th className={`${tableHeaderClass} border-r text-center bg-slate-50/50`}>MPa</th>
                          <th className={`${tableHeaderClass} border-r text-center bg-slate-50/50`}>PSI</th>
                        </tr>
                      </thead>
                      <tbody>
                        {gasketTypes.map((g, i) => (
                          <tr key={i} className={g.id === inputs.gasketType ? "bg-sky-50" : ""}>
                            <td className={`${tableCellClass} border-r text-center`}>
                              <div className="flex items-center justify-center gap-2">
                                <button onClick={() => handleEditGasketFactor(g)} className="text-sky-500 hover:text-sky-700 transition-colors"><i className="fa-solid fa-pen-to-square"></i></button>
                                <button onClick={() => handleDeleteGasketFactor(g.id)} className="text-slate-300 hover:text-red-500 transition-colors"><i className="fa-solid fa-trash-can"></i></button>
                              </div>
                            </td>
                            <td className={`${tableCellClass} font-black text-slate-800`}>{g.id}</td>
                            <td className={`${tableCellClass} text-center`}>{g.m.toFixed(2)}</td>
                            <td className={`${tableCellClass} text-center font-bold`}>
                              {(g.y * 0.00689476).toFixed(0)}
                            </td>
                            <td className={`${tableCellClass} text-center font-bold`}>
                              {g.y.toLocaleString()}
                            </td>
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
                  <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <div className="flex items-center gap-4">
                      <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Ring Standards (Defaults)</h5>
                      <div className="flex gap-2">
                        <button onClick={handleAddNewRingStandard} className="bg-indigo-600 hover:bg-indigo-700 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-sm transition-all active:scale-95">
                          <i className="fa-solid fa-plus"></i> Add New Ring
                        </button>
                        <button onClick={() => ringFileInputRef.current?.click()} className="bg-sky-600 hover:bg-sky-700 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-sm transition-all active:scale-95">
                          <i className="fa-solid fa-file-excel"></i> Upload CSV
                        </button>
                        <button onClick={handleExportRings} className="bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-sm transition-all active:scale-95">
                          <i className="fa-solid fa-file-excel"></i> OUTPUT
                        </button>
                        <button onClick={handleSaveRingStandardsToLocalStorage} className="bg-indigo-500 hover:bg-indigo-600 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-sm transition-all active:scale-95">
                          <i className="fa-solid fa-floppy-disk"></i> SAVE
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="overflow-x-auto border rounded-xl shadow-sm bg-white">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr>
                          <th className={`${tableHeaderClass} text-center`}>Action</th>
                          <th className={tableHeaderClass}>Shell ID Min (mm)</th>
                          <th className={tableHeaderClass}>Shell ID Max (mm)</th>
                          <th className={tableHeaderClass}>Min IR Width (mm)</th>
                          <th className={tableHeaderClass}>Min OR Width (mm)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ringStandards.map((ring, i) => {
                          const isActive = inputs.insideDia >= ring.min && inputs.insideDia <= ring.max;
                          return (
                            <tr key={i} className={isActive ? "bg-sky-50" : ""}>
                              <td className={`${tableCellClass} text-center`}>
                                <div className="flex items-center justify-center gap-2">
                                  <button onClick={() => handleEditRingStandard(ring)} className="text-sky-500 hover:text-sky-700 transition-colors"><i className="fa-solid fa-pen-to-square"></i></button>
                                  <button onClick={() => handleDeleteRingStandard(ring.min, ring.max)} className="text-slate-300 hover:text-red-500 transition-colors"><i className="fa-solid fa-trash-can"></i></button>
                                </div>
                              </td>
                              <td className={tableCellClass}>{ring.min}</td>
                              <td className={tableCellClass}>{ring.max === 100000 ? '∞' : ring.max}</td>
                              <td className={tableCellClass}>{ring.irMin}</td>
                              <td className={tableCellClass}>{ring.orMin}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Editors and Modals */}
      {/* Ring Standard Editor Modal */}
      {isEditingRingStandard && editingRingStandard && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" onClick={() => setIsEditingRingStandard(false)}></div>
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6 flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6 border-b pb-4 border-slate-200 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white"><i className="fa-solid fa-circle-nodes"></i></div>
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight text-slate-800">Ring Standard Editor</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Gasket Ring Configuration</p>
                </div>
              </div>
              <button onClick={() => setIsEditingRingStandard(false)} className="text-slate-400 hover:text-slate-600 transition-colors"><i className="fa-solid fa-xmark text-xl"></i></button>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Min Shell ID (mm)</label>
                <input type="number" step="1" value={editingRingStandard.min} onChange={(e) => setEditingRingStandard({...editingRingStandard, min: parseFloat(e.target.value) || 0})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Max Shell ID (mm)</label>
                <input type="number" step="1" value={editingRingStandard.max} onChange={(e) => setEditingRingStandard({...editingRingStandard, max: parseFloat(e.target.value) || 0})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Min Inner Ring Width (mm)</label>
                <input type="number" step="0.1" value={editingRingStandard.irMin} onChange={(e) => setEditingRingStandard({...editingRingStandard, irMin: parseFloat(e.target.value) || 0})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Min Outer Ring Width (mm)</label>
                <input type="number" step="0.1" value={editingRingStandard.orMin} onChange={(e) => setEditingRingStandard({...editingRingStandard, orMin: parseFloat(e.target.value) || 0})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm" />
              </div>
            </div>

            <div className="mt-8 pt-4 border-t flex justify-end gap-3 border-slate-200 shrink-0">
              <button onClick={() => setIsEditingRingStandard(false)} className="px-6 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
              <button onClick={saveRingStandard} className="px-8 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest rounded-lg shadow-lg">Save Ring</button>
            </div>
          </div>
        </div>
      )}

      {/* Gasket Factor Editor Modal */}
      {isEditingGasketFactor && editingGasketFactor && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" onClick={() => setIsEditingGasketFactor(false)}></div>
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl p-6 flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6 border-b pb-4 border-slate-200 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white"><i className="fa-solid fa-ring"></i></div>
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight text-slate-800">Gasket Factor Editor</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Table 4.16.1 Configuration</p>
                </div>
              </div>
              <button onClick={() => setIsEditingGasketFactor(false)} className="text-slate-400 hover:text-slate-600 transition-colors"><i className="fa-solid fa-xmark text-xl"></i></button>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Gasket Material / ID</label>
                <input type="text" value={editingGasketFactor.id} onChange={(e) => setEditingGasketFactor({...editingGasketFactor, id: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Gasket Factor, m</label>
                  <input type="number" step="0.01" value={editingGasketFactor.m} onChange={(e) => setEditingGasketFactor({...editingGasketFactor, m: parseFloat(e.target.value) || 0})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Seating Stress, y (PSI)</label>
                  <input type="number" step="1" value={editingGasketFactor.y} onChange={(e) => setEditingGasketFactor({...editingGasketFactor, y: parseFloat(e.target.value) || 0})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Facing Sketches</label>
                <input type="text" value={editingGasketFactor.sketches} onChange={(e) => setEditingGasketFactor({...editingGasketFactor, sketches: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm" placeholder="e.g. (1a), (1b), (1c), (1d)" />
              </div>
            </div>

            <div className="mt-8 pt-4 border-t flex justify-end gap-3 border-slate-200 shrink-0">
              <button onClick={() => setIsEditingGasketFactor(false)} className="px-6 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
              <button onClick={saveGasketFactor} className="px-8 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest rounded-lg shadow-lg">Save Gasket Factor</button>
            </div>
          </div>
        </div>
      )}

      {/* Tensioning Spec Editor Modal */}
      {isEditingTensioningSpec && editingTensioningSpec && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" onClick={() => setIsEditingTensioningSpec(false)}></div>
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6 border-b pb-4 border-slate-200 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white"><i className="fa-solid fa-oil-can"></i></div>
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight text-slate-800">Tensioning Spec Editor</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Hydraulic Tensioning Configuration</p>
                </div>
              </div>
              <button onClick={() => setIsEditingTensioningSpec(false)} className="text-slate-400 hover:text-slate-600 transition-colors"><i className="fa-solid fa-xmark text-xl"></i></button>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Bolt Size (inch)</label>
                <input type="number" step="0.001" value={editingTensioningSpec.size} onChange={(e) => setEditingTensioningSpec({...editingTensioningSpec, size: parseFloat(e.target.value) || 0})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">B_ten: Min tensioning spacing (inch)</label>
                <input type="number" step="0.001" value={editingTensioningSpec.B_ten} onChange={(e) => setEditingTensioningSpec({...editingTensioningSpec, B_ten: parseFloat(e.target.value) || 0})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm" />
              </div>
            </div>

            <div className="mt-8 pt-4 border-t flex justify-end gap-3 border-slate-200 shrink-0">
              <button onClick={() => setIsEditingTensioningSpec(false)} className="px-6 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
              <button onClick={saveTensioningSpec} className="px-8 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest rounded-lg shadow-lg">Save Spec</button>
            </div>
          </div>
        </div>
      )}

      {/* Bolt Spec Editor Modal */}
      {isEditingBoltSpec && editingBoltSpec && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" onClick={() => setIsEditingBoltSpec(false)}></div>
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl p-6 flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6 border-b pb-4 border-slate-200 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white"><i className="fa-solid fa-bolt"></i></div>
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight text-slate-800">Bolt Specification Editor</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Table D-5 Configuration</p>
                </div>
              </div>
              <button onClick={() => setIsEditingBoltSpec(false)} className="text-slate-400 hover:text-slate-600 transition-colors"><i className="fa-solid fa-xmark text-xl"></i></button>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Bolt Size (inch)</label>
                <input type="number" step="0.001" value={editingBoltSpec.size} onChange={(e) => setEditingBoltSpec({...editingBoltSpec, size: parseFloat(e.target.value) || 0})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">R: Radial distance (inch)</label>
                <input type="number" step="0.001" value={editingBoltSpec.R} onChange={(e) => setEditingBoltSpec({...editingBoltSpec, R: parseFloat(e.target.value) || 0})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">B_min: Min spacing (inch)</label>
                <input type="number" step="0.001" value={editingBoltSpec.B_min} onChange={(e) => setEditingBoltSpec({...editingBoltSpec, B_min: parseFloat(e.target.value) || 0})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">E: Edge distance (inch)</label>
                <input type="number" step="0.001" value={editingBoltSpec.E} onChange={(e) => setEditingBoltSpec({...editingBoltSpec, E: parseFloat(e.target.value) || 0})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Hole Diameter (mm)</label>
                <input type="number" step="0.1" value={editingBoltSpec.holeSize} onChange={(e) => setEditingBoltSpec({...editingBoltSpec, holeSize: parseFloat(e.target.value) || 0})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tensile Area (mm²)</label>
                <input type="number" step="0.1" value={editingBoltSpec.tensileArea} onChange={(e) => setEditingBoltSpec({...editingBoltSpec, tensileArea: parseFloat(e.target.value) || 0})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm" />
              </div>
              <div className="space-y-1 col-span-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">bMinWhc: WHC Std Min Pitch (mm)</label>
                <input type="number" step="0.1" value={editingBoltSpec.bMinWhc || ''} onChange={(e) => setEditingBoltSpec({...editingBoltSpec, bMinWhc: parseFloat(e.target.value) || undefined})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm" placeholder="Optional" />
              </div>
            </div>

            <div className="mt-8 pt-4 border-t flex justify-end gap-3 border-slate-200 shrink-0">
              <button onClick={() => setIsEditingBoltSpec(false)} className="px-6 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
              <button onClick={saveBoltSpec} className="px-8 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest rounded-lg shadow-lg">Save Bolt Spec</button>
            </div>
          </div>
        </div>
      )}

      {/* Bolt Material Editor Modal */}
      {isEditingMaterial && editingMaterial && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" onClick={() => setIsEditingMaterial(false)}></div>
          <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl p-6 flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6 border-b pb-4 border-slate-200 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white"><i className="fa-solid fa-flask"></i></div>
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight text-slate-800">Bolt Material Editor</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Configure Stress Parameters (MPa)</p>
                </div>
              </div>
              <button onClick={() => setIsEditingMaterial(false)} className="text-slate-400 hover:text-slate-600 transition-colors"><i className="fa-solid fa-xmark text-xl"></i></button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Material ID</label>
                  <input type="text" value={editingMaterial.id} onChange={(e) => setEditingMaterial({...editingMaterial, id: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Min Tensile (MPa)</label>
                  <input type="number" value={editingMaterial.minTensile || ''} onChange={(e) => setEditingMaterial({...editingMaterial, minTensile: parseFloat(e.target.value) || 0})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Min Yield (MPa)</label>
                  <input type="number" value={editingMaterial.minYield || ''} onChange={(e) => setEditingMaterial({...editingMaterial, minYield: parseFloat(e.target.value) || 0})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm" />
                </div>
              </div>
              <div className="space-y-3">
                <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest border-l-4 border-indigo-600 pl-2">Stress vs Temperature Matrix</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2">
                  {BOLT_TEMP_STEPS.map((temp, idx) => (
                    <div key={temp} className="space-y-1">
                      <label className="text-[8px] font-black text-slate-400 uppercase text-center block">{temp}°C</label>
                      <input type="number" step="0.1" value={editingMaterial.stresses[idx] === null ? '' : editingMaterial.stresses[idx]} onChange={(e) => {
                        const newStresses = [...editingMaterial.stresses];
                        newStresses[idx] = e.target.value === '' ? null : parseFloat(e.target.value);
                        setEditingMaterial({...editingMaterial, stresses: newStresses});
                      }} className="w-full px-2 py-1 text-center border rounded-md text-[10px] font-mono focus:border-indigo-500 outline-none" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-6 pt-4 border-t flex justify-end gap-3 border-slate-200 shrink-0">
              <button onClick={() => setIsEditingMaterial(false)} className="px-6 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
              <button onClick={saveBoltMaterial} className="px-8 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest rounded-lg shadow-lg">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Plate Material Editor Modal */}
      {isEditingPlateMaterial && editingPlateMaterial && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" onClick={() => setIsEditingPlateMaterial(false)}></div>
          <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl p-6 flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6 border-b pb-4 border-slate-200 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white"><i className="fa-solid fa-layer-group"></i></div>
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight text-slate-800">Plate Material Editor</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Configure Plate Stress Parameters (MPa)</p>
                </div>
              </div>
              <button onClick={() => setIsEditingPlateMaterial(false)} className="text-slate-400 hover:text-slate-600 transition-colors"><i className="fa-solid fa-xmark text-xl"></i></button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Material ID</label>
                  <input type="text" value={editingPlateMaterial.id} onChange={(e) => setEditingPlateMaterial({...editingPlateMaterial, id: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Min Tensile (MPa)</label>
                  <input type="number" value={editingPlateMaterial.minTensile || ''} onChange={(e) => setEditingPlateMaterial({...editingPlateMaterial, minTensile: parseFloat(e.target.value) || 0})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Min Yield (MPa)</label>
                  <input type="number" value={editingPlateMaterial.minYield || ''} onChange={(e) => setEditingPlateMaterial({...editingPlateMaterial, minYield: parseFloat(e.target.value) || 0})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-sm" />
                </div>
              </div>
              <div className="space-y-3">
                <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest border-l-4 border-emerald-600 pl-2">Stress vs Temperature Matrix</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2">
                  {PLATE_TEMP_STEPS.map((temp, idx) => (
                    <div key={temp} className="space-y-1">
                      <label className="text-[8px] font-black text-slate-400 uppercase text-center block">{temp}°C</label>
                      <input type="number" step="0.1" value={editingPlateMaterial.stresses[idx] === null ? '' : editingPlateMaterial.stresses[idx]} onChange={(e) => {
                        const newStresses = [...editingPlateMaterial.stresses];
                        newStresses[idx] = e.target.value === '' ? null : parseFloat(e.target.value);
                        setEditingPlateMaterial({...editingPlateMaterial, stresses: newStresses});
                      }} className="w-full px-2 py-1 text-center border rounded-md text-[10px] font-mono focus:border-emerald-500 outline-none" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-6 pt-4 border-t flex justify-end gap-3 border-slate-200 shrink-0">
              <button onClick={() => setIsEditingPlateMaterial(false)} className="px-6 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
              <button onClick={savePlateMaterial} className="px-8 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest rounded-lg shadow-lg">Save Plate</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
