import {
  Activity,
  BpmnBuilder,
  ActivityBuilder,
  BUILD_BPMN,
} from './lang-bpmn';
import { Action, StringAction, Flexible, getValueOfFlexible } from './utils';
import * as readline from 'readline';

// Tasks

class Script extends Activity {
  private script: Action;

  constructor(script: Action, id?: string) {
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

class ConsoleInput extends Activity {
  private question: string;
  private action: StringAction;
  private readLine;

  constructor(question: string, action: StringAction, id?: string) {
    super(id);
    this.question = question;
    this.action = action;
  }

  // FIXME allow to execute more taskConcoleInputs concurrently
  protected do(): Promise<void> {
    return new Promise((resolve) => {
      this.readLine = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      this.readLine.question(this.question, (input: string) => {
        this.action(input);
        this.readLine.close();
        resolve();
      });
    });
  }
}

// extend BPMN builder by new task types

declare module './lang-bpmn' {
  interface BpmnBuilder {
    /**
     * Adds a script task.
     * @param scr the script (function) executed if the task is running
     * @param id identifier of task
     */
    taskScript(scr: Action, id?: string): ActivityBuilder;

    /**
     * Add a log task. The log task logs the specified message to
     * console.
     * @param msg the message specified either as string or function returning
     * @param id identifier of task
     * string
     */
    taskLog(msg: Flexible<string>, id?: string): ActivityBuilder;

    /**
     * Adds a blocking console input task.
     * @param question question to be asked in console
     * @param action action that process the input string
     * @param id identifier of task
     */
    taskConsoleInput(
      question: string,
      action: (any) => void,
      id?: string
    ): ActivityBuilder;
  }
}

BpmnBuilder.prototype.taskScript = function (
  scr: Action,
  id?: string
): ActivityBuilder {
  BUILD_BPMN.addNextElement(new Script(scr, id));

  return new ActivityBuilder();
};

BpmnBuilder.prototype.taskLog = function (
  msg: Flexible<string>,
  id?: string
): ActivityBuilder {
  BUILD_BPMN.addNextElement(
    new Script(() => console.log(getValueOfFlexible(msg)), id)
  );

  return new ActivityBuilder();
};

BpmnBuilder.prototype.taskConsoleInput = function (
  question: string,
  action: StringAction,
  id?: string
): ActivityBuilder {
  BUILD_BPMN.addNextElement(new ConsoleInput(question, action, id));

  return new ActivityBuilder();
};

// TODO add tasks: http call, user, ...
