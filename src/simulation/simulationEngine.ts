import type { LineController, ControllerContext, ControllerResult, MotorCommand } from '../controllers/types';
import type { SimulationSettings, SimulationState, Snapshot, TrackPreset } from './types';
import { readSensors } from './sensorModel';
import { clamp } from '../utils/clamp';

const emptyResult: ControllerResult = { motorCommand: { leftSpeed: 0, rightSpeed: 0 }, error: null, linePosition: 0, actionLabel: '等待开始', explanation: '点击开始或单步，读取固定传感器下方的地图。', debugValues: {} };
export const defaultSettings: SimulationSettings = { motorJitter: 0, motorAcceleration: 60, motorDeceleration: 90, leftEfficiency: 1, rightEfficiency: 1, sensorNoise: 0, sensorDelay: 0, disabledSensor: null, sensorSpacing: 15, sensorForwardOffset: 59, motorSpacing: 120, loopRadius: 160 };

export class SimulationEngine {
  preset: TrackPreset = 'straight'; seed = 1; settings = { ...defaultSettings }; context: ControllerContext;
  state: SimulationState; history: Snapshot[] = []; initial: Snapshot;
  /** UI 的临时手动接管；为空时完全由当前控制器输出驱动。 */
  manualOverride: { command: MotorCommand; label: string } | null = null;
  constructor(public controller: LineController, public parameters: Record<string, number | boolean | string>) {
    this.context = controller.createInitialContext();
    this.state = { frame: 0, time: 0, mapOffsetX: 0, mapOffsetY: 0, mapRotation: 0, lateral: 0, sensorValues: [0,0,1,1,1,1,0,0], result: emptyResult, targetLeft: 0, targetRight: 0, actualLeft: 0, actualRight: 0 };
    this.initial = this.snapshot();
  }
  snapshot(): Snapshot { return { state: structuredClone(this.state), context: structuredClone(this.context) }; }
  restore(snapshot: Snapshot) { this.state = structuredClone(snapshot.state); this.context = structuredClone(snapshot.context); }
  reset(initialMapOffsetX = 0) {
    this.context = this.controller.createInitialContext();
    this.state = { ...this.state, frame: 0, time: 0, mapOffsetX: initialMapOffsetX, mapOffsetY: 0, mapRotation: 0, lateral: initialMapOffsetX, sensorValues: [0,0,1,1,1,1,0,0], result: emptyResult, targetLeft: 0, targetRight: 0, actualLeft: 0, actualRight: 0 };
    this.history = []; this.initial = this.snapshot();
  }
  setController(controller: LineController, parameters: Record<string, number | boolean | string>) { this.controller = controller; this.parameters = parameters; this.context = controller.createInitialContext(); }
  setManualOverride(leftSpeed: number, rightSpeed: number, label: string) { this.manualOverride = { command: { leftSpeed, rightSpeed }, label }; }
  clearManualOverride() { this.manualOverride = null; }
  /** 切换或重新生成赛道时，地图平面回到固定车身层下的初始位姿。 */
  setPreset(preset: TrackPreset) { this.preset = preset; this.reset(0); }
  saveInitial() { this.initial = this.snapshot(); }
  previous() { const snapshot = this.history.pop(); if (snapshot) this.restore(snapshot); }
  step(dt = .04) {
    this.history.push(this.snapshot()); if (this.history.length > 100) this.history.shift();
    const s = this.state;
    const sensors = readSensors(this.preset, s.mapOffsetX, s.mapOffsetY, s.mapRotation, this.settings, this.seed);
    const output = this.controller.update({ values: sensors, timestamp: s.time, deltaTime: dt }, this.parameters, this.context);
    this.context = output.nextContext;
    const result = this.manualOverride ? {
      ...output.result,
      motorCommand: this.manualOverride.command,
      actionLabel: `手动介入：${this.manualOverride.label}`,
      explanation: '手动介入直接覆盖电机命令，不受仿真器动力学影响；松开后暂停，可点击继续巡线恢复算法。',
      debugValues: { ...output.result.debugValues, '手动介入': this.manualOverride.label },
    } : output.result;
    const manualCommand = this.manualOverride?.command;
    const jitter = () => this.settings.motorJitter ? (Math.random() - .5) * this.settings.motorJitter : 0;
    // 手动介入是直接电机命令：不经过效率差、抖动、加减速度等仿真模型。
    const targetLeft = manualCommand ? manualCommand.leftSpeed : clamp(result.motorCommand.leftSpeed * this.settings.leftEfficiency + jitter(), -100, 100);
    const targetRight = manualCommand ? manualCommand.rightSpeed : clamp(result.motorCommand.rightSpeed * this.settings.rightEfficiency + jitter(), -100, 100);
    // 加速度限幅：提速与刹车分别受限；反转时必须先减至 0，再向反方向加速。
    const approachSpeed = (actual: number, target: number) => {
      if (actual !== 0 && target !== 0 && Math.sign(actual) !== Math.sign(target)) {
        const reduction = Math.min(Math.abs(actual), this.settings.motorDeceleration * dt);
        return actual - Math.sign(actual) * reduction;
      }
      const rate = Math.abs(target) > Math.abs(actual) ? this.settings.motorAcceleration : this.settings.motorDeceleration;
      return actual + clamp(target - actual, -rate * dt, rate * dt);
    };
    const left = manualCommand ? targetLeft : approachSpeed(s.actualLeft, targetLeft);
    const right = manualCommand ? targetRight : approachSpeed(s.actualRight, targetRight);
    const average = (left + right) / 2;
    const distance = average * .11;
    /*
     * 车头在屏幕中永远朝上，地图则可能已相对车体旋转。
     * 将“屏幕向下的地图后移量”反投影到地图局部坐标，保证前进方向
     * 随车体与地图的夹角实时重算，而不是盲目沿地图自身 Y 轴移动。
     */
    const angle = s.mapRotation;
    const moveX = Math.sin(angle) * distance;
    const moveY = Math.cos(angle) * distance;
    // 循环角度 [0, 2π)：满 360° 回到 0°，反向转过 0° 则从 360° 继续。
    const fullTurn = Math.PI * 2;
    // 差速运动学：轮距越小，同一轮速差造成的角速度越大。
    const nextRotation = ((angle + (right - left) * .11 / this.settings.motorSpacing) % fullTurn + fullTurn) % fullTurn;
    // 唯一的地图运动规则：平均轮速平移，速度差绕固定车心旋转。车身层从不移动。
    this.state = { ...s, frame: s.frame + 1, time: s.time + dt, mapOffsetX: s.mapOffsetX + moveX, mapOffsetY: s.mapOffsetY + moveY, mapRotation: nextRotation, lateral: s.mapOffsetX + moveX, sensorValues: sensors, result, targetLeft: result.motorCommand.leftSpeed, targetRight: result.motorCommand.rightSpeed, actualLeft: left, actualRight: right };
    return this.state;
  }
}
