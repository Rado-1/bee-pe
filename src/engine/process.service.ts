import { ProcessBuildStatus, ProcessModel } from './lang-core';
import { Singleton, uuid } from './utils';

// ========================================================================== //
// Data Types

export enum ProcessExecutionStatus {
  INACTIVE,
  RUNNING,
  PERSISTED,
  DONE,
}

export interface ProcessDescriptor {
  /** Id of process instance. */
  id: string;
  /** Execution status of process instance. */
  status: ProcessExecutionStatus;
}

export abstract class Process implements ProcessDescriptor {
  readonly id: string;
  status: ProcessExecutionStatus;
  /** Model od the process. */
  model: ProcessModel;

  constructor() {
    this.id = uuid();
    this.status = ProcessExecutionStatus.INACTIVE;
  }

  execute(): void {
    this.status = ProcessExecutionStatus.RUNNING;
    this.model.execute();
  }

  abstract persistContext(): void;

  abstract restoreContext(): void;

  /* IDEA what aboyt to define @persistent for property to be persisted? */

  /* IDEA call persist automatically from model when all tokens remain on
  asynchronous actions. => model should know about current execution, weather
  it runs or is stopped. Also model should know if process has stopped. Model
  can have a reference to Process instance and report its status there. */

  /* IDEA what really needs to be persisted is the data about stopped
  asynchronous events and tasks (todo, http call, ...). one model instance can
  have more such waitpoints for one element if executed several times (looping).
  The particular services for asynchronous processing should register them all.
  */

  /* IDEA register in services all events and todos which can stop execution
  and finish/commit business transaction. All such services should implement
  one interface for persisting and restoring these waiting points or
  data/descriptors about them. These services are called from persisted
  process instance for its elements. */

  /* IDEA shall we have PersistService, or just implement it in persisted
  element types or their services keeping data about asynchronous waiting points
  and in Process. Process should persist its context and trigger persisting of
  model instance. */

  /* IDEA services for asynchronous event/todo/... processing should provide
  reference to its process if exists. Process models can exist also outside
  Process instances but in this case they cannot be persisted. Only Process
  instances can be persisted. */
}

// ========================================================================== //
// Service

@Singleton
export class ProcessService {
  processes: Process[];

  // getProcess(id: string) {
  //   return this.processes.f;
  // }
}

/**
 * Returns an instance of ProcessService.
 */
export function getProcessService(): ProcessService {
  return new ProcessService();
}
