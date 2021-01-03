import { Element, ElementBuilder, ProcessModel, BUILD } from './lang-core';
import { Singleton } from './singleton';

// Elements

export class AchieveGoal extends Element {
  preCondition: () => boolean;
}

export class MaintainGoal extends Element {
  maintainCondition: () => boolean;
}

export class Plan extends Element {
  preCondition: () => boolean;
}

// Builders

/**
 * Global variables of goal process building status.
 */
class GoalBuildStatus {}

export const GOAL_BUILD = new GoalBuildStatus();

export class GoalBuilder extends ElementBuilder {}

/**
 * Creates an empty goal process model.
 * @param id unique identifier of the process
 */
export function goals(id?: string): GoalBuilder {
  BUILD.model = new ProcessModel(id);
  return new GoalBuilder();
}
