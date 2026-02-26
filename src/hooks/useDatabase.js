import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useWebConfig() {
    const [config, setConfig] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchConfig = async () => {
            const { data, error } = await supabase.from('web_config').select('*');
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

    return { config, loading };
}

export function useApartment(slug) {
    const [apartment, setApartment] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!slug) return;
        const fetchApartment = async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from('apartments')
                .select('*')
                .eq('slug', slug)
                .single();
            if (data) setApartment(data);
            setLoading(false);
        };

        fetchApartment();
    }, [slug]);

    return { apartment, loading };
}

export function useApartments() {
    const [apartments, setApartments] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchApartments = async () => {
            const { data, error } = await supabase.from('apartments').select('*').order('id');
            if (data) setApartments(data);
            setLoading(false);
        };

        fetchApartments();
    }, []);

    return { apartments, loading };
}

export function useReviews() {
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchReviews = async () => {
            const { data, error } = await supabase.from('reviews').select('*').eq('active', true).order('created_at', { ascending: false });
            if (data) setReviews(data);
            setLoading(false);
        };

        fetchReviews();
    }, []);

    return { reviews, loading };
}
export function useLocalPlaces() {
    const [places, setPlaces] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPlaces = async () => {
            const { data } = await supabase.from('local_places').select('*').order('type');
            if (data) setPlaces(data);
            setLoading(false);
        };
        fetchPlaces();
    }, []);

    return { places, loading };
}

export function useRoutes() {
    const [routes, setRoutes] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchRoutes = async () => {
            const { data } = await supabase.from('routes').select('*').order('id');
            if (data) setRoutes(data);
            setLoading(false);
        };
        fetchRoutes();
    }, []);

    return { routes, loading };
}
