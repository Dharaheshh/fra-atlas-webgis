import React, { useEffect, useState } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-draw';
import 'leaflet-draw/dist/leaflet.draw.css';
import axios from 'axios';
import * as turf from '@turf/turf';

interface SpatialClaimLayerProps {
    onShapeDrawn: (geojson: any) => void;
    activeDistrict: string;
}

const SpatialClaimLayer: React.FC<SpatialClaimLayerProps> = ({ onShapeDrawn, activeDistrict }) => {
    const map = useMap();
    const [zones, setZones] = useState<any>(null);
    const [reservedZones, setReservedZones] = useState<any>(null);
    const [simulatedClaims, setSimulatedClaims] = useState<any[]>([]);

    // 1. Fetch Zones, Reserved Zones & Existing Claims
    const fetchData = async () => {
        try {
            const [zonesRes, reservedRes, claimsRes] = await Promise.all([
                axios.get('http://localhost:5000/api/simulation/zones'),
                axios.get('http://localhost:5000/api/simulation/reserved-zones'),
                axios.get('http://localhost:5000/api/simulation/claims')
            ]);
            setZones(zonesRes.data);
            setReservedZones(reservedRes.data);
            setSimulatedClaims(claimsRes.data);
        } catch (err) {
            console.error("Failed to load spatial simulation layers", err);
        }
    };

    useEffect(() => {
        // Poll for updates every 3 seconds to ensure live updates across the app
        fetchData();
        const interval = setInterval(fetchData, 3000);
        return () => clearInterval(interval);
    }, []);

    // 2. Setup Leaflet Draw Tool (Hidden UI, active logic)
    useEffect(() => {
        if (!map) return;

        // Hide the Leaflet Draw toolbar via CSS injection to keep UI strictly professional
        // while preserving the polygon engine
        const style = document.createElement('style');
        style.innerHTML = `
            .leaflet-draw-toolbar { display: none !important; }
        `;
        document.head.appendChild(style);

        const drawnItems = new L.FeatureGroup();
        map.addLayer(drawnItems);

        const drawControl = new L.Control.Draw({
            position: 'topright',
            draw: {
                polygon: {
                    allowIntersection: false,
                    showArea: true,
                    shapeOptions: {
                        color: '#4f46e5', // Indigo
                        fillOpacity: 0.3
                    }
                },
                polyline: false,
                circle: false,
                rectangle: false,
                circlemarker: false,
                marker: false,
            },
            edit: {
                featureGroup: drawnItems,
                remove: true
            }
        });

        // Add the control to the map
        map.addControl(drawControl);

        // Handle Draw Event
        const onDrawCreated = (e: any) => {
            const layer = e.layer;
            drawnItems.clearLayers(); // Only allow one at a time for the form
            drawnItems.addLayer(layer);

            // Pass the GeoJSON back up to the form
            onShapeDrawn(layer.toGeoJSON());
        };

        map.on(L.Draw.Event.CREATED, onDrawCreated);

        // Custom listener to trigger drawing programmatically from the new slim UI button
        const handleActivateDraw = () => {
            new (L.Draw as any).Polygon(map, {
                allowIntersection: false,
                showArea: true,
                shapeOptions: { color: '#4f46e5', fillOpacity: 0.3 }
            }).enable();
        };
        window.addEventListener('activate-draw', handleActivateDraw);

        return () => {
            map.removeControl(drawControl);
            map.off(L.Draw.Event.CREATED, onDrawCreated);
            window.removeEventListener('activate-draw', handleActivateDraw);
            map.removeLayer(drawnItems);
        };
    }, [map, onShapeDrawn]);

    // 3. Render Static Zones, Reserved Zones, and Simulated Maps Output
    useEffect(() => {
        if (!map || !zones) return;

        const layers: L.Layer[] = [];

        let boundsToFlyTo: L.LatLngBounds | null = null;

        // Add Forest Zones (Soft green styling)
        const zoneLayer = L.geoJSON(zones, {
            style: (feature) => {
                const isTarget = feature?.properties?.district === activeDistrict;
                return {
                    color: isTarget ? '#065f46' : '#64748b', // Dark green border
                    weight: isTarget ? 3 : 2,
                    fillColor: isTarget ? '#10b981' : 'transparent', // Light green fill
                    fillOpacity: isTarget ? 0.25 : 0.05, // 0.2-0.3 opacity as requested
                    dashArray: isTarget ? '5, 5' : '2, 2'
                };
            },
            onEachFeature: (feature, layer) => {
                const label = `🌲 ${feature.properties.district} Forest Limit (500 Acres)`;
                layer.bindTooltip(label, { permanent: true, direction: 'center', className: 'bg-white/90 text-slate-800 font-bold px-2 py-1 rounded shadow-sm border border-slate-200' });
                layer.bindPopup(`<b>${feature.properties.zoneId}</b><br/>District: ${feature.properties.district}<br/>Capacity: ${feature.properties.totalArea} Acres`);

                // If this is the active district, grab its bounds
                if (feature?.properties?.district === activeDistrict && layer instanceof L.Polygon) {
                    boundsToFlyTo = layer.getBounds();
                }
            }
        });
        zoneLayer.addTo(map);
        layers.push(zoneLayer);

        // Auto-pan to the selected area so the user doesn't have to drag the map from under the panel
        if (boundsToFlyTo) {
            // Offset the padding to account for the left sidebar Panel (450px wide)
            map.flyToBounds(boundsToFlyTo, { paddingTopLeft: [450, 50], paddingBottomRight: [50, 50], duration: 1.5 });
        }

        // Add Reserved Forest Sub-Zone Layer (Phase 8)
        // Rendered with a dark border, stripes pattern, and NO-CLAIM popup
        if (reservedZones && reservedZones.features && reservedZones.features.length > 0) {
            const reservedLayer = L.geoJSON(reservedZones, {
                style: () => ({
                    color: '#14532d',       // Very dark green border
                    weight: 3,
                    fillColor: '#166534',  // Dark forest green fill
                    fillOpacity: 0.45,
                    dashArray: '6, 4'      // Striped border to signal no-claim
                }),
                onEachFeature: (feature, layer) => {
                    layer.bindTooltip(`🚫 Reserved Forest – No Claim Zone`, {
                        permanent: true,
                        direction: 'center',
                        className: 'bg-red-950/90 text-white font-bold px-2 py-1 rounded shadow-sm border border-red-900 text-xs'
                    });
                    layer.bindPopup(`
                        <b style="color:#14532d">🔒 Reserved Forest Zone</b><br/>
                        District: ${feature.properties.district}<br/>
                        <span style="color:#dc2626;font-weight:bold">⚠ No Claims Permitted</span><br/>
                        <small>Submitting a claim here will be automatically rejected under Forest Rights Act provisions.</small>
                    `);
                }
            });
            reservedLayer.addTo(map);
            reservedLayer.bringToFront();
            layers.push(reservedLayer);
        }

        // Add Simulated Claims logic from memory store
        // We only render those with coordinates
        const spatialClaims = simulatedClaims.filter(c => c.coordinates && c.coordinates.length > 0);

        spatialClaims.forEach(claim => {
            const polygonData = {
                type: "Polygon",
                coordinates: claim.coordinates
            } as any;

            const layer = L.geoJSON(polygonData, {
                style: () => {
                    if (claim.status === "Approved") return { color: '#059669', fillColor: '#10b981', fillOpacity: 0.6, weight: 2 }; // Solid Green
                    if (claim.status === "Flagged") return { color: '#dc2626', fillColor: '#ef4444', fillOpacity: 0.6, weight: 2 }; // Solid Red
                    if (claim.status === "Rejected") return { color: '#475569', fillColor: '#94a3b8', fillOpacity: 0.4, weight: 1, dashArray: '4' }; // Gray
                    if (claim.status === "Reserved Violation") return { color: '#1c1917', fillColor: '#44403c', fillOpacity: 0.5, weight: 2, dashArray: '8, 4' }; // Dark gray striped
                    // 'Under Review' or 'Moderate Conflict' maps to the default Yellow pending color to preserve color mechanics
                    return { color: '#d97706', fillColor: '#f59e0b', fillOpacity: 0.5 };
                },
                onEachFeature: (_feature, l) => {
                    // Show the user's name permanently with status-specific icon
                    const statusIcon = claim.status === "Flagged" ? "⚠️" :
                        claim.status === "Reserved Violation" ? "🚫" :
                            claim.status === "Rejected" ? "❌" : "✅";
                    l.bindTooltip(`${statusIcon} ${claim.citizenName}`, { permanent: true, direction: 'center', className: 'font-bold bg-white/90 shadow-sm border border-slate-200 px-2 py-1 rounded text-slate-800' });

                    const statusColor = claim.status === 'Flagged' ? 'red' :
                        claim.status === 'Reserved Violation' ? '#1c1917' :
                            claim.status === 'Moderate Conflict' ? 'orange' : 'green';

                    l.bindPopup(`
                        <b>Simulated Claim: ${claim.claimId}</b><br/>
                        Applicant: ${claim.citizenName}<br/>
                        Status: <b style="color:${statusColor}">${claim.status}</b><br/>
                        ${claim.status === 'Reserved Violation' ? '<span style="color:#dc2626">⚠ Claim rejected: Requested land falls within a legally protected Reserved Forest zone.</span>' : ''}
                        ${claim.conflictPercentage > 0 && claim.status !== 'Reserved Violation' ? `Conflict Severity: ${claim.conflictPercentage}%` : ''}
                    `);
                }
            });
            layer.addTo(map);
            layers.push(layer);
        });

        // Add 4. Overlap / Venn Diagram Layer (Visual Only, exactly per Turf geometry)
        // We calculate intersecting area between any flagged claims and approved claims to show the exact conflict
        const approvedClaimPolys = spatialClaims.filter(c => c.status === "Approved").map(c => turf.polygon(c.coordinates));
        const flaggedClaims = spatialClaims.filter(c => c.status === "Flagged");

        flaggedClaims.forEach(flagged => {
            const flaggedPoly = turf.polygon(flagged.coordinates);

            approvedClaimPolys.forEach(appPoly => {
                try {
                    const intersection = turf.intersect(turf.featureCollection([flaggedPoly, appPoly]));
                    if (intersection) {
                        const overlapLayer = L.geoJSON(intersection, {
                            style: {
                                color: '#9d4edd', // Purple border
                                fillColor: '#9d4edd', // Purple fill
                                fillOpacity: 0.6,
                                weight: 1 // Thin border
                            },
                            interactive: false // pure visual overlay so it doesn't block clicks beneath
                        });
                        overlapLayer.addTo(map);
                        // Ensure it renders on top by bringing it to front
                        overlapLayer.bringToFront();
                        layers.push(overlapLayer);
                    }
                } catch (e) {
                    console.error("Error rendering overlap visual:", e);
                }
            });
        });

        return () => {
            layers.forEach(l => map.removeLayer(l));
        };
    }, [map, zones, reservedZones, simulatedClaims, activeDistrict]);

    return null; // This is a logic-only component injected into MapContainer
};

export default SpatialClaimLayer;
