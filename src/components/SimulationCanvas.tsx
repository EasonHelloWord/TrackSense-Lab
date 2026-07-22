import { useEffect, useRef } from 'react';
import { trackPoints } from '../simulation/trackGenerator';
import type { SimulationEngine } from '../simulation/simulationEngine';
import { sensorArrayWidth, sensorPositions } from '../simulation/vehicleGeometry';

/** 前景车与背景地图严格分层：前景始终不变，背景仅使用 mapOffset/mapRotation。 */
export function SimulationCanvas({ engine, revision }: { engine: SimulationEngine; revision: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext('2d')!, dpr = devicePixelRatio;
    canvas.width = canvas.clientWidth * dpr; canvas.height = canvas.clientHeight * dpr; ctx.scale(dpr, dpr);
    // 固定小车位于地图正中偏下，为前方赛道保留更大的观察区域。
    const width = canvas.clientWidth, height = canvas.clientHeight, carY = height * .64, state = engine.state;
    ctx.fillStyle = '#e8f0f3'; ctx.fillRect(0, 0, width, height);

    // 地图层：旋转锚点固定在小车中心；地图位移发生在旋转后的地图局部坐标中。
    ctx.save(); ctx.translate(width / 2, carY); ctx.rotate(state.mapRotation); ctx.translate(state.mapOffsetX, state.mapOffsetY);
    ctx.strokeStyle = '#111b28'; ctx.lineWidth = 54; ctx.lineCap = 'round'; ctx.beginPath();
    trackPoints(engine.preset, engine.seed, engine.settings.loopRadius).forEach((point, index) => { if (index) ctx.lineTo(point.x, point.y); else ctx.moveTo(point.x, point.y); });
    ctx.stroke(); ctx.strokeStyle = '#56d6cf'; ctx.lineWidth = 2; ctx.setLineDash([7, 6]); ctx.lineDashOffset = state.mapOffsetY * .18; ctx.stroke(); ctx.setLineDash([]); ctx.restore();

    // 固定前景车身层：从不使用 mapOffset 或 mapRotation。
    const geometry = engine.settings, sensorY = -geometry.sensorForwardOffset, sensorWidth = sensorArrayWidth(geometry);
    const bodyWidth = Math.max(92, geometry.motorSpacing - 18), wheelX = geometry.motorSpacing / 2;
    ctx.save(); ctx.translate(width / 2, carY);
    // 采用教学示意图的极简平面风格：车体、车轮、传感器梁使用清晰的基础几何形状。
    const bodyHeight = 90, bodyTop = -45, wheelHeight = 76, wheelWidth = 11;
    ctx.fillStyle = '#204766'; ctx.fillRect(-bodyWidth / 2, bodyTop, bodyWidth, bodyHeight);
    ctx.fillStyle = '#071b2d'; ctx.fillRect(-wheelX - wheelWidth / 2, -wheelHeight / 2, wheelWidth, wheelHeight); ctx.fillRect(wheelX - wheelWidth / 2, -wheelHeight / 2, wheelWidth, wheelHeight);
    // 传感器梁略低于探头，形成和参考图一致的“圆点浮在横梁上”的读数关系。
    ctx.fillStyle = '#56d6cf'; ctx.fillRect(-sensorWidth / 2 - 10, sensorY + 5, sensorWidth + 20, 10);
    sensorPositions(geometry).forEach(({ x, y }, i) => {
      ctx.beginPath(); ctx.fillStyle = engine.settings.disabledSensor === i ? '#f2b35d' : state.sensorValues[i] ? '#46ded0' : '#90a4ae'; ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();
    ctx.fillStyle = '#17324d'; ctx.font = '12px monospace'; ctx.fillText('固定车身层 · 可移动赛道地图层', 14, 22);
  }, [engine, revision]);
  return <canvas className="simulation-canvas" ref={ref} />;
}
