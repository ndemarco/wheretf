import { storageTypeRepository } from '@/repositories';
import { CreateStorageTypeInput } from '@/repositories/storageTypeRepository';

export const defaultStorageTypes: CreateStorageTypeInput[] = [
  // Plano tackle box series
  {
    name: 'plano-3600',
    aliases: ['Plano 3600', '3600 tackle box', 'Plano ProLatch 3600'],
    description: 'Plano 3600 series tackle box with removable dividers. Fixed row dividers, adjustable column dividers.',
    defaultGrid: {
      dimensions: [
        { label: 'row', values: ['1', '2', '3', '4'] },
        { label: 'col', values: ['1', '2', '3', '4', '5', '6'] },
      ],
    },
    mergeConstraints: {
      allowedAxes: ['col'],
      reason: 'Plano 3600 has fixed row dividers - only columns can be merged within the same row',
    },
    notes: 'Common small parts organizer. 4 rows with 6 compartments each when fully divided. Dividers slide out to create larger column spans.',
    isSystem: true,
  },
  {
    name: 'plano-3700',
    aliases: ['Plano 3700', '3700 tackle box', 'Plano ProLatch 3700', 'Plano StowAway 3700'],
    description: 'Plano 3700 series tackle box with removable dividers. Fixed row dividers, adjustable column dividers.',
    defaultGrid: {
      dimensions: [
        { label: 'row', values: ['1', '2', '3', '4'] },
        { label: 'col', values: ['1', '2', '3', '4', '5', '6', '7'] },
      ],
    },
    mergeConstraints: {
      allowedAxes: ['col'],
      reason: 'Plano 3700 has fixed row dividers - only columns can be merged within the same row',
    },
    notes: 'Popular medium parts organizer. 4 rows with up to 7 compartments each. Rows have fixed heights: rows 1-3 are shallow, row 4 is deeper.',
    isSystem: true,
  },
  {
    name: 'plano-3750',
    aliases: ['Plano 3750', '3750 tackle box', 'Plano ProLatch 3750'],
    description: 'Plano 3750 series deep tackle box. Similar to 3700 but with deeper compartments.',
    defaultGrid: {
      dimensions: [
        { label: 'row', values: ['1', '2', '3'] },
        { label: 'col', values: ['1', '2', '3', '4', '5', '6'] },
      ],
    },
    mergeConstraints: {
      allowedAxes: ['col'],
      reason: 'Plano 3750 has fixed row dividers - only columns can be merged within the same row',
    },
    notes: 'Deep compartment organizer with 3 rows. Good for larger items like reels, tools, or bulkier components.',
    isSystem: true,
  },

  // Gridfinity system
  {
    name: 'gridfinity-1x1',
    aliases: ['Gridfinity 1x1', '1x1 bin', 'Gridfinity single'],
    description: 'Single Gridfinity bin (42mm x 42mm base).',
    defaultGrid: {
      dimensions: [
        { label: 'bin', values: ['1'] },
      ],
    },
    notes: 'Smallest Gridfinity unit. Can hold small components, screws, or single items.',
    isSystem: true,
  },
  {
    name: 'gridfinity-baseplate',
    aliases: ['Gridfinity base', 'Gridfinity baseplate', 'Gridfinity grid'],
    description: 'Gridfinity baseplate for modular bin arrangement. Bins can be any size and rearranged freely.',
    defaultGrid: {
      dimensions: [
        { label: 'row', values: ['1', '2', '3', '4', '5', '6', '7'] },
        { label: 'col', values: ['1', '2', '3', '4', '5', '6', '7'] },
      ],
    },
    mergeConstraints: {
      // Gridfinity allows free merging in any direction
      maxMergeSize: 49, // 7x7 max
      reason: 'Gridfinity bins can span any rectangular area',
    },
    notes: 'Standard 7x7 Gridfinity baseplate (42mm grid). Bins of any size can be placed anywhere. Merge cells to represent multi-unit bins.',
    isSystem: true,
  },

  // Stanley organizers
  {
    name: 'stanley-sortmaster',
    aliases: ['Stanley SortMaster', 'SortMaster', 'Stanley organizer'],
    description: 'Stanley SortMaster with removable compartment cups.',
    defaultGrid: {
      dimensions: [
        { label: 'row', values: ['1', '2', '3'] },
        { label: 'col', values: ['1', '2', '3', '4', '5', '6', '7', '8'] },
      ],
    },
    notes: 'Removable cups can be lifted out. 24 small cups standard configuration, but cups can be removed to create open space.',
    isSystem: true,
  },

  // Akro-Mils
  {
    name: 'akro-mils-64drawer',
    aliases: ['Akro-Mils 64 drawer', '64 drawer cabinet', 'Akro-Mils 10164'],
    description: 'Akro-Mils 64-drawer small parts cabinet.',
    defaultGrid: {
      dimensions: [
        { label: 'row', values: ['1', '2', '3', '4', '5', '6', '7', '8'] },
        { label: 'col', values: ['1', '2', '3', '4', '5', '6', '7', '8'] },
      ],
    },
    notes: '8x8 grid of small drawers. Each drawer is removable. Drawers cannot be merged - each is a fixed unit.',
    isSystem: true,
  },

  // Simple shelf/cabinet types
  {
    name: 'basic-shelf',
    aliases: ['shelf', 'bookshelf', 'shelving unit'],
    description: 'Basic shelf unit with fixed shelves.',
    defaultGrid: {
      dimensions: [
        { label: 'shelf', values: ['1', '2', '3', '4', '5'] },
      ],
    },
    notes: 'Simple vertical shelving. Adjust shelf count to match actual unit.',
    isSystem: true,
  },
  {
    name: 'basic-drawer-unit',
    aliases: ['drawer unit', 'drawer cabinet', 'chest of drawers'],
    description: 'Basic drawer unit.',
    defaultGrid: {
      dimensions: [
        { label: 'drawer', values: ['1', '2', '3', '4', '5', '6'] },
      ],
    },
    notes: 'Simple drawer stack. Adjust drawer count to match actual unit.',
    isSystem: true,
  },

  // Toolbox types
  {
    name: 'toolbox-top-tray',
    aliases: ['toolbox tray', 'cantilever tray'],
    description: 'Top tray of a cantilever toolbox.',
    defaultGrid: {
      dimensions: [
        { label: 'section', values: ['left', 'center', 'right'] },
      ],
    },
    notes: 'Standard 3-section cantilever tray. Sections may have additional dividers.',
    isSystem: true,
  },
];

export async function seedStorageTypes(): Promise<void> {
  console.log('Seeding storage types...');

  for (const storageType of defaultStorageTypes) {
    await storageTypeRepository.upsertDefault(storageType);
  }

  console.log(`Seeded ${defaultStorageTypes.length} storage types`);
}
