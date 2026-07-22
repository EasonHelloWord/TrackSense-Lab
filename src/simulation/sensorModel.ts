import type { SensorValue } from '../controllers/types';
import { isOnTrack } from './trackGenerator';
import type { SimulationSettings, TrackPreset } from './types';
import { sensorPositions } from './vehicleGeometry';

/**
 * 传感器固定在前景车身层。将固定点反变换到地图平面，再查询黑线。
 * 这只是“传感器读取地图”，没有车辆碰撞、吸附或赛道约束。
 */
export function readSensors(preset: TrackPreset, mapX: number, mapY: number, rotation: number, settings: SimulationSettings, seed: number): [SensorValue,SensorValue,SensorValue,SensorValue,SensorValue,SensorValue,SensorValue,SensorValue] {
  const cos = Math.cos(rotation), sin = Math.sin(rotation);
  const values = sensorPositions(settings).map(({ x, y }, i) => {
    if (settings.disabledSensor === i) return 0;
    // 地图先绕固定车心旋转，再在地图局部坐标平移：localMap = R(-rotation)×sensorPoint - mapOffset。
    const mapSensorX = cos * x + sin * y - mapX;
    const mapSensorY = -sin * x + cos * y - mapY;
    let black = preset === 'finish' && mapSensorY < -270
      ? true
      : isOnTrack(preset, mapSensorX, mapSensorY, seed);
    if (settings.sensorNoise > 0 && Math.random() < settings.sensorNoise) black = !black;
    return black ? 1 : 0;
  }) as SensorValue[];
  return values as [SensorValue,SensorValue,SensorValue,SensorValue,SensorValue,SensorValue,SensorValue,SensorValue];
}
