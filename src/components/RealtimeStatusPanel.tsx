import type { SimulationEngine } from '../simulation/simulationEngine';
import { Fragment } from 'react';

const display = (value: unknown) => value === null || value === undefined || value === '' ? '无' : String(value);

function debugFields(engine: SimulationEngine) {
  const controlMethod = String(engine.parameters.controlMethod);
  const fields = ['偏差算法', '控制量算法', '电机速度算法'];

  if (controlMethod === 'switch') return [...fields, '控制量 u', '开关强度'];
  if (controlMethod === 'segmented') return [...fields, '控制量 u', '分段修正量'];
  if (controlMethod === 'p') return [...fields, '控制量 u', 'P'];
  if (controlMethod === 'pd') return [...fields, '控制量 u', 'P', 'D'];
  if (controlMethod === 'pid') return [...fields, '控制量 u', 'P', 'I', 'D'];
  if (controlMethod === 'manual') return [...fields, '控制量 u', '手写控制量'];
  return fields;
}

export function RealtimeStatusPanel({engine,running}:{engine:SimulationEngine;running:boolean}){
  const s=engine.state,r=s.result;
  return <section className="panel"><h2>实时状态</h2><dl><dt>当前算法</dt><dd>{engine.controller.name}</dd><dt>当前帧 / 状态</dt><dd>{s.frame} / {running?'仿真中':'已暂停'}</dd><dt>黑线位置</dt><dd>{r.linePosition===null?'丢线':r.linePosition.toFixed(2)}</dd><dt>当前动作</dt><dd>{r.actionLabel}</dd><dt>目标轮速 L / R</dt><dd>{s.targetLeft.toFixed(1)} / {s.targetRight.toFixed(1)}</dd><dt>实际轮速 L / R</dt><dd>{s.actualLeft.toFixed(1)} / {s.actualRight.toFixed(1)}</dd>{debugFields(engine).map(key=><Fragment key={key}><dt>{key}</dt><dd>{display(r.debugValues[key])}</dd></Fragment>)}</dl></section>;
}
