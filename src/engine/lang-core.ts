import { uuid } from './utils';

// ========================================================================== //
// Error processing

export class ProcessError extends Error {
  constructor(name: string, message?: string) {
    // see https://stackoverflow.com/questions/41102060/typescript-extending-error-class
    super(message);
    this.name = name;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  in(errorCodes: string[]): boolean {
    return errorCodes.includes(this.name);
  }
}

// ========================================================================== //
// Elements

/**
 * Execution  status of element.
 */
export enum ExecutionStatus {
  INACTIVE,
  ACTIVE,
  DONE_SUCCESS,
  DONE_FAILURE,
  INTERRUPTED,
}

export abstract class Element {
  readonly id: string;
  status: ExecutionStatus = ExecutionStatus.INACTIVE;

  constructor(id?: string) {
    this.id = id ? id : uuid();
  }

  /**
   * Executes the element.
   */
  execute(fromElement?: Element): void {
    this.status = ExecutionStatus.ACTIVE;
    this.onExecute(fromElement);
  }

  /**
   * Callback called when another element requested execution of this element.
   * @param fromElement element which requested execution of this element
   */
  protected onExecute(fromElement?: Element): void {}

  /**
   * Terminates execution of element.
   */
  terminate(): void {
    this.status = ExecutionStatus.INTERRUPTED;
  }
}

/**
 * A modeling element which can be put to flow process.
 */
export abstract class FlowElement extends Element {
  next: FlowElement[] = [];

  /**
   * Adds next element.
   * @param element next element
   */
  addNext(element: FlowElement): void {
    this.next.push(element);
    element.onAddNext(this);
  }

  /**
   * Callback called when another element calls addNext() with this element
   * as link target.
   * @param element link source element
   */
  protected onAddNext(element: FlowElement) {}

  /**
   * Executes the element. Runs its specific functionality and executes
   * next elements.
   */
  execute(fromElement?: FlowElement, alsoNext: boolean = true): void {
    super.execute(fromElement);
    this.do().then(() => {
      this.status = ExecutionStatus.DONE_SUCCESS;
      if (alsoNext) this.proceed();
    });
  }

  /**
   * Executes next elements, if exist.
   */
  protected proceed(): void {
    if (this.next.length > 0) {
      this.next.forEach((element) => {
        element.execute(this);
      });
    }
  }

  /**
   * Performs specific element's functionality
   */
  protected do(): Promise<void> {
    this.status = ExecutionStatus.ACTIVE;
    return new Promise((resolve) => resolve());
  }
}

// ========================================================================== //
// Models

export abstract class ProcessModel {
  id?: string;
  firstElement: Element;
  elements: Element[] = [];

  constructor(id?: string) {
    this.id = id;
  }

  add(element: Element): void {
    // set the first process element
    if (!this.firstElement) {
      this.firstElement = element;
    }
    this.elements.push(element);

    // set new current element
    BUILD.setCurrentElement(element);
  }

  findElement(id: string): Element {
    const foundElement = this.elements.find((element) => element.id == id);
    if (foundElement) {
      return foundElement;
    } else {
      throw new Error(`Element with id \'${id}\' not found.`);
    }
  }

  moveTo(id: string): void {
    BUILD.setCurrentElement(this.findElement(id));
  }

  /**
   * Executes the model.
   */
  execute() {
    this.firstElement.execute();
  }

  /**
   * Returns builder of given type for element in model. If element id is
   * omitted, the first model element is used. The returned builder can be
   * used to modify model.
   * @param builderType type of builder
   * @param elementId identifier of element becoming the current building element
   */
  getBuilder<T extends ProcessBuilder>(
    builderType: { new (): T },
    elementId?: string
  ): T {
    const element = this.findElement(elementId) ?? this.firstElement;

    BUILD.setCurrentModel(this);
    BUILD.setCurrentElement(element);

    return new builderType();
  }
}

export abstract class FlowModel extends ProcessModel {
  addNext(element: FlowElement): void {
    // link to previous current element
    if (BUILD_FLOW.getCurrentElement()) {
      BUILD_FLOW.getCurrentElement().addNext(element);
    }

    this.add(element);
  }

  connectTo(id: string): void {
    BUILD_FLOW.getCurrentElement().addNext(this.findElement(id) as FlowElement);
  }
}

// ========================================================================== //
// Builders

/**
 * Global variables of process building status.
 */
export class ProcessBuildStatus {
  protected currentModel: ProcessModel;
  protected modelStack: ProcessModel[] = [];
  protected currentElement: Element;
  protected elementStack: Element[] = [];

  setCurrentModel(model: ProcessModel): void {
    BUILD.modelStack.push(BUILD.currentModel);
    BUILD.currentModel = model;
    BUILD.elementStack.push(BUILD.currentElement);
    BUILD.currentElement = undefined;
  }

  unsetCurrentModel(): void {
    BUILD.currentModel = BUILD.modelStack.pop();
    BUILD.currentElement = BUILD.elementStack.pop();
  }

  getCurrentModel(): ProcessModel {
    return BUILD.currentModel;
  }

  addElement(element: Element): void {
    BUILD.currentModel.add(element);
  }

  getCurrentElement(): Element {
    return BUILD.currentElement;
  }

  setCurrentElement(element: Element) {
    BUILD.currentElement = element;
  }
}

export const BUILD = new ProcessBuildStatus();

export class FlowBuildStatus extends ProcessBuildStatus {
  getCurrentModel(): FlowModel {
    return super.getCurrentModel() as FlowModel;
  }

  getCurrentElement(): FlowElement {
    return super.getCurrentElement() as FlowElement;
  }

  addNextElement(element: FlowElement): void {
    this.getCurrentModel().addNext(element);
  }
}

export const BUILD_FLOW = new FlowBuildStatus();

/**
 * Generic builder for process models.
 */
export abstract class ProcessBuilder {
  /**
   * Finishes definition of the model.
   * @returns defined model
   */
  done(): ProcessModel {
    const model = BUILD.getCurrentModel();
    BUILD.unsetCurrentModel();
    return model;
  }
}

/**
 * Builder for flow-based processes models.
 */
export abstract class FlowBuilder extends ProcessBuilder {
  /**
   * Set the current element to the element with the specified id.
   * @param id identifier of the element to return to
   */
  moveTo(id: string): FlowBuilder {
    BUILD_FLOW.getCurrentModel().moveTo(id);
    return this;
  }

  /**
   * Connects the current element with
   */
  connectTo(id: string): FlowBuilder {
    BUILD_FLOW.getCurrentModel().connectTo(id);
    return this;
  }
}
