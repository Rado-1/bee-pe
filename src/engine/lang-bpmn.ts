// TODO check building model - all things
// TODO executional semantics for boundary
// TODO executional semantics for event subprocesses
// TODO implement activity looping semantics
// TODO design timers for delay and date+period events
// TODO implement semantics of conditional event
// TODO implement eventTerminate()

import {
  Element,
  FlowElement,
  FlowModel,
  FlowBuilder,
  FlowBuildStatus,
  ProcessModel,
} from './lang-core';
import {
  getSignalService,
  Signal,
  SignalProperties,
  SignalReceiver,
  SignalReceiverProperties,
} from './signal.service';
import {
  Singleton,
  Flexible,
  getValueOfFlexible,
  ConditionNoParam,
  ActionNoParam,
  Action,
} from './utils';

// ========================================================================== //
// Elements

// TODO implement interruption of boundary owner if specified
abstract class CatchEvent extends FlowElement {
  isContinuous: boolean = false;
  isInterrupting: boolean = false;
  owner: Element;
}

abstract class CatchAsyncEvent extends CatchEvent {
  // TODO reconsider it to move it to CatchEvent
  // blocks automatic call of proceed() after do(); it is done by event
  execute(fromElement?: FlowElement): void {
    this.do();
  }
}

export class ConditionalEvent extends CatchEvent {
  condition: ConditionNoParam;

  constructor(condition: ConditionNoParam, id?: string) {
    super(id);
    this.condition = condition;
  }

  // TODO implement do() - promise waiting for condition
}

// TODO fix: date shouldnot be taken from time of specifying the model, but from time when this element is executed; use function
export class TimeEvent extends CatchEvent {
  protected date: number;
  protected period?: number;

  constructor(date: number, period?: number, id?: string) {
    super(id);
    this.date = date;
    this.period = period;
  }

  protected do(): Promise<void> {
    return new Promise((resolve) =>
      setTimeout(() => {
        resolve();
        this.repeat(resolve);
      }, this.date - Date.now())
    );
  }

  // TODO ??? fix: implement with promise ???
  repeat(resolve: ActionNoParam) {
    if (this.period) {
      setTimeout(() => {
        resolve;
        this.repeat(resolve);
      }, this.period);
    }
  }
}

export class ThrowSignalEvent extends FlowElement {
  signalProperties: SignalProperties;

  constructor(properties: SignalProperties, id?: string) {
    super(id);
    this.signalProperties = properties;
  }

  protected do(): Promise<void> {
    return new Promise((resolve) => {
      new Signal(this.signalProperties).send();
      resolve();
    });
  }
}

export class CatchSignalEvent extends CatchAsyncEvent {
  signalReceiverProperties: SignalReceiverProperties;

  constructor(properties: SignalReceiverProperties, id?: string) {
    super(id);
    this.signalReceiverProperties = Object.assign({}, properties);
    this.signalReceiverProperties.receiveAction = (signal: Signal) => {
      if (properties.receiveAction) {
        properties.receiveAction(signal);
      }
      this.proceed();
    };
  }

  protected do(): Promise<void> {
    return new Promise((resolve) => {
      getSignalService().registerReceiver(
        new SignalReceiver(this.signalReceiverProperties)
      );
      resolve();
    });
  }
}

/* IDEA think about eventErrorThrow (also fails plans),
 * eventErrorCatch(filter: Condition<any>, action: Action<any>),
 * eventSignalThrow, eventSignalCatch(filter: Condition<any>, action: Action<any>)) */

export class EndEvent extends FlowElement {
  // do not proceed
  protected proceed(): void {}
}

// TODO realize the following idea:
/**
 * Idea: gatewayParallel(id: string,
 *    joinCondition?: (Map<string, number>) => boolean,
 *    joinAction?: (Map<string, number>) => Map<string, number>)
 *
 *  joinCondition: specifyies the condition when tokens can be put to output
 *    flow(s)
 *  joinAction: updates number of input tokens when output tokens are generated
 *  remark: the map represent the value of incomingTokens
 */
export class ParallelGateway extends FlowElement {
  // number of tokens at incoming flows identified by ids of connected elements
  incomingTokens = new Map<string, number>();

  /**
   * Registers incoming flow.
   * @param element element from which the flow comes
   */
  protected onAddNext(element: FlowElement) {
    this.incomingTokens.set(element.id, 0);
  }

  /**
   * Increments number of token on a flow coming from element.
   * @param fromElement element from which the token comes
   */
  protected onExecute(fromElement?: FlowElement) {
    this.incomingTokens.set(
      fromElement.id,
      this.incomingTokens.get(fromElement.id) + 1
    );
  }

  /**
   * Checks existence of tokens on each incoming flow.
   */
  protected proceed(): void {
    // at least one token on each incoming flow
    // TODO find more effective way
    if (
      [...this.incomingTokens.values()].find((val) => val === 0) === undefined
    ) {
      super.proceed();
      // decrease number of tokens on incoming flows
      // TODO find more effective way
      this.incomingTokens.forEach((value, key) => {
        this.incomingTokens.set(key, value > 1 ? value - 1 : 0);
      });
    }
  }
}

export class ExclusiveGateway extends FlowElement {
  protected proceed(): void {
    let nextElement: FlowElement;

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

export class Guard extends FlowElement {
  private condition: ConditionNoParam;
  isDefault: boolean;

  constructor(condition?: ConditionNoParam) {
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

/**
 * Activity looping test kind.
 */
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

export abstract class Activity extends FlowElement {
  // looping properties
  protected loopingType: LoopingType;
  protected loopCondition: ConditionNoParam;
  protected loopTest: LoopTest;
  protected loopMax: Flexible<number>;
  protected multiItems: Flexible<any[]>;
  protected multiOnIteration: Action<any>;
  protected multiType?: MultiType;
  protected boundaryEvents: CatchEvent[] = [];

  setLooping(
    loopCondition?: ConditionNoParam,
    loopTest?: LoopTest,
    loopMax?: Flexible<number>
  ): void {
    this.loopingType = LoopingType.STANDARD;
    this.loopCondition = loopCondition ?? (() => true);
    this.loopTest = loopTest ?? LoopTest.BEFORE;
    this.loopMax = loopMax;
  }

  setMultiinstance(
    items: Flexible<any[]>,
    onIteration?: Action<any>,
    multiType?: MultiType
  ) {
    this.loopingType = LoopingType.MULTIINSTANCE;
    this.multiItems = items;
    this.multiOnIteration = onIteration;
    this.multiType = multiType ?? MultiType.PARALLEL;
  }

  addBoundaryEvent(event: CatchEvent) {
    this.boundaryEvents.push(event);
  }

  execute(fromElement?: FlowElement): void {
    // looping
    switch (this.loopingType) {
      case LoopingType.STANDARD:
        let iterator = getValueOfFlexible(this.loopMax);

        if (this.loopTest === LoopTest.BEFORE) {
          while ((!this.loopMax || iterator-- > 0) && this.loopCondition()) {
            super.execute(fromElement, false);
          }
        } else {
          do {
            super.execute(fromElement, false);
          } while ((!this.loopMax || iterator-- > 0) && this.loopCondition());
        }

        this.proceed();

        break;

      case LoopingType.MULTIINSTANCE:
        switch (this.multiType) {
          case MultiType.PARALLEL:
            getValueOfFlexible(this.multiItems).forEach((item) => {
              this.multiOnIteration(item);
              super.execute(fromElement, false);
            });

            break;

          case MultiType.SEQUENTIAL:
            super.execute(fromElement, false);
        }

        this.proceed();

        break;

      default:
        // no looping set
        super.execute(fromElement);
    }
  }
}

export class Subprocess extends Activity {
  protected processModel: Flexible<ProcessModel>;

  constructor(processModel: Flexible<ProcessModel>, id?: string) {
    super(id);
    this.processModel = processModel;
  }

  protected do(): Promise<void> {
    return new Promise((resolve) => {
      getValueOfFlexible(this.processModel).execute();
      resolve();
    });
  }
}

// ========================================================================== //
// Models

export class BpmnModel extends FlowModel {
  protected eventSubprocesses: EventProcessModel[] = [];

  addNext(element: FlowElement) {
    // setting boundary event
    if (BUILD_BPMN.isBoundary) {
      if (element instanceof CatchEvent) {
        const event: CatchEvent = element as CatchEvent;

        event.isContinuous = true;
        event.isInterrupting = BUILD_BPMN.isBoundaryInterrupting;
        event.owner = BUILD_BPMN.boundaryOwner;
        BUILD_BPMN.boundaryOwner.addBoundaryEvent(event);
        BUILD_BPMN.isBoundary = false;
        BUILD_BPMN.setCurrentElement(undefined);
      } else {
        throw new Error('Boundary must start with event.');
      }
    }

    super.addNext(element);
  }

  addEventSubprocess(eventSubProcess: EventProcessModel) {
    this.eventSubprocesses.push(eventSubProcess);
  }
}

export class EventProcessModel extends BpmnModel {
  add(element: FlowElement): void {
    if (!this.findElement) {
      // first element must be event
      if (element instanceof CatchEvent) {
        // first element is continuous
        (element as CatchEvent).isContinuous = true;
      } else {
        throw new Error('First element of event sub-process must be event');
      }
    }

    super.add(element);
  }

  addEventSubprocess(eventSubProcess: EventProcessModel) {
    throw new Error('Event sub-process cannot contain event sub-process');
  }
}

// ========================================================================== //
// Builders

/**
 * Global variables of BPMN process building status.
 */
export class BpmnBuildStatus extends FlowBuildStatus {
  isBoundary: boolean = false;
  isBoundaryInterrupting: boolean;
  boundaryOwner: Activity;

  getCurrentModel(): BpmnModel {
    return super.getCurrentModel() as BpmnModel;
  }
}

export const BUILD_BPMN = new BpmnBuildStatus();

@Singleton
export class BpmnBuilder extends FlowBuilder {
  /**
   * Create conditional event.
   * @param condition condition which triggers the event
   */
  eventConditional(condition: ConditionNoParam, id?: string): BpmnBuilder {
    BUILD_BPMN.addNextElement(new ConditionalEvent(condition, id));
    return this;
  }

  // TODO make parameters flexible; reconsider timer parameters
  /**
   * Create Catch Time Event.
   * @param date
   * @param period
   * @param id event identifier
   */
  eventTime(date: number, period?: number, id?: string): BpmnBuilder {
    BUILD_BPMN.addNextElement(new TimeEvent(date, period, id));
    return this;
  }

  /**
   * Create Throw Signal Event.
   * @param signalProperties signal properties
   * @param id event identifier
   */
  eventThrowSignal(
    signalProperties: SignalProperties,
    id?: string
  ): BpmnBuilder {
    BUILD_BPMN.addNextElement(new ThrowSignalEvent(signalProperties, id));
    return this;
  }

  /**
   * Create Catch Signal Event.
   * @param signalReceiverProperties
   * @param id
   */
  eventCatchSignal(
    signalReceiverProperties: SignalReceiverProperties,
    id?: string
  ): BpmnBuilder {
    BUILD_BPMN.addNextElement(
      new CatchSignalEvent(signalReceiverProperties, id)
    );
    return this;
  }

  /**
   * Create Simple End Event.
   */
  eventEnd(): BpmnBuilder {
    BUILD_BPMN.addNextElement(new EndEvent());
    return this;
  }

  /**
   * Adds Parallel Gateway.
   * @param id optional identifier of gateway
   */
  gatewayParallel(id: string): BpmnBuilder {
    BUILD_BPMN.addNextElement(new ParallelGateway(id));
    return this;
  }

  /**
   * Adds Exclusive Gateway.
   * @param id optional identifier of gateway
   */
  gatewayExclusive(id?: string): BpmnBuilder {
    BUILD_BPMN.addNextElement(new ExclusiveGateway(id));
    return this;
  }

  /**
   * Adds guard condition for a flow coming from Exclusive Gateway.
   * @param condition guard condition
   */
  guard(condition: ConditionNoParam): BpmnBuilder {
    BUILD_BPMN.addNextElement(new Guard(condition));
    return this;
  }

  /**
   * Adds default flow coming from Exclusive Gateway.
   */
  default(): BpmnBuilder {
    BUILD_BPMN.addNextElement(new Guard());
    return this;
  }

  /**
   * Includes sub-process; either call or embedded.
   * @param processModel process model
   */
  sub(processModel: Flexible<ProcessModel>, id?: string): ActivityBuilder {
    BUILD_BPMN.addNextElement(new Subprocess(processModel, id));
    return new ActivityBuilder();
  }

  /**
   * Creates event sub-process.
   */
  subEvent(eventProcessModel: EventProcessModel): BpmnBuilder {
    BUILD_BPMN.getCurrentModel().addEventSubprocess(eventProcessModel);
    return this;
  }

  /**
   * Set the current element to the element with the specified id.
   * @param id identifier of the element to return to
   */
  moveTo(id: string): BpmnBuilder {
    BUILD_BPMN.getCurrentModel().moveTo(id);
    return this;
  }

  /**
   * Connects the current element with
   */
  connectTo(id: string): BpmnBuilder {
    BUILD_BPMN.getCurrentModel().connectTo(id);
    return this;
  }

  /**
   * Returns the current element as Activity.
   */
  asActivity(): ActivityBuilder {
    return new ActivityBuilder();
  }

  /**
   * Finishes definition of the model.
   * @returns defined model
   */
  done(): BpmnModel {
    return super.done() as BpmnModel;
  }
}

@Singleton
export class ActivityBuilder extends BpmnBuilder {
  /**
   * Sets standard looping to previously specified activity.
   * @param condition looping condition
   * @param test test condition before or after performing the action
   * @param max maximal number of loops
   */
  loop(
    condition: ConditionNoParam,
    test?: LoopTest,
    max?: Flexible<number>
  ): ActivityBuilder {
    (BUILD_BPMN.getCurrentElement() as Activity).setLooping(
      condition,
      test,
      max
    );

    return this;
  }

  /**
   * Sets multi-instance looping to previously specified activity.
   * @param items array to iterate
   * @param onIteration callback of one
   * @param multiType
   */
  multi(
    items: Flexible<any[]>,
    onIteration?: Action<any>,
    multiType?: MultiType
  ): ActivityBuilder {
    (BUILD_BPMN.getCurrentElement() as Activity).setMultiinstance(
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
    BUILD_BPMN.isBoundary = true;
    BUILD_BPMN.isBoundaryInterrupting = isInterrupting;
    BUILD_BPMN.boundaryOwner = BUILD_BPMN.getCurrentElement() as Activity;

    return new BpmnBuilder();
  }
}

/**
 * Creates an empty BPMN process model.
 * @param id unique identifier of the process
 */
export function bpmn(id?: string): BpmnBuilder {
  // create model and add the top sub-process - parent of all BPMN elements
  BUILD_BPMN.setCurrentModel(new BpmnModel(id));

  // initialize all used builders, return the top-most
  new ActivityBuilder();
  return new BpmnBuilder();
}
