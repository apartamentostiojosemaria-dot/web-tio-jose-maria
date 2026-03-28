import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../constants/colors';
import { logError } from '../../utils/logger';
import { BarChart3, Users, Star, TrendingUp, Calendar, Mail } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from 'recharts';

const CHART_COLORS = [COLORS.primary, COLORS.secondary, COLORS.accent, '#7a9a3a', '#b5a77d'];

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const AnalyticsDashboard = () => {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalBookings: 0,
        averageRating: 0,
        totalApartments: 0,
        emailSubscribers: 0,
    });
    const [monthlyBookings, setMonthlyBookings] = useState([]);
    const [ratingsDistribution, setRatingsDistribution] = useState([]);
    const [recentActivity, setRecentActivity] = useState([]);

    useEffect(() => {
        fetchAnalytics();
    }, []);

    const fetchAnalytics = async () => {
        setLoading(true);
        try {
            const [bookingsRes, reviewsRes, apartmentsRes, subscribersRes] = await Promise.all([
                supabase.from('guest_bookings').select('*'),
                supabase.from('reviews').select('*'),
                supabase.from('apartments').select('id', { count: 'exact', head: true }),
                supabase.from('email_subscribers').select('id', { count: 'exact', head: true }),
            ]);

            if (bookingsRes.error) throw bookingsRes.error;
            if (reviewsRes.error) throw reviewsRes.error;

            const bookings = bookingsRes.data || [];
            const reviews = reviewsRes.data || [];
            const apartmentCount = apartmentsRes.count || 0;
            const subscriberCount = subscribersRes.count || 0;

            // Summary stats
            const avgRating = reviews.length > 0
                ? (reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length).toFixed(1)
                : 0;

            setStats({
                totalBookings: bookings.length,
                averageRating: avgRating,
                totalApartments: apartmentCount,
                emailSubscribers: subscriberCount,
            });

            // Monthly bookings chart data
            const monthCounts = {};
            const now = new Date();
            const currentYear = now.getFullYear();
            MONTHS.forEach((m, i) => { monthCounts[i] = 0; });

            bookings.forEach((b) => {
                const date = new Date(b.check_in || b.created_at);
                if (date.getFullYear() === currentYear) {
                    monthCounts[date.getMonth()] = (monthCounts[date.getMonth()] || 0) + 1;
                }
            });

            setMonthlyBookings(
                MONTHS.map((name, i) => ({ name, reservas: monthCounts[i] || 0 }))
            );

            // Ratings distribution
            const ratingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
            reviews.forEach((r) => {
                const rating = Math.round(r.rating || 0);
                if (rating >= 1 && rating <= 5) {
                    ratingCounts[rating]++;
                }
            });

            setRatingsDistribution(
                Object.entries(ratingCounts).map(([star, count]) => ({
                    name: `${star} estrella${star !== '1' ? 's' : ''}`,
                    value: count,
                }))
            );

            // Recent activity feed
            const activities = [];

            bookings.slice(-5).reverse().forEach((b) => {
                activities.push({
                    type: 'booking',
                    text: `Nueva reserva: ${b.guest_name || 'Huésped'}`,
                    date: b.created_at,
                });
            });

            reviews.slice(-5).reverse().forEach((r) => {
                activities.push({
                    type: 'review',
                    text: `Reseña de ${r.author || 'Anónimo'} - ${r.rating} estrellas`,
                    date: r.created_at,
                });
            });

            activities.sort((a, b) => new Date(b.date) - new Date(a.date));
            setRecentActivity(activities.slice(0, 8));

        } catch (error) {
            logError('AnalyticsDashboard', error);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-200" style={{ borderTopColor: COLORS.primary }} />
            </div>
        );
    }

    return (
        <div>
            <header className="mb-10">
                <div className="flex items-center gap-3 mb-1">
                    <BarChart3 size={28} style={{ color: COLORS.primary }} />
                    <h1 className="text-3xl font-serif font-bold" style={{ color: COLORS.text }}>Analítica</h1>
                </div>
                <p className="text-gray-500">Resumen general del rendimiento de tu alojamiento</p>
            </header>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                <SummaryCard
                    icon={<Calendar size={20} />}
                    label="Total Reservas"
                    value={stats.totalBookings}
                    color={COLORS.primary}
                />
                <SummaryCard
                    icon={<Star size={20} />}
                    label="Valoración Media"
                    value={stats.averageRating}
                    color="#e6a817"
                />
                <SummaryCard
                    icon={<Users size={20} />}
                    label="Apartamentos"
                    value={stats.totalApartments}
                    color={COLORS.secondary}
                />
                <SummaryCard
                    icon={<Mail size={20} />}
                    label="Suscriptores Email"
                    value={stats.emailSubscribers}
                    color={COLORS.primary}
                />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
                {/* Monthly Bookings Bar Chart */}
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-2 mb-6">
                        <TrendingUp size={18} style={{ color: COLORS.primary }} />
                        <h2 className="font-serif font-bold text-lg" style={{ color: COLORS.text }}>
                            Reservas por Mes ({new Date().getFullYear()})
                        </h2>
                    </div>
                    <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={monthlyBookings} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#888' }} />
                            <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#888' }} />
                            <Tooltip
                                contentStyle={{
                                    borderRadius: '12px',
                                    border: '1px solid #e5e7eb',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                                }}
                            />
                            <Bar dataKey="reservas" fill={COLORS.primary} radius={[6, 6, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Ratings Distribution Pie Chart */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-2 mb-6">
                        <Star size={18} style={{ color: '#e6a817' }} />
                        <h2 className="font-serif font-bold text-lg" style={{ color: COLORS.text }}>
                            Distribución de Reseñas
                        </h2>
                    </div>
                    <ResponsiveContainer width="100%" height={280}>
                        <PieChart>
                            <Pie
                                data={ratingsDistribution}
                                cx="50%"
                                cy="45%"
                                innerRadius={50}
                                outerRadius={85}
                                paddingAngle={3}
                                dataKey="value"
                            >
                                {ratingsDistribution.map((_, index) => (
                                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{
                                    borderRadius: '12px',
                                    border: '1px solid #e5e7eb',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                                }}
                            />
                            <Legend
                                verticalAlign="bottom"
                                iconType="circle"
                                iconSize={8}
                                wrapperStyle={{ fontSize: '11px' }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Recent Activity Feed */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-2 mb-6">
                    <BarChart3 size={18} style={{ color: COLORS.primary }} />
                    <h2 className="font-serif font-bold text-lg" style={{ color: COLORS.text }}>
                        Actividad Reciente
                    </h2>
                </div>
                {recentActivity.length === 0 ? (
                    <p className="text-gray-400 text-sm py-4 text-center">No hay actividad reciente</p>
                ) : (
                    <div className="space-y-3">
                        {recentActivity.map((activity, index) => (
                            <div
                                key={index}
                                className="flex items-center justify-between py-3 px-4 rounded-xl hover:bg-gray-50 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <div
                                        className="w-8 h-8 rounded-full flex items-center justify-center"
                                        style={{
                                            backgroundColor: activity.type === 'booking' ? `${COLORS.primary}15` : '#e6a81715',
                                        }}
                                    >
                                        {activity.type === 'booking' ? (
                                            <Calendar size={14} style={{ color: COLORS.primary }} />
                                        ) : (
                                            <Star size={14} style={{ color: '#e6a817' }} />
                                        )}
                                    </div>
                                    <span className="text-sm font-medium" style={{ color: COLORS.text }}>
                                        {activity.text}
                                    </span>
                                </div>
                                <span className="text-xs text-gray-400">{formatDate(activity.date)}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const SummaryCard = ({ icon, label, value, color }) => (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
            <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${color}15` }}
            >
                <span style={{ color }}>{icon}</span>
            </div>
        </div>
        <p className="text-xs uppercase tracking-widest font-bold opacity-40 mb-2">{label}</p>
        <p className="text-4xl font-serif font-bold" style={{ color: COLORS.primary }}>{value}</p>
    </div>
);

export default AnalyticsDashboard;
