// TODO define executional semantics of STM elements

import {
  Element,
  ProcessModel,
  ProcessBuilder,
  ProcessBuildStatus,
} from './lang-core';
import { Singleton, ActionNoParam, ConditionNoParam } from './utils';

// ========================================================================== //
// Elements

export class State extends Element {
  entryAction: ActionNoParam;
  exitAction: ActionNoParam;
  doAction: ActionNoParam;
  internalTransitions: Transition[] = [];
  outTransitions: Transition[] = [];
  regions: Region[] = [];
  parentRegion: Region;
  isTerminate = false;

  addInternalTransition(transition: Transition): void {
    this.internalTransitions.push(transition);
  }

  addOutTransition(transition: Transition): void {
    this.outTransitions.push(transition);
  }
}

export enum History {
  NONE,
  SHALLOW,
  DEEP,
}

export class Region extends Element {
  history: History = History.NONE;
  states: State[] = [];
  initialState: State;
  parentState: State;

  addState(state: State): void {
    this.states.push(state);
  }
}

// IDEA think about joining STM triggers with BPMN events; maybe define something common
export abstract class Trigger {}

export class ConditionalTrigger extends Trigger {
  condition: ConditionNoParam;

  constructor(cond: ConditionNoParam) {
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

export class Transition extends Element {
  from: State;
  to: State;
  triggers: Trigger[] = [];
  guard: ConditionNoParam;
  action: ActionNoParam;

  addTrigger(trigger: Trigger): void {
    this.triggers.push(trigger);
  }
}

// ========================================================================== //
// Models

export class StmModel extends ProcessModel {}

// ========================================================================== //
// Builders

/**
 * Global variables of BPMN process building status.
 */
export class StmBuildStatus extends ProcessBuildStatus {
  currentRegion: Region;
}

export const BUILD_STM = new StmBuildStatus();

@Singleton
export class RegionBuilder extends ProcessBuilder {
  /**
   * Creates initial pseudostate.
   * @param id id of initial
   */
  initial(id: string): RegionBuilder {
    this.state(id);
    BUILD_STM.currentRegion.initialState = BUILD_STM.getCurrentElement() as State;
    return this;
  }

  /**
   * Creates final state finishing the enclosing region execution.
   * @param id id of final
   */
  final(id: string): RegionBuilder {
    this.state(id);
    return this;
  }

  /**
   * Creates terminal pseudostate terminating the whole state machine.
   * @param id id of terminate
   */
  terminate(id: string): RegionBuilder {
    this.state(id);
    (BUILD_STM.getCurrentElement() as State).isTerminate = true;
    return this;
  }

  /**
   * Specifies that the current region has shallow history.
   */
  shallowHistory(): RegionBuilder {
    BUILD_STM.currentRegion.history = History.SHALLOW;
    return this;
  }

  /**
   * Specifies that the current region has deep history.
   */
  deepHistory(): RegionBuilder {
    BUILD_STM.currentRegion.history = History.DEEP;
    return this;
  }

  /**
   * Creates state.
   * @param id id of state
   */
  state(id: string): StateBuilder {
    const state = new State(id);
    state.parentRegion = BUILD_STM.currentRegion;
    state.parentRegion.addState(state);
    BUILD_STM.addElement(state);

    return new StateBuilder();
  }

  /**
   * Creates external transition.
   * @param from id of transition source (pseudo)state
   * @param to id of transition target (pseudo)state
   * @param id id of transition
   */
  tran(from: string, to: string, id?: string): TransitionBuilder {
    const fromState: State = BUILD_STM.getCurrentModel().findElement(
      from
    ) as State;
    const transition = new Transition(id);

    transition.from = fromState;
    transition.to = BUILD_STM.getCurrentModel().findElement(to) as State;
    fromState.addOutTransition(transition);
    BUILD_STM.addElement(transition);

    return new TransitionBuilder();
  }

  /**
   * Finishes the current region.
   */
  regionDone(): StateBuilder {
    const currentState = BUILD_STM.currentRegion.parentState;
    BUILD_STM.currentRegion = currentState.parentRegion;
    BUILD_STM.setCurrentElement(currentState);
    return new StateBuilder();
  }

  /**
   * Returns the current element as state.
   */
  asState(): StateBuilder {
    return new StateBuilder();
  }

  /**
   * Returns the current element as transition.
   */
  asTransition(): TransitionBuilder {
    return new TransitionBuilder();
  }
}

@Singleton
export class StateBuilder {
  /**
   * Specifies state entry action.
   * @param action action to be executed on entering the state
   */
  entry(action: ActionNoParam): StateBuilder {
    (BUILD_STM.getCurrentElement() as State).entryAction = action;
    return this;
  }

  /**
   * Specifies state exit action.
   * @param action action to be executed on finishing the state
   */
  exit(action: ActionNoParam): StateBuilder {
    (BUILD_STM.getCurrentElement() as State).exitAction = action;
    return this;
  }

  /**
   * Specifies state do action.
   * @param action action to be executed when the sate is active
   */
  do(action: ActionNoParam): StateBuilder {
    (BUILD_STM.getCurrentElement() as State).doAction = action;
    return this;
  }

  /**
   * Adds state's internal transition.
   */
  intTran(id?: string): TransitionBuilder {
    const currentState = BUILD_STM.getCurrentElement() as State;
    const transition = new Transition(id);

    transition.from = currentState;
    transition.to = currentState;
    currentState.addInternalTransition(transition);
    BUILD_STM.addElement(transition);

    return new TransitionBuilder();
  }

  /**
   * Creates region.
   * @param id id of region
   */
  region(id?: string): RegionBuilder {
    const region = new Region(id);

    region.parentState = BUILD_STM.getCurrentElement() as State;
    BUILD_STM.currentRegion = region;
    BUILD_STM.addElement(region);

    return new RegionBuilder();
  }

  /**
   * Finishes the state definition.
   */
  stateDone(): RegionBuilder {
    return new RegionBuilder();
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
    (BUILD_STM.getCurrentElement() as Transition).addTrigger(trigger);
    return this;
  }

  /**
   * Specifies the transition's guard condition.
   * @param cond condition
   */
  guard(cond: ConditionNoParam): TransitionBuilder {
    (BUILD_STM.getCurrentElement() as Transition).guard = cond;
    return this;
  }

  /**
   * Specifies the action executed when transition is triggered.
   * @param action action to be executed
   */
  action(action: ActionNoParam): TransitionBuilder {
    (BUILD_STM.getCurrentElement() as Transition).action = action;
    return this;
  }

  /**
   * Finoshes definition of internal transition.
   */
  internDone(): StateBuilder {
    BUILD_STM.setCurrentElement(
      (BUILD_STM.getCurrentElement() as Transition).from
    );

    return new StateBuilder();
  }

  /**
   * Finishes definition of external transition.
   */
  tranDone(): RegionBuilder {
    BUILD_STM.setCurrentElement(
      (BUILD_STM.getCurrentElement() as Transition).from.parentRegion
    );

    return new RegionBuilder();
  }
}

// ========================================================================== //
// Event builders

// TODO reconsider all catch events and functions for sending events - move it to core

/**
 * Conditional event.
 * @param cond condition
 */
export function conditional(cond: ConditionNoParam): ConditionalTrigger {
  return new ConditionalTrigger(cond);
}

// TODO time parameters must be flexible
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
export function stm(id?: string): RegionBuilder {
  // create model and add the top region
  BUILD_STM.setCurrentModel(new StmModel(id));
  const topRegion = new Region();
  BUILD_STM.addElement(topRegion);
  BUILD_STM.currentRegion = topRegion;

  // initialize all used builders, return the top-most
  new StateBuilder();
  new TransitionBuilder();
  return new RegionBuilder();
}
