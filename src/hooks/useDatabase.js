import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { logError } from '../utils/logger';

export function useWebConfig() {
    const [config, setConfig] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchConfig = async () => {
            const { data, error } = await supabase.from('web_config').select('*');
            if (error) {
                logError('useWebConfig', error);
                setError(error);
            }
            if (data) {
                const configMap = data.reduce((acc, item) => {
                    acc[item.key] = item.value;
                    return acc;
                }, {});
                setConfig(configMap);
            }
            setLoading(false);
        };

        fetchConfig();
    }, []);

    return { config, loading, error };
}

export function useApartment(slug) {
    const [apartment, setApartment] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!slug) return;
        const fetchApartment = async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from('apartments')
                .select('*')
                .eq('slug', slug)
                .single();
            if (error) {
                logError('useApartment', error);
                setError(error);
            }
            if (data) setApartment(data);
            setLoading(false);
        };

        fetchApartment();
    }, [slug]);

    return { apartment, loading, error };
}

export function useApartments() {
    const [apartments, setApartments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchApartments = async () => {
            const { data, error } = await supabase.from('apartments').select('*').order('id');
            if (error) {
                logError('useApartments', error);
                setError(error);
            }
            if (data) setApartments(data);
            setLoading(false);
        };

        fetchApartments();
    }, []);

    return { apartments, loading, error };
}

export function useReviews() {
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchReviews = async () => {
            const { data, error } = await supabase.from('reviews').select('*').eq('active', true).order('created_at', { ascending: false });
            if (error) {
                logError('useReviews', error);
                setError(error);
            }
            if (data) setReviews(data);
            setLoading(false);
        };

        fetchReviews();
    }, []);

    return { reviews, loading, error };
}

export function useLocalPlaces() {
    const [places, setPlaces] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchPlaces = async () => {
            const { data, error } = await supabase.from('local_places').select('*').order('type');
            if (error) {
                logError('useLocalPlaces', error);
                setError(error);
            }
            if (data) setPlaces(data);
            setLoading(false);
        };
        fetchPlaces();
    }, []);

    return { places, loading, error };
}

export function useRoutes() {
    const [routes, setRoutes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchRoutes = async () => {
            const { data, error } = await supabase.from('routes').select('*').order('id');
            if (error) {
                logError('useRoutes', error);
                setError(error);
            }
            if (data) setRoutes(data);
            setLoading(false);
        };
        fetchRoutes();
    }, []);

    return { routes, loading, error };
}

export function useHighSeasons() {
    const [seasons, setSeasons] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchSeasons = async () => {
            const { data, error } = await supabase.from('high_seasons').select('*').order('start_date', { ascending: true });
            if (error) {
                logError('useHighSeasons', error);
                setError(error);
            }
            if (data) setSeasons(data);
            setLoading(false);
        };
        fetchSeasons();
    }, []);

    return { seasons, loading, error };
}

export function useGuestGuides() {
    const [guides, setGuides] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchGuides = async () => {
            const { data, error } = await supabase.from('guest_guides').select('*').order('order_index', { ascending: true });
            if (error) {
                logError('useGuestGuides', error);
                setError(error);
            }
            if (data) setGuides(data);
            setLoading(false);
        };
        fetchGuides();

        // Suscribirse a cambios en tiempo real
        const subscription = supabase
            .channel('guest_guides_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'guest_guides' }, fetchGuides)
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };
    }, []);

    return { guides, loading, error };
}

export function useGuestBookings(profileId) {
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!profileId) return;
        const fetchBookings = async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from('guest_bookings')
                .select('*')
                .eq('profile_id', profileId)
                .order('check_in', { ascending: false });
            if (error) {
                logError('useGuestBookings', error);
                setError(error);
            }
            if (data) setBookings(data);
            setLoading(false);
        };
        fetchBookings();

        const subscription = supabase
            .channel(`guest_bookings_${profileId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'guest_bookings', filter: `profile_id=eq.${profileId}` }, fetchBookings)
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };
    }, [profileId]);

    return { bookings, loading, error };
}

export function useAllBookings() {
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchBookings = async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from('guest_bookings')
                .select('*, apartments(name, slug)')
                .order('created_at', { ascending: false });
            if (error) {
                logError('useAllBookings', error);
                setError(error);
            }
            if (data) setBookings(data);
            setLoading(false);
        };
        fetchBookings();

        const subscription = supabase
            .channel('all_bookings')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'guest_bookings' }, fetchBookings)
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };
    }, []);

    return { bookings, loading, error };
}

export function usePendingBookingsCount() {
    const [count, setCount] = useState(0);

    useEffect(() => {
        const fetchCount = async () => {
            const { count, error } = await supabase
                .from('guest_bookings')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'pending');
            if (!error) setCount(count || 0);
        };
        fetchCount();

        const subscription = supabase
            .channel('pending_bookings_count')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'guest_bookings' }, fetchCount)
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };
    }, []);

    return count;
}

export function useLocalEvents() {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchEvents = async () => {
            const { data, error } = await supabase
                .from('local_events')
                .select('*')
                .eq('active', true)
                .order('event_date', { ascending: true, nullsFirst: false });
            if (error) {
                logError('useLocalEvents', error);
                setError(error);
            }
            if (data) setEvents(data);
            setLoading(false);
        };
        fetchEvents();
    }, []);

    return { events, loading, error };
}

export function useBlockedDates(apartmentId) {
    const [blockedDates, setBlockedDates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!apartmentId) return;
        const fetchBlockedDates = async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from('blocked_dates')
                .select('*')
                .eq('apartment_id', apartmentId);
            if (error) {
                logError('useBlockedDates', error);
                setError(error);
            }
            if (data) setBlockedDates(data);
            setLoading(false);
        };
        fetchBlockedDates();
    }, [apartmentId]);

    return { blockedDates, loading, error };
}
