import * as TabsPrimitive from '@radix-ui/react-tabs';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import type { ReactNode } from 'react';
import { createContext, useContext, useState } from 'react';

interface TabsContextValue {
  activeTab: string;
}

const TabsContext = createContext<TabsContextValue | null>(null);

interface TabsProps {
  defaultValue: string;
  children: ReactNode;
  className?: string;
  onChange?: (value: string) => void;
}

export function Tabs({ defaultValue, children, className, onChange }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultValue);

  const handleValueChange = (value: string) => {
    setActiveTab(value);
    onChange?.(value);
  };

  return (
    <TabsContext.Provider value={{ activeTab }}>
      <TabsPrimitive.Root
        defaultValue={defaultValue}
        onValueChange={handleValueChange}
        className={clsx('w-full', className)}
      >
        {children}
      </TabsPrimitive.Root>
    </TabsContext.Provider>
  );
}

interface TabsListProps {
  children: ReactNode;
  className?: string;
}

export function TabsList({ children, className }: TabsListProps) {
  return (
    <TabsPrimitive.List
      className={clsx(
        'inline-flex items-center gap-1 p-1 rounded-[var(--radius-lg)]',
        'bg-[var(--bg-tertiary)] border border-[var(--glass-border)]',
        className
      )}
    >
      {children}
    </TabsPrimitive.List>
  );
}

interface TabsTriggerProps {
  value: string;
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export function TabsTrigger({ value, children, icon, className }: TabsTriggerProps) {
  const context = useContext(TabsContext);
  const isActive = context?.activeTab === value;

  return (
    <TabsPrimitive.Trigger
      value={value}
      className={clsx(
        'relative px-4 py-2 text-sm font-medium rounded-[var(--radius-md)]',
        'transition-colors outline-none',
        'flex items-center gap-2',
        isActive
          ? 'text-[var(--text-primary)]'
          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
        className
      )}
    >
      {isActive && (
        <motion.div
          layoutId="activeTab"
          className="absolute inset-0 bg-[var(--bg-elevated)] rounded-[var(--radius-md)] border border-[var(--glass-border)]"
          transition={{ type: 'spring', duration: 0.3, bounce: 0.15 }}
        />
      )}
      <span className="relative z-10 flex items-center gap-2">
        {icon}
        {children}
      </span>
    </TabsPrimitive.Trigger>
  );
}

interface TabsContentProps {
  value: string;
  children: ReactNode;
  className?: string;
}

export function TabsContent({ value, children, className }: TabsContentProps) {
  return (
    <TabsPrimitive.Content
      value={value}
      className={clsx('mt-4 outline-none animate-fade-up', className)}
    >
      {children}
    </TabsPrimitive.Content>
  );
}

// Alternative pill-style tabs
export function TabsPill({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <TabsPrimitive.List
      className={clsx(
        'inline-flex items-center gap-2',
        className
      )}
    >
      {children}
    </TabsPrimitive.List>
  );
}

export function TabsTriggerPill({ value, children, icon }: TabsTriggerProps) {
  const context = useContext(TabsContext);
  const isActive = context?.activeTab === value;

  return (
    <TabsPrimitive.Trigger
      value={value}
      className={clsx(
        'px-4 py-2 text-sm font-medium rounded-full',
        'transition-all duration-200 outline-none',
        'flex items-center gap-2',
        isActive
          ? 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white shadow-lg shadow-cyan-500/25'
          : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--glass-border)]'
      )}
    >
      {icon}
      {children}
    </TabsPrimitive.Trigger>
  );
}
