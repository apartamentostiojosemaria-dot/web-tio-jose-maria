import { clsx } from 'clsx';

const Card = ({ children, className = '', hover = false, padding = 'p-6 md:p-8', ...props }) => (
    <div
        className={clsx(
            'bg-white rounded-2xl shadow-sm border border-gray-100',
            hover && 'hover:shadow-xl hover:-translate-y-2 transition-all duration-500',
            padding,
            className
        )}
        {...props}
    >
        {children}
    </div>
);

export default Card;
