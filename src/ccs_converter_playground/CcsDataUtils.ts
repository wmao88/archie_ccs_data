
import * as turf from '@turf/turf';
// Group facilities by cluster
export function groupFacilitiesByCluster(
    clusterData: any[],
    facilityData: any
): Map<number, any[]> {
    const clusterMap = new Map<number, any[]>();

    // Create mapping from facility name to cluster ID
    const facilityToClusterMap = new Map<string, number>();
    clusterData.forEach((item) => {
        facilityToClusterMap.set(item['Unique Facility Name'], item.Cluster);
    });

    // Group facilities by cluster
    facilityData.features.forEach((facility: any) => {
        const clusterID = facilityToClusterMap.get(
            (facility as any).properties.unique_facility_name
        );

        if (clusterID !== undefined) {
            if (!clusterMap.has(clusterID)) {
                clusterMap.set(clusterID, []);
            }
            clusterMap.get(clusterID)?.push(facility);
        }
    });

    return clusterMap;
};

export function getClusterCircle(facilities: any[]) {
    const points = facilities.map((f) => turf.point(f.geometry.coordinates));
    const fc = turf.featureCollection(points);

    const center = turf.center(fc);
    let maxDistance = 0;

    for (const pt of points) {
        const dist = turf.distance(center, pt, 'kilometers');
        maxDistance = Math.max(maxDistance, dist);
    }

    // Add a small buffer to ensure points near the edge are fully covered
    maxDistance *= 1.1;

    const circle = turf.circle(center, maxDistance, 64);

    return {
        center: center.geometry.coordinates,
        radiusKm: maxDistance,
        circleGeoJSON: circle,
    };
}


// Process clusters to find the center (facility with largest capture) and radius
export function processClusterData(
    clusterData: any[],
    clusterMap: Map<number, any[]>
): any[] {
    const processedClusters: any[] = [];

    clusterMap.forEach((facilities, clusterID) => {
        if (facilities.length === 0) return;

        // Find facility with largest assumed process capture
        let maxCaptureFacility = facilities[0];
        let maxCaptureValue = facilities[0].properties.assumed_captured_emissions;
        let connectedSink = facilities[0].properties.connected_sink;
        facilities.forEach((facility) => {
            if (facility.properties.assumed_captured_emissions > maxCaptureValue) {
                maxCaptureValue = facility.properties.assumed_captured_emissions;
                maxCaptureFacility = facility;
            }
        });

        // Get cluster circle data - only if there's more than one facility
        let center, radiusKm;
        if (facilities.length > 1) {
            const circleData = getClusterCircle(facilities);
            center = circleData.center;
            radiusKm = circleData.radiusKm;
        }
        else {
            // For single facility, use its coordinates and zero radius
            center = facilities[0].geometry.coordinates;
            radiusKm = 0;
        }

        // Calculate total emissions and captured emissions for the cluster
        const totalEmissions = facilities.reduce(
            (sum, facility) => sum + facility.properties.total_emissions,
            0
        );

        const totalCapturedEmissions = facilities.reduce(
            (sum, facility) => sum + facility.properties.assumed_captured_emissions,
            0
        );

        // find cluster connected sink name from clusterData
        const connectedSinkName = clusterData.find(
            (cluster) => cluster.Cluster === clusterID
        )?.['Connected Sink'];

        processedClusters.push({
            id: clusterID,
            facilities,
            center: {
                longitude: center[0],
                latitude: center[1],
            },
            radius: radiusKm,
            totalEmissions,
            totalCapturedEmissions,
            mainFacility: maxCaptureFacility,
            connected_sink: connectedSinkName || '',
        });
    });

    return processedClusters;
};


export function calculateDistance(
    coord1: [number, number],
    coord2: [number, number],
    unit: 'kilometers' | 'miles' | 'meters' = 'kilometers'
): number {
    const point1 = turf.point(coord1);
    const point2 = turf.point(coord2);
    return turf.distance(point1, point2, unit);
}
