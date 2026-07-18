export type SensorValue=0|1;
export interface SensorFrame { values:[SensorValue,SensorValue,SensorValue,SensorValue,SensorValue,SensorValue,SensorValue,SensorValue]; timestamp:number; deltaTime:number; }
export interface MotorCommand { leftSpeed:number; rightSpeed:number; }
export interface ControllerResult { motorCommand:MotorCommand; error:number|null; linePosition:number|null; actionLabel:string; explanation:string; activeCodeLines?:number[]; debugValues:Record<string,number|string|boolean|null|undefined>; }
export interface ControllerContext { previousError:number; integral:number; lastValidDirection:-1|0|1; lostLineFrames:number; }
export interface ParameterDefinition { key:string; label:string; description?:string; type:'number'|'range'|'boolean'|'select'|'code'; defaultValue:number|boolean|string; min?:number; max?:number; step?:number; options?:{label:string;value:string}[]; }
export interface LineController { id:string; name:string; description:string; parameterDefinitions:ParameterDefinition[]; presets:{name:string; values:Record<string,number|boolean|string>}[]; createInitialContext():ControllerContext; update(frame:SensorFrame,parameters:Record<string,number|boolean|string>,context:ControllerContext):{result:ControllerResult;nextContext:ControllerContext}; getPseudoCode():string; getCCode():string; getTypeScriptCode():string; }
