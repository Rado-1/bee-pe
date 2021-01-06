// TODO how to implement end of process? -- what if plan just refers to process model
// TODO how to determine failing and succeeding pland and goals?

import { BpmnBuilder } from './lang-bpmn';
import { Element, ElementBuilder, ProcessModel, BUILD } from './lang-core';
import { Singleton } from './singleton';

// Elements

abstract class GoalPlan extends Element {
  condition: () => boolean;

  setCondition(condition: () => boolean): void {
    this.condition = condition;
  }
}

abstract class Goal extends GoalPlan {}

export class AchieveGoal extends Goal {
  deactivateCondition: () => boolean;
}

export class MaintainGoal extends Goal {}

export class Plan extends GoalPlan {
  model: ProcessModel;
}

// Builders

/**
 * Global variables of goal process building status.
 */
class GoalBuildStatus {}

export const GOAL_BUILD = new GoalBuildStatus();

@Singleton
export class GoalLevelBuilder extends ElementBuilder {
  achieve(id?: string): AchieveBuilder {
    return new AchieveBuilder();
  }

  maintain(id?: string): MaintainBuilder {
    return new MaintainBuilder();
  }
}

@Singleton
export class GoalBuilder extends GoalLevelBuilder {
  subGoals(): GoalLevelBuilder {
    return this;
  }

  subDone(): GoalLevelBuilder {
    return this;
  }

  plans(id?: string): PlanLevelBuilder {
    return new PlanLevelBuilder();
  }

  goalDone(): GoalLevelBuilder {
    return new GoalLevelBuilder();
  }
}

@Singleton
export class PlanLevelBuilder {
  plan(id?: string): PlanBuilder {
    return new PlanBuilder();
  }

  plansDone(): GoalBuilder {
    return new GoalBuilder();
  }
}

@Singleton
export class AchieveBuilder extends GoalBuilder {
  pre(condition: () => boolean): AchieveBuilder {
    return this;
  }

  deactivate(condition: () => boolean) {
    return this;
  }
}

@Singleton
export class MaintainBuilder extends GoalBuilder {
  that(condition: () => boolean): MaintainBuilder {
    return this;
  }
}

@Singleton
export class PlanBuilder extends GoalLevelBuilder {
  pre(condition: () => boolean): PlanBuilder {
    return this;
  }

  process(model: ProcessModel | (() => ProcessModel)): PlanBuilder {
    return this;
  }

  planDone(): PlanLevelBuilder {
    return new PlanLevelBuilder();
  }
}

/**
 * Creates an empty goal process model.
 * @param id unique identifier of the process
 */
export function goals(id?: string): GoalLevelBuilder {
  BUILD.model = new ProcessModel(id);

  // add top-goal
  BUILD.model.add(new AchieveGoal());

  // initialize all used builders, return the top-most
  new PlanBuilder();
  new MaintainBuilder();
  new AchieveBuilder();
  new GoalBuilder();
  return new GoalLevelBuilder();
}
