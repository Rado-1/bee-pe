import { BUILD } from './lang-core';
import {
  Activity,
  BpmnBuilder,
  ActivityBuilder,
  BUILD_BPMN,
} from './lang-bpmn';
import { Action, Flexible, getValueOfFlexible } from './utils';

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

// extend BPMN builder by new task types

declare module './lang-bpmn' {
  interface BpmnBuilder {
    /**
     * Adds a script task to process.
     * @param scr the script (function) executed if the task is running
     * @param id identifier of task
     */
    _T_script(scr: Action, id?: string): ActivityBuilder;

    /**
     * Add a log task to process. The log task logs the specified message to
     * console.
     * @param msg the message specified either as string or function returning
     * @param id identifier of task
     * string
     */
    _T_log(msg: Flexible<string>, id?: string): ActivityBuilder;
  }
}

BpmnBuilder.prototype._T_script = function (
  scr: Action,
  id?: string
): ActivityBuilder {
  BUILD_BPMN.addNextElement(new Script(scr, id));

  return new ActivityBuilder();
};

BpmnBuilder.prototype._T_log = function (
  msg: Flexible<string>,
  id?: string
): ActivityBuilder {
  BUILD_BPMN.addNextElement(
    new Script(() => console.log(getValueOfFlexible(msg)), id)
  );

  return new ActivityBuilder();
};

// TODO add tasks: http call, user... user task will require TodoService
// TodoService will have submit(todo, output?)
