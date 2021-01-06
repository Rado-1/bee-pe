// TODO executional semantics for boundary
// TODO executional semantics for event subprocesses
// TODO implement activity looping
// TODO design timers for delay and date+period events
// TODO implement semantics of conditional event
// TODO ??? _P_event -> event sub-process; or use intermediate events without input flows...? or _P_embedded/call starting with event
// TODO _E_terminate()
// TODO boundary events -> see Camunda

import { Element, ProcessModel, BUILD, FlowBuilder } from './lang-core';
import { Singleton } from './singleton';

// TODO realize the following idea:
/**
 * Idea: _G_parallel(id: string,
 *    joinCondition?: (Map<string, number>) => boolean,
 *    joinAction?: (Map<string, number>) => Map<string, number>)
 *
 *  joinCondition: specifyies the condition when tokens can be put to output
 *    flow(s)
 *  joinAction: updates number of input tokens when output tokens are generated
 *  remark: the map represent the value of incomingTokens
 */
export class ParallelGateway extends Element {
  // number of tokens at incoming flows identified by ids of connected elements
  incomingTokens = new Map<string, number>();

  /**
   * Registers incoming flow.
   * @param element element from which the flow comes
   */
  protected onAddNext(element: Element) {
    this.incomingTokens.set(element.id, 0);
  }

  /**
   * Increments number of token on a flow coming from element.
   * @param fromElement element from which the token comes
   */
  protected onExecute(fromElement?: Element) {
    this.incomingTokens.set(
      fromElement.id,
      this.incomingTokens.get(fromElement.id) + 1
    );
  }

  /**
   * Checks existence of tokens on each incoming flow.
   */
  executeNext(): void {
    // at least one token on each incoming flow
    // TODO find more effective way
    if (
      [...this.incomingTokens.values()].find((val) => val === 0) === undefined
    ) {
      super.executeNext();
      // decrease number of tokens on incoming flows
      // TODO find more effective way
      this.incomingTokens.forEach((value, key) => {
        this.incomingTokens.set(key, value > 1 ? value - 1 : 0);
      });
    }
  }
}

export class ExclusiveGateway extends Element {
  executeNext(): void {
    let nextElement: Element;

    if (this.next.length === 1) {
      nextElement = this.next[0];
    } else {
      nextElement = this.next.find(
        (guard: Guard) => !guard.isDefault && guard.canGo()
      );

      if (!nextElement) {
        nextElement = this.next.find((guard: Guard) => guard.isDefault);
      }
    }

    if (nextElement) {
      nextElement.execute(this);
    } else {
      throw new Error(`Exclusive gateway ${this.id} cannot continue.`);
    }
  }
}

export class Guard extends Element {
  private condition: () => boolean;
  isDefault: boolean;

  constructor(condition?: () => boolean) {
    super();
    this.condition = condition;
    this.isDefault = !condition;
  }

  /**
   * Returns true if the condition is satisfied.
   */
  canGo(): boolean {
    return this.condition ? this.condition() : false;
  }
}

export abstract class Event extends Element {
  isContinuous: boolean = false;
  isInterrupting: boolean = true;
}

export class ConditionalEvent extends Event {
  condition: () => boolean;

  constructor(condition: () => boolean) {
    super();
    this.condition = condition;
  }

  // TODO implement do() - promise waiting for condition
}

// TODO fix: date shouldnot be taken from time of specifying the model, but from time when this element is executed; use function
export class TimeEvent extends Event {
  protected date: number;
  protected period?: number;

  constructor(date: number, period?: number) {
    super();
    this.date = date;
    this.period = period;
  }

  do(): Promise<void> {
    return new Promise((resolve) =>
      setTimeout(() => {
        resolve();
        this.repeat(resolve);
      }, this.date - Date.now())
    );
  }

  // TODO ??? fix: implement with promise ???
  repeat(resolve: () => void) {
    if (this.period) {
      setTimeout(() => {
        resolve;
        this.repeat(resolve);
      }, this.period);
    }
  }
}

export class EndEvent extends Element {
  // proceed execution only to parent if exists
  protected proceed(): void {
    if (this.parent) {
      this.parent.executeNext();
    }
  }
}

export enum LoopTest {
  /**
   * Tests the loop condition before execution of activity; while-do loop.
   */
  BEFORE,

  /**
   * Tests the loop condition after execution of activity; repeat-until loop.
   */
  AFTER,
}

export enum MultiType {
  /**
   * Parallel multi-instance looping.
   */
  PARALLEL,

  /**
   * Sequential multi-instance looping.
   */
  SEQUENTIAL,
}

export enum LoopingType {
  STANDARD,
  MULTIINSTANCE,
}

export abstract class Activity extends Element {
  // looping properties
  protected loopingType: LoopingType;
  protected loopCondition: () => boolean;
  protected loopTest: LoopTest;
  protected loopMax: number;
  protected multiItems: any[];
  protected multiOnIteration: (item: any) => void;
  protected multiType?: MultiType;
  protected boundaryEvents: Event[] = [];

  setLooping(
    condition: () => boolean,
    loopTest: LoopTest = LoopTest.BEFORE,
    maxLoop?: number
  ): void {
    this.loopingType = LoopingType.STANDARD;
    this.loopCondition = condition;
    this.loopTest = loopTest;
    this.loopMax = maxLoop;
  }

  setMultiinstance(
    items: any[],
    onIteration?: (item: any) => void,
    multiType: MultiType = MultiType.PARALLEL
  ) {
    this.loopingType = LoopingType.MULTIINSTANCE;
    this.multiItems = items;
    this.multiOnIteration = onIteration;
    this.multiType = multiType;
  }

  addBoundaryEvent(event: Event) {
    this.boundaryEvents.push(event);
  }

  execute(fromElement?: Element): void {
    // looping
    switch (this.loopingType) {
      case LoopingType.STANDARD:
        let iterator = this.loopMax;

        if (this.loopTest === LoopTest.BEFORE) {
          while ((!this.loopMax || iterator-- > 0) && this.loopCondition()) {
            super.execute(fromElement, false);
          }
        } else {
          do {
            super.execute(fromElement, false);
          } while ((!this.loopMax || iterator-- > 0) && this.loopCondition());
        }

        this.executeNext();

        break;

      case LoopingType.MULTIINSTANCE:
        switch (this.multiType) {
          case MultiType.PARALLEL:
            this.multiItems.forEach((item) => {
              this.multiOnIteration(item);
              super.execute(fromElement, false);
            });

            break;

          case MultiType.SEQUENTIAL:
            super.execute(fromElement, false);
        }

        this.executeNext();

        break;

      default:
        // no looping set
        super.execute(fromElement);
    }
  }
}

export class EmbeddedSubprocess extends Activity {
  protected eventSubprocesses: Event[] = [];

  addEventSubprocess(event: Event) {
    this.eventSubprocesses.push(event);
  }
}

export class CallSubprocess extends Activity {
  protected processModel: ProcessModel;

  constructor(processModel: ProcessModel) {
    super();
    this.processModel = processModel;
  }

  protected do(): Promise<void> {
    return new Promise((resolve) => {
      this.processModel.execute();
      resolve();
    });
  }
}

// Builders

/**
 * Global variables of BPMN process building status.
 */
class BpmnBuildStatus {
  isEventSubprocess: boolean = false;
  lastElementBeforeEventSubprocess: Element;
  isBoundary: boolean = false;
  isBoundaryInterrupting: boolean;
  boundaryOwner: Activity;
}

export const BPMN_BUILD = new BpmnBuildStatus();

/**
 * Helper used to set event properties if it first of event subprocess or
 * boundary event.
 * @param event
 */
function setNewEvent(event: Event): void {
  if (BPMN_BUILD.isBoundary) {
    event.isContinuous = true;
    event.isInterrupting = BPMN_BUILD.isBoundaryInterrupting;
    BPMN_BUILD.boundaryOwner.addBoundaryEvent(event);
    BPMN_BUILD.isBoundary = false;
  }

  if (BPMN_BUILD.isEventSubprocess) {
    event.isContinuous = true;
    (BUILD.currentParent as EmbeddedSubprocess).addEventSubprocess(event);
  }
}

@Singleton
export class BpmnBuilder extends FlowBuilder {
  /**
   * Adds conditional event.
   * @param condition condition which triggers the event
   */
  _E_conditional(condition: () => boolean): BpmnBuilder {
    BUILD.model.add(new ConditionalEvent(condition));

    return this;
  }

  /**
   * Adds Time Event.
   * @param date
   * @param period
   */
  _E_time(date: number, period?: number): BpmnBuilder {
    BUILD.model.add(new TimeEvent(date, period));

    return this;
  }

  /**
   * Adds Simple End Event.
   */
  _E_end(): BpmnBuilder {
    BUILD.model.add(new EndEvent());

    return this;
  }

  /**
   * Adds Parallel Gateway.
   * @param id identifier of gateway
   */
  _G_parallel(id: string): BpmnBuilder {
    BUILD.model.add(new ParallelGateway(id));

    return this;
  }

  /**
   * Adds Exclusive Gateway.
   * @param id? optional identifier of gateway
   */
  _G_exclusive(id?: string): BpmnBuilder {
    BUILD.model.add(new ExclusiveGateway(id));

    return this;
  }

  /**
   * Adds guard condition for a flow coming from Exclusive Gateway.
   * @param condition guard condition
   */
  guard(condition: () => boolean): BpmnBuilder {
    BUILD.model.add(new Guard(condition));

    return this;
  }

  /**
   * Adds default flow coming from Exclusive Gateway.
   */
  default(): BpmnBuilder {
    BUILD.model.add(new Guard());

    return this;
  }

  /**
   * Instantiates process model as sub-process.
   * @param processModel process model to be instantiated as sub-process
   */
  call(processModel: ProcessModel): ActivityBuilder {
    BUILD.model.add(new CallSubprocess(processModel));

    return new ActivityBuilder();
  }

  /**
   * Adds embedded sub-process.
   */
  sub(): ActivityBuilder {
    BUILD.model.addSub(new EmbeddedSubprocess());

    return new ActivityBuilder();
  }

  /**
   * Creates event sub-process.
   */
  subEvent(): BpmnBuilder {
    if (!BPMN_BUILD.isEventSubprocess) {
      BPMN_BUILD.isEventSubprocess = true;
      BPMN_BUILD.lastElementBeforeEventSubprocess = BUILD.currentElement;
    } else {
      throw new Error(`Event sub-processes cannot be nested.`);
    }

    return this;
  }

  /**
   * Finishes definition of embedded sub-process.
   */
  subDone(): BpmnBuilder {
    if (BPMN_BUILD.isEventSubprocess) {
      // reset flags if boundary handler or event subprocess
      BPMN_BUILD.isEventSubprocess = false;
      BUILD.currentElement = BPMN_BUILD.lastElementBeforeEventSubprocess;
    } else {
      // normal sub-process
      BUILD.model.subDone();
    }

    return this;
  }

  /**
   * Set the current element to the element with the specified id.
   * @param id identifier of the element to return to
   */
  moveTo(id: string): BpmnBuilder {
    BUILD.model.moveTo(id);

    return this;
  }

  /**
   * Connects the current element with
   */
  connectTo(id: string): BpmnBuilder {
    BUILD.model.connectTo(id);

    return this;
  }

  /**
   * Tells that the current element is Activity.
   */
  asActivity(): ActivityBuilder {
    return new ActivityBuilder();
  }
}

@Singleton
export class ActivityBuilder extends BpmnBuilder {
  /**
   * Adds id property to the current activity.
   * @param id unique identifier of activity
   */
  id(id: string): ActivityBuilder {
    super.id(id);
    return this;
  }

  /**
   * Sets standard looping to previously specified activity.
   * @param condition looping condition
   * @param loopTest test condition before or after performing the action
   * @param maxLoop maximal number of loops
   */
  loop(
    condition: () => boolean,
    loopTest?: LoopTest,
    maxLoop?: number
  ): ActivityBuilder {
    (BUILD.currentElement as Activity).setLooping(condition, loopTest, maxLoop);

    return this;
  }

  /**
   * Sets multi-instance looping to previously specified activity.
   * @param items array to iterate
   * @param onIteration callback of one
   * @param multiType
   */
  multi(
    items: any[],
    onIteration?: (item: any) => void,
    multiType?: MultiType
  ): ActivityBuilder {
    (BUILD.currentElement as Activity).setMultiinstance(
      items,
      onIteration,
      multiType
    );

    return this;
  }

  /**
   * Adds boundary event and its handler to the current activity. Must be followed by event.
   */
  boundary(isInterrupting = true): BpmnBuilder {
    BPMN_BUILD.isBoundary = true;
    BPMN_BUILD.isBoundaryInterrupting = isInterrupting;

    return new BpmnBuilder();
  }
}

/**
 * Creates an empty BPMN process model.
 * @param id unique identifier of the process
 */
export function bpmn(id?: string): BpmnBuilder {
  // create model and add the top sub-process - parent of all BPMN elements
  BUILD.model = new ProcessModel(id);
  BUILD.model.addSub(new EmbeddedSubprocess());

  // initialize all used builders, return the top-most
  new ActivityBuilder();
  return new BpmnBuilder();
}
