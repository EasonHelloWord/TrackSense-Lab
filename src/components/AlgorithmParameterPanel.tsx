import type { LineController } from '../controllers/types';

export function AlgorithmParameterPanel({controller,parameters,onChange}:{controller:LineController;parameters:Record<string,number|boolean|string>;onChange:(v:Record<string,number|boolean|string>)=>void}){
  const groups = ['偏差计算', '控制量', '电机速度', '通用保护'];
  return <section className="panel"><h2>变量编辑</h2>{groups.map(group => {
    const definitions = controller.parameterDefinitions.filter(d => d.group === group && d.type !== 'select' && (!d.visibleWhen || d.visibleWhen.values.includes(String(parameters[d.visibleWhen.key]))));
    if (!definitions.length) return null;
    const weightDefinitions = definitions.filter(d => d.key.startsWith('sensorWeight'));
    const otherDefinitions = definitions.filter(d => !d.key.startsWith('sensorWeight'));
    const renderParameter = (d: typeof definitions[number]) => <label className="param" key={d.key}><span>{d.label}{d.type!=='code'&&<b>{d.type==='boolean'?(parameters[d.key]?'开启':'关闭'):String(parameters[d.key])}</b>}</span>{d.description&&<small>{d.description}</small>}{d.type==='code'?<textarea className="code-input" spellCheck={false} value={String(parameters[d.key])} onChange={e=>onChange({...parameters,[d.key]:e.target.value})}/>:d.type==='boolean'?<input type="checkbox" checked={Boolean(parameters[d.key])} onChange={e=>onChange({...parameters,[d.key]:e.target.checked})}/>:<input type="range" min={d.min} max={d.max} step={d.step} value={Number(parameters[d.key])} onChange={e=>onChange({...parameters,[d.key]:Number(e.target.value)})}/>}</label>;
    return <div className="algorithm-variable-group" key={group}><h3>{group}</h3>{weightDefinitions.length > 0 && <div className="weight-editor"><p>二值加权平均法：直接键入每一路传感器的权重。</p><div className="weight-grid">{weightDefinitions.map((d,index)=><label className="weight-cell" key={d.key}><strong>S{index+1}</strong><input aria-label={d.label} type="number" inputMode="decimal" min={d.min} max={d.max} step={d.step} value={Number(parameters[d.key])} onFocus={event=>event.currentTarget.select()} onChange={event=>onChange({...parameters,[d.key]:Number(event.target.value)})}/></label>)}</div><small>负值代表左侧，正值代表右侧；按 Enter 或直接切换输入框即可生效。</small></div>}{otherDefinitions.map(renderParameter)}</div>;
  })}</section>;
}
