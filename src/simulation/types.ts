import type { ControllerContext, ControllerResult, SensorValue } from '../controllers/types';
export type TrackPreset='straight'|'left'|'right'|'hardLeft'|'hardRight'|'s'|'random'|'lost'|'finish';
export interface SimulationSettings { motorJitter:number; motorResponseTime:number; leftEfficiency:number; rightEfficiency:number; sensorNoise:number; sensorDelay:number; disabledSensor:number|null; sensorSpacing:number; sensorForwardOffset:number; motorSpacing:number; }
/** 地图平面的位姿；车身层不拥有位姿，始终固定在画布中心。 */
export interface SimulationState { frame:number; time:number; mapOffsetX:number; mapOffsetY:number; mapRotation:number; /** 兼容旧状态面板：等同于地图 X 位移。 */ lateral:number; sensorValues:[SensorValue,SensorValue,SensorValue,SensorValue,SensorValue,SensorValue,SensorValue,SensorValue]; result:ControllerResult; targetLeft:number;targetRight:number;actualLeft:number;actualRight:number; }
export interface Snapshot {state:SimulationState; context:ControllerContext;}
