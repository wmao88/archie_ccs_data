import * as path from 'path';
import {
    prossingCCSClusterSAData,
    prossingCCSSinksSAData,
    prossingKaustEmissionsData,
    prossingRystadEmissionsData,
    prossingXomEmissionsData
} from './CcsExcelSheetToJson';
import { DataFilesWriter } from '../utils/dataFilesWriter';


const CCS_OUTPUT_FOLDER = 'ccs_data_output';

const CCS_EMISSIONS_FILE = 'Saudi Arabia West Coast Emissions 2022 Archie v1.xlsx';
const CCS_SINKS_SA_SOURCES_FILE = 'CCS_SA_sinks.xlsx';
const CCS_RYSTAD_CLUSTER_SA_FILE = 'ccs_sa_cluster_economic.xlsx';
const CCS_XOM_CLUSTER_SA_FILE = 'ccs_sa_cluster_XOM.xlsx';


async function readCcsSAData(): Promise<void> {

    const allSinks = prossingCCSSinksSAData(CCS_SA_SINKS);
    console.log('all SA Sinks: ', allSinks?.features.length);
    new DataFilesWriter().WriteToFile(CCS_OUTPUT_FOLDER, 'ccs_sa_sinks.geojson', allSinks);

    const rystadEmissions = prossingRystadEmissionsData(CCS_SA_EMISSIONS);
    console.log('all rystad Emissions: ', rystadEmissions?.features.length);

    const kaustEmissions = prossingKaustEmissionsData(CCS_SA_EMISSIONS);
    console.log('all kaust Emissions: ', kaustEmissions?.features.length);

    const xomEmissions = prossingXomEmissionsData(CCS_SA_EMISSIONS);
    console.log('all xcom Emissions: ', xomEmissions?.features.length);

    // combine all emissions
    const allEmissions = {
        type: "FeatureCollection",
        features: [
            ...(rystadEmissions?.features || []),
            ...(kaustEmissions?.features || []),
            ...(xomEmissions?.features || [])
        ]
    };
    // we need to go through all emissions and reassign Archie ID, the archie id should be sequential starting from 1
    allEmissions.features.forEach((feature, index) => {
        feature.properties['archie_id'] = index + 1;
    });
    console.log('all SA Emissions: ', allEmissions?.features.length);
    new DataFilesWriter().WriteToFile(CCS_OUTPUT_FOLDER, 'ccs_sa_emissions.geojson', allEmissions);

    // clusters for rystad emissions
    const allClusters = prossingCCSClusterSAData(rystadEmissions, CCS_SA_RYSTAD_CLUSTER, false);
    console.log('all SA Clusters: ', allClusters.features.length);
    new DataFilesWriter().WriteToFile(CCS_OUTPUT_FOLDER, 'ccs_sa_clusters.geojson', allClusters);

    // clusters for rystad emissions economic
    const allEconomicClusters = prossingCCSClusterSAData(rystadEmissions, CCS_SA_RYSTAD_CLUSTER, true);
    console.log('all SA Economic Clusters: ', allEconomicClusters.features.length);
    new DataFilesWriter().WriteToFile(CCS_OUTPUT_FOLDER, 'ccs_sa_economic_clusters.geojson', allEconomicClusters);

    // clusters for xcom emissions economic
    const allXomClusters = prossingCCSClusterSAData(xomEmissions, CCS_SA_XOM_CLUSTER, false);
    console.log('all SA Economic Clusters: ', allXomClusters.features.length);
    new DataFilesWriter().WriteToFile(CCS_OUTPUT_FOLDER, 'ccs_xom_clusters.geojson', allXomClusters);
}


const CCS_SA_RYSTAD_CLUSTER = path.join(`./raw_data/${CCS_RYSTAD_CLUSTER_SA_FILE}`);
const CCS_SA_XOM_CLUSTER = path.join(`./raw_data/${CCS_XOM_CLUSTER_SA_FILE}`);
const CCS_SA_SINKS = path.join(`./raw_data/${CCS_SINKS_SA_SOURCES_FILE}`);
const CCS_SA_EMISSIONS = path.join(`./raw_data/${CCS_EMISSIONS_FILE}`);


readCcsSAData();





