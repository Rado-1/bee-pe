// IDEA think about usage of node.js Events;
// is publish-subscribe mechanism accepted? probably yes
// but can also regexp matching be used?

import {
  Action,
  Condition,
  Flexible,
  getValueOfFlexible,
  Singleton,
} from './utils';

// ========================================================================== //
// Data Types

/**
 * Properties of [[Signal]] used for its instantiation.
 */
export interface SignalProperties {
  /** Topic of signal. Topic represent a "communication channel" of which usage
   * and structuring is application specific. You can also use structured
   * path-names, such as 'moduleXY#errors'. */
  topic?: Flexible<string>;
  /** Name of signal. You can use structured signal path-names, such as
   * 'ordering#order#create'.*/
  name: Flexible<string>;
  /** Data of signal. */
  data?: Flexible<any>;
  /** If true, the signal exists until it is consumed by receiver.
   * If false, the signal is removed when no receiver can consume it at
   * the sending time. */
  remainsUntilProcessed?: boolean;
}

/**
 * Signal. An asynchronous broadcasted event that is usually used for
 * inter-process communication.
 */
export class Signal implements SignalProperties {
  readonly topic: string;
  readonly name: string;
  readonly data: any;
  readonly remainsUntilProcessed: boolean;
  /** True if signal has been processed by at least one receiver. */
  wasProcessed: boolean = false;

  constructor(properties: SignalProperties) {
    this.topic = getValueOfFlexible(properties.topic);
    this.name = getValueOfFlexible(properties.name);
    this.data = getValueOfFlexible(properties.data);
    this.remainsUntilProcessed = getValueOfFlexible(
      properties.remainsUntilProcessed ?? false
    );
  }

  send(): void {
    getSignalService().send(this);
  }

  matches(receiver: SignalReceiver): boolean {
    return (
      (receiver.topic ? receiver.topic.test(this.topic) : true) &&
      (receiver.name ? receiver.name.test(this.name) : true) &&
      (receiver.filter ? receiver.filter(this) : true)
    );
  }
}

/**
 * Properties of [[SignalReceive]] used for its instantiation.
 */
export interface SignalReceiverProperties {
  /** Regular expression matching possible signal topics. */
  topic?: RegExp;
  /** regular expression matching possible signal names. */
  name?: RegExp;
  /** Filtering condition of signal. */
  filter?: Condition<Signal>;
  /** Action triggered on receiving matched signal. */
  receiveAction?: Action<Signal>;
  /** If true, the signal receiver remains registered after it caught signal.
   * If false, the signal receiver is unregistered after caught signal.
   * Default is false. */
  isPersistent?: boolean;
}

/**
 * Signal receiver.
 */
export class SignalReceiver implements SignalReceiverProperties {
  readonly topic: RegExp;
  readonly name: RegExp;
  readonly filter: Condition<Signal>;
  readonly receiveAction: Action<Signal>;
  readonly isPersistent?: boolean;

  constructor(properties: SignalReceiverProperties) {
    this.topic = properties.topic;
    this.name = properties.name;
    this.filter = properties.filter;
    this.receiveAction = properties.receiveAction;
    this.isPersistent = properties.isPersistent ?? false;
  }

  matches(signal: Signal) {}
}

// ========================================================================== //
// Service

/**
 * Register of signal receivers and matching of incoming signals.
 */
@Singleton
export class SignalService {
  /** Queue of unprocessed signals. */
  protected waitingSignals: Signal[] = [];
  /** Period of checking unprocessed signals in milliseconds. If <=0 waiting
   * signals are not being processed. */
  waitingSignalProcessingPeriod: number = 5000;
  /** Register of signal receivers. */
  protected signalReceivers: SignalReceiver[] = [];

  startProcessingWaitingSignals(period?: number) {
    if (period) {
      this.waitingSignalProcessingPeriod = period;
    }

    this.processWaitingSignals();
  }

  stopProcessingWaitingSignals() {
    this.waitingSignalProcessingPeriod = -1;
  }

  registerReceiver(receiver: SignalReceiver) {
    this.signalReceivers.push(receiver);
  }

  deleteReceiver(receiver: SignalReceiver) {
    this.signalReceivers.splice(this.signalReceivers.indexOf(receiver));
  }

  send(signal: Signal, isSignalNew = true) {
    // find matching receivers
    const matchingReceivers = this.signalReceivers.filter(
      (receiver: SignalReceiver) => signal.matches(receiver)
    );

    if (matchingReceivers.length) {
      // process all matching receivers
      matchingReceivers.forEach((receiver: SignalReceiver) => {
        if (receiver.receiveAction) {
          receiver.receiveAction(signal);
        }

        if (!receiver.isPersistent) {
          this.deleteReceiver(receiver);
        }
      });
    } else if (signal.remainsUntilProcessed && isSignalNew) {
      // put event for further processing
      this.waitingSignals.push(signal);
    }
  }

  protected processWaitingSignals() {
    if (this.waitingSignalProcessingPeriod > 0) {
      setTimeout(() => {
        this.waitingSignals.forEach((sig: Signal) => this.send(sig, false)),
          this.processWaitingSignals();
      }, this.waitingSignalProcessingPeriod);
    }
  }
}

/**
 * Returns an instance of SignalService.
 */
export function getSignalService(): SignalService {
  return new SignalService();
}
