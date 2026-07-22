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
import { VehicleParameterPanel } from './components/VehicleParameterPanel';

const defaults = (controller: LineController) => Object.fromEntries(controller.parameterDefinitions.map(definition => [definition.key, definition.defaultValue]));
const tracks: [TrackPreset, string][] = [['straight','直线'],['left','缓左弯'],['right','缓右弯'],['hardLeft','急左弯'],['hardRight','急右弯'],['s','S形弯'],['random','随机平滑'],['circle','圆形闭环'],['ellipse','椭圆闭环'],['triangle','三角形闭环'],['square','正方形闭环'],['hexagon','六边形闭环'],['lost','丢线场景'],['finish','全黑终点']];

export default function App() {
  const controller = controllerRegistry[0];
  const [parameters, setParameters] = useState<Record<string, number | boolean | string>>(() => defaults(controllerRegistry[0]));
  const engine = useRef(new SimulationEngine(controllerRegistry[0], defaults(controllerRegistry[0])));
  const [running, setRunning] = useState(false), [renderVersion, forceRender] = useState(0), [initial, setInitial] = useState('center');
  const refresh = () => forceRender(value => value + 1);

  useEffect(() => { let frame = 0, previous = 0, accumulator = 0; const loop = (time: number) => { if (running) { accumulator += Math.min(.1, (time - previous) / 1000); while (accumulator >= .04) { engine.current.step(.04); accumulator -= .04; } refresh(); } previous = time; frame = requestAnimationFrame(loop); }; frame = requestAnimationFrame(loop); return () => cancelAnimationFrame(frame); }, [running]);
  const chooseAlgorithm = (key: 'errorMethod'|'controlMethod'|'motorMethod', value: string) => { setRunning(false); const nextParameters = { ...parameters, [key]: value }; engine.current.parameters = nextParameters; setParameters(nextParameters); refresh(); };
  const reset = () => { const offsets: Record<string, number> = { center: 0, left: -28, right: 28, hardLeft: -60, hardRight: 60, offline: 180 }; engine.current.clearManualOverride(); engine.current.reset(offsets[initial]); refresh(); };
  const nextFrame = () => { engine.current.step(); refresh(); };
  const result = engine.current.state.result;

  return <main>
    <header><div><h1>TrackSense Lab｜八路红外巡线算法实验室</h1><p>偏差计算 → 控制量计算 → 电机速度分配</p></div><div className="header-controls algorithm-selectors"><label>偏差计算 <select value={String(parameters.errorMethod)} onChange={event => chooseAlgorithm('errorMethod', event.target.value)}><option value="state">状态匹配法</option><option value="weighted">二值加权平均法</option><option value="edge">左右边缘中点法</option><option value="manual">手写</option></select></label><label>控制量 <select value={String(parameters.controlMethod)} onChange={event => chooseAlgorithm('controlMethod', event.target.value)}><option value="switch">开关控制</option><option value="segmented">分段控制</option><option value="p">P控制</option><option value="pd">PD控制</option><option value="pid">PID控制</option><option value="manual">手写</option></select></label><label>电机速度 <select value={String(parameters.motorMethod)} onChange={event => chooseAlgorithm('motorMethod', event.target.value)}><option value="symmetric">双轮对称差速</option><option value="single">单轮减速</option><option value="reverse">反向差速</option><option value="manual">手写</option></select></label><button className="primary" onClick={() => setRunning(value => !value)}>{running ? '暂停' : '开始'}</button><button onClick={nextFrame}>下一帧</button><button onClick={() => { setRunning(false); engine.current.previous(); refresh(); }}>上一帧</button><button onClick={reset}>重置</button></div></header>
    <div className="modebar"><span>控制周期 40 ms　·　历史记录 {engine.current.history.length}/100</span></div>
    <div className="grid">
      <aside><AlgorithmParameterPanel controller={controller} parameters={parameters} onChange={next => { setParameters(next); engine.current.parameters = next; refresh(); }} /><VehicleParameterPanel settings={engine.current.settings} onChange={(key, value) => { (engine.current.settings as any)[key] = value; refresh(); }} /><section className="panel"><h2>场景与起点</h2><label className="selectlabel">赛道预设<select value={engine.current.preset} onChange={event => { engine.current.setPreset(event.target.value as TrackPreset); refresh(); }}>{tracks.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label><label className="selectlabel">小车初始位置<select value={initial} onChange={event => setInitial(event.target.value)}><option value="center">正中间</option><option value="left">稍微偏左</option><option value="right">稍微偏右</option><option value="hardLeft">严重偏左</option><option value="hardRight">严重偏右</option><option value="offline">完全离线</option></select></label><button className="tiny" onClick={() => { engine.current.seed = Math.random() * 10; engine.current.setPreset('random'); refresh(); }}>重新生成随机赛道</button></section></aside>
      <section className="sim"><SimulationCanvas engine={engine.current} revision={renderVersion} /><div className="explain"><strong>{result.explanation}</strong><span>地图位移 X {engine.current.state.mapOffsetX.toFixed(1)} / Y {engine.current.state.mapOffsetY.toFixed(1)} px</span></div></section>
      <aside><RealtimeStatusPanel engine={engine.current} running={running} /><SensorBar values={engine.current.state.sensorValues} disabled={engine.current.settings.disabledSensor} /><ManualInterventionPanel engine={engine.current} onStart={() => { setRunning(true); refresh(); }} onRelease={() => { setRunning(false); refresh(); }} /><section className="panel"><h2>仿真器误差模型</h2>{[['motorAcceleration','最大加速度（速度单位/秒）',20,400,5],['motorDeceleration','最大减速度（速度单位/秒）',20,500,5],['motorJitter','电机抖动',0,20,.5],['leftEfficiency','左电机效率',.7,1.2,.01],['rightEfficiency','右电机效率',.7,1.2,.01],['sensorNoise','传感器误判概率',0,.3,.01]].map(([key,label,min,max,step]) => <label className="param" key={String(key)}><span>{label}<b>{String(engine.current.settings[key as keyof typeof defaultSettings])}</b></span><input type="range" min={Number(min)} max={Number(max)} step={Number(step)} value={Number(engine.current.settings[key as keyof typeof defaultSettings])} onChange={event => { (engine.current.settings as any)[key] = Number(event.target.value); refresh(); }} /></label>)}<label className="selectlabel">禁用传感器<select value={engine.current.settings.disabledSensor ?? ''} onChange={event => { engine.current.settings.disabledSensor = event.target.value === '' ? null : Number(event.target.value); refresh(); }}><option value="">无</option>{[1,2,3,4,5,6,7,8].map((number, index) => <option key={number} value={index}>S{number}</option>)}</select></label></section></aside>
    </div>
    <section className="codewrap"><h2>组合算法代码</h2><CodeViewer controller={controller} parameters={parameters} lines={result.activeCodeLines} /></section>
    <section className="panel compare"><h2>当前组合</h2><table><thead><tr><th>阶段</th><th>当前选择</th><th>作用</th></tr></thead><tbody><tr><td>偏差计算</td><td>{String(parameters.errorMethod)}</td><td>将八路二值传感器读数转换为偏差。</td></tr><tr><td>控制量</td><td>{String(parameters.controlMethod)}</td><td>根据偏差计算转向控制量。</td></tr><tr><td>电机速度</td><td>{String(parameters.motorMethod)}</td><td>把控制量分配为左右轮目标速度。</td></tr></tbody></table><p>三个阶段可独立组合；切换为“手写”后，可在左侧变量编辑区修改相应 JavaScript 规则。</p></section>
  </main>;
}
