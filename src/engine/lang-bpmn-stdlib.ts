import {
  Activity,
  BpmnBuilder,
  ActivityBuilder,
  BUILD_BPMN,
} from './lang-bpmn';
import { ActionNoParam, Action, Flexible, getValueOfFlexible } from './utils';
import * as readline from 'readline';
import { Todo, TodoProperties } from './todo.service';
import { FlowElement } from './lang';

// ========================================================================== //
// Task Types

/**
 * Task that executes a script.
 */
export class ScriptTask extends Activity {
  private script: ActionNoParam;

  constructor(script: ActionNoParam, id?: string) {
    super(id);
    this.script = script;
  }

  protected do(): Promise<void> {
    return new Promise((resolve) => {
      this.script();
      resolve();
    });
  }
}

/**
 * Task that requests user's input form console. This is used mainly for process
 * debugging purposes when some user inputs are required.
 */
export class ConsoleInputTask extends Activity {
  private question: string;
  private action: Action<string>;
  static inputQueue: ConsoleInputTask[] = [];

  constructor(question: string, action: Action<string>, id?: string) {
    super(id);
    this.question = question;
    this.action = action;

    ConsoleInputTask.inputQueue.push(this);
  }

  // FIXME allow to execute more taskConcoleInputs concurrently
  // maybe create it as special taskTodo() or TodoTask class???
  // maybe just remove ConsoleInputTask and just define taskConsoleInput as special call of TodoTask???
  protected do(): Promise<void> {
    return new Promise((resolve) => {
      while (ConsoleInputTask.inputQueue.length) {
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        const ci = ConsoleInputTask.inputQueue.pop();
        rl.question(ci.question, (input: string) => {
          ci.action(input);
          rl.close();
        });
      }

      resolve();
    });
  }
}

/**
 * Task creating asynchronous todo. It pause the process flow token at this
 * point until the generated todo is submitted.
 */
export class TodoTask extends Activity {
  todoProperties: TodoProperties;

  constructor(properties: TodoProperties, id?: string) {
    super(id);
    this.todoProperties = Object.assign({}, properties);

    if (!properties.taskId) {
      this.todoProperties.taskId = id;
    }

    this.todoProperties.submitAction = (todo: Todo) => {
      if (properties.submitAction) {
        properties.submitAction(todo);
      }
      this.proceed();
    };
  }

  execute(fromElement?: FlowElement): void {
    this.do();
  }

  do(): Promise<void> {
    return new Promise((resolve) => {
      new Todo(this.todoProperties);
      resolve();
    });
  }
}

/**
 * Task used to stop debugging process at this place.
 */
export class BreakpointTask extends Activity {
  do(): Promise<void> {
    return new Promise<void>((resolve) => {
      // debugger stops here
      debugger;
      resolve();
    });
  }
}

// ========================================================================== //
// Extension of BpmnBuilder

declare module './lang-bpmn' {
  interface BpmnBuilder {
    /**
     * Adds a script task.
     * @param scr the script (function) executed if the task is running
     * @param id identifier of task
     */
    taskScript(scr: ActionNoParam, id?: string): ActivityBuilder;

    /**
     * Creates a log task. The log task logs the specified message to
     * console.
     * @param msg the message specified either as string or function returning
     * @param id identifier of task
     * string
     */
    taskLog(msg: Flexible<string>, id?: string): ActivityBuilder;

    /**
     * Creates a blocking console input task.
     * @param question question to be asked in console
     * @param action action that process the input string
     * @param id identifier of task
     */
    taskConsoleInput(
      question: string,
      action: (any) => void,
      id?: string
    ): ActivityBuilder;

    /**
     * Creates a todo task.
     * @param properties properties of todo; only submitAction property is
     * mandatory
     * @param id identifier of task
     */
    taskTodo(properties: TodoProperties, id?: string): ActivityBuilder;

    /**
     * Task representing a breakpoint in debugged process execution.
     * @param id identifier of task
     */
    taskBreakpoint(id?: string): ActivityBuilder;
  }
}

// ========================================================================== //
// Task commands

BpmnBuilder.prototype.taskScript = function (
  scr: ActionNoParam,
  id?: string
): ActivityBuilder {
  BUILD_BPMN.addNextElement(new ScriptTask(scr, id));

  return new ActivityBuilder();
};

BpmnBuilder.prototype.taskLog = function (
  msg: Flexible<string>,
  id?: string
): ActivityBuilder {
  BUILD_BPMN.addNextElement(
    new ScriptTask(() => console.log(getValueOfFlexible(msg)), id)
  );

  return new ActivityBuilder();
};

BpmnBuilder.prototype.taskConsoleInput = function (
  question: string,
  action: Action<string>,
  id?: string
): ActivityBuilder {
  BUILD_BPMN.addNextElement(new ConsoleInputTask(question, action, id));
  return new ActivityBuilder();
};

BpmnBuilder.prototype.taskTodo = function (
  properties: TodoProperties,
  id?: string
): ActivityBuilder {
  BUILD_BPMN.addNextElement(new TodoTask(properties, id));
  return new ActivityBuilder();
};

BpmnBuilder.prototype.taskBreakpoint = function (id?: string): ActivityBuilder {
  BUILD_BPMN.addNextElement(new BreakpointTask(id));
  return new ActivityBuilder();
};
