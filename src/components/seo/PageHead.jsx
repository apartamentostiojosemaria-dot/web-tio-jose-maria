import { Helmet } from 'react-helmet-async';

const SITE_NAME = 'Tío José María';
const HOME_TITLE = 'Apartamentos Rurales Tío José María | Hinojares';
const BASE_URL = 'https://tiojosemaria.com';
const DEFAULT_IMAGE = 'https://tiojosemaria.com/og-default.jpg';

const PageHead = ({
    title,
    description,
    path = '/',
    image = DEFAULT_IMAGE,
    type = 'website',
    noindex = false,
}) => {
    const fullTitle = path === '/'
        ? HOME_TITLE
        : `${title} | ${SITE_NAME}`;
    const url = `${BASE_URL}${path}`;

    return (
        <Helmet>
            <title>{fullTitle}</title>
            <meta name="description" content={description} />
            <link rel="canonical" href={url} />
            {noindex && <meta name="robots" content="noindex, nofollow" />}

            {/* Open Graph */}
            <meta property="og:type" content={type} />
            <meta property="og:url" content={url} />
            <meta property="og:title" content={fullTitle} />
            <meta property="og:description" content={description} />
            <meta property="og:image" content={image} />
            <meta property="og:image:width" content="1200" />
            <meta property="og:image:height" content="630" />
            <meta property="og:locale" content="es_ES" />
            <meta property="og:site_name" content={SITE_NAME} />

            {/* Twitter */}
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:title" content={fullTitle} />
            <meta name="twitter:description" content={description} />
            <meta name="twitter:image" content={image} />
        </Helmet>
    );
};

export default PageHead;
