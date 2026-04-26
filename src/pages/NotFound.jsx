import { Link } from 'react-router-dom';
import { Home, Map, Calendar, BookOpen } from 'lucide-react';
import PageHead from '../components/seo/PageHead';

const NotFound = () => (
    <div className="min-h-screen flex flex-col bg-surface">
        <PageHead
            title="Página no encontrada"
            description="La página que buscas no existe. Vuelve al inicio o explora rutas, eventos y guías de Hinojares."
            path="/404"
            noindex={true}
        />
        <main className="flex-1 flex items-center justify-center px-6 py-20">
            <div className="max-w-2xl text-center">
                <p className="font-serif text-7xl md:text-9xl font-bold text-primary mb-4">404</p>
                <h1 className="font-serif text-3xl md:text-4xl font-bold text-text-primary mb-4">
                    Esta página no existe
                </h1>
                <p className="text-base md:text-lg text-secondary leading-relaxed mb-10 max-w-lg mx-auto">
                    Puede que el enlace esté roto o que hayamos cambiado la dirección. Vuelve al inicio o sigue explorando Hinojares.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
                    <Link to="/" className="flex flex-col items-center gap-2 p-5 rounded-2xl bg-white border border-gray-100 hover:border-primary hover:shadow-md transition-all">
                        <Home size={20} className="text-primary" />
                        <span className="text-xs md:text-sm font-bold text-text-primary">Inicio</span>
                    </Link>
                    <Link to="/rutas" className="flex flex-col items-center gap-2 p-5 rounded-2xl bg-white border border-gray-100 hover:border-primary hover:shadow-md transition-all">
                        <Map size={20} className="text-primary" />
                        <span className="text-xs md:text-sm font-bold text-text-primary">Rutas</span>
                    </Link>
                    <Link to="/eventos" className="flex flex-col items-center gap-2 p-5 rounded-2xl bg-white border border-gray-100 hover:border-primary hover:shadow-md transition-all">
                        <Calendar size={20} className="text-primary" />
                        <span className="text-xs md:text-sm font-bold text-text-primary">Eventos</span>
                    </Link>
                    <Link to="/blog" className="flex flex-col items-center gap-2 p-5 rounded-2xl bg-white border border-gray-100 hover:border-primary hover:shadow-md transition-all">
                        <BookOpen size={20} className="text-primary" />
                        <span className="text-xs md:text-sm font-bold text-text-primary">Blog</span>
                    </Link>
                </div>
                <Link
                    to="/"
                    className="inline-flex items-center gap-2 px-8 py-3 bg-primary text-white rounded-full font-bold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
                >
                    Volver al inicio
                </Link>
            </div>
        </main>
    </div>
);

export default NotFound;
