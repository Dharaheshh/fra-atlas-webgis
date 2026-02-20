const turf = require('@turf/turf');
const fs = require('fs');
const path = require('path');
const claimsStore = require('./claimsStore');

// Load static forest zones for Phase 6
const ZONES_FILE = path.join(__dirname, 'data', 'forestZones.geojson');
let forestZones = { type: "FeatureCollection", features: [] };

// Phase 8: Load reserved forests
const RESERVED_FILE = path.join(__dirname, 'data', 'reservedForests.geojson');
let reservedForests = { type: "FeatureCollection", features: [] };

try {
    const rawData = fs.readFileSync(ZONES_FILE, 'utf-8');
    forestZones = JSON.parse(rawData);

    if (fs.existsSync(RESERVED_FILE)) {
        const rawResData = fs.readFileSync(RESERVED_FILE, 'utf-8');
        reservedForests = JSON.parse(rawResData);
    }
} catch (err) {
    console.error("Error reading geojson files:", err);
}

/**
 * Validates a newly drawn claim polygon against the fixed forest zones
 * and existing approved claims in the store using Turf.js.
 * 
 * @param {Object} drawnFeature GeoJSON Feature (Polygon) submitted by user
 * @param {String} district The district the citizen selected
 * @returns {Object} { conflictSeverity, status }
 */
function calculateSpatialConflict(drawnFeature, district) {
    // 1. Find the target Forest Zone for this district
    const targetZone = forestZones.features.find(f => f.properties.district === district);

    // Fallback: If no zone exists for this district, default to Phase 5 area math check 
    // This satisfies the "zero regression fallback" constraint.
    const requestedArea = drawnFeature.properties?.areaRequested || 0;
    if (!targetZone) {
        return fallbackCalculateConflict(district, requestedArea);
    }

    const zoneCapacity = targetZone.properties.totalArea; // Constant 500 acres

    try {
        // 2. We use turf.area to approximate the size of the drawn polygon in square meters
        // then convert to acres (1 sq meter = 0.000247105 acres)
        // Note: For simulation simplicity we just trust the math, but real GIS relies on exact projections.
        const drawnAreaSqMeters = turf.area(drawnFeature);
        const drawnAreaAcres = drawnAreaSqMeters * 0.000247105;

        // Ensure the geometry is valid
        if (!drawnFeature.geometry || !drawnFeature.geometry.coordinates) {
            return fallbackCalculateConflict(district, requestedArea);
        }

        // 3. Find intersection with the Forest Boundary.
        // The claim MUST be inside the boundary. If it's outside entirely, it's flagged as an invalid claim location.
        const boundaryIntersection = turf.intersect(turf.featureCollection([drawnFeature, targetZone]));
        if (!boundaryIntersection) {
            // Completely outside the designated forest zone!
            return {
                status: "Flagged",
                conflictSeverity: 100, // 100% invalid location
                reason: "Polygon falls completely outside the designated district forest zone."
            };
        }
        // 3.5 Phase 8: Reserved Forest Sub-Zone Absolute Constraint
        const targetReserved = reservedForests.features.find(f => f.properties.district === district);
        if (targetReserved) {
            const reservedIntersection = turf.intersect(turf.featureCollection([drawnFeature, targetReserved]));
            if (reservedIntersection) {
                // Return immediately - skip normal logic
                return {
                    status: "Reserved Violation",
                    conflictSeverity: 100, // Hardcoded 100 per instruction
                    reason: "Claim rejected: Requested land falls within a legally protected Reserved Forest zone."
                };
            }
        }

        // 4. Calculate overlap with existing APPROVED claims natively via geometries
        const allClaims = claimsStore.getClaims();
        let totalOverlapAreaAcres = 0;

        allClaims.forEach(existingClaim => {
            if (existingClaim.district === district && existingClaim.status === "Approved" && existingClaim.coordinates) {
                try {
                    // Re-construct the stored coordinates into a Turf polygon
                    const existingPoly = turf.polygon(existingClaim.coordinates);

                    // Check intersection 
                    const intersection = turf.intersect(turf.featureCollection([drawnFeature, existingPoly]));

                    if (intersection) {
                        const overlapSqM = turf.area(intersection);
                        totalOverlapAreaAcres += (overlapSqM * 0.000247105);
                    }
                } catch (e) {
                    console.error("Error intersecting geometries: " + e.message);
                }
            }
        });

        // 5. Conflict severity = Overlap Area / Zone Capacity
        // Basically, if they draw completely over existing approved land, conflict represents the % of the total zone they are intruding on
        // *Plus* we do a hard boundary check: (Existing Approved Area + New Drawn Area) > Capacity

        // Sum total existing approved area to ensure the total capacity constraint from Phase 5 remains physically true
        let approvedArea = 0;
        allClaims.forEach(c => {
            if (c.district === district && c.status === "Approved") {
                approvedArea += c.areaRequested;
            }
        });

        const capacityExcess = (approvedArea + drawnAreaAcres) - zoneCapacity;

        // 5. Conflict severity = Overlap Area / Zone Capacity
        let conflictPercentage = (totalOverlapAreaAcres / zoneCapacity) * 100;
        const capacitySeverity = capacityExcess > 0 ? (capacityExcess / zoneCapacity) * 100 : 0;

        let finalSeverity = Math.max(conflictPercentage, capacitySeverity);

        // Normalize
        finalSeverity = Math.round(finalSeverity);
        if (finalSeverity < 1) {
            finalSeverity = 0;
        }

        // 6. Assign Strict Status Rules
        let status = "Under Review";
        let reason = "Valid spatial geometry.";

        if (finalSeverity > 10) {
            status = "Flagged";
            reason = conflictPercentage > 10 ? "High spatial overlap detected." : "Exceeds total district capacity.";
        } else if (finalSeverity > 0) {
            status = "Moderate Conflict";
            reason = "Minor spatial intersection detected.";
        }

        console.log("Conflict %:", finalSeverity);

        return {
            status: status,
            conflictSeverity: finalSeverity,
            reason: reason
        };

    } catch (err) {
        console.error("Turf calculate error:", err);
        return fallbackCalculateConflict(district, requestedArea);
    }
}

/**
 * Phase 5 Original Logic (Fallback if no GeoJSON spatial data / no zone exists)
 */
function fallbackCalculateConflict(district, newAreaRequested) {
    const allClaims = claimsStore.getClaims();
    let approvedArea = 0;
    allClaims.forEach(c => {
        if (c.district === district && c.status === "Approved") {
            approvedArea += c.areaRequested;
        }
    });

    const totalRequested = approvedArea + newAreaRequested;

    if (totalRequested > 500) {
        const excess = totalRequested - 500;
        const conflictPercentage = (excess / 500) * 100;
        return {
            status: "Flagged",
            conflictSeverity: parseFloat(conflictPercentage.toFixed(2))
        };
    } else {
        return {
            status: "Approved",
            conflictSeverity: 0
        };
    }
}

module.exports = {
    calculateSpatialConflict,
    forestZones
};
