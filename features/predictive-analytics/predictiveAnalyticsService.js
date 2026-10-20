/**
 * =========================================================================
 * PREDICTIVE ANALYTICS SERVICE LAYER
 * Module: features/predictive-analytics/predictiveAnalyticsService.js
 * 
 * Objective:
 * Abstracts Machine Learning prediction models and equipment telemetry data
 * for remaining useful life (RUL), failure risk tiering, maintenance windows,
 * and Explainable AI (XAI) feature importance drivers.
 * =========================================================================
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.PredictiveAnalyticsService = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    /**
     * Seed telemetry dataset representing real-world municipal & industrial equipment.
     * Ready out-of-the-box before external ML API hookup.
     */
    const BASE_MOCK_EQUIPMENT = [
        {
            id: "EQ-8801",
            propertyNo: "PR-2022-0881",
            name: "Kubota B2420 4WD Agricultural Tractor",
            category: "Heavy Agricultural",
            location: "Municipal Agriculture Field Station",
            operator: "C. Mendoza (Agri Dept)",
            dateAcquired: "2021-04-12",
            purchaseCost: 685000,
            operatingHours: 4820,
            cycleCount: 1420,
            currentWearLevel: 84, // percentage (0-100)
            healthScore: 16,      // 100 - wearLevel
            predictedFailureDays: 18,
            predictedFailureDate: "2026-11-07",
            maintenanceWindow: "Oct 24 - Nov 02, 2026",
            riskTier: "Critical", // 'Critical' (<= 30d), 'Watchlist' (31-90d), 'Normal' (> 90d)
            isMaintenanceScheduled: false,
            estimatedOverhaulCost: 32000,
            unplannedFailureCost: 185000,
            costAvoidance: 153000,
            telemetry: {
                vibrationRms: 4.82,       // mm/s (warning threshold > 3.5)
                vibrationStatus: "Anomaly",
                operatingTemp: 98.4,      // Celsius (warning > 85)
                tempStatus: "High",
                acousticDecibels: 86.2,   // dB
                lubricantQualityIndex: 28, // 0-100 (healthy > 70)
                dutyLoadFactor: 0.88      // 88% continuous peak load
            },
            featureImportance: [
                { feature: "Gearbox Vibration Anomaly", importance: 42, direction: "negative", value: "4.82 mm/s", baseline: "1.80 mm/s" },
                { feature: "Transmission Thermal Stress", importance: 28, direction: "negative", value: "98.4 °C", baseline: "75.0 °C" },
                { feature: "Lubricant Viscosity Breakdown", importance: 18, direction: "negative", value: "28 / 100", baseline: "85 / 100" },
                { feature: "Heavy Soil Duty Fatigue", importance: 12, direction: "negative", value: "88% Load", baseline: "60% Load" }
            ],
            recommendedAction: "Immediate gearbox bearing overhaul and oil flush before catastrophic gear seizure.",
            historicalDegradation: [96, 92, 87, 81, 74, 62, 50, 38, 26, 16], // % health over last 9 intervals + current
            rulForecast: [16, 11, 6, 2, 0] // projected health points into failure
        },
        {
            id: "EQ-5402",
            propertyNo: "PR-2023-0542",
            name: "Isuzu D-Max Municipal Patrol & Rescue 4x4",
            category: "Motor Vehicles",
            location: "MDRRMO Station 1",
            operator: "Officer R. Bautista",
            dateAcquired: "2022-01-15",
            purchaseCost: 1450000,
            operatingHours: 3450,
            cycleCount: 2890,
            currentWearLevel: 79,
            healthScore: 21,
            predictedFailureDays: 24,
            predictedFailureDate: "2026-11-13",
            maintenanceWindow: "Oct 26 - Nov 05, 2026",
            riskTier: "Critical",
            isMaintenanceScheduled: false,
            estimatedOverhaulCost: 22000,
            unplannedFailureCost: 95000,
            costAvoidance: 73000,
            telemetry: {
                vibrationRms: 4.15,
                vibrationStatus: "Anomaly",
                operatingTemp: 114.0, // Rotor / caliper temp
                tempStatus: "High",
                acousticDecibels: 79.5,
                lubricantQualityIndex: 45,
                dutyLoadFactor: 0.82
            },
            featureImportance: [
                { feature: "Brake Caliper Thermal Binding", importance: 45, direction: "negative", value: "114.0 °C", baseline: "65.0 °C" },
                { feature: "Front Suspension Bushing Play", importance: 26, direction: "negative", value: "3.8 mm gap", baseline: "0.5 mm" },
                { feature: "Emergency High-Idle Cycles", importance: 19, direction: "negative", value: "2,890 cycles", baseline: "1,200 cycles" },
                { feature: "Rough Terrain Exposure", importance: 10, direction: "negative", value: "High Salt/Dust", baseline: "Paved" }
            ],
            recommendedAction: "Replace front brake caliper assembly and rebuild suspension control arm bushings.",
            historicalDegradation: [98, 95, 91, 85, 78, 68, 56, 44, 32, 21],
            rulForecast: [21, 14, 8, 3, 0]
        },
        {
            id: "EQ-3108",
            propertyNo: "PR-2020-0318",
            name: "Caterpillar 35kVA Diesel Standby Generator",
            category: "Power & Utilities",
            location: "Municipal Hall Central Basement",
            operator: "Engr. J. Santos",
            dateAcquired: "2020-06-18",
            purchaseCost: 920000,
            operatingHours: 1940,
            cycleCount: 620,
            currentWearLevel: 76,
            healthScore: 24,
            predictedFailureDays: 28,
            predictedFailureDate: "2026-11-17",
            maintenanceWindow: "Oct 28 - Nov 08, 2026",
            riskTier: "Critical",
            isMaintenanceScheduled: true, // One scheduled
            estimatedOverhaulCost: 28000,
            unplannedFailureCost: 140000,
            costAvoidance: 112000,
            telemetry: {
                vibrationRms: 3.92,
                vibrationStatus: "Anomaly",
                operatingTemp: 94.2,
                tempStatus: "Elevated",
                acousticDecibels: 92.0,
                lubricantQualityIndex: 38,
                dutyLoadFactor: 0.92
            },
            featureImportance: [
                { feature: "Cooling Jacket Pressure Drop", importance: 39, direction: "negative", value: "-18% PSI", baseline: "Nominal" },
                { feature: "Alternator Bearing Wear Harmonic", importance: 33, direction: "negative", value: "3.92 mm/s", baseline: "1.40 mm/s" },
                { feature: "Battery High Internal Resistance", importance: 16, direction: "negative", value: "14.2 mΩ", baseline: "4.5 mΩ" },
                { feature: "Ambient Thermal Enclosure Load", importance: 12, direction: "negative", value: "38.5 °C amb", baseline: "28.0 °C" }
            ],
            recommendedAction: "Flush cooling system, replace water pump gasket and alternator drive belts.",
            historicalDegradation: [97, 94, 90, 84, 76, 67, 57, 46, 34, 24],
            rulForecast: [24, 17, 10, 4, 0]
        },
        {
            id: "EQ-7210",
            propertyNo: "PR-2022-0720",
            name: "Dell PowerEdge R740 Enterprise Server Rack",
            category: "IT & Infrastructure",
            location: "MIS Server Room (Admin Bldg)",
            operator: "MIS System Admin",
            dateAcquired: "2022-08-10",
            purchaseCost: 480000,
            operatingHours: 26400,
            cycleCount: 85,
            currentWearLevel: 68,
            healthScore: 32,
            predictedFailureDays: 54,
            predictedFailureDate: "2026-12-13",
            maintenanceWindow: "Nov 15 - Nov 25, 2026",
            riskTier: "Watchlist",
            isMaintenanceScheduled: false,
            estimatedOverhaulCost: 18000,
            unplannedFailureCost: 125000,
            costAvoidance: 107000,
            telemetry: {
                vibrationRms: 1.25,
                vibrationStatus: "Normal",
                operatingTemp: 84.6, // CPU core junction
                tempStatus: "Elevated",
                acousticDecibels: 64.0,
                lubricantQualityIndex: 72,
                dutyLoadFactor: 0.74
            },
            featureImportance: [
                { feature: "Blower Fan #3 RPM Degradation", importance: 44, direction: "negative", value: "-24% RPM", baseline: "8,500 RPM" },
                { feature: "Continuous 24/7 Thermal Cycling", importance: 31, direction: "negative", value: "84.6 °C", baseline: "62.0 °C" },
                { feature: "RAID Disk Sector Relocations", importance: 15, direction: "negative", value: "14 Sectors", baseline: "0 Sectors" },
                { feature: "Fine Dust Filter Restriction", importance: 10, direction: "negative", value: "70% Clogged", baseline: "Clean" }
            ],
            recommendedAction: "Replace hot-swap cooling fan tray and proactively replace RAID Disk 3 before degradation.",
            historicalDegradation: [99, 97, 94, 90, 84, 76, 67, 56, 44, 32],
            rulForecast: [32, 25, 18, 11, 4, 0]
        },
        {
            id: "EQ-4319",
            propertyNo: "PR-2021-0439",
            name: "Komatsu WA100-8 Compact Wheel Loader",
            category: "Heavy Construction",
            location: "Motorpool & Heavy Works Yard",
            operator: "B. Navarro (Engg Office)",
            dateAcquired: "2021-09-02",
            purchaseCost: 2850000,
            operatingHours: 5120,
            cycleCount: 3110,
            currentWearLevel: 64,
            healthScore: 36,
            predictedFailureDays: 67,
            predictedFailureDate: "2026-12-26",
            maintenanceWindow: "Dec 01 - Dec 12, 2026",
            riskTier: "Watchlist",
            isMaintenanceScheduled: true,
            estimatedOverhaulCost: 45000,
            unplannedFailureCost: 210000,
            costAvoidance: 165000,
            telemetry: {
                vibrationRms: 3.10,
                vibrationStatus: "Normal",
                operatingTemp: 88.0,
                tempStatus: "Elevated",
                acousticDecibels: 88.0,
                lubricantQualityIndex: 52,
                dutyLoadFactor: 0.79
            },
            featureImportance: [
                { feature: "Hydraulic Boom Cylinder Seal Micro-Leak", importance: 41, direction: "negative", value: "185 Bar (Req 210)", baseline: "210 Bar" },
                { feature: "High-Tonnage Aggregate Duty Factor", importance: 29, direction: "negative", value: "3,110 Cycles", baseline: "1,500 Cycles" },
                { feature: "Hydraulic Fluid Thermal Shear", importance: 20, direction: "negative", value: "ISO 21/18", baseline: "ISO 16/13" },
                { feature: "Bucket Hinge Pin Play", importance: 10, direction: "negative", value: "4.2 mm", baseline: "1.0 mm" }
            ],
            recommendedAction: "Reseal hydraulic tilt cylinder and replace primary return hydraulic filter cartridge.",
            historicalDegradation: [98, 95, 91, 86, 79, 71, 62, 53, 44, 36],
            rulForecast: [36, 29, 22, 14, 7, 0]
        },
        {
            id: "EQ-9042",
            propertyNo: "PR-2023-0902",
            name: "Honda WT40X 4-inch Industrial Trash Pump",
            category: "Disaster & Emergency",
            location: "MDRRMO Flood Control Depot",
            operator: "Rescue Unit Beta",
            dateAcquired: "2023-03-14",
            purchaseCost: 165000,
            operatingHours: 780,
            cycleCount: 240,
            currentWearLevel: 58,
            healthScore: 42,
            predictedFailureDays: 82,
            predictedFailureDate: "2027-01-10",
            maintenanceWindow: "Dec 15 - Dec 30, 2026",
            riskTier: "Watchlist",
            isMaintenanceScheduled: false,
            estimatedOverhaulCost: 9500,
            unplannedFailureCost: 48000,
            costAvoidance: 38500,
            telemetry: {
                vibrationRms: 2.75,
                vibrationStatus: "Normal",
                operatingTemp: 74.0,
                tempStatus: "Normal",
                acousticDecibels: 84.0,
                lubricantQualityIndex: 64,
                dutyLoadFactor: 0.71
            },
            featureImportance: [
                { feature: "Impeller Sand & Silt Abrasion", importance: 52, direction: "negative", value: "2.4 mm erosion", baseline: "0.2 mm" },
                { feature: "Silicon Carbide Mechanical Seal Wear", importance: 25, direction: "negative", value: "Seep Detected", baseline: "Dry" },
                { feature: "Flood Mud Cavitation Cycles", importance: 13, direction: "negative", value: "240 ops", baseline: "100 ops" },
                { feature: "Humid Storage Corrosion", importance: 10, direction: "negative", value: "Surface scale", baseline: "Passivated" }
            ],
            recommendedAction: "Replace pump volute wear plate and re-gap conical impeller clearances.",
            historicalDegradation: [99, 97, 93, 89, 83, 76, 68, 59, 50, 42],
            rulForecast: [42, 34, 26, 17, 8, 0]
        },
        {
            id: "EQ-1120",
            propertyNo: "PR-2024-0112",
            name: "Lenovo ThinkStation P360 CAD/GIS Workstation",
            category: "IT & Infrastructure",
            location: "Municipal Planning & Dev Office (MPDO)",
            operator: "Engr. M. Flores",
            dateAcquired: "2024-02-18",
            purchaseCost: 125000,
            operatingHours: 3200,
            cycleCount: 410,
            currentWearLevel: 36,
            healthScore: 64,
            predictedFailureDays: 210,
            predictedFailureDate: "2027-05-18",
            maintenanceWindow: "Q2 2027 Regular Cycle",
            riskTier: "Normal",
            isMaintenanceScheduled: true,
            estimatedOverhaulCost: 4500,
            unplannedFailureCost: 35000,
            costAvoidance: 30500,
            telemetry: {
                vibrationRms: 0.45,
                vibrationStatus: "Optimal",
                operatingTemp: 62.1,
                tempStatus: "Normal",
                acousticDecibels: 38.0,
                lubricantQualityIndex: 90,
                dutyLoadFactor: 0.52
            },
            featureImportance: [
                { feature: "GPU Render Thermal Cycles", importance: 38, direction: "negative", value: "62.1 °C avg", baseline: "55.0 °C" },
                { feature: "Thermal Paste Degradation", importance: 32, direction: "negative", value: "24 mos age", baseline: "New" },
                { feature: "NVMe Write Endurance", importance: 20, direction: "negative", value: "92% TBW left", baseline: "100%" },
                { feature: "Dust Ingress Index", importance: 10, direction: "negative", value: "Low", baseline: "None" }
            ],
            recommendedAction: "Scheduled biannual compressed air dusting and OS driver firmware updates.",
            historicalDegradation: [100, 99, 97, 94, 90, 85, 80, 75, 69, 64],
            rulForecast: [64, 58, 52, 45, 38, 30, 22, 14, 5, 0]
        },
        {
            id: "EQ-6623",
            propertyNo: "PR-2024-0662",
            name: "Stihl MS 382 Heavy Duty Forestry Chainsaw",
            category: "Municipal Maintenance",
            location: "General Services Office (GSO) Depot",
            operator: "Tree Trimming Team",
            dateAcquired: "2024-05-09",
            purchaseCost: 42000,
            operatingHours: 410,
            cycleCount: 680,
            currentWearLevel: 31,
            healthScore: 69,
            predictedFailureDays: 280,
            predictedFailureDate: "2027-07-27",
            maintenanceWindow: "Q3 2027 Regular Cycle",
            riskTier: "Normal",
            isMaintenanceScheduled: false,
            estimatedOverhaulCost: 2800,
            unplannedFailureCost: 18000,
            costAvoidance: 15200,
            telemetry: {
                vibrationRms: 2.10,
                vibrationStatus: "Normal",
                operatingTemp: 68.0,
                tempStatus: "Normal",
                acousticDecibels: 98.0,
                lubricantQualityIndex: 82,
                dutyLoadFactor: 0.58
            },
            featureImportance: [
                { feature: "Guide Bar Rail Wear", importance: 40, direction: "negative", value: "0.8 mm wear", baseline: "0.1 mm" },
                { feature: "Sprocket Rim Notch Depth", importance: 30, direction: "negative", value: "0.4 mm", baseline: "0.0 mm" },
                { feature: "Carburetor Diaphragm Flex", importance: 20, direction: "negative", value: "Good", baseline: "Pliant" },
                { feature: "Spark Plug Gap", importance: 10, direction: "negative", value: "0.55 mm", baseline: "0.50 mm" }
            ],
            recommendedAction: "Regular chain sharpening, sprocket dressing, and air filter rinse.",
            historicalDegradation: [100, 99, 98, 95, 91, 87, 83, 78, 73, 69],
            rulForecast: [69, 63, 57, 50, 42, 34, 25, 16, 7, 0]
        },
        {
            id: "EQ-2041",
            propertyNo: "PR-2024-0204",
            name: "Toyota Hilux Double Cab Municipal Utility Pickup",
            category: "Motor Vehicles",
            location: "GSO Motorpool Fleet",
            operator: "Pool Driver M. Ramos",
            dateAcquired: "2024-08-20",
            purchaseCost: 1380000,
            operatingHours: 1850,
            cycleCount: 1200,
            currentWearLevel: 25,
            healthScore: 75,
            predictedFailureDays: 340,
            predictedFailureDate: "2027-09-25",
            maintenanceWindow: "Q3 2027 Regular Cycle",
            riskTier: "Normal",
            isMaintenanceScheduled: true,
            estimatedOverhaulCost: 14000,
            unplannedFailureCost: 82000,
            costAvoidance: 68000,
            telemetry: {
                vibrationRms: 1.15,
                vibrationStatus: "Optimal",
                operatingTemp: 78.5,
                tempStatus: "Normal",
                acousticDecibels: 68.0,
                lubricantQualityIndex: 88,
                dutyLoadFactor: 0.48
            },
            featureImportance: [
                { feature: "Engine Oil Viscosity Index", importance: 42, direction: "negative", value: "5W-30 (88%)", baseline: "100%" },
                { feature: "Tire Tread Depth Uniformity", importance: 28, direction: "negative", value: "7.2 mm", baseline: "9.0 mm" },
                { feature: "Battery Cranking Health", importance: 18, direction: "negative", value: "96% CCA", baseline: "100%" },
                { feature: "Cabin Air Micro-Filter", importance: 12, direction: "negative", value: "Clean", baseline: "Clean" }
            ],
            recommendedAction: "Execute scheduled 10,000 km preventive maintenance and tire rotation.",
            historicalDegradation: [100, 100, 99, 97, 94, 91, 87, 83, 79, 75],
            rulForecast: [75, 70, 64, 58, 51, 44, 36, 28, 19, 10, 0]
        },
        {
            id: "EQ-1005",
            propertyNo: "PR-2025-0105",
            name: "Brother MFC-L8900CDW Laser Multi-Function Printer",
            category: "Office Equipment",
            location: "Office of the Municipal Mayor",
            operator: "Executive Secretary",
            dateAcquired: "2025-01-12",
            purchaseCost: 56000,
            operatingHours: 1400,
            cycleCount: 48000,
            currentWearLevel: 21,
            healthScore: 79,
            predictedFailureDays: 410,
            predictedFailureDate: "2027-12-04",
            maintenanceWindow: "Q4 2027 Regular Cycle",
            riskTier: "Normal",
            isMaintenanceScheduled: false,
            estimatedOverhaulCost: 3500,
            unplannedFailureCost: 24000,
            costAvoidance: 20500,
            telemetry: {
                vibrationRms: 0.32,
                vibrationStatus: "Optimal",
                operatingTemp: 52.0,
                tempStatus: "Normal",
                acousticDecibels: 42.0,
                lubricantQualityIndex: 94,
                dutyLoadFactor: 0.40
            },
            featureImportance: [
                { feature: "Fuser Roller Thermal Cycles", importance: 46, direction: "negative", value: "48,000 pages", baseline: "100,000 rated" },
                { feature: "Paper Feed Pick-up Roller Friction", importance: 27, direction: "negative", value: "Normal Grip", baseline: "New" },
                { feature: "Transfer Belt Tension", importance: 16, direction: "negative", value: "Nominal", baseline: "Nominal" },
                { feature: "Laser Scanner Mirror Clarity", importance: 11, direction: "negative", value: "Clear", baseline: "Clear" }
            ],
            recommendedAction: "Inspect roller assembly at 60,000 page milestone; routine exterior cleaning.",
            historicalDegradation: [100, 100, 99, 98, 96, 93, 90, 86, 82, 79],
            rulForecast: [79, 74, 69, 63, 56, 49, 41, 33, 24, 15, 6, 0]
        }
    ];

    // Local in-memory repository
    let equipmentRepository = JSON.parse(JSON.stringify(BASE_MOCK_EQUIPMENT));

    /**
     * Synthesizes ML telemetry metrics for real Masterlist items to achieve seamless integration.
     */
    function synthesizeItemTelemetry(item, index) {
        const cond = (item.condition || 'Serviceable').toUpperCase();
        const article = (item.article || item.name || 'Equipment').trim();
        const cost = parseFloat(item.totalCost) || (parseFloat(item.unitCost) * (parseInt(item.qty, 10) || 1)) || 45000;
        
        let ageYears = 2.0;
        if (item.date || item.dateAcquired) {
            try {
                const yearMatch = String(item.date || item.dateAcquired).match(/\b(19\d\d|20\d\d)\b/);
                if (yearMatch) {
                    ageYears = Math.max(0.2, new Date().getFullYear() - parseInt(yearMatch[1], 10));
                }
            } catch (e) {
                ageYears = 2.0;
            }
        }

        let wearLevel = 30;
        let riskTier = "Normal";
        let failureDays = 320;
        let isScheduled = (index % 3 === 0);

        if (cond === 'UNSERVICEABLE' || cond === 'FOR DISPOSAL' || cond === 'DISPOSED') {
            wearLevel = 95;
            riskTier = "Critical";
            failureDays = Math.max(2, 8 - (index % 6));
        } else if (cond.includes('REPAIR') || cond === 'NEEDS REPAIR') {
            wearLevel = 82;
            riskTier = "Critical";
            failureDays = 14 + (index % 12);
        } else if (ageYears >= 5) {
            wearLevel = Math.min(88, 65 + Math.round(ageYears * 3));
            riskTier = wearLevel > 75 ? "Critical" : "Watchlist";
            failureDays = riskTier === "Critical" ? 22 : 55;
        } else if (ageYears >= 3) {
            wearLevel = 55 + (index % 18);
            riskTier = "Watchlist";
            failureDays = 45 + (index % 40);
        } else {
            wearLevel = Math.min(45, 15 + Math.round(ageYears * 8));
            riskTier = "Normal";
            failureDays = 180 + (index % 180);
        }

        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + failureDays);
        const dateStr = targetDate.toISOString().split('T')[0];

        const overhaulCost = Math.round(cost * 0.15);
        const unplannedCost = Math.round(cost * 0.65);
        const costAvoidance = unplannedCost - overhaulCost;

        return {
            id: `INV-${item.id || (index + 100)}`,
            propertyNo: item.propertyNo || `PR-${item.id || index}`,
            name: `${article} - ${item.description || 'Municipal Asset'}`,
            category: item.account || "General Property",
            location: item.location || "Municipal Property",
            operator: item.personAccountable || "Designated Custodian",
            dateAcquired: item.date || item.dateAcquired || "2022-01-01",
            purchaseCost: cost,
            operatingHours: Math.round(ageYears * 1200),
            cycleCount: Math.round(ageYears * 650),
            currentWearLevel: wearLevel,
            healthScore: 100 - wearLevel,
            predictedFailureDays: failureDays,
            predictedFailureDate: dateStr,
            maintenanceWindow: `${dateStr} (Overhaul Horizon)`,
            riskTier: riskTier,
            isMaintenanceScheduled: isScheduled,
            estimatedOverhaulCost: overhaulCost,
            unplannedFailureCost: unplannedCost,
            costAvoidance: costAvoidance,
            telemetry: {
                vibrationRms: riskTier === 'Critical' ? (3.8 + (index % 15) * 0.1) : (1.1 + (index % 10) * 0.1),
                vibrationStatus: riskTier === 'Critical' ? 'Anomaly' : 'Normal',
                operatingTemp: riskTier === 'Critical' ? (88 + (index % 20)) : (60 + (index % 15)),
                tempStatus: riskTier === 'Critical' ? 'High' : 'Normal',
                acousticDecibels: riskTier === 'Critical' ? 86 : 58,
                lubricantQualityIndex: Math.max(15, 100 - wearLevel),
                dutyLoadFactor: 0.65
            },
            featureImportance: [
                { feature: "Operating Hours & Duty Cycle Stress", importance: 38, direction: "negative", value: `${Math.round(ageYears * 1200)} hrs`, baseline: "2,000 hrs" },
                { feature: "Thermal Accumulation Rate", importance: 30, direction: "negative", value: riskTier === 'Critical' ? "Elevated" : "Nominal", baseline: "Optimal" },
                { feature: "Vibration Harmonic Drift", importance: 20, direction: "negative", value: riskTier === 'Critical' ? "Exceeded" : "Stable", baseline: "Normal" },
                { feature: "Environmental Ambient Ingress", importance: 12, direction: "negative", value: "Field Exposed", baseline: "Clean" }
            ],
            recommendedAction: riskTier === 'Critical' 
                ? "Immediate diagnostic teardown and overhaul required before operational stoppage."
                : riskTier === 'Watchlist'
                ? "Plan replacement parts and schedule servicing within upcoming 60-day window."
                : "Routine operational monitoring; all telemetry parameters within nominal threshold.",
            historicalDegradation: [100, 96, 92, 86, 79, 71, 63, 54, 42, 100 - wearLevel],
            rulForecast: [100 - wearLevel, Math.max(0, 80 - wearLevel), Math.max(0, 60 - wearLevel), 0]
        };
    }

    const service = {
        /**
         * Returns all equipment telemetry records.
         */
        getAllEquipment: function () {
            return equipmentRepository;
        },

        /**
         * Synchronizes with real Masterlist data (e.g., from Supabase or window.inventoryData).
         */
        syncWithMasterlist: function (inventoryItems) {
            if (!Array.isArray(inventoryItems) || inventoryItems.length === 0) {
                return equipmentRepository;
            }

            // Keep base high-fidelity seeds, plus synthesize top masterlist records
            const synthesized = inventoryItems.slice(0, 25).map((item, idx) => synthesizeItemTelemetry(item, idx));
            equipmentRepository = [...BASE_MOCK_EQUIPMENT, ...synthesized];
            return equipmentRepository;
        },

        /**
         * Computes High-Level Metrics (KPI Cards):
         * 1. Fleet Health Index & Average Remaining Useful Life (RUL)
         * 2. High-Risk Equipment count (assets predicted to fail <= 30 days)
         * 3. Scheduled vs. Predicted Maintenance backlog
         * 4. Potential Cost Avoidance estimate
         */
        getFleetOverviewKPIs: function () {
            const total = equipmentRepository.length;
            if (total === 0) {
                return {
                    fleetHealthIndex: 0,
                    avgRulDays: 0,
                    avgRulMonths: 0,
                    highRiskCount: 0,
                    scheduledMaintenanceCount: 0,
                    predictedMaintenanceNeeded: 0,
                    maintenanceBacklogGap: 0,
                    totalCostAvoidance: 0,
                    totalFleetSize: 0
                };
            }

            const totalHealth = equipmentRepository.reduce((sum, item) => sum + item.healthScore, 0);
            const fleetHealthIndex = Math.round(totalHealth / total);

            const totalRulDays = equipmentRepository.reduce((sum, item) => sum + item.predictedFailureDays, 0);
            const avgRulDays = Math.round(totalRulDays / total);
            const avgRulMonths = (avgRulDays / 30.4).toFixed(1);

            // Assets predicted to fail within 30 days
            const highRiskItems = equipmentRepository.filter(item => item.predictedFailureDays <= 30 || item.riskTier === 'Critical');
            const highRiskCount = highRiskItems.length;

            // Scheduled vs Predicted Backlog
            const scheduledCount = equipmentRepository.filter(item => item.isMaintenanceScheduled).length;
            // Any item with Critical or Watchlist status needs predicted maintenance
            const predictedCount = equipmentRepository.filter(item => item.riskTier === 'Critical' || item.riskTier === 'Watchlist').length;
            const maintenanceBacklogGap = Math.max(0, predictedCount - scheduledCount);

            // Potential Cost Avoidance across fleet
            const totalCostAvoidance = equipmentRepository.reduce((sum, item) => sum + (item.costAvoidance || 0), 0);

            return {
                fleetHealthIndex: fleetHealthIndex, // e.g. 74%
                avgRulDays: avgRulDays,             // e.g. 184 days
                avgRulMonths: avgRulMonths,         // e.g. 6.1 months
                highRiskCount: highRiskCount,       // assets failing in <= 30 days
                scheduledMaintenanceCount: scheduledCount,
                predictedMaintenanceNeeded: predictedCount,
                maintenanceBacklogGap: maintenanceBacklogGap,
                totalCostAvoidance: totalCostAvoidance,
                totalFleetSize: total
            };
        },

        /**
         * Predictive Visualization 1: Asset Lifespan Degradation Curve
         * Displays historical degradation alongside predicted RUL curve with 80% & 95% confidence intervals.
         */
        getDegradationCurveData: function (equipmentId) {
            const target = equipmentRepository.find(e => e.id === equipmentId) || equipmentRepository[0];
            const currentHealth = target.healthScore;

            // Timeline labels: 6 months historical, Current, 6 months forward forecast
            const labels = [
                "M-6", "M-5", "M-4", "M-3", "M-2", "M-1",
                "Current (T0)",
                "T+1 Mo", "T+2 Mo", "T+3 Mo", "T+4 Mo", "T+5 Mo", "T+6 Mo"
            ];

            // Historical degradation curve (points 0-6)
            const historical = [
                Math.min(100, currentHealth + 48),
                Math.min(100, currentHealth + 38),
                Math.min(100, currentHealth + 29),
                Math.min(100, currentHealth + 21),
                Math.min(100, currentHealth + 13),
                Math.min(100, currentHealth + 6),
                currentHealth,
                null, null, null, null, null, null
            ];

            // Mean predicted RUL curve (points 6-12)
            const decayRate = Math.max(4, Math.round(currentHealth / 4));
            const p1 = Math.max(0, currentHealth - decayRate);
            const p2 = Math.max(0, p1 - decayRate);
            const p3 = Math.max(0, p2 - decayRate);
            const p4 = Math.max(0, p3 - decayRate);
            const p5 = Math.max(0, p4 - decayRate);
            const p6 = Math.max(0, p5 - decayRate);

            const predictedMean = [
                null, null, null, null, null, null,
                currentHealth,
                p1, p2, p3, p4, p5, p6
            ];

            // 80% Confidence Interval (+/- 6% widening to +/- 12%)
            const ci80Upper = [
                null, null, null, null, null, null,
                currentHealth,
                Math.min(100, p1 + 5),
                Math.min(100, p2 + 8),
                Math.min(100, p3 + 11),
                Math.min(100, p4 + 14),
                Math.min(100, p5 + 16),
                Math.min(100, p6 + 18)
            ];
            const ci80Lower = [
                null, null, null, null, null, null,
                currentHealth,
                Math.max(0, p1 - 5),
                Math.max(0, p2 - 8),
                Math.max(0, p3 - 11),
                Math.max(0, p4 - 14),
                Math.max(0, p5 - 16),
                Math.max(0, p6 - 18)
            ];

            // 95% Confidence Interval (+/- 9% widening to +/- 20%)
            const ci95Upper = [
                null, null, null, null, null, null,
                currentHealth,
                Math.min(100, p1 + 9),
                Math.min(100, p2 + 13),
                Math.min(100, p3 + 17),
                Math.min(100, p4 + 21),
                Math.min(100, p5 + 24),
                Math.min(100, p6 + 27)
            ];
            const ci95Lower = [
                null, null, null, null, null, null,
                currentHealth,
                Math.max(0, p1 - 9),
                Math.max(0, p2 - 13),
                Math.max(0, p3 - 17),
                Math.max(0, p4 - 21),
                Math.max(0, p5 - 24),
                Math.max(0, p6 - 27)
            ];

            // Critical Failure Threshold baseline (20% health score)
            const threshold = labels.map(() => 20);

            return {
                targetEquipment: target,
                labels: labels,
                historical: historical,
                predictedMean: predictedMean,
                ci80Upper: ci80Upper,
                ci80Lower: ci80Lower,
                ci95Upper: ci95Upper,
                ci95Lower: ci95Lower,
                failureThreshold: threshold
            };
        },

        /**
         * Predictive Visualization 2: Risk Distribution Breakdown
         * Categorized into Normal, Watchlist, and Critical tiers.
         */
        getRiskDistribution: function () {
            const counts = {
                Critical: 0,
                Watchlist: 0,
                Normal: 0
            };

            const categoryBreakdown = {};

            equipmentRepository.forEach(item => {
                const tier = item.riskTier || 'Normal';
                if (counts[tier] !== undefined) counts[tier]++;

                const cat = item.category || 'General';
                if (!categoryBreakdown[cat]) {
                    categoryBreakdown[cat] = { Critical: 0, Watchlist: 0, Normal: 0, total: 0 };
                }
                categoryBreakdown[cat][tier]++;
                categoryBreakdown[cat].total++;
            });

            return {
                counts: counts,
                percentages: {
                    Critical: Math.round((counts.Critical / equipmentRepository.length) * 100) || 0,
                    Watchlist: Math.round((counts.Watchlist / equipmentRepository.length) * 100) || 0,
                    Normal: Math.round((counts.Normal / equipmentRepository.length) * 100) || 0
                },
                categoryBreakdown: categoryBreakdown
            };
        },

        /**
         * Predictive Visualization 3: Time-to-Failure Timeline
         * Interactive Gantt / timeline structure of overhaul & end-of-life horizons across the fleet.
         */
        getTimeToFailureTimeline: function () {
            // Group equipment into 4 time buckets
            const buckets = {
                immediate: { label: "1 - 30 Days (Imminent Failure)", items: [] },
                watchlist: { label: "31 - 90 Days (Watchlist Horizon)", items: [] },
                midterm: { label: "91 - 180 Days (Overhaul Window)", items: [] },
                healthy: { label: "180+ Days (Standard Maintenance)", items: [] }
            };

            // Sort by earliest predicted failure days
            const sorted = [...equipmentRepository].sort((a, b) => a.predictedFailureDays - b.predictedFailureDays);

            sorted.forEach(item => {
                const entry = {
                    id: item.id,
                    propertyNo: item.propertyNo,
                    name: item.name,
                    category: item.category,
                    daysRemaining: item.predictedFailureDays,
                    failureDate: item.predictedFailureDate,
                    maintenanceWindow: item.maintenanceWindow,
                    riskTier: item.riskTier,
                    isScheduled: item.isMaintenanceScheduled,
                    action: item.recommendedAction
                };

                if (item.predictedFailureDays <= 30) {
                    buckets.immediate.items.push(entry);
                } else if (item.predictedFailureDays <= 90) {
                    buckets.watchlist.items.push(entry);
                } else if (item.predictedFailureDays <= 180) {
                    buckets.midterm.items.push(entry);
                } else {
                    buckets.healthy.items.push(entry);
                }
            });

            return buckets;
        },

        /**
         * Equipment Deep-Dive / Detail Table:
         * Searchable, filterable list with:
         * Equipment ID, Name, Category, Operating Hours/Cycles, Current Wear Level,
         * Predicted Failure Date, Recommended Action, and Risk Badge.
         */
        getEquipmentList: function (filters = {}) {
            let list = [...equipmentRepository];

            // Search Filter
            if (filters.search && filters.search.trim()) {
                const q = filters.search.toLowerCase().trim();
                list = list.filter(item => 
                    item.id.toLowerCase().includes(q) ||
                    item.propertyNo.toLowerCase().includes(q) ||
                    item.name.toLowerCase().includes(q) ||
                    item.category.toLowerCase().includes(q) ||
                    item.location.toLowerCase().includes(q)
                );
            }

            // Category Filter
            if (filters.category && filters.category !== 'ALL') {
                list = list.filter(item => item.category === filters.category);
            }

            // Risk Tier Filter
            if (filters.riskTier && filters.riskTier !== 'ALL') {
                list = list.filter(item => item.riskTier === filters.riskTier);
            }

            // Sorting
            const sortBy = filters.sortBy || 'predictedFailureDays';
            const sortOrder = filters.sortOrder === 'desc' ? -1 : 1;

            list.sort((a, b) => {
                let valA = a[sortBy];
                let valB = b[sortBy];
                if (typeof valA === 'string') valA = valA.toLowerCase();
                if (typeof valB === 'string') valB = valB.toLowerCase();
                if (valA < valB) return -1 * sortOrder;
                if (valA > valB) return 1 * sortOrder;
                return 0;
            });

            return list;
        },

        /**
         * Returns specific equipment record with full telemetry & feature importance.
         */
        getEquipmentDetails: function (equipmentId) {
            return equipmentRepository.find(e => e.id === equipmentId) || null;
        },

        /**
         * Returns list of unique categories available.
         */
        getCategories: function () {
            const set = new Set(equipmentRepository.map(e => e.category));
            return Array.from(set).filter(Boolean);
        }
    };

    return service;
}));
