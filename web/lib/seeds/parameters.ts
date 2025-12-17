import { parameterKeyRepository } from '@/repositories';

export interface DefaultParameterKey {
  key: string;
  description: string;
  category: string;
  commonUnits: string[];
}

export const defaultParameterKeys: DefaultParameterKey[] = [
  // Dimensions
  {
    key: 'length',
    description: 'Length measurement',
    category: 'dimension',
    commonUnits: ['mm', 'cm', 'in', 'm'],
  },
  {
    key: 'width',
    description: 'Width measurement',
    category: 'dimension',
    commonUnits: ['mm', 'cm', 'in', 'm'],
  },
  {
    key: 'height',
    description: 'Height measurement',
    category: 'dimension',
    commonUnits: ['mm', 'cm', 'in', 'm'],
  },
  {
    key: 'diameter',
    description: 'Diameter measurement',
    category: 'dimension',
    commonUnits: ['mm', 'cm', 'in'],
  },
  {
    key: 'thread_size',
    description: 'Thread size for fasteners and fittings',
    category: 'dimension',
    commonUnits: ['mm', 'in'],
  },
  {
    key: 'pitch',
    description: 'Thread pitch',
    category: 'dimension',
    commonUnits: ['mm', 'tpi'],
  },
  {
    key: 'gauge',
    description: 'Wire or sheet gauge',
    category: 'dimension',
    commonUnits: ['awg', 'swg'],
  },

  // Electrical
  {
    key: 'voltage',
    description: 'Voltage rating',
    category: 'electrical',
    commonUnits: ['V', 'mV', 'kV'],
  },
  {
    key: 'current',
    description: 'Current rating',
    category: 'electrical',
    commonUnits: ['A', 'mA', 'uA'],
  },
  {
    key: 'resistance',
    description: 'Electrical resistance',
    category: 'electrical',
    commonUnits: ['ohm', 'kohm', 'Mohm'],
  },
  {
    key: 'capacitance',
    description: 'Electrical capacitance',
    category: 'electrical',
    commonUnits: ['F', 'uF', 'nF', 'pF'],
  },
  {
    key: 'inductance',
    description: 'Electrical inductance',
    category: 'electrical',
    commonUnits: ['H', 'mH', 'uH'],
  },
  {
    key: 'power',
    description: 'Power rating',
    category: 'electrical',
    commonUnits: ['W', 'mW', 'kW'],
  },
  {
    key: 'frequency',
    description: 'Frequency',
    category: 'electrical',
    commonUnits: ['Hz', 'kHz', 'MHz', 'GHz'],
  },
  {
    key: 'tolerance',
    description: 'Tolerance percentage',
    category: 'electrical',
    commonUnits: ['%'],
  },

  // Materials
  {
    key: 'material',
    description: 'Primary material composition',
    category: 'material',
    commonUnits: [],
  },
  {
    key: 'color',
    description: 'Color or finish',
    category: 'material',
    commonUnits: [],
  },
  {
    key: 'finish',
    description: 'Surface finish (zinc, chrome, etc.)',
    category: 'material',
    commonUnits: [],
  },

  // Types/Categories
  {
    key: 'type',
    description: 'Item type or category',
    category: 'type',
    commonUnits: [],
  },
  {
    key: 'head_type',
    description: 'Fastener head type (pan, flat, hex, etc.)',
    category: 'type',
    commonUnits: [],
  },
  {
    key: 'drive_type',
    description: 'Fastener drive type (phillips, torx, hex, etc.)',
    category: 'type',
    commonUnits: [],
  },
  {
    key: 'package',
    description: 'Component package type (SMD, through-hole, etc.)',
    category: 'type',
    commonUnits: [],
  },

  // Weight
  {
    key: 'weight',
    description: 'Weight measurement',
    category: 'weight',
    commonUnits: ['g', 'kg', 'oz', 'lb'],
  },

  // Quantity
  {
    key: 'quantity',
    description: 'Number of items',
    category: 'quantity',
    commonUnits: ['pcs', 'pack'],
  },
];

export async function seedParameterKeys(): Promise<void> {
  console.log('Seeding parameter keys...');

  for (const param of defaultParameterKeys) {
    await parameterKeyRepository.findOrCreate(param);
  }

  console.log(`Seeded ${defaultParameterKeys.length} parameter keys`);
}
