import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ReactNode } from "react";
import { useNetworkStore } from "@/lib/store";

interface TooltipWrapperProps {
  children: ReactNode;
  content: ReactNode;
  delayDuration?: number;
}

export function TooltipWrapper({ 
  children, 
  content, 
  delayDuration = 0 
}: TooltipWrapperProps) {
  return (
    <TooltipProvider delayDuration={delayDuration}>
      <Tooltip>
        <TooltipTrigger asChild>
          {children}
        </TooltipTrigger>
        <TooltipContent 
          side="right" 
          className="p-3 bg-white/95 backdrop-blur-sm border border-slate-200 shadow-xl z-[9999]"
        >
          <div className="text-xs space-y-1 min-w-[150px]">
            {content}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function DataList({ data, title }: { data: any, title: string }) {
  if (!data) return null;
  
  const globalUnit = useNetworkStore(state => state.globalUnit);
  const unit = (data.unit as string) || globalUnit;

  const HIDDEN_KEYS = new Set([
    'label', 'unit', 'type', 'hasAddedLoss', 'hasShape',
    '_unitCache', 'variable', 'comment', 'mode', 'hScheduleNumber',
  ]);

  const entries = Object.entries(data).filter(([key]) => {
    if (HIDDEN_KEYS.has(key)) return false;
    
    // Surge Tank specific filtering
    if (data.type === 'surgeTank' || data.type_st) {
      const type_st = data.type_st || 'SIMPLE';
      
      // Filter based on tank type
      if (key === 'initialWaterLevel' && type_st === 'SIMPLE') return false;
      if ((key === 'riserDiameter' || key === 'riserTop') && type_st !== 'DIFFERENTIAL') return false;
      
      // Filter based on flags
      if (key === 'diameter' && data.hasShape) return false;
      if (key === 'shape' && !data.hasShape) return false;

      // Filter out duplicate/mismatched property names
      if (key === 'topElevation' || key === 'bottomElevation') return false;
    }

    // Flow Boundary specific filtering
    if (data.type === 'flowBoundary') {
      if (key === 'schedulePoints' || key === 'scheduleNumber') return false;
    }
    
    return true;
  });
  
  const getUnit = (key: string) => {
    const units: Record<string, { SI: string, FPS: string }> = {
      elevation: { SI: 'm', FPS: 'ft' },
      tankTop: { SI: 'm', FPS: 'ft' },
      tankBottom: { SI: 'm', FPS: 'ft' },
      diameter: { SI: 'm', FPS: 'ft' },
      riserDiameter: { SI: 'm', FPS: 'ft' },
      length: { SI: 'm', FPS: 'ft' },
      celerity: { SI: 'm/s', FPS: 'ft/s' },
      flow: { SI: 'm³/s', FPS: 'ft³/s' },
      distance: { SI: 'm', FPS: 'ft' },
      area: { SI: 'm²', FPS: 'ft²' },
      reservoirElevation: { SI: 'm', FPS: 'ft' },
      riserTop: { SI: 'm', FPS: 'ft' },
      initialWaterLevel: { SI: 'm', FPS: 'ft' },
      d: { SI: 'm', FPS: 'ft' },
      a: { SI: 'm²', FPS: 'ft²' },
      cplus: { SI: '', FPS: '' },
      cminus: { SI: '', FPS: '' },
    };
    return units[key]?.[unit as 'SI' | 'FPS'] || '';
  };

  const getLabel = (key: string) => {
    const labels: Record<string, string> = {
      id: 'ID',
      type_st: 'Tank Type',
      initialWaterLevel: 'Initial Water Level (HTANK)',
      tankTop: 'Top Elevation',
      tankBottom: 'Bottom Elevation',
      nodeNumber: 'Node Number',
      riserDiameter: 'Riser Diameter',
      riserTop: 'Riser Top Elevation',
      cplus: 'CPLUS (Loss +)',
      cminus: 'CMINUS (Loss -)',
      elevation: 'Node Elevation',
    };
    return labels[key] || key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1');
  };
  
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center border-b pb-1 mb-1">
        <div className="font-bold text-slate-900 uppercase tracking-wider text-[10px]">
          {title}
        </div>
        <div className="text-[9px] font-medium px-1 bg-slate-100 rounded text-slate-500">
          {unit}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
        <div className="contents">
          <span className="text-slate-500 font-medium capitalize">Label / ID:</span>
          <span className="text-slate-900 font-bold text-right">
            {data.label || 'N/A'}
          </span>
        </div>
        
        {data.type === 'flowBoundary' && (
          <div className="contents">
            <span className="text-slate-500 font-medium capitalize">Schedule Number:</span>
            <span className="text-slate-900 font-bold text-right">
              {data.scheduleNumber || '0'}
            </span>
          </div>
        )}

        {entries.map(([key, value]) => {
          const unitStr = getUnit(key);
          const label = getLabel(key);
          return (
            <div key={key} className="contents">
              <span className="text-slate-500 font-medium capitalize">{label}:</span>
              <span className="text-slate-900 font-bold text-right">
                {key === 'shape' && Array.isArray(value) 
                  ? (
                    <div className="flex flex-col items-end mt-0.5">
                      {value.map((v: any, i: number) => (
                        <span key={i} className="leading-tight">
                          (E:{v.e}, A:{v.a}){i < value.length - 1 ? ',' : ''}
                        </span>
                      ))}
                    </div>
                  )
                  : (typeof value === 'number' ? value : String(value))
                }
                {unitStr && <span className="ml-0.5 text-[9px] font-normal text-slate-400">{unitStr}</span>}
              </span>
            </div>
          );
        })}
      </div>

      {data.type === 'flowBoundary' && data.schedulePoints && data.schedulePoints.length > 0 && (
        <div className="mt-2 pt-2 border-t border-slate-100">
          <div className="text-[9px] font-bold text-slate-400 uppercase mb-1">Queue Schedule Points:</div>
          <div className="space-y-0.5">
            {data.schedulePoints.map((p: any, i: number) => (
              <div key={i} className="flex justify-between text-[10px]">
                <span className="text-slate-500">T: {p.time}s</span>
                <span className="text-slate-900 font-bold">Q: {p.flow} {getUnit('flow')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
