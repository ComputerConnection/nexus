import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { clsx } from 'clsx';
import type { ReactNode } from 'react';
import { Check, ChevronRight } from 'lucide-react';

interface DropdownProps {
  trigger: ReactNode;
  children: ReactNode;
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'right' | 'bottom' | 'left';
}

export function Dropdown({
  trigger,
  children,
  align = 'end',
  side = 'bottom',
}: DropdownProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={align}
          side={side}
          sideOffset={8}
          className={clsx(
            'z-50 min-w-[180px] p-1.5 rounded-[var(--radius-lg)]',
            'bg-[var(--bg-secondary)] backdrop-blur-xl',
            'border border-[var(--glass-border)]',
            'shadow-xl shadow-black/40',
            'animate-scale-in origin-top-right'
          )}
        >
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

interface DropdownItemProps {
  children: ReactNode;
  icon?: ReactNode;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
}

export function DropdownItem({
  children,
  icon,
  shortcut,
  danger,
  disabled,
  onSelect,
}: DropdownItemProps) {
  return (
    <DropdownMenu.Item
      disabled={disabled}
      onSelect={onSelect}
      className={clsx(
        'flex items-center gap-2 px-3 py-2 rounded-[var(--radius-md)]',
        'text-sm cursor-pointer outline-none transition-colors',
        danger
          ? 'text-red-400 focus:bg-red-500/10'
          : 'text-[var(--text-secondary)] focus:bg-[var(--bg-hover)] focus:text-[var(--text-primary)]',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      {icon && <span className="w-4 h-4">{icon}</span>}
      <span className="flex-1">{children}</span>
      {shortcut && (
        <span className="text-xs text-[var(--text-tertiary)]">{shortcut}</span>
      )}
    </DropdownMenu.Item>
  );
}

export function DropdownSeparator() {
  return (
    <DropdownMenu.Separator className="h-px my-1 bg-[var(--glass-border)]" />
  );
}

export function DropdownLabel({ children }: { children: ReactNode }) {
  return (
    <DropdownMenu.Label className="px-3 py-1.5 text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
      {children}
    </DropdownMenu.Label>
  );
}

interface DropdownCheckboxItemProps {
  children: ReactNode;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

export function DropdownCheckboxItem({
  children,
  checked,
  onCheckedChange,
}: DropdownCheckboxItemProps) {
  return (
    <DropdownMenu.CheckboxItem
      checked={checked}
      onCheckedChange={onCheckedChange}
      className={clsx(
        'flex items-center gap-2 px-3 py-2 rounded-[var(--radius-md)]',
        'text-sm cursor-pointer outline-none transition-colors',
        'text-[var(--text-secondary)] focus:bg-[var(--bg-hover)] focus:text-[var(--text-primary)]'
      )}
    >
      <span className="w-4 h-4 flex items-center justify-center">
        <DropdownMenu.ItemIndicator>
          <Check size={14} className="text-[var(--neon-cyan)]" />
        </DropdownMenu.ItemIndicator>
      </span>
      <span className="flex-1">{children}</span>
    </DropdownMenu.CheckboxItem>
  );
}

interface DropdownSubMenuProps {
  trigger: ReactNode;
  children: ReactNode;
}

export function DropdownSubMenu({ trigger, children }: DropdownSubMenuProps) {
  return (
    <DropdownMenu.Sub>
      <DropdownMenu.SubTrigger
        className={clsx(
          'flex items-center gap-2 px-3 py-2 rounded-[var(--radius-md)]',
          'text-sm cursor-pointer outline-none transition-colors',
          'text-[var(--text-secondary)] focus:bg-[var(--bg-hover)] focus:text-[var(--text-primary)]'
        )}
      >
        <span className="flex-1">{trigger}</span>
        <ChevronRight size={14} />
      </DropdownMenu.SubTrigger>
      <DropdownMenu.Portal>
        <DropdownMenu.SubContent
          sideOffset={8}
          alignOffset={-4}
          className={clsx(
            'z-50 min-w-[160px] p-1.5 rounded-[var(--radius-lg)]',
            'bg-[var(--bg-secondary)] backdrop-blur-xl',
            'border border-[var(--glass-border)]',
            'shadow-xl shadow-black/40',
            'animate-scale-in origin-top-left'
          )}
        >
          {children}
        </DropdownMenu.SubContent>
      </DropdownMenu.Portal>
    </DropdownMenu.Sub>
  );
}
