const SectionHeader = ({ tag, title, className = '' }) => (
    <div className={className}>
        {tag && (
            <span className="uppercase tracking-[0.2em] text-xs font-bold text-primary">
                {tag}
            </span>
        )}
        <h2 className="font-serif text-3xl md:text-5xl font-bold mt-3 text-text-primary">
            {title}
        </h2>
    </div>
);

export default SectionHeader;
