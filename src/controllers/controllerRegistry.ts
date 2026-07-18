import { segmentedController } from './segmented/segmentedController'; import { pidController } from './pid/pidController'; import { manualController } from './manual/manualController'; import { customController } from './custom/customController';
export const controllerRegistry=[segmentedController,pidController,manualController,customController];
