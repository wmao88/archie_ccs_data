
import axios from 'axios';

const MAPBOX_TOKEN = 'pk.eyJ1Ijoid21hbzg4IiwiYSI6ImNtMDU2aHA0dTBjeWMya3NiZ2E4cnZscWQifQ.uD9DazFGvUaFADiacrf04A';

const getDrivingRoute = async (fromLngLat: number[], toLngLat: number[]) => {
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${fromLngLat.join(',')};${toLngLat.join(',')}?geometries=geojson&access_token=${MAPBOX_TOKEN}`;

    try {
        const response = await axios.get(url);
        if (!response.data.routes || response.data.routes.length === 0) return null;

        // response this as a geojson feature
        const geoJSON = {
            type: "Feature",
            properties: {
                distance: response.data.routes[0].distance,
            },
            geometry: response.data.routes[0].geometry
        }
        return geoJSON;
    } catch (error) {
        console.error('Error fetching route:', error);
        return null;
    }
};

export async function prossingCCSRoutesData(allClusters: any, allEmissions: any, allSinks: any) {
    const routes = [];

    for (const cluster of allClusters.features) {
        const sinkList: any[] = [];
        const facilities = cluster.properties.facilities;
        // sum up the assumed_process_capture of all facilities
        const totalCapturedEmissions = facilities.reduce((sum: number, facility: any) => sum + facility.assumed_process_capture, 0);

        for (const clusterFacility of cluster.properties.facilities) {
            const emissionSource = allEmissions.features.find(
                (feature: any) => feature.properties.facility_id === clusterFacility.facility_id
            );
            const connectedSink = allSinks.features.find(
                (sink: any) => sink.properties.name === clusterFacility.connected_sink
            );

            if (!emissionSource || !connectedSink) {
                console.warn(`Missing data for facility or sink`);
                continue;
            }
            // make sure sinkList doesn't have duplicate sinks
            if (!sinkList.some((sink: any) => sink.properties.id === connectedSink.properties.id)) {
                sinkList.push(connectedSink);
            }
        }

        for (const sink of sinkList) {
            try {
                const geoJson = await getDrivingRoute(
                    cluster.geometry.coordinates,
                    sink.geometry.coordinates
                );

                if (!geoJson) {
                    console.warn(`No route found between ${cluster.properties.name} and ${sink.properties.name}`);
                    continue;
                }

                const route = {
                    ...geoJson,
                    properties: {
                        routeId: `${cluster.properties.cluster_id}-${sink.properties.id}`,
                        source: cluster.properties.cluster_id,
                        destination: sink.properties.name,
                        distance: geoJson.properties.distance,
                        totalCapturedEmissions: totalCapturedEmissions
                    }
                };

                routes.push(route);
            } catch (error) {
                console.error(`Error getting route for ${cluster.properties.name}:`, error);
            }
        }
    }

    // routesGeojson should be a geojson feature collection
    const geoJSON = {
        type: "FeatureCollection",
        features: routes
    }

    return geoJSON;
}
