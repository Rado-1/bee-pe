import { Action, Singleton, uuid } from './utils';

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
  /** Input data of todo. */
  input?: any;
  /** Issue action of todo. */
  issueAction?: Action<Todo>;
  /** Submit action of todo. */
  submitAction?: Action<Todo>;
  /** If true or unspecified, the todo is registered by [[TodoService]].
   * If false, the todo is not registered by TodoService. */
  register?: boolean;
  /** If true or unspecified, the todo remains in [[TodoService]] also after
   * submission. If false, the todo is removed from TodoService after
   * submission. */
  isPersistent?: boolean;
}

/**
 * Specification of todo filtering. The todos are filtered either by `predicate`
 * (todo is selected if the predicate is true) or by conjunction of other
 * criteria.
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
  /** Matching predicate. A todo matches if the predicate returns true for
   * todo. */
  predicate?: (todo: Todo) => boolean;
}

/**
 * Todo representing asynchronous action performed by an executor, for instance,
 * ui, service, external system, etc.
 */
export class Todo {
  /** Identifier of todo. It is computed by [[uuid | uuid() function]]. */
  id: string;
  /** Topic of todo used to determine its kind, owning process, etc. Various
   * todo executors usually use topic to filter "their" todos. */
  topic: string;
  /** Identifier of process task which produced todo. */
  taskId: string;
  /** If true, todo remains in [[TodoService]] after submit. If false, the todo
   * is after submit removed. */
  isPersistent: boolean;
  /** Data used to specify todo input. For instance, case identifier, business
   * data, human todo can specify performers, etc. */
  input: any;
  /** Output data specified in submit. */
  output: any;
  /** An action executed a last step of submit. */
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
    this.input = properties.input;
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
    if (filter.predicate) {
      return filter.predicate(this);
    } else {
      return (
        (filter.states ? filter.states.includes(this.status) : true) &&
        (filter.topics ? filter.topics.includes(this.topic) : true) &&
        (filter.taskIds ? filter.taskIds.includes(this.taskId) : true)
      );
    }
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
    this.todos.splice(
      this.todos.findIndex((td: Todo) => td == todo),
      1
    );
  }
}

/**
 * Returns TodoService singleton.
 */
export function getTodoService(): TodoService {
  return new TodoService();
}
