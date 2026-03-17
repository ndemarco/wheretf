import type { Scenario } from '../types';
import { storageBasicsScenarios } from './storage-basics';
import { inventoryBasicsScenarios } from './inventory-basics';
import { edgeCaseScenarios } from './edge-cases';
import { routingScenarios } from './routing';
import { loadCapturedScenarios } from './captured';

export const allScenarios: Scenario[] = [
  ...storageBasicsScenarios,
  ...inventoryBasicsScenarios,
  ...edgeCaseScenarios,
  ...routingScenarios,
  ...loadCapturedScenarios(),
];
