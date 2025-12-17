import { templateRepository } from '@/repositories';

export interface DefaultTemplate {
  name: string;
  description: string;
  dimensions: { label: string; values: string[] }[];
}

export const defaultTemplates: DefaultTemplate[] = [
  {
    name: 'plano-3600',
    description: 'Plano 3600 series tackle box - 6 rows x 4 columns',
    dimensions: [
      { label: 'row', values: ['1', '2', '3', '4', '5', '6'] },
      { label: 'col', values: ['1', '2', '3', '4'] },
    ],
  },
  {
    name: 'plano-3700',
    description: 'Plano 3700 series tackle box - 6 rows x 6 columns',
    dimensions: [
      { label: 'row', values: ['1', '2', '3', '4', '5', '6'] },
      { label: 'col', values: ['1', '2', '3', '4', '5', '6'] },
    ],
  },
  {
    name: 'drawer-grid-4x4',
    description: '4x4 grid drawer organizer',
    dimensions: [
      { label: 'row', values: ['1', '2', '3', '4'] },
      { label: 'col', values: ['1', '2', '3', '4'] },
    ],
  },
  {
    name: 'drawer-grid-3x3',
    description: '3x3 grid drawer organizer',
    dimensions: [
      { label: 'row', values: ['1', '2', '3'] },
      { label: 'col', values: ['1', '2', '3'] },
    ],
  },
  {
    name: 'shelf-bins-10',
    description: 'Shelf with 10 bins',
    dimensions: [{ label: 'bin', values: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'] }],
  },
];

export async function seedTemplates(): Promise<void> {
  console.log('Seeding dimension templates...');

  for (const template of defaultTemplates) {
    await templateRepository.upsertDefault(template);
  }

  console.log(`Seeded ${defaultTemplates.length} dimension templates`);
}
