import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { COLORS } from '../../constants/colors';

const DIFFICULTY_COLORS = {
    'Fácil': '#22c55e',
    'Media': '#f59e0b',
    'Media-Alta': '#f97316',
    'Alta': '#ef4444',
};

const DIFFICULTY_ICONS = {
    'Fácil': '🟢',
    'Media': '🟡',
    'Media-Alta': '🟠',
    'Alta': '🔴',
};

// Hinojares center
const CENTER = [37.78, -2.99];
const DEFAULT_ZOOM = 10;

const InteractiveMap = ({ routes, selectedRoute, onSelectRoute, compact = false }) => {
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const polylinesRef = useRef([]);
    const markersRef = useRef([]);

    useEffect(() => {
        if (mapInstanceRef.current) return;

        const map = L.map(mapRef.current, {
            center: CENTER,
            zoom: DEFAULT_ZOOM,
            zoomControl: !compact,
            attributionControl: !compact,
            scrollWheelZoom: !compact,
        });

        // CartoDB Voyager — clean, colorful, travel-friendly
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
        }).addTo(map);

        // Hinojares marker (home)
        const homeIcon = L.divIcon({
            html: `<div style="background:${COLORS.primary};color:white;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 2px 8px rgba(0,0,0,0.3);border:3px solid white;">🏠</div>`,
            className: '',
            iconSize: [36, 36],
            iconAnchor: [18, 18],
        });

        L.marker([37.7825, -2.9920], { icon: homeIcon })
            .addTo(map)
            .bindPopup(`
                <div style="text-align:center;font-family:serif;">
                    <strong style="color:${COLORS.primary}">Tío José María</strong><br/>
                    <span style="font-size:12px;color:#666;">Hinojares, Jaén</span>
                </div>
            `);

        mapInstanceRef.current = map;

        return () => {
            map.remove();
            mapInstanceRef.current = null;
        };
    }, [compact]);

    // Draw routes
    useEffect(() => {
        const map = mapInstanceRef.current;
        if (!map || !routes?.length) return;

        // Clear previous
        polylinesRef.current.forEach(p => map.removeLayer(p));
        markersRef.current.forEach(m => map.removeLayer(m));
        polylinesRef.current = [];
        markersRef.current = [];

        routes.forEach((route) => {
            if (!route.coordinates?.length) return;

            const coords = route.coordinates.map(c => [c.lat, c.lng]);
            const isSelected = selectedRoute?.id === route.id;
            const color = DIFFICULTY_COLORS[route.difficulty] || COLORS.primary;

            // Polyline
            const polyline = L.polyline(coords, {
                color: isSelected ? COLORS.primary : color,
                weight: isSelected ? 5 : 3,
                opacity: selectedRoute && !isSelected ? 0.3 : 0.85,
                dashArray: isSelected ? null : '8 4',
            }).addTo(map);

            polyline.on('click', () => onSelectRoute?.(route));
            polylinesRef.current.push(polyline);

            // Start marker
            const markerIcon = L.divIcon({
                html: `<div style="
                    background:white;
                    color:${color};
                    width:${isSelected ? 32 : 26}px;
                    height:${isSelected ? 32 : 26}px;
                    border-radius:50%;
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    font-size:${isSelected ? 16 : 13}px;
                    box-shadow:0 2px 6px rgba(0,0,0,0.25);
                    border:2px solid ${color};
                    transition:all 0.3s;
                    cursor:pointer;
                ">${DIFFICULTY_ICONS[route.difficulty] || '📍'}</div>`,
                className: '',
                iconSize: [isSelected ? 32 : 26, isSelected ? 32 : 26],
                iconAnchor: [isSelected ? 16 : 13, isSelected ? 16 : 13],
            });

            const marker = L.marker(coords[0], { icon: markerIcon }).addTo(map);
            marker.on('click', () => onSelectRoute?.(route));

            if (!compact) {
                marker.bindTooltip(route.title, {
                    permanent: false,
                    direction: 'top',
                    offset: [0, -14],
                    className: 'route-tooltip',
                });
            }

            markersRef.current.push(marker);
        });

        // Fit bounds if no route selected
        if (!selectedRoute && polylinesRef.current.length > 0) {
            const group = L.featureGroup(polylinesRef.current);
            map.fitBounds(group.getBounds().pad(0.15));
        }
    }, [routes, selectedRoute, onSelectRoute, compact]);

    // Fly to selected route
    useEffect(() => {
        const map = mapInstanceRef.current;
        if (!map || !selectedRoute?.coordinates?.length) return;

        const coords = selectedRoute.coordinates.map(c => [c.lat, c.lng]);
        const bounds = L.latLngBounds(coords);
        map.flyToBounds(bounds.pad(0.3), { duration: 0.8 });
    }, [selectedRoute]);

    return (
        <div
            ref={mapRef}
            className="w-full rounded-2xl overflow-hidden"
            style={{ height: compact ? '300px' : '100%', minHeight: compact ? '300px' : '500px' }}
        />
    );
};

export default InteractiveMap;
