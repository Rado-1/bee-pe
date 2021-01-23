// *** SECTION *** Elements

import { Action, Condition, uuid } from './utils';

export abstract class Element {
  id: string;

  constructor(id?: string) {
    this.id = id ? id : uuid();
  }

  /**
   * Executes the element.
   */
  execute(fromElement?: Element): void {
    this.onExecute(fromElement);
  }

  /**
   * Callback called when another element requested execution of this element.
   * @param fromElement element which requested execution of this element
   */
  protected onExecute(fromElement?: Element): void {}
}

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
    return new Promise((resolve) => resolve());
  }
}

// *** SECTION *** Models

export class ProcessModel {
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
      throw new Error(`Element with id ${id} not found.`);
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
}

export class FlowModel extends ProcessModel {
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

// *** SECTION *** Builders

/**
 * Global variables of process building status.
 */
class ProcessBuildStatus {
  protected currentModel: ProcessModel;
  protected modelStack: ProcessModel[] = [];
  protected currentElement: Element;
  protected elementStack: Element[] = [];

  setCurrentModel(model: ProcessModel): void {
    this.modelStack.push(this.currentModel);
    this.currentModel = model;
    this.elementStack.push(this.currentElement);
    this.currentElement = undefined;
  }

  unsetCurrentModel(): void {
    this.currentModel = this.modelStack.pop();

    BUILD.currentElement = this.elementStack.pop();
  }

  getCurrentModel(): ProcessModel {
    return this.currentModel;
  }

  addElement(element: Element): void {
    this.currentModel.add(element);
  }

  getCurrentElement(): Element {
    return this.currentElement;
  }

  setCurrentElement(element: Element) {
    this.currentElement = element;
  }
}

export const BUILD = new ProcessBuildStatus();

/**
 * Proxy to BUILD variable. Ensures that all properties are get/set from global
 * BUILD variable. All concrete builders should extend it directly or
 * indirectly.
 */
export abstract class ProxyBuildStatus extends ProcessBuildStatus {
  setCurrentModel(model: ProcessModel) {
    BUILD.setCurrentModel(model);
  }

  unsetCurrentModel() {
    BUILD.unsetCurrentModel();
  }

  getCurrentModel(): ProcessModel {
    return BUILD.getCurrentModel();
  }

  getCurrentElement(): Element {
    return BUILD.getCurrentElement();
  }

  setCurrentElement(element: Element) {
    BUILD.setCurrentElement(element);
  }
}

export class FlowBuildStatus extends ProxyBuildStatus {
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
