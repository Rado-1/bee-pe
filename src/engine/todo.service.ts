import {
  Action,
  Condition,
  Flexible,
  getValueOfFlexible,
  Singleton,
  uuid,
} from './utils';

/**
 * Runtime status of [[Todo]].
 */
export enum TodoStatus {
  /** Todo is created. */
  CREATED,
  /** Todo is allocated by executor. */
  ALLOCATED,
  /** Todo is done. */
  DONE,
  /** Todo execution has been interrupted. */
  INTERRUPTED,
}

/**
 * Properties of [[Todo]] used for its instantiation.
 */
export interface TodoProperties {
  /** Topic of todo. */
  topic?: string;
  /** Task id of todo. */
  taskId?: string;
  /** Input data of todo. It is, for instance, case identifier, business
   * data, human todo can specify performers, etc. */
  input?: Flexible<any>;
  /** Issue action of todo. */
  issueAction?: Action<Todo>;
  /** An action executed a last step of submit. */
  submitAction?: Action<Todo>;
  /** If true or unspecified, the todo is registered by [[TodoService]].
   * If false, the todo is not registered by TodoService. */
  register?: boolean;
  /** If true, todo remains in [[TodoService]] after submit. If false, the todo
   * is after submit removed. The default is true. */
  isPersistent?: boolean;
}

/**
 * Specification of todo filtering. The [[Todo]]s are filtered by conjunction of
 * criteria. If the criterion is not specified, it is considered as matched;
 * TodoFilter with all properties unspecified therefore matches any [[Todo]].
 */
export interface TodoFilter {
  /** Array of possible states. A todo matches if its state is listed here or
   * states is unspecified. */
  states?: TodoStatus[];
  /** Array of possible topics. A todo matches if its topic is listed here or
   * topics is unspecified. */
  topics?: string[];
  /** Array of possible task identifiers. A todo matches if its toskId is
   * listed here or tasksId is unspecified. */
  taskIds?: string[];
  /** Matching condition. A todo matches if the condition returns
   * true for it. */
  condition?: Condition<Todo>;
}

/**
 * Todo representing asynchronous action performed by an executor, for instance,
 * ui, service, external system, etc.
 */
export class Todo implements TodoProperties {
  /** Identifier of todo. It is computed by [[uuid | uuid() function]]. */
  id: string;
  topic: string;
  taskId: string;
  input: any;
  isPersistent: boolean;
  /** Output data specified in submit. */
  output: any;
  submitAction: Action<Todo>;
  /** Runtime status of todo. */
  status: TodoStatus;
  /** Specification (usually identifier) of todo executor after allocation. */
  allocatedBy: any;

  constructor(properties: TodoProperties) {
    this.id = uuid();
    this.status = TodoStatus.CREATED;

    this.topic = properties.topic;
    this.taskId = properties.taskId;
    this.input = getValueOfFlexible(properties.input);
    this.submitAction = properties.submitAction;

    const register = properties.register ?? true;
    this.isPersistent = (properties.isPersistent ?? true) && register;
    if (register) getTodoService().addTodo(this);

    if (properties.issueAction) {
      properties.issueAction(this);
    }
  }

  allocate(by?: any): void {
    this.status = TodoStatus.ALLOCATED;
    this.allocatedBy = by;
  }

  unallocate(): void {
    if (this.status == TodoStatus.ALLOCATED) {
      this.status = TodoStatus.CREATED;
    }
  }

  submit(output?: any): void {
    if (output) this.output = output;

    this.submitAction(this);

    this.status = TodoStatus.DONE;

    if (!this.isPersistent) {
      getTodoService().removeTodo(this);
    }
  }

  matches(filter: TodoFilter): boolean {
    return (
      (filter.states ? filter.states.includes(this.status) : true) &&
      (filter.topics ? filter.topics.includes(this.topic) : true) &&
      (filter.taskIds ? filter.taskIds.includes(this.taskId) : true) &&
      (filter.condition ? filter.condition(this) : true)
    );
  }
}

@Singleton
export class TodoService {
  todos: Todo[] = [];

  addTodo(todo: Todo): void {
    this.todos.push(todo);
  }

  getTodoById(todoId: string): Todo | undefined {
    return this.todos.find((td: Todo) => td.id === todoId);
  }

  findTodos(filter: TodoFilter): Todo[] {
    return this.todos.filter((td: Todo) => td.matches(filter));
  }

  removeTodo(todo: Todo): void {
    this.todos.splice(this.todos.findIndex((td: Todo) => td == todo));
  }
}

/**
 * Returns an instance of TodoService.
 */
export function getTodoService(): TodoService {
  return new TodoService();
}
