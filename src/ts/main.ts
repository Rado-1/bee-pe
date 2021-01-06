import { bpmn, goals, LoopTest } from './lang';

main();

function main() {
  let i = 0;

  // prettier-ignore
  const subProcessModel = bpmn('SubProcess')
    ._T_log('REUSABLE SUB-PROCESS').id('reusableLog')
    .done()

  // prettier-ignore
  const processModel = bpmn('ExampleProcess')
    ._T_log('A').id('A')
    ._T_log('B')

    // parallel branch with delay
    ._E_time(Date.now() + 2000)
    // normal looping
    ._T_script(() => {i++; console.log('C ' + i);})
      .loop(() => i < 5, LoopTest.BEFORE, 3)
    // multi-instance
    ._T_log(() => 'Q ' + i).multi([5,7,9], (iter) => i = iter)
    ._E_end()
    
    // parallel branch from A
    .moveTo('A')
    ._T_log('D')
    
    // call reusable (sub-)process
    .call(subProcessModel)
    
    // embedded sub-sub-process
    .sub().id('1st_sub')
      ._T_log('EMBEDDED SUB-PROCESS')
      .sub().id('2nd_sub')
        ._T_log('EMBEDDED SUB-SUB-PROCESS')
        ._E_end()
        .subDone()
      .subDone()

    // event sub-process
    .subEvent()
      ._E_conditional(()=> i > 10)
      ._T_log('EVENT i>10')
      ._E_end()
      .subDone()

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
    ._T_log('L').id('L')
      .boundary()
        ._E_conditional(() => true)
        ._T_log('X')
        ._E_end()
    .moveTo('L').asActivity()
      .boundary(false)
        ._E_conditional(() => i > 10)
        ._T_log('X')
        ._E_end()
    .moveTo('L')
    ._T_log('M')
    .done();

  // TODO check what commands are available at what level
  // prettier-ignore
  const goalModel = goals('GoalProcess')
    .achieve('A')
      .subGoals()
        .achieve('B1')
          .pre(() => true)
          .deactivate(() => i > 0)
          .plans()
            .plan('P1')
              .process(bpmn()
                ._T_log('Plan P1')
                .done())
              .planDone()
          .plansDone()
        .achieve('B2')
          .subGoals()
            .achieve('C1')
              .plans()
                .plan('P2')
                  .pre(() => true)
                  .planDone()
                .plan('P3')
                  .planDone()
              .plansDone()
            .achieve('C2')
              .plans()
                .plan('P4')
                  .planDone()
              .plansDone()
          .subDone()
        .achieve('B3')
          .plans()
            .plan('P5')
              .planDone()
          .plansDone()
        .maintain('M1')
          .that(() => i < 0)
          .plans()
            .plan('P6')
            .planDone()
          .plansDone()
          .goalDone()
    .done();

  processModel.execute();
}
