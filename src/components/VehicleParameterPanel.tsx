import type { SimulationSettings } from '../simulation/types';
import { InlineNumber } from './InlineNumber';

const parameters: [keyof Pick<SimulationSettings, 'sensorSpacing' | 'sensorForwardOffset' | 'motorSpacing'>, string, number, number, number, string][] = [
  ['sensorSpacing', '传感器间距', 8, 28, 1, 'px'],
  ['sensorForwardOffset', '传感器前伸距离', 35, 105, 1, 'px'],
  ['motorSpacing', '左右电机间距', 70, 180, 2, 'px'],
];

export function VehicleParameterPanel({ settings, onChange }: { settings: SimulationSettings; onChange: (key: keyof SimulationSettings, value: number) => void }) {
  return <section className="panel"><h2>车身参数</h2><p>驱动轮轴位于车身中心；轮距越小，相同轮速差带来的转向越急。</p>{parameters.map(([key, label, min, max, step, unit]) => <label className="param" key={key}><span>{label}<InlineNumber label={label} value={settings[key]} min={min} max={max} step={step} suffix={unit} onChange={value => onChange(key, value)} /></span><input type="range" min={min} max={max} step={step} value={settings[key]} onChange={event => onChange(key, Number(event.target.value))} /></label>)}</section>;
}
