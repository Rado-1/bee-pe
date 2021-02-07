import {
  ActivityBuilder,
  bpmn,
  BpmnBuilder,
  conditional,
  goals,
  LoopTest,
  ProcessModel,
  receiveSignal,
  stm,
  time,
} from './engine/lang';

main();

function main() {
  let i = 0;

  // prettier-ignore
  const subProcessModel = bpmn('SubProcess')
    ._T_log('REUSABLE SUB-PROCESS', 'QQ1')
    .done()

  // insert element to subProcess
  subProcessModel.getBuilder(BpmnBuilder, 'QQ1')._T_log('AFTER QQ1');

  function parametricSubProcess(paramater1: string): ProcessModel {
    return bpmn('ParametricSubProcess')._T_log(paramater1).done();
  }

  // prettier-ignore
  const bpmnModel = bpmn('ExampleProcess')
    ._T_log('A', 'A')
    ._T_log('B')

    // parallel branch from A with delay
    ._E_time(Date.now() + 2000)
    ._T_log('XXX')
    // normal looping
    ._T_script(() => {i++; console.log('C ' + i);})
      .loop(() => i < 5, LoopTest.BEFORE, 3)
    // multi-instance
    ._T_log(() => 'Q ' + i).multi([5,7,9], (iter) => i = iter)
    ._E_end()

    // parallel branch from A
    .moveTo('A')
    ._T_log('D')

    // call reusable sub-process
    .sub(subProcessModel)

    // call parametric sub-process with runtime parameter
    ._T_script(() => i=100)
    .sub(() => parametricSubProcess('RUNTIME PARAMETRIC REUSABLE SUB-PROCESS ' + i))

    // call parametric sub-process with modeling-time parameter
    .sub(parametricSubProcess('MODELING-TIME PARAMETRIC REUSABLE SUB-PROCESS ' + i))

    // embedded sub-sub-process
    .sub(
      bpmn()
      ._T_log('EMBEDDED SUB-PROCESS')
      .sub(
        bpmn()
        ._T_log('EMBEDDED SUB-SUB-PROCESS')
        .done()
        , '2nd_sub')
      .done()
      , '1st_sub')

    // event sub-process
    .subEvent(bpmn()
      ._E_conditional(()=> i > 10)
      ._T_log('EVENT i>10')
      ._E_end()
      .done()
    )
    .moveTo('1st_sub')

    // parallel fork/join
    ._G_parallel('fork1')
      ._T_log('E')
      ._G_parallel('join1')
    .moveTo('fork1')
      ._T_log('F')
      .connectTo('join1')
    .moveTo('fork1')
      ._T_log('G')
      .connectTo('join1')
    .moveTo('join1')

    ._T_log('H')

    // exclusive gateway with 3 branches
    ._G_exclusive('ex1')
      .guard(() => Math.random() < 0.5)
      ._T_log('I')
      ._E_end()
    .moveTo('ex1')
      .guard(() => true)
      ._T_log('J')
      ._G_exclusive('ex1merge')
    .moveTo('ex1')
      .default()
      ._T_log('K')
    .moveTo('ex1merge')

    // boundary events
    ._T_log('L', 'L')
      .boundary()
        ._E_conditional(() => true)
        ._T_log('X')
        ._E_end()
    .moveTo('L').asActivity()
      .boundary(false)
        ._E_conditional(() => i > 10)
        ._T_log('Y')
        ._E_end()
    .moveTo('L')
    ._T_log('M')
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
              .process(bpmn()._T_log('Plan P1').done())
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

  //bpmnModel.execute();
  //goalModel.execute();
  stmModel.execute();
}
