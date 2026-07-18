import { useEffect, useRef } from 'react';
import { trackPoints } from '../simulation/trackGenerator';
import type { SimulationEngine } from '../simulation/simulationEngine';

/** 前景车与背景地图严格分层：前景始终不变，背景仅使用 mapOffset/mapRotation。 */
export function SimulationCanvas({ engine }: { engine: SimulationEngine }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext('2d')!, dpr = devicePixelRatio;
    canvas.width = canvas.clientWidth * dpr; canvas.height = canvas.clientHeight * dpr; ctx.scale(dpr, dpr);
    const width = canvas.clientWidth, height = canvas.clientHeight, carY = height / 2 + 35, state = engine.state;
    ctx.fillStyle = '#e8f0f3'; ctx.fillRect(0, 0, width, height);

    // 地图层：旋转锚点固定在小车中心；地图位移发生在旋转后的地图局部坐标中。
    ctx.save(); ctx.translate(width / 2, carY); ctx.rotate(state.mapRotation); ctx.translate(state.mapOffsetX, state.mapOffsetY);
    ctx.strokeStyle = '#111b28'; ctx.lineWidth = 54; ctx.lineCap = 'round'; ctx.beginPath();
    trackPoints(engine.preset, engine.seed).forEach((point, index) => { if (index) ctx.lineTo(point.x, point.y); else ctx.moveTo(point.x, point.y); });
    ctx.stroke(); ctx.strokeStyle = '#56d6cf'; ctx.lineWidth = 2; ctx.setLineDash([7, 6]); ctx.lineDashOffset = state.mapOffsetY * .18; ctx.stroke(); ctx.setLineDash([]); ctx.restore();

    // 固定前景车身层：从不使用 mapOffset 或 mapRotation。
    ctx.save(); ctx.translate(width / 2, carY); ctx.fillStyle = '#163b59'; ctx.fillRect(-55, -45, 110, 90);
    ctx.fillStyle = '#071b2d'; ctx.fillRect(-64, -38, 11, 76); ctx.fillRect(53, -38, 11, 76); ctx.fillStyle = '#56d6cf'; ctx.fillRect(-31, -54, 62, 10);
    for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.fillStyle = engine.settings.disabledSensor === i ? '#f2b35d' : state.sensorValues[i] ? '#46ded0' : '#90a4ae'; ctx.arc(-52.5 + i * 15, -59, 5, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(0, -75); ctx.lineTo(-8, -63); ctx.lineTo(8, -63); ctx.fill(); ctx.restore();
    ctx.fillStyle = '#17324d'; ctx.font = '12px monospace'; ctx.fillText('固定车身层 · 可移动赛道地图层', 14, 22);
  }, [engine, engine.state.frame]);
  return <canvas className="simulation-canvas" ref={ref} />;
}
