import { clsx } from 'clsx';

const presets = {
    primary: 'bg-primary/10 text-primary',
    accent: 'bg-rural-100 text-rural-700',
    success: 'bg-green-50 text-green-700',
    warning: 'bg-amber-50 text-amber-700',
    danger: 'bg-red-50 text-red-700',
    neutral: 'bg-gray-100 text-gray-500',
};

const Badge = ({ children, preset = 'primary', className = '', ...props }) => (
    <span
        className={clsx(
            'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold',
            presets[preset],
            className
        )}
        {...props}
    >
        {children}
    </span>
);

export default Badge;
