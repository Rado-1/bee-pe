// Elements

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
  protected do(): Promise<void> {
    return new Promise((resolve) => resolve());
  }
}

// Process model

export class ProcessModel {
  id?: string;
  topElement: Element;
  elements: Element[] = [];

  constructor(id?: string) {
    this.id = id;
  }

  add(element: Element): void {
    // set first process element
    if (!this.topElement) {
      this.topElement = element;
    }
    this.elements.push(element);

    // set parent and first child
    if (BUILD.currentParent) {
      element.parent = BUILD.currentParent;

      if (!BUILD.currentParent.firstChild) {
        BUILD.currentParent.firstChild = element;
        // first child cannot be connected as next to its parent =>
        BUILD.currentElement = null;
      }
    }

    // link to previous current element and set new current element
    if (BUILD.currentElement) {
      BUILD.currentElement.addNext(element);
    }
    BUILD.currentElement = element;
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
    BUILD.currentElement = this.findElement(id);
  }

  connectTo(id: string): void {
    BUILD.currentElement.addNext(this.findElement(id));
  }

  addSub(parentElement: Element) {
    this.add(parentElement);
    BUILD.currentParent = parentElement;
  }

  subDone(): void {
    if (BUILD.currentParent != this.topElement) {
      BUILD.currentElement = BUILD.currentParent;
      BUILD.currentParent = BUILD.currentElement.parent;
    } else {
      throw new Error('Not in sub-process.');
    }
  }

  /**
   * Executes the model.
   */
  execute() {
    this.topElement.execute();
  }
}

// Builders

/**
 * Global variables of process building status.
 */
class GenericBuildStatus {
  model: ProcessModel;
  currentElement: Element;
  currentParent: Element;
}

export const BUILD = new GenericBuildStatus();

/**
 * Generic element builder.
 */
export abstract class ElementBuilder {
  // TODO id can be used even if no previous element was specified
  /**
   * Adds id property to the current element.
   * @param id element's unique identifier
   */
  id(id: string): ElementBuilder {
    BUILD.currentElement.id = id;

    return this;
  }

  /**
   * Finishes definition of the model.
   * @returns defined model
   */
  done(): ProcessModel {
    // clear building variables
    BUILD.currentParent = undefined;
    BUILD.currentElement = undefined;

    return BUILD.model;
  }
}

/**
 * Builder for flow-based models.
 */
export abstract class FlowBuilder extends ElementBuilder {
  /**
   * Set the current element to the element with the specified id.
   * @param id identifier of the element to return to
   */
  moveTo(id: string): FlowBuilder {
    BUILD.model.moveTo(id);

    return this;
  }

  /**
   * Connects the current element with
   */
  connectTo(id: string): FlowBuilder {
    BUILD.model.connectTo(id);

    return this;
  }
}
