import {
  bpmn,
  BpmnBuilder,
  BpmnModel,
  conditional,
  goals,
  LoopTest,
  ProcessModel,
  receiveSignal,
  stm,
  time,
  Todo,
} from './engine/lang';
import * as dayjs from 'dayjs';
import * as duration from 'dayjs/plugin/duration';
import { getSignalService, Signal } from './engine/signal.service';
dayjs.extend(duration);

main();

async function main() {
  let i = 0;
  let j = -1;
  let todo1, todo2: Todo;
  let str: string;

  // prettier-ignore
  const todoProcess = bpmn('TodoProcess')
    .taskLog('before')
    .taskTodo({
      issueAction: (todo: Todo) => todo1 = todo,
      submitAction: (todo: Todo) => console.log(todo.taskId + ' submitted')
      }, 'taskAAA')
    .taskTodo({
      issueAction: (todo: Todo) => todo2 = todo,
      submitAction: (todo: Todo) => console.log(todo.taskId + ' submitted')
      }, 'taskBBB') 
    .taskLog('after')
    .done();

  // prettier-ignore
  const throwSignalProcess = bpmn('ThrowSignalProcess')
    .eventThrowSignal({name: 'signalA'})
    .taskLog('signal thrown') 
    .done();

  // prettier-ignore
  const catchSignalProcess = bpmn('CatchSignalProcess')
    .eventCatchSignal({
      name: /signalA|signalB/i,
      receiveAction: (s:Signal) => str = s.name})
    .taskLog(() => `signal caught: ${str}`) 
    .done();

  function catchSignalProcessParam(index: number): BpmnModel {
    // prettier-ignore
    return bpmn('CatchSignalProcess')
      .eventCatchSignal({name: /signalA|signalB/i})
      .taskLog(`signal caught ${index}`) 
      .done();
  }

  // prettier-ignore
  const timerExample = bpmn('TimerProcess')
    .taskLog('timer example started - wait 3s')
    .gatewayParallel('par1')
      .eventTime(
        () => dayjs().add(3, 'seconds').valueOf(),
        dayjs.duration({seconds: 1}).asMilliseconds(),
        'timer1')
      .taskLog(() => `tick ${++i}`)
    .moveTo('par1')
      .eventTime(dayjs().add(8, 'seconds').valueOf())
      .taskScript(() => (timerExample as BpmnModel).findElement('timer1').terminate())
      .taskLog('finish')
    .done();

  // prettier-ignore
  const consoleInputProcess = bpmn('ConsoleInputProcess')
    .taskConsoleInput(
      'Enter value of i (number): ',
      (val: string) => i = Number(val),
      'Question1')
    .taskLog(() => 'i = ' + i)
    .moveTo('Question1')
    .taskConsoleInput(
      () => `Enter value of j, i = ${i} (number): `,
      (val: string) => j = Number(val))
    .taskLog(() => 'j = ' + j)
    .done();

  //  reusable static sub-process
  // prettier-ignore
  const subProcessModel = bpmn('SubProcess')
    .taskLog('REUSABLE SUB-PROCESS (XX)', 'XX')
    .done()

  // insert element to subProcess
  subProcessModel.getBuilder(BpmnBuilder, 'XX').taskLog('AFTER XX');

  // static parametric sub-process
  function parametricSubProcess(paramater1: string): ProcessModel {
    return bpmn('ParametricSubProcess').taskLog(paramater1).done();
  }

  // prettier-ignore
  const bpmnModel = bpmn('ExampleProcess')
    .taskLog('A', 'A')
    .taskLog('B')

    // parallel branch from A with delay
    .eventTime(() => dayjs().add(2, 'seconds').valueOf())
    .taskLog('XXX')
    // normal looping
    .taskScript(() => {i++; console.log('C ' + i);})
      .loop(() => i < 5, LoopTest.BEFORE, 3)
    // multi-instance
    .taskLog(() => 'Q ' + i).multi([5,7,9], (iter) => i = iter)
    .eventEnd()

    // parallel branch from A
    .moveTo('A')
    .taskLog('D')

    // call reusable sub-process
    .sub(subProcessModel)

    // call parametric sub-process with runtime parameter
    .taskScript(() => i=100)
    .sub(() => parametricSubProcess('RUNTIME PARAMETRIC REUSABLE SUB-PROCESS ' + i))

    // call parametric sub-process with modeling-time parameter
    .sub(parametricSubProcess('MODELING-TIME PARAMETRIC REUSABLE SUB-PROCESS ' + i))

    // embedded sub-sub-process
    .sub(
      bpmn()
      .taskLog('EMBEDDED SUB-PROCESS')
      .sub(
        bpmn()
        .taskLog('EMBEDDED SUB-SUB-PROCESS')
        .done()
        , '2nd_sub')
      .done()
      , '1st_sub')

    // event sub-process
    .subEvent(bpmn()
      .eventConditional(()=> i > 10)
      .taskLog('EVENT i>10')
      .eventEnd()
      .done()
    )
    .moveTo('1st_sub')

    // parallel fork/join
    .gatewayParallel('fork1')
      .taskLog('E')
      .gatewayParallel('join1')
    .moveTo('fork1')
      .taskLog('F')
      .connectTo('join1')
    .moveTo('fork1')
      .taskLog('G')
      .connectTo('join1')
    .moveTo('join1')

    .taskLog('H')

    // exclusive gateway with 3 branches
    .gatewayExclusive('ex1')
      .guard(() => Math.random() < 0.5)
      .taskLog('I')
      .eventEnd()
    .moveTo('ex1')
      .guard(() => true)
      .taskLog('J')
      .gatewayExclusive('ex1merge')
    .moveTo('ex1')
      .default()
      .taskLog('K')
    .moveTo('ex1merge')

    // boundary events
    .taskLog('L', 'L')
      .boundary()
        .eventConditional(() => true)
        .taskLog('X')
        .eventEnd()
    .moveTo('L').asActivity()
      .boundary(false)
        .eventConditional(() => i > 10)
        .taskLog('Y')
        .eventEnd()
    .moveTo('L')
    .taskLog('M')
    .done();

  // prettier-ignore
  const goalModel = goals('GoalProcess')
    .achieve('A')
      .subGoals()
        .achieve('B1')
          .pre(() => true)
          .deactivate(() => i > 0)
          .subPlans()
            .plan('P1')
              .process(bpmn().taskLog('Plan P1').done())
              .failErrors(['ErrorX', 'ErrorY'])
              .planDone()
          .subPlansDone()
        .achieve('B2')
          .subGoals()
            .achieve('C1')
              .subPlans()
                .plan('P2')
                  .pre(() => true)
                  .planDone()
                .plan('P3')
                  .planDone()
              .subPlansDone()
            .achieve('C2')
              .subPlans()
                .plan('P4')
                  .planDone()
              .subPlansDone()
          .subGoalsDone()
        .achieve('B3')
          .subPlans()
            .plan('P5')
              .planDone()
          .subPlansDone()
        .maintain('M1')
          .that(() => i < 0)
            .subPlans()
              .plan('P6')
               .planDone()
            .subPlansDone()
    .subGoalsDone()
    .done();

  // prettier-ignore
  const stmModel = stm()
    .initial('A')
    .state('B')
      .entry(() => i = 0)
      .exit(() => i = 20)
      .do(() => i++)
      .intTran()
        .trigger(conditional(() => true))
        .guard(() => i > 10)
        .action(subProcessModel.execute)
        .internDone()
      .intTran()
        .trigger(time(2000))
        .action(() => i = 0)
        .internDone()
      .stateDone()
    .state('C')
      .region()
        .initial('C11')
        .state('C12').stateDone()
        .state('C13').stateDone()
        .final('C14')
        .tran('C11', 'C12').tranDone()
        .tran('C12', 'C13').tranDone()
        .tran('C13', 'C14').tranDone()
        .shallowHistory()
        .regionDone()
      .region()
        .initial('C21')
        .final('C22')
        .tran('C21', 'C22').tranDone()
        .regionDone()
      .stateDone()
      .final('D')
    .tran('A', 'B')
      .tranDone()
    .tran('B', 'C')
      .trigger(time(2000))
      .trigger(conditional(() => i > 3))
      .action(() => i = -10)
      .tranDone()
    .tran('C', 'D')
      .trigger(receiveSignal())
      .tranDone()
    .done();

  timerExample.execute();

  // execute the same model multiple times
  // for (let i = 0; i < 10; i++) {
  //   catchSignalProcess.execute();
  // }

  // create and execute multiple different models
  // tested on 100000 - CPU consumption max 5%
  // for (let i = 0; i < 10; i++) {
  //   catchSignalProcessParam(i).execute();
  // }

  // new Signal({ name: 'signalB' }).send();
  // throwSignalProcess.execute();

  //consoleInputProcess.execute();

  // await todoModel.execute();
  // await todo1.submit();
  // await todo2.submit();

  //subProcessModel.execute();
  //bpmnModel.execute();
  //goalModel.execute();
  //stmModel.execute();
}
