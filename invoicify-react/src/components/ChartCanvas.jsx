import { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import { useTheme } from '../context/ThemeContext';

/**
 * Thin React wrapper around Chart.js.
 * Pass `config` (the full Chart.js config object). Re-renders when config or theme changes.
 */
export default function ChartCanvas({ config, height = 260 }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const { theme } = useTheme();

  useEffect(() => {
    if (!canvasRef.current) return;
    if (chartRef.current) chartRef.current.destroy();
    chartRef.current = new Chart(canvasRef.current.getContext('2d'), config);
    return () => {
      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
    };
  }, [config, theme]);

  return (
    <div style={{ height: height + 'px' }}>
      <canvas ref={canvasRef}></canvas>
    </div>
  );
}
