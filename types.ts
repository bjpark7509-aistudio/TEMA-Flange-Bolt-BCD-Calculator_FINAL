export interface BoltMaterial {
  id: string;
  minTensile?: number; // MPa
  minYield?: number;   // MPa
  stresses: (number | null)[];
}

export interface ShellMaterial {
  id: string;
  minTensile?: number; // MPa
  minYield?: number;   // MPa
  stresses: (number | null)[];
}

export interface GasketType {
  id: string;
  m: number;
  y: number; // in PSI
  sketches: string;
}

export interface TensioningInfo {
  size: number;
  B_ten: number;
}

export interface RingStandard {
  min: number;
  max: number;
  irMin: number;
  orMin: number;
}

export interface FlangeInputs {
  itemNo?: string;
  partName?: string;
  boltSize: number; // inches
  boltCount: number;
  insideDia: number; // mm (Shell ID)
  g0: number; // mm
  g1: number; // mm
  cClearance: number; // mm (C value)
  shellGapA: number; // mm (Gap between Shell ID and Gasket ID)
  gasketSeatingWidth: number; // mm (Manual only)
  hasInnerRing: boolean;
  hasOuterRing: boolean;
  innerRingWidthManual: number; // mm (0 = auto)
  outerRingWidthManual: number; // mm (0 = auto)
  useManualOverride: boolean; // Controls manual input availability
  actualBCD: number; // mm (0 = auto)
  actualOD: number; // mm (0 = auto)
  manualSeatingID: number; // mm (Gasket ID Expect Inner Ring)
  manualSeatingOD: number; // mm (Gasket OD Expect outer Ring)
  manualM: number; // Manual Gasket M override
  manualY: number; // Manual Gasket Y override
  manualPassM: number; // Manual Pass Partition M override
  manualPassY: number; // Manual Pass Partition Y override
  designTemp: number;
  tempUnit: string; // °C, °F
  designPressure: number;
  pressureUnit: string; // MPa, Bar, PSI, kg/cm²
  shellMaterial: string; // New field
  jointEfficiency: number; // 1.0 or 0.85
  corrosionAllowance: number; // mm
  boltMaterial: string; // From the provided list
  passPartitionLength: number; // mm
  passPartitionWidth: number; // mm
  gasketType: string;
  passGasketType: string; // Gasket type for pass partition
  facingSketch: string; // ASME Table 2-5.2 Sketch ID
  useHydraulicTensioning: boolean; // New field for tensioning selection
  
  // PCC-1 Check Fields
  usePcc1Check: boolean;
  sgT: number;
  sgMinS: number;
  sgMinO: number;
  sgMax: number;
  sbMax: number;
  sbMin: number;
  sfMax: number;
  phiFMax: number;
  phiGMax: number;
  g: number; // New field
  passPartAreaReduction: number; // New field (%)

  // Custom Legend Image
  customLegendUrl?: string;
}

export interface TemaBoltInfo {
  size: number; // inches
  R: number; // inches
  B_min: number; // inches
  E: number; // inches
  holeSize: number; // mm
  tensileArea: number; // mm^2 (Approx based on standard 8-UN or UNC)
  bMinWhc?: number; // mm (WHC Standard Minimum Pitch)
}

export interface CalculationResults {
  bcdMethod1: number; // TEMA Min Bolt Pitch method
  bcdMethod2: number; // TEMA Hub/Radial method
  bcdMethod3: number; // Gasket Width method
  selectedBcdSource: number; // 1, 2, or 3
  
  bcdTema: number; // The max of 1, 2, 3
  odTema: number;
  boltSpacingMin: number;
  effectiveBMin: number; // The inch value used (B_min or B_ten)
  maxBoltSpacing: number; // Max allowable pitch (2a + a)
  geometricPitch: number; // Physical spacing: (PI * BCD) / Count
  actualBoltSpacing: number; // User formula: 2d + 6g0/(m+0.5)
  spacingOk: boolean;
  radialDistance: number;
  edgeDistance: number;
  effectiveC: number; // The value used for C (e.g., 2.5 if input is 0)
  shellGapA: number; // Matches inputs.shellGapA
  gasketSeatingWidth: number;
  innerRingWidth: number;
  outerRingWidth: number;
  gasketID: number;      // Inner Ring ID (Assembly ID)
  seatingID: number;     // Inner Ring OD / Sealing Element ID
  seatingOD: number;     // Sealing Element OD / Outer Ring ID
  gasketOD: number;      // Outer Ring OD (Assembly OD)
  finalBCD: number;
  finalOD: number;
  maxRaisedFace: number; // BCD - Hole - 2C
  boltHoleSize: number;

  // Bolt Load Result
  singleBoltArea: number;
  totalBoltArea: number;
  requiredBoltArea: number;
  totalBoltLoadAmbient: number;
  totalBoltLoadDesign: number;
  ambientAllowableStress: number;
  designAllowableStress: number;

  // Gasket M/Y
  gasketM: number;
  gasketY: number; // PSI
  passM: number;   // Resolved M for pass partition
  passY: number;   // Resolved Y for pass partition (PSI)

  // ASME Required Bolt Loads
  wm1: number; // Operating (N)
  wm2: number; // Seating (N)
  hForce: number; // H (N)
  hpForce: number; // Hp (N)
  gMeanDia: number; // G (mm)
  bWidth: number; // b (mm)
  b0Width: number; // b0 (mm)
  nWidth: number; // N (mm)
  
  // Hub calculation process
  shellStress: number;
}