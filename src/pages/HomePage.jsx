import { useWebConfig, useApartments, useReviews, useLocalPlaces, useRoutes } from '../hooks/useDatabase';
import { HomeJsonLd, BreadcrumbJsonLd } from '../components/seo/JsonLd';
import PageHead from '../components/seo/PageHead';
import { HomePageSkeleton } from '../components/shared/Skeleton';
import Navigation from '../components/home/Navigation';
import HeroSection from '../components/home/HeroSection';
import IntroSection from '../components/home/IntroSection';
import ReviewsSection from '../components/home/ReviewsSection';
import ApartmentsGrid from '../components/home/ApartmentsGrid';
import EntornoSection from '../components/home/EntornoSection';
import GuiaSection from '../components/home/GuiaSection';
import Footer from '../components/home/Footer';
import WhatsAppFab from '../components/home/WhatsAppFab';

const HomePage = () => {
    const { config, loading: configLoading } = useWebConfig();
    const { apartments, loading: aptLoading } = useApartments();
    const { reviews, loading: revLoading } = useReviews();
    const { places, loading: placesLoading } = useLocalPlaces();
    const { routes, loading: routesLoading } = useRoutes();

    if (configLoading || aptLoading || revLoading || placesLoading || routesLoading) {
        return <HomePageSkeleton />;
    }

    return (
        <div className="bg-surface" style={{ fontFamily: '"Lato", sans-serif' }}>
            <PageHead
                title="Apartamentos Rurales en Hinojares, Cazorla"
                description="Reserva en Apartamentos Rurales Tío José María. Alojamiento con encanto en Hinojares, Sierra de Cazorla. Historia, confort y chimenea en una casona del S.XIX."
                path="/"
            />
            <HomeJsonLd reviews={reviews} apartments={apartments} />
            <BreadcrumbJsonLd items={[
                { name: 'Inicio', url: 'https://tiojosemaria.com/' }
            ]} />
            <Navigation />
            <HeroSection
                title={config.hero_title || 'Apartamentos Rurales Tío José María'}
                subtitle={config.hero_subtitle || 'Tu refugio histórico en Cazorla'}
            />
            <IntroSection text={config.intro_text} />
            <ReviewsSection reviews={reviews} />
            <ApartmentsGrid apartments={apartments} />
            <EntornoSection places={places} routes={routes} />
            <GuiaSection />
            <Footer />
            <WhatsAppFab />
        </div>
    );
};

export default HomePage;
