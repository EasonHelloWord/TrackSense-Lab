import type { LineController } from '../types';
import { speedLimit } from '../shared/speedLimit';
import { linePosition } from '../shared/linePosition';

/** 用于课堂演示差速驱动，不参与巡线决策。 */
export const manualController: LineController = {
  id: 'manual', name: '手动轮速控制', description: '直接设置左右轮速度，观察赛道相对运动与传感器变化。',
  parameterDefinitions: [
    { key: 'leftSpeed', label: '左轮目标速度', description: '负值表示反转', type: 'range', defaultValue: 45, min: -100, max: 100, step: 1 },
    { key: 'rightSpeed', label: '右轮目标速度', description: '负值表示反转', type: 'range', defaultValue: 45, min: -100, max: 100, step: 1 },
  ],
  presets: [
    { name: '直行', values: { leftSpeed: 50, rightSpeed: 50 } },
    { name: '左转', values: { leftSpeed: 18, rightSpeed: 55 } },
    { name: '右转', values: { leftSpeed: 55, rightSpeed: 18 } },
    { name: '原地左旋', values: { leftSpeed: -30, rightSpeed: 30 } },
    { name: '停止', values: { leftSpeed: 0, rightSpeed: 0 } },
  ],
  createInitialContext: () => ({ previousError: 0, integral: 0, lastValidDirection: 0, lostLineFrames: 0 }),
  update(frame, parameters, context) {
    const left = speedLimit(Number(parameters.leftSpeed));
    const right = speedLimit(Number(parameters.rightSpeed));
    const position = linePosition(frame.values).position;
    return {
      result: {
        motorCommand: { leftSpeed: left, rightSpeed: right }, error: position, linePosition: position,
        actionLabel: left === right ? '手动直行' : left < right ? '手动左转' : '手动右转',
        explanation: '当前轮速由你直接设定；赛道的平移和旋转仅由这两个速度产生。',
        activeCodeLines: [1, 2],
        debugValues: { '手动左轮速度': left, '手动右轮速度': right, '传感器黑线位置': position },
      }, nextContext: context,
    };
  },
  getPseudoCode: () => '1  leftSpeed = 手动滑块左轮速度\n2  rightSpeed = 手动滑块右轮速度\n3  将左右轮命令交给电机模型\n4  仿真器用实际轮速更新赛道位置与角度',
  getCCode: () => 'void ManualDrive(int left, int right) {\n  SetMotor(clamp(left, -100, 100), clamp(right, -100, 100));\n}',
  getTypeScriptCode: () => 'return { motorCommand: {\n  leftSpeed: clamp(Number(parameters.leftSpeed), -100, 100),\n  rightSpeed: clamp(Number(parameters.rightSpeed), -100, 100),\n} };',
};
