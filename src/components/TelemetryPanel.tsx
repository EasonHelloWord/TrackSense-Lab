import { useState } from 'react';
import type { SimulationEngine } from '../simulation/simulationEngine';

type Formula = { id: number; label: string; expression: string };
const initialFormulas: Formula[] = [
  { id: 1, label: '偏差 error', expression: 'error ?? 0' },
  { id: 2, label: '控制量 u', expression: 'u' },
  { id: 3, label: '左右实际速度差', expression: 'actualRight - actualLeft' },
  { id: 4, label: '平均实际速度', expression: '(actualLeft + actualRight) / 2' },
];

export function TelemetryPanel({ engine }: { engine: SimulationEngine }) {
  const [formulas, setFormulas] = useState(initialFormulas);
  const state = engine.state, result = state.result, sensors = state.sensorValues;
  const variables = {
    error: result.error, u: result.controlOutput ?? 0, linePosition: result.linePosition,
    targetLeft: state.targetLeft, targetRight: state.targetRight, actualLeft: state.actualLeft, actualRight: state.actualRight,
    frame: state.frame, time: state.time, mapX: state.mapOffsetX, mapY: state.mapOffsetY, mapRotation: state.mapRotation,
    sensors, s1: sensors[0], s2: sensors[1], s3: sensors[2], s4: sensors[3], s5: sensors[4], s6: sensors[5], s7: sensors[6], s8: sensors[7], debug: result.debugValues, parameters: engine.parameters, settings: engine.settings,
    ...engine.parameters, ...engine.settings,
  };
  const calculate = (expression: string) => {
    try {
      const run = new Function(...Object.keys(variables), `"use strict"; return (${expression});`) as (...values: unknown[]) => unknown;
      const value = run(...Object.values(variables));
      return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(3) : String(value);
    } catch { return '公式错误'; }
  };
  const update = (id: number, key: 'label' | 'expression', value: string) => setFormulas(items => items.map(item => item.id === id ? { ...item, [key]: value } : item));
  const baseRows: [string, string, unknown][] = [['error', '当前偏差', variables.error], ['u', '当前控制量', variables.u], ['linePosition', '黑线位置', variables.linePosition], ['targetLeft', '左轮目标速度', variables.targetLeft], ['targetRight', '右轮目标速度', variables.targetRight], ['actualLeft', '左轮实际速度', variables.actualLeft], ['actualRight', '右轮实际速度', variables.actualRight], ['sensors', '八路传感器数组', variables.sensors], ['s1 ... s8', '单路传感器值', variables.sensors.join(', ')], ['frame / time', '帧号 / 仿真时间', `${variables.frame} / ${variables.time.toFixed(2)}`], ['mapX / mapY / mapRotation', '地图位移与旋转', `${variables.mapX.toFixed(1)} / ${variables.mapY.toFixed(1)} / ${variables.mapRotation.toFixed(2)}`], ['sensorSpacing / sensorForwardOffset / motorSpacing', '车身几何参数', `${variables.sensorSpacing} / ${variables.sensorForwardOffset} / ${variables.motorSpacing}`], ['debug', '控制器调试对象', `${Object.keys(variables.debug).length} 项`], ['parameters', '全部算法参数对象', `${Object.keys(engine.parameters).length} 项`], ['settings', '全部仿真器设置对象', `${Object.keys(engine.settings).length} 项`]];
  const preview = (value: unknown) => { const text = Array.isArray(value) ? value.join(', ') : String(value); return text.length > 28 ? `${text.slice(0, 28)}…` : text; };
  return <section className="panel telemetry"><div className="telemetry-title"><h2>实时数据台</h2><button className="tiny" onClick={() => setFormulas(items => [...items, { id: Date.now(), label: '新数据', expression: '0' }])}>添加公式</button></div><div className="telemetry-grid">{formulas.map(formula => <div className="telemetry-item" key={formula.id}><input aria-label="数据名称" value={formula.label} onChange={event => update(formula.id, 'label', event.target.value)} /><output>{calculate(formula.expression)}</output><input aria-label="计算公式" className="formula-input" value={formula.expression} onChange={event => update(formula.id, 'expression', event.target.value)} /><button aria-label={`删除 ${formula.label}`} className="remove-formula" onClick={() => setFormulas(items => items.filter(item => item.id !== formula.id))}>×</button></div>)}</div><details><summary>可读变量与公式示例</summary><div className="variable-table-wrap"><table className="variable-table"><thead><tr><th>变量</th><th>说明</th><th>当前值</th></tr></thead><tbody>{baseRows.map(([name, description, value]) => <tr key={name}><td><code>{name}</code></td><td>{description}</td><td title={String(value)}>{preview(value)}</td></tr>)}{Object.entries(engine.parameters).map(([name, value]) => <tr key={`parameter-${name}`}><td><code>{name}</code></td><td>算法参数</td><td title={String(value)}>{preview(value)}</td></tr>)}{Object.entries(engine.settings).map(([name, value]) => <tr key={`setting-${name}`}><td><code>{name}</code></td><td>仿真器设置</td><td title={String(value)}>{preview(value)}</td></tr>)}</tbody></table></div><table className="formula-example-table"><thead><tr><th>公式示例</th><th>用途</th></tr></thead><tbody><tr><td><code>u / (Math.abs(error) + 0.1)</code></td><td>控制量与偏差的比值</td></tr><tr><td><code>(actualLeft + actualRight) / 2</code></td><td>平均实际速度</td></tr><tr><td><code>s1 + s2 + s3</code></td><td>前三路触发数量</td></tr><tr><td><code>parameters.kp * error</code></td><td>按当前 Kp 计算 P 项</td></tr><tr><td><code>settings.motorAcceleration * 0.04</code></td><td>单控制周期最大提速量</td></tr></tbody></table></details></section>;
}
