import type { PointerEvent } from 'react';
import type { SimulationEngine } from '../simulation/simulationEngine';

type Direction = { label: string; left: number; right: number; className: string };
const directions: Direction[] = [
  { label: '前进', left: 55, right: 55, className: 'forward' },
  { label: '左转', left: -20, right: 52, className: 'left' },
  { label: '右转', left: 52, right: -20, className: 'right' },
  { label: '后退', left: -42, right: -42, className: 'backward' },
];

/** 按住时直接接管电机，松开后暂停；不会更改当前选择的巡线算法。 */
export function ManualInterventionPanel({ engine, onStart, onRelease }: { engine: SimulationEngine; onStart: () => void; onRelease: () => void }) {
  const engage = (event: PointerEvent<HTMLButtonElement>, direction: Direction) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    engine.setManualOverride(direction.left, direction.right, direction.label);
    onStart();
  };
  const release = () => { engine.clearManualOverride(); onRelease(); };
  const continueFollowing = () => { engine.clearManualOverride(); onStart(); };
  return <section className="panel intervention"><h2>手动介入</h2><p>跑偏时按住方向键直接接管电机；松开后暂停。点击“继续巡线”恢复当前算法。</p><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>{directions.map(direction => <button key={direction.label} style={direction.label==='前进'||direction.label==='后退'?{gridColumn:'1 / -1'}:undefined} onPointerDown={event => engage(event, direction)} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}>{direction.label}</button>)}</div><button className="primary" style={{marginTop:10,width:'100%'}} onClick={continueFollowing}>继续巡线</button></section>;
}
