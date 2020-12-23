/// Elements

// TODO implement activity looping
// TODO design timers for delay and date+period events
// TODO ??? _P_event -> event sub-process; or use intermediate events without input flows...? or _P_embedded/call starting with event
// TODO _E_terminate()
// TODO boundary events -> see Camunda
// TODO reconsider applying builder pattern strictly; learn it

export abstract class Element {
  id: string;

  next: Element[] = [];
  parent?: Element;
  firstChild?: Element;

  constructor(id?: string) {
    this.id = id
      ? id
      : // UUID
        ('' + 1e7 + -1e3 + -4e3 + -8e3 + -1e11).replace(/1|0/g, function () {
          return (0 | (Math.random() * 16)).toString(16);
        });
  }

  /**
   * Adds next element.
   * @param element next element
   */
  addNext(element: Element): void {
    this.next.push(element);
    element.onAddNext(this);
  }

  /**
   * Callback called when another element calls addNext() with this element
   * as link target.
   * @param element link source element
   */
  protected onAddNext(element: Element) {}

  // TODO maybe solve better alsoNext by better structuring of proceed methods...
  /**
   * Executes the element. Runs its specific functionality and executes
   * sub-elements and next elements.
   */
  execute(fromElement?: Element, alsoNext: boolean = true): void {
    this.onExecute(fromElement);
    this.do().then(() => this.proceed(alsoNext));
  }

  /**
   * Callback called when another element requested execution of this element.
   * @param fromElement element which requested execution of this element
   */
  protected onExecute(fromElement?: Element): void {}

  /**
   * Moves tokens to children or next elements. This is the default element
   * behavior which can be overridden in subclasses.
   */
  protected proceed(alsoNext?: boolean): void {
    if (this.firstChild) {
      this.firstChild.execute(this);
    } else if (alsoNext) {
      this.executeNext();
    }
  }

  /**
   * Executes next elements or parent, if exist.
   */
  executeNext(): void {
    if (this.next.length > 0) {
      this.next.forEach((element) => {
        element.execute(this);
      });
    } else if (this.parent) {
      this.parent.executeNext();
    }
  }

  /**
   * Performs specific element's functionality
   */
  protected async do(): Promise<void> {
    return await new Promise((resolve) => resolve());
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

enum LoopingType {
  STANDARD,
  MULTIINSTANCE,
}

export class Activity extends Element {
  protected loopingType: LoopingType;
  protected loopCondition: () => boolean;
  protected loopTest: LoopTest;
  protected maxLoop: number;
  protected items: any[];
  protected onIteration: (item: any) => void;
  protected multiType?: MultiType;

  setLooping(
    condition: () => boolean,
    loopTest: LoopTest = LoopTest.BEFORE,
    maxLoop?: number
  ): void {
    this.loopingType = LoopingType.STANDARD;
    this.loopCondition = condition;
    this.loopTest = loopTest;
    this.maxLoop = maxLoop;
  }

  setMultiinstance(
    items: any[],
    onIteration?: (item: any) => void,
    multiType: MultiType = MultiType.PARALLEL
  ) {
    this.loopingType = LoopingType.MULTIINSTANCE;
    this.items = items;
    this.onIteration = onIteration;
    this.multiType = multiType;
  }

  execute(fromElement?: Element): void {
    // looping
    switch (this.loopingType) {
      case LoopingType.STANDARD:
        let iterator = this.maxLoop;

        if (this.loopTest === LoopTest.BEFORE) {
          while ((!this.maxLoop || iterator-- > 0) && this.loopCondition()) {
            super.execute(fromElement, false);
          }
        } else {
          do {
            super.execute(fromElement, false);
          } while ((!this.maxLoop || iterator-- > 0) && this.loopCondition());
        }

        this.executeNext();

        break;

      case LoopingType.MULTIINSTANCE:
        switch (this.multiType) {
          case MultiType.PARALLEL:
            this.items.forEach((item) => {
              this.onIteration(item);
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

export class CallSubprocess extends Activity {
  protected processModel: ProcessModel;

  constructor(processModel: ProcessModel) {
    super();
    this.processModel = processModel;
  }

  protected async do(): Promise<void> {
    return await new Promise((resolve) => {
      this.processModel.execute();
      resolve();
    });
  }
}

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

// Technically, can be omitted
export class NoneEvent extends Element {}

export class EndEvent extends Element {
  // proceed execution only to parent if exists
  protected proceed(): void {
    if (this.parent) {
      this.parent.executeNext();
    }
  }
}

// TODO fix: date shouldnot be taken from time of specifying the model, but from time when this element is executed; use function
export class TimeEvent extends Element {
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

export class ProcessModel {
  processId?: string;
  firstElement: Element;
  currentElement: Element;
  currentParent?: Element = null;
  elements: Element[] = [];

  add(element: Element): void {
    // set first process element
    if (!this.firstElement) {
      this.firstElement = element;
    }
    this.elements.push(element);

    // set parent and first child
    if (this.currentParent) {
      element.parent = this.currentParent;

      if (!this.currentParent.firstChild) {
        this.currentParent.firstChild = element;
        // first child cannot be connected as next to its parent =>
        this.currentElement = null;
      }
    }

    // link to previous current element and set new current element
    if (this.currentElement) {
      this.currentElement.addNext(element);
    }
    this.currentElement = element;
  }

  findElement(id: string): Element {
    const foundElement = this.elements.find((element) => element.id == id);
    if (foundElement) {
      return foundElement;
    } else {
      throw new Error(`Element with id ${id} not found.`);
    }
  }

  moveTo(id: string): void {
    this.currentElement = this.findElement(id);
  }

  connectTo(id: string): void {
    this.currentElement.addNext(this.findElement(id));
  }

  sub(parentElement: Element) {
    this.add(parentElement);
    this.currentParent = parentElement;
  }

  subDone(): void {
    this.currentElement = this.currentParent;
    this.currentParent = this.currentElement.parent;
  }

  /**
   * Executes the model.
   */
  execute() {
    this.firstElement.execute();
  }
}

// Builders

export class ElementBuilder {
  protected static instance = new ElementBuilder();
  protected model: ProcessModel;

  protected constructor() {}

  static getInstance(model: ProcessModel) {
    if (model) {
      ElementBuilder.instance.model = model;
    }

    return ElementBuilder.instance;
  }

  /**
   * Adds id property to the current element.
   * @param id element's unique identifier
   */
  id(id: string): ElementBuilder {
    this.model.currentElement.id = id;

    return this;
  }

  /**
   * Adds None Event.
   */
  _E_none(): ElementBuilder {
    this.model.add(new NoneEvent());

    return ElementBuilder.getInstance(this.model);
  }

  /**
   * Adds Simple End Event.
   */
  _E_end(): ElementBuilder {
    this.model.add(new EndEvent());

    return ElementBuilder.getInstance(this.model);
  }

  /**
   * Adds Time Event.
   * @param date
   * @param period
   */
  _E_time(date: number, period?: number): ElementBuilder {
    this.model.add(new TimeEvent(date, period));

    return ElementBuilder.getInstance(this.model);
  }

  /**
   * Adds Parallel Gateway.
   * @param id identifier of gateway
   */
  _G_parallel(id: string): ElementBuilder {
    this.model.add(new ParallelGateway(id));

    return ElementBuilder.getInstance(this.model);
  }

  /**
   * Adds Exclusive Gateway.
   * @param id? optional identifier of gateway
   */
  _G_exclusive(id?: string): ElementBuilder {
    this.model.add(new ExclusiveGateway(id));

    return ElementBuilder.getInstance(this.model);
  }

  /**
   * Adds guard condition for a flow coming from Exclusive Gateway.
   * @param condition guard condition
   */
  guard(condition: () => boolean): ElementBuilder {
    this.model.add(new Guard(condition));

    return ElementBuilder.getInstance(this.model);
  }

  /**
   * Adds default flow coming from Exclusive Gateway.
   */
  default(): ElementBuilder {
    this.model.add(new Guard());

    return ElementBuilder.getInstance(this.model);
  }

  /**
   * Instantiates process model as sub-process.
   * @param processModel process model to be instantiated as sub-process
   */
  call(processModel: ProcessModel): ActivityBuilder {
    this.model.add(new CallSubprocess(processModel));

    return ActivityBuilder.getInstance(this.model);
  }

  /**
   * Adds embedded sub-process.
   */
  sub(): ActivityBuilder {
    this.model.sub(new Activity());

    return ActivityBuilder.getInstance(this.model);
  }

  /**
   * Finishes definition of embedded sub-process.
   */
  subDone(): ElementBuilder {
    this.model.subDone();

    return ElementBuilder.getInstance(this.model);
  }

  /**
   * Set the current element to the element with the specified id.
   * @param id identifier of the element to return to
   */
  moveTo(id: string): ElementBuilder {
    this.model.moveTo(id);

    return ElementBuilder.getInstance(this.model);
  }

  /**
   * Connects the current element with
   */
  connectTo(id: string): ElementBuilder {
    this.model.connectTo(id);

    return ElementBuilder.getInstance(this.model);
  }

  /**
   * Finishes definition of the model.
   * @returns defined model
   */
  done(): ProcessModel {
    return this.model;
  }
}

export class ActivityBuilder extends ElementBuilder {
  protected static instance = new ActivityBuilder();

  protected constructor() {
    super();
  }

  static getInstance(model: ProcessModel) {
    if (model) {
      ActivityBuilder.instance.model = model;
    }

    return ActivityBuilder.instance;
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
    (this.model.currentElement as Activity).setLooping(
      condition,
      loopTest,
      maxLoop
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
    items: any[],
    onIteration?: (item: any) => void,
    multiType?: MultiType
  ): ActivityBuilder {
    (this.model.currentElement as Activity).setMultiinstance(
      items,
      onIteration,
      multiType
    );

    return this;
  }
}

/**
 * Creates an empty process.
 * @param id unique identifier of the process
 */
export function process(id?: string): ElementBuilder {
  const model = new ProcessModel();
  model.processId = id;

  return ElementBuilder.getInstance(model);
}
