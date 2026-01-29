
import { TemaBoltInfo, BoltMaterial, ShellMaterial, GasketType } from './types';

export const TEMA_BOLT_DATA: TemaBoltInfo[] = [
  { size: 0.5, R: 0.8125, B_min: 1.25, E: 0.625, holeSize: 15.875, tensileArea: 81.29 },
  { size: 0.625, R: 0.9375, B_min: 1.5, E: 0.75, holeSize: 19.05, tensileArea: 130.32 },
  { size: 0.75, R: 1.125, B_min: 1.75, E: 0.8125, holeSize: 22.225, tensileArea: 194.84, bMinWhc: 3.5433 },
  { size: 0.875, R: 1.25, B_min: 2.0625, E: 0.9375, holeSize: 25.4, tensileArea: 270.32, bMinWhc: 4.1732 },
  { size: 1.0, R: 1.375, B_min: 2.25, E: 1.0625, holeSize: 28.575, tensileArea: 355.48, bMinWhc: 4.5669 },
  { size: 1.125, R: 1.5, B_min: 2.5, E: 1.125, holeSize: 31.75, tensileArea: 469.68, bMinWhc: 5.0394 },
  { size: 1.25, R: 1.75, B_min: 2.8125, E: 1.25, holeSize: 34.925, tensileArea: 599.35, bMinWhc: 5.6693 },
  { size: 1.375, R: 1.875, B_min: 3.0625, E: 1.375, holeSize: 38.1, tensileArea: 745.16, bMinWhc: 6.1417 },
  { size: 1.5, R: 2.0, B_min: 3.25, E: 1.5, holeSize: 41.275, tensileArea: 906.45, bMinWhc: 6.5354 },
  { size: 1.625, R: 2.125, B_min: 3.5, E: 1.625, holeSize: 44.45, tensileArea: 1083.87, bMinWhc: 7.0079 },
  { size: 1.75, R: 2.25, B_min: 3.75, E: 1.75, holeSize: 47.625, tensileArea: 1277.42, bMinWhc: 7.5591 },
  { size: 1.875, R: 2.375, B_min: 4.0, E: 1.875, holeSize: 50.8, tensileArea: 1486.45, bMinWhc: 8.0315 },
  { size: 2.0, R: 2.5, B_min: 4.25, E: 2.0, holeSize: 53.975, tensileArea: 1710.96, bMinWhc: 8.5039 },
  { size: 2.25, R: 2.75, B_min: 4.75, E: 2.25, holeSize: 60.325, tensileArea: 2208.38, bMinWhc: 9.5276 },
  { size: 2.5, R: 3.0625, B_min: 5.25, E: 2.5, holeSize: 66.675, tensileArea: 2768.16, bMinWhc: 10.5512 },
  { size: 2.75, R: 3.375, B_min: 5.75, E: 2.625, holeSize: 76.2, tensileArea: 3392.90, bMinWhc: 11.5748 },
  { size: 3.0, R: 3.625, B_min: 6.25, E: 2.875, holeSize: 82.55, tensileArea: 4079.56, bMinWhc: 12.5197 },
  { size: 3.25, R: 3.75, B_min: 6.625, E: 3.0, holeSize: 88.9, tensileArea: 4830.31, bMinWhc: 13.3071 },
  { size: 3.5, R: 4.125, B_min: 7.125, E: 3.25, holeSize: 95.25, tensileArea: 5644.50, bMinWhc: 14.3307 },
  { size: 3.75, R: 4.4375, B_min: 7.625, E: 3.5, holeSize: 101.6, tensileArea: 6521.28, bMinWhc: 15.2756 },
  { size: 4.0, R: 4.625, B_min: 8.125, E: 3.625, holeSize: 107.95, tensileArea: 7461.92, bMinWhc: 16.2992 },
];

export const HYDRAULIC_TENSIONING_DATA = [
  { size: 0.75, B_ten: 2.1 },
  { size: 0.875, B_ten: 2.1 },
  { size: 1.0, B_ten: 2.5 },
  { size: 1.125, B_ten: 2.5 },
  { size: 1.25, B_ten: 2.9 },
  { size: 1.375, B_ten: 3.2 },
  { size: 1.5, B_ten: 3.3 },
  { size: 1.625, B_ten: 3.7 },
  { size: 1.75, B_ten: 3.8 },
  { size: 1.875, B_ten: 4.5 },
  { size: 2.0, B_ten: 4.6 },
  { size: 2.25, B_ten: 4.9 },
  { size: 2.5, B_ten: 5.1 },
  { size: 2.75, B_ten: 6.0 },
  { size: 3.0, B_ten: 6.1 },
  { size: 3.25, B_ten: 7.0 },
  { size: 3.5, B_ten: 7.3 },
  { size: 3.75, B_ten: 7.6 },
  { size: 4.0, B_ten: 7.8 },
];

export const WHC_MAX_PITCH_TABLE: Record<number, number> = {
  0.5: 65, 0.625: 78, 0.75: 90, 0.875: 106, 1.0: 116, 1.125: 128, 1.25: 144, 1.375: 156, 1.5: 166, 1.625: 178, 1.75: 192, 1.875: 204, 2.0: 216, 2.25: 242, 2.5: 268, 2.75: 294, 3.0: 318, 3.25: 338, 3.5: 364, 3.75: 388, 4.0: 414
};

export const GASKET_RING_TABLE = [
  { min: 0, max: 40, irMin: 3, orMin: 4 },
  { min: 41, max: 63, irMin: 3, orMin: 4 },
  { min: 64, max: 100, irMin: 4, orMin: 5 },
  { min: 101, max: 160, irMin: 4, orMin: 5 },
  { min: 161, max: 250, irMin: 4, orMin: 5 },
  { min: 251, max: 400, irMin: 6, orMin: 6 },
  { min: 401, max: 630, irMin: 7, orMin: 8 },
  { min: 631, max: 1000, irMin: 9, orMin: 8 },
  { min: 1001, max: 1200, irMin: 12, orMin: 10 },
  { min: 1201, max: 1600, irMin: 15, orMin: 10 },
  { min: 1601, max: 2000, irMin: 20, orMin: 12 },
  { min: 2001, max: 100000, irMin: 20, orMin: 15 },
];

export const BOLT_TEMP_STEPS = [
  40, 65, 100, 125, 150, 175, 200, 225, 250, 275, 300, 325, 350, 375, 400, 425, 450, 475, 500, 525, 550, 575, 600, 625, 650, 675, 700, 725, 750, 775, 800, 825, 850, 875, 900
];

export const PLATE_TEMP_STEPS = [
  40, 65, 100, 125, 150, 200, 250, 300, 325, 350, 375, 400, 425, 450, 475, 500, 525, 550, 575, 600, 625, 650, 675, 700, 725, 750, 775, 800, 825, 850, 875, 900
];

export const GASKET_TYPES: GasketType[] = [
  { id: 'Self-energizing types (O rings, metallic, elastomer, other gasket types)', m: 0, y: 0, sketches: '...' },
  { id: 'Elastomers without fabric (below 75 A Shore Durometer)', m: 0.50, y: 0, sketches: '(1a), (1b), (1c), (1d)' },
  { id: 'Elastomers without fabric (75 A or higher Shore Durometer)', m: 1.00, y: 200, sketches: '(1a), (1b), (1c), (1d)' },
  { id: 'Mineral fiber w/ suitable binder (3.2 mm thick)', m: 2.00, y: 1600, sketches: '(1a), (1b), (1c), (1d)' },
  { id: 'Mineral fiber w/ suitable binder (1.6 mm thick)', m: 2.75, y: 3700, sketches: '(1a), (1b), (1c), (1d)' },
  { id: 'Mineral fiber w/ suitable binder (0.8 mm thick)', m: 3.50, y: 6500, sketches: '(1a), (1b), (1c), (1d)' },
  { id: 'Elastomers with cotton fabric insertion', m: 1.25, y: 400, sketches: '(1a), (1b), (1c), (1d)' },
  { id: 'Elastomers with mineral fiber (3-ply)', m: 2.25, y: 2200, sketches: '(1a), (1b), (1c), (1d)' },
  { id: 'Elastomers with mineral fiber (2-ply)', m: 2.50, y: 2900, sketches: '(1a), (1b), (1c), (1d)' },
  { id: 'Elastomers with mineral fiber (1-ply)', m: 2.75, y: 3700, sketches: '(1a), (1b), (1c), (1d)' },
  { id: 'Vegetable fiber', m: 1.75, y: 1100, sketches: '(1a), (1b), (1c), (1d)' },
  { id: 'Spiral-wound (Carbon steel)', m: 2.50, y: 10000, sketches: '(1a), (1b)' },
  { id: 'Spiral-wound (Stainless steel, Monel, and Ni-base alloy)', m: 3.00, y: 10000, sketches: '(1a), (1b)' },
  { id: 'Corrugated metal, jacketed (Soft aluminum)', m: 2.50, y: 2900, sketches: '(1a), (1b)' },
  { id: 'Corrugated metal, jacketed (Soft copper or brass)', m: 2.75, y: 3700, sketches: '(1a), (1b)' },
  { id: 'Corrugated metal, jacketed (Iron or soft steel)', m: 3.00, y: 4500, sketches: '(1a), (1b)' },
  { id: 'Corrugated metal, jacketed (Monel or 4%-6% chrome)', m: 3.25, y: 5500, sketches: '(1a), (1b)' },
  { id: 'Corrugated metal, jacketed (Stainless steel and Ni-base alloys)', m: 3.50, y: 6500, sketches: '(1a), (1b)' },
  { id: 'Corrugated metal (Soft aluminum)', m: 2.75, y: 3700, sketches: '(1a), (1b), (1c), (1d)' },
  { id: 'Corrugated metal (Soft copper or brass)', m: 3.00, y: 4500, sketches: '(1a), (1b), (1c), (1d)' },
  { id: 'Corrugated metal (Iron or soft steel)', m: 3.25, y: 5500, sketches: '(1a), (1b), (1c), (1d)' },
  { id: 'Corrugated metal (Monel or 4%-6% chrome)', m: 3.50, y: 6500, sketches: '(1a), (1b), (1c), (1d)' },
  { id: 'Corrugated metal (Stainless steel and Ni-base alloys)', m: 3.75, y: 7600, sketches: '(1a), (1b), (1c), (1d)' },
  { id: 'Flat metal, jacketed (Soft aluminum)', m: 3.25, y: 5500, sketches: '(1a), (1b), (1c), (1d)' },
  { id: 'Flat metal, jacketed (Soft copper or brass)', m: 3.50, y: 6500, sketches: '(1a), (1b), (1c), (1d)' },
  { id: 'Flat metal, jacketed (Iron or soft steel)', m: 3.75, y: 7600, sketches: '(1a), (1b), (1c), (1d)' },
  { id: 'Flat metal, jacketed (Monel)', m: 3.50, y: 8000, sketches: '(1a), (1b), (1c), (1d)' },
  { id: 'Flat metal, jacketed (4%-6% chrome)', m: 3.75, y: 9000, sketches: '(1a), (1b), (1c), (1d)' },
  { id: 'Flat metal, jacketed (Stainless steel and Ni-base alloys)', m: 3.75, y: 9000, sketches: '(1a), (1b), (1c), (1d)' },
  { id: 'Grooved metal (Soft aluminum)', m: 3.25, y: 5500, sketches: '(1a), (1b), (1c), (1d)' },
  { id: 'Grooved metal (Soft copper or brass)', m: 3.50, y: 6500, sketches: '(1a), (1b), (1c), (1d)' },
  { id: 'Grooved metal (Iron or soft steel)', m: 3.75, y: 7600, sketches: '(1a), (1b), (1c), (1d)' },
  { id: 'Grooved metal (Monel or 4%-6% chrome)', m: 3.75, y: 9000, sketches: '(1a), (1b), (1c), (1d)' },
  { id: 'Grooved metal (Stainless steel and Ni-base alloys)', m: 4.25, y: 10100, sketches: '(1a), (1b), (1c), (1d)' },
  { id: 'Solid flat metal (Soft aluminum)', m: 4.00, y: 8800, sketches: '(1a), (1b), (1c), (1d)' },
  { id: 'Solid flat metal (Soft copper or brass)', m: 4.75, y: 13000, sketches: '(1a), (1b), (1c), (1d)' },
  { id: 'Solid flat metal (Iron or soft steel)', m: 5.50, y: 18000, sketches: '(1a), (1b), (1c), (1d)' },
  { id: 'Solid flat metal (Monel or 4%-6% chrome)', m: 6.00, y: 21800, sketches: '(1a), (1b), (1c), (1d)' },
  { id: 'Solid flat metal (Stainless steel and Ni-base alloys)', m: 6.50, y: 26000, sketches: '(1a), (1b), (1c), (1d)' },
  { id: 'Ring joint (Iron or soft steel)', m: 5.50, y: 18000, sketches: '(2)' },
  { id: 'Ring joint (Monel or 4%-6% chrome)', m: 6.00, y: 21800, sketches: '(2)' },
  { id: 'Ring joint (Stainless steel and Ni-base alloys)', m: 6.50, y: 26000, sketches: '(2)' },
];

const emptyStresses = () => new Array(BOLT_TEMP_STEPS.length).fill(null);
const emptyPlateStresses = () => new Array(PLATE_TEMP_STEPS.length).fill(null);

export const ASME_PLATE_MATERIALS: ShellMaterial[] = [
  { id: "SA–516-55", minTensile: 380, minYield: 205, stresses: emptyPlateStresses() },
  { id: "SA–516-60", minTensile: 415, minYield: 220, stresses: emptyPlateStresses() },
  { id: "SA–516-65", minTensile: 450, minYield: 240, stresses: emptyPlateStresses() },
  { id: "SA–516-70", minTensile: 485, minYield: 260, stresses: emptyPlateStresses() },
  { id: "SA–240-316", minTensile: 515, minYield: 205, stresses: emptyPlateStresses() },
];

export const ASME_SHELL_MATERIALS: ShellMaterial[] = [...ASME_PLATE_MATERIALS];

export const ASME_BOLT_MATERIALS: BoltMaterial[] = [
  { id: "SA-193 B7 (<= 64)", minTensile: 860, minYield: 725, stresses: emptyStresses() },
  { id: "SA-193 B16 (<= 64)", minTensile: 860, minYield: 725, stresses: emptyStresses() },
  { id: "SA-320 L7 (<= 64)", minTensile: 860, minYield: 725, stresses: emptyStresses() },
  { id: "SA-453 660 A", minTensile: 900, minYield: 585, stresses: emptyStresses() },
];

export const API660_PCC1_STRESS_TABLE = [
  { type: "Grooved metal with soft facing", sgMax: "380 (55,000)", sgMinS: "140 (20,000)", sgMinO: "97 (14,000)" },
  { type: "Corrugated metal with soft facing", sgMax: "275 (40,000)", sgMinS: "140 (20,000)", sgMinO: "97 (14,000)" },
  { type: "Spiral-wound", sgMax: "Note b", sgMinS: "140 (20,000)", sgMinO: "97 (14,000)" },
];
