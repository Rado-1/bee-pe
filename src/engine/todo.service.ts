import { Singleton, uuid } from './utils';

export class Todo {
  id: string;
  input: any;
  output: any;

  submit() {}
}

@Singleton
export class TodoService {
  todos: Todo[];

  createTodo(todo: Todo) {
    todo.id = uuid();
  }
}
