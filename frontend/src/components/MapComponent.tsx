import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';
import L from 'leaflet';

// Define the shape of our feature properties
interface ClaimProperties {
    district: string;
    village: string;
    status: 'Approved' | 'Pending' | 'Conflict' | 'Protected';
    area: number;
    overlap: boolean;
    protected_zone: boolean;
}

// Function to handle the styling of each GeoJSON feature based on its status
const styleFeature = (feature: any) => {
    const status = feature.properties.status;
    let fillColor = '#gray'; // Default

    switch (status) {
        case 'Approved':
            fillColor = '#22c55e'; // Green
            break;
        case 'Pending':
            fillColor = '#eab308'; // Yellow
            break;
        case 'Conflict':
            fillColor = '#ef4444'; // Red
            break;
        case 'Protected':
            fillColor = '#3b82f6'; // Blue
            break;
    }

    return {
        fillColor: fillColor,
        weight: 2,
        opacity: 1,
        color: 'white',
        dashArray: '3',
        fillOpacity: 0.7
    };
};

const MapComponent: React.FC = () => {
    const [geoData, setGeoData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Fetch data from the FastAPI backend
        axios.get('http://localhost:5000/api/claims')
            .then(response => {
                setGeoData(response.data);
                setLoading(false);
            })
            .catch(error => {
                console.error("Error fetching GeoJSON data:", error);
                setLoading(false);
            });
    }, []);

    // Function to bind popups to each feature
    const onEachFeature = (feature: any, layer: L.Layer) => {
        if (feature.properties) {
            const props: ClaimProperties = feature.properties;
            const popupContent = `
        <div class="p-2 min-w-[200px]">
          <h3 class="font-bold text-lg mb-1 border-b pb-1">${props.district} - ${props.village}</h3>
          <div class="grid grid-cols-2 gap-2 text-sm mt-2">
            <span class="font-semibold text-gray-600">Status:</span>
            <span class="font-bold ${props.status === 'Approved' ? 'text-green-600' :
                    props.status === 'Pending' ? 'text-yellow-600' :
                        props.status === 'Conflict' ? 'text-red-600' :
                            'text-blue-600'
                }">${props.status}</span>
            <span class="font-semibold text-gray-600">Area:</span>
            <span>${props.area} acres</span>
            <span class="font-semibold text-gray-600">Overlap:</span>
            <span>${props.overlap ? 'Yes' : 'No'}</span>
            <span class="font-semibold text-gray-600">Protected:</span>
            <span>${props.protected_zone ? 'Yes' : 'No'}</span>
          </div>
        </div>
      `;
            layer.bindPopup(popupContent);
        }
    };

    if (loading) {
        return <div className="w-full h-full flex items-center justify-center text-slate-500 font-medium">Loading Map Data...</div>;
    }

    return (
        <div className="w-full h-full relative z-0">
            <MapContainer
                center={[20.5937, 78.9629]} // Center of India roughly
                zoom={5}
                style={{ height: '100%', width: '100%', zIndex: 0 }}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {geoData && (
                    <GeoJSON
                        data={geoData}
                        style={styleFeature}
                        onEachFeature={onEachFeature}
                    />
                )}

                <FitBounds data={geoData} />
            </MapContainer>

            {/* Legend Override Overlay */}
            <div className="absolute bottom-6 right-6 bg-white/90 p-4 rounded-lg shadow-lg z-[1000] border border-slate-200 backdrop-blur-sm">
                <h4 className="font-bold text-slate-700 mb-2 border-b pb-1">Legend</h4>
                <div className="flex flex-col gap-2 text-sm">
                    <div className="flex items-center gap-2"><span className="w-4 h-4 rounded-sm bg-green-500 border border-green-600"></span> Approved</div>
                    <div className="flex items-center gap-2"><span className="w-4 h-4 rounded-sm bg-yellow-500 border border-yellow-600"></span> Pending</div>
                    <div className="flex items-center gap-2"><span className="w-4 h-4 rounded-sm bg-red-500 border border-red-600"></span> Conflict</div>
                    <div className="flex items-center gap-2"><span className="w-4 h-4 rounded-sm bg-blue-500 border border-blue-600"></span> Protected Zone</div>
                </div>
            </div>
        </div>
    );
};

// Component to dynamically set map bounds based on data
const FitBounds = ({ data }: { data: any }) => {
    const map = useMap();
    useEffect(() => {
        if (data && data.features && data.features.length > 0) {
            try {
                const bounds = L.geoJSON(data).getBounds();
                map.fitBounds(bounds, { padding: [50, 50] });
            } catch (e) {
                console.error("Error setting map bounds:", e);
            }
        }
    }, [data, map]);
    return null;
};

export default MapComponent;
