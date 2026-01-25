import { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebglAddon } from 'xterm-addon-webgl';
import { clsx } from 'clsx';
import 'xterm/css/xterm.css';

interface XTerminalProps {
  output?: string[];
  onInput?: (data: string) => void;
  className?: string;
  fontSize?: number;
  theme?: 'cyan' | 'green' | 'magenta';
}

const themeColors = {
  cyan: {
    foreground: '#00fff9',
    cursor: '#00fff9',
    cursorAccent: '#0a0a0f',
  },
  green: {
    foreground: '#39ff14',
    cursor: '#39ff14',
    cursorAccent: '#0a0a0f',
  },
  magenta: {
    foreground: '#ff00ff',
    cursor: '#ff00ff',
    cursorAccent: '#0a0a0f',
  },
};

export function XTerminal({
  output = [],
  onInput,
  className,
  fontSize = 14,
  theme = 'cyan',
}: XTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const lastOutputLengthRef = useRef(0);

  // Initialize terminal
  useEffect(() => {
    if (!containerRef.current || terminalRef.current) return;

    const colors = themeColors[theme];
    const terminal = new Terminal({
      theme: {
        background: '#0a0a0f',
        foreground: colors.foreground,
        cursor: colors.cursor,
        cursorAccent: colors.cursorAccent,
        selectionBackground: '#00fff940',
        black: '#0a0a0f',
        red: '#ff0040',
        green: '#39ff14',
        yellow: '#ff6600',
        blue: '#00fff9',
        magenta: '#ff00ff',
        cyan: '#00fff9',
        white: '#e0e0e0',
        brightBlack: '#808080',
        brightRed: '#ff0040',
        brightGreen: '#39ff14',
        brightYellow: '#ff6600',
        brightBlue: '#00fff9',
        brightMagenta: '#ff00ff',
        brightCyan: '#00fff9',
        brightWhite: '#ffffff',
      },
      fontSize,
      fontFamily: 'JetBrains Mono, Fira Code, monospace',
      cursorBlink: true,
      cursorStyle: 'block',
      allowTransparency: true,
      scrollback: 5000,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    // Try to load WebGL addon for better performance
    try {
      const webglAddon = new WebglAddon();
      terminal.loadAddon(webglAddon);
    } catch (e) {
      console.warn('WebGL addon not supported:', e);
    }

    terminal.open(containerRef.current);
    fitAddon.fit();

    // Handle input
    if (onInput) {
      terminal.onData((data) => {
        onInput(data);
      });
    }

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, [fontSize, theme, onInput]);

  // Write new output to terminal
  useEffect(() => {
    if (!terminalRef.current) return;

    const newOutput = output.slice(lastOutputLengthRef.current);
    newOutput.forEach((line) => {
      terminalRef.current?.write(line);
    });
    lastOutputLengthRef.current = output.length;
  }, [output]);

  return (
    <div
      ref={containerRef}
      className={clsx(
        'w-full h-full min-h-[200px] bg-bg-primary rounded overflow-hidden',
        className
      )}
    />
  );
}
