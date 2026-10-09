import React, { useState } from 'react';
import { Bold, Italic, Heading1, Heading2, CheckSquare, List, Quote, Code, Eye, Edit3, Columns } from 'lucide-react';
import { sound } from '../../utils/sound';

interface MarkdownWorkspaceProps {
  content: string;
  onChange: (newContent: string) => void;
  onBlur?: () => void;
}

export const MarkdownWorkspace: React.FC<MarkdownWorkspaceProps> = ({ content, onChange, onBlur }) => {
  const [viewMode, setViewMode] = useState<'editor' | 'preview' | 'split'>('editor');

  const insertSyntax = (prefix: string, suffix = '') => {
    const textarea = document.getElementById('task-markdown-input') as HTMLTextAreaElement | null;
    if (!textarea) {
      onChange(content + prefix + suffix);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    const replacement = prefix + (selectedText || 'текст') + suffix;
    const newContent = content.substring(0, start) + replacement + content.substring(end);
    onChange(newContent);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + (selectedText.length || 5));
    }, 0);
  };

  const handleCheckboxToggle = (index: number) => {
    const lines = content.split('\n');
    let checkboxCount = 0;
    const newLines = lines.map(line => {
      const match = line.match(/^(\s*[-*]\s*)\[([ xX])\](.*)/);
      if (match) {
        if (checkboxCount === index) {
          const isChecked = match[2].toLowerCase() === 'x';
          const newMarker = isChecked ? ' ' : 'x';
          if (!isChecked) {
            sound.playTaskComplete();
          } else {
            sound.playTap();
          }
          checkboxCount++;
          return `${match[1]}[${newMarker}]${match[3]}`;
        }
        checkboxCount++;
      }
      return line;
    });
    onChange(newLines.join('\n'));
  };

  const renderMarkdown = (text: string) => {
    if (!text.trim()) {
      return (
        <div className="text-[var(--color-text-muted)] italic text-xs py-3">
          Нет заметок. Нажмите «Редактор», чтобы записать чек-лист или заметки в Markdown.
        </div>
      );
    }

    const lines = text.split('\n');
    let checkboxCounter = 0;

    return (
      <div className="space-y-1.5 text-xs leading-relaxed text-[var(--color-text-secondary)]">
        {lines.map((line, idx) => {
          if (line.startsWith('# ')) {
            return (
              <h1 key={idx} className="font-serif text-base font-medium text-[var(--color-text-primary)] pt-1 pb-0.5 border-b border-[var(--color-border)]">
                {line.slice(2)}
              </h1>
            );
          }
          if (line.startsWith('## ')) {
            return (
              <h2 key={idx} className="font-serif text-sm font-medium text-[var(--color-text-primary)] pt-1">
                {line.slice(3)}
              </h2>
            );
          }
          if (line.startsWith('### ')) {
            return (
              <h3 key={idx} className="text-xs font-medium text-[var(--color-text-primary)]">
                {line.slice(4)}
              </h3>
            );
          }

          const checkMatch = line.match(/^(\s*[-*]\s*)\[([ xX])\](.*)/);
          if (checkMatch) {
            const currentIndex = checkboxCounter++;
            const isChecked = checkMatch[2].toLowerCase() === 'x';
            return (
              <div
                key={idx}
                onClick={() => handleCheckboxToggle(currentIndex)}
                className="flex items-start gap-2 py-0.5 px-1.5 rounded hover:bg-[var(--color-surface-hover)] cursor-pointer group transition-colors"
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  readOnly
                  className="mt-0.5 h-3.5 w-3.5 rounded border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-accent)] focus:ring-0 cursor-pointer"
                />
                <span className={`flex-1 ${isChecked ? 'line-through text-[var(--color-text-muted)]' : 'text-[var(--color-text-primary)]'}`}>
                  {checkMatch[3].trim()}
                </span>
              </div>
            );
          }

          if (line.startsWith('- ') || line.startsWith('* ')) {
            return (
              <li key={idx} className="ml-4 list-disc text-[var(--color-text-secondary)] pl-1">
                {line.slice(2)}
              </li>
            );
          }

          const numMatch = line.match(/^(\d+)\.\s+(.*)/);
          if (numMatch) {
            return (
              <div key={idx} className="ml-4 text-[var(--color-text-secondary)] flex items-start gap-1.5">
                <span className="font-mono text-[11px] text-[var(--color-text-muted)] mt-0.5">{numMatch[1]}.</span>
                <span>{numMatch[2]}</span>
              </div>
            );
          }

          if (line.startsWith('> ')) {
            return (
              <blockquote key={idx} className="border-l-2 border-[var(--color-accent)] pl-2.5 py-0.5 text-[var(--color-text-muted)] italic text-xs">
                {line.slice(2)}
              </blockquote>
            );
          }

          if (!line.trim()) {
            return <div key={idx} className="h-1.5" />;
          }

          return (
            <p key={idx} className="text-[var(--color-text-secondary)]">
              {line}
            </p>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col bg-[var(--color-app-bg)] border border-[var(--color-border)] rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--color-border)] bg-[var(--color-surface)] text-xs">
        <div className="flex items-center gap-1 overflow-x-auto">
          <button
            type="button"
            title="Заголовок H1"
            onClick={() => insertSyntax('# ')}
            className="p-1 rounded text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors"
          >
            <Heading1 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title="Заголовок H2"
            onClick={() => insertSyntax('## ')}
            className="p-1 rounded text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors"
          >
            <Heading2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title="Полужирный"
            onClick={() => insertSyntax('**', '**')}
            className="p-1 rounded text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title="Курсив"
            onClick={() => insertSyntax('*', '*')}
            className="p-1 rounded text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
          <div className="h-3.5 w-px bg-[var(--color-border)] mx-0.5" />
          <button
            type="button"
            title="Интерактивный чек-бокс"
            onClick={() => insertSyntax('- [ ] ')}
            className="p-1 rounded text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors flex items-center gap-1 text-[11px]"
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>Чек-лист</span>
          </button>
          <button
            type="button"
            title="Список"
            onClick={() => insertSyntax('- ')}
            className="p-1 rounded text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors"
          >
            <List className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title="Цитата"
            onClick={() => insertSyntax('> ')}
            className="p-1 rounded text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors"
          >
            <Quote className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title="Код"
            onClick={() => insertSyntax('`', '`')}
            className="p-1 rounded text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors"
          >
            <Code className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* View mode */}
        <div className="flex items-center gap-0.5 bg-[var(--color-app-bg)] p-0.5 rounded border border-[var(--color-border)]">
          <button
            type="button"
            onClick={() => {
              if (viewMode !== 'editor') sound.playTabSwitch();
              setViewMode('editor');
            }}
            className={`px-2 py-0.5 rounded text-[11px] transition-colors flex items-center gap-1 ${
              viewMode === 'editor' ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] font-medium' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            <Edit3 className="w-3 h-3" />
            <span>Редактор</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (viewMode !== 'preview') sound.playTabSwitch();
              setViewMode('preview');
            }}
            className={`px-2 py-0.5 rounded text-[11px] transition-colors flex items-center gap-1 ${
              viewMode === 'preview' ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] font-medium' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            <Eye className="w-3 h-3" />
            <span>Превью</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (viewMode !== 'split') sound.playTabSwitch();
              setViewMode('split');
            }}
            className={`hidden sm:flex px-2 py-0.5 rounded text-[11px] transition-colors items-center gap-1 ${
              viewMode === 'split' ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] font-medium' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            <Columns className="w-3 h-3" />
            <span>Сплит</span>
          </button>
        </div>
      </div>

      {/* Editor & Preview Viewport */}
      <div className="h-44 overflow-hidden flex">
        {(viewMode === 'editor' || viewMode === 'split') && (
          <div className={`flex-1 p-2.5 ${viewMode === 'split' ? 'border-r border-[var(--color-border)]' : ''}`}>
            <textarea
              id="task-markdown-input"
              value={content}
              onChange={e => onChange(e.target.value)}
              onBlur={onBlur}
              placeholder="Заметки, чек-лист (- [ ] пункт)..."
              className="w-full h-full bg-transparent resize-none border-0 text-xs font-mono text-[var(--color-text-primary)] focus:outline-none focus:ring-0 placeholder:text-[var(--color-text-muted)] leading-relaxed"
            />
          </div>
        )}

        {(viewMode === 'preview' || viewMode === 'split') && (
          <div className="flex-1 p-3 overflow-y-auto bg-[var(--color-app-bg)]">
            {renderMarkdown(content)}
          </div>
        )}
      </div>
    </div>
  );
};
