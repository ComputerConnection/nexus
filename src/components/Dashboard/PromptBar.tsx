import { useState, useRef, useCallback, type KeyboardEvent } from 'react';
import { Send, Mic, MicOff, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { NeonButton } from '../common';
import { useSpeechRecognition } from '../../hooks';

interface PromptBarProps {
  onSubmit: (prompt: string) => void;
  isProcessing?: boolean;
  placeholder?: string;
  className?: string;
}

export function PromptBar({
  onSubmit,
  isProcessing = false,
  placeholder = "Enter your command... (e.g., 'Build a REST API with authentication')",
  className,
}: PromptBarProps) {
  const [prompt, setPrompt] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleVoiceResult = useCallback((transcript: string) => {
    setPrompt((prev) => prev + transcript);
  }, []);

  const { isListening, isSupported, toggle: toggleVoice } = useSpeechRecognition({
    onResult: handleVoiceResult,
  });

  const handleSubmit = () => {
    if (!prompt.trim() || isProcessing) return;
    onSubmit(prompt.trim());
    setPrompt('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  };

  return (
    <div className={clsx('relative', className)}>
      <div
        className={clsx(
          'flex items-end gap-3 p-3 rounded-lg border transition-all duration-300',
          'bg-bg-secondary border-neon-cyan/30',
          'focus-within:border-neon-cyan/60 focus-within:shadow-[0_0_20px_rgba(0,255,249,0.2)]'
        )}
      >
        {/* Text input */}
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value);
            adjustHeight();
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isProcessing}
          rows={1}
          className={clsx(
            'flex-1 bg-transparent text-text-primary font-mono text-sm',
            'placeholder:text-text-secondary/50 resize-none outline-none',
            'disabled:opacity-50'
          )}
        />

        {/* Voice input button */}
        {isSupported && (
          <button
            onClick={toggleVoice}
            disabled={isProcessing}
            className={clsx(
              'p-2 rounded transition-all duration-200',
              isListening
                ? 'bg-neon-red/20 text-neon-red animate-pulse'
                : 'text-text-secondary hover:text-neon-cyan hover:bg-neon-cyan/10'
            )}
            title={isListening ? 'Stop listening' : 'Start voice input'}
          >
            {isListening ? <MicOff size={20} /> : <Mic size={20} />}
          </button>
        )}

        {/* Submit button */}
        <NeonButton
          onClick={handleSubmit}
          disabled={!prompt.trim() || isProcessing}
          variant="cyan"
          size="md"
          className="flex items-center gap-2"
        >
          {isProcessing ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Processing
            </>
          ) : (
            <>
              <Send size={18} />
              Execute
            </>
          )}
        </NeonButton>
      </div>

      {/* Voice indicator */}
      {isListening && (
        <div className="absolute -bottom-6 left-0 text-xs text-neon-red font-mono animate-pulse">
          Listening...
        </div>
      )}
    </div>
  );
}
