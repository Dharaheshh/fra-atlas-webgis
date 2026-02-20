// In-memory data store for Simulation Layer
// Isolated from existing system data.

const claims = [];
let nextId = 1;

/**
 * Returns all simulated claims
 */
const getClaims = () => {
    return claims;
};

/**
 * Adds a new claim to the store and assigns an ID
 */
const addClaim = (claimData) => {
    const newClaim = {
        claimId: `SIM-${nextId++}`,
        citizenName: claimData.citizenName,
        district: claimData.district,
        areaRequested: Number(claimData.areaRequested),
        coordinates: claimData.coordinates || null, // Optional for simulation
        status: claimData.status || "Submitted",
        conflictPercentage: claimData.conflictPercentage || 0,
        timestamp: new Date().toISOString()
    };

    claims.push(newClaim);
    return newClaim;
};

/**
 * Updates the status of an existing claim
 */
const updateClaimStatus = (claimId, newStatus) => {
    const claim = claims.find(c => c.claimId === claimId);
    if (!claim) return null;

    claim.status = newStatus;

    // Once approved, it might have resolved a conflict or added to valid land pool
    // But per instructions, the conflict severity algorithm runs on *submission* 
    // to check feasibility. Status changes alone just update the claim record.
    return claim;
};

module.exports = {
    getClaims,
    addClaim,
    updateClaimStatus
};
