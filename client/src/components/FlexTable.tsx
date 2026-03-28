import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useNetworkStore, type UnitSystem } from '@/lib/store';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { X, Filter, Check, Plus, Trash2 } from 'lucide-react';

interface FlexTableProps {
  open: boolean;
  onClose: () => void;
}

const CACHEABLE_FIELDS = new Set([
  'length', 'diameter', 'elevation', 'reservoirElevation',
  'tankTop', 'tankBottom', 'initialWaterLevel', 'riserDiameter',
  'riserTop', 'distance', 'celerity', 'area', 'pipeWT', 'pipeE',
]);

function buildCacheUpdate(
  existingCache: Record<string, any>,
  currentUnit: UnitSystem,
  key: string,
  numericValue: number
): Record<string, any> {
  const otherUnit: UnitSystem = currentUnit === 'FPS' ? 'SI' : 'FPS';
  return {
    ...existingCache,
    [currentUnit]: { ...(existingCache[currentUnit] || {}), [key]: numericValue },
    [otherUnit]: existingCache[otherUnit]
      ? { ...existingCache[otherUnit], [key]: undefined }
      : existingCache[otherUnit],
  };
}

type FilterKey =
  | 'all' | 'pipe' | 'conduit' | 'dummy'
  | 'node' | 'reservoir' | 'junction' | 'surgeTank' | 'flowBoundary';

interface UnifiedRow {
  id: string;
  kind: 'edge' | 'node';
  subType: string;
  data: Record<string, any>;
}

const NODE_TYPE_LABEL: Record<string, string> = {
  reservoir: 'Reservoir', node: 'Node', junction: 'Junction',
  surgeTank: 'Surge Tank', flowBoundary: 'Flow BC',
  conduit: 'Conduit', dummy: 'Dummy Pipe',
};
const TYPE_BADGE: Record<string, string> = {
  reservoir:    'bg-blue-100 text-blue-700 border-blue-200',
  node:         'bg-slate-100 text-slate-600 border-slate-200',
  junction:     'bg-red-100 text-red-700 border-red-200',
  surgeTank:    'bg-orange-100 text-orange-700 border-orange-200',
  flowBoundary: 'bg-green-100 text-green-700 border-green-200',
  conduit:      'bg-indigo-100 text-indigo-700 border-indigo-200',
  dummy:        'bg-purple-100 text-purple-700 border-purple-200',
};

const FILTER_CHIPS: { key: FilterKey; label: string }[] = [
  { key: 'all',         label: 'All'        },
  { key: 'pipe',        label: 'Pipe'       },
  { key: 'conduit',     label: 'Conduit'    },
  { key: 'dummy',       label: 'Dummy Pipe' },
  { key: 'node',        label: 'Node'       },
  { key: 'reservoir',   label: 'Reservoir'  },
  { key: 'junction',    label: 'Junction'   },
  { key: 'surgeTank',   label: 'Surge Tank' },
  { key: 'flowBoundary',label: 'Flow BC'    },
];

function matchesFilter(row: UnifiedRow, filter: FilterKey): boolean {
  if (filter === 'all') return true;
  if (filter === 'pipe') return row.kind === 'edge';
  if (filter === 'node') return row.kind === 'node';
  return row.subType === filter;
}

type ColKey = string;

const COLS: Record<FilterKey, ColKey[]> = {
  all:         ['rowNum','type','label','nodeNum','diameter','length','celerity','friction','elevation','comment'],
  pipe:        ['rowNum','label','pipeType','diameter','length','celerity','friction','segments','comment'],
  conduit:     ['rowNum','label','length','diameter','celerity','friction','manningsN','segments','inclSegments',
                 'hasAddedLoss','cplus','cminus','pipeE','pipeWT','variable','distance','area','comment'],
  dummy:       ['rowNum','label','diameter','hasAddedLoss','cplus','cminus','comment'],
  node:        ['rowNum','type','label','nodeNum','elevation','comment'],
  reservoir:   ['rowNum','label','nodeNum','elevation','mode','resElev','hSchedNum','thPairs','comment'],
  junction:    ['rowNum','label','nodeNum','elevation','comment'],
  surgeTank:   ['rowNum','label','nodeNum','elevation','stType','tankTop','tankBot',
                 'initWaterLevel','riserDiam','riserTop','hasShape','diameter',
                 'celerity','friction','hasAddedLoss','cplus','cminus','shapePairs','comment'],
  flowBoundary:['rowNum','label','nodeNum','schedNum','qSchedPairs','comment'],
};

// ─── Pairs editor state ───────────────────────────────────────────────────────
interface PairsEditorState {
  open: boolean;
  rowId: string;
  rowKind: 'node' | 'edge';
  pairsType: 'qSchedule' | 'hSchedule';
  scheduleNumber?: number;
}

// ─── Cell components ──────────────────────────────────────────────────────────

function NACell({ minW = 'min-w-[80px]' }: { minW?: string }) {
  return (
    <td className={cn('border-r border-slate-200 px-2 py-[7px] bg-slate-50/60', minW)}>
      <span className="text-[10px] text-slate-300 italic select-none">NA</span>
    </td>
  );
}

interface EditableCellProps {
  value: string | number | undefined;
  type?: 'text' | 'number';
  onChange?: (val: string) => void;
  readOnly?: boolean;
  dimmed?: boolean;
  testId?: string;
  minW?: string;
}

function EditableCell({ value, type = 'text', onChange, readOnly, dimmed, testId, minW = 'min-w-[80px]' }: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [localVal, setLocalVal] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const display = value === undefined || value === null ? '' : String(value);

  // Show NA for dimmed/read-only cells with no value
  const isNA = dimmed && (display === '' || display === undefined);

  if (isNA && !editing) {
    return <NACell minW={minW} />;
  }

  const startEdit = () => {
    if (readOnly || !onChange) return;
    setLocalVal(display);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };
  const commit = () => {
    setEditing(false);
    if (onChange && localVal !== display) onChange(localVal);
  };

  return (
    <td
      className={cn(
        'border-r border-slate-200 relative',
        minW,
        !readOnly && onChange ? 'cursor-text hover:bg-blue-50/50' : 'cursor-default',
        dimmed && 'bg-slate-50 opacity-40'
      )}
      onClick={startEdit}
    >
      {editing ? (
        <input
          ref={inputRef}
          data-testid={testId}
          className="w-full h-[30px] px-2 text-xs border-0 outline-none ring-1 ring-blue-500 ring-inset bg-white"
          type={type === 'number' ? 'number' : 'text'}
          step="any"
          value={localVal}
          onChange={e => setLocalVal(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
        />
      ) : (
        <span className="block px-2 py-[7px] text-xs truncate">{display}</span>
      )}
    </td>
  );
}

interface SelectCellProps {
  value: string;
  options: { label: string; value: string }[];
  onChange?: (val: string) => void;
  dimmed?: boolean;
  testId?: string;
  minW?: string;
}

function SelectCell({ value, options, onChange, dimmed, testId, minW = 'min-w-[110px]' }: SelectCellProps) {
  return (
    <td className={cn('border-r border-slate-200 p-0', minW, dimmed && 'opacity-40 bg-slate-50')}>
      <Select value={value || options[0]?.value} onValueChange={onChange}>
        <SelectTrigger
          data-testid={testId}
          disabled={!onChange}
          className="h-[30px] border-0 rounded-none bg-transparent text-xs focus:ring-1 focus:ring-blue-400 focus:ring-inset w-full px-2"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </td>
  );
}

interface BoolCellProps {
  value: boolean;
  onChange?: (val: boolean) => void;
  trueLabel?: string;
  falseLabel?: string;
  dimmed?: boolean;
  testId?: string;
}

function BoolCell({ value, onChange, trueLabel = 'Yes', falseLabel = 'No', dimmed, testId }: BoolCellProps) {
  return (
    <td
      className={cn(
        'border-r border-slate-200 px-2 py-[7px] min-w-[64px]',
        onChange ? 'cursor-pointer hover:bg-blue-50/50' : 'cursor-default',
        dimmed && 'opacity-40 bg-slate-50'
      )}
      onClick={() => onChange?.(!value)}
      data-testid={testId}
    >
      {value ? (
        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600">
          <Check className="h-3 w-3" />{trueLabel}
        </span>
      ) : (
        <span className="text-[10px] text-slate-400">{falseLabel}</span>
      )}
    </td>
  );
}

function SummaryCell({ count, label }: { count: number; label: string }) {
  return (
    <td className="border-r border-slate-200 px-2 py-[7px] min-w-[80px] cursor-default">
      {count > 0
        ? <span className="text-[10px] text-blue-600 font-medium">{count} {label}{count !== 1 ? 's' : ''}</span>
        : <span className="text-[10px] text-slate-300">—</span>
      }
    </td>
  );
}

// ─── Pairs Preview Cell ───────────────────────────────────────────────────────
interface PairPreview {
  time: number | string;
  value: number | string;
}

function PairsPreviewCell({
  pairs,
  onEdit,
  applicable = true,
}: {
  pairs: PairPreview[];
  onEdit: () => void;
  applicable?: boolean;
}) {
  if (!applicable) {
    return <NACell minW="min-w-[130px]" />;
  }

  const preview = pairs.slice(0, 2);
  const extra = pairs.length - 2;

  return (
    <td className="border-r border-slate-200 px-2 py-[6px] min-w-[130px]">
      <div className="flex items-center gap-1 flex-wrap">
        {pairs.length === 0 ? (
          <button
            className="text-[10px] text-blue-500 hover:text-blue-700 hover:underline font-medium"
            onClick={e => { e.stopPropagation(); onEdit(); }}
            data-testid="pairs-add"
          >
            + Add pairs
          </button>
        ) : (
          <>
            {preview.map((p, i) => (
              <span
                key={i}
                className="text-[10px] text-slate-600 bg-slate-100 rounded px-1 py-0.5 whitespace-nowrap font-mono"
              >
                {p.time},{String(p.value).substring(0, 7)}
              </span>
            ))}
            <button
              className="text-[10px] text-blue-600 hover:text-blue-800 hover:underline font-medium whitespace-nowrap"
              onClick={e => { e.stopPropagation(); onEdit(); }}
              data-testid="pairs-viewmore"
            >
              {extra > 0 ? `+${extra} more` : 'Edit'}
            </button>
          </>
        )}
      </div>
    </td>
  );
}

// ─── Pairs Editor Modal ───────────────────────────────────────────────────────
interface PairRow {
  time: string;
  value: string;
}

interface PairsEditorModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  timeLabel: string;
  valueLabel: string;
  initialPairs: PairRow[];
  onSave: (pairs: PairRow[]) => void;
}

function PairsEditorModal({
  open, onClose, title, timeLabel, valueLabel, initialPairs, onSave,
}: PairsEditorModalProps) {
  const [rows, setRows] = useState<PairRow[]>([]);

  useEffect(() => {
    if (open) setRows(initialPairs.map(p => ({ ...p })));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (idx: number, field: 'time' | 'value', val: string) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: val } : r));
  };
  const handleAdd = () => setRows(prev => [...prev, { time: '0', value: '0' }]);
  const handleDelete = (idx: number) => setRows(prev => prev.filter((_, i) => i !== idx));
  const handleSave = () => { onSave(rows); onClose(); };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent
        className="max-w-sm w-full z-[300] flex flex-col gap-0 p-0 overflow-hidden"
        data-testid="pairs-editor-modal"
      >
        <DialogHeader className="px-4 py-3 border-b bg-white">
          <DialogTitle className="text-sm font-bold text-slate-800">{title}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col overflow-y-auto max-h-72 px-4 py-3 gap-1.5">
          {/* Column headers */}
          <div className="grid grid-cols-[1fr_1fr_28px] gap-2 text-[11px] font-semibold text-slate-500 pb-1">
            <span>Time (T)</span>
            <span>{valueLabel}</span>
            <span />
          </div>

          {rows.length === 0 && (
            <p className="text-[11px] text-slate-400 text-center py-6 italic">No pairs yet. Click "+ Add Point" below.</p>
          )}

          {rows.map((row, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_1fr_28px] gap-2 items-center">
              <input
                data-testid={`pair-time-${idx}`}
                className="border border-slate-200 rounded px-2 h-7 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                type="number" step="any"
                value={row.time}
                onChange={e => handleChange(idx, 'time', e.target.value)}
              />
              <input
                data-testid={`pair-value-${idx}`}
                className="border border-slate-200 rounded px-2 h-7 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                type="number" step="any"
                value={row.value}
                onChange={e => handleChange(idx, 'value', e.target.value)}
              />
              <button
                data-testid={`pair-delete-${idx}`}
                className="text-red-400 hover:text-red-600 flex items-center justify-center"
                onClick={() => handleDelete(idx)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t bg-slate-50">
          <Button
            variant="outline" size="sm"
            className="h-7 text-xs gap-1"
            onClick={handleAdd}
            data-testid="pairs-add-point"
          >
            <Plus className="h-3.5 w-3.5" /> Add Point
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onClose} data-testid="pairs-cancel">
              Cancel
            </Button>
            <Button size="sm" className="h-7 text-xs bg-[#1a73e8] hover:bg-[#1557b0]" onClick={handleSave} data-testid="pairs-save">
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Column header config ────────────────────────────────────────────────────
function ColHeader({ col, unit }: { col: ColKey; unit: UnitSystem }) {
  const L = unit === 'FPS' ? 'ft' : 'm';
  const V = unit === 'FPS' ? 'ft/s' : 'm/s';
  const A = unit === 'FPS' ? 'ft²' : 'm²';
  const P = unit === 'FPS' ? 'psi' : 'Pa';

  const labels: Record<string, string> = {
    rowNum: '#', type: 'Type', label: 'Label', pipeType: 'Pipe Type',
    nodeNum: 'Node #', diameter: `Diameter (${L})`, length: `Length (${L})`,
    celerity: `Wave Speed (${V})`, friction: 'Friction', segments: 'Segments',
    inclSegments: 'Incl. in INP', hasAddedLoss: 'Added Loss',
    cplus: 'CPLUS', cminus: 'CMINUS',
    pipeE: `E (${P})`, pipeWT: `WT (${L})`,
    manningsN: "Manning's n", variable: 'VARIABLE',
    distance: `Distance (${L})`, area: `Area (${A})`,
    elevation: `Elevation (${L})`, resElev: `Res. Elev. (${L})`,
    mode: 'BC Mode', hSchedNum: 'H Sched #', thPairs: 'T/H Pairs',
    stType: 'Tank Type', tankTop: `Top Elev. (${L})`, tankBot: `Bot. Elev. (${L})`,
    initWaterLevel: `HTANK (${L})`, riserDiam: `Riser Diam (${L})`,
    riserTop: `Riser Top (${L})`, hasShape: 'Use SHAPE', shapePairs: 'Shape Pairs',
    schedNum: 'Q Sched #', qSchedPairs: 'Q Schedule',
    comment: 'Comment',
  };
  return (
    <th className="border-r border-blue-400 px-2 py-2 text-left font-semibold text-white whitespace-nowrap text-xs select-none">
      {labels[col] ?? col}
    </th>
  );
}

// ─── Row cell renderer ────────────────────────────────────────────────────────
function RowCells({
  col, row, idx, unit, changeEdge, changeNode, hSchedules, onOpenPairsEditor,
}: {
  col: ColKey;
  row: UnifiedRow;
  idx: number;
  unit: UnitSystem;
  changeEdge: (f: string, v: string) => void;
  changeNode: (f: string, v: string) => void;
  hSchedules: any[];
  onOpenPairsEditor: (rowId: string, rowKind: 'node' | 'edge', pairsType: 'qSchedule' | 'hSchedule', scheduleNumber?: number) => void;
}) {
  const d = row.data;
  const isEdge = row.kind === 'edge';
  const isDummy = row.subType === 'dummy';
  const isConduit = row.subType === 'conduit';
  const isRes = row.subType === 'reservoir';
  const isSurge = row.subType === 'surgeTank';
  const isFlow = row.subType === 'flowBoundary';

  const change = isEdge ? changeEdge : changeNode;
  const fmt = (v: any) => (v === undefined || v === null || v === '') ? '' : String(parseFloat(Number(v).toFixed(8)));

  const hSchedNum = d.hScheduleNumber || 1;
  const hSched = hSchedules.find((s: any) => s.number === hSchedNum);
  const thPairs: PairPreview[] = (hSched?.points || []).map((p: any) => ({ time: p.time, value: p.head }));
  const qPairs: PairPreview[] = (d.schedulePoints as any[] || []).map((p: any) => ({ time: p.time, value: p.flow }));
  const shapePairCount = (d.shape as any[] || []).length;

  switch (col) {
    case 'rowNum': return (
      <td key={col} className="border-r border-slate-200 px-2 py-[7px] text-slate-400 text-center text-xs w-9 select-none">{idx + 1}</td>
    );
    case 'type': return (
      <td key={col} className="border-r border-slate-200 px-2 py-1 min-w-[100px]">
        <span className={cn('inline-block px-1.5 py-0.5 rounded border text-[10px] font-semibold whitespace-nowrap', TYPE_BADGE[row.subType] || 'bg-slate-100 text-slate-600 border-slate-200')}>
          {NODE_TYPE_LABEL[row.subType] || row.subType}
        </span>
      </td>
    );
    case 'label': return (
      <EditableCell key={col} value={d.label} onChange={v => change('label', v)} testId={`cell-label-${row.id}`} />
    );
    case 'pipeType': return (
      <SelectCell key={col} value={d.type || 'conduit'} options={[{label:'Conduit',value:'conduit'},{label:'Dummy Pipe',value:'dummy'}]}
        onChange={isEdge ? v => changeEdge('type', v) : undefined} testId={`cell-ptype-${row.id}`} />
    );
    case 'nodeNum': return (
      <EditableCell key={col} value={!isEdge ? (d.nodeNumber ?? '') : ''} type="number"
        readOnly={isEdge} dimmed={isEdge} onChange={v => changeNode('nodeNumber', v)} testId={`cell-nodenum-${row.id}`} />
    );
    case 'diameter': return (
      <EditableCell key={col} value={fmt(d.diameter)} type="number"
        readOnly={!isEdge && !isSurge} dimmed={!isEdge && !isSurge && !isConduit && !isDummy}
        onChange={v => change('diameter', v)} testId={`cell-diameter-${row.id}`} />
    );
    case 'length': return (
      <EditableCell key={col} value={isEdge && !isDummy ? fmt(d.length) : ''} type="number"
        readOnly={!isEdge || isDummy} dimmed={!isEdge || isDummy}
        onChange={v => changeEdge('length', v)} testId={`cell-length-${row.id}`} />
    );
    case 'celerity': return (
      <EditableCell key={col} value={fmt(d.celerity)} type="number"
        readOnly={!isEdge && !isSurge} dimmed={!isEdge && !isSurge}
        onChange={v => change('celerity', v)} testId={`cell-celerity-${row.id}`} />
    );
    case 'friction': return (
      <EditableCell key={col} value={fmt(d.friction)} type="number"
        readOnly={!isEdge && !isSurge} dimmed={!isEdge && !isSurge}
        onChange={v => change('friction', v)} testId={`cell-friction-${row.id}`} />
    );
    case 'manningsN': return (
      <EditableCell key={col} value={d.manningsN ?? ''} type="number"
        readOnly={!isConduit} dimmed={!isConduit}
        onChange={v => changeEdge('manningsN', v)} testId={`cell-manningsn-${row.id}`} />
    );
    case 'segments': return (
      <EditableCell key={col} value={isEdge && !isDummy ? fmt(d.numSegments) : ''} type="number"
        readOnly={!isEdge || isDummy} dimmed={!isEdge || isDummy}
        onChange={v => changeEdge('numSegments', v)} testId={`cell-segments-${row.id}`} />
    );
    case 'inclSegments': return (
      <BoolCell key={col} value={d.includeNumSegments !== false} trueLabel="Yes" falseLabel="No"
        dimmed={!isConduit} onChange={isConduit ? v => changeEdge('includeNumSegments', String(v)) : undefined} testId={`cell-inclseg-${row.id}`} />
    );
    case 'hasAddedLoss': return (
      <BoolCell key={col} value={!!d.hasAddedLoss} trueLabel="Yes" falseLabel="No"
        onChange={v => change('hasAddedLoss', String(v))} testId={`cell-addedloss-${row.id}`} />
    );
    case 'cplus': return (
      <EditableCell key={col} value={d.cplus ?? ''} type="number"
        readOnly={!d.hasAddedLoss} dimmed={!d.hasAddedLoss}
        onChange={v => change('cplus', v)} testId={`cell-cplus-${row.id}`} />
    );
    case 'cminus': return (
      <EditableCell key={col} value={d.cminus ?? ''} type="number"
        readOnly={!d.hasAddedLoss} dimmed={!d.hasAddedLoss}
        onChange={v => change('cminus', v)} testId={`cell-cminus-${row.id}`} />
    );
    case 'pipeE': return (
      <EditableCell key={col} value={d.pipeE ?? ''} type="number"
        readOnly={!isConduit} dimmed={!isConduit}
        onChange={v => changeEdge('pipeE', v)} testId={`cell-pipee-${row.id}`} />
    );
    case 'pipeWT': return (
      <EditableCell key={col} value={d.pipeWT ?? ''} type="number"
        readOnly={!isConduit} dimmed={!isConduit}
        onChange={v => changeEdge('pipeWT', v)} testId={`cell-pipewt-${row.id}`} />
    );
    case 'variable': return (
      <BoolCell key={col} value={!!d.variable} trueLabel="Yes" falseLabel="No"
        dimmed={!isConduit} onChange={isConduit ? v => changeEdge('variable', String(v)) : undefined} testId={`cell-variable-${row.id}`} />
    );
    case 'distance': return (
      <EditableCell key={col} value={d.distance ?? ''} type="number"
        readOnly={!d.variable} dimmed={!d.variable}
        onChange={v => changeEdge('distance', v)} testId={`cell-distance-${row.id}`} />
    );
    case 'area': return (
      <EditableCell key={col} value={d.area ?? ''} type="number"
        readOnly={!d.variable} dimmed={!d.variable}
        onChange={v => changeEdge('area', v)} testId={`cell-area-${row.id}`} />
    );
    case 'elevation': return (
      <EditableCell key={col} value={!isFlow ? fmt(d.elevation) : ''} type="number"
        readOnly={isEdge || isFlow} dimmed={isEdge || isFlow}
        onChange={v => changeNode('elevation', v)} testId={`cell-elev-${row.id}`} />
    );
    case 'mode': return (
      <SelectCell key={col} value={d.mode || 'fixed'} options={[{label:'Fixed Elevation',value:'fixed'},{label:'H Schedule',value:'schedule'}]}
        dimmed={!isRes} onChange={isRes ? v => changeNode('mode', v) : undefined} testId={`cell-mode-${row.id}`} />
    );
    case 'resElev': return (
      <EditableCell key={col} value={isRes && d.mode !== 'schedule' ? fmt(d.reservoirElevation) : ''} type="number"
        readOnly={!isRes || d.mode === 'schedule'} dimmed={!isRes || d.mode === 'schedule'}
        onChange={v => changeNode('reservoirElevation', v)} testId={`cell-reselev-${row.id}`} />
    );
    case 'hSchedNum': return (
      <EditableCell key={col} value={isRes && d.mode === 'schedule' ? (d.hScheduleNumber ?? 1) : ''} type="number"
        readOnly={!isRes || d.mode !== 'schedule'} dimmed={!isRes || d.mode !== 'schedule'}
        onChange={v => changeNode('hScheduleNumber', v)} testId={`cell-hschednum-${row.id}`} />
    );
    case 'thPairs': {
      const applicable = isRes && d.mode === 'schedule';
      return (
        <PairsPreviewCell
          key={col}
          pairs={applicable ? thPairs : []}
          applicable={applicable}
          onEdit={() => onOpenPairsEditor(row.id, row.kind, 'hSchedule', hSchedNum)}
        />
      );
    }
    case 'stType': return (
      <SelectCell key={col} value={d.type_st || 'SIMPLE'}
        options={[{label:'SIMPLE',value:'SIMPLE'},{label:'DIFFERENTIAL',value:'DIFFERENTIAL'},{label:'AIRTANK',value:'AIRTANK'}]}
        dimmed={!isSurge} onChange={isSurge ? v => changeNode('type_st', v) : undefined} testId={`cell-sttype-${row.id}`} />
    );
    case 'tankTop': return (
      <EditableCell key={col} value={isSurge ? fmt(d.tankTop) : ''} type="number"
        readOnly={!isSurge} dimmed={!isSurge}
        onChange={v => changeNode('tankTop', v)} testId={`cell-tanktop-${row.id}`} />
    );
    case 'tankBot': return (
      <EditableCell key={col} value={isSurge ? fmt(d.tankBottom) : ''} type="number"
        readOnly={!isSurge} dimmed={!isSurge}
        onChange={v => changeNode('tankBottom', v)} testId={`cell-tankbot-${row.id}`} />
    );
    case 'initWaterLevel': return (
      <EditableCell key={col} value={isSurge && (d.type_st === 'AIRTANK' || d.type_st === 'DIFFERENTIAL') ? fmt(d.initialWaterLevel) : ''} type="number"
        readOnly={!isSurge || (d.type_st !== 'AIRTANK' && d.type_st !== 'DIFFERENTIAL')}
        dimmed={!isSurge || (d.type_st !== 'AIRTANK' && d.type_st !== 'DIFFERENTIAL')}
        onChange={v => changeNode('initialWaterLevel', v)} testId={`cell-htank-${row.id}`} />
    );
    case 'riserDiam': return (
      <EditableCell key={col} value={isSurge && d.type_st === 'DIFFERENTIAL' ? fmt(d.riserDiameter) : ''} type="number"
        readOnly={!isSurge || d.type_st !== 'DIFFERENTIAL'} dimmed={!isSurge || d.type_st !== 'DIFFERENTIAL'}
        onChange={v => changeNode('riserDiameter', v)} testId={`cell-riserdiam-${row.id}`} />
    );
    case 'riserTop': return (
      <EditableCell key={col} value={isSurge && d.type_st === 'DIFFERENTIAL' ? fmt(d.riserTop) : ''} type="number"
        readOnly={!isSurge || d.type_st !== 'DIFFERENTIAL'} dimmed={!isSurge || d.type_st !== 'DIFFERENTIAL'}
        onChange={v => changeNode('riserTop', v)} testId={`cell-risertop-${row.id}`} />
    );
    case 'hasShape': return (
      <BoolCell key={col} value={!!d.hasShape} trueLabel="Yes" falseLabel="No"
        dimmed={!isSurge} onChange={isSurge ? v => changeNode('hasShape', String(v)) : undefined} testId={`cell-hasshape-${row.id}`} />
    );
    case 'shapePairs': return (
      <SummaryCell key={col} count={isSurge ? shapePairCount : 0} label="pair" />
    );
    case 'schedNum': return (
      <EditableCell key={col} value={isFlow ? (d.scheduleNumber ?? '') : ''} type="number"
        readOnly={!isFlow} dimmed={!isFlow}
        onChange={v => changeNode('scheduleNumber', v)} testId={`cell-schednum-${row.id}`} />
    );
    case 'qSchedPairs': return (
      <PairsPreviewCell
        key={col}
        pairs={isFlow ? qPairs : []}
        applicable={isFlow}
        onEdit={() => onOpenPairsEditor(row.id, row.kind, 'qSchedule')}
      />
    );
    case 'comment': return (
      <EditableCell key={col} value={d.comment ?? ''} onChange={v => change('comment', v)}
        testId={`cell-comment-${row.id}`} minW="min-w-[160px]" />
    );
    default: return <td key={col} className="border-r border-slate-200 px-2 py-[7px] text-xs text-slate-300">—</td>;
  }
}

// ─── Main table ───────────────────────────────────────────────────────────────
function UnifiedTable({
  rows, filter, unit, hSchedules,
  onChangeEdge, onChangeNode, onSelectEdge, onSelectNode, onOpenPairsEditor,
}: {
  rows: UnifiedRow[];
  filter: FilterKey;
  unit: UnitSystem;
  hSchedules: any[];
  onChangeEdge: (id: string, field: string, val: string, data: any) => void;
  onChangeNode: (id: string, field: string, val: string, data: any) => void;
  onSelectEdge: (id: string) => void;
  onSelectNode: (id: string) => void;
  onOpenPairsEditor: (rowId: string, rowKind: 'node' | 'edge', pairsType: 'qSchedule' | 'hSchedule', scheduleNumber?: number) => void;
}) {
  const cols = COLS[filter] ?? COLS.all;

  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center flex-1 text-slate-400 text-sm bg-white border border-slate-200 rounded">
        No elements match the selected filter.
      </div>
    );
  }

  return (
    <div className="overflow-auto flex-1 border border-slate-200 rounded bg-white shadow-sm">
      <table className="min-w-max w-full border-collapse text-xs">
        <thead className="sticky top-0 z-10 bg-[#1a73e8]">
          <tr>
            {cols.map(col => <ColHeader key={col} col={col} unit={unit} />)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const isEven = idx % 2 === 0;
            const changeEdge = (f: string, v: string) => onChangeEdge(row.id, f, v, row.data);
            const changeNode = (f: string, v: string) => onChangeNode(row.id, f, v, row.data);
            return (
              <tr
                key={row.id}
                data-testid={`row-${row.kind}-${row.id}`}
                className={cn(
                  'border-b border-slate-100 hover:bg-blue-50/30 transition-colors cursor-pointer',
                  isEven ? 'bg-white' : 'bg-slate-50/50'
                )}
                onClick={() => row.kind === 'edge' ? onSelectEdge(row.id) : onSelectNode(row.id)}
              >
                {cols.map(col => (
                  <RowCells
                    key={col} col={col} row={row} idx={idx} unit={unit}
                    changeEdge={changeEdge} changeNode={changeNode}
                    hSchedules={hSchedules}
                    onOpenPairsEditor={onOpenPairsEditor}
                  />
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── FlexTable (exported) ─────────────────────────────────────────────────────
export function FlexTable({ open, onClose }: FlexTableProps) {
  const {
    nodes, edges, globalUnit, setGlobalUnit,
    updateEdgeData, updateNodeData, selectElement,
    hSchedules, updateHSchedule, addHSchedule,
  } = useNetworkStore();
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [pairsEditor, setPairsEditor] = useState<PairsEditorState | null>(null);

  const allRows = useMemo<UnifiedRow[]>(() => {
    const nodeRows = new Map(nodes.map(n => [n.id, {
      id: n.id, kind: 'node' as const,
      subType: (n.data?.type as string) || (n.type as string) || 'node',
      data: (n.data || {}) as Record<string, any>,
    }]));
    const edgeRows = new Map(edges.map(e => [e.id, {
      id: e.id, kind: 'edge' as const,
      subType: (e.data?.type as string) || 'conduit',
      data: (e.data || {}) as Record<string, any>,
    }]));

    const visited = new Set<string>();
    const result: UnifiedRow[] = [];

    const pushNode = (r: UnifiedRow) => { if (!visited.has(r.id)) { visited.add(r.id); result.push(r); } };
    const pushEdge = (r: UnifiedRow) => { if (!visited.has(r.id)) { visited.add(r.id); result.push(r); } };

    const reservoirs = [...nodeRows.values()].filter(r => r.subType === 'reservoir');
    for (const res of reservoirs) {
      pushNode(res);
      for (const e of edges.filter(e => e.source === res.id)) {
        const er = edgeRows.get(e.id); if (er) pushEdge(er);
        const tr = nodeRows.get(e.target); if (tr) pushNode(tr);
      }
    }
    for (const e of edgeRows.values()) if (!visited.has(e.id)) { visited.add(e.id); result.push(e); }
    for (const n of nodeRows.values()) if (!visited.has(n.id)) { visited.add(n.id); result.push(n); }

    return result;
  }, [nodes, edges]);

  const filteredRows = useMemo(() => allRows.filter(r => matchesFilter(r, activeFilter)), [allRows, activeFilter]);

  const counts = useMemo(() => ({
    all:          allRows.length,
    pipe:         allRows.filter(r => r.kind === 'edge').length,
    conduit:      allRows.filter(r => r.subType === 'conduit').length,
    dummy:        allRows.filter(r => r.subType === 'dummy').length,
    node:         allRows.filter(r => r.kind === 'node').length,
    reservoir:    allRows.filter(r => r.subType === 'reservoir').length,
    junction:     allRows.filter(r => r.subType === 'junction').length,
    surgeTank:    allRows.filter(r => r.subType === 'surgeTank').length,
    flowBoundary: allRows.filter(r => r.subType === 'flowBoundary').length,
  }), [allRows]);

  const handleChangeEdge = useCallback((id: string, field: string, rawStr: string, currentData: any) => {
    const textFields = new Set(['label', 'comment', 'type']);
    const isText = textFields.has(field);
    let val: any;
    if (field === 'hasAddedLoss' || field === 'variable' || field === 'includeNumSegments') {
      val = rawStr === 'true';
    } else if (isText) {
      val = rawStr;
    } else {
      val = rawStr.trim() === '' ? rawStr : (parseFloat(rawStr) || 0);
    }
    const update: any = { [field]: val };
    if (typeof val === 'number' && CACHEABLE_FIELDS.has(field)) {
      const cache = (currentData?._unitCache as any) || {};
      const cu = (currentData?.unit as UnitSystem) || globalUnit;
      update._unitCache = buildCacheUpdate(cache, cu, field, val);
    }
    updateEdgeData(id, update);
  }, [globalUnit, updateEdgeData]);

  const handleChangeNode = useCallback((id: string, field: string, rawStr: string, currentData: any) => {
    const textFields = new Set(['label', 'comment', 'mode', 'type', 'type_st']);
    const boolFields = new Set(['hasAddedLoss', 'hasShape']);
    const isText = textFields.has(field);
    const isBool = boolFields.has(field);
    let val: any;
    if (isBool) {
      val = rawStr === 'true';
    } else if (isText) {
      val = rawStr;
    } else {
      val = rawStr.trim() === '' ? rawStr : (parseFloat(rawStr) || 0);
    }
    const update: any = { [field]: val };
    if (typeof val === 'number' && CACHEABLE_FIELDS.has(field)) {
      const cache = (currentData?._unitCache as any) || {};
      const cu = (currentData?.unit as UnitSystem) || globalUnit;
      update._unitCache = buildCacheUpdate(cache, cu, field, val);
    }
    updateNodeData(id, update);
  }, [globalUnit, updateNodeData]);

  const handleSelectEdge = useCallback((id: string) => selectElement(id, 'edge'), [selectElement]);
  const handleSelectNode = useCallback((id: string) => selectElement(id, 'node'), [selectElement]);

  const handleOpenPairsEditor = useCallback((
    rowId: string,
    rowKind: 'node' | 'edge',
    pairsType: 'qSchedule' | 'hSchedule',
    scheduleNumber?: number
  ) => {
    setPairsEditor({ open: true, rowId, rowKind, pairsType, scheduleNumber });
  }, []);

  // Build the initial pairs for the editor based on editor state
  const editorInitialPairs = useMemo((): PairRow[] => {
    if (!pairsEditor) return [];
    if (pairsEditor.pairsType === 'qSchedule') {
      const row = allRows.find(r => r.id === pairsEditor.rowId);
      const pts = (row?.data?.schedulePoints as any[]) || [];
      return pts.map((p: any) => ({ time: String(p.time ?? 0), value: String(p.flow ?? 0) }));
    } else {
      const schedNum = pairsEditor.scheduleNumber || 1;
      const sched = hSchedules?.find((s: any) => s.number === schedNum);
      const pts = sched?.points || [];
      return pts.map((p: any) => ({ time: String(p.time ?? 0), value: String(p.head ?? 0) }));
    }
  }, [pairsEditor, allRows, hSchedules]);

  const handleSavePairs = useCallback((rows: PairRow[]) => {
    if (!pairsEditor) return;
    if (pairsEditor.pairsType === 'qSchedule') {
      const schedulePoints = rows.map(r => ({
        time: parseFloat(r.time) || 0,
        flow: parseFloat(r.value) || 0,
      }));
      updateNodeData(pairsEditor.rowId, { schedulePoints });
    } else {
      const schedNum = pairsEditor.scheduleNumber || 1;
      const points = rows.map(r => ({
        time: parseFloat(r.time) || 0,
        head: parseFloat(r.value) || 0,
      }));
      // Ensure the schedule exists, then update
      addHSchedule(schedNum);
      updateHSchedule(schedNum, points);
    }
  }, [pairsEditor, updateNodeData, updateHSchedule, addHSchedule]);

  const visibleChips = FILTER_CHIPS.filter(c => counts[c.key as keyof typeof counts] > 0 || c.key === 'all');

  // Build editor title/labels
  const editorTitle = pairsEditor?.pairsType === 'qSchedule' ? 'Edit Q Schedule Points' : 'Edit T/H Pairs';
  const editorValueLabel = pairsEditor?.pairsType === 'qSchedule'
    ? `Flow (Q) (${globalUnit === 'FPS' ? 'ft³/s' : 'm³/s'})`
    : `Head (H) (${globalUnit === 'FPS' ? 'ft' : 'm'})`;

  return (
    <>
      <Dialog open={open} onOpenChange={v => !v && onClose()}>
        <DialogContent
          className="max-w-[96vw] w-[96vw] h-[92vh] flex flex-col p-0 gap-0 overflow-hidden"
          data-testid="flextable-dialog"
          hideCloseButton
        >
          {/* ── Header ── */}
          <DialogHeader className="px-5 py-2.5 border-b bg-white flex-none shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <DialogTitle className="text-sm font-bold text-slate-800">Flex Table</DialogTitle>
                <span className="text-xs text-slate-400">
                  {nodes.length} node{nodes.length !== 1 ? 's' : ''} · {edges.length} pipe{edges.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center border border-slate-200 rounded overflow-hidden text-xs h-7">
                  <button
                    data-testid="flextable-unit-si"
                    className={cn('px-3 h-full font-semibold transition-colors', globalUnit === 'SI' ? 'bg-[#1a73e8] text-white' : 'text-slate-600 hover:bg-slate-50')}
                    onClick={() => setGlobalUnit('SI')}
                  >SI</button>
                  <button
                    data-testid="flextable-unit-fps"
                    className={cn('px-3 h-full font-semibold transition-colors border-l border-slate-200', globalUnit === 'FPS' ? 'bg-[#1a73e8] text-white' : 'text-slate-600 hover:bg-slate-50')}
                    onClick={() => setGlobalUnit('FPS')}
                  >FPS</button>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={onClose} data-testid="flextable-close">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </DialogHeader>

          {/* ── Filter chips ── */}
          <div className="flex items-center gap-1.5 px-5 py-2 border-b bg-slate-50 flex-none flex-wrap">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0 mr-1" />
            {visibleChips.map(chip => {
              const active = activeFilter === chip.key;
              return (
                <button
                  key={chip.key}
                  data-testid={`filter-chip-${chip.key}`}
                  onClick={() => setActiveFilter(chip.key)}
                  className={cn(
                    'inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-medium transition-all',
                    active ? 'bg-[#1a73e8] text-white border-[#1a73e8]' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                  )}
                >
                  {chip.label}
                  <span className={cn(
                    'inline-flex items-center justify-center rounded-full text-[9px] font-bold min-w-[16px] h-4 px-1',
                    active ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500'
                  )}>
                    {counts[chip.key as keyof typeof counts]}
                  </span>
                </button>
              );
            })}
            {activeFilter !== 'all' && (
              <button className="text-[11px] text-slate-400 hover:text-slate-600 ml-1 underline" onClick={() => setActiveFilter('all')}>
                Clear
              </button>
            )}
          </div>

          {/* ── Table ── */}
          <div className="flex-1 overflow-hidden flex flex-col px-4 py-3 gap-2 bg-slate-50/70">
            <UnifiedTable
              rows={filteredRows} filter={activeFilter} unit={globalUnit} hSchedules={hSchedules ?? []}
              onChangeEdge={handleChangeEdge} onChangeNode={handleChangeNode}
              onSelectEdge={handleSelectEdge} onSelectNode={handleSelectNode}
              onOpenPairsEditor={handleOpenPairsEditor}
            />
            <p className="text-[10px] text-slate-400 flex-none">
              Showing {filteredRows.length} of {allRows.length} elements ·
              Click any white cell to edit · Dimmed cells are read-only for that element type ·
              Array fields (T/H pairs, shape, Q-schedule) — edit via the Properties Panel ·
              SI/FPS toggle applies globally
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pairs editor — rendered outside the main Dialog to avoid stacking issues */}
      {pairsEditor && (
        <PairsEditorModal
          open={pairsEditor.open}
          onClose={() => setPairsEditor(null)}
          title={editorTitle}
          timeLabel="Time (T)"
          valueLabel={editorValueLabel}
          initialPairs={editorInitialPairs}
          onSave={handleSavePairs}
        />
      )}
    </>
  );
}
