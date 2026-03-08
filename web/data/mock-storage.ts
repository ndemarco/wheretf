import { StorageModule, DimensionTemplate } from "@/types/storage";

export const MOCK_TEMPLATES: DimensionTemplate[] = [
    {
        _id: "t1",
        name: "plano-4x6",
        description: "Plano box with 4 rows, 6 columns",
        dimensions: [
            { label: "row", values: ["1", "2", "3", "4"] },
            { label: "col", values: ["1", "2", "3", "4", "5", "6"] }
        ]
    },
    {
        _id: "t2",
        name: "smd-box-small",
        dimensions: [
            { label: "row", values: ["1", "2", "3", "4"] },
            { label: "col", values: ["1", "2", "3", "4", "5", "6"] }
        ]
    },
    {
        _id: "t3",
        name: "smd-box-large",
        dimensions: [
            { label: "row", values: ["1", "2", "3", "4", "5", "6", "7", "8"] },
            { label: "col", values: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"] }
        ]
    }
];

export const MOCK_MODULES: StorageModule[] = [
    {
        _id: "m1",
        name: "MUSE",
        description: "Red cabinet with Plano boxes",
        dimensions: [
            {
                label: "level",
                values: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"],
                templateMapping: {
                    "1": "plano-4x6",
                    "2": "plano-4x6",
                    "9": "plano-4x6",
                    "10": "plano-4x6",
                    "11": "plano-4x6"
                }
            }
        ]
    },
    {
        _id: "m2",
        name: "PRUSA",
        description: "White drawer unit with SMD component boxes",
        dimensions: [
            { label: "drawer", values: ["1", "2"] },
            {
                label: "box",
                values: ["yellow", "blue"],
                templateMapping: {
                    "yellow": "smd-box-small",
                    "blue": "smd-box-large"
                }
            }
        ]
    }
];
