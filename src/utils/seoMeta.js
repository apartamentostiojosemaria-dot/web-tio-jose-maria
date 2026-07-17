// Shared meta-description helper: single place so every page truncates the
// same way (search snippets cut around ~155-160 chars).
export function truncateForMeta(text, max = 155) {
    if (!text) return '';
    const clean = text.replace(/\s+/g, ' ').trim();
    if (clean.length <= max) return clean;
    const cut = clean.slice(0, max);
    const lastSpace = cut.lastIndexOf(' ');
    return (lastSpace > 100 ? cut.slice(0, lastSpace) : cut).replace(/[,;:.\-]+$/, '') + '…';
}
