// IDEA add process testing commands/module, see Camunda
// IDEA what about modeled breakpoints also for other types of models
// TODO test all BPMN constructs

import { bpmn } from '../src/engine/lang';

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
