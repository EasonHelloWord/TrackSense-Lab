import type { SensorValue } from '../types';
export const SENSOR_WEIGHTS=[-3.5,-2.5,-1.5,-.5,.5,1.5,2.5,3.5];
export function linePosition(values:SensorValue[]){const hit=values.reduce<number>((a,v,i)=>a+(v?SENSOR_WEIGHTS[i]:0),0);const count=values.filter(Boolean).length;return {position:count?hit/count:null,count,allBlack:count===8};}
