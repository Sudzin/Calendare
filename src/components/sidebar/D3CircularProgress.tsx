import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface D3CircularProgressProps {
  completed: number;
  pending: number;
  total: number;
  size?: number;
  strokeWidth?: number;
  showText?: boolean;
  className?: string;
}

export const D3CircularProgress: React.FC<D3CircularProgressProps> = ({
  completed,
  pending,
  total,
  size = 42,
  strokeWidth = 4,
  showText = true,
  className = '',
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const prevAngleRef = useRef<number>(0);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = size;
    const height = size;
    const radius = Math.min(width, height) / 2;
    const stroke = strokeWidth;
    const innerRadius = radius - stroke;
    const outerRadius = radius;

    const g = svg
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .append('g')
      .attr('transform', `translate(${width / 2}, ${height / 2})`);

    const twoPi = 2 * Math.PI;
    const ratio = total > 0 ? Math.min(1, Math.max(0, completed / total)) : 0;
    const targetAngle = ratio * twoPi;

    // Background track arc (represents baseline)
    const backgroundArc = d3.arc<any>()
      .innerRadius(innerRadius)
      .outerRadius(outerRadius)
      .startAngle(0)
      .endAngle(twoPi);

    g.append('path')
      .attr('d', backgroundArc({}))
      .attr('fill', 'var(--color-border-glass)')
      .attr('opacity', 0.65);

    // Active (pending) tasks arc: visualizes the active workload portion of the ring
    if (pending > 0 && total > 0) {
      const pendingArc = d3.arc<any>()
        .innerRadius(innerRadius)
        .outerRadius(outerRadius)
        .startAngle(targetAngle)
        .endAngle(twoPi)
        .cornerRadius(stroke / 2);

      g.append('path')
        .attr('d', pendingArc({}))
        .attr('fill', 'var(--color-accent)')
        .attr('opacity', 0.25);
    }

    // Progress arc for completed tasks
    const progressArc = d3.arc<any>()
      .innerRadius(innerRadius)
      .outerRadius(outerRadius)
      .startAngle(0)
      .cornerRadius(completed > 0 ? stroke / 2 : 0);

    if (targetAngle > 0) {
      const progressPath = g.append('path')
        .attr('fill', 'var(--color-accent)')
        .datum({ endAngle: prevAngleRef.current });

      progressPath
        .transition()
        .duration(450)
        .ease(d3.easeCubicOut)
        .attrTween('d', function(d: any) {
          const interpolate = d3.interpolate(d.endAngle, targetAngle);
          return function(t) {
            d.endAngle = interpolate(t);
            return progressArc(d) || '';
          };
        })
        .on('end', () => {
          prevAngleRef.current = targetAngle;
        });
    } else {
      prevAngleRef.current = 0;
    }

    // Center ratio / percentage label
    if (showText) {
      const percent = Math.round(ratio * 100);
      const fontSize = size < 50 ? '10px' : size < 80 ? '14px' : '18px';
      
      g.append('text')
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'central')
        .attr('class', 'font-mono font-semibold tabular-nums')
        .attr('fill', 'var(--color-content-primary)')
        .attr('font-size', fontSize)
        .text(total === 0 ? '0%' : `${percent}%`);
    }
  }, [completed, pending, total, size, strokeWidth, showText]);

  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
      <svg ref={svgRef} className="overflow-visible block" />
    </div>
  );
};
