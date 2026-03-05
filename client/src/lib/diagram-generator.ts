import { WhamoNode, WhamoEdge } from './store';

export function generateSystemDiagramSVG(nodes: WhamoNode[], edges: WhamoEdge[], options: { showLabels: boolean } = { showLabels: true }) {
  // 1. Better horizontal layout algorithm
  const spacingX = 180;
  const spacingY = 140;
  
  // Create a copy of nodes to not mutate store
  const diagramNodes = [...nodes];
  
  // Identify start nodes (nodes with no incoming edges)
  const sourceNodes = diagramNodes.filter(n => !edges.some(e => e.target === n.id));
  
  // Build adjacency list for layout
  const adj: Record<string, string[]> = {};
  edges.forEach(e => {
    if (!adj[e.source]) adj[e.source] = [];
    adj[e.source].push(e.target);
  });

  // Assign levels (columns) based on distance from source nodes
  const levels: Record<string, number> = {};
  const queue: string[] = sourceNodes.length > 0 ? sourceNodes.map(s => s.id) : (diagramNodes.length > 0 ? [diagramNodes[0].id] : []);
  
  sourceNodes.forEach(s => levels[s.id] = 0);
  if (sourceNodes.length === 0 && diagramNodes.length > 0) {
    levels[diagramNodes[0].id] = 0;
  }

  while (queue.length > 0) {
    const u = queue.shift()!;
    const neighbors = adj[u] || [];
    neighbors.forEach(v => {
      if (levels[v] === undefined) {
        levels[v] = levels[u] + 1;
        queue.push(v);
      } else {
        levels[v] = Math.max(levels[v], levels[u] + 1);
      }
    });
  }

  // Ensure all nodes have a level even if not reachable from sources
  diagramNodes.forEach(n => {
    if (levels[n.id] === undefined) {
      levels[n.id] = 0;
    }
  });

  // Group nodes by level
  const levelsMap: Record<number, string[]> = {};
  diagramNodes.forEach(n => {
    const lvl = levels[n.id] || 0;
    if (!levelsMap[lvl]) levelsMap[lvl] = [];
    levelsMap[lvl].push(n.id);
  });

  // Assign horizontal positions based on level, and vertical based on index in level
  const posMap: Record<string, {x: number, y: number}> = {};
  let maxNodesInLevel = 0;
  Object.entries(levelsMap).forEach(([lvlStr, nodeIds]) => {
    maxNodesInLevel = Math.max(maxNodesInLevel, nodeIds.length);
  });

  const numLevels = Object.keys(levelsMap).length;
  const svgWidth = Math.max(1300, (numLevels + 1) * spacingX);
  const svgHeight = Math.max(750, (maxNodesInLevel + 1) * spacingY);

  Object.entries(levelsMap).forEach(([lvlStr, nodeIds]) => {
    const lvl = parseInt(lvlStr);
    const levelHeight = nodeIds.length * spacingY;
    const startY = (svgHeight - levelHeight) / 2 + spacingY / 2;
    
    nodeIds.forEach((id, idx) => {
      posMap[id] = {
        x: 80 + lvl * spacingX,
        y: startY + idx * spacingY
      };
    });
  });

  const findNode = (id: string) => nodes.find(n => n.id === id);

  let svgContent = `
    <svg id="system-diagram-svg" viewBox="0 0 ${svgWidth} ${svgHeight}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" class="w-full h-full bg-white">
      <style>
        .diagram-edge, .node { cursor: pointer; }
        .diagram-edge:hover path { stroke-width: 5; stroke: #2980b9; }
        .node:hover rect, .node:hover circle, .node:hover path { stroke-width: 4; stroke: #2c3e50; }
      </style>
      <defs>
        <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
          <polygon points="0 0, 10 3, 0 6" fill="#3498db" />
        </marker>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="2" />
          <feOffset dx="1" dy="1" result="offsetblur" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.3" />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
  `;

  // Draw Edges (Pipes)
  edges.forEach(edge => {
    const sourceNode = findNode(edge.source);
    const targetNode = findNode(edge.target);
    if (!sourceNode || !targetNode) return;

    const p1 = posMap[edge.source];
    const p2 = posMap[edge.target];
    if (!p1 || !p2) return;

    const x1 = p1.x;
    const y1 = p1.y;
    const x2 = p2.x;
    const y2 = p2.y;

    const isDummy = edge.data?.type === 'dummy';
    const className = isDummy ? 'stroke="#94a3b8" stroke-width="2" stroke-dasharray="8,8"' : 'stroke="#3498db" stroke-width="3"';
    const marker = isDummy ? '' : 'marker-end="url(#arrowhead)"';

    // Prepare tooltip data
    const edgeData = (edge.data || {}) as any;
    const tooltipText = [
      "ID: " + edge.id,
      "Type: " + (edgeData.type || 'N/A'),
      edgeData.length !== undefined ? "Length: " + edgeData.length : null,
      edgeData.diameter !== undefined ? "Diameter: " + edgeData.diameter : null,
      edgeData.celerity !== undefined ? "Celerity: " + edgeData.celerity : null,
      edgeData.friction !== undefined ? "Friction: " + edgeData.friction : null,
      edgeData.comment ? "Comment: " + edgeData.comment : null
    ].filter(Boolean).join(' | ');

    const dx = x2 - x1;
    const dy = y2 - y1;
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const path = `M ${x1} ${y1} Q ${mx} ${my - dy * 0.1} ${x2} ${y2}`;

    svgContent += `
      <g class="diagram-edge">
        <title>${tooltipText}</title>
        <path d="${path}" ${className} ${marker} fill="none" />
        <path d="${path}" stroke="transparent" stroke-width="20" fill="none" />
      </g>
    `;
    
    // Label with background to ensure readability
    if (options.showLabels) {
      const label = edgeData.label || edgeData.pipeId || '';
      if (label) {
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2 - 15;
        
        // Only display the label name
        const boxWidth = label.length * 8 + 12;

        svgContent += `
          <g>
            <rect x="${midX - boxWidth/2}" y="${midY - 12}" width="${boxWidth}" height="24" fill="white" fill-opacity="0.9" rx="4" stroke="#bdc3c7" stroke-width="1" />
            <text x="${midX}" y="${midY + 4}" font-size="10" fill="#2c3e50" font-weight="bold" text-anchor="middle">${label}</text>
          </g>
        `;
      }
    }
  });

  // Draw Nodes
  diagramNodes.forEach(node => {
    const pos = posMap[node.id];
    if (!pos) return;
    const { x, y } = pos;
    const nodeData = (node.data || {}) as any;
    const label = nodeData.label || '';
    const nodeNum = nodeData.nodeNumber || node.id;
    const elev = nodeData.elevation !== undefined ? nodeData.elevation : '';

    // Prepare tooltip data
    const tooltipText = [
      "ID: " + node.id,
      "Type: " + node.type,
      "Label: " + label,
      "Node #: " + nodeNum,
      elev !== '' ? "Elevation: " + elev : null,
      nodeData.topElevation !== undefined ? "Top Elev: " + nodeData.topElevation : null,
      nodeData.bottomElevation !== undefined ? "Bottom Elev: " + nodeData.bottomElevation : null,
      nodeData.diameter !== undefined ? "Diameter: " + nodeData.diameter : null,
      nodeData.celerity !== undefined ? "Celerity: " + nodeData.celerity : null,
      nodeData.friction !== undefined ? "Friction: " + nodeData.friction : null,
      nodeData.scheduleNumber !== undefined ? "Schedule: " + nodeData.scheduleNumber : null,
      nodeData.comment ? "Comment: " + nodeData.comment : null
    ].filter(Boolean).join(' | ');

    const nodeLabel = options.showLabels ? `Node ${nodeNum}` : '';
    const nodeLabelColor = "#94a3b8"; // Grey color for node identifier

    if (node.type === 'reservoir') {
      svgContent += `
        <g class="node" filter="url(#shadow)">
          <title>${tooltipText}</title>
          <rect x="${x - 25}" y="${y - 20}" width="50" height="40" fill="#3498db" stroke="#2980b9" stroke-width="2" rx="4" />
          <text x="${x}" y="${y + 5}" text-anchor="middle" fill="white" font-size="12" font-weight="bold">${label || 'HW'}</text>
          ${nodeLabel ? `<text x="${x}" y="${y - 30}" text-anchor="middle" fill="${nodeLabelColor}" font-size="10" font-weight="bold">${nodeLabel}</text>` : ''}
        </g>
      `;
    } else if (node.type === 'surgeTank') {
      svgContent += `
        <g class="node" filter="url(#shadow)">
          <title>${tooltipText}</title>
          <rect x="${x - 20}" y="${y - 30}" width="40" height="60" fill="#f39c12" stroke="#e67e22" stroke-width="2" rx="4" />
          <text x="${x}" y="${y + 5}" text-anchor="middle" fill="white" font-size="11" font-weight="bold">ST</text>
          ${nodeLabel ? `<text x="${x}" y="${y - 40}" text-anchor="middle" fill="${nodeLabelColor}" font-size="10" font-weight="bold">${nodeLabel}</text>` : ''}
        </g>
      `;
    } else if (node.type === 'flowBoundary') {
      svgContent += `
        <g class="node" filter="url(#shadow)">
          <title>${tooltipText}</title>
          <path d="M ${x-25} ${y-15} L ${x+25} ${y} L ${x-25} ${y+15} Z" fill="#2ecc71" stroke="#27ae60" stroke-width="2" />
          <text x="${x - 5}" y="${y + 4}" text-anchor="middle" fill="white" font-size="10" font-weight="bold">${label || 'FB'}</text>
          ${nodeLabel ? `<text x="${x}" y="${y + 30}" text-anchor="middle" fill="${nodeLabelColor}" font-size="10" font-weight="bold">${nodeLabel}</text>` : ''}
        </g>
      `;
    } else if (node.type === 'junction') {
      svgContent += `
        <g class="node" filter="url(#shadow)">
          <title>${tooltipText}</title>
          <circle cx="${x}" cy="${y}" r="8" fill="#e74c3c" stroke="#c0392b" stroke-width="2" />
          ${nodeLabel ? `<text x="${x}" y="${y - 15}" text-anchor="middle" fill="${nodeLabelColor}" font-size="10" font-weight="bold">${nodeLabel}</text>` : ''}
        </g>
      `;
    } else {
      svgContent += `
        <g class="node">
          <title>${tooltipText}</title>
          <circle cx="${x}" cy="${y}" r="6" fill="#95a5a6" stroke="#7f8c8d" stroke-width="2" />
          ${nodeLabel ? `<text x="${x}" y="${y - 15}" text-anchor="middle" fill="${nodeLabelColor}" font-size="10">${nodeLabel}</text>` : ''}
        </g>
      `;
    }
  });

  // Add Legend/Indicator Box
  const legendY = svgHeight - 60;
  const legendX = 80;
  svgContent += `
    <g transform="translate(${legendX}, ${legendY})">
      <rect x="-10" y="-10" width="600" height="50" fill="white" fill-opacity="0.9" rx="8" stroke="#ecf0f1" stroke-width="1" />
      
      <g transform="translate(0, 15)">
        <rect x="0" y="-8" width="20" height="16" fill="#3498db" rx="2" />
        <text x="25" y="5" font-size="12" fill="#7f8c8d" font-weight="bold">RESERVOIR</text>
      </g>
      
      <g transform="translate(130, 15)">
        <rect x="0" y="-10" width="15" height="20" fill="#f39c12" rx="2" />
        <text x="20" y="5" font-size="12" fill="#7f8c8d" font-weight="bold">SURGE TANK</text>
      </g>
      
      <g transform="translate(260, 15)">
        <circle cx="8" cy="0" r="8" fill="#e74c3c" />
        <text x="22" y="5" font-size="12" fill="#7f8c8d" font-weight="bold">NODE/JUNCTION</text>
      </g>
      
      <g transform="translate(410, 15)">
        <path d="M 0 -8 L 20 0 L 0 8 Z" fill="#2ecc71" />
        <text x="25" y="5" font-size="12" fill="#7f8c8d" font-weight="bold">FLOW BOUNDARY</text>
      </g>
    </g>
  `;

  svgContent += `</svg>`;
  return svgContent;
}

export const generateSystemDiagram = generateSystemDiagramSVG;
