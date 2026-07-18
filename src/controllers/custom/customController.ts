import type { LineController } from '../types';
import { linePosition } from '../shared/linePosition';
import { speedLimit } from '../shared/speedLimit';

const example = `// 输入：input.sensors 是 8 个 0/1；input.linePosition 为黑线位置或 null
// 输出：return { leftSpeed, rightSpeed, actionLabel }
const error = input.linePosition ?? 0;
const correction = error * 18;
return {
  leftSpeed: 50 + correction,
  rightSpeed: 50 - correction,
  actionLabel: '我的比例控制'
};`;

type UserOutput = { leftSpeed?: unknown; rightSpeed?: unknown; actionLabel?: unknown };

/** 用户在浏览器本地编写的轻量控制器。异常不会中断仿真。 */
export const customController: LineController = {
  id: 'custom', name: '自定义代码控制', description: '编写自己的输入/输出规则，直接返回左右轮速度。',
  parameterDefinitions: [{ key: 'code', label: '自定义 JavaScript 控制代码', description: '输入 input，返回 { leftSpeed, rightSpeed, actionLabel }。默认示例可直接运行。', type: 'code', defaultValue: example }],
  presets: [{ name: '比例示例', values: { code: example } }, { name: '固定直行', values: { code: `return { leftSpeed: 50, rightSpeed: 50, actionLabel: '固定直行' };` } }],
  createInitialContext: () => ({ previousError: 0, integral: 0, lastValidDirection: 0, lostLineFrames: 0 }),
  update(frame, parameters, context) {
    const info = linePosition(frame.values);
    try {
      const run = new Function('input', `'use strict';\n${String(parameters.code ?? '')}`) as (input: Record<string, unknown>) => UserOutput;
      const output = run({ sensors: [...frame.values], binary: frame.values.join(''), linePosition: info.position, error: info.position, dt: frame.deltaTime, timestamp: frame.timestamp });
      const left = speedLimit(Number(output?.leftSpeed));
      const right = speedLimit(Number(output?.rightSpeed));
      if (!Number.isFinite(left) || !Number.isFinite(right)) throw new Error('leftSpeed 和 rightSpeed 必须是数字');
      return { result: { motorCommand: { leftSpeed: left, rightSpeed: right }, error: info.position, linePosition: info.position, actionLabel: typeof output.actionLabel === 'string' ? output.actionLabel : '自定义代码输出', explanation: '已执行当前自定义代码，并将返回值交给电机模型。', activeCodeLines: [1], debugValues: { '用户输入 sensors': frame.values.join(''), '用户输出左轮': left, '用户输出右轮': right } }, nextContext: { ...context, previousError: info.position ?? context.previousError } };
    } catch (error) {
      return { result: { motorCommand: { leftSpeed: 0, rightSpeed: 0 }, error: info.position, linePosition: info.position, actionLabel: '自定义代码错误，已停车', explanation: error instanceof Error ? error.message : '代码执行失败。', debugValues: { '代码状态': '错误' } }, nextContext: context };
    }
  },
  getPseudoCode: () => `输入 input = { sensors, linePosition, error, dt }\n执行用户代码\n读取 return { leftSpeed, rightSpeed, actionLabel }\n限幅后将左右轮速度交给电机模型`,
  getCCode: () => `// 浏览器自定义代码模式仅用于教学原型。\n// 移植到 STM32 时，请把同样的输入/输出规则改写为 C 函数。`,
  getTypeScriptCode: () => example,
};
