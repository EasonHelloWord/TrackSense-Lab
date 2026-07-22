import type { SimulationSettings } from './types';

/** 车体局部坐标：驱动轮轴位于原点，车头指向负 Y。 */
export function sensorPositions(settings: SimulationSettings) {
  return Array.from({ length: 8 }, (_, index) => ({
    x: (index - 3.5) * settings.sensorSpacing,
    y: -settings.sensorForwardOffset,
  }));
}

export function sensorArrayWidth(settings: SimulationSettings) {
  return settings.sensorSpacing * 7;
}
