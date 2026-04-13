import { clsx } from 'clsx';

const Input = ({ label, icon: Icon, className = '', id, required, ...props }) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
    return (
        <div>
            {label && (
                <label
                    htmlFor={inputId}
                    className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1.5 block"
                >
                    {label}{required && ' *'}
                </label>
            )}
            <div className="relative">
                {Icon && (
                    <Icon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" aria-hidden="true" />
                )}
                <input
                    id={inputId}
                    required={required}
                    className={clsx(
                        'w-full py-3 rounded-xl border border-gray-200 text-sm',
                        'focus:outline-none focus:ring-2 focus:ring-rural-200 focus:border-rural-400',
                        'transition-colors',
                        Icon ? 'pl-10 pr-4' : 'px-4',
                        className
                    )}
                    {...props}
                />
            </div>
        </div>
    );
};

export default Input;
