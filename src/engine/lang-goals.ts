// TODO define goal elements - model structure
// TODO implement model buildong
// TODO define executional semantics of elements
// TODO determine failing and succeeding pland and goals?

import {
  Element,
  ProcessModel,
  BUILD,
  ProcessBuilder,
  ProxyBuildStatus,
} from './lang-core';
import { Singleton, Flexible, Condition } from './utils';

// *** SECTION *** Elements

abstract class GoalPlan extends Element {
  condition: Condition;

  setCondition(condition: Condition): void {
    this.condition = condition;
  }
}

abstract class Goal extends GoalPlan {}

export class AchieveGoal extends Goal {
  deactivateCondition: Condition;
}

export class MaintainGoal extends Goal {}

export class Plan extends GoalPlan {
  model: ProcessModel;
}

// *** SECTION *** Models

// IDEA think about adding GoalModel class

// *** SECTION *** Builders

/**
 * Global variables of goal process building status.
 */
class GoalBuildStatus extends ProxyBuildStatus {}

export const BUILD_GOALS = new GoalBuildStatus();

@Singleton
export class GoalsBuilder extends ProcessBuilder {
  achieve(id?: string): AchieveBuilder {
    return new AchieveBuilder();
  }

  maintain(id?: string): MaintainBuilder {
    return new MaintainBuilder();
  }

  subGoalsDone(): GoalsBuilder {
    return this;
  }
}

@Singleton
export class SingleGoalBuilder extends GoalsBuilder {
  subGoals(): GoalsBuilder {
    return this;
  }

  subPlans(id?: string): PlanLevelBuilder {
    return new PlanLevelBuilder();
  }
}

@Singleton
export class AchieveBuilder extends SingleGoalBuilder {
  pre(condition: Condition): AchieveBuilder {
    return this;
  }

  deactivate(condition: Condition) {
    return this;
  }
}

@Singleton
export class MaintainBuilder extends SingleGoalBuilder {
  that(condition: Condition): MaintainBuilder {
    return this;
  }
}

@Singleton
export class PlanLevelBuilder {
  plan(id?: string): PlanBuilder {
    return new PlanBuilder();
  }

  subPlansDone(): SingleGoalBuilder {
    return new SingleGoalBuilder();
  }
}

@Singleton
export class PlanBuilder extends GoalsBuilder {
  pre(condition: Condition): PlanBuilder {
    return this;
  }

  process(model: Flexible<ProcessModel>): PlanBuilder {
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
export function goals(id?: string): GoalsBuilder {
  BUILD.setCurrentModel(new ProcessModel(id));

  // add top-goal
  BUILD.addElement(new AchieveGoal());

  // initialize all used builders, return the top-most
  new PlanBuilder();
  new MaintainBuilder();
  new AchieveBuilder();
  new SingleGoalBuilder();
  return new GoalsBuilder();
}
