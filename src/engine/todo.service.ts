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

  submit() {}
}

export class UserTodo extends Todo {
  title: string;
  // IDEA think about usage roles from nestjs; https://docs.nestjs.com/security/authorization
  performers: any;
}

@Singleton
export class TodoService {
  todos: Todo[];

  createTodo(todo: Todo) {
    todo.id = uuid();
    todo.status = TodoStatus.CREATED;
  }
}
