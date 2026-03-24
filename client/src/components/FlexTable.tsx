import { useState, useCallback, useRef, useMemo } from 'react';
import { useNetworkStore, type UnitSystem } from '@/lib/store';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { X, Filter } from 'lucide-react';

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

// ─── Filter types ────────────────────────────────────────────────────────────
type FilterKey =
  | 'all'
  | 'pipe'
  | 'conduit'
  | 'dummy'
  | 'node'
  | 'reservoir'
  | 'junction'
  | 'surgeTank'
  | 'flowBoundary';

// ─── Unified row ─────────────────────────────────────────────────────────────
type RowKind = 'edge' | 'node';

interface UnifiedRow {
  id: string;
  kind: RowKind;
  subType: string;   // conduit | dummy | reservoir | node | junction | surgeTank | flowBoundary
  data: Record<string, any>;
}

// ─── Type display helpers ─────────────────────────────────────────────────────
const NODE_TYPE_LABEL: Record<string, string> = {
  reservoir: 'Reservoir',
  node: 'Node',
  junction: 'Junction',
  surgeTank: 'Surge Tank',
  flowBoundary: 'Flow BC',
  conduit: 'Conduit',
  dummy: 'Dummy Pipe',
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

// ─── Filter chip definitions ──────────────────────────────────────────────────
const FILTER_CHIPS: { key: FilterKey; label: string; color?: string }[] = [
  { key: 'all',         label: 'All' },
  { key: 'pipe',        label: 'Pipe',        color: 'indigo' },
  { key: 'conduit',     label: 'Conduit',     color: 'indigo' },
  { key: 'dummy',       label: 'Dummy Pipe',  color: 'purple' },
  { key: 'node',        label: 'Node',        color: 'slate' },
  { key: 'reservoir',   label: 'Reservoir',   color: 'blue' },
  { key: 'junction',    label: 'Junction',    color: 'red' },
  { key: 'surgeTank',   label: 'Surge Tank',  color: 'orange' },
  { key: 'flowBoundary',label: 'Flow BC',     color: 'green' },
];

function matchesFilter(row: UnifiedRow, filter: FilterKey): boolean {
  if (filter === 'all') return true;
  if (filter === 'pipe') return row.kind === 'edge';
  if (filter === 'node') return row.kind === 'node';
  return row.subType === filter;
}

// ─── Column visibility per filter ────────────────────────────────────────────
function getVisibleColumns(filter: FilterKey): Set<string> {
  const pipeOnly = new Set(['pipeType', 'length', 'celerity', 'friction', 'segments']);
  const nodeOnly = new Set(['nodeNum', 'elevation', 'resElev', 'tankTop', 'tankBot', 'diameter', 'nodeSpeed', 'nodeFriction', 'sched']);

  if (filter === 'all') {
    // Show a compact unified set
    return new Set(['rowNum', 'type', 'label', 'nodeNum', 'diameter', 'length', 'celerity', 'friction', 'elevation', 'comment']);
  }
  if (filter === 'pipe') {
    return new Set(['rowNum', 'label', 'pipeType', 'diameter', 'length', 'celerity', 'friction', 'segments', 'comment']);
  }
  if (filter === 'conduit') {
    return new Set(['rowNum', 'label', 'diameter', 'length', 'celerity', 'friction', 'segments', 'comment']);
  }
  if (filter === 'dummy') {
    return new Set(['rowNum', 'label', 'diameter', 'comment']);
  }
  if (filter === 'node') {
    return new Set(['rowNum', 'type', 'label', 'nodeNum', 'elevation', 'resElev', 'tankTop', 'tankBot', 'diameter', 'nodeSpeed', 'nodeFriction', 'sched', 'comment']);
  }
  if (filter === 'reservoir') {
    return new Set(['rowNum', 'label', 'nodeNum', 'elevation', 'resElev', 'sched', 'comment']);
  }
  if (filter === 'junction') {
    return new Set(['rowNum', 'label', 'nodeNum', 'elevation', 'comment']);
  }
  if (filter === 'surgeTank') {
    return new Set(['rowNum', 'label', 'nodeNum', 'elevation', 'tankTop', 'tankBot', 'diameter', 'nodeSpeed', 'nodeFriction', 'comment']);
  }
  if (filter === 'flowBoundary') {
    return new Set(['rowNum', 'label', 'nodeNum', 'sched', 'comment']);
  }
  return new Set(['rowNum', 'type', 'label', 'nodeNum', 'diameter', 'length', 'celerity', 'friction', 'elevation', 'comment']);
}

// ─── Editable cell ────────────────────────────────────────────────────────────
interface EditableCellProps {
  value: string | number | undefined;
  type?: 'text' | 'number' | 'select';
  options?: { label: string; value: string }[];
  onChange?: (val: string) => void;
  readOnly?: boolean;
  dimmed?: boolean;
  testId?: string;
}

function EditableCell({ value, type = 'text', options, onChange, readOnly, dimmed, testId }: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [localVal, setLocalVal] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const display = value === undefined || value === null ? '' : String(value);

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

  if (type === 'select' && options && onChange) {
    return (
      <td className="border-r border-slate-200 p-0 min-w-[100px]">
        <Select value={display || options[0]?.value} onValueChange={onChange}>
          <SelectTrigger
            data-testid={testId}
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

  const isReadOnly = readOnly || !onChange;

  return (
    <td
      className={cn(
        'border-r border-slate-200 relative min-w-[80px]',
        isReadOnly ? 'cursor-default' : 'cursor-text hover:bg-blue-50/50',
        dimmed && 'opacity-30'
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

// ─── Main unified table ───────────────────────────────────────────────────────
function UnifiedTable({
  rows,
  filter,
  unit,
  onChangeEdge,
  onChangeNode,
  onSelectEdge,
  onSelectNode,
}: {
  rows: UnifiedRow[];
  filter: FilterKey;
  unit: UnitSystem;
  onChangeEdge: (id: string, field: string, val: string, data: any) => void;
  onChangeNode: (id: string, field: string, val: string, data: any) => void;
  onSelectEdge: (id: string) => void;
  onSelectNode: (id: string) => void;
}) {
  const cols = getVisibleColumns(filter);
  const lenUnit = unit === 'FPS' ? 'ft' : 'm';
  const velUnit = unit === 'FPS' ? 'ft/s' : 'm/s';

  const thClass = 'border-r border-blue-400 px-2 py-2 text-left font-semibold text-white whitespace-nowrap select-none';

  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center flex-1 text-slate-400 text-sm">
        No elements match the selected filter.
      </div>
    );
  }

  return (
    <div className="overflow-auto flex-1 border border-slate-200 rounded bg-white">
      <table className="min-w-max w-full border-collapse text-xs">
        <thead className="sticky top-0 z-10 bg-[#1a73e8] shadow-sm">
          <tr>
            {cols.has('rowNum')      && <th className={cn(thClass, 'w-9 text-center')}>#</th>}
            {cols.has('type')        && <th className={cn(thClass, 'w-28')}>Type</th>}
            {cols.has('label')       && <th className={cn(thClass, 'w-24')}>Label</th>}
            {cols.has('pipeType')    && <th className={cn(thClass, 'w-28')}>Pipe Type</th>}
            {cols.has('nodeNum')     && <th className={cn(thClass, 'w-20')}>Node #</th>}
            {cols.has('diameter')    && <th className={cn(thClass, 'w-28')}>Diameter ({lenUnit})</th>}
            {cols.has('length')      && <th className={cn(thClass, 'w-28')}>Length ({lenUnit})</th>}
            {cols.has('celerity')    && <th className={cn(thClass, 'w-32')}>Wave Speed ({velUnit})</th>}
            {cols.has('nodeSpeed')   && <th className={cn(thClass, 'w-32')}>Wave Speed ({velUnit})</th>}
            {cols.has('friction')    && <th className={cn(thClass, 'w-24')}>Friction</th>}
            {cols.has('nodeFriction')&& <th className={cn(thClass, 'w-24')}>Friction</th>}
            {cols.has('segments')    && <th className={cn(thClass, 'w-24')}>Segments</th>}
            {cols.has('elevation')   && <th className={cn(thClass, 'w-28')}>Elevation ({lenUnit})</th>}
            {cols.has('resElev')     && <th className={cn(thClass, 'w-32')}>Res. Elev. ({lenUnit})</th>}
            {cols.has('tankTop')     && <th className={cn(thClass, 'w-28')}>Tank Top ({lenUnit})</th>}
            {cols.has('tankBot')     && <th className={cn(thClass, 'w-28')}>Tank Bot. ({lenUnit})</th>}
            {cols.has('sched')       && <th className={cn(thClass, 'w-24')}>Sched #</th>}
            {cols.has('comment')     && <th className="border-r border-blue-400 px-2 py-2 text-left font-semibold text-white min-w-[160px]">Comment</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const d = row.data;
            const isEdge = row.kind === 'edge';
            const isEven = idx % 2 === 0;
            const isDummy = row.subType === 'dummy';
            const isRes = row.subType === 'reservoir';
            const isSurge = row.subType === 'surgeTank';
            const isFlow = row.subType === 'flowBoundary';

            const tdBase = cn(
              'border-b border-slate-100 transition-colors cursor-pointer',
              isEven ? 'bg-white' : 'bg-slate-50/50',
              'hover:bg-blue-50/40'
            );

            const handleClick = () => {
              if (isEdge) onSelectEdge(row.id);
              else onSelectNode(row.id);
            };

            const changeEdge = (field: string, val: string) => onChangeEdge(row.id, field, val, d);
            const changeNode = (field: string, val: string) => onChangeNode(row.id, field, val, d);

            return (
              <tr
                key={row.id}
                data-testid={`row-${row.kind}-${row.id}`}
                className={tdBase}
                onClick={handleClick}
              >
                {cols.has('rowNum') && (
                  <td className="border-r border-slate-200 px-2 py-[7px] text-slate-400 text-center text-xs select-none">{idx + 1}</td>
                )}

                {cols.has('type') && (
                  <td className="border-r border-slate-200 px-2 py-1">
                    <span className={cn(
                      'inline-block px-1.5 py-0.5 rounded border text-[10px] font-semibold whitespace-nowrap',
                      TYPE_BADGE[row.subType] || 'bg-slate-100 text-slate-600 border-slate-200'
                    )}>
                      {NODE_TYPE_LABEL[row.subType] || row.subType}
                    </span>
                  </td>
                )}

                {cols.has('label') && (
                  <EditableCell
                    value={d.label}
                    onChange={v => isEdge ? changeEdge('label', v) : changeNode('label', v)}
                    testId={`cell-label-${row.id}`}
                  />
                )}

                {cols.has('pipeType') && (
                  <EditableCell
                    type="select"
                    value={d.type || 'conduit'}
                    options={[
                      { label: 'Conduit', value: 'conduit' },
                      { label: 'Dummy Pipe', value: 'dummy' },
                    ]}
                    onChange={v => changeEdge('type', v)}
                    testId={`cell-pipetype-${row.id}`}
                  />
                )}

                {cols.has('nodeNum') && (
                  <EditableCell
                    type="number"
                    value={isEdge ? undefined : d.nodeNumber}
                    readOnly={isEdge}
                    onChange={v => changeNode('nodeNumber', v)}
                    dimmed={isEdge}
                    testId={`cell-nodenum-${row.id}`}
                  />
                )}

                {cols.has('diameter') && (
                  <EditableCell
                    type="number"
                    value={d.diameter ?? ''}
                    onChange={v => isEdge ? changeEdge('diameter', v) : (isSurge ? changeNode('diameter', v) : undefined)}
                    readOnly={!isEdge && !isSurge}
                    dimmed={!isEdge && !isSurge}
                    testId={`cell-diameter-${row.id}`}
                  />
                )}

                {cols.has('length') && (
                  <EditableCell
                    type="number"
                    value={isEdge && !isDummy ? (d.length ?? '') : undefined}
                    readOnly={!isEdge || isDummy}
                    onChange={v => changeEdge('length', v)}
                    dimmed={!isEdge || isDummy}
                    testId={`cell-length-${row.id}`}
                  />
                )}

                {cols.has('celerity') && (
                  <EditableCell
                    type="number"
                    value={isEdge ? (d.celerity ?? '') : undefined}
                    readOnly={!isEdge}
                    onChange={v => changeEdge('celerity', v)}
                    dimmed={!isEdge}
                    testId={`cell-celerity-${row.id}`}
                  />
                )}

                {cols.has('nodeSpeed') && (
                  <EditableCell
                    type="number"
                    value={isSurge ? (d.celerity ?? '') : undefined}
                    readOnly={!isSurge}
                    onChange={v => changeNode('celerity', v)}
                    dimmed={!isSurge}
                    testId={`cell-nodespeed-${row.id}`}
                  />
                )}

                {cols.has('friction') && (
                  <EditableCell
                    type="number"
                    value={isEdge ? (d.friction ?? '') : undefined}
                    readOnly={!isEdge}
                    onChange={v => changeEdge('friction', v)}
                    dimmed={!isEdge}
                    testId={`cell-friction-${row.id}`}
                  />
                )}

                {cols.has('nodeFriction') && (
                  <EditableCell
                    type="number"
                    value={isSurge ? (d.friction ?? '') : undefined}
                    readOnly={!isSurge}
                    onChange={v => changeNode('friction', v)}
                    dimmed={!isSurge}
                    testId={`cell-nodefriction-${row.id}`}
                  />
                )}

                {cols.has('segments') && (
                  <EditableCell
                    type="number"
                    value={isEdge && !isDummy ? (d.numSegments ?? '') : undefined}
                    readOnly={!isEdge || isDummy}
                    onChange={v => changeEdge('numSegments', v)}
                    dimmed={!isEdge || isDummy}
                    testId={`cell-segments-${row.id}`}
                  />
                )}

                {cols.has('elevation') && (
                  <EditableCell
                    type="number"
                    value={!isEdge && !isFlow ? (d.elevation ?? '') : undefined}
                    readOnly={isEdge || isFlow}
                    onChange={v => changeNode('elevation', v)}
                    dimmed={isEdge || isFlow}
                    testId={`cell-elevation-${row.id}`}
                  />
                )}

                {cols.has('resElev') && (
                  <EditableCell
                    type="number"
                    value={isRes ? (d.reservoirElevation ?? '') : undefined}
                    readOnly={!isRes}
                    onChange={v => changeNode('reservoirElevation', v)}
                    dimmed={!isRes}
                    testId={`cell-reselev-${row.id}`}
                  />
                )}

                {cols.has('tankTop') && (
                  <EditableCell
                    type="number"
                    value={isSurge ? (d.tankTop ?? '') : undefined}
                    readOnly={!isSurge}
                    onChange={v => changeNode('tankTop', v)}
                    dimmed={!isSurge}
                    testId={`cell-tanktop-${row.id}`}
                  />
                )}

                {cols.has('tankBot') && (
                  <EditableCell
                    type="number"
                    value={isSurge ? (d.tankBottom ?? '') : undefined}
                    readOnly={!isSurge}
                    onChange={v => changeNode('tankBottom', v)}
                    dimmed={!isSurge}
                    testId={`cell-tankbot-${row.id}`}
                  />
                )}

                {cols.has('sched') && (
                  <EditableCell
                    type="number"
                    value={
                      isFlow ? (d.scheduleNumber ?? '') :
                      isRes  ? (d.hScheduleNumber ?? '') :
                      undefined
                    }
                    readOnly={!isFlow && !isRes}
                    onChange={v => changeNode(isFlow ? 'scheduleNumber' : 'hScheduleNumber', v)}
                    dimmed={!isFlow && !isRes}
                    testId={`cell-sched-${row.id}`}
                  />
                )}

                {cols.has('comment') && (
                  <EditableCell
                    value={d.comment ?? ''}
                    onChange={v => isEdge ? changeEdge('comment', v) : changeNode('comment', v)}
                    testId={`cell-comment-${row.id}`}
                  />
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export function FlexTable({ open, onClose }: FlexTableProps) {
  const { nodes, edges, globalUnit, setGlobalUnit, updateEdgeData, updateNodeData, selectElement } = useNetworkStore();
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');

  // Build flat unified rows (nodes interleaved with edges in flow order)
  const allRows = useMemo<UnifiedRow[]>(() => {
    const nodeRows: UnifiedRow[] = nodes.map(n => ({
      id: n.id,
      kind: 'node',
      subType: (n.data?.type as string) || (n.type as string) || 'node',
      data: n.data as Record<string, any>,
    }));
    const edgeRows: UnifiedRow[] = edges.map(e => ({
      id: e.id,
      kind: 'edge',
      subType: (e.data?.type as string) || 'conduit',
      data: e.data as Record<string, any>,
    }));

    // Interleave: reservoirs → (conduit → next node) chain → then remaining
    const visited = new Set<string>();
    const result: UnifiedRow[] = [];

    // Start from reservoir nodes
    const reservoirs = nodeRows.filter(r => r.subType === 'reservoir');
    const edgeMap = new Map(edgeRows.map(e => [e.id, e]));
    const nodeMap = new Map(nodeRows.map(n => [n.id, n]));

    const pushNode = (row: UnifiedRow) => {
      if (visited.has(row.id)) return;
      visited.add(row.id);
      result.push(row);
    };
    const pushEdge = (row: UnifiedRow) => {
      if (visited.has(row.id)) return;
      visited.add(row.id);
      result.push(row);
    };

    // Traverse from reservoirs
    for (const res of reservoirs) {
      pushNode(res);
      // Find outgoing edges from this node
      const outEdges = edges.filter(e => e.source === res.id);
      for (const oe of outEdges) {
        const eRow = edgeMap.get(oe.id);
        if (eRow) pushEdge(eRow);
        const targetRow = nodeMap.get(oe.target);
        if (targetRow) pushNode(targetRow);
      }
    }

    // Append remaining unvisited edges
    for (const e of edgeRows) {
      if (!visited.has(e.id)) { visited.add(e.id); result.push(e); }
    }
    // Append remaining unvisited nodes
    for (const n of nodeRows) {
      if (!visited.has(n.id)) { visited.add(n.id); result.push(n); }
    }

    return result;
  }, [nodes, edges]);

  const filteredRows = useMemo(
    () => allRows.filter(r => matchesFilter(r, activeFilter)),
    [allRows, activeFilter]
  );

  // Count per type for chip labels
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

  // Handlers
  const handleChangeEdge = useCallback(
    (id: string, field: string, rawStr: string, currentData: any) => {
      const textFields = new Set(['label', 'comment', 'type']);
      const isText = textFields.has(field);
      const val = isText ? rawStr : (rawStr.trim() === '' ? rawStr : (parseFloat(rawStr) || 0));
      const update: any = { [field]: val };
      if (typeof val === 'number' && CACHEABLE_FIELDS.has(field)) {
        const existingCache = (currentData?._unitCache as any) || {};
        const cu = (currentData?.unit as UnitSystem) || globalUnit;
        update._unitCache = buildCacheUpdate(existingCache, cu, field, val);
      }
      updateEdgeData(id, update);
    },
    [globalUnit, updateEdgeData]
  );

  const handleChangeNode = useCallback(
    (id: string, field: string, rawStr: string, currentData: any) => {
      const textFields = new Set(['label', 'comment', 'mode', 'type']);
      const isText = textFields.has(field);
      const val = isText ? rawStr : (rawStr.trim() === '' ? rawStr : (parseFloat(rawStr) || 0));
      const update: any = { [field]: val };
      if (typeof val === 'number' && CACHEABLE_FIELDS.has(field)) {
        const existingCache = (currentData?._unitCache as any) || {};
        const cu = (currentData?.unit as UnitSystem) || globalUnit;
        update._unitCache = buildCacheUpdate(existingCache, cu, field, val);
      }
      updateNodeData(id, update);
    },
    [globalUnit, updateNodeData]
  );

  const handleSelectEdge = useCallback((id: string) => selectElement(id, 'edge'), [selectElement]);
  const handleSelectNode = useCallback((id: string) => selectElement(id, 'node'), [selectElement]);

  const totalNodes = nodes.length;
  const totalPipes = edges.length;

  // Chip active/inactive colors
  const chipClass = (key: FilterKey) =>
    activeFilter === key
      ? 'bg-[#1a73e8] text-white border-[#1a73e8]'
      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400 hover:text-slate-800';

  // Only show filter chips that have elements
  const visibleChips = FILTER_CHIPS.filter(c => counts[c.key as keyof typeof counts] > 0 || c.key === 'all');

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent
        className="max-w-[96vw] w-[96vw] h-[92vh] flex flex-col p-0 gap-0 overflow-hidden"
        data-testid="flextable-dialog"
        hideCloseButton
      >
        {/* ── Header ── */}
        <DialogHeader className="px-5 py-3 border-b bg-white flex-none shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <DialogTitle className="text-sm font-bold text-slate-800 shrink-0">Flex Table</DialogTitle>
              <span className="text-xs text-slate-400 shrink-0">
                {totalNodes} node{totalNodes !== 1 ? 's' : ''} · {totalPipes} pipe{totalPipes !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {/* SI / FPS toggle */}
              <div className="flex items-center border border-slate-200 rounded overflow-hidden text-xs h-7 shrink-0">
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
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-full hover:bg-slate-100"
                onClick={onClose}
                data-testid="flextable-close"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* ── Filter chips ── */}
        <div className="flex items-center gap-1.5 px-5 py-2.5 border-b bg-slate-50 flex-none flex-wrap">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0 mr-0.5" />
          {visibleChips.map(chip => (
            <button
              key={chip.key}
              data-testid={`filter-chip-${chip.key}`}
              onClick={() => setActiveFilter(chip.key)}
              className={cn(
                'inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-medium transition-all shrink-0',
                chipClass(chip.key)
              )}
            >
              {chip.label}
              <span className={cn(
                'inline-flex items-center justify-center rounded-full text-[9px] font-bold min-w-[16px] h-[16px] px-1',
                activeFilter === chip.key ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500'
              )}>
                {counts[chip.key as keyof typeof counts]}
              </span>
            </button>
          ))}
          {activeFilter !== 'all' && (
            <button
              className="text-[11px] text-slate-400 hover:text-slate-600 ml-1 underline underline-offset-2"
              onClick={() => setActiveFilter('all')}
            >
              Clear filter
            </button>
          )}
        </div>

        {/* ── Table ── */}
        <div className="flex-1 overflow-hidden flex flex-col px-4 py-3 gap-2 bg-slate-50/70">
          <UnifiedTable
            rows={filteredRows}
            filter={activeFilter}
            unit={globalUnit}
            onChangeEdge={handleChangeEdge}
            onChangeNode={handleChangeNode}
            onSelectEdge={handleSelectEdge}
            onSelectNode={handleSelectNode}
          />
          <p className="text-[10px] text-slate-400 flex-none leading-tight">
            Showing {filteredRows.length} of {allRows.length} element{allRows.length !== 1 ? 's' : ''} · Click any editable cell to modify · Changes sync instantly with the properties panel · SI/FPS toggle applies globally
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
