// IDEA add process testing commands/module, see Camunda
// IDEA what about modeled breakpoints also for other types of models
// TODO test all BPMN constructs

import { bpmn, BpmnModel } from '../src/engine/lang';

test('simple sequence model', () => {
  // prettier-ignore
  const simpleModel = bpmn()
    .taskLog('task1')
    .taskLog('task2')
    .done();

  expect(simpleModel.execute()).toBeUndefined();
});

test('breakpoint task', () => {
  // pettier-ignore
  const model = bpmn();
});

test('performance signal test 1', () => {
  // prettier-ignore
  const throwSignalProcess = bpmn('ThrowSignalProcess')
    .eventThrowSignal({name: 'signalAAA'})
    .done();

  // prettier-ignore
  const catchSignalProcess = bpmn('CatchSignalProcess')
    .eventCatchSignal({names: ['signalAAAX']})
    .done();

  // execute the same model multiple times
  for (let i = 0; i < 1000000; i++) {
    catchSignalProcess.execute();
  }

  expect(throwSignalProcess.execute()).toBeUndefined();
});

test('performance signal test 2', () => {
  // prettier-ignore
  const throwSignalProcess = bpmn('ThrowSignalProcess')
    .eventThrowSignal({name: 'signalAAA'})
    .done();

  function catchSignalProcessParam(index: number): BpmnModel {
    // prettier-ignore
    return bpmn('CatchSignalProcess')
      .eventCatchSignal({names: ['signalAAA']})
      .done();
  }

  // create and execute multiple different models
  for (let i = 0; i < 1000; i++) {
    catchSignalProcessParam(i).execute();
  }

  expect(throwSignalProcess.execute()).toBeUndefined();
});
