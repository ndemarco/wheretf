# Data Models

## ParameterKey

Registry of known parameter keys. AI checks this before creating new keys to avoid duplication.

```javascript
const parameterKeySchema = new Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  description: String,
  category: String,           // "dimension", "material", "electrical", etc.
  commonUnits: [String],      // ["mm", "in", "cm"] - hints for the AI
}, { timestamps: true });
```

**Examples:**
- `{ key: "length", category: "dimension", commonUnits: ["mm", "in", "cm"] }`
- `{ key: "voltage", category: "electrical", commonUnits: ["V", "mV"] }`
- `{ key: "material", category: "material" }`


## Unit

Registry of known units.

```javascript
const unitSchema = new Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  fullName: String,           // "millimeters"
  type: String,               // "length", "weight", "voltage", etc.
  siConversion: Number,       // optional, for future conversion features
}, { timestamps: true });
```

**Examples:**
- `{ name: "mm", fullName: "millimeters", type: "length", siConversion: 0.001 }`
- `{ name: "V", fullName: "volts", type: "voltage" }`


## DimensionTemplate

Reusable templates for common storage subdivisions (grids within drawers, Plano boxes, etc.).

```javascript
const dimensionTemplateSchema = new Schema({
  name: { type: String, required: true, unique: true },
  description: String,        // "Small SMD component box (yellow)"
  dimensions: [{
    label: String,            // "row", "col"
    values: [String],         // ["1","2","3","4"]
    _id: false
  }]
}, { timestamps: true });
```

**Examples:**
```javascript
{
  name: "plano-4x6",
  description: "Plano box with 4 rows, 6 columns",
  dimensions: [
    { label: "row", values: ["1","2","3","4"] },
    { label: "col", values: ["1","2","3","4","5","6"] }
  ]
}

{
  name: "smd-box-small",
  description: "Small SMD component box (4x6 grid)",
  dimensions: [
    { label: "row", values: ["1","2","3","4"] },
    { label: "col", values: ["1","2","3","4","5","6"] }
  ]
}

{
  name: "smd-box-large",
  description: "Large SMD component box (8x10 grid)",
  dimensions: [
    { label: "row", values: ["1","2","3","4","5","6","7","8"] },
    { label: "col", values: ["1","2","3","4","5","6","7","8","9","10"] }
  ]
}
```


## StorageModule

Describes valid path structure for a storage unit. Does not generate locations - just defines the schema for validation.

```javascript
const dimensionSchema = new Schema({
  label: String,              // "drawer", "box", "row", "col", "level", "bin"
  values: [String],           // ["1", "2"] or ["yellow", "blue", "green"]
  template: { type: Schema.Types.ObjectId, ref: 'DimensionTemplate' },
  templateMapping: {          // which value uses which template
    type: Map,
    of: String                // value -> template name
  },
  _id: false
});

const storageModuleSchema = new Schema({
  name: { type: String, required: true, unique: true },
  description: String,        // "Red cabinet with Plano boxes"
  dimensions: [dimensionSchema]
}, { timestamps: true });
```

**Examples:**

### FLUX (blue bin shelves)
```javascript
{
  name: "FLUX",
  description: "Blue bin shelf unit",
  dimensions: [
    { label: "level", values: ["1","2","3","4","5","6","7","8"] },
    { label: "bin", values: ["1","2","3","4","5","6"] }
  ]
}
// Paths: FLUX:level-1:bin-1 through FLUX:level-8:bin-6
```

### MUSE (red cabinet with Plano boxes)
```javascript
{
  name: "MUSE",
  description: "Red cabinet with Plano boxes",
  dimensions: [
    {
      label: "level",
      values: ["1","2","3","4","5","6","7","8","9","10","11"],
      templateMapping: {
        "1": "plano-4x6",
        "2": "plano-4x6",
        // ... 3-8 same
        "9": "plano-3x4",
        "10": "plano-3x4",
        "11": "plano-3x4"
      }
    }
  ]
}
// Paths: MUSE:level-1:row-1:col-1 through MUSE:level-11:row-3:col-4
```

### PRUSA (drawer unit with SMD boxes)
```javascript
{
  name: "PRUSA",
  description: "White drawer unit with SMD component boxes",
  dimensions: [
    { label: "drawer", values: ["1", "2"] },
    {
      label: "box",
      values: ["yellow", "blue", "green", "pink", "white"],
      templateMapping: {
        "yellow": "smd-box-small",
        "blue": "smd-box-large",
        "green": "smd-box-large",
        "pink": "smd-box-large",
        "white": "smd-box-large"
      }
    }
  ]
}
// Paths: PRUSA:drawer-1:box-yellow:row-1:col-1 through PRUSA:drawer-2:box-white:row-8:col-10
```


## Item

The actual inventory. One item per location.

```javascript
const parameterValueSchema = new Schema({
  key: { type: String, required: true, lowercase: true },
  value: { type: String, required: true },
  unit: { type: String, lowercase: true },
}, { _id: false });

const itemSchema = new Schema({
  name: { type: String, required: true },
  description: String,
  parameters: [parameterValueSchema],
  location: {
    type: String,             // "PRUSA:drawer-1:box-yellow:row-2:col-3"
    required: true,
    unique: true,
    index: true
  }
}, { timestamps: true });

// Text index for searching by name/description
itemSchema.index({ name: 'text', description: 'text' });

// Index for parameter-based queries
itemSchema.index({ 'parameters.key': 1, 'parameters.value': 1 });
```

**Examples:**
```javascript
{
  name: "10k ohm resistors",
  description: "1/4 watt, 5% tolerance, through-hole",
  parameters: [
    { key: "resistance", value: "10000", unit: "ohm" },
    { key: "power", value: "0.25", unit: "W" },
    { key: "tolerance", value: "5", unit: "%" },
    { key: "type", value: "through-hole" }
  ],
  location: "MUSE:level-3:row-2:col-5"
}

{
  name: "Pipe fitting union reducer",
  description: "Brass reducer, 1/2 inch to 1/4 inch",
  parameters: [
    { key: "thread_size", value: "0.5", unit: "in" },
    { key: "thread_size", value: "0.25", unit: "in" },
    { key: "material", value: "brass" },
    { key: "type", value: "union reducer" }
  ],
  location: "FLUX:level-3:bin-7"
}
```

Note: Parameter keys can repeat on an item (see thread_size example above).


## Query Patterns

### Find all items in a module
```javascript
Item.find({ location: /^FLUX:/ })
```

### Find items in a specific drawer
```javascript
Item.find({ location: /^PRUSA:drawer-1:/ })
```

### Find by parameter
```javascript
Item.find({ 'parameters.key': 'resistance', 'parameters.value': '10000' })
```

### Text search
```javascript
Item.find({ $text: { $search: "resistor 10k" } })
```

### Exact location
```javascript
Item.findOne({ location: "MUSE:level-3:row-2:col-5" })
```
