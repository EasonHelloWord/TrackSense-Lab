import type { ControllerContext } from '../types';
export function lostLine(context:ControllerContext, speed:number, timeout:number){const frames=context.lostLineFrames+1;const direction=context.lastValidDirection||1;const stopped=frames>timeout;return {frames,command:stopped?{leftSpeed:0,rightSpeed:0}:direction<0?{leftSpeed:-speed,rightSpeed:speed}:{leftSpeed:speed,rightSpeed:-speed},stopped};}
