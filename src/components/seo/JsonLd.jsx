import { useEffect } from 'react';

const JsonLd = ({ data }) => {
    useEffect(() => {
        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.text = JSON.stringify(data);
        script.id = `jsonld-${data['@type'] || 'generic'}`;

        const existing = document.getElementById(script.id);
        if (existing) existing.remove();

        document.head.appendChild(script);
        return () => {
            const el = document.getElementById(script.id);
            if (el) el.remove();
        };
    }, [data]);

    return null;
};

export const HomeJsonLd = ({ reviews, apartments }) => {
    // Las reviews usan 'rating' (1-5). Si por alguna razon falta, usa 5.
    const avgRating = reviews.length > 0
        ? reviews.reduce((sum, r) => sum + (parseFloat(r.rating) || 5), 0) / reviews.length
        : 4.75;

    const priceRange = apartments.length > 0
        ? `${Math.min(...apartments.map(a => Number(a.price_low) || 60))}€ - ${Math.max(...apartments.map(a => Number(a.price_high) || 110))}€`
        : '60€ - 110€';

    const businessData = {
        '@context': 'https://schema.org',
        '@type': 'LodgingBusiness',
        name: 'Apartamentos Rurales Tío José María',
        description: 'Alojamiento rural con encanto en Hinojares, Sierra de Cazorla. Casa del siglo XVII restaurada con 4 apartamentos exclusivos.',
        url: 'https://tiojosemaria.com',
        telephone: '+34676344675',
        email: 'info@tiojosemaria.com',
        priceRange,
        address: {
            '@type': 'PostalAddress',
            streetAddress: 'Calle Baja 1',
            addressLocality: 'Hinojares',
            addressRegion: 'Jaén',
            postalCode: '23486',
            addressCountry: 'ES'
        },
        geo: {
            '@type': 'GeoCoordinates',
            latitude: 37.7167,
            longitude: -2.9
        },
        image: 'https://nmtukksbzbnuzqsksdmw.supabase.co/storage/v1/object/public/apartments/website/general/slide3.jpg',
        starRating: {
            '@type': 'Rating',
            ratingValue: '4'
        },
        aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: avgRating.toFixed(1),
            bestRating: '5',
            worstRating: '1',
            reviewCount: String(Math.max(reviews.length, 1))
        },
        amenityFeature: [
            { '@type': 'LocationFeatureSpecification', name: 'WiFi Gratis', value: true },
            { '@type': 'LocationFeatureSpecification', name: 'Chimenea', value: true },
            { '@type': 'LocationFeatureSpecification', name: 'Calefacción', value: true },
            { '@type': 'LocationFeatureSpecification', name: 'Cocina equipada', value: true }
        ],
        numberOfRooms: apartments.length || 4,
        petsAllowed: false
    };

    return <JsonLd data={businessData} />;
};

// Mapeo de codigos internos de amenities a nombres humanos para Schema.org
const AMENITY_LABELS = {
    wifi: 'WiFi gratis',
    tv: 'TV de pantalla plana',
    heating: 'Calefacción',
    ac: 'Aire acondicionado',
    fireplace: 'Chimenea de leña',
    kitchen: 'Vitrocerámica y menaje',
    fridge: 'Frigorífico',
    microwave: 'Microondas y tostadora',
    bath: 'Baño con gel y toallas',
    hairdryer: 'Secador de pelo',
    no_pets: 'No se admiten mascotas',
};

// Deduce numero de dormitorios a partir de bed_config o capacidad
const inferBedrooms = (apt) => {
    const cfg = (apt.bed_config || '').toLowerCase();
    if (cfg.includes('individual')) return 2; // matrimonio + 2 individuales = 2 dormitorios
    if (cfg.includes('matrimonio')) return 1;
    return apt.capacity_people && apt.capacity_people > 2 ? 2 : 1;
};

export const ApartmentJsonLd = ({ apartment, reviews }) => {
    if (!apartment) return null;

    const numberOfBedrooms = inferBedrooms(apartment);

    const data = {
        '@context': 'https://schema.org',
        '@type': 'Apartment',
        name: apartment.name,
        description: apartment.description || `Apartamento rural ${apartment.name} en Hinojares, Sierra de Cazorla`,
        url: `https://tiojosemaria.com/apartamento/${apartment.slug}`,
        image: apartment.images?.[0] || 'https://nmtukksbzbnuzqsksdmw.supabase.co/storage/v1/object/public/apartments/website/general/slide3.jpg',
        numberOfBedrooms,
        numberOfBathroomsTotal: apartment.bathrooms || 1,
        occupancy: {
            '@type': 'QuantitativeValue',
            value: apartment.capacity_people || 2,
            unitCode: 'C62'
        },
        amenityFeature: (apartment.amenities || []).map(code => ({
            '@type': 'LocationFeatureSpecification',
            name: AMENITY_LABELS[code] || code,
            value: true
        })),
        containedInPlace: {
            '@type': 'LodgingBusiness',
            name: 'Apartamentos Rurales Tío José María',
            address: {
                '@type': 'PostalAddress',
                streetAddress: 'Calle Baja 1',
                addressLocality: 'Hinojares',
                addressRegion: 'Jaén',
                postalCode: '23486',
                addressCountry: 'ES'
            }
        },
        offers: [
            {
                '@type': 'Offer',
                name: 'Temporada Baja',
                price: String(apartment.price_low || 60),
                priceCurrency: 'EUR',
                unitCode: 'DAY',
                availability: 'https://schema.org/InStock'
            },
            {
                '@type': 'Offer',
                name: 'Temporada Alta (Navidad, Semana Santa y puentes)',
                price: String(apartment.price_high || 70),
                priceCurrency: 'EUR',
                unitCode: 'DAY',
                availability: 'https://schema.org/InStock'
            }
        ]
    };

    return <JsonLd data={data} />;
};

export const BreadcrumbJsonLd = ({ items }) => {
    const data = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: items.map((item, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: item.name,
            item: item.url
        }))
    };

    return <JsonLd data={data} />;
};

export default JsonLd;
