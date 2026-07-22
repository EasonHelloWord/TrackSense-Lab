import type { ControllerContext, LineController, SensorFrame, SensorValue } from '../types';
import { SENSOR_WEIGHTS, linePosition } from '../shared/linePosition';
import { lostLine } from '../shared/lostLine';
import { speedLimit } from '../shared/speedLimit';
import { clamp } from '../../utils/clamp';

type Parameters = Record<string, number | boolean | string>;
const number = (p: Parameters, key: string) => Number(p[key]);
const text = (p: Parameters, key: string) => String(p[key]);
const defaultErrorCode = `// input.sensors: 8 个 0/1；input.weights: 对应权重\n// return 一个数字，正数表示黑线偏右，负数表示偏左\nconst hit = input.sensors.filter(Boolean);\nreturn hit.length ? input.sensors.reduce((sum, value, index) => sum + (value ? input.weights[index] : 0), 0) / hit.length : null;`;
const defaultControlCode = `// input.error 是偏差，return 控制量（正数让左轮更快）\nreturn input.error * 18;`;
const defaultMotorCode = `// input 有 baseSpeed、correction、error，return { leftSpeed, rightSpeed }\nreturn {\n  leftSpeed: input.baseSpeed + input.correction,\n  rightSpeed: input.baseSpeed - input.correction,\n};`;

function stateMatch(values: SensorValue[]) {
  const binary = values.join('');
  const known: Record<string, number> = {
    '00011000': 0, '00110000': -1, '00001100': 1, '01100000': -2, '00000110': 2,
    '11000000': -3, '00000011': 3, '00111000': -.5, '00011100': .5,
  };
  if (binary in known) return known[binary];
  return linePosition(values).position;
}

function configuredWeights(p: Parameters) { return SENSOR_WEIGHTS.map((weight, index) => { const value = number(p, `sensorWeight${index + 1}`); return Number.isFinite(value) ? value : weight; }); }

function edgeMidpoint(values: SensorValue[]) {
  const hit = values.map((value, index) => value ? index : -1).filter(index => index >= 0);
  if (!hit.length) return null;
  return (SENSOR_WEIGHTS[hit[0]] + SENSOR_WEIGHTS[hit[hit.length - 1]]) / 2;
}

function calculateError(frame: SensorFrame, p: Parameters) {
  const method = text(p, 'errorMethod');
  const fallback = linePosition(frame.values).position;
  try {
    if (method === 'state') { const value = stateMatch(frame.values); return { value: value === null ? null : value * number(p, 'stateMatchGain'), label: '状态匹配法' }; }
    if (method === 'weighted') {
      const weights = configuredWeights(p), count = frame.values.filter(Boolean).length;
      return { value: count ? frame.values.reduce<number>((sum, value, index) => sum + (value ? weights[index] : 0), 0) / count : null, label: '二值加权平均法' };
    }
    if (method === 'edge') { const value = edgeMidpoint(frame.values); return { value: value === null ? null : value + number(p, 'edgeOffset'), label: '左右边缘中点法' }; }
    if (method === 'manual') {
      const result = new Function('input', `'use strict';\n${text(p, 'errorCode')}`)({ sensors: [...frame.values], binary: frame.values.join(''), weights: SENSOR_WEIGHTS });
      const value = result === null ? null : Number(result);
      if (value !== null && !Number.isFinite(value)) throw new Error('偏差必须是数字或 null');
      return { value, label: '手写偏差算法' };
    }
    return { value: fallback, label: '二值加权平均法' };
  } catch (error) { return { value: fallback, label: `手写偏差错误：${error instanceof Error ? error.message : '无效输出'}` }; }
}

function calculateCorrection(error: number, frame: SensorFrame, p: Parameters, context: ControllerContext) {
  const method = text(p, 'controlMethod');
  const dt = Math.max(frame.deltaTime, .001);
  if (method === 'switch') {
    const correction = error === 0 ? 0 : Math.sign(error) * number(p, 'switchStrength');
    return { correction, integral: context.integral, action: correction ? '开关控制' : '居中直行', debug: { '开关强度': number(p, 'switchStrength') } };
  }
  if (method === 'segmented') {
    const magnitude = Math.abs(error), correction = magnitude <= number(p, 'centerThreshold') ? 0 : Math.sign(error) * (magnitude > number(p, 'hardThreshold') ? number(p, 'hardStrength') : number(p, 'segmentStrength'));
    return { correction, integral: context.integral, action: correction ? '分段控制' : '居中直行', debug: { '分段修正量': correction } };
  }
  if (method === 'manual') {
    const result = new Function('input', `'use strict';\n${text(p, 'controlCode')}`)({ error, dt, previousError: context.previousError, integral: context.integral, sensors: [...frame.values] });
    const correction = Number(result);
    if (!Number.isFinite(correction)) throw new Error('控制量必须是数字');
    return { correction: clamp(correction, -number(p, 'correctionLimit'), number(p, 'correctionLimit')), integral: context.integral, action: '手写控制量', debug: { '手写控制量': correction } };
  }
  const useIntegral = method === 'pid';
  const useDerivative = method === 'pd' || method === 'pid';
  const integral = useIntegral ? clamp(context.integral + error * dt, -number(p, 'integralLimit'), number(p, 'integralLimit')) : 0;
  const derivative = useDerivative ? (error - context.previousError) / dt : 0;
  const P = number(p, 'kp') * error, I = useIntegral ? number(p, 'ki') * integral : 0, D = useDerivative ? number(p, 'kd') * derivative : 0;
  const correction = clamp(P + I + D, -number(p, 'correctionLimit'), number(p, 'correctionLimit'));
  return { correction, integral, action: method.toUpperCase() + ' 控制', debug: { P: P.toFixed(2), I: I.toFixed(2), D: D.toFixed(2), '控制量': correction.toFixed(2) } };
}

function toMotorSpeeds(correction: number, error: number, p: Parameters) {
  const method = text(p, 'motorMethod'), baseSpeed = number(p, 'baseSpeed');
  if (method === 'single') return error < 0 ? { leftSpeed: baseSpeed - Math.abs(correction), rightSpeed: baseSpeed } : error > 0 ? { leftSpeed: baseSpeed, rightSpeed: baseSpeed - Math.abs(correction) } : { leftSpeed: baseSpeed, rightSpeed: baseSpeed };
  if (method === 'reverse') {
    const turn = Math.max(number(p, 'reverseTurnSpeed'), Math.abs(correction));
    return error < 0 ? { leftSpeed: -turn, rightSpeed: turn } : error > 0 ? { leftSpeed: turn, rightSpeed: -turn } : { leftSpeed: baseSpeed, rightSpeed: baseSpeed };
  }
  if (method === 'manual') {
    const output = new Function('input', `'use strict';\n${text(p, 'motorCode')}`)({ baseSpeed, correction, error });
    const leftSpeed = Number(output?.leftSpeed), rightSpeed = Number(output?.rightSpeed);
    if (!Number.isFinite(leftSpeed) || !Number.isFinite(rightSpeed)) throw new Error('左右轮速度必须是数字');
    return { leftSpeed, rightSpeed };
  }
  return { leftSpeed: baseSpeed + correction, rightSpeed: baseSpeed - correction };
}

function generateCCode(p: Parameters) {
  const f = (key: string) => number(p, key).toFixed(2);
  const errorMethod = text(p, 'errorMethod'), controlMethod = text(p, 'controlMethod'), motorMethod = text(p, 'motorMethod');
  const weights = configuredWeights(p).map(value => value.toFixed(2)).join(', ');
  const errorBody = errorMethod === 'state' ? `switch (sensor) {
    case 0x18: return 0.0f;                 /* 00011000 */
    case 0x0C: return -1.0f * STATE_MATCH_GAIN;
    case 0x30: return  1.0f * STATE_MATCH_GAIN;
    case 0x06: return -2.0f * STATE_MATCH_GAIN;
    case 0x60: return  2.0f * STATE_MATCH_GAIN;
    case 0x03: return -3.0f * STATE_MATCH_GAIN;
    case 0xC0: return  3.0f * STATE_MATCH_GAIN;
    case 0x1C: return -0.5f * STATE_MATCH_GAIN;
    case 0x38: return  0.5f * STATE_MATCH_GAIN;
    default:   return WeightedError(sensor);
  }` : errorMethod === 'edge' ? `int8_t first = -1, last = -1;
  for (uint8_t i = 0; i < 8; ++i) {
    if (sensor & (1U << i)) { if (first < 0) first = (int8_t)i; last = (int8_t)i; }
  }
  return (SENSOR_WEIGHT[(uint8_t)first] + SENSOR_WEIGHT[(uint8_t)last]) * 0.5f + EDGE_OFFSET;` : errorMethod === 'manual' ? `/* 手写偏差算法：在这里返回偏差，正数表示黑线偏右。 */
  return User_Error(sensor);` : `return WeightedError(sensor);`;
  const controlBody = controlMethod === 'switch' ? `if (error > 0.0f) return SWITCH_STRENGTH;
  if (error < 0.0f) return -SWITCH_STRENGTH;
  return 0.0f;` : controlMethod === 'segmented' ? `float magnitude = error >= 0.0f ? error : -error;
  if (magnitude <= CENTER_THRESHOLD) return 0.0f;
  return error > 0.0f ? (magnitude > HARD_THRESHOLD ? HARD_STRENGTH : SEGMENT_STRENGTH)
                       : -(magnitude > HARD_THRESHOLD ? HARD_STRENGTH : SEGMENT_STRENGTH);` : controlMethod === 'manual' ? `/* 手写控制量算法：返回控制量，正数让左轮更快。 */
  float output = User_Correction(error, dt);
  if (output > CORRECTION_LIMIT) output = CORRECTION_LIMIT;
  if (output < -CORRECTION_LIMIT) output = -CORRECTION_LIMIT;
  return output;` : `float derivative = (error - g_previousError) / dt;
  ${controlMethod === 'pid' ? 'g_integral += error * dt;\n  if (g_integral > INTEGRAL_LIMIT) g_integral = INTEGRAL_LIMIT;\n  if (g_integral < -INTEGRAL_LIMIT) g_integral = -INTEGRAL_LIMIT;' : 'g_integral = 0.0f;'}
  float output = KP * error${controlMethod === 'pid' ? ' + KI * g_integral' : ''}${controlMethod === 'pd' || controlMethod === 'pid' ? ' + KD * derivative' : ''};
  if (output > CORRECTION_LIMIT) output = CORRECTION_LIMIT;
  if (output < -CORRECTION_LIMIT) output = -CORRECTION_LIMIT;
  return output;`;
  const motorBody = motorMethod === 'single' ? `float amount = correction >= 0.0f ? correction : -correction;
  if (error < 0.0f) { Motor_SetLeftSpeed(ClampSpeed(BASE_SPEED - amount)); Motor_SetRightSpeed(ClampSpeed(BASE_SPEED)); }
  else if (error > 0.0f) { Motor_SetLeftSpeed(ClampSpeed(BASE_SPEED)); Motor_SetRightSpeed(ClampSpeed(BASE_SPEED - amount)); }
  else Motor_SetSpeed(ClampSpeed(BASE_SPEED));` : motorMethod === 'reverse' ? `float turn = correction >= 0.0f ? correction : -correction;
  if (turn < REVERSE_TURN_SPEED) turn = REVERSE_TURN_SPEED;
  if (error < 0.0f) { Motor_SetLeftSpeed(ClampSpeed(-turn)); Motor_SetRightSpeed(ClampSpeed(turn)); }
  else if (error > 0.0f) { Motor_SetLeftSpeed(ClampSpeed(turn)); Motor_SetRightSpeed(ClampSpeed(-turn)); }
  else Motor_SetSpeed(ClampSpeed(BASE_SPEED));` : motorMethod === 'manual' ? `/* 手写电机分配：在 User_Motor 中调用两个 Motor_Set... 函数。 */
  User_Motor(BASE_SPEED, correction, error);` : `Motor_SetLeftSpeed(ClampSpeed(BASE_SPEED + correction));
  Motor_SetRightSpeed(ClampSpeed(BASE_SPEED - correction));`;
  const configVariables = [
    `static const float BASE_SPEED = ${f('baseSpeed')};              /* 基础速度 */`,
    ...(errorMethod === 'state' ? [`static const float STATE_MATCH_GAIN = ${f('stateMatchGain')};    /* 状态匹配增益 */`] : []),
    ...(errorMethod === 'edge' ? [`static const float EDGE_OFFSET = ${f('edgeOffset')};             /* 中点校准偏移 */`] : []),
    `static const float SENSOR_WEIGHT[8] = { ${weights} };            /* S1~S8 权重 */`,
    ...(controlMethod === 'switch' ? [`static const float SWITCH_STRENGTH = ${f('switchStrength')};     /* 开关控制强度 */`] : []),
    ...(controlMethod === 'segmented' ? [`static const float CENTER_THRESHOLD = ${f('centerThreshold')};   /* 居中阈值 */`, `static const float SEGMENT_STRENGTH = ${f('segmentStrength')};   /* 轻微偏差修正 */`, `static const float HARD_THRESHOLD = ${f('hardThreshold')};       /* 急转阈值 */`, `static const float HARD_STRENGTH = ${f('hardStrength')};         /* 急转修正 */`] : []),
    ...(controlMethod === 'p' || controlMethod === 'pd' || controlMethod === 'pid' ? [`static const float KP = ${f('kp')};                              /* Kp */`] : []),
    ...(controlMethod === 'pd' || controlMethod === 'pid' ? [`static const float KD = ${f('kd')};                              /* Kd */`] : []),
    ...(controlMethod === 'pid' ? [`static const float KI = ${f('ki')};                              /* Ki */`, `static const float INTEGRAL_LIMIT = ${f('integralLimit')};       /* 最大积分值 */`] : []),
    ...(controlMethod === 'p' || controlMethod === 'pd' || controlMethod === 'pid' || controlMethod === 'manual' ? [`static const float CORRECTION_LIMIT = ${f('correctionLimit')};   /* 控制量限幅 */`] : []),
    ...(motorMethod === 'reverse' ? [`static const float REVERSE_TURN_SPEED = ${f('reverseTurnSpeed')};/* 反向转向速度 */`] : []),
    `static const float LOST_SEARCH_SPEED = ${f('lostLineSearchSpeed')}; /* 丢线搜索速度 */`,
    `static const uint16_t LOST_TIMEOUT_FRAMES = ${Math.round(number(p, 'lostLineTimeoutFrames'))}; /* 丢线超时帧数 */`,
  ].join('\n');
  return `#include "stm32f10x.h"
#include "Motor.h"
#include "Delay.h"
#include "Sensor.h"

/* Sensor_Read 的 bit0~bit7 对应网页的 S1~S8；1 表示检测到黑线。 */
/* 当前组合：偏差=${errorMethod}，控制量=${controlMethod}，电机速度=${motorMethod} */
${configVariables}

static float g_previousError = 0.0f, g_integral = 0.0f;
static int8_t g_lastDirection = 1;
static uint16_t g_lostFrames = 0;

static int8_t ClampSpeed(float speed) {
  if (speed > 100.0f) return 100;
  if (speed < -100.0f) return -100;
  return (int8_t)speed;
}

static float WeightedError(uint8_t sensor) {
  float sum = 0.0f; uint8_t count = 0;
  for (uint8_t i = 0; i < 8; ++i) if (sensor & (1U << i)) { sum += SENSOR_WEIGHT[i]; ++count; }
  return count ? sum / count : 0.0f;
}

${errorMethod === 'manual' ? `static float User_Error(uint8_t sensor) {
  (void)sensor;
  /* TODO: 填入你的偏差计算，正数偏右、负数偏左。 */
  return WeightedError(sensor);
}
` : ''}${controlMethod === 'manual' ? `static float User_Correction(float error, float dt) {
  (void)dt;
  /* TODO: 填入你的控制量算法。 */
  return error * 18.0f;
}
` : ''}${motorMethod === 'manual' ? `static void User_Motor(float baseSpeed, float correction, float error) {
  (void)error;
  /* TODO: 填入你的电机速度分配。 */
  Motor_SetLeftSpeed(ClampSpeed(baseSpeed + correction));
  Motor_SetRightSpeed(ClampSpeed(baseSpeed - correction));
}
` : ''}static float CalculateError(uint8_t sensor, uint8_t *valid) {
  if (sensor == 0x00U) { *valid = 0U; return 0.0f; }
  *valid = 1U;
  ${errorBody}
}

static float CalculateCorrection(float error, float dt) {
  ${controlBody}
}

static void ApplyMotorSpeed(float correction, float error) {
  ${motorBody}
}

void LineFollow_Update(void) {
  const float dt = 0.040f;
  uint8_t valid, sensor = Sensor_Read();
  if (sensor == 0xFFU) { Motor_Stop(); g_integral = 0.0f; g_lostFrames = 0U; return; }
  float error = CalculateError(sensor, &valid);
  if (!valid) {
    if (++g_lostFrames > LOST_TIMEOUT_FRAMES) { Motor_Stop(); return; }
    if (g_lastDirection < 0) { Motor_SetLeftSpeed(ClampSpeed(-LOST_SEARCH_SPEED)); Motor_SetRightSpeed(ClampSpeed(LOST_SEARCH_SPEED)); }
    else { Motor_SetLeftSpeed(ClampSpeed(LOST_SEARCH_SPEED)); Motor_SetRightSpeed(ClampSpeed(-LOST_SEARCH_SPEED)); }
    return;
  }
  g_lostFrames = 0U;
  float correction = CalculateCorrection(error, dt);
  ApplyMotorSpeed(correction, error);
  g_previousError = error;
  if (error < 0.0f) g_lastDirection = -1;
  else if (error > 0.0f) g_lastDirection = 1;
}

int main(void) {
  Motor_Init();
  Sensor_Init();
  while (1) {
    LineFollow_Update();
    Delay_ms(40);  /* 控制周期：40 ms */
  }
}`;
}

export const pipelineController: LineController = {
  id: 'pipeline', name: '组合巡线算法', description: '将偏差计算、控制量计算与电机速度分配拆分组合。',
  parameterDefinitions: [
    { key: 'errorMethod', label: '偏差计算算法', type: 'select', defaultValue: 'weighted', group: '偏差计算', options: [{ label: '状态匹配法', value: 'state' }, { label: '二值加权平均法', value: 'weighted' }, { label: '左右边缘中点法', value: 'edge' }, { label: '手写', value: 'manual' }] },
    { key: 'stateMatchGain', label: '状态匹配增益', type: 'range', defaultValue: 1, min: .2, max: 3, step: .1, group: '偏差计算', visibleWhen: { key: 'errorMethod', values: ['state'] } },
    ...SENSOR_WEIGHTS.map((weight, index) => ({ key: `sensorWeight${index + 1}`, label: `S${index + 1} 权重`, type: 'range' as const, defaultValue: weight, min: -5, max: 5, step: .5, group: '偏差计算', visibleWhen: { key: 'errorMethod', values: ['weighted'] } })),
    { key: 'edgeOffset', label: '中点校准偏移', type: 'range', defaultValue: 0, min: -2, max: 2, step: .1, group: '偏差计算', visibleWhen: { key: 'errorMethod', values: ['edge'] } },
    { key: 'errorCode', label: '手写偏差代码', description: '输入 input，返回偏差数字或 null。', type: 'code', defaultValue: defaultErrorCode, group: '偏差计算', visibleWhen: { key: 'errorMethod', values: ['manual'] } },
    { key: 'controlMethod', label: '控制量算法', type: 'select', defaultValue: 'pid', group: '控制量', options: [{ label: '开关控制', value: 'switch' }, { label: '分段控制', value: 'segmented' }, { label: 'P控制', value: 'p' }, { label: 'PD控制', value: 'pd' }, { label: 'PID控制', value: 'pid' }, { label: '手写', value: 'manual' }] },
    { key: 'switchStrength', label: '开关控制强度', type: 'range', defaultValue: 28, min: 1, max: 100, step: 1, group: '控制量', visibleWhen: { key: 'controlMethod', values: ['switch'] } },
    { key: 'centerThreshold', label: '居中阈值', type: 'range', defaultValue: .7, min: .1, max: 2, step: .1, group: '控制量', visibleWhen: { key: 'controlMethod', values: ['segmented'] } },
    { key: 'segmentStrength', label: '轻微偏差修正', type: 'range', defaultValue: 18, min: 1, max: 80, step: 1, group: '控制量', visibleWhen: { key: 'controlMethod', values: ['segmented'] } },
    { key: 'hardThreshold', label: '急转阈值', type: 'range', defaultValue: 2.2, min: 1, max: 3.5, step: .1, group: '控制量', visibleWhen: { key: 'controlMethod', values: ['segmented'] } },
    { key: 'hardStrength', label: '急转修正', type: 'range', defaultValue: 45, min: 1, max: 100, step: 1, group: '控制量', visibleWhen: { key: 'controlMethod', values: ['segmented'] } },
    { key: 'kp', label: 'Kp', type: 'range', defaultValue: 18, min: 0, max: 60, step: .5, group: '控制量', visibleWhen: { key: 'controlMethod', values: ['p', 'pd', 'pid'] } },
    { key: 'ki', label: 'Ki', type: 'range', defaultValue: 1.2, min: 0, max: 15, step: .1, group: '控制量', visibleWhen: { key: 'controlMethod', values: ['pid'] } },
    { key: 'kd', label: 'Kd', type: 'range', defaultValue: 3, min: 0, max: 30, step: .1, group: '控制量', visibleWhen: { key: 'controlMethod', values: ['pd', 'pid'] } },
    { key: 'integralLimit', label: '最大积分值', type: 'range', defaultValue: 12, min: 1, max: 50, step: 1, group: '控制量', visibleWhen: { key: 'controlMethod', values: ['pid'] } },
    { key: 'correctionLimit', label: '控制量限幅', type: 'range', defaultValue: 55, min: 5, max: 100, step: 1, group: '控制量', visibleWhen: { key: 'controlMethod', values: ['p', 'pd', 'pid', 'manual'] } },
    { key: 'controlCode', label: '手写控制量代码', description: '输入 input.error，返回控制量数字。', type: 'code', defaultValue: defaultControlCode, group: '控制量', visibleWhen: { key: 'controlMethod', values: ['manual'] } },
    { key: 'motorMethod', label: '电机速度算法', type: 'select', defaultValue: 'symmetric', group: '电机速度', options: [{ label: '双轮对称差速', value: 'symmetric' }, { label: '单轮减速', value: 'single' }, { label: '反向差速', value: 'reverse' }, { label: '手写', value: 'manual' }] },
    { key: 'baseSpeed', label: '基础速度', type: 'range', defaultValue: 52, min: 0, max: 90, step: 1, group: '电机速度', visibleWhen: { key: 'motorMethod', values: ['symmetric', 'single', 'reverse', 'manual'] } },
    { key: 'reverseTurnSpeed', label: '反向转向速度', type: 'range', defaultValue: 35, min: 5, max: 100, step: 1, group: '电机速度', visibleWhen: { key: 'motorMethod', values: ['reverse'] } },
    { key: 'motorCode', label: '手写电机代码', description: '输入 input，返回 { leftSpeed, rightSpeed }。', type: 'code', defaultValue: defaultMotorCode, group: '电机速度', visibleWhen: { key: 'motorMethod', values: ['manual'] } },
    { key: 'lostLineSearchSpeed', label: '丢线搜索速度', type: 'range', defaultValue: 20, min: 5, max: 60, step: 1, group: '通用保护' },
    { key: 'lostLineTimeoutFrames', label: '丢线超时帧数', type: 'range', defaultValue: 35, min: 5, max: 120, step: 1, group: '通用保护' },
  ],
  presets: [], createInitialContext: () => ({ previousError: 0, integral: 0, lastValidDirection: 0, lostLineFrames: 0 }),
  update(frame, p, context) {
    const info = calculateError(frame, p);
    if (linePosition(frame.values).allBlack) return { result: { motorCommand: { leftSpeed: 0, rightSpeed: 0 }, error: null, linePosition: info.value, actionLabel: '检测到全黑区域，停止', explanation: '八路传感器均检测到黑线，停止以避免误判终点或十字。', debugValues: { '偏差算法': info.label } }, nextContext: { ...context, integral: 0, lostLineFrames: 0 } };
    if (info.value === null) { const search = lostLine(context, number(p, 'lostLineSearchSpeed'), number(p, 'lostLineTimeoutFrames')); return { result: { motorCommand: search.command, error: null, linePosition: null, actionLabel: search.stopped ? '搜索失败，已停车' : '丢线搜索', explanation: '当前偏差算法未检测到黑线，按最近有效方向低速搜索。', debugValues: { '偏差算法': info.label, '丢线帧数': search.frames } }, nextContext: { ...context, lostLineFrames: search.frames } }; }
    try {
      const control = calculateCorrection(info.value, frame, p, context), speeds = toMotorSpeeds(control.correction, info.value, p), direction = (info.value < 0 ? -1 : info.value > 0 ? 1 : 0) as -1 | 0 | 1;
      return { result: { motorCommand: { leftSpeed: speedLimit(speeds.leftSpeed), rightSpeed: speedLimit(speeds.rightSpeed) }, error: info.value, linePosition: info.value, actionLabel: control.action, explanation: `${info.label}得到偏差 ${info.value.toFixed(2)}，再经${text(p, 'controlMethod')}与${text(p, 'motorMethod')}生成轮速。`, debugValues: { '偏差算法': info.label, '控制量算法': text(p, 'controlMethod'), '电机速度算法': text(p, 'motorMethod'), ...control.debug } }, nextContext: { ...context, previousError: info.value, integral: control.integral, lastValidDirection: direction || context.lastValidDirection, lostLineFrames: 0 } };
    } catch (error) { return { result: { motorCommand: { leftSpeed: 0, rightSpeed: 0 }, error: info.value, linePosition: info.value, actionLabel: '手写算法错误，已停车', explanation: error instanceof Error ? error.message : '算法输出无效。', debugValues: { '代码状态': '错误' } }, nextContext: context }; }
  },
  getPseudoCode: () => '1  读取八路传感器\n2  选择偏差计算算法，得到 error\n3  选择控制量算法，得到 correction\n4  选择电机速度算法，得到 leftSpeed / rightSpeed', getCCode: (parameters) => generateCCode(parameters ?? Object.fromEntries(pipelineController.parameterDefinitions.map(definition => [definition.key, definition.defaultValue]))), getTypeScriptCode: () => 'const error = calculateError(sensors);\nconst correction = calculateCorrection(error);\nconst speeds = toMotorSpeeds(correction);',
};
