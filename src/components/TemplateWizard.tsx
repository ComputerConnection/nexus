import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Zap,
  Settings,
  Sparkles,
  Info,
} from 'lucide-react';
import { Button } from './ui';
import type {
  ProjectTemplate,
  TemplateVariable,
} from '../data/projectTemplates';

interface TemplateWizardProps {
  template: ProjectTemplate;
  onComplete: (config: Record<string, unknown>) => void;
  onCancel: () => void;
}

export function TemplateWizard({ template, onComplete, onCancel }: TemplateWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const optionGroups = template.optionGroups || [];
  const hasOptions = optionGroups.length > 0;

  // Initialize config with defaults from template
  const [config, setConfig] = useState<Record<string, unknown>>(() => {
    const defaults: Record<string, unknown> = {};
    (template.optionGroups || []).forEach((group) => {
      group.variables.forEach((variable) => {
        defaults[variable.id] = variable.default;
      });
    });
    return defaults;
  });

  const currentGroup = optionGroups[currentStep];
  const isLastStep = currentStep === optionGroups.length - 1;
  const isFirstStep = currentStep === 0;

  const validateStep = (): boolean => {
    if (!currentGroup) return true;

    const newErrors: Record<string, string> = {};
    currentGroup.variables.forEach((variable) => {
      const value = config[variable.id];

      if (variable.required && (value === undefined || value === '')) {
        newErrors[variable.id] = 'This field is required';
        return;
      }

      if (variable.validation && variable.type === 'text' && typeof value === 'string') {
        if (variable.validation.pattern) {
          const regex = new RegExp(variable.validation.pattern);
          if (!regex.test(value)) {
            newErrors[variable.id] = variable.validation.message || 'Invalid format';
          }
        }
      }

      if (variable.validation && variable.type === 'number' && typeof value === 'number') {
        if (variable.validation.min !== undefined && value < variable.validation.min) {
          newErrors[variable.id] = `Minimum value is ${variable.validation.min}`;
        }
        if (variable.validation.max !== undefined && value > variable.validation.max) {
          newErrors[variable.id] = `Maximum value is ${variable.validation.max}`;
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep()) {
      if (isLastStep) {
        onComplete(config);
      } else {
        setCurrentStep((prev) => prev + 1);
      }
    }
  };

  const handleBack = () => {
    if (!isFirstStep) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleQuickCreate = () => {
    if (template.quickCreate?.defaults) {
      onComplete(template.quickCreate.defaults);
    } else {
      onComplete({});
    }
  };

  const updateValue = (variableId: string, value: unknown) => {
    setConfig((prev) => ({ ...prev, [variableId]: value }));
    // Clear error when user updates value
    if (errors[variableId]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[variableId];
        return newErrors;
      });
    }
  };

  const renderVariable = (variable: TemplateVariable) => {
    const value = config[variable.id];
    const error = errors[variable.id];

    // Check if this variable depends on another
    if (variable.dependsOn) {
      const dependentValue = config[variable.dependsOn.variable];
      if (dependentValue !== variable.dependsOn.value) {
        return null;
      }
    }

    return (
      <motion.div
        key={variable.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-2"
      >
        <label className="flex items-center gap-2">
          <span className="text-sm font-medium text-[var(--text-primary)]">
            {variable.name}
            {variable.required && <span className="text-red-400">*</span>}
          </span>
          {variable.description && (
            <span className="group relative">
              <Info size={14} className="text-[var(--text-muted)] cursor-help" />
              <span className="absolute left-0 bottom-full mb-1 hidden group-hover:block bg-[var(--bg-tertiary)] text-xs text-[var(--text-secondary)] px-2 py-1 rounded whitespace-nowrap z-10">
                {variable.description}
              </span>
            </span>
          )}
        </label>

        {variable.type === 'text' && (
          <input
            type="text"
            value={(value as string) || ''}
            onChange={(e) => updateValue(variable.id, e.target.value)}
            className={`w-full px-3 py-2 bg-[var(--bg-tertiary)] border rounded-lg text-[var(--text-primary)] focus:outline-none focus:ring-2 ${
              error ? 'border-red-500 focus:ring-red-500/30' : 'border-[var(--glass-border)] focus:ring-[var(--neon-cyan)]/30'
            }`}
            placeholder={variable.default as string}
          />
        )}

        {variable.type === 'number' && (
          <input
            type="number"
            value={(value as number) || 0}
            onChange={(e) => updateValue(variable.id, parseInt(e.target.value, 10))}
            min={variable.validation?.min}
            max={variable.validation?.max}
            className={`w-full px-3 py-2 bg-[var(--bg-tertiary)] border rounded-lg text-[var(--text-primary)] focus:outline-none focus:ring-2 ${
              error ? 'border-red-500 focus:ring-red-500/30' : 'border-[var(--glass-border)] focus:ring-[var(--neon-cyan)]/30'
            }`}
          />
        )}

        {variable.type === 'select' && variable.options && (
          <div className="grid grid-cols-2 gap-2">
            {variable.options.map((option) => (
              <button
                key={option.value}
                onClick={() => updateValue(variable.id, option.value)}
                className={`p-3 rounded-lg border text-left transition-all ${
                  value === option.value
                    ? 'border-[var(--neon-cyan)] bg-[var(--neon-cyan)]/10'
                    : 'border-[var(--glass-border)] bg-[var(--bg-tertiary)] hover:border-[var(--text-muted)]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      value === option.value
                        ? 'border-[var(--neon-cyan)] bg-[var(--neon-cyan)]'
                        : 'border-[var(--text-muted)]'
                    }`}
                  >
                    {value === option.value && (
                      <Check size={10} className="text-[var(--bg-primary)]" />
                    )}
                  </div>
                  <span className="text-sm font-medium text-[var(--text-primary)]">
                    {option.label}
                  </span>
                </div>
                {option.description && (
                  <p className="mt-1 ml-6 text-xs text-[var(--text-muted)]">
                    {option.description}
                  </p>
                )}
              </button>
            ))}
          </div>
        )}

        {variable.type === 'boolean' && (
          <button
            onClick={() => updateValue(variable.id, !value)}
            className={`flex items-center gap-3 p-3 rounded-lg border w-full transition-all ${
              value
                ? 'border-[var(--neon-cyan)] bg-[var(--neon-cyan)]/10'
                : 'border-[var(--glass-border)] bg-[var(--bg-tertiary)]'
            }`}
          >
            <div
              className={`w-10 h-6 rounded-full relative transition-colors ${
                value ? 'bg-[var(--neon-cyan)]' : 'bg-[var(--text-muted)]'
              }`}
            >
              <motion.div
                initial={false}
                animate={{ x: value ? 18 : 2 }}
                className="absolute top-1 w-4 h-4 rounded-full bg-white"
              />
            </div>
            <span className="text-sm text-[var(--text-primary)]">
              {value ? 'Enabled' : 'Disabled'}
            </span>
          </button>
        )}

        {error && (
          <p className="text-xs text-red-400">{error}</p>
        )}
      </motion.div>
    );
  };

  if (!hasOptions) {
    // No options - show quick summary and create
    return (
      <div className="p-6 space-y-6">
        <div className="text-center">
          <div
            className={`w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br ${template.color} flex items-center justify-center mb-4`}
          >
            <template.icon size={32} className="text-white" />
          </div>
          <h3 className="text-xl font-semibold text-[var(--text-primary)]">
            {template.name}
          </h3>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            {template.description}
          </p>
        </div>

        <div className="flex gap-3">
          <Button variant="ghost" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
          <Button onClick={() => onComplete({})} className="flex-1">
            <Sparkles size={16} className="mr-2" />
            Create Project
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b border-[var(--glass-border)]">
        <div className="flex items-center gap-4">
          <div
            className={`w-12 h-12 rounded-xl bg-gradient-to-br ${template.color} flex items-center justify-center`}
          >
            <template.icon size={24} className="text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">
              Configure {template.name}
            </h3>
            <p className="text-sm text-[var(--text-secondary)]">
              Customize your project settings
            </p>
          </div>
        </div>

        {/* Progress */}
        <div className="mt-4 flex gap-2">
          {optionGroups.map((group, index) => (
            <button
              key={group.id}
              onClick={() => index <= currentStep && setCurrentStep(index)}
              className="flex-1 group"
              disabled={index > currentStep}
            >
              <div
                className={`h-1 rounded-full transition-colors ${
                  index < currentStep
                    ? 'bg-[var(--neon-cyan)]'
                    : index === currentStep
                    ? 'bg-[var(--neon-purple)]'
                    : 'bg-[var(--glass-border)]'
                }`}
              />
              <span
                className={`text-xs mt-1 block truncate transition-colors ${
                  index <= currentStep
                    ? 'text-[var(--text-secondary)]'
                    : 'text-[var(--text-muted)]'
                }`}
              >
                {group.name}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div>
              <h4 className="text-lg font-medium text-[var(--text-primary)] flex items-center gap-2">
                <Settings size={18} className="text-[var(--neon-purple)]" />
                {currentGroup?.name}
              </h4>
              <p className="text-sm text-[var(--text-muted)] mt-1">
                {currentGroup?.description}
              </p>
            </div>

            <div className="space-y-4">
              {currentGroup?.variables.map(renderVariable)}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="p-6 border-t border-[var(--glass-border)] bg-[var(--bg-secondary)]/50">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {template.quickCreate?.enabled && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleQuickCreate}
                className="text-[var(--text-muted)]"
              >
                <Zap size={14} className="mr-1" />
                Quick Create
              </Button>
            )}
          </div>

          <div className="flex gap-3">
            {isFirstStep ? (
              <Button variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
            ) : (
              <Button variant="ghost" onClick={handleBack}>
                <ChevronLeft size={16} className="mr-1" />
                Back
              </Button>
            )}
            <Button onClick={handleNext}>
              {isLastStep ? (
                <>
                  <Check size={16} className="mr-1" />
                  Create Project
                </>
              ) : (
                <>
                  Next
                  <ChevronRight size={16} className="ml-1" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
