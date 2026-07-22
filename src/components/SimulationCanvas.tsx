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
    trackPoints(engine.preset, engine.seed).forEach((point, index) => { if (index) ctx.lineTo(point.x, point.y); else ctx.moveTo(point.x, point.y); });
    ctx.stroke(); ctx.strokeStyle = '#56d6cf'; ctx.lineWidth = 2; ctx.setLineDash([7, 6]); ctx.lineDashOffset = state.mapOffsetY * .18; ctx.stroke(); ctx.setLineDash([]); ctx.restore();

    // 固定前景车身层：从不使用 mapOffset 或 mapRotation。
    const geometry = engine.settings, sensorY = -geometry.sensorForwardOffset, sensorWidth = sensorArrayWidth(geometry);
    const bodyWidth = Math.max(92, geometry.motorSpacing - 18), wheelX = geometry.motorSpacing / 2;
    ctx.save(); ctx.translate(width / 2, carY);
    // 轮胎在车身下方，驱动轮轴即车体局部坐标原点。
    ctx.fillStyle = '#071b2d'; ctx.beginPath(); ctx.roundRect(-wheelX - 8, -31, 16, 62, 5); ctx.roundRect(wheelX - 8, -31, 16, 62, 5); ctx.fill();
    // 俯视车身：尖头、驾驶舱和后部保险杠，让传感器横梁保持在车头前方。
    ctx.fillStyle = '#163b59'; ctx.strokeStyle = '#071b2d'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, -58); ctx.lineTo(-bodyWidth * .34, -42); ctx.lineTo(-bodyWidth * .45, 22); ctx.lineTo(-bodyWidth * .25, 41); ctx.lineTo(bodyWidth * .25, 41); ctx.lineTo(bodyWidth * .45, 22); ctx.lineTo(bodyWidth * .34, -42); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#2b6887'; ctx.beginPath(); ctx.moveTo(0, -43); ctx.lineTo(-bodyWidth * .23, -28); ctx.lineTo(-bodyWidth * .19, 7); ctx.lineTo(bodyWidth * .19, 7); ctx.lineTo(bodyWidth * .23, -28); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#56d6cf'; ctx.fillRect(-bodyWidth * .19, 24, bodyWidth * .38, 6);
    // 前置红外横梁与八个实际采样位置。
    ctx.fillStyle = '#56d6cf'; ctx.fillRect(-sensorWidth / 2 - 10, sensorY - 5, sensorWidth + 20, 10);
    sensorPositions(geometry).forEach(({ x, y }, i) => { ctx.beginPath(); ctx.fillStyle = engine.settings.disabledSensor === i ? '#f2b35d' : state.sensorValues[i] ? '#46ded0' : '#90a4ae'; ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill(); });
    ctx.strokeStyle = '#f2b35d'; ctx.fillStyle = '#17324d'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(-geometry.motorSpacing / 2, 47); ctx.lineTo(geometry.motorSpacing / 2, 47); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bodyWidth / 2 + 12, sensorY); ctx.lineTo(bodyWidth / 2 + 12, 0); ctx.stroke(); ctx.setLineDash([]);
    const firstSensor = -sensorWidth / 2, secondSensor = firstSensor + geometry.sensorSpacing;
    ctx.beginPath(); ctx.moveTo(firstSensor, sensorY - 15); ctx.lineTo(secondSensor, sensorY - 15); ctx.stroke(); ctx.setLineDash([]);
    ctx.font = '10px monospace'; ctx.textAlign = 'center'; ctx.fillText(`轮距 ${geometry.motorSpacing}px`, 0, 59); ctx.fillText(`间距 ${geometry.sensorSpacing}px`, (firstSensor + secondSensor) / 2, sensorY - 20); ctx.save(); ctx.translate(bodyWidth / 2 + 24, sensorY / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(`前伸 ${geometry.sensorForwardOffset}px`, 0, 0); ctx.restore();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(0, -68); ctx.lineTo(-8, -56); ctx.lineTo(8, -56); ctx.fill(); ctx.restore();
    ctx.fillStyle = '#17324d'; ctx.font = '12px monospace'; ctx.fillText('固定车身层 · 可移动赛道地图层', 14, 22);
  }, [engine, revision]);
  return <canvas className="simulation-canvas" ref={ref} />;
}
