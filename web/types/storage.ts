export interface DimensionTemplate {
    _id: string;
    name: string;
    description?: string;
    dimensions: {
        label: string;
        values: string[];
    }[];
}

export interface StorageDimension {
    label: string; // "drawer", "box", "row", "col", "level", "bin"
    values: string[];
    template?: DimensionTemplate; // Populated template
    templateMapping?: Record<string, string>; // value -> template name ("1" -> "plano-4x6")
}

export interface StorageModule {
    _id: string;
    name: string;
    description?: string;
    dimensions: StorageDimension[];
    createdAt?: Date;
    updatedAt?: Date;
}

export interface ItemParameter {
    key: string;
    value: string;
    unit?: string;
}

export interface Item {
    _id: string;
    name: string;
    description?: string;
    parameters: ItemParameter[];
    location: string;
}

export interface StorageMetric {
    totalItems: number;
    capacity: number;
    utilizationPercentage: number;
}

export interface StorageModuleMetrics extends StorageMetric {
    moduleId: string;
    moduleName: string;
    levelMetrics?: Record<string, StorageMetric>; // e.g., "drawer-1": { ... }
}

export interface WorkshopMetrics extends StorageMetric {
    modules: StorageModuleMetrics[];
}
