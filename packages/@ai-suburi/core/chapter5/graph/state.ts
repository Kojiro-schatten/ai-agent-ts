import { Annotation } from '@langchain/langgraph';

import type { GraphDataThread, SubTask } from '../models.js';

export const ProgrammerStateAnnotation = Annotation.Root({
  dataFile: Annotation<string>,
  dataInfo: Annotation<string>,
  userRequest: Annotation<string>,
  dataThreads: Annotation<GraphDataThread[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  sandboxId: Annotation<string>,
  nextNode: Annotation<string>,
  subTasks: Annotation<SubTask[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  subTaskThreads: Annotation<GraphDataThread[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
});

export type ProgrammerState = typeof ProgrammerStateAnnotation.State;

export const DataAnalysisStateAnnotation = Annotation.Root({
  dataFile: Annotation<string>,
  dataInfo: Annotation<string>,
  userGoal: Annotation<string>,
  userRequest: Annotation<string>,
  subTasks: Annotation<SubTask[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  dataThreads: Annotation<GraphDataThread[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  subTaskThreads: Annotation<GraphDataThread[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  report: Annotation<string>,
  userFeedback: Annotation<string>,
  userApproval: Annotation<boolean>,
  sandboxId: Annotation<string>,
  nextNode: Annotation<string>,
});

export type DataAnalysisState = typeof DataAnalysisStateAnnotation.State;
