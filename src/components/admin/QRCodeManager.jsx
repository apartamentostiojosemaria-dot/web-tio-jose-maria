import React, { useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';

import { QrCode, Wifi, DoorOpen, Mountain, Calendar, Star, Printer, Link, Download } from 'lucide-react';

const BASE_URL = 'https://tiojosemaria.com';

const PRESET_QR_CODES = [
    {
        id: 'wifi-welcome',
        title: 'WiFi + Bienvenida',
        description: 'Pack de bienvenida con datos WiFi, normas y recomendaciones. Ideal para la nevera.',
        location: 'Nevera',
        path: '/clientes#bienvenida',
        icon: Wifi,
    },
    {
        id: 'checkin',
        title: 'Instrucciones de Check-in',
        description: 'Guía paso a paso para la entrada al apartamento. Para colocar en la puerta.',
        location: 'Puerta',
        path: '/clientes#checkin',
        icon: DoorOpen,
    },
    {
        id: 'hiking',
        title: 'Rutas de Senderismo',
        description: 'Mapa interactivo con rutas por la Sierra. Perfecto para la terraza o zona común.',
        location: 'Terraza / Zona Común',
        path: '/rutas',
        icon: Mountain,
    },
    {
        id: 'events',
        title: 'Eventos Locales',
        description: 'Agenda de eventos y actividades del pueblo y alrededores. Para el salón.',
        location: 'Salón',
        path: '/eventos',
        icon: Calendar,
    },
    {
        id: 'review',
        title: 'Déjanos tu Opinión',
        description: 'Enlace directo para dejar una reseña al finalizar la estancia.',
        location: 'Checkout',
        path: '/clientes#review',
        icon: Star,
    },
];

const QRCard = ({ title, description, location, url, icon: Icon, color }) => {
    const qrRef = useRef(null);

    const handlePrint = () => {
        const printWindow = window.open('', '_blank', 'width=600,height=800');
        if (!printWindow) return;

        const svgElement = qrRef.current?.querySelector('svg');
        if (!svgElement) return;

        const svgData = new XMLSerializer().serializeToString(svgElement);

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${title} - Tío José María</title>
                <style>
                    /* Sin Google Fonts: usa fuentes del sistema en la impresión de QR del admin. */
                    * { margin: 0; padding: 0; box-sizing: border-box; }

                    body {
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        min-height: 100vh;
                        background: #fff;
                        font-family: 'Inter', sans-serif;
                    }

                    .qr-print-card {
                        width: 340px;
                        border: 3px solid ${color};
                        border-radius: 24px;
                        padding: 40px 32px 32px;
                        text-align: center;
                        position: relative;
                    }

                    .qr-print-card::before {
                        content: '';
                        position: absolute;
                        inset: 6px;
                        border: 1.5px solid ${color}33;
                        border-radius: 18px;
                        pointer-events: none;
                    }

                    .brand {
                        font-family: 'Playfair Display', serif;
                        font-size: 22px;
                        font-weight: 700;
                        color: ${color};
                        margin-bottom: 4px;
                        letter-spacing: -0.3px;
                    }

                    .brand-sub {
                        font-size: 9px;
                        text-transform: uppercase;
                        letter-spacing: 3px;
                        color: #8C8468;
                        margin-bottom: 28px;
                        font-weight: 600;
                    }

                    .qr-wrapper {
                        display: inline-block;
                        padding: 16px;
                        background: #fff;
                        border-radius: 16px;
                        margin-bottom: 24px;
                    }

                    .qr-wrapper svg {
                        display: block;
                    }

                    .title {
                        font-family: 'Playfair Display', serif;
                        font-size: 18px;
                        font-weight: 700;
                        color: #2C3319;
                        margin-bottom: 6px;
                    }

                    .description {
                        font-size: 12px;
                        color: #666;
                        line-height: 1.5;
                        margin-bottom: 16px;
                    }

                    .location-badge {
                        display: inline-block;
                        background: ${color}15;
                        color: ${color};
                        font-size: 10px;
                        font-weight: 600;
                        text-transform: uppercase;
                        letter-spacing: 1.5px;
                        padding: 6px 16px;
                        border-radius: 100px;
                    }

                    .url-hint {
                        margin-top: 20px;
                        font-size: 10px;
                        color: #aaa;
                        word-break: break-all;
                    }

                    @media print {
                        body { background: #fff; }
                        .qr-print-card { box-shadow: none; }
                    }
                </style>
            </head>
            <body>
                <div class="qr-print-card">
                    <div class="brand">Tio Jose Maria</div>
                    <div class="brand-sub">Apartamentos Rurales</div>
                    <div class="qr-wrapper">${svgData}</div>
                    <div class="title">${title}</div>
                    <div class="description">${description}</div>
                    <div class="location-badge">${location}</div>
                    <div class="url-hint">${url}</div>
                </div>
            </body>
            </html>
        `);

        printWindow.document.close();
        printWindow.onload = () => {
            setTimeout(() => {
                printWindow.print();
            }, 500);
        };
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow duration-300">
            {/* Header strip */}
            <div
                className="h-2 w-full"
                style={{ background: `linear-gradient(90deg, ${color}, ${color}88)` }}
            />

            <div className="p-6">
                {/* Icon + title row */}
                <div className="flex items-start gap-3 mb-4">
                    <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${color}15` }}
                    >
                        <Icon size={20} style={{ color }} />
                    </div>
                    <div className="min-w-0">
                        <h3 className="font-serif font-bold text-base text-text-primary">
                            {title}
                        </h3>
                        <span
                            className="text-[10px] uppercase tracking-widest font-semibold text-secondary"
                        >
                            {location}
                        </span>
                    </div>
                </div>

                {/* QR Code with decorative frame */}
                <div className="flex justify-center my-5">
                    <div
                        ref={qrRef}
                        className="relative p-4 rounded-2xl"
                        style={{
                            border: `2px solid ${color}30`,
                            background: `linear-gradient(135deg, ${color}05, ${color}10)`,
                        }}
                    >
                        {/* Corner decorations */}
                        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 rounded-tl-lg" style={{ borderColor: color }} />
                        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 rounded-tr-lg" style={{ borderColor: color }} />
                        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 rounded-bl-lg" style={{ borderColor: color }} />
                        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 rounded-br-lg" style={{ borderColor: color }} />

                        <QRCodeSVG
                            value={url}
                            size={160}
                            fgColor={color}
                            bgColor="transparent"
                            level="H"
                            includeMargin={false}
                        />
                    </div>
                </div>

                {/* Description */}
                <p className="text-sm text-gray-500 leading-relaxed mb-4 text-center">
                    {description}
                </p>

                {/* URL preview */}
                <div
                    className="text-[11px] text-center px-3 py-2 rounded-lg mb-4 font-mono truncate bg-surface-warm text-secondary"
                >
                    {url}
                </div>

                {/* Print button */}
                <button
                    onClick={handlePrint}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90 active:scale-[0.98]"
                    style={{ backgroundColor: color }}
                >
                    <Printer size={16} />
                    Imprimir QR
                </button>
            </div>
        </div>
    );
};

const QRCodeManager = () => {
    const [customUrl, setCustomUrl] = useState('');
    const [customTitle, setCustomTitle] = useState('');
    const [customDescription, setCustomDescription] = useState('');
    const [customLocation, setCustomLocation] = useState('');
    const [showCustom, setShowCustom] = useState(false);

    return (
        <div>
            {/* Header */}
            <header className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10"
                    >
                        <QrCode size={22} className="text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-serif font-bold text-text-primary">
                            Codigos QR
                        </h1>
                        <p className="text-sm text-gray-400">
                            Genera e imprime codigos QR para colocar en los apartamentos
                        </p>
                    </div>
                </div>
            </header>

            {/* Info banner */}
            <div
                className="mb-8 p-4 rounded-2xl border flex items-start gap-3 bg-primary/5 border-primary/15"
            >
                <QrCode size={20} className="flex-shrink-0 mt-0.5 text-primary" />
                <div>
                    <p className="text-sm font-semibold text-text-primary">
                        Como funciona
                    </p>
                    <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                        Cada codigo QR enlaza a una seccion especifica de la web. Imprimelos y colocalos
                        en las ubicaciones indicadas (nevera, puerta, terraza...) para que los huespedes
                        accedan facilmente a la informacion desde su movil.
                    </p>
                </div>
            </div>

            {/* QR Grid */}
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
                {PRESET_QR_CODES.map((qr) => (
                    <QRCard
                        key={qr.id}
                        title={qr.title}
                        description={qr.description}
                        location={qr.location}
                        url={`${BASE_URL}${qr.path}`}
                        icon={qr.icon}
                        color="#556B2F"
                    />
                ))}

                {/* Custom URL card - toggle */}
                {showCustom && customUrl && (
                    <QRCard
                        title={customTitle || 'Enlace Personalizado'}
                        description={customDescription || 'Codigo QR con enlace personalizado.'}
                        location={customLocation || 'Personalizado'}
                        url={customUrl.startsWith('http') ? customUrl : `${BASE_URL}${customUrl}`}
                        icon={Link}
                        color="#556B2F"
                    />
                )}
            </div>

            {/* Custom URL Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <button
                    onClick={() => setShowCustom(!showCustom)}
                    className="flex items-center gap-3 w-full text-left"
                >
                    <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10"
                    >
                        <Link size={20} className="text-primary" />
                    </div>
                    <div className="flex-grow">
                        <h3 className="font-serif font-bold text-text-primary">
                            QR Personalizado
                        </h3>
                        <p className="text-sm text-gray-400">Crea un codigo QR con cualquier URL</p>
                    </div>
                    <span
                        className="text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg text-primary bg-primary/10"
                    >
                        {showCustom ? 'Ocultar' : 'Abrir'}
                    </span>
                </button>

                {showCustom && (
                    <div className="mt-6 pt-6 border-t border-gray-50 grid md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                                Titulo
                            </label>
                            <input
                                type="text"
                                value={customTitle}
                                onChange={(e) => setCustomTitle(e.target.value)}
                                placeholder="Ej: Menu del Restaurante"
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                                Ubicacion
                            </label>
                            <input
                                type="text"
                                value={customLocation}
                                onChange={(e) => setCustomLocation(e.target.value)}
                                placeholder="Ej: Cocina"
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition-shadow"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                                Descripcion
                            </label>
                            <input
                                type="text"
                                value={customDescription}
                                onChange={(e) => setCustomDescription(e.target.value)}
                                placeholder="Breve descripcion de para que sirve este QR"
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition-shadow"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                                URL
                            </label>
                            <input
                                type="text"
                                value={customUrl}
                                onChange={(e) => setCustomUrl(e.target.value)}
                                placeholder="https://tiojosemaria.com/... o ruta relativa /pagina"
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition-shadow font-mono"
                            />
                            <p className="text-xs text-gray-400 mt-2">
                                Introduce una URL completa o una ruta relativa (se anadira {BASE_URL} automaticamente).
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Print all section */}
            <div className="mt-8 text-center">
                <button
                    onClick={() => {
                        // Open a window with all QR codes for batch printing
                        const printWindow = window.open('', '_blank', 'width=800,height=1000');
                        if (!printWindow) return;

                        const allQrs = [...PRESET_QR_CODES];
                        const qrHtml = allQrs.map(qr => {
                            const url = `${BASE_URL}${qr.path}`;
                            return `
                                <div class="qr-item">
                                    <div class="brand">Tio Jose Maria</div>
                                    <div class="brand-sub">Apartamentos Rurales</div>
                                    <div class="qr-placeholder" data-url="${url}" data-color="#556B2F"></div>
                                    <div class="title">${qr.title}</div>
                                    <div class="location">${qr.location}</div>
                                </div>
                            `;
                        }).join('');

                        printWindow.document.write(`
                            <!DOCTYPE html>
                            <html>
                            <head>
                                <title>Todos los QR - Tio Jose Maria</title>
                                <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"><\/script>
                                <style>
                                    /* Sin Google Fonts: fuentes del sistema en la impresión. */
                                    * { margin: 0; padding: 0; box-sizing: border-box; }
                                    body { font-family: 'Inter', sans-serif; padding: 20px; }
                                    .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; }
                                    .qr-item {
                                        border: 2px solid #556B2F;
                                        border-radius: 20px;
                                        padding: 28px 20px 20px;
                                        text-align: center;
                                        page-break-inside: avoid;
                                        position: relative;
                                    }
                                    .qr-item::before {
                                        content: '';
                                        position: absolute;
                                        inset: 5px;
                                        border: 1px solid #556B2F33;
                                        border-radius: 15px;
                                        pointer-events: none;
                                    }
                                    .brand { font-family: 'Playfair Display', serif; font-size: 18px; font-weight: 700; color: #556B2F; }
                                    .brand-sub { font-size: 8px; text-transform: uppercase; letter-spacing: 3px; color: #8C8468; margin-bottom: 16px; font-weight: 600; }
                                    .qr-placeholder canvas { display: block; margin: 0 auto 16px; }
                                    .title { font-family: 'Playfair Display', serif; font-size: 15px; font-weight: 700; color: #2C3319; margin-bottom: 4px; }
                                    .location { font-size: 9px; text-transform: uppercase; letter-spacing: 2px; color: #556B2F; font-weight: 600; }
                                    @media print {
                                        body { padding: 10px; }
                                        .grid { gap: 16px; }
                                    }
                                </style>
                            </head>
                            <body>
                                <div class="grid">${qrHtml}</div>
                                <script>
                                    document.querySelectorAll('.qr-placeholder').forEach(el => {
                                        const canvas = document.createElement('canvas');
                                        QRCode.toCanvas(canvas, el.dataset.url, {
                                            width: 140,
                                            color: { dark: el.dataset.color, light: '#00000000' },
                                            errorCorrectionLevel: 'H'
                                        }, () => {});
                                        el.appendChild(canvas);
                                    });
                                    setTimeout(() => window.print(), 1000);
                                <\/script>
                            </body>
                            </html>
                        `);
                        printWindow.document.close();
                    }}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90 active:scale-[0.98] bg-primary"
                >
                    <Printer size={18} />
                    Imprimir Todos los QR
                </button>
                <p className="text-xs text-gray-400 mt-2">
                    Abre una ventana con todos los codigos QR listos para imprimir en una sola pagina
                </p>
            </div>
        </div>
    );
};

export default QRCodeManager;
