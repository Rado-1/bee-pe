// TODO define executional semantics of goal elements

import {
  Element,
  ProcessModel,
  ProcessBuildStatus,
  ProcessBuilder,
} from './lang-core';
import { Singleton, Flexible, Condition } from './utils';

// ========================================================================== //
// Elements

export abstract class GoalPlan extends Element {
  // pre-condition for Achieve Goal and Plan
  // maintain condition for Maintain Goal
  condition: Condition;
  parent: Goal;
}

export abstract class Goal extends GoalPlan {
  sub: GoalPlan[] = [];

  addChild(child: GoalPlan): void {
    this.sub.push(child);
  }
}

export class AchieveGoal extends Goal {
  deactivateCondition: Condition;
}

export class MaintainGoal extends Goal {}

export class Plan extends GoalPlan {
  processModel: Flexible<ProcessModel>;
  failErrors: string[];
  failErrorFilter: (error: Error) => boolean;
}

// ========================================================================== //
// Models

export class GoalsModel extends ProcessModel {}

// ========================================================================== //
// Builders

/**
 * Global variables of goal process building status.
 */
export class GoalBuildStatus extends ProcessBuildStatus {
  currentParent: Goal;

  getCurrentElement(): GoalPlan {
    return super.getCurrentElement() as GoalPlan;
  }

  addElement(element: GoalPlan): void {
    super.addElement(element);
    element.parent = this.currentParent;

    if (this.currentParent) {
      this.currentParent.addChild(element);
    }
  }

  levelDown(): void {
    this.currentParent = this.getCurrentElement() as Goal;
  }

  levelUp(): void {
    this.setCurrentElement(this.getCurrentElement().parent);
    this.currentParent = this.getCurrentElement().parent;
  }
}

export const BUILD_GOALS = new GoalBuildStatus();

@Singleton
export class GoalLevelBuilder extends ProcessBuilder {
  /**
   * Creates Achieve Goal.
   * @param id identifier of achieve goal
   */
  achieve(id?: string): AchieveBuilder {
    BUILD_GOALS.addElement(new AchieveGoal(id));
    return new AchieveBuilder();
  }

  /**
   * Creates Maintain Goal.
   * @param id identifier of maintain goal
   */
  maintain(id?: string): MaintainBuilder {
    BUILD_GOALS.addElement(new MaintainGoal(id));
    return new MaintainBuilder();
  }

  /**
   * End of sub-goals.
   */
  subGoalsDone(): GoalLevelBuilder {
    BUILD_GOALS.levelUp();
    return this;
  }
}

@Singleton
export class GoalBuilder extends GoalLevelBuilder {
  /**
   * Starts sub-goals.
   */
  subGoals(): GoalLevelBuilder {
    BUILD_GOALS.levelDown();
    return new GoalLevelBuilder();
  }

  /**
   * Starts sub-plans.
   */
  subPlans(): PlanLevelBuilder {
    BUILD_GOALS.levelDown();
    return new PlanLevelBuilder();
  }
}

@Singleton
export class AchieveBuilder extends GoalBuilder {
  /**
   * Specifies pre-condition of Achieve Goal.
   * @param condition pre-condition
   */
  pre(condition: Condition): AchieveBuilder {
    BUILD_GOALS.getCurrentElement().condition = condition;
    return this;
  }

  /**
   * specifies deactivate condition of Achieve Goal.
   * @param condition deactivate condition
   */
  deactivate(condition: Condition) {
    (BUILD_GOALS.getCurrentElement() as AchieveGoal).deactivateCondition = condition;
    return this;
  }
}

@Singleton
export class MaintainBuilder extends GoalBuilder {
  /**
   * Specifoes maintain condition of Maintain Goal.
   * @param condition maintain condition
   */
  that(condition: Condition): MaintainBuilder {
    (BUILD_GOALS.getCurrentElement() as MaintainGoal).condition = condition;
    return this;
  }
}

@Singleton
export class PlanLevelBuilder {
  /**
   * Creates Plan.
   * @param id identifier of plan
   */
  plan(id?: string): PlanBuilder {
    BUILD_GOALS.addElement(new Plan(id));
    return new PlanBuilder();
  }

  /**
   * End of plans.
   */
  subPlansDone(): GoalBuilder {
    BUILD_GOALS.levelUp();
    return new GoalBuilder();
  }
}

@Singleton
export class PlanBuilder extends GoalLevelBuilder {
  /**
   * Specifies pre-condition of Plan
   * @param condition pre-condition of plan
   */
  pre(condition: Condition): PlanBuilder {
    BUILD_GOALS.getCurrentElement().condition = condition;
    return this;
  }

  /**
   * Specifies error codes that fail Plan.
   * @param errors set of error codes
   */
  failErrors(errors: string[]): PlanBuilder {
    (BUILD_GOALS.getCurrentElement() as Plan).failErrors = errors;
    return this;
  }

  /**
   * Specifies filter for errors tha cause failing of plan.
   * @param filter function returning true for failing errors
   */
  failErrorFilter(filter: (error: Error) => boolean): PlanBuilder {
    (BUILD_GOALS.getCurrentElement() as Plan).failErrorFilter = filter;
    return this;
  }

  /**
   * Specifies process model of Plan.
   * @param model process model
   */
  process(model: Flexible<ProcessModel>): PlanBuilder {
    (BUILD_GOALS.getCurrentElement() as Plan).processModel = model;
    return this;
  }

  /**
   * End of plan definition.
   */
  planDone(): PlanLevelBuilder {
    return new PlanLevelBuilder();
  }
}

/**
 * Creates an empty goal process model.
 * @param id unique identifier of the process
 */
export function goals(id?: string): GoalLevelBuilder {
  BUILD_GOALS.setCurrentModel(new GoalsModel(id));

  // add top-goal and goal-level
  BUILD_GOALS.addElement(new AchieveGoal());
  BUILD_GOALS.levelDown();

  // initialize all used builders, return the top-most
  new PlanBuilder();
  new MaintainBuilder();
  new AchieveBuilder();
  new GoalBuilder();
  return new GoalLevelBuilder();
}
