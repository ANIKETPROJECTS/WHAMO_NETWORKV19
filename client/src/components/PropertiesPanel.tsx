import { useState, useEffect } from 'react';
import { useNetworkStore, type UnitSystem, type PcharType } from '@/lib/store';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2, ChevronDown, ChevronRight, Plus } from 'lucide-react';

function PcharEditor({ pType, activePc, updatePcharData }: {
  pType: number;
  activePc: PcharType;
  updatePcharData: (pumpType: number, data: PcharType) => void;
}) {
  const arrayToText = (arr: number[]) => arr.join(' ');
  const hratioToText = (m: number[][]) => m.map(r => r.join(' ')).join('\n');
  const textToArray = (text: string): number[] =>
    text.trim().split(/[\s,\n]+/).map(parseFloat).filter(n => !isNaN(n));
  const tratioToText = (f: number[]) => {
    const lines: string[] = [];
    for (let i = 0; i < f.length; i += 8) lines.push(f.slice(i, i + 8).join(' '));
    return lines.join('\n');
  };

  const [showPchar, setShowPchar] = useState(false);
  const [sratioText, setSratioText] = useState(() => arrayToText(activePc.sratio));
  const [qratioText, setQratioText] = useState(() => arrayToText(activePc.qratio));
  const [hratioText, setHratioText] = useState(() => hratioToText(activePc.hratio));
  const [tratioText, setTratioText] = useState(() => tratioToText(activePc.tratio));

  useEffect(() => {
    setSratioText(arrayToText(activePc.sratio));
    setQratioText(arrayToText(activePc.qratio));
    setHratioText(hratioToText(activePc.hratio));
    setTratioText(tratioToText(activePc.tratio));
  }, [pType]);

  const savePchar = (updates: Partial<PcharType>) => {
    updatePcharData(pType, { ...activePc, ...updates });
  };

  return (
    <div className="border rounded-md overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold bg-orange-50 hover:bg-orange-100 transition-colors text-orange-800"
        onClick={() => setShowPchar(v => !v)}
        data-testid="btn-toggle-pchar"
        type="button"
      >
        <span>Pump Characteristics (PCHAR TYPE {pType})</span>
        {showPchar ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
      </button>
      {showPchar && (
        <div className="p-3 space-y-3 bg-white">
          <p className="text-[10px] text-muted-foreground italic">
            PCHAR TYPE {pType} data is global — shared across all pumps of this type.
          </p>
          <div className="grid gap-1">
            <Label className="text-[10px] font-medium">SRATIO (space-separated)</Label>
            <textarea
              data-testid="textarea-sratio"
              className="w-full border rounded text-[10px] font-mono p-1.5 resize-none h-10 focus:outline-none focus:ring-1 focus:ring-orange-400"
              value={sratioText}
              onChange={(e) => setSratioText(e.target.value)}
              onBlur={(e) => savePchar({ sratio: textToArray(e.target.value) })}
            />
          </div>
          <div className="grid gap-1">
            <Label className="text-[10px] font-medium">QRATIO (space-separated)</Label>
            <textarea
              data-testid="textarea-qratio"
              className="w-full border rounded text-[10px] font-mono p-1.5 resize-none h-10 focus:outline-none focus:ring-1 focus:ring-orange-400"
              value={qratioText}
              onChange={(e) => setQratioText(e.target.value)}
              onBlur={(e) => savePchar({ qratio: textToArray(e.target.value) })}
            />
          </div>
          <div className="grid gap-1">
            <Label className="text-[10px] font-medium">HRATIO (one row per line)</Label>
            <textarea
              data-testid="textarea-hratio"
              className="w-full border rounded text-[10px] font-mono p-1.5 resize-none h-28 focus:outline-none focus:ring-1 focus:ring-orange-400"
              value={hratioText}
              onChange={(e) => setHratioText(e.target.value)}
              onBlur={(e) => {
                const rows = e.target.value.trim().split('\n').map(row =>
                  row.trim().split(/\s+/).map(parseFloat).filter(n => !isNaN(n))
                ).filter(r => r.length > 0);
                savePchar({ hratio: rows });
              }}
            />
          </div>
          <div className="grid gap-1">
            <Label className="text-[10px] font-medium">TRATIO (space-separated, 8 per line)</Label>
            <textarea
              data-testid="textarea-tratio"
              className="w-full border rounded text-[10px] font-mono p-1.5 resize-none h-28 focus:outline-none focus:ring-1 focus:ring-orange-400"
              value={tratioText}
              onChange={(e) => setTratioText(e.target.value)}
              onBlur={(e) => savePchar({ tratio: textToArray(e.target.value) })}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function PropertiesPanel() {

  const { 
    nodes, 
    edges, 
    selectedElementId, 
    selectedElementType, 
    updateNodeData, 
    updateEdgeData,
    deleteElement,
    globalUnit,
    hSchedules,
    updateHSchedule,
    addHSchedule,
    pcharData,
    updatePcharData,
    addPcharType,
    deletePcharType,
  } = useNetworkStore();

  const [newTypeNum, setNewTypeNum] = useState<string>("");

  if (!selectedElementId) return null;

  const isNode = selectedElementType === 'node';
  const element = isNode 
    ? nodes.find(n => n.id === selectedElementId) 
    : edges.find(e => e.id === selectedElementId);

  if (!element) return null;

  const currentUnit = (element.data?.unit as UnitSystem) || globalUnit;

  const SI_TO_FPS = {
    length: 3.28084, // m to ft
    diameter: 3.28084, // m to ft
    elevation: 3.28084, // m to ft
    celerity: 3.28084, // m/s to ft/s
    area: 10.7639, // m2 to ft2
    flow: 35.3147, // m3/s to ft3/s
    pressure: 1 / 6894.76, // Pa to psi
  };

  const convertValue = (value: number, from: UnitSystem, to: UnitSystem, type: keyof typeof SI_TO_FPS) => {
    if (from === to) return value;
    const factor = SI_TO_FPS[type] || 1;
    const result = to === 'FPS' ? value * factor : value / factor;
    return parseFloat(result.toFixed(8));
  };

  const fieldMapping: Record<string, keyof typeof SI_TO_FPS> = {
    length: 'length',
    diameter: 'diameter',
    elevation: 'elevation',
    reservoirElevation: 'elevation',
    tankTop: 'elevation',
    tankBottom: 'elevation',
    initialWaterLevel: 'elevation',
    riserDiameter: 'diameter',
    riserTop: 'elevation',
    distance: 'length',
    celerity: 'celerity',
    area: 'area',
    pipeWT: 'diameter',   // wall thickness (ft or m)
    pipeE: 'pressure',    // modulus of elasticity (psi or Pa)
  };

  const cacheableFields = Object.keys(fieldMapping);

  const handleUnitToggle = (newUnit: UnitSystem) => {
    if (newUnit === currentUnit) return;

    const existingCache: Record<string, any> = (element.data?._unitCache as any) || {};

    // Save current values into cache for the current unit
    const savedForCurrentUnit: Record<string, any> = {};
    cacheableFields.forEach(key => {
      const val = (element.data as any)?.[key];
      if (val !== undefined && val !== null && val !== '') {
        savedForCurrentUnit[key] = val;
      }
    });
    if (element.data?.schedulePoints) {
      savedForCurrentUnit.schedulePoints = JSON.parse(JSON.stringify(element.data.schedulePoints));
    }

    const newCache = {
      ...existingCache,
      [currentUnit]: { ...(existingCache[currentUnit] || {}), ...savedForCurrentUnit },
    };

    const dataUpdate: any = { unit: newUnit, _unitCache: newCache };

    // For each convertible field: use cached value if defined, otherwise math-convert.
    // pipeE and pipeWT are excluded here — they are always math-converted below for precision.
    const cachedTarget: Record<string, any> = newCache[newUnit] || {};
    Object.entries(element.data || {}).forEach(([key, value]) => {
      if (!fieldMapping[key]) return;
      if (key === 'pipeE' || key === 'pipeWT') return;
      const cachedVal = cachedTarget[key];
      if (cachedVal !== undefined) {
        dataUpdate[key] = cachedVal;
      } else {
        const numValue = typeof value === 'string' ? parseFloat(value) : (typeof value === 'number' ? value : NaN);
        if (!isNaN(numValue)) {
          dataUpdate[key] = convertValue(numValue, currentUnit, newUnit, fieldMapping[key]);
        }
      }
    });

    // pipeE (Pa ↔ psi) and pipeWT (m ↔ ft): use cached value when available so that
    // round-trips (SI→FPS→SI) restore the exact original number. Fall back to
    // high-precision math conversion only when no cached value exists yet.
    if (element.data?.pipeE != null && element.data.pipeE !== '') {
      const val = parseFloat(String(element.data.pipeE));
      if (!isNaN(val)) {
        const cachedVal = cachedTarget['pipeE'];
        dataUpdate.pipeE = cachedVal !== undefined
          ? cachedVal
          : parseFloat(convertValue(val, currentUnit, newUnit, 'pressure').toPrecision(10));
      }
    }
    if (element.data?.pipeWT != null && element.data.pipeWT !== '') {
      const val = parseFloat(String(element.data.pipeWT));
      if (!isNaN(val)) {
        const cachedVal = cachedTarget['pipeWT'];
        dataUpdate.pipeWT = cachedVal !== undefined
          ? cachedVal
          : parseFloat(convertValue(val, currentUnit, newUnit, 'diameter').toPrecision(10));
      }
    }

    // Handle schedulePoints
    if (element.data?.schedulePoints) {
      if (cachedTarget.schedulePoints) {
        dataUpdate.schedulePoints = cachedTarget.schedulePoints;
      } else {
        dataUpdate.schedulePoints = (element.data.schedulePoints as any[]).map(p => ({
          ...p,
          flow: convertValue(p.flow, currentUnit, newUnit, 'flow')
        }));
      }
    }

    if (isNode) {
      updateNodeData(selectedElementId, dataUpdate);
    } else {
      updateEdgeData(selectedElementId, dataUpdate);
    }
  };

  const handleChange = (key: string, value: any) => {
    const numericValue = (typeof value === 'string' && value.trim() !== '' && !isNaN(Number(value))) 
      ? Number(value) 
      : value;

    // When the user edits a cacheable field, update the cache for the current unit
    // and clear the cached value for the other unit so it gets re-derived next switch
    const update: any = { [key]: numericValue };
    if (cacheableFields.includes(key)) {
      const existingCache: Record<string, any> = (element.data?._unitCache as any) || {};
      const otherUnit: UnitSystem = currentUnit === 'FPS' ? 'SI' : 'FPS';
      update._unitCache = {
        ...existingCache,
        [currentUnit]: { ...(existingCache[currentUnit] || {}), [key]: numericValue },
        [otherUnit]: existingCache[otherUnit]
          ? { ...existingCache[otherUnit], [key]: undefined }
          : existingCache[otherUnit],
      };
    }

    if (isNode) {
      updateNodeData(selectedElementId, update);
    } else {
      updateEdgeData(selectedElementId, update);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-card border-l border-border">
      <CardHeader className="pb-4 border-b border-border/50 bg-muted/20">
        <CardTitle className="text-lg flex items-center gap-2">
          <span className="capitalize">{element.data?.type || element.type}</span>
          <span className="text-muted-foreground font-normal text-sm">#{selectedElementId}</span>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-6 pt-6">
        {/* Unit Selection */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-foreground/80">Units</h4>
            <div className="flex bg-muted rounded-md p-1 gap-1">
              <Button 
                variant={currentUnit === 'SI' ? 'secondary' : 'ghost'} 
                size="sm" 
                className="h-7 px-2 text-xs"
                onClick={() => handleUnitToggle('SI')}
              >
                SI
              </Button>
              <Button 
                variant={currentUnit === 'FPS' ? 'secondary' : 'ghost'} 
                size="sm" 
                className="h-7 px-2 text-xs"
                onClick={() => handleUnitToggle('FPS')}
              >
                FPS
              </Button>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground italic">
            Changing unit will auto-convert existing numeric values.
          </p>
        </div>

        <Separator />

        {/* Common Properties */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-foreground/80">General</h4>
          <div className="grid gap-2">
            <Label htmlFor="label">Label / ID</Label>
            <Input 
              id="label" 
              value={element.data?.label || ''} 
              onChange={(e) => handleChange('label', e.target.value)} 
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="comment">Comment</Label>
            <Input 
              id="comment" 
              placeholder="Internal comment (c/C style)"
              value={element.data?.comment || ''} 
              onChange={(e) => handleChange('comment', e.target.value)} 
            />
          </div>
        </div>

        <Separator />

        {/* Specific Properties based on Type */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-foreground/80">Parameters</h4>
          
          {!isNode && (
            <div className="grid gap-2 mb-4">
              <Label>Connection Type</Label>
              <RadioGroup 
                value={element.data?.type || 'conduit'} 
                onValueChange={(v) => handleChange('type', v)}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="conduit" id="conduit" />
                  <Label htmlFor="conduit">Conduit</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="dummy" id="dummy" />
                  <Label htmlFor="dummy">Dummy Pipe</Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {isNode && (element.data?.type === 'node' || element.data?.type === 'junction' || element.data?.type === 'reservoir' || element.data?.type === 'surgeTank' || element.data?.type === 'flowBoundary' || element.data?.type_st) && (
            <>
              <div className="grid gap-2">
                <Label htmlFor="nodeNum">Node Number</Label>
                <Input 
                  id="nodeNum" 
                  type="number" 
                  value={element.data?.nodeNumber || 0} 
                  onChange={(e) => handleChange('nodeNumber', e.target.value)} 
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="elev">Elevation ({currentUnit === 'SI' ? 'm' : 'ft'})</Label>
                <Input 
                  id="elev" 
                  type="number" 
                  step="any"
                  value={element.data?.elevation !== undefined ? parseFloat(Number(element.data.elevation).toFixed(8)) : 0} 
                  onChange={(e) => handleChange('elevation', e.target.value)} 
                />
              </div>

              {element.data?.type === 'reservoir' && (
                <div className="grid gap-2 mb-4">
                  <Label>Boundary Condition Mode</Label>
                  <RadioGroup 
                    value={element.data?.mode || 'fixed'} 
                    onValueChange={(v) => handleChange('mode', v)}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="fixed" id="mode-fixed" />
                      <Label htmlFor="mode-fixed">Fixed Elevation</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="schedule" id="mode-schedule" />
                      <Label htmlFor="mode-schedule">H Schedule</Label>
                    </div>
                  </RadioGroup>
                </div>
              )}

              {element.data?.type === 'reservoir' && (element.data?.mode || 'fixed') === 'fixed' && (
                <div className="grid gap-2">
                  <Label htmlFor="resElev">Reservoir Elevation (HW) ({currentUnit === 'SI' ? 'm' : 'ft'})</Label>
                  <Input 
                    id="resElev" 
                    type="number" 
                    step="any"
                    value={element.data?.reservoirElevation !== undefined ? parseFloat(Number(element.data.reservoirElevation).toFixed(8)) : 0} 
                    onChange={(e) => handleChange('reservoirElevation', e.target.value)} 
                  />
                </div>
              )}

              {element.data?.type === 'reservoir' && element.data?.mode === 'schedule' && (
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="hScheduleNum">Schedule Number</Label>
                    <Select 
                      value={(element.data?.hScheduleNumber || 1).toString()} 
                      onValueChange={(v) => {
                        if (v === 'add-new') {
                          const maxSched = hSchedules.length > 0 
                            ? Math.max(...hSchedules.map(s => s.number)) 
                            : 5;
                          const newNum = maxSched + 1;
                          addHSchedule(newNum);
                          handleChange('hScheduleNumber', newNum);
                          return;
                        }
                        const num = parseInt(v);
                        addHSchedule(num);
                        handleChange('hScheduleNumber', num);
                      }}
                    >
                      <SelectTrigger id="hScheduleNum">
                        <SelectValue placeholder="Select schedule" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: Math.max(5, ...hSchedules.map(s => s.number)) }, (_, i) => i + 1).map(num => (
                          <SelectItem key={num} value={num.toString()}>{num}</SelectItem>
                        ))}
                        <Separator className="my-1" />
                        <SelectItem value="add-new" className="text-primary font-medium cursor-pointer">
                          + Add New Schedule
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">T/H Pairs</Label>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-7 px-2"
                        onClick={() => {
                          const schedNum = element.data?.hScheduleNumber || 1;
                          const currentSched = hSchedules.find(s => s.number === schedNum);
                          const points = currentSched ? [...currentSched.points] : [];
                          updateHSchedule(schedNum, [...points, { time: 0, head: 0 }]);
                        }}
                      >
                        Add Pair
                      </Button>
                    </div>

                    <div className="space-y-2">
                      {(hSchedules.find(s => s.number === (element.data?.hScheduleNumber || 1))?.points || []).map((point, index) => (
                        <div key={index} className="flex items-end gap-2 p-2 border rounded-md bg-muted/30 relative group">
                          <div className="grid gap-1 flex-1">
                            <Label className="text-[10px]">Time (T)</Label>
                            <Input 
                              type="number"
                              className="h-7 text-xs"
                              value={point.time}
                              onChange={(e) => {
                                const schedNum = element.data?.hScheduleNumber || 1;
                                const currentSched = hSchedules.find(s => s.number === schedNum);
                                if (currentSched) {
                                  const newPoints = [...currentSched.points];
                                  newPoints[index] = { ...newPoints[index], time: parseFloat(e.target.value) };
                                  updateHSchedule(schedNum, newPoints);
                                }
                              }}
                            />
                          </div>
                          <div className="grid gap-1 flex-1">
                            <Label className="text-[10px]">Head (H) ({currentUnit === 'SI' ? 'm' : 'ft'})</Label>
                            <Input 
                              type="number"
                              className="h-7 text-xs"
                              value={point.head}
                              onChange={(e) => {
                                const schedNum = element.data?.hScheduleNumber || 1;
                                const currentSched = hSchedules.find(s => s.number === schedNum);
                                if (currentSched) {
                                  const newPoints = [...currentSched.points];
                                  newPoints[index] = { ...newPoints[index], head: parseFloat(e.target.value) };
                                  updateHSchedule(schedNum, newPoints);
                                }
                              }}
                            />
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => {
                              const schedNum = element.data?.hScheduleNumber || 1;
                              const currentSched = hSchedules.find(s => s.number === schedNum);
                              if (currentSched) {
                                const newPoints = currentSched.points.filter((_, i) => i !== index);
                                updateHSchedule(schedNum, newPoints);
                              }
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                      {(!hSchedules.find(s => s.number === (element.data?.hScheduleNumber || 1))?.points || hSchedules.find(s => s.number === (element.data?.hScheduleNumber || 1))!.points.length === 0) && (
                        <p className="text-[10px] text-muted-foreground text-center py-2 italic">No T/H pairs added.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {element.data?.type === 'flowBoundary' && (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="scheduleNum">Schedule Number</Label>
                    <Input 
                      id="scheduleNum" 
                      type="number" 
                      value={element.data?.scheduleNumber || 0} 
                      onChange={(e) => handleChange('scheduleNumber', e.target.value)} 
                    />
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Queue Schedule Points</Label>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-7 px-2"
                        onClick={() => {
                          const points = (element.data?.schedulePoints as any[]) || [];
                          handleChange('schedulePoints', [...points, { time: 0, flow: 0 }]);
                        }}
                      >
                        Add Point
                      </Button>
                    </div>
                    
                    <div className="space-y-2">
                      {((element.data?.schedulePoints as any[]) || []).map((point, index) => (
                        <div key={index} className="flex items-end gap-2 p-2 border rounded-md bg-muted/30 relative group">
                          <div className="grid gap-1 flex-1">
                            <Label className="text-[10px]">Time (T)</Label>
                            <Input 
                              type="number"
                              className="h-7 text-xs"
                              value={point.time}
                              onChange={(e) => {
                                const newPoints = [...(element.data?.schedulePoints as any[])];
                                newPoints[index] = { ...newPoints[index], time: parseFloat(e.target.value) || 0 };
                                handleChange('schedulePoints', newPoints);
                              }}
                            />
                          </div>
                          <div className="grid gap-1 flex-1">
                            <Label className="text-[10px]">Flow (Q) ({currentUnit === 'SI' ? 'm³/s' : 'ft³/s'})</Label>
                            <Input 
                              type="number"
                              className="h-7 text-xs"
                              value={point.flow}
                              onChange={(e) => {
                                const newPoints = [...(element.data?.schedulePoints as any[])];
                                newPoints[index] = { ...newPoints[index], flow: parseFloat(e.target.value) || 0 };
                                handleChange('schedulePoints', newPoints);
                              }}
                            />
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => {
                              const newPoints = (element.data?.schedulePoints as any[]).filter((_, i) => i !== index);
                              handleChange('schedulePoints', newPoints);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                      {(!element.data?.schedulePoints || (element.data.schedulePoints as any[]).length === 0) && (
                        <p className="text-[10px] text-muted-foreground text-center py-2 italic">No schedule points added.</p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {isNode && element.data?.type === 'pump' && (() => {
            const pType = Number(element.data?.pumpType ?? 1);
            const pc: PcharType | undefined = pcharData[pType];
            const defaultPchar: PcharType = {
              sratio: [],
              qratio: [],
              hratio: [],
              tratio: [],
            };
            const activePc = pc || defaultPchar;

            return (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="pumpStatus">Pump Status</Label>
                  <Select
                    value={element.data?.pumpStatus || 'ACTIVE'}
                    onValueChange={(v) => handleChange('pumpStatus', v)}
                  >
                    <SelectTrigger id="pumpStatus" data-testid="select-pumpstatus">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                      <SelectItem value="INACTIVE">INACTIVE</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pumpType">Pump Type (PCHAR TYPE)</Label>
                  <div className="flex gap-1 items-center">
                    <Select
                      value={String(element.data?.pumpType ?? 1)}
                      onValueChange={(v) => handleChange('pumpType', v)}
                    >
                      <SelectTrigger id="pumpType" data-testid="select-pumptype" className="flex-1">
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.keys(pcharData).map(Number).sort((a, b) => a - b).map(t => (
                          <SelectItem key={t} value={String(t)}>TYPE {t}</SelectItem>
                        ))}
                        <div
                          className="flex gap-1 items-center px-2 py-1.5 border-t mt-1"
                          onPointerDown={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          <input
                            type="number"
                            min="1"
                            className="flex h-7 w-full rounded border border-input bg-transparent px-2 py-0.5 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            placeholder="Type no. (blank = auto)"
                            value={newTypeNum}
                            onChange={(e) => setNewTypeNum(e.target.value)}
                            data-testid="input-new-pchar-type"
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            title="Add new PCHAR type"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              const parsed = newTypeNum.trim() !== "" ? parseInt(newTypeNum) : undefined;
                              const existingNums = Object.keys(pcharData).map(Number);
                              const nextNum = parsed !== undefined && !isNaN(parsed)
                                ? parsed
                                : (existingNums.length > 0 ? Math.max(...existingNums) + 1 : 1);
                              if (pcharData[nextNum] !== undefined) return;
                              addPcharType(nextNum);
                              handleChange('pumpType', String(nextNum));
                              setNewTypeNum("");
                            }}
                            data-testid="button-add-pchar-type"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0 text-destructive hover:text-destructive"
                      title="Delete this PCHAR type"
                      disabled={Object.keys(pcharData).length <= 1}
                      onClick={() => {
                        const currentType = Number(element.data?.pumpType ?? 1);
                        deletePcharType(currentType);
                        const remaining = Object.keys(pcharData).map(Number).filter(t => t !== currentType).sort((a, b) => a - b);
                        if (remaining.length > 0) handleChange('pumpType', String(remaining[0]));
                      }}
                      data-testid="button-delete-pchar-type"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="grid gap-1">
                    <Label htmlFor="rq" className="text-xs">Rated Flow RQ ({currentUnit === 'SI' ? 'm³/s' : 'ft³/s'})</Label>
                    <Input id="rq" data-testid="input-rq" type="number" step="any"
                      value={element.data?.rq !== undefined ? Number(element.data.rq) : 0}
                      onChange={(e) => handleChange('rq', e.target.value)} className="h-7 text-xs" />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="rhead" className="text-xs">Rated Head RHEAD ({currentUnit === 'SI' ? 'm' : 'ft'})</Label>
                    <Input id="rhead" data-testid="input-rhead" type="number" step="any"
                      value={element.data?.rhead !== undefined ? Number(element.data.rhead) : 0}
                      onChange={(e) => handleChange('rhead', e.target.value)} className="h-7 text-xs" />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="rspeed" className="text-xs">Rated Speed RSPEED (RPM)</Label>
                    <Input id="rspeed" data-testid="input-rspeed" type="number" step="any"
                      value={element.data?.rspeed !== undefined ? Number(element.data.rspeed) : 0}
                      onChange={(e) => handleChange('rspeed', e.target.value)} className="h-7 text-xs" />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="rtorque" className="text-xs">Rated Torque RTOROUE</Label>
                    <Input id="rtorque" data-testid="input-rtorque" type="number" step="any"
                      value={element.data?.rtorque !== undefined ? Number(element.data.rtorque) : 0}
                      onChange={(e) => handleChange('rtorque', e.target.value)} className="h-7 text-xs" />
                  </div>
                  <div className="grid gap-1 col-span-2">
                    <Label htmlFor="wr2" className="text-xs">WR² (Moment of Inertia)</Label>
                    <Input id="wr2" data-testid="input-wr2" type="number" step="any"
                      value={element.data?.wr2 !== undefined ? Number(element.data.wr2) : 0}
                      onChange={(e) => handleChange('wr2', e.target.value)} className="h-7 text-xs" />
                  </div>
                </div>

                <PcharEditor pType={pType} activePc={activePc} updatePcharData={updatePcharData} />
              </>
            );
          })()}

          {isNode && element.data?.type === 'checkValve' && (
            <>
              <div className="grid gap-2">
                <Label htmlFor="valveStatus">Valve Status</Label>
                <Select
                  value={element.data?.valveStatus || 'OPEN'}
                  onValueChange={(v) => handleChange('valveStatus', v)}
                >
                  <SelectTrigger id="valveStatus">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OPEN">OPEN</SelectItem>
                    <SelectItem value="CLOSED">CLOSED</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="valveDiam">Diameter DIAM ({currentUnit === 'SI' ? 'm' : 'ft'})</Label>
                <Input
                  id="valveDiam"
                  data-testid="input-valvediam"
                  type="number"
                  step="any"
                  value={element.data?.valveDiam !== undefined ? Number(element.data.valveDiam) : 0}
                  onChange={(e) => handleChange('valveDiam', e.target.value)}
                />
              </div>
            </>
          )}

          {isNode && (element.data?.type === 'surgeTank' || element.data?.type_st) && (
            <>
              <div className="grid gap-2">
                <Label htmlFor="st-type">Tank Type</Label>
                <Select 
                  value={element.data?.type_st || 'SIMPLE'} 
                  onValueChange={(v) => {
                    handleChange('type_st', v);
                  }}
                >
                  <SelectTrigger id="st-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SIMPLE">SIMPLE</SelectItem>
                    <SelectItem value="DIFFERENTIAL">DIFFERENTIAL</SelectItem>
                    <SelectItem value="AIRTANK">AIRTANK</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="tankTop">Top Elevation ({currentUnit === 'SI' ? 'm' : 'ft'})</Label>
                <Input 
                  id="tankTop" 
                  type="number" 
                  step="any"
                  value={element.data?.tankTop !== undefined ? parseFloat(Number(element.data.tankTop).toFixed(8)) : 0} 
                  onChange={(e) => handleChange('tankTop', e.target.value)} 
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="tankBottom">Bottom Elevation ({currentUnit === 'SI' ? 'm' : 'ft'})</Label>
                <Input 
                  id="tankBottom" 
                  type="number" 
                  step="any"
                  value={element.data?.tankBottom !== undefined ? parseFloat(Number(element.data.tankBottom).toFixed(8)) : 0} 
                  onChange={(e) => handleChange('tankBottom', e.target.value)} 
                />
              </div>

              {(element.data?.type_st === 'AIRTANK' || element.data?.type_st === 'DIFFERENTIAL') && (
                <div className="grid gap-2">
                  <Label htmlFor="htank">Initial Water Level (HTANK) ({currentUnit === 'SI' ? 'm' : 'ft'})</Label>
                  <Input 
                    id="htank" 
                    type="number" 
                    step="any"
                    value={element.data?.initialWaterLevel !== undefined ? parseFloat(Number(element.data.initialWaterLevel).toFixed(8)) : 0} 
                    onChange={(e) => handleChange('initialWaterLevel', e.target.value)} 
                  />
                </div>
              )}

              {element.data?.type_st === 'DIFFERENTIAL' && (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="riserdiam">Riser Diameter ({currentUnit === 'SI' ? 'm' : 'ft'})</Label>
                    <Input 
                      id="riserdiam" 
                      type="number" 
                      step="any"
                      value={element.data?.riserDiameter !== undefined ? parseFloat(Number(element.data.riserDiameter).toFixed(8)) : 0} 
                      onChange={(e) => handleChange('riserDiameter', e.target.value)} 
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="risertop">Riser Top Elevation ({currentUnit === 'SI' ? 'm' : 'ft'})</Label>
                    <Input 
                      id="risertop" 
                      type="number" 
                      step="any"
                      value={element.data?.riserTop !== undefined ? parseFloat(Number(element.data.riserTop).toFixed(8)) : 0} 
                      onChange={(e) => handleChange('riserTop', e.target.value)} 
                    />
                  </div>
                </>
              )}

              <div className="flex items-center space-x-2 my-2">
                <Checkbox 
                  id="hasShape" 
                  checked={element.data?.hasShape || false} 
                  onCheckedChange={(checked) => handleChange('hasShape', !!checked)}
                />
                <Label htmlFor="hasShape" className="font-semibold text-primary">Use SHAPE instead of DIAM</Label>
              </div>

              {!element.data?.hasShape && (
                <div className="grid gap-2">
                  <Label htmlFor="diam">Diameter ({currentUnit === 'SI' ? 'm' : 'ft'})</Label>
                  <Input 
                    id="diam" 
                    type="number" 
                    step="any"
                    value={element.data?.diameter !== undefined ? parseFloat(Number(element.data.diameter).toFixed(8)) : 0} 
                    onChange={(e) => handleChange('diameter', e.target.value)} 
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="st-celerity">Celerity ({currentUnit === 'SI' ? 'm/s' : 'ft/s'})</Label>
                  <Input 
                    id="st-celerity" 
                    type="number" 
                    step="any"
                    value={element.data?.celerity !== undefined ? parseFloat(Number(element.data.celerity).toFixed(8)) : 0} 
                    onChange={(e) => handleChange('celerity', e.target.value)} 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="st-friction">Friction</Label>
                  <Input 
                    id="st-friction" 
                    type="number" 
                    step="any"
                    value={element.data?.friction !== undefined ? parseFloat(Number(element.data.friction).toFixed(8)) : 0} 
                    onChange={(e) => handleChange('friction', e.target.value)} 
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2 my-2">
                <Checkbox 
                  id="hasAddedLossST" 
                  checked={element.data?.hasAddedLoss || false} 
                  onCheckedChange={(checked) => handleChange('hasAddedLoss', !!checked)}
                />
                <Label htmlFor="hasAddedLossST" className="font-semibold text-primary">Added Loss Coefficients</Label>
              </div>

              {element.data?.hasAddedLoss && (
                <div className="grid grid-cols-2 gap-4 p-3 bg-muted/30 rounded-md border border-border/50 mb-4">
                  <div className="space-y-2">
                    <Label htmlFor="st-cplus">CPLUS</Label>
                    <Input 
                      id="st-cplus" 
                      type="number" 
                      step="any"
                      value={element.data?.cplus !== undefined ? parseFloat(Number(element.data.cplus).toFixed(8)) : 0} 
                      onChange={(e) => handleChange('cplus', e.target.value)} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="st-cminus">CMINUS</Label>
                    <Input 
                      id="st-cminus" 
                      type="number" 
                      step="any"
                      value={element.data?.cminus !== undefined ? parseFloat(Number(element.data.cminus).toFixed(8)) : 0} 
                      onChange={(e) => handleChange('cminus', e.target.value)} 
                    />
                  </div>
                </div>
              )}

              {element.data?.hasShape && (
                <div className="space-y-3 mt-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Shape (E, A pairs)</Label>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-7 px-2"
                      onClick={() => {
                        const shape = (element.data?.shape as any[]) || [];
                        handleChange('shape', [...shape, { e: 0, a: 0 }]);
                      }}
                    >
                      Add Pair
                    </Button>
                  </div>
                  
                  <div className="space-y-2">
                    {((element.data?.shape as any[]) || []).map((pair, index) => (
                      <div key={index} className="flex items-end gap-2 p-2 border rounded-md bg-muted/30 relative group">
                        <div className="grid gap-1 flex-1">
                          <Label className="text-[10px]">E ({currentUnit === 'SI' ? 'm' : 'ft'})</Label>
                          <Input 
                            type="number"
                            step="any"
                            className="h-7 text-xs"
                            value={pair.e !== undefined ? parseFloat(Number(pair.e).toFixed(8)) : 0}
                            onChange={(e) => {
                              const newShape = [...(element.data?.shape as any[])];
                              newShape[index] = { ...newShape[index], e: parseFloat(e.target.value) || 0 };
                              handleChange('shape', newShape);
                            }}
                          />
                        </div>
                        <div className="grid gap-1 flex-1">
                          <Label className="text-[10px]">A ({currentUnit === 'SI' ? 'm²' : 'ft²'})</Label>
                          <Input 
                            type="number"
                            step="any"
                            className="h-7 text-xs"
                            value={pair.a !== undefined ? parseFloat(Number(pair.a).toFixed(8)) : 0}
                            onChange={(e) => {
                              const newShape = [...(element.data?.shape as any[])];
                              newShape[index] = { ...newShape[index], a: parseFloat(e.target.value) || 0 };
                              handleChange('shape', newShape);
                            }}
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => {
                            const newShape = (element.data?.shape as any[]).filter((_, i) => i !== index);
                            handleChange('shape', newShape);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                    {(!element.data?.shape || (element.data.shape as any[]).length === 0) && (
                      <p className="text-[10px] text-muted-foreground text-center py-2 italic">No shape pairs added.</p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {!isNode && (element.data?.type === 'conduit' || !element.data?.type) && (
            <>
              <div className="flex items-center space-x-2 mb-4">
                <Checkbox 
                  id="variable" 
                  checked={element.data?.variable || false} 
                  onCheckedChange={(checked) => handleChange('variable', !!checked)}
                />
                <Label htmlFor="variable" className="font-semibold text-primary">VARIABLE (optional)</Label>
              </div>

              {element.data?.variable && (
                <div className="grid grid-cols-2 gap-4 p-3 bg-muted/30 rounded-md border border-border/50 mb-4">
                  <div className="space-y-2">
                    <Label htmlFor="distance">DISTANCE ({currentUnit === 'SI' ? 'm' : 'ft'})</Label>
                    <Input 
                      id="distance" 
                      type="number" 
                      value={element.data?.distance || 0} 
                      onChange={(e) => handleChange('distance', e.target.value)} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="area">AREA ({currentUnit === 'SI' ? 'm²' : 'ft²'})</Label>
                    <Input 
                      id="area" 
                      type="number" 
                      value={element.data?.area || 0} 
                      onChange={(e) => handleChange('area', e.target.value)} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="d">D ({currentUnit === 'SI' ? 'm' : 'ft'})</Label>
                    <Input 
                      id="d" 
                      type="number" 
                      value={element.data?.d || 0} 
                      onChange={(e) => handleChange('d', e.target.value)} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="a">A ({currentUnit === 'SI' ? 'm²' : 'ft²'})</Label>
                    <Input 
                      id="a" 
                      type="number" 
                      value={element.data?.a || 0} 
                      onChange={(e) => handleChange('a', e.target.value)} 
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="length">Length ({currentUnit === 'SI' ? 'm' : 'ft'})</Label>
                  <Input 
                    id="length" 
                    type="number" 
                    value={element.data?.length || 0} 
                    onChange={(e) => handleChange('length', e.target.value)} 
                  />
                </div>
                {!element.data?.variable && (
                  <div className="space-y-2">
                    <Label htmlFor="diam">Diameter ({currentUnit === 'SI' ? 'm' : 'ft'})</Label>
                    <Input 
                      id="diam" 
                      type="number" 
                      value={element.data?.diameter || 0} 
                      onChange={(e) => handleChange('diameter', e.target.value)} 
                    />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="celerity">Wave Speed ({currentUnit === 'SI' ? 'm/s' : 'ft/s'})</Label>
                  <Input 
                    id="celerity" 
                    type="number" 
                    value={element.data?.celerity || 0} 
                    onChange={(e) => {
                      handleChange('celerity', e.target.value);
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="friction">Friction (f)</Label>
                  <Input 
                    id="friction" 
                    data-testid="input-friction"
                    type="number" 
                    step="0.001"
                    value={element.data?.friction || 0} 
                    onChange={(e) => {
                      handleChange('friction', e.target.value);
                      const f = parseFloat(e.target.value);
                      const diam = parseFloat(element.data?.diameter) || 0;
                      const K = currentUnit === 'SI' ? 124.58 : 185;
                      if (!isNaN(f) && f > 0 && diam > 0) {
                        const n = Math.sqrt((f * Math.pow(diam, 1 / 3)) / K);
                        handleChange('manningsN', parseFloat(n.toFixed(6)).toString());
                      }
                    }}
                  />
                </div>
              </div>

              <div className="space-y-3 rounded-md border border-dashed p-3">
                <div>
                  <Label className="font-medium">Pipe Wall Properties (E &amp; WT)</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Enter both <strong>E</strong> and <strong>WT</strong> to calculate wave speed.
                    Diameter is used automatically.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="pipe-e">
                      E ({currentUnit === 'SI' ? 'Pa' : 'psi'})
                    </Label>
                    <Input
                      id="pipe-e"
                      data-testid="input-pipe-e"
                      type="number"
                      placeholder={currentUnit === 'SI' ? 'e.g. 2.07e11' : 'e.g. 30000000'}
                      value={element.data?.pipeE ?? ''}
                      onChange={(e) => {
                        handleChange('pipeE', e.target.value);
                        const E  = parseFloat(e.target.value);
                        const C0 = currentUnit === 'SI' ? 1440 : 4720;
                        const Kw = currentUnit === 'SI' ? 2.07e9 : 3e5;
                        const D  = parseFloat(element.data?.diameter) || 0;
                        const WT = parseFloat(element.data?.pipeWT) || 0;
                        if (!isNaN(E) && E > 0 && WT > 0 && D > 0) {
                          const c = C0 / Math.sqrt(1 + (Kw / E) * (D / WT));
                          handleChange('celerity', parseFloat(c.toFixed(4)).toString());
                        }
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pipe-wt">
                      WT ({currentUnit === 'SI' ? 'm' : 'ft'})
                    </Label>
                    <Input
                      id="pipe-wt"
                      data-testid="input-pipe-wt"
                      type="number"
                      step="0.001"
                      placeholder={currentUnit === 'SI' ? 'e.g. 0.006' : 'e.g. 0.02'}
                      value={element.data?.pipeWT ?? ''}
                      onChange={(e) => {
                        handleChange('pipeWT', e.target.value);
                        const WT = parseFloat(e.target.value);
                        const C0 = currentUnit === 'SI' ? 1440 : 4720;
                        const Kw = currentUnit === 'SI' ? 2.07e9 : 3e5;
                        const D  = parseFloat(element.data?.diameter) || 0;
                        const E  = parseFloat(element.data?.pipeE) || 0;
                        if (!isNaN(WT) && WT > 0 && E > 0 && D > 0) {
                          const c = C0 / Math.sqrt(1 + (Kw / E) * (D / WT));
                          handleChange('celerity', parseFloat(c.toFixed(4)).toString());
                        }
                      }}
                    />
                  </div>
                </div>
                <div className="rounded bg-muted px-3 py-2 text-sm text-muted-foreground">
                  <span>
                    {currentUnit === 'SI'
                      ? 'c = 1440 / √(1 + (2.07·10⁹/E) · (D/WT))'
                      : 'c = 4720 / √(1 + (3·10⁵/E) · (D/WT))'}
                  </span>
                  {element.data?.celerity && (element.data?.pipeE || element.data?.pipeWT) ? (
                    <span className="ml-2 font-semibold text-foreground">
                      = {parseFloat(Number(element.data.celerity).toFixed(4))} {currentUnit === 'SI' ? 'm/s' : 'ft/s'}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="space-y-3 rounded-md border border-dashed p-3">
                <div className="space-y-2">
                  <Label htmlFor="mannings-n" className="font-medium">Manning's Coefficient (n)</Label>
                  <Input
                    id="mannings-n"
                    data-testid="input-mannings-n"
                    type="number"
                    step="0.0001"
                    placeholder="e.g. 0.013"
                    value={(() => {
                      if (element.data?.manningsN != null && element.data.manningsN !== '') {
                        return element.data.manningsN;
                      }
                      const f = parseFloat(element.data?.friction) || 0;
                      const diam = parseFloat(element.data?.diameter) || 0;
                      const K = currentUnit === 'SI' ? 124.58 : 185;
                      if (f > 0 && diam > 0) {
                        return parseFloat(Math.sqrt((f * Math.pow(diam, 1 / 3)) / K).toFixed(6));
                      }
                      return '';
                    })()}
                    onChange={(e) => {
                      const n = parseFloat(e.target.value);
                      handleChange('manningsN', e.target.value);
                      if (!isNaN(n) && n > 0) {
                        const diam = parseFloat(element.data?.diameter) || 0;
                        const K = currentUnit === 'SI' ? 124.58 : 185;
                        if (diam > 0) {
                          const f = (K * n * n) / Math.pow(diam, 1 / 3);
                          handleChange('friction', parseFloat(f.toFixed(6)).toString());
                        }
                      }
                    }}
                  />
                </div>
                <div className="rounded bg-muted px-3 py-2 text-sm text-muted-foreground">
                  <span>f = {currentUnit === 'SI' ? '124.58' : '185'} · n² / D<sup>1/3</sup></span>
                  {element.data?.friction ? (
                    <span className="ml-2 font-semibold text-foreground">
                      = {parseFloat(Number(element.data.friction).toFixed(6))}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="segments">Num Segments</Label>
                <div className="flex items-center gap-2">
                  <Input 
                    id="segments" 
                    type="number" 
                    className="flex-1"
                    value={element.data?.numSegments || 1} 
                    onChange={(e) => handleChange('numSegments', e.target.value)} 
                  />
                  <div className="flex items-center gap-2 ml-2">
                    <Checkbox 
                      id="includeNumSeg" 
                      checked={element.data?.includeNumSegments !== false} 
                      onCheckedChange={(checked) => handleChange('includeNumSegments', !!checked)}
                    />
                    <Label htmlFor="includeNumSeg" className="text-xs whitespace-nowrap">Include in .INP</Label>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center space-x-2 my-2">
                <Checkbox 
                  id="hasAddedLoss" 
                  checked={element.data?.hasAddedLoss || false} 
                  onCheckedChange={(checked) => handleChange('hasAddedLoss', !!checked)}
                />
                <Label htmlFor="hasAddedLoss" className="font-semibold text-primary">Include ADDEDLOSS</Label>
              </div>

              {element.data?.hasAddedLoss && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cplus">CPLUS (opt)</Label>
                    <Input 
                      id="cplus" 
                      type="number" 
                      placeholder="0.0"
                      value={element.data?.cplus ?? ''} 
                      onChange={(e) => handleChange('cplus', e.target.value === '' ? undefined : e.target.value)} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cminus">CMINUS (opt)</Label>
                    <Input 
                      id="cminus" 
                      type="number" 
                      placeholder="0.0"
                      value={element.data?.cminus ?? ''} 
                      onChange={(e) => handleChange('cminus', e.target.value === '' ? undefined : e.target.value)} 
                    />
                  </div>
                </div>
              )}
              </div>
            </>
          )}

          {!isNode && element.data?.type === 'dummy' && (
            <>
              <div className="grid gap-2">
                <Label htmlFor="diam">Diameter ({currentUnit === 'SI' ? 'm' : 'ft'})</Label>
                <Input 
                  id="diam" 
                  type="number" 
                  value={element.data?.diameter || 0} 
                  onChange={(e) => handleChange('diameter', e.target.value)} 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center space-x-2 my-2">
                <Checkbox 
                  id="hasAddedLoss" 
                  checked={element.data?.hasAddedLoss || false} 
                  onCheckedChange={(checked) => handleChange('hasAddedLoss', !!checked)}
                />
                <Label htmlFor="hasAddedLoss" className="font-semibold text-primary">Include ADDEDLOSS</Label>
              </div>

              {element.data?.hasAddedLoss && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cplus">CPLUS (opt)</Label>
                    <Input 
                      id="cplus" 
                      type="number" 
                      placeholder="0.0"
                      value={element.data?.cplus ?? ''} 
                      onChange={(e) => handleChange('cplus', e.target.value === '' ? undefined : e.target.value)} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cminus">CMINUS (opt)</Label>
                    <Input 
                      id="cminus" 
                      type="number" 
                      placeholder="0.0"
                      value={element.data?.cminus ?? ''} 
                      onChange={(e) => handleChange('cminus', e.target.value === '' ? undefined : e.target.value)} 
                    />
                  </div>
                </div>
              )}
              </div>
            </>
          )}
        </div>

        <Separator />

        {/* Delete Button */}
        <Button 
          variant="destructive" 
          className="w-full gap-2" 
          onClick={() => selectedElementId && selectedElementType && deleteElement(selectedElementId, selectedElementType)}
          data-testid="button-delete-element"
        >
          <Trash2 className="h-4 w-4" />
          Delete Element
        </Button>
      </CardContent>
    </div>
  );
}
