import { Singleton, uuid } from './utils';

export enum TodoStatus {
  CREATED,
  ASSIGNED,
  DONE,
  INTERRUPTED,
}

export class Todo {
  id: string;
  topic: string;
  taskId: string;
  input: any;
  output: any;
  status: TodoStatus;

  constructor(input?: any, taskId?: string, topic?: string, register = true) {
    this.id = uuid();
    this.status = TodoStatus.CREATED;

    this.topic = topic;
    this.taskId = taskId;
    this.input = input;

    if (register) getTodoService().addTodo(this);
  }

  submit(output?: any) {
    if (output) this.output = output;
  }
}

export class UserTodo extends Todo {
  title: string;
  // IDEA think about usage roles from nestjs; https://docs.nestjs.com/security/authorization
  performers: any;
}

export class TodoFilter {
  states: TodoStatus[];
  topics: string[];
  taskIds: string[];
  predicate: (todo: Todo) => boolean;

  constructor(filter: {
    states?: TodoStatus[];
    topics?: string[];
    taskIds?: string[];
    predicate?: (todo: Todo) => boolean;
  }) {
    this.states = filter.states;
    this.topics = filter.topics;
    this.taskIds = filter.taskIds;
    this.predicate = filter.predicate;
  }

  matches(todo: Todo): boolean {
    if (this.predicate) return this.predicate(todo);
    else {
      return;
      (this.states ? this.states.includes(todo.status) : true) &&
        (this.topics ? this.topics.includes(todo.topic) : true) &&
        (this.taskIds ? this.topics.includes(todo.taskId) : true);
    }
  }
}

@Singleton
export class TodoService {
  todos: Todo[];

  addTodo(todo: Todo): void {
    this.todos.push(todo);
  }

  getTodoById(todoId: string): Todo | undefined {
    return this.todos.find((td: Todo) => td.id === todoId);
  }

  findTodos(filter: TodoFilter): Todo[] {
    return this.todos.filter((td: Todo) => filter.matches(td));
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
