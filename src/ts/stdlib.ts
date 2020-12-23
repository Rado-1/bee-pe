import { Activity, ActivityBuilder, ElementBuilder } from './lang';

// Tasks

class Script extends Activity {
  private script: () => void;

  constructor(script: () => void) {
    super();
    this.script = script;
  }

  protected async do(): Promise<void> {
    return await new Promise((resolve) => {
      this.script();
      resolve();
    });
  }
}

declare module './lang' {
  interface ElementBuilder {
    /**
     * Adds a script task to process.
     * @param scr the script (function) executed if the task is running
     */
    _T_script(scr: () => void): ActivityBuilder;

    /**
     * Add a log task to process. The log task logs the specified message to
     * console.
     * @param msg the message specified either as string or function returning
     * string
     */
    _T_log(msg: string | (() => string)): ActivityBuilder;
  }
}

ElementBuilder.prototype._T_script = function (
  scr: () => void
): ActivityBuilder {
  this.model.add(new Script(scr));

  return ActivityBuilder.getInstance(this.model);
};

ElementBuilder.prototype._T_log = function (
  msg: string | (() => string)
): ActivityBuilder {
  this.model.add(
    new Script(
      typeof msg === 'string'
        ? () => console.log(msg)
        : () => console.log(msg())
    )
  );

  return ActivityBuilder.getInstance(this.model);
};

// TODO add tasks: http call, user... user task will require TodoService
// TodoService will have submit(todo, output?)
