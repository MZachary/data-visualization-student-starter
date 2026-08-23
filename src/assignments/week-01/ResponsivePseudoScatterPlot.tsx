import { useEffect, useRef } from 'react';
import { select } from 'd3-selection';
import { scaleLinear } from 'd3-scale';
import { useDimensions } from './useDimensions';

interface DataPoint {
  x: number;
  y: number;
}

const data: DataPoint[] = [
  { x: 100, y: 100 },
  { x: 100, y: 150 },
  { x: 100, y: 200 },
  { x: 100, y: 250 },
  { x: 100, y: 300 },
  { x: 100, y: 350 },
  { x: 100, y: 400 },
  { x: 400, y: 100 },
  { x: 400, y: 150 },
  { x: 400, y: 200 },
  { x: 400, y: 250 },
  { x: 400, y: 300 },
  { x: 400, y: 350 },
  { x: 400, y: 400 },
  { x: 200, y: 250 },
  { x: 300, y: 250 },
  { x: 600, y: 100 },
  { x: 700, y: 100 },
  { x: 800, y: 100 },
  { x: 900, y: 100 },
  { x: 750, y: 150 },
  { x: 750, y: 200 },
  { x: 750, y: 250 },
  { x: 750, y: 300 },
  { x: 750, y: 350 },
  { x: 600, y: 400 },
  { x: 700, y: 400 },
  { x: 800, y: 400 },
  { x: 900, y: 400 },
];

const ORIGINAL_WIDTH = 960;
const ORIGINAL_HEIGHT = 500;
const RADIUS = 50;

export function ResponsivePseudoScatterPlot() {
  const svgRef = useRef<SVGSVGElement>(null);
  const { ref: divRef, dimensions } = useDimensions();

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || dimensions.width === 0 || dimensions.height === 0) return;

    const xScale = scaleLinear().domain([0, ORIGINAL_WIDTH]).range([0, dimensions.width]);

    const yScale = scaleLinear().domain([0, ORIGINAL_HEIGHT]).range([0, dimensions.height]);

    select(svg)
      .selectAll('circle')
      .data(data)
      .join('circle')
      .attr('cx', (d: DataPoint) => xScale(d.x))
      .attr('cy', (d: DataPoint) => yScale(d.y))
      .attr('r', RADIUS)
      .style('fill', 'lavender');
  }, [dimensions]);

  return (
    <div ref={divRef} className="relative w-full h-full">
      <svg
        ref={svgRef}
        className="absolute inset-0 w-full h-full"
        role="img"
        aria-label="Responsive scatter plot showing 6 data points"
      ></svg>
    </div>
  );
}
