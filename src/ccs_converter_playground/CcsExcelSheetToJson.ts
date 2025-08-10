
import * as XLSX from 'xlsx';
import { calculateDistance } from './CcsDataUtils';

const CCS_CLUSTER_SA_SHEET_NAME = 'SA clusters';
const CCS_SINKS_A_50_SHEET_NAME = 'Ref A-P50';
const CCS_SINKS_B_50_SHEET_NAME = 'Ref B-P50';
const CCS_SINKS_B_10_SHEET_NAME = 'Ref B-P10';
const CCS_SINKS_B_90_SHEET_NAME = 'Ref B-P90';

const CCS_RYSTAD_EMISSIONS_SHEET_NAME = 'Archie Sources v2.1-Wei-Rystad';
const CCS_KAUST_EMISSIONS_SHEET_NAME = 'Archie 2.1 Sources-KAUST';
const CCS_XOM_EMISSIONS_SHEET_NAME = 'XOM_AL_Yanbu only';

export function prossingCCSClusterSAData(allFacilities: any, filePath: string, economic: boolean = false) {
    // Read the Excel file
    const workbook = XLSX.readFile(filePath);
    const clusterSheet = workbook.Sheets[CCS_CLUSTER_SA_SHEET_NAME];
    let jsonData: any[] = [];
    const clustersMap: Record<number, any> = {};
    if (clusterSheet) {
        jsonData = XLSX.utils.sheet_to_json(clusterSheet, { defval: "" });

        jsonData.forEach((facility) => {
            let clusterId = facility.Cluster;
            if (economic) {
                clusterId = facility.Cluster_economic;
            }
            if (!clustersMap[clusterId]) {
                clustersMap[clusterId] = {
                    type: "Feature",
                    properties: {
                        cluster_id: clusterId,
                        facilities: []
                    },
                };
            }

            const facilityFeature = allFacilities.features.find((feature: any) => feature.properties.unique_facility_name === facility['Unique Facility Name']);

            if (facilityFeature) {
                // console.log('Found facility with properties: ', facilityFeature.properties);
                if (facilityFeature.properties.facility_id) {
                    const facilityProperties = {
                        facility_id: facilityFeature.properties.facility_id,
                        unique_facility_name: facility['Unique Facility Name'],
                        sector_detail: facility['Sector Detail'],
                        assumed_process_capture: facility['Assumed Process Capture (MMtCO2)'],
                        co2_cost: facilityFeature.properties.co2_cost,
                        connected_sink: facility['Connected Sink']
                    };
                    clustersMap[clusterId].properties.facilities.push(facilityProperties);
                } else {
                    console.warn(`Facility ${facility['Unique Facility Name']} does not have a facility_id`);
                }
            } else {
                console.warn(`No facility found for ${facility['Unique Facility Name']}`);
            }
        });
    }

    console.log('find the cluster coordinates')
    const clusterValues = Object.values(clustersMap)
    const geoJSON = {
        type: "FeatureCollection",
        features: clusterValues.map((cluster) => {
            const facilities = cluster.properties.facilities;
            // Find facility with largest assumed process capture
            let maxCaptureFacility: any = null;
            let maxCaptureValue = 0;
            facilities.forEach((facility: any) => {
                if (facility.assumed_process_capture > maxCaptureValue) {
                    maxCaptureValue = facility.assumed_process_capture;
                    maxCaptureFacility = facility;
                }
            });

            // sum up the assumed_process_capture of all facilities
            const totalCapturedEmissions = facilities.reduce((sum: number, facility: any) => sum + facility.assumed_process_capture, 0);

            let maxDistance = 0;
            if (!maxCaptureFacility) {
                console.warn(`No maxCaptureFacility found for cluster ${cluster.properties.cluster_id}`);
                return null;
            }
            const maxCaptureFacilityFeature = allFacilities.features.find((feature: any) => feature.properties.facility_id === maxCaptureFacility.facility_id);
            // now let's find the distance between the max capture facility and the other facility
            facilities.forEach((facility: any) => {
                const facilityFeature = allFacilities.features.find((feature: any) => feature.properties.facility_id === facility.facility_id);
                if (!facilityFeature || !maxCaptureFacilityFeature.geometry) {
                    console.warn(`No geometry found for facility: ${facility.unique_facility_name}`);
                    return;
                }
                const distance = calculateDistance(maxCaptureFacilityFeature.geometry.coordinates, facilityFeature.geometry.coordinates);
                if (distance > maxDistance) {
                    maxDistance = distance;
                }
            });

            cluster.properties = {
                total_captured_emissions: totalCapturedEmissions,
                ...cluster.properties
            }
            if (maxCaptureFacilityFeature.geometry) {
                cluster.geometry = maxCaptureFacilityFeature.geometry;
            }
            else {
                console.warn(`No geometry found for max capture facility: ${maxCaptureFacilityFeature.properties.unique_facility_name}`);
            }
            return cluster;
        })
    }

    return geoJSON;
}

export function getSinkData(sourceType: string, item: any) {
    return {
        sourceType: sourceType,
        storage_capacity__mt: item['storage_capacity__mt'],
        co2_density: item['co2_density__kgm3'],
        sal_aq_porosity__prc: item['sal_aq_porosity__prc'],
        sal_aq_areal_closure__km2: item['sal_aq_areal_closure__km2'],
        sal_aq_pressure__psi: item['sal_aq_pressure__psi'],
        sal_aq_temperature__dgc: item['sal_aq_temperature__dgc'],
        saline_aquifer_storage_efficiency: item['saline_aquifer_storage_effic'],
    }
}


export function prossingCCSSinksSAData(filePath: string) {
    // Read the Excel file
    const workbook = XLSX.readFile(filePath);
    const sinkCommonSheet = workbook.Sheets[CCS_SINKS_A_50_SHEET_NAME];
    const sinkB10Sheet = workbook.Sheets[CCS_SINKS_B_10_SHEET_NAME];
    const sinkB50Sheet = workbook.Sheets[CCS_SINKS_B_50_SHEET_NAME];
    const sinkB90Sheet = workbook.Sheets[CCS_SINKS_B_90_SHEET_NAME];
    let geoJSON;
    if (sinkCommonSheet) {
        const a50_jsonData: any[] = XLSX.utils.sheet_to_json(sinkCommonSheet, { defval: "" });
        // Process the data
        const sourcesList: any[] = [];
        geoJSON = {
            type: "FeatureCollection",
            features: a50_jsonData.map((item, index) => {
                const sourceDetails = getSinkData('A_P50', item);
                return {
                    type: "Feature",
                    properties: {
                        id: index,
                        name: item['sal_aq_name'],
                        country: item['country_name'],
                        carbon_storage_type: item['carbon_storage_type'],
                        longitude: item['Longitude'],
                        latitude: item['Latitude'],
                        co2_phase_condition: item['co2_phase_condition'],
                        sal_aq_formation_dname: item['sal_aq_formation_dname'],
                        sal_aq_age_from_dname: item['sal_aq_age_from_dname'],
                        sal_aq_lithology_l3: item['sal_aq_lithology_l3'],
                        basin_name: item['basin_name'],
                        sources: [...sourcesList, sourceDetails]
                    },
                    geometry: {
                        type: "Point",
                        coordinates: [
                            item['Longitude'],
                            item['Latitude']
                        ]
                    }
                };
            })
        }
    };

    if (sinkB10Sheet && geoJSON) {
        const b10_jsonData: any[] = XLSX.utils.sheet_to_json(sinkB10Sheet, { defval: "" });
        // now we need to add the b50 data to the geoJSON, for the same item name, we need to add the b50 data to the sources
        geoJSON.features.forEach((feature) => {
            const item = b10_jsonData.find((item) => item['sal_aq_name'] === feature.properties.name);
            if (item && feature.properties.sources) {
                const sources: any = feature.properties.sources;
                sources.push(getSinkData('B_P10', item));
            }
        });
    }


    if (sinkB10Sheet && geoJSON) {
        const b50_jsonData: any[] = XLSX.utils.sheet_to_json(sinkB50Sheet, { defval: "" });
        // now we need to add the b50 data to the geoJSON, for the same item name, we need to add the b50 data to the sources
        geoJSON.features.forEach((feature) => {
            const item = b50_jsonData.find((item) => item['sal_aq_name'] === feature.properties.name);
            if (item && feature.properties.sources) {
                const sources: any = feature.properties.sources;
                sources.push(getSinkData('B_P50', item));
            }
        });
    }

    if (sinkB90Sheet && geoJSON) {
        const b90_jsonData: any[] = XLSX.utils.sheet_to_json(sinkB90Sheet, { defval: "" });
        // now we need to add the b50 data to the geoJSON, for the same item name, we need to add the b50 data to the sources
        geoJSON.features.forEach((feature) => {
            const item = b90_jsonData.find((item) => item['sal_aq_name'] === feature.properties.name);
            if (item && feature.properties.sources) {
                const sources: any = feature.properties.sources;
                sources.push(getSinkData('B_P90', item));
            }
        });
    }
    return geoJSON;
}

export function prossingRystadEmissionsData(filePath: string) {
    // Read the Excel file
    const workbook = XLSX.readFile(filePath);
    const emissionsSheet = workbook.Sheets[CCS_RYSTAD_EMISSIONS_SHEET_NAME];
    let geoJSON;

    if (emissionsSheet) {
        const jsonData: any[] = XLSX.utils.sheet_to_json(emissionsSheet, { defval: "" });
        geoJSON = {
            type: "FeatureCollection",
            features: jsonData.map((item, index) => {
                return {
                    type: "Feature",
                    properties: {
                        archie_id: item['Archie ID'],
                        facility_id: item['facility ID'],
                        sector_detail: item['Sector Detail'],
                        unique_facility_name: item['Unique Facility Name'],
                        latitude: item['Latitude'],
                        longitude: item['Longitude'],
                        co2_concentration: item['CO2 concentration (% mol)'],
                        process_emissions_unit_considered_for_co2_capture: item['Process emissions unit considered for CO2 capture (fraction)'],
                        total_emissions: item['Total Emissions (Mt CO2)'],
                        assumed_captured_emissions: item['Assumed captured emissions (MMtCO2)'],
                        carbon_footprint: item['Carbon footprint (tCO2e/t CO2 feedstock)'],
                        co2_cost: item['CO2 cost ($/t CO2)'],
                        dataSouce: "RYSTAD"
                    },
                    geometry: {
                        type: "Point",
                        coordinates: [
                            item['Longitude'],
                            item['Latitude']
                        ]
                    }
                };
            })
        }
    }

    return geoJSON;
}

export function prossingKaustEmissionsData(filePath: string) {
    // Read the Excel file
    const workbook = XLSX.readFile(filePath);
    const emissionsSheet = workbook.Sheets[CCS_KAUST_EMISSIONS_SHEET_NAME];
    let geoJSON;

    if (emissionsSheet) {
        const jsonData: any[] = XLSX.utils.sheet_to_json(emissionsSheet, { defval: "" });
        geoJSON = {
            type: "FeatureCollection",
            features: jsonData.map((item, index) => {
                return {
                    type: "Feature",
                    properties: {
                        archie_id: item['Archie ID'],
                        facility_id: item['facility ID'],
                        sector_detail: item['Sector Detail'],
                        unique_facility_name: item['Unique Facility Name'],
                        latitude: item['Latitude'],
                        longitude: item['Longitude'],
                        co2_concentration: item['CO2 concentration (% mol)'],
                        process_emissions_unit_considered_for_co2_capture: item['Process emissions unit considered for CO2 capture (fraction)'],
                        total_emissions: item['Total Emissions (Mt CO2)'],
                        assumed_captured_emissions: item['Assumed captured emissions (MMtCO2)'],
                        carbon_footprint: item['Carbon footprint (tCO2e/t CO2 feedstock)'],
                        co2_cost: item['CO2 cost ($/t CO2)'],
                        dataSouce: "KAUST"
                    },
                    geometry: {
                        type: "Point",
                        coordinates: [
                            item['Longitude'],
                            item['Latitude']
                        ]
                    }
                };
            })
        }
    }

    return geoJSON;
}

export function prossingXomEmissionsData(filePath: string) {
    // Read the Excel file
    const workbook = XLSX.readFile(filePath);
    const emissionsSheet = workbook.Sheets[CCS_XOM_EMISSIONS_SHEET_NAME];
    let geoJSON;

    if (emissionsSheet) {
        const jsonData: any[] = XLSX.utils.sheet_to_json(emissionsSheet, { defval: "" });
        geoJSON = {
            type: "FeatureCollection",
            features: jsonData.map((item, index) => {
                return {
                    type: "Feature",
                    properties: {
                        archie_id: item['Archie ID'],
                        facility_id: item['facility ID'],
                        sector_detail: item['Sector Detail'],
                        unique_facility_name: item['Unique Facility Name'],
                        latitude: item['Latitude'],
                        longitude: item['Longitude'],
                        co2_concentration: item['CO2 concentration (% mol)'],
                        process_emissions_unit_considered_for_co2_capture: item['Process emissions unit considered for CO2 capture (fraction)'],
                        total_emissions: item['Total Emissions (Mt CO2)'],
                        assumed_captured_emissions: item['Assumed captured emissions (MMtCO2)'],
                        carbon_footprint: item['Carbon footprint (tCO2e/t CO2 feedstock)'],
                        co2_cost: item['CO2 cost ($/t CO2)'],
                        dataSouce: "XOM"
                    },
                    geometry: {
                        type: "Point",
                        coordinates: [
                            item['Longitude'],
                            item['Latitude']
                        ]
                    }
                };
            })
        }
    }

    return geoJSON;
}

