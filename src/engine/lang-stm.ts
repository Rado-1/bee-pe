// TODO define STM elements
// TODO define how STM builders create elements
// TODO define executional semantics of STM

import {
  Element,
  ProcessModel,
  ProcessBuilder,
  ProxyBuildStatus,
} from './lang-core';
import { Singleton, Action, Condition } from './utils';

// *** SECTION *** Elements

export class State extends Element {
  entryAction: Action;
  exitAction: Action;
  doAction: Action;
  internalTransitions;
  regions: Region[];

  constructor(id?: string) {
    super(id);
  }
}

export enum History {
  NONE,
  SHALLOW,
  DEEP,
}

export class Region {
  history: History = History.NONE;
}

export abstract class Trigger {}

export class ConditionalTrigger extends Trigger {
  condition: Condition;

  constructor(cond: Condition) {
    super();
    this.condition = cond;
  }
}

export class TimeTrigger extends Trigger {
  date: number;
  period: number;

  constructor(date: number, period?: number) {
    super();
    this.date = date;
    this.period = period;
  }
}

export class ReceiveSignalTrigger extends Trigger {}

export class Transition extends Element {}

// *** SECTION *** Models

// IDEA what about StmModel?

// *** SECTION *** Builders

/**
 * Global variables of BPMN process building status.
 */
export class StmBuildStatus extends ProxyBuildStatus {
  currentRegion: Region;
}

export const BUILD_STM = new StmBuildStatus();

@Singleton
export class StmBuilder extends ProcessBuilder {
  /**
   * Creates initial pseudostate.
   * @param id id of initial
   */
  initial(id: string): StmBuilder {
    return this;
  }

  /**
   * Creates final state finishing the enclosing region execution.
   * @param id id of final
   */
  final(id: string): StmBuilder {
    return this;
  }

  /**
   * Creates terminal pseudostate terminating the whole state machine.
   * @param id id of terminate
   */
  terminate(id: string): StmBuilder {
    return this;
  }

  /**
   * Creates junction pseudostate. It can be used also instead of join and
   * fork pseudostates.
   * @param id id of junction
   */
  junction(id: string): StmBuilder {
    return this;
  }

  /**
   * Specifies that the current region has shallow history.
   */
  shallowHistory(): StmBuilder {
    return this;
  }

  /**
   * Specifies that the current region has deep history.
   */
  deepHistory(): StmBuilder {
    return this;
  }

  /**
   * Creates state.
   * @param id id of state
   */
  state(id: string): StateBuilder {
    return new StateBuilder();
  }

  /**
   * Creates external transition.
   * @param from id of transition source (pseudo)state.
   * @param to id of transition target (pseudo)state.
   */
  tran(from: string, to: string): TransitionBuilder {
    return new TransitionBuilder();
  }

  regionDone(): StateBuilder {
    return new StateBuilder();
  }
}

@Singleton
export class StateBuilder {
  /**
   * Specifies state entry action.
   * @param action action to be executed on entering the state
   */
  entry(action: Action): StateBuilder {
    return this;
  }

  /**
   * Specifies state exit action.
   * @param action action to be executed on finishing the state
   */
  exit(action: Action): StateBuilder {
    return this;
  }

  /**
   * Specifies state do action.
   * @param action action to be executed when the sate is active
   */
  do(action: Action): StateBuilder {
    return this;
  }

  /**
   * Adds state's internal transition.
   */
  intTran(): TransitionBuilder {
    return new TransitionBuilder();
  }

  /**
   * Creates region.
   */
  region(): StmBuilder {
    return new StmBuilder();
  }

  /**
   * Finishes the state definition.
   */
  stateDone(): StmBuilder {
    return new StmBuilder();
  }
}

@Singleton
export class TransitionBuilder {
  /**
   * Specifies the event triggering transition. One transition can specify
   * several triggers.
   * @param event triggering event
   */
  trigger(trigger: Trigger): TransitionBuilder {
    return this;
  }

  /**
   * Specifies the transition's guard condition.
   * @param cond condition
   */
  guard(cond: Condition): TransitionBuilder {
    return this;
  }

  /**
   * Specifies the action executed when transition is triggered.
   * @param action action to be executed
   */
  action(action: Action): TransitionBuilder {
    return this;
  }

  /**
   * Finoshes definition of internal transition.
   */
  internDone(): StateBuilder {
    return new StateBuilder();
  }

  /**
   * Finishes definition of external transition.
   */
  tranDone(): StmBuilder {
    return new StmBuilder();
  }
}

// *** SECTION *** Event builders

/**
 * Conditional event.
 * @param cond condition
 */
export function conditional(cond: Condition): ConditionalTrigger {
  return new ConditionalTrigger(cond);
}

/**
 * Time event.
 * @param date date of occurrence
 * @param period repeating period
 */
export function time(date: number, period?: number): TimeTrigger {
  return new TimeTrigger(date, period);
}

/**
 * Receive signal event.
 */
export function receiveSignal(): ReceiveSignalTrigger {
  return new ReceiveSignalTrigger();
}

/**
 * Creates an empty state machine process model.
 * @param id unique identifier of the process
 */
export function stm(id?: string): StmBuilder {
  // create model and add the top sub-process - parent of all BPMN elements
  BUILD_STM.setCurrentModel(new ProcessModel(id));

  // initialize all used builders, return the top-most
  new StateBuilder();
  return new StmBuilder();
}
