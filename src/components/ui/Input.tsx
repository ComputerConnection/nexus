import { forwardRef, useState } from 'react';
import type { InputHTMLAttributes } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
// Note: motion is used for animated elements like motion.button
import { clsx } from 'clsx';
import { Search, X, Eye, EyeOff } from 'lucide-react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  clearable?: boolean;
  onClear?: () => void;
  inputSize?: 'sm' | 'md' | 'lg';
}

const sizes = {
  sm: 'px-3 py-2 text-xs',
  md: 'px-4 py-3 text-sm',
  lg: 'px-5 py-4 text-base',
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      hint,
      icon,
      iconRight,
      clearable,
      onClear,
      inputSize = 'md',
      className,
      type,
      value,
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = useState(false);
    const [isFocused, setIsFocused] = useState(false);

    const isPassword = type === 'password';
    const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;
    const hasValue = value !== undefined && value !== '';

    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
            {label}
          </label>
        )}
        <div className="relative">
          {/* Left icon */}
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]">
              {icon}
            </div>
          )}

          {/* Input */}
          <input
            ref={ref}
            type={inputType}
            value={value}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            className={clsx(
              'w-full bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-[var(--radius-md)]',
              'border transition-all duration-200 outline-none',
              'placeholder:text-[var(--text-tertiary)]',
              isFocused
                ? 'border-[var(--neon-cyan)] shadow-[0_0_0_3px_rgba(0,212,255,0.1)]'
                : error
                ? 'border-red-500'
                : 'border-[var(--glass-border)] hover:border-white/15',
              sizes[inputSize],
              icon && 'pl-10',
              (iconRight || clearable || isPassword) && 'pr-10',
              className
            )}
            {...props}
          />

          {/* Right side */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
            <AnimatePresence>
              {clearable && hasValue && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  type="button"
                  onClick={onClear}
                  className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <X size={16} />
                </motion.button>
              )}
            </AnimatePresence>

            {isPassword && (
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            )}

            {iconRight}
          </div>
        </div>

        {/* Error or hint */}
        <AnimatePresence>
          {(error || hint) && (
            <motion.p
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className={clsx(
                'text-xs mt-1.5',
                error ? 'text-red-400' : 'text-[var(--text-tertiary)]'
              )}
            >
              {error || hint}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    );
  }
);

Input.displayName = 'Input';

// Search input variant
interface SearchInputProps extends Omit<InputProps, 'icon' | 'type'> {
  onSearch?: (value: string) => void;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ onSearch, ...props }, ref) => {
    return (
      <Input
        ref={ref}
        type="text"
        icon={<Search size={16} />}
        clearable
        {...props}
      />
    );
  }
);

SearchInput.displayName = 'SearchInput';
