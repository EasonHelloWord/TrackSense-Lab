import type { TrackPreset } from './types';

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
    case 'lost': return y < -170 && y > -360 ? 260 : 0;
    case 'finish': return 0;
  }
}

/** 一次生成的“无限长”赛道平面。每帧只变换，不根据车辆位置重新采样。 */
const planeCache = new Map<string, { x: number; y: number }[]>();

/**
 * 约 20 万 px 的双向地图平面（教学速度下可连续运行十余分钟）。
 * 按预设和随机种子缓存，运行中不会因前进距离再次生成或突然缺失。
 */
export function trackPoints(preset: TrackPreset, seed: number) {
  const key = `${preset}:${seed}`;
  const cached = planeCache.get(key);
  if (cached) return cached;
  const points: { x: number; y: number }[] = [];
  for (let y = -100000; y <= 100000; y += 20) points.push({ x: trackX(preset, y, seed), y });
  planeCache.set(key, points);
  return points;
}
