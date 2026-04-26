import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Clock, Tag, BookOpen, Search } from 'lucide-react';
import { useBlogPosts } from '../hooks/useDatabase';
import { BreadcrumbJsonLd } from '../components/seo/JsonLd';
import PageHead from '../components/seo/PageHead';
import FadeInUp from '../components/shared/FadeInUp';

const CATEGORIES = [
    { key: 'todas', label: 'Todas' },
    { key: 'guia', label: 'Guías' },
    { key: 'pueblo', label: 'Pueblo' },
    { key: 'naturaleza', label: 'Naturaleza' },
    { key: 'gastronomia', label: 'Gastronomia' },
    { key: 'practico', label: 'Practico' },
];

const BlogPage = () => {
    const { posts, loading } = useBlogPosts();
    const [categoryFilter, setCategoryFilter] = useState('todas');
    const [search, setSearch] = useState('');

    const filteredPosts = useMemo(() => {
        return posts.filter(p => {
            const catMatch = categoryFilter === 'todas' || p.category === categoryFilter;
            const searchMatch = !search || p.title.toLowerCase().includes(search.toLowerCase()) || p.excerpt?.toLowerCase().includes(search.toLowerCase());
            return catMatch && searchMatch;
        });
    }, [posts, categoryFilter, search]);

    return (
        <div className="min-h-screen bg-surface">
            <PageHead
                title="Blog — Guía de Hinojares y Sierra de Cazorla"
                description="Guías, consejos y artículos sobre Hinojares, la Sierra de Cazorla, rutas de senderismo, gastronomía local y todo lo que necesitas saber para tu visita."
                path="/blog"
            />
            <BreadcrumbJsonLd items={[
                { name: 'Inicio', url: 'https://tiojosemaria.com/' },
                { name: 'Blog', url: 'https://tiojosemaria.com/blog' }
            ]} />

            {/* Hero */}
            <header className="bg-primary text-white py-16 md:py-24 px-6">
                <div className="max-w-5xl mx-auto">
                    <Link to="/" className="inline-flex items-center gap-1 text-white/70 hover:text-white text-sm font-medium mb-6 transition-colors">
                        <ChevronLeft size={16} /> Volver al inicio
                    </Link>
                    <h1 className="font-serif text-3xl md:text-5xl font-bold mb-4">Guía de Hinojares y Sierra de Cazorla</h1>
                    <p className="text-white/80 text-lg max-w-2xl leading-relaxed">
                        Todo lo que necesitas saber para disfrutar de la comarca: rutas, gastronomía, historia, consejos prácticos y secretos locales.
                    </p>
                </div>
            </header>

            {/* Filters */}
            <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-xl border-b border-gray-100 shadow-sm">
                <div className="max-w-5xl mx-auto px-6 py-3 flex flex-col sm:flex-row gap-3 items-center">
                    <div className="flex gap-1.5 overflow-x-auto flex-1">
                        {CATEGORIES.map(c => (
                            <button
                                key={c.key}
                                onClick={() => setCategoryFilter(c.key)}
                                className={`px-3.5 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
                                    categoryFilter === c.key
                                        ? 'bg-primary text-white border-primary'
                                        : 'bg-white text-text-primary border-gray-200 hover:border-primary/30'
                                }`}
                            >
                                {c.label}
                            </button>
                        ))}
                    </div>
                    <div className="relative w-full sm:w-64">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Buscar articulos..."
                            className="w-full pl-9 pr-4 py-2 rounded-full border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-rural-200"
                        />
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-5xl mx-auto px-6 py-10">
                {loading ? (
                    <div className="flex flex-col items-center py-20">
                        <div className="animate-spin rounded-full h-10 w-10 border-2 border-gray-200 border-t-primary" />
                        <p className="mt-4 text-sm italic text-secondary">Cargando articulos...</p>
                    </div>
                ) : filteredPosts.length === 0 ? (
                    <div className="text-center py-20">
                        <BookOpen size={48} className="mx-auto mb-4 opacity-30 text-secondary" />
                        <p className="font-serif text-xl mb-2 text-text-primary">No hay articulos</p>
                        <p className="text-sm text-secondary">
                            {search ? 'No se encontraron resultados para tu busqueda.' : 'Pronto publicaremos contenido sobre la zona.'}
                        </p>
                    </div>
                ) : (
                    <>
                        <h2 className="sr-only">Articulos del blog</h2>
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                            <AnimatePresence mode="popLayout">
                                {filteredPosts.map((post, idx) => (
                                    <FadeInUp key={post.id} delay={idx * 0.05}>
                                        <Link to={`/blog/${post.slug}`} className="block group">
                                            <article className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-500 group-hover:-translate-y-1">
                                                <div className="h-48 overflow-hidden">
                                                    {post.featured_image_url ? (
                                                        <img src={post.featured_image_url} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" loading="lazy" />
                                                    ) : (
                                                        <div className="w-full h-full bg-surface-warm flex items-center justify-center">
                                                            <BookOpen size={40} className="text-secondary opacity-30" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="p-5">
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <span className="text-[10px] font-bold uppercase tracking-widest text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                                                            {CATEGORIES.find(c => c.key === post.category)?.label || post.category}
                                                        </span>
                                                        <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                                            <Clock size={10} /> {post.reading_time_min} min
                                                        </span>
                                                    </div>
                                                    <h3 className="font-serif font-bold text-lg text-text-primary mb-2 leading-snug group-hover:text-primary transition-colors">
                                                        {post.title}
                                                    </h3>
                                                    {post.excerpt && (
                                                        <p className="text-sm text-secondary line-clamp-2 leading-relaxed">{post.excerpt}</p>
                                                    )}
                                                    <p className="text-xs text-gray-400 mt-3">
                                                        {post.published_at && new Date(post.published_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                                                    </p>
                                                </div>
                                            </article>
                                        </Link>
                                    </FadeInUp>
                                ))}
                            </AnimatePresence>
                        </div>
                    </>
                )}
            </div>

            {/* CTA */}
            <div className="max-w-5xl mx-auto px-6 pb-12">
                <div className="rounded-2xl p-8 text-center bg-surface-warm">
                    <p className="font-serif text-lg md:text-xl mb-2 text-text-primary">Quieres vivir todo esto en primera persona?</p>
                    <p className="text-sm mb-5 text-secondary">Alójate en Apartamentos Tío José María y te ayudamos a planificar tu escapada perfecta.</p>
                    <Link to="/" className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold text-white bg-primary shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5">
                        Ver Apartamentos
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default BlogPage;
