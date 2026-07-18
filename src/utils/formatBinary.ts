import type { SensorValue } from '../controllers/types';
export const binary=(v:SensorValue[])=>v.join(''); export const hex=(v:SensorValue[])=>`0x${parseInt(binary(v),2).toString(16).toUpperCase().padStart(2,'0')}`;
