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
    const avgRating = reviews.length > 0
        ? reviews.reduce((sum, r) => sum + (parseFloat(r.score) || 10), 0) / reviews.length
        : 9.5;

    const priceRange = apartments.length > 0
        ? `${Math.min(...apartments.map(a => a.price_low || 60))}€ - ${Math.max(...apartments.map(a => a.price_high || 90))}€`
        : '60€ - 90€';

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
            ratingValue: (avgRating / 2).toFixed(1),
            bestRating: '5',
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

export const ApartmentJsonLd = ({ apartment, reviews }) => {
    if (!apartment) return null;

    const data = {
        '@context': 'https://schema.org',
        '@type': 'Apartment',
        name: apartment.name,
        description: apartment.description || `Apartamento rural ${apartment.name} en Hinojares, Sierra de Cazorla`,
        url: `https://tiojosemaria.com/apartamento/${apartment.slug}`,
        image: apartment.images?.[0] || 'https://nmtukksbzbnuzqsksdmw.supabase.co/storage/v1/object/public/apartments/website/general/slide3.jpg',
        numberOfRooms: 1,
        numberOfBathroomsTotal: apartment.bathrooms || 1,
        occupancy: {
            '@type': 'QuantitativeValue',
            value: apartment.capacity_people || 2
        },
        floorSize: {
            '@type': 'QuantitativeValue',
            unitCode: 'MTK'
        },
        amenityFeature: (apartment.amenities || []).map(a => ({
            '@type': 'LocationFeatureSpecification',
            name: a,
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
                name: 'Temporada Alta',
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
