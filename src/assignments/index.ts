import type { ComponentType } from 'react';
import { ResponsivePseudoScatterPlot } from './week-01/ResponsivePseudoScatterPlot';
import { LoadingAndSummarizingData } from './week-02/DatasetStats.tsx';
import { ElectricityGeneration } from './week-03/ElectricityGeneration';

import { ElectricityGenerationTimeline } from './week-04/ElectricityGeneration';

export interface Assignment {
  id: string;
  name: string;
  component: ComponentType;
}

export const assignments: Assignment[] = [
  {
    id: '1',
    name: 'Week 1',
    component: ResponsivePseudoScatterPlot,
  },
  {
    id: '2',
    name: 'Week 2',
    component: LoadingAndSummarizingData,
  },
  {
    id: '3',
    name: 'Week 3',
    component: ElectricityGeneration,
  },
  { id: '4', name: 'Week 4', component: ElectricityGenerationTimeline },
];

export const assignmentsMap = new Map(assignments.map((ex) => [ex.id, ex]));

export const defaultAssignment = '1';
