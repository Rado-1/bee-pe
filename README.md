# bee.**pe**

<table>
<tr>
<td> <img src="icon.png" width="128"> </td>
<td>

Experimental business process engine in TypeScript.

</tr>
</table>

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

:exclamation: :exclamation: :exclamation: **WARNING: This is still in the
experimental phase, not intended to be used yet.**

## Features

- **fluent API** for process models providing natural way of specification
  business processes and workflows
- support for **BPMN** and **GO-BPMN** (goal-oriented process modeling); later
  also: simplified workflows, CMMN, DMN, and state machines
- fully **executable models** with robust operational semantics
- **extensible** in the way that users are able to modify/extend existing
  modeling constructs and executional semantics or create own process languages
- TypeScript language
- integrated to [**Nest**](https://nestjs.com/) server-side application
  development framework

## To-do

### Now

- [ ] create the generic modeling language core
- [ ] create the language for BPMN - be inspired by Camunda; think about
      improvements

### Later

- [ ] create language for goals - inspired by LSPS GO-BPMN and BDI modeling in
      AML
- [ ] create stdlib tasks - be inspired by BPMN task types and LSPS stdlib tasks
      types

  _Note: If tasks use services specify their interface and mockup/simplified
  implementation._

- [ ] :question: create language for simplified workflow modeling
- engine services
  - [ ] model service to register and access process models
  - [ ] process service to register and access process instances
  - [ ] todo service for asynchronous tasks
  - [ ] timer service (can use todo service for time events)
  - [ ] :question: data change notification service (can use todo service for
        time events) - maybe can be replaced by native TS/JS
        notification/reactive framework
  - ...
- [ ] management tools; angular UI, CL
- [ ] RESTful API for engine and services
- [ ] support for Swagger
- [ ] application project generator CL tool
- [ ] (lowprio) YAML interchange format for model structure
