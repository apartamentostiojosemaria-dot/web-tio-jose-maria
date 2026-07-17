import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, Clock, Calendar, Tag, ArrowRight } from 'lucide-react';
import DOMPurify from 'dompurify';
import { useBlogPost, useBlogPosts } from '../hooks/useDatabase';
import { BreadcrumbJsonLd } from '../components/seo/JsonLd';
import PageHead from '../components/seo/PageHead';
import FadeInUp from '../components/shared/FadeInUp';
import { truncateForMeta } from '../utils/seoMeta';

// Escapar </script> en JSON-LD para evitar XSS si algún campo del post lo contiene
const safeJson = (data) => JSON.stringify(data).replace(/</g, '\\u003c');

const BlogPostJsonLd = ({ post }) => {
    if (!post) return null;
    const data = {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: post.seo_title || post.title,
        description: post.seo_description || post.excerpt,
        image: post.featured_image_url,
        datePublished: post.published_at,
        dateModified: post.updated_at,
        author: {
            '@type': 'Organization',
            name: 'Apartamentos Rurales Tío José María',
            url: 'https://tiojosemaria.com'
        },
        publisher: {
            '@type': 'Organization',
            name: 'Apartamentos Rurales Tío José María',
            url: 'https://tiojosemaria.com',
            logo: { '@type': 'ImageObject', url: 'https://tiojosemaria.com/assets/logo.jpg' }
        },
        mainEntityOfPage: { '@type': 'WebPage', '@id': `https://tiojosemaria.com/blog/${post.slug}` },
        wordCount: (post.content || '').replace(/<[^>]*>/g, '').split(/\s+/).length,
        articleSection: post.category,
        keywords: post.tags?.join(', '),
    };

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: safeJson(data) }}
        />
    );
};

const CATEGORY_LABELS = {
    guia: 'Guía', pueblo: 'Pueblo', naturaleza: 'Naturaleza',
    gastronomia: 'Gastronomía', practico: 'Práctico',
};

const BlogPostDetail = () => {
    const { slug } = useParams();
    const { post, loading } = useBlogPost(slug);
    const { posts: allPosts } = useBlogPosts();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-surface">
                <div className="animate-pulse text-rural-700 font-serif italic">Cargando artículo...</div>
            </div>
        );
    }

    if (!post) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-surface px-6">
                <h1 className="font-serif text-3xl font-bold text-text-primary mb-4">Artículo no encontrado</h1>
                <p className="text-secondary mb-8">Este artículo no existe o no está publicado.</p>
                <Link to="/blog" className="px-6 py-3 bg-primary text-white rounded-full font-bold">Volver al blog</Link>
            </div>
        );
    }

    const relatedPosts = allPosts
        .filter(p => p.id !== post.id && p.category === post.category)
        .slice(0, 3);

    return (
        <div className="min-h-screen bg-white">
            <PageHead
                title={post.seo_title || post.title}
                description={truncateForMeta(post.seo_description || post.excerpt || post.title)}
                path={`/blog/${post.slug}`}
                image={post.featured_image_url}
                type="article"
            />
            <BreadcrumbJsonLd items={[
                { name: 'Inicio', url: 'https://tiojosemaria.com/' },
                { name: 'Blog', url: 'https://tiojosemaria.com/blog' },
                { name: post.title, url: `https://tiojosemaria.com/blog/${post.slug}` }
            ]} />
            <BlogPostJsonLd post={post} />

            {/* Fixed top nav */}
            <nav className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-gray-100 shadow-sm">
                <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between">
                    <Link to="/blog" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:opacity-70 transition-opacity">
                        <ChevronLeft size={16} /> Blog
                    </Link>
                    <Link to="/" className="text-xs font-medium text-secondary hover:text-primary transition-colors">
                        Tío José María
                    </Link>
                </div>
            </nav>

            {/* Hero image */}
            {post.featured_image_url && (
                <div className="relative h-[40vh] min-h-[300px] md:h-[50vh] overflow-hidden">
                    <img
                        src={post.featured_image_url}
                        alt={post.title}
                        className="w-full h-full object-cover"
                        fetchpriority="high"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                </div>
            )}

            {/* Article */}
            <article className="max-w-3xl mx-auto px-6 -mt-20 relative z-10">
                <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
                    {/* Back link */}
                    <Link to="/blog" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:opacity-70 mb-6 transition-opacity">
                        <ChevronLeft size={16} /> Volver al blog
                    </Link>

                    {/* Meta */}
                    <div className="flex flex-wrap items-center gap-3 mb-6">
                        <span className="text-xs font-bold uppercase tracking-widest text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                            {CATEGORY_LABELS[post.category] || post.category}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                            <Calendar size={12} />
                            {post.published_at && new Date(post.published_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </span>
                        {/* "Actualizado el" visible: señal de frescura que la competencia de la
                            zona no muestra (estándar editorial 17-jul). Solo si difiere >30 días. */}
                        {post.updated_at && post.published_at &&
                            (new Date(post.updated_at) - new Date(post.published_at)) > 30 * 86400000 && (
                            <span className="text-xs text-rural-700 font-medium">
                                Actualizado el {new Date(post.updated_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                            </span>
                        )}
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                            <Clock size={12} /> {post.reading_time_min} min de lectura
                        </span>
                    </div>

                    {/* Title */}
                    <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold text-text-primary mb-6 leading-tight">
                        {post.title}
                    </h1>

                    {/* Excerpt */}
                    {post.excerpt && (
                        <p className="text-lg text-secondary leading-relaxed mb-8 border-l-4 border-primary/30 pl-6 italic">
                            {post.excerpt}
                        </p>
                    )}

                    {/* Content */}
                    <div
                        className="prose prose-lg max-w-none
                            [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-text-primary [&_h2]:mt-10 [&_h2]:mb-4
                            [&_h3]:font-serif [&_h3]:text-xl [&_h3]:font-bold [&_h3]:text-text-primary [&_h3]:mt-8 [&_h3]:mb-3
                            [&_p]:text-secondary [&_p]:leading-relaxed [&_p]:mb-4
                            [&_ul]:text-secondary [&_ul]:space-y-2 [&_ul]:ml-4 [&_ul]:list-disc
                            [&_ol]:text-secondary [&_ol]:space-y-2 [&_ol]:ml-4 [&_ol]:list-decimal
                            [&_li]:leading-relaxed
                            [&_a]:text-primary [&_a]:font-bold [&_a]:underline
                            [&_img]:rounded-xl [&_img]:shadow-lg [&_img]:my-6 [&_img]:w-full
                            [&_figure]:my-8 [&_figure]:mx-0
                            [&_figcaption]:text-xs [&_figcaption]:text-gray-400 [&_figcaption]:-mt-4 [&_figcaption]:mb-4 [&_figcaption]:text-center [&_figcaption]:italic
                            [&_table]:w-full [&_table]:my-6 [&_table]:text-sm
                            [&_th]:text-left [&_th]:font-bold [&_th]:text-primary [&_th]:uppercase [&_th]:text-xs [&_th]:tracking-widest [&_th]:border-b-2 [&_th]:border-primary [&_th]:px-3 [&_th]:py-2
                            [&_td]:border-b [&_td]:border-gray-100 [&_td]:px-3 [&_td]:py-2 [&_td]:text-secondary
                            [&_blockquote]:border-l-4 [&_blockquote]:border-primary/30 [&_blockquote]:pl-6 [&_blockquote]:italic [&_blockquote]:text-secondary
                            [&_strong]:text-text-primary"
                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(post.content || '', { ADD_ATTR: ['target', 'rel'] }) }}
                    />

                    {/* Tags */}
                    {post.tags?.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-10 pt-6 border-t border-gray-100">
                            <Tag size={14} className="text-gray-400 mt-0.5" />
                            {post.tags.map(tag => (
                                <span key={tag} className="text-xs font-medium text-secondary bg-gray-100 px-2.5 py-1 rounded-full">
                                    {tag}
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {/* CTA */}
                <FadeInUp>
                    <div className="rounded-2xl p-8 mt-8 text-center bg-primary text-white">
                        <h2 className="font-serif text-2xl md:text-3xl font-bold mb-3">¿Quieres vivir todo esto?</h2>
                        <p className="text-white/80 mb-6 max-w-lg mx-auto">
                            Alójate en Apartamentos Tío José María, en el corazón de Hinojares, y descubre la Sierra de Cazorla desde dentro.
                        </p>
                        <Link to="/" className="inline-flex items-center gap-2 px-8 py-3 bg-white text-primary rounded-full font-bold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all">
                            Ver apartamentos <ArrowRight size={16} />
                        </Link>
                    </div>
                </FadeInUp>

                {/* Related posts */}
                {relatedPosts.length > 0 && (
                    <div className="mt-12 mb-16">
                        <h2 className="font-serif text-2xl font-bold text-text-primary mb-6">También te puede interesar</h2>
                        <div className="grid md:grid-cols-3 gap-6">
                            {relatedPosts.map(p => (
                                <Link key={p.id} to={`/blog/${p.slug}`} className="group">
                                    <article className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
                                        {p.featured_image_url && (
                                            <img src={p.featured_image_url} alt={p.title} className="w-full h-32 object-cover" loading="lazy" />
                                        )}
                                        <div className="p-4">
                                            <h3 className="font-serif font-bold text-sm text-text-primary group-hover:text-primary transition-colors leading-snug">
                                                {p.title}
                                            </h3>
                                            <p className="text-xs text-gray-400 mt-2">{p.reading_time_min} min</p>
                                        </div>
                                    </article>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}
            </article>
        </div>
    );
};

export default BlogPostDetail;
