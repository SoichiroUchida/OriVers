export type Point = [number, number];
export type Ring = Point[];

export interface Shape {
  name: string;
  T: Ring[];
  holes: Ring[];
}

export interface Crease {
  a: Point;
  b: Point;
  mv: 'M' | 'V' | 'F';
  f0?: number;
  f1?: number;
}

export interface Face {
  F: Ring;
  s: number;
}

export interface Candidate {
  index: number;
  phase: number;
  seed: number;
  paper: Ring;
  faces: Face[];
}

export interface Piece {
  poly: Ring;
  cov: number[];
  top: number;
  inT: boolean;
  tiny: boolean;
  area: number;
}

export interface Edge {
  a: Point;
  b: Point;
  kind: string;
  pa: Point;
  pb: Point;
}

export interface CheckResult {
  max_layers: number;
  back_on_top: number;
  T_area_cells: number;
  T_area: number;
  back_out: number;
  out_area: number;
  not_total: number;
}

export interface MaekawaResult {
  interior: number;
  bad: number;
  badPts: Point[];
}

export interface Info {
  vars: number;
  clauses: number;
  triples: number;
  taco_taco: number;
  taco_tortilla: number;
  cells: number;
  pieces: number;
}

export interface CapInfo {
  dAtoms: number;
  zips: number;
}

export interface FoldinResult {
  ok: boolean;
  rounds: number;
  maxLayersBefore: number;
}

export interface DKResult {
  ok: true;
  paperKindUsed: string;
  paperKind: string;
  shapeName: string;
  foldin?: FoldinResult;
  log: LogEntry[];
  tried: number;
  ms: number;
  cand: Candidate;
  P: number[];
  creases: Crease[];
  check: CheckResult;
  maekawa: MaekawaResult;
  violated: number;
  info: Info;
  capInfo: CapInfo | null;
  nStrong: number;
  n: number;
  W: number;
  ovPairs: [number, number][];
  edges: Edge[];
  pieces: Piece[];
}

export interface DKFailResult {
  ok: false;
  log: LogEntry[];
  tried: number;
  ms: number;
}

export type DKResultOrFail = DKResult | DKFailResult;

export interface LogEntry {
  k: number;
  protrusion?: number;
  phase: number;
  seed: number;
  n: number;
  vars: number;
  clauses: number;
  status: 'sat' | 'unsat' | string;
  ms: number;
  ms_build?: number;
}

export interface StripInfo {
  step0: number;
  stepi: number;
  stepii: number;
  stepiiSkipped: number;
}

export interface StripStats {
  routes: number;
  turns: number;
  parityFix: number;
  crease: number;
  routeViolations: number;
}

export interface StripPiece {
  poly: Ring;
  owned: [Point, Point][];
}

export interface StripSample {
  n: number;
  badN: number;
  badTop: number;
  badBot: number;
}

export interface StripResult {
  shapeName: string;
  T: Ring[];
  H: Ring[];
  nOpen: number;
  info: StripInfo;
  pieces: StripPiece[];
  rows: Ring[];
  ropes?: Ring[];
  nRows: number;
  lam: number;
  angle: number;
  L: number;
  m: number;
  tooBig?: boolean;
  log: string[];
  nStripFaces: number;
  nClosed: number;
  stripCP?: number[][];
  closedCP?: number[][];
  phiImage?: [Ring, boolean][];
  folded?: [Ring, boolean][];
  stats: StripStats;
  sample?: StripSample;
  ms: { build: number; close: number; cp?: number; cp2?: number };
}

export type Mode = 'dk' | 'strip';
export type InputTab = 'preset' | 'editor' | 'image';
export type PaperKind = 'auto' | 'square' | 'tri' | 'hex' | 'legacy';

export interface AppState {
  shape: Shape;
  result: DKResult | null;
  sres: StripResult | null;
  running: boolean;
  srunning: boolean;
  mode: Mode;
  tab: InputTab;
  paper: PaperKind;
  maxCandidates: number;
  foldIn: boolean;
  stripW: number;
  stripTrials: number;
  stripMaxRows: number;
  stripSquare: boolean;
  log: string;
}

declare global {
  interface Window {
    OriVers: OriVersLib;
  }
}

export interface OriVersLib {
  solveShape: (T: Ring[], holes: Ring[], opts: {
    cap: boolean;
    paper: string;
    maxCandidates: number;
    foldIn: boolean;
    onProgress?: (x: LogEntry) => void;
  }) => { ok: boolean; model?: unknown; [k: string]: unknown };
  stripMethod: (T: Ring[], holes: Ring[], opt: unknown) => StripResult;
  signedArea: (P: Ring) => number;
  strip: {
    squareCP: (closedCP: number[][], m: number, limit: number) => { L: number; segs: number[][]; truncated?: boolean };
  };
  [k: string]: unknown;
}
