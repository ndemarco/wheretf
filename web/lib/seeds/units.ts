import { unitRepository } from '@/repositories';

export interface DefaultUnit {
  name: string;
  fullName: string;
  type: string;
  siConversion?: number;
}

export const defaultUnits: DefaultUnit[] = [
  // Length - metric
  { name: 'mm', fullName: 'millimeters', type: 'length', siConversion: 0.001 },
  { name: 'cm', fullName: 'centimeters', type: 'length', siConversion: 0.01 },
  { name: 'm', fullName: 'meters', type: 'length', siConversion: 1 },

  // Length - imperial
  { name: 'in', fullName: 'inches', type: 'length', siConversion: 0.0254 },
  { name: 'ft', fullName: 'feet', type: 'length', siConversion: 0.3048 },

  // Electrical - voltage
  { name: 'v', fullName: 'volts', type: 'voltage', siConversion: 1 },
  { name: 'mv', fullName: 'millivolts', type: 'voltage', siConversion: 0.001 },
  { name: 'kv', fullName: 'kilovolts', type: 'voltage', siConversion: 1000 },

  // Electrical - current
  { name: 'a', fullName: 'amperes', type: 'current', siConversion: 1 },
  { name: 'ma', fullName: 'milliamperes', type: 'current', siConversion: 0.001 },
  { name: 'ua', fullName: 'microamperes', type: 'current', siConversion: 0.000001 },

  // Electrical - resistance
  { name: 'ohm', fullName: 'ohms', type: 'resistance', siConversion: 1 },
  { name: 'kohm', fullName: 'kilohms', type: 'resistance', siConversion: 1000 },
  { name: 'mohm', fullName: 'megohms', type: 'resistance', siConversion: 1000000 },

  // Electrical - capacitance
  { name: 'f', fullName: 'farads', type: 'capacitance', siConversion: 1 },
  { name: 'uf', fullName: 'microfarads', type: 'capacitance', siConversion: 0.000001 },
  { name: 'nf', fullName: 'nanofarads', type: 'capacitance', siConversion: 0.000000001 },
  { name: 'pf', fullName: 'picofarads', type: 'capacitance', siConversion: 0.000000000001 },

  // Electrical - inductance
  { name: 'h', fullName: 'henries', type: 'inductance', siConversion: 1 },
  { name: 'mh', fullName: 'millihenries', type: 'inductance', siConversion: 0.001 },
  { name: 'uh', fullName: 'microhenries', type: 'inductance', siConversion: 0.000001 },

  // Electrical - power
  { name: 'w', fullName: 'watts', type: 'power', siConversion: 1 },
  { name: 'mw', fullName: 'milliwatts', type: 'power', siConversion: 0.001 },
  { name: 'kw', fullName: 'kilowatts', type: 'power', siConversion: 1000 },

  // Electrical - frequency
  { name: 'hz', fullName: 'hertz', type: 'frequency', siConversion: 1 },
  { name: 'khz', fullName: 'kilohertz', type: 'frequency', siConversion: 1000 },
  { name: 'mhz', fullName: 'megahertz', type: 'frequency', siConversion: 1000000 },
  { name: 'ghz', fullName: 'gigahertz', type: 'frequency', siConversion: 1000000000 },

  // Weight - metric
  { name: 'g', fullName: 'grams', type: 'weight', siConversion: 0.001 },
  { name: 'kg', fullName: 'kilograms', type: 'weight', siConversion: 1 },
  { name: 'mg', fullName: 'milligrams', type: 'weight', siConversion: 0.000001 },

  // Weight - imperial
  { name: 'oz', fullName: 'ounces', type: 'weight', siConversion: 0.0283495 },
  { name: 'lb', fullName: 'pounds', type: 'weight', siConversion: 0.453592 },

  // Percentage
  { name: '%', fullName: 'percent', type: 'percentage' },

  // Thread - imperial
  { name: 'tpi', fullName: 'threads per inch', type: 'thread' },

  // Wire gauge
  { name: 'awg', fullName: 'American Wire Gauge', type: 'gauge' },
  { name: 'swg', fullName: 'Standard Wire Gauge', type: 'gauge' },

  // Count
  { name: 'pcs', fullName: 'pieces', type: 'count' },
  { name: 'pack', fullName: 'package', type: 'count' },
];

export async function seedUnits(): Promise<void> {
  console.log('Seeding units...');

  for (const unit of defaultUnits) {
    await unitRepository.findOrCreate(unit);
  }

  console.log(`Seeded ${defaultUnits.length} units`);
}
