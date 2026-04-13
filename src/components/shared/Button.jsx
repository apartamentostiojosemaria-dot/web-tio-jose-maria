import { clsx } from 'clsx';

const variants = {
    primary: 'bg-primary text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5',
    secondary: 'bg-white border-2 border-primary text-primary hover:-translate-y-0.5',
    ghost: 'bg-white/10 backdrop-blur-md border border-white/30 text-white hover:bg-white/20',
    danger: 'bg-red-500 text-white hover:bg-red-600',
};

const sizes = {
    sm: 'px-4 py-2 text-xs',
    md: 'px-6 py-2.5 text-sm',
    lg: 'px-8 py-3.5 text-sm',
    xl: 'px-10 py-4 text-lg',
};

const Button = ({
    children,
    variant = 'primary',
    size = 'md',
    rounded = 'full',
    className = '',
    as: Tag = 'button',
    ...props
}) => (
    <Tag
        className={clsx(
            'inline-flex items-center justify-center gap-2 font-bold transition-all duration-300',
            `rounded-${rounded}`,
            variants[variant],
            sizes[size],
            props.disabled && 'opacity-40 cursor-not-allowed hover:shadow-none hover:translate-y-0',
            className
        )}
        {...props}
    >
        {children}
    </Tag>
);

export default Button;
