require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 5000;
const DATA_FILE = path.join(__dirname, 'data', 'mock_claims.json');

// Helper to read data
function getMockData() {
    try {
        const rawData = fs.readFileSync(DATA_FILE, 'utf-8');
        return JSON.parse(rawData);
    } catch (err) {
        console.error("Error reading mock data:", err);
        return { features: [] };
    }
}

// Phase 1: Claims Endpoint
app.get('/api/claims', (req, res) => {
    try {
        const data = getMockData();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Phase 2: Analytics Endpoint (Ported from python)
app.get('/api/analytics', (req, res) => {
    try {
        const data = getMockData();
        const features = data.features || [];

        let total_claims = features.length;
        let approved_claims = 0;
        let pending_claims = 0;
        let conflict_claims = 0;
        let districts_data = {};

        features.forEach(feature => {
            const props = feature.properties || {};
            const district = props.district || 'Unknown';
            const status = props.status || 'Unknown';
            const overlap = props.overlap || false;
            const protectedZone = props.protected_zone || false;

            // Global Counts
            if (status === 'Approved') approved_claims++;
            else if (status === 'Pending') pending_claims++;
            else if (status === 'Conflict' || overlap || protectedZone) conflict_claims++;

            // Initialize district
            if (!districts_data[district]) {
                districts_data[district] = { total: 0, pending: 0, conflicts: 0, approved: 0 };
            }

            // District Counts
            districts_data[district].total++;
            if (status === 'Pending') districts_data[district].pending++;
            else if (status === 'Approved') districts_data[district].approved++;

            if (overlap || protectedZone || status === 'Conflict') {
                districts_data[district].conflicts++;
            }
        });

        // Calculate Risk Scores per district
        let district_rankings = [];
        for (const [name, stats] of Object.entries(districts_data)) {
            if (stats.total === 0) continue;

            const pending_pct = (stats.pending / stats.total) * 100;
            const conflict_pct = (stats.conflicts / stats.total) * 100;

            const risk_score = (pending_pct * 0.5) + (conflict_pct * 0.5);
            let risk_level = "High";
            if (risk_score <= 40) risk_level = "Low";
            else if (risk_score <= 70) risk_level = "Moderate";

            district_rankings.push({
                district: name,
                total_claims: stats.total,
                pending: stats.pending,
                conflicts: stats.conflicts,
                risk_score: parseFloat(risk_score.toFixed(2)),
                risk_level: risk_level
            });
        }

        // Sort by risk_score desc
        district_rankings.sort((a, b) => b.risk_score - a.risk_score);

        res.json({
            summary: {
                total_claims,
                approved_claims,
                pending_claims,
                conflict_claims,
                approved_pct: total_claims ? parseFloat((approved_claims / total_claims * 100).toFixed(1)) : 0,
                pending_pct: total_claims ? parseFloat((pending_claims / total_claims * 100).toFixed(1)) : 0
            },
            districts: district_rankings
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Phase 3: AI Report Endpoint using user's explicit setup
app.get('/api/report/:district', async (req, res) => {
    try {
        const { district } = req.params;

        if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
            return res.json({ error: "API key not valid. Please pass a valid API key in the backend/.env file." });
        }

        // Fetch Analytics internally to get data for prompt
        // Note: Using a minimal inline version of the analytics logic here to keep it self-contained
        const data = getMockData();
        const features = data.features || [];

        let districtStats = { total: 0, pending: 0, conflicts: 0, approved: 0 };
        features.forEach(feature => {
            const props = feature.properties || {};
            if (props.district === district) {
                districtStats.total++;
                if (props.status === 'Pending') districtStats.pending++;
                if (props.overlap || props.protected_zone || props.status === 'Conflict') districtStats.conflicts++;
            }
        });

        if (districtStats.total === 0) {
            return res.json({ error: `No data found for district: ${district}` });
        }

        const pending_pct = (districtStats.pending / districtStats.total) * 100;
        const conflict_pct = (districtStats.conflicts / districtStats.total) * 100;
        const risk_score = parseFloat(((pending_pct * 0.5) + (conflict_pct * 0.5)).toFixed(2));
        let risk_level = risk_score <= 40 ? "Low" : (risk_score <= 70 ? "Moderate" : "High");

        const prompt = `You are an expert governance compliance analyst under the Forest Rights Act (FRA).
Generate a concise formal compliance summary using the following regional data:

District: ${district}
Total Claims: ${districtStats.total}
Conflicts (Overlaps/Protected Zones): ${districtStats.conflicts}
Pending Claims: ${districtStats.pending}
Calculated Risk Level: ${risk_level} (Score: ${risk_score})

Please provide:
1. A brief summary of the exact statistics above.
2. The severity of the conflict risk.
3. Actionable policy recommendations for administrative review.

Keep the output professional, objective, and no longer than 2-3 paragraphs.`;

        // Exact User-Provided Fetch Code (with small adjustment to read GET req logic instead of POST prompt)
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            }
        );

        const apiData = await response.json();

        // Handle invalid API keys elegantly based on the structure they return
        if (apiData.error) {
            console.error("Gemini API Error:", JSON.stringify(apiData.error, null, 2));
            return res.json({ error: `AI Generation Failed: ${apiData.error.code} ${apiData.error.message}` });
        }

        const text =
            apiData?.candidates?.[0]?.content?.parts?.[0]?.text ||
            "No response from Gemini";

        res.json({ district, reportText: text });

    } catch (err) {
        console.error("Internal Server Error calling Gemini API:", err);
        res.status(500).json({ error: "Internal Error calling Gemini API" });
    }
});

// --- PHASE 5: ISOLATED SIMULATION LAYER ---

const claimsStore = require('./claimsStore');
const spatialEngine = require('./spatialConflictEngine');
const SIMULATION_DISTRICT_LIMIT_ACRES = 500;

/**
 * Endpoint to serve static forest zones to the frontend Map
 */
app.get('/api/simulation/zones', (req, res) => {
    res.json(spatialEngine.forestZones);
});

/**
 * Phase 5 Fallback Helper
 */
function calculateConflict(district, newAreaRequested) {
    const allClaims = claimsStore.getClaims();

    // Sum only Approved simulated claims in this district
    let approvedArea = 0;
    allClaims.forEach(c => {
        if (c.district === district && c.status === "Approved") {
            approvedArea += c.areaRequested;
        }
    });

    const totalRequested = approvedArea + newAreaRequested;

    if (totalRequested > SIMULATION_DISTRICT_LIMIT_ACRES) {
        const excess = totalRequested - SIMULATION_DISTRICT_LIMIT_ACRES;
        const conflictPercentage = (excess / SIMULATION_DISTRICT_LIMIT_ACRES) * 100;
        return {
            status: "Flagged",
            conflictPercentage: parseFloat(conflictPercentage.toFixed(2))
        };
    } else {
        return {
            status: "Approved",
            conflictPercentage: 0
        };
    }
}

// 1. Submit a new claim
app.post('/api/simulation/claims/submit', (req, res) => {
    try {
        const { citizenName, district, areaRequested, geojson } = req.body;

        if (!citizenName || !district) {
            return res.status(400).json({ error: "Missing required fields." });
        }

        let severityResult;

        // --- Phase 6 Spatial Validation ---
        if (geojson) {
            severityResult = spatialEngine.calculateSpatialConflict(geojson, district);
        } else {
            // --- Phase 5 Area Validation (Fallback) ---
            if (!areaRequested) return res.status(400).json({ error: "Missing area requested." });
            severityResult = calculateConflict(district, Number(areaRequested));
        }

        const newClaim = claimsStore.addClaim({
            citizenName,
            district,
            areaRequested: Number(areaRequested) || 0, // In spatial, area might be implicit but we pass it anyway
            coordinates: geojson ? geojson.geometry.coordinates : null, // Store geometry if drawn
            status: severityResult.status,
            conflictPercentage: severityResult.conflictSeverity || severityResult.conflictPercentage // map keys
        });

        res.json({
            message: "Claim processed",
            claim: newClaim,
            reason: severityResult.reason || "Auto-checked"
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Get all simulated claims
app.get('/api/simulation/claims', (req, res) => {
    try {
        res.json(claimsStore.getClaims());
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Admin review a claim
app.patch('/api/simulation/claims/:id/review', (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body; // "Approved" or "Rejected"

        if (!["Approved", "Rejected"].includes(status)) {
            return res.status(400).json({ error: "Invalid status update. Use 'Approved' or 'Rejected'." });
        }

        const updatedClaim = claimsStore.updateClaimStatus(id, status);
        if (!updatedClaim) {
            return res.status(404).json({ error: "Claim not found." });
        }

        res.json({ message: `Claim statused updated to ${status}`, claim: updatedClaim });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Overloaded Analytics for the Simulation (Zero risk to existing logic)
// To fulfill risk engine integration constraints without modifying the original logic,
// we wrap the original logic block with our simulated data appended to it locally for this endpoint.
app.get('/api/simulation/analytics', (req, res) => {
    try {
        // --- 1. Fetch exactly the same JSON as Phase 2
        const mockData = getMockData();
        const features = Array.from(mockData.features || []);

        // --- 2. Inject Simulated Store Claims INTO the local features array memory mapping ---
        const simulatedClaims = claimsStore.getClaims();
        simulatedClaims.forEach(sim => {
            // Map our store to the GeoJSON property format expected by the algorithm
            // We do not add overlap polygons, we just flag it based on the algorithm req
            features.push({
                properties: {
                    district: sim.district,
                    status: sim.status,
                    conflict_percentage: sim.conflictPercentage,
                    // We map our "Flagged" status logic to a conflict Boolean for the algo
                    overlap: sim.status === "Flagged" || sim.conflictPercentage > 0
                }
            });
        });

        // --- 3. EXACT RUN of Existing Risk Algorithm line-for-line ---
        let total_claims = features.length;
        let approved_claims = 0;
        let pending_claims = 0;
        let conflict_claims = 0;
        let districts_data = {};

        features.forEach(feature => {
            const props = feature.properties || {};
            const district = props.district || 'Unknown';
            const status = props.status || 'Unknown';
            const overlap = props.overlap || false;
            const protectedZone = props.protected_zone || false;

            // Global Counts
            if (status === 'Approved') approved_claims++;
            else if (status === 'Pending') pending_claims++;
            else if (status === 'Conflict' || overlap || protectedZone) conflict_claims++;
            else if (status === 'Flagged') conflict_claims++; // Add flagged logic locally

            // Initialize district
            if (!districts_data[district]) {
                districts_data[district] = { total: 0, pending: 0, conflicts: 0, approved: 0 };
            }

            // District Counts
            districts_data[district].total++;
            if (status === 'Pending') districts_data[district].pending++;
            else if (status === 'Approved') districts_data[district].approved++;

            if (overlap || protectedZone || status === 'Conflict' || status === 'Flagged') {
                districts_data[district].conflicts++;
            }
        });

        // Calculate Risk Scores per district
        let district_rankings = [];
        for (const [name, stats] of Object.entries(districts_data)) {
            if (stats.total === 0) continue;

            const pending_pct = (stats.pending / stats.total) * 100;
            const conflict_pct = (stats.conflicts / stats.total) * 100;

            const risk_score = (pending_pct * 0.5) + (conflict_pct * 0.5);
            let risk_level = "High";
            if (risk_score <= 40) risk_level = "Low";
            else if (risk_score <= 70) risk_level = "Moderate";

            district_rankings.push({
                district: name,
                total_claims: stats.total,
                pending: stats.pending,
                conflicts: stats.conflicts,
                risk_score: parseFloat(risk_score.toFixed(2)),
                risk_level: risk_level
            });
        }

        district_rankings.sort((a, b) => b.risk_score - a.risk_score);

        res.json({
            summary: {
                total_claims,
                approved_claims,
                pending_claims,
                conflict_claims,
                approved_pct: total_claims ? parseFloat((approved_claims / total_claims * 100).toFixed(1)) : 0,
                pending_pct: total_claims ? parseFloat((pending_claims / total_claims * 100).toFixed(1)) : 0
            },
            districts: district_rankings
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- END ISOLATED SIMULATION LAYER ---

app.listen(PORT, () => console.log(`🚀 Node & Express Server running on HTTP port ${PORT}`));
