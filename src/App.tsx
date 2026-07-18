import { useEffect, useRef, useState } from 'react';
import './custom.css';
import { controllerRegistry } from './controllers/controllerRegistry';
import type { LineController } from './controllers/types';
import { SimulationEngine, defaultSettings } from './simulation/simulationEngine';
import type { TrackPreset } from './simulation/types';
import { SimulationCanvas } from './components/SimulationCanvas';
import { AlgorithmParameterPanel } from './components/AlgorithmParameterPanel';
import { ManualInterventionPanel } from './components/ManualInterventionPanel';
import { SensorBar } from './components/SensorBar';
import { RealtimeStatusPanel } from './components/RealtimeStatusPanel';
import { CodeViewer } from './components/CodeViewer';

const defaults = (controller: LineController) => Object.fromEntries(controller.parameterDefinitions.map(definition => [definition.key, definition.defaultValue]));
const tracks: [TrackPreset, string][] = [['straight','直线'],['left','缓左弯'],['right','缓右弯'],['hardLeft','急左弯'],['hardRight','急右弯'],['s','S形弯'],['random','随机平滑'],['lost','丢线场景'],['finish','全黑终点']];

export default function App() {
  const [controller, setController] = useState(controllerRegistry[0]);
  const [parameters, setParameters] = useState<Record<string, number | boolean | string>>(() => defaults(controllerRegistry[0]));
  const engine = useRef(new SimulationEngine(controllerRegistry[0], defaults(controllerRegistry[0])));
  const [running, setRunning] = useState(false), [teacher, setTeacher] = useState(true), [autoReset, setAutoReset] = useState(false), [, forceRender] = useState(0), [initial, setInitial] = useState('center');
  const refresh = () => forceRender(value => value + 1);

  useEffect(() => { let frame = 0, previous = 0, accumulator = 0; const loop = (time: number) => { if (running) { accumulator += Math.min(.1, (time - previous) / 1000); while (accumulator >= .04) { engine.current.step(.04); accumulator -= .04; } refresh(); } previous = time; frame = requestAnimationFrame(loop); }; frame = requestAnimationFrame(loop); return () => cancelAnimationFrame(frame); }, [running]);
  const chooseController = (id: string) => { const selected = controllerRegistry.find(item => item.id === id)!; setRunning(false); const nextParameters = defaults(selected); engine.current.setController(selected, nextParameters); if (autoReset) engine.current.reset(); setController(selected); setParameters(nextParameters); refresh(); };
  const reset = () => { const offsets: Record<string, number> = { center: 0, left: -28, right: 28, hardLeft: -60, hardRight: 60, offline: 180 }; engine.current.clearManualOverride(); engine.current.reset(offsets[initial]); refresh(); };
  const nextFrame = () => { engine.current.step(); refresh(); };
  const result = engine.current.state.result;

  return <main>
    <header><div><h1>TrackSense Lab｜八路红外巡线算法实验室</h1><p>模块化控制器 · 本地二维仿真 · 面向高中生教学</p></div><div className="header-controls"><label>当前算法 <select value={controller.id} onChange={event => chooseController(event.target.value)}>{controllerRegistry.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><button className="primary" onClick={() => setRunning(value => !value)}>{running ? '暂停' : '开始'}</button><button onClick={nextFrame}>下一帧</button><button onClick={() => { setRunning(false); engine.current.previous(); refresh(); }}>上一帧</button><button onClick={reset}>重置</button></div></header>
    <div className="modebar"><label><input type="checkbox" checked={teacher} onChange={event => setTeacher(event.target.checked)} /> 教师模式</label><label><input type="checkbox" checked={autoReset} onChange={event => setAutoReset(event.target.checked)} /> 切换算法时自动重置场景</label><span>控制周期 40 ms　·　历史记录 {engine.current.history.length}/100</span></div>
    <div className="grid">
      <aside><AlgorithmParameterPanel controller={controller} parameters={parameters} onChange={next => { setParameters(next); engine.current.parameters = next; refresh(); }} /><section className="panel"><h2>场景与起点</h2><label className="selectlabel">赛道预设<select value={engine.current.preset} onChange={event => { engine.current.setPreset(event.target.value as TrackPreset); refresh(); }}>{tracks.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label><label className="selectlabel">小车初始位置<select value={initial} onChange={event => setInitial(event.target.value)}><option value="center">正中间</option><option value="left">稍微偏左</option><option value="right">稍微偏右</option><option value="hardLeft">严重偏左</option><option value="hardRight">严重偏右</option><option value="offline">完全离线</option></select></label><button className="tiny" onClick={() => { engine.current.seed = Math.random() * 10; engine.current.setPreset('random'); refresh(); }}>重新生成随机赛道</button></section></aside>
      <section className="sim"><SimulationCanvas engine={engine.current} /><div className="explain"><strong>{result.explanation}</strong><span>地图位移 X {engine.current.state.mapOffsetX.toFixed(1)} / Y {engine.current.state.mapOffsetY.toFixed(1)} px</span></div></section>
      <aside><RealtimeStatusPanel engine={engine.current} running={running} /><SensorBar values={engine.current.state.sensorValues} disabled={engine.current.settings.disabledSensor} /><ManualInterventionPanel engine={engine.current} onStart={() => { setRunning(true); refresh(); }} onRelease={() => { setRunning(false); refresh(); }} />{teacher && <section className="panel"><h2>仿真器误差模型</h2>{[['motorJitter','电机抖动',0,20,.5],['leftEfficiency','左电机效率',.7,1.2,.01],['rightEfficiency','右电机效率',.7,1.2,.01],['sensorNoise','传感器误判概率',0,.3,.01]].map(([key,label,min,max,step]) => <label className="param" key={String(key)}><span>{label}<b>{String(engine.current.settings[key as keyof typeof defaultSettings])}</b></span><input type="range" min={Number(min)} max={Number(max)} step={Number(step)} value={Number(engine.current.settings[key as keyof typeof defaultSettings])} onChange={event => { (engine.current.settings as any)[key] = Number(event.target.value); refresh(); }} /></label>)}<label className="selectlabel">禁用传感器<select value={engine.current.settings.disabledSensor ?? ''} onChange={event => { engine.current.settings.disabledSensor = event.target.value === '' ? null : Number(event.target.value); refresh(); }}><option value="">无</option>{[1,2,3,4,5,6,7,8].map((number, index) => <option key={number} value={index}>S{number}</option>)}</select></label></section>}</aside>
    </div>
    <section className="codewrap"><h2>当前算法代码：{controller.name}</h2><CodeViewer controller={controller} lines={result.activeCodeLines} /></section>
    <section className="panel compare"><h2>算法对比</h2><table><thead><tr><th>对比项</th><th>分段控制</th><th>PID控制</th></tr></thead><tbody><tr><td>基本原理</td><td>按偏差范围选择固定轮速</td><td>根据连续误差计算修正量</td></tr><tr><td>参数数量</td><td>少，容易理解</td><td>较多，需要调参</td></tr><tr><td>运动表现</td><td>可能出现轮速跳变</td><td>通常更平滑</td></tr><tr><td>适合教学阶段</td><td>入门</td><td>进阶</td></tr></tbody></table><p>分段控制不是错误的方法；PID 参数不合适时同样可能振荡。两者使用相同传感器输入和仿真环境。</p></section>
  </main>;
}
