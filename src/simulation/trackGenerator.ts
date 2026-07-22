import type { TrackPreset } from './types';

const closedPresets = new Set<TrackPreset>(['circle', 'ellipse', 'triangle', 'square', 'hexagon']);
export const isClosedTrack = (preset: TrackPreset) => closedPresets.has(preset);

/** 静态地图平面上的黑线中心；y 只属于地图坐标，不随小车重新生成。 */
export function trackX(preset: TrackPreset, y: number, seed = 1) {
  switch (preset) {
    case 'straight': return 0;
    case 'left': return -Math.min(110, Math.max(0, -y) * .34);
    case 'right': return Math.min(110, Math.max(0, -y) * .34);
    case 'hardLeft': return -125 * Math.tanh(Math.max(0, -y) / 135);
    case 'hardRight': return 125 * Math.tanh(Math.max(0, -y) / 135);
    case 's': return 78 * Math.sin(-y / 145);
    case 'random': return 58 * Math.sin(-y / 125 + seed) + 25 * Math.sin(-y / 54 + seed * 2);
    case 'circle': case 'ellipse': case 'triangle': case 'square': case 'hexagon': return 0;
    case 'lost': return y < -170 && y > -360 ? 260 : 0;
    case 'finish': return 0;
  }
}

/** 一次生成的赛道平面。直线类赛道无限延展，几何赛道为闭合路径。 */
const planeCache = new Map<string, { x: number; y: number }[]>();

function closedPoints(preset: TrackPreset, radius: number) {
  const centerY = -59;
  if (preset === 'circle' || preset === 'ellipse') {
    const radiusX = preset === 'circle' ? radius : radius * 1.28, radiusY = preset === 'circle' ? radius : radius * .66;
    return Array.from({ length: 121 }, (_, index) => { const angle = index / 120 * Math.PI * 2; return { x: -radiusX + radiusX * Math.cos(angle), y: centerY + radiusY * Math.sin(angle) }; });
  }
  const scale = radius / 160, point = (x: number, y: number) => ({ x: x * scale, y: centerY + y * scale });
  if (preset === 'triangle') return [point(0, -160), point(0, 160), point(-278, 0), point(0, -160)];
  if (preset === 'square') return [point(0, -160), point(0, 160), point(-320, 160), point(-320, -160), point(0, -160)];
  return [point(0, -80), point(0, 80), point(-139, 160), point(-278, 80), point(-278, -80), point(-139, -160), point(0, -80)];
}

/**
 * 约 20 万 px 的双向地图平面（教学速度下可连续运行十余分钟）。
 * 按预设和随机种子缓存，运行中不会因前进距离再次生成或突然缺失。
 */
export function trackPoints(preset: TrackPreset, seed: number, loopRadius = 160) {
  const key = `${preset}:${seed}:${loopRadius}`;
  const cached = planeCache.get(key);
  if (cached) return cached;
  const points: { x: number; y: number }[] = isClosedTrack(preset) ? closedPoints(preset, loopRadius) : [];
  if (!points.length) for (let y = -100000; y <= 100000; y += 20) points.push({ x: trackX(preset, y, seed), y });
  planeCache.set(key, points);
  return points;
}

function segmentDistance(x: number, y: number, a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = b.x - a.x, dy = b.y - a.y, lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared ? Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / lengthSquared)) : 0;
  return Math.hypot(x - (a.x + dx * t), y - (a.y + dy * t));
}

/** 传感器到闭环赛道任一线段的最短距离；直线类仍用解析函数以保持高效。 */
export function isOnTrack(preset: TrackPreset, x: number, y: number, seed: number, halfWidth = 27, loopRadius = 160) {
  if (!isClosedTrack(preset)) return Math.abs(trackX(preset, y, seed) - x) < halfWidth;
  const points = trackPoints(preset, seed, loopRadius);
  return points.slice(1).some((point, index) => segmentDistance(x, y, points[index], point) < halfWidth);
}
