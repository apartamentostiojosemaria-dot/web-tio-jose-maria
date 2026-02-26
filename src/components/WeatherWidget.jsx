import React, { useState, useEffect } from 'react';
import { Sun, Cloud, CloudRain, CloudLightning, CloudSnow, Wind, Droplets } from 'lucide-react';
import { COLORS } from '../App';

const WEATHER_ICONS = {
    0: { icon: Sun, label: 'Despejado', color: '#FDB813' },
    1: { icon: Sun, label: 'Principalmente despejado', color: '#FDB813' },
    2: { icon: Cloud, label: 'Parcialmente nublado', color: '#94a3b8' },
    3: { icon: Cloud, label: 'Nublado', color: '#64748b' },
    45: { icon: Cloud, label: 'Niebla', color: '#cbd5e1' },
    48: { icon: Cloud, label: 'Niebla escarcha', color: '#cbd5e1' },
    51: { icon: CloudRain, label: 'Llovizna leve', color: '#60a5fa' },
    53: { icon: CloudRain, label: 'Llovizna moderada', color: '#3b82f6' },
    55: { icon: CloudRain, label: 'Llovizna densa', color: '#2563eb' },
    61: { icon: CloudRain, label: 'Lluvia leve', color: '#60a5fa' },
    63: { icon: CloudRain, label: 'Lluvia moderada', color: '#3b82f6' },
    65: { icon: CloudRain, label: 'Lluvia fuerte', color: '#1d4ed8' },
    71: { icon: CloudSnow, label: 'Nieve leve', color: '#f8fafc' },
    73: { icon: CloudSnow, label: 'Nieve moderada', color: '#f8fafc' },
    75: { icon: CloudSnow, label: 'Nieve fuerte', color: '#f8fafc' },
    80: { icon: CloudRain, label: 'Chubascos leves', color: '#60a5fa' },
    81: { icon: CloudRain, label: 'Chubascos moderados', color: '#3b82f6' },
    82: { icon: CloudRain, label: 'Chubascos violentos', color: '#1d4ed8' },
    95: { icon: CloudLightning, label: 'Tormenta', color: '#fbbf24' },
};

const WeatherWidget = ({ isMinimal = false, stayDates = null }) => {
    const [weather, setWeather] = useState(null);
    const [loading, setLoading] = useState(true);

    // Coordenadas de Hinojares, Jaén
    const LAT = 37.7167;
    const LON = -2.9;

    useEffect(() => {
        const fetchWeather = async () => {
            try {
                let url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`;

                // Si hay fechas de estancia y están en un rango razonable (máx 16 días en el futuro)
                if (stayDates?.check_in && stayDates?.check_out) {
                    const checkIn = new Date(stayDates.check_in);
                    const now = new Date();
                    const diffDays = Math.ceil((checkIn - now) / (1000 * 60 * 60 * 24));

                    if (diffDays >= 0 && diffDays <= 14) {
                        url += `&start_date=${stayDates.check_in}&end_date=${stayDates.check_out}`;
                    }
                }

                const response = await fetch(url);
                const data = await response.json();
                setWeather(data);
            } catch (error) {
                console.error('Error fetching weather:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchWeather();
    }, [stayDates]);

    if (loading) return null;
    if (!weather) return null;

    const current = weather.current;
    const weatherConfig = WEATHER_ICONS[current.weather_code] || WEATHER_ICONS[0];
    const Icon = weatherConfig.icon;

    // Si estamos mostrando fechas de estancia, filtramos la predicción diaria
    const displayDays = weather.daily.time;
    const showStayTitle = stayDates?.check_in && displayDays.length > 0;

    if (isMinimal) {
        return (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 backdrop-blur-md rounded-full border border-white/20 text-white text-xs font-bold">
                <Icon size={14} style={{ color: weatherConfig.color }} />
                <span>Hinojares: {Math.round(current.temperature_2m)}°C</span>
            </div>
        );
    }

    return (
        <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm overflow-hidden relative group">
            <div className="flex justify-between items-start relative z-10">
                <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-rural-400 mb-1 block">
                        {showStayTitle ? 'Tu estancia en Hinojares' : 'El tiempo en Hinojares'}
                    </span>
                    <div className="flex items-end gap-2">
                        <span className="text-4xl font-serif font-bold text-rural-900">{Math.round(current.temperature_2m)}°</span>
                        <span className="text-sm text-gray-400 pb-1 italic">{weatherConfig.label}</span>
                    </div>
                </div>
                <div className="p-3 bg-rural-50 rounded-2xl group-hover:scale-110 transition-transform duration-500">
                    <Icon size={32} style={{ color: weatherConfig.color }} />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-gray-50">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-500">
                        <Droplets size={16} />
                    </div>
                    <div>
                        <span className="block text-[10px] uppercase font-bold text-gray-400">Humedad</span>
                        <span className="text-sm font-bold text-rural-900">{current.relative_humidity_2m}%</span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-rural-50 flex items-center justify-center text-rural-600">
                        <Wind size={16} />
                    </div>
                    <div>
                        <span className="block text-[10px] uppercase font-bold text-gray-400">Viento</span>
                        <span className="text-sm font-bold text-rural-900">{Math.round(current.wind_speed_10m)} km/h</span>
                    </div>
                </div>
            </div>

            <div className={`flex justify-between mt-6 pt-6 border-t border-gray-50 overflow-x-auto scrollbar-hide gap-4`}>
                {displayDays.slice(showStayTitle ? 0 : 1, showStayTitle ? 5 : 4).map((time, i) => {
                    const actualIdx = showStayTitle ? i : i + 1;
                    const code = weather.daily.weather_code[actualIdx];
                    const dailyConfig = WEATHER_ICONS[code] || WEATHER_ICONS[0];
                    const DailyIcon = dailyConfig.icon;
                    const date = new Date(time);
                    const dayName = date.toLocaleDateString('es-ES', { weekday: 'short' });

                    return (
                        <div key={i} className="text-center min-w-[50px]">
                            <span className="block text-[10px] uppercase font-bold text-gray-400 mb-2">{dayName}</span>
                            <DailyIcon size={20} className="mx-auto mb-2" style={{ color: dailyConfig.color }} />
                            <span className="text-xs font-bold text-rural-900">{Math.round(weather.daily.temperature_2m_max[actualIdx])}°</span>
                        </div>
                    );
                })}
            </div>

            {/* Sutil gradiente de fondo decorativo */}
            <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-rural-50 rounded-full blur-3xl opacity-50 group-hover:opacity-100 transition-opacity" />
        </div>
    );
};

export default WeatherWidget;
