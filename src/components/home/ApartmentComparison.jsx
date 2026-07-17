import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Scale } from 'lucide-react';

/**
 * Mini comparativa "¿Cuál elijo?" — tabla colapsada por defecto que resume
 * los 4 apartamentos en una sola vista para decidir en segundos. Reutiliza
 * los datos ya cargados por ApartmentsGrid, sin fetches propios.
 */
const ApartmentComparison = ({ apartments = [] }) => {
    const [open, setOpen] = useState(false);

    if (!apartments.length) return null;

    return (
        <div className="mt-14 max-w-4xl mx-auto">
            <div className="text-center">
                <button
                    type="button"
                    onClick={() => setOpen(o => !o)}
                    aria-expanded={open}
                    aria-controls="apartment-comparison-table"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-accent text-sm font-bold text-primary hover:bg-accent/20 transition-colors duration-300"
                >
                    <Scale size={16} aria-hidden="true" />
                    {open ? 'Ocultar comparativa' : 'Comparar los 4 apartamentos'}
                    <ChevronDown
                        size={16}
                        className={`transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
                        aria-hidden="true"
                    />
                </button>
            </div>

            {open && (
                <div id="apartment-comparison-table" className="mt-8 bg-white rounded-2xl shadow-lg border border-accent/30 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[560px] text-sm text-left border-collapse">
                            <thead>
                                <tr className="bg-surface-warm text-text-primary">
                                    <th scope="col" className="font-serif font-bold px-5 py-4">Apartamento</th>
                                    <th scope="col" className="font-bold px-5 py-4 whitespace-nowrap">Plazas</th>
                                    <th scope="col" className="font-bold px-5 py-4 whitespace-nowrap">Baños</th>
                                    <th scope="col" className="font-bold px-5 py-4">Ideal para</th>
                                    <th scope="col" className="font-bold px-5 py-4 whitespace-nowrap">Desde €/noche</th>
                                    <th scope="col" className="px-5 py-4"><span className="sr-only">Ver ficha</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {apartments.map((apt) => (
                                    <tr key={apt.name} className="border-t border-accent/20 hover:bg-surface-warm/60 transition-colors">
                                        <td className="px-5 py-4 font-serif font-bold text-text-primary whitespace-nowrap">{apt.name}</td>
                                        <td className="px-5 py-4 text-secondary">{apt.capacityPeople}</td>
                                        <td className="px-5 py-4 text-secondary">{apt.bathrooms}</td>
                                        <td className="px-5 py-4 text-secondary">{apt.badge}</td>
                                        <td className="px-5 py-4 text-secondary whitespace-nowrap">
                                            {apt.priceFrom ? <><span className="font-bold text-text-primary">{apt.priceFrom}€</span></> : '—'}
                                        </td>
                                        <td className="px-5 py-4 text-right whitespace-nowrap">
                                            <Link to={apt.href} className="text-primary font-bold hover:underline">
                                                Ver ficha &rarr;
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ApartmentComparison;
