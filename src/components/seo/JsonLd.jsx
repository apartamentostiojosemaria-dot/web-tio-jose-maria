import { useEffect } from 'react';

const JsonLd = ({ data }) => {
    useEffect(() => {
        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.text = JSON.stringify(data);
        // Usa @id si existe para evitar colisiones (p.ej. dos LodgingBusiness)
        script.id = `jsonld-${data['@id'] || data['@type'] || 'generic'}`;

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

// El LodgingBusiness base esta inyectado estatico en index.html para que sea
// visible a todos los rastreadores sin JS. Aqui solo añadimos los datos
// dinamicos (reviews + rango de precios real) como un nodo complementario.
export const HomeJsonLd = ({ reviews, apartments }) => {
    const priceRange = apartments.length > 0
        ? `${Math.min(...apartments.map(a => Number(a.price_low) || 60))}€ - ${Math.max(...apartments.map(a => Number(a.price_high) || 110))}€`
        : '60€ - 110€';

    const data = {
        '@context': 'https://schema.org',
        '@type': 'LodgingBusiness',
        '@id': 'https://tiojosemaria.com/#lodging',
        name: 'Apartamentos Rurales Tío José María',
        url: 'https://tiojosemaria.com',
        priceRange,
        numberOfRooms: apartments.length || 4,
    };

    // Solo emitimos AggregateRating si hay reseñas REALES en BD. Inventar un rating
    // (p.ej. 4.75/1) es structured data engañoso y arriesga una acción manual de Google.
    if (reviews.length > 0) {
        const avgRating = reviews.reduce((sum, r) => sum + (parseFloat(r.rating) || 5), 0) / reviews.length;
        data.aggregateRating = {
            '@type': 'AggregateRating',
            ratingValue: avgRating.toFixed(1),
            bestRating: '5',
            worstRating: '1',
            reviewCount: String(reviews.length)
        };
    }

    return <JsonLd data={data} />;
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

export const TouristDestinationJsonLd = () => {
    const data = {
        '@context': 'https://schema.org',
        '@type': 'TouristDestination',
        '@id': 'https://tiojosemaria.com/hinojares#destination',
        name: 'Hinojares',
        alternateName: ['Hins-Nojar', 'Traxinum'],
        description: 'Hinojares es el municipio más pequeño de la provincia de Jaén, con unos 343 habitantes y 2.500 años de historia. Ubicado en la Sierra de Cazorla, conserva tres barrios históricos: Barrio Bajo, Barrio Alto y Cuevas Nuevas.',
        url: 'https://tiojosemaria.com/hinojares',
        image: 'https://tiojosemaria.com/og-default.jpg',
        geo: {
            '@type': 'GeoCoordinates',
            latitude: 37.7167,
            longitude: -2.9
        },
        address: {
            '@type': 'PostalAddress',
            addressLocality: 'Hinojares',
            addressRegion: 'Jaén',
            postalCode: '23486',
            addressCountry: 'ES'
        },
        containedInPlace: {
            '@type': 'AdministrativeArea',
            name: 'Sierra de Cazorla, Segura y Las Villas'
        },
        touristType: ['Cultural', 'Naturaleza', 'Gastronómico', 'Rural']
    };
    return <JsonLd data={data} />;
};

const ROUTE_DIFFICULTY_MAP = {
    'Facil': 'easy',
    'Media': 'moderate',
    'Media-Alta': 'difficult',
    'Alta': 'difficult',
};

export const RoutesListJsonLd = ({ routes }) => {
    if (!routes || routes.length === 0) return null;

    const data = {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        '@id': 'https://tiojosemaria.com/rutas#list',
        name: 'Rutas y Excursiones cerca de Hinojares',
        description: 'Senderos, cascadas y pueblos con encanto en la Sierra de Cazorla, desde la puerta de Apartamentos Tío José María.',
        numberOfItems: routes.length,
        itemListElement: routes.map((route, i) => {
            const additionalProperty = [];
            if (route.distance_km) {
                additionalProperty.push({ '@type': 'PropertyValue', name: 'Distancia', value: `${route.distance_km} km`, unitText: 'kilometer' });
            }
            if (route.duration) {
                additionalProperty.push({ '@type': 'PropertyValue', name: 'Duración', value: route.duration });
            }
            if (route.difficulty) {
                additionalProperty.push({ '@type': 'PropertyValue', name: 'Dificultad', value: route.difficulty });
            }
            if (route.elevation_gain) {
                additionalProperty.push({ '@type': 'PropertyValue', name: 'Desnivel positivo', value: `${route.elevation_gain} m`, unitText: 'meter' });
            }

            const item = {
                '@type': 'TouristAttraction',
                name: route.title,
                description: route.description,
                image: route.image_url || undefined,
                url: route.map_url || `https://tiojosemaria.com/rutas#ruta-${route.id}`,
                touristType: ROUTE_DIFFICULTY_MAP[route.difficulty] || 'moderate',
                isAccessibleForFree: true
            };

            if (route.start_lat && route.start_lon) {
                item.geo = {
                    '@type': 'GeoCoordinates',
                    latitude: route.start_lat,
                    longitude: route.start_lon
                };
            }

            if (additionalProperty.length) {
                item.additionalProperty = additionalProperty;
            }

            return {
                '@type': 'ListItem',
                position: i + 1,
                item
            };
        })
    };
    return <JsonLd data={data} />;
};

const SEASON_DATES = {
    primavera: { start: '03-21', end: '06-20' },
    verano: { start: '06-21', end: '09-20' },
    otoño: { start: '09-21', end: '12-20' },
    invierno: { start: '12-21', end: '03-20' },
};

const buildEventDates = (event) => {
    if (event.event_date) {
        return {
            startDate: event.event_date,
            endDate: event.end_date || event.event_date
        };
    }
    // Recurrente sin fecha exacta: aproxima por estacion en el año actual
    const season = SEASON_DATES[event.season];
    if (!season) return {};
    const year = new Date().getFullYear();
    return { startDate: `${year}-${season.start}`, endDate: `${year}-${season.end}` };
};

export const EventsListJsonLd = ({ events }) => {
    if (!events || events.length === 0) return null;

    const items = events.map((event, i) => {
        const dates = buildEventDates(event);
        return {
            '@type': 'ListItem',
            position: i + 1,
            item: {
                '@type': 'Event',
                name: event.title,
                description: event.description,
                image: event.image_url || undefined,
                ...dates,
                eventStatus: 'https://schema.org/EventScheduled',
                eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
                location: {
                    '@type': 'Place',
                    name: event.location || 'Hinojares, Sierra de Cazorla',
                    address: {
                        '@type': 'PostalAddress',
                        addressLocality: 'Hinojares',
                        addressRegion: 'Jaén',
                        addressCountry: 'ES'
                    }
                },
                organizer: {
                    '@type': 'Organization',
                    name: 'Apartamentos Rurales Tío José María',
                    url: 'https://tiojosemaria.com'
                }
            }
        };
    });

    const data = {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        '@id': 'https://tiojosemaria.com/eventos#list',
        name: 'Eventos y Experiencias en la Sierra de Cazorla',
        numberOfItems: items.length,
        itemListElement: items
    };
    return <JsonLd data={data} />;
};

// FAQPage — para responder queries naturales en Google + LLMs.
// items = [{ question, answer }]
export const FAQPageJsonLd = ({ items, id }) => {
    if (!items || items.length === 0) return null;
    const data = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        '@id': id,
        mainEntity: items.map(({ question, answer }) => ({
            '@type': 'Question',
            name: question,
            acceptedAnswer: {
                '@type': 'Answer',
                text: answer
            }
        }))
    };
    return <JsonLd data={data} />;
};

// HowTo — para guías paso a paso (ej. cómo llegar a Hinojares).
// steps = [{ name, text, url? }]
export const HowToJsonLd = ({ name, description, steps, totalTime, id, image }) => {
    if (!steps || steps.length === 0) return null;
    const data = {
        '@context': 'https://schema.org',
        '@type': 'HowTo',
        '@id': id,
        name,
        description,
        ...(totalTime && { totalTime }),
        ...(image && { image }),
        step: steps.map((s, i) => ({
            '@type': 'HowToStep',
            position: i + 1,
            name: s.name,
            text: s.text,
            ...(s.url && { url: s.url })
        }))
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
