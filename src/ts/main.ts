import { LoopTest, process } from './lang';
import './stdlib';

main();

function main() {
  let i = 0;

  // prettier-ignore
  const subProcessModel = process('SubProcess')
    ._T_log('REUSABLE SUB-PROCESS')
    .done()

  // prettier-ignore
  const processModel = process('ExampleProcess')
    ._T_log('A').id('A')
    ._T_log('B')

    // parallel branch with delay
    ._E_time(Date.now() + 2000)
    // normal looping
    ._T_script(() => {i++; console.log('C ' + i);}).loop(() => i < 5, LoopTest.BEFORE, 3)
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
        .subDone()
      ._E_end()
      .subDone()


// TODO BUG process terminates here and do not link subprocess with next parallel !!!


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

    ._T_log('L')
    .done()

  processModel.execute();
}
