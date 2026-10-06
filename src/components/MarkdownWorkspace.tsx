import React, { useState } from 'react';
import { Bold, Italic, Heading1, Heading2, CheckSquare, List, Quote, Code, Eye, Edit3, Columns } from 'lucide-react';
import { sound } from '../utils/sound';

interface MarkdownWorkspaceProps {
  content: string;
  onChange: (newContent: string) => void;
}

export const MarkdownWorkspace: React.FC<MarkdownWorkspaceProps> = ({ content, onChange }) => {
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
    sound.playClick();
    const lines = content.split('\n');
    let checkboxCount = 0;
    const newLines = lines.map(line => {
      const match = line.match(/^(\s*[-*]\s*)\[([ xX])\](.*)/);
      if (match) {
        if (checkboxCount === index) {
          const isChecked = match[2].toLowerCase() === 'x';
          const newMarker = isChecked ? ' ' : 'x';
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
        <div className="text-neutral-500 italic text-sm py-4">
          Нет заметок. Нажмите «Редактор», чтобы записать шаги, чек-лист или рецепт в Markdown.
        </div>
      );
    }

    const lines = text.split('\n');
    let checkboxCounter = 0;

    return (
      <div className="space-y-2 text-sm leading-relaxed text-neutral-200">
        {lines.map((line, idx) => {
          // Headers
          if (line.startsWith('# ')) {
            return (
              <h1 key={idx} className="text-lg font-bold text-white pt-2 pb-1 border-b border-neutral-800">
                {line.slice(2)}
              </h1>
            );
          }
          if (line.startsWith('## ')) {
            return (
              <h2 key={idx} className="text-base font-semibold text-neutral-100 pt-2 pb-1">
                {line.slice(3)}
              </h2>
            );
          }
          if (line.startsWith('### ')) {
            return (
              <h3 key={idx} className="text-sm font-semibold text-neutral-300 pt-1">
                {line.slice(4)}
              </h3>
            );
          }

          // Checkbox task: - [ ] or - [x]
          const checkMatch = line.match(/^(\s*[-*]\s*)\[([ xX])\](.*)/);
          if (checkMatch) {
            const currentIndex = checkboxCounter++;
            const isChecked = checkMatch[2].toLowerCase() === 'x';
            return (
              <div
                key={idx}
                onClick={() => handleCheckboxToggle(currentIndex)}
                className="flex items-start gap-2.5 py-1 px-2 rounded hover:bg-neutral-800/60 cursor-pointer group transition-colors"
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  readOnly
                  className="mt-1 h-4 w-4 rounded border-neutral-600 bg-neutral-800 text-sky-500 focus:ring-0 cursor-pointer"
                />
                <span className={`flex-1 ${isChecked ? 'line-through text-neutral-500' : 'text-neutral-200 group-hover:text-white'}`}>
                  {checkMatch[3].trim()}
                </span>
              </div>
            );
          }

          // Bullet list
          if (line.startsWith('- ') || line.startsWith('* ')) {
            return (
              <li key={idx} className="ml-4 list-disc text-neutral-300 pl-1">
                {line.slice(2)}
              </li>
            );
          }

          // Numbered list
          const numMatch = line.match(/^(\d+)\.\s+(.*)/);
          if (numMatch) {
            return (
              <div key={idx} className="ml-4 text-neutral-300 flex items-start gap-2">
                <span className="font-mono text-xs text-neutral-500 mt-0.5">{numMatch[1]}.</span>
                <span>{numMatch[2]}</span>
              </div>
            );
          }

          // Quote
          if (line.startsWith('> ')) {
            return (
              <blockquote key={idx} className="border-l-2 border-sky-500/60 pl-3 py-1 text-neutral-400 bg-neutral-800/40 rounded-r text-xs">
                {line.slice(2)}
              </blockquote>
            );
          }

          // Empty line
          if (!line.trim()) {
            return <div key={idx} className="h-2" />;
          }

          return (
            <p key={idx} className="text-neutral-300">
              {line}
            </p>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-neutral-900/70 border border-neutral-800 rounded-lg overflow-hidden">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800 bg-neutral-900/90 text-neutral-400 text-xs">
        {/* Markdown Action Buttons */}
        <div className="flex items-center gap-1 overflow-x-auto">
          <button
            type="button"
            title="Заголовок H1"
            onClick={() => insertSyntax('# ')}
            className="p-1.5 rounded hover:bg-neutral-800 hover:text-white transition-colors"
          >
            <Heading1 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title="Заголовок H2"
            onClick={() => insertSyntax('## ')}
            className="p-1.5 rounded hover:bg-neutral-800 hover:text-white transition-colors"
          >
            <Heading2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title="Полужирный"
            onClick={() => insertSyntax('**', '**')}
            className="p-1.5 rounded hover:bg-neutral-800 hover:text-white transition-colors"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title="Курсив"
            onClick={() => insertSyntax('*', '*')}
            className="p-1.5 rounded hover:bg-neutral-800 hover:text-white transition-colors"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
          <div className="h-4 w-px bg-neutral-800 mx-1" />
          <button
            type="button"
            title="Интерактивный чек-бокс"
            onClick={() => insertSyntax('- [ ] ')}
            className="p-1.5 rounded hover:bg-neutral-800 hover:text-white transition-colors flex items-center gap-1 text-[11px]"
          >
            <CheckSquare className="w-3.5 h-3.5 text-sky-400" />
            <span>Чек-лист</span>
          </button>
          <button
            type="button"
            title="Маркированный список"
            onClick={() => insertSyntax('- ')}
            className="p-1.5 rounded hover:bg-neutral-800 hover:text-white transition-colors"
          >
            <List className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title="Цитата"
            onClick={() => insertSyntax('> ')}
            className="p-1.5 rounded hover:bg-neutral-800 hover:text-white transition-colors"
          >
            <Quote className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title="Код"
            onClick={() => insertSyntax('`', '`')}
            className="p-1.5 rounded hover:bg-neutral-800 hover:text-white transition-colors"
          >
            <Code className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 p-0.5 bg-neutral-950 rounded border border-neutral-800">
          <button
            type="button"
            onClick={() => setViewMode('editor')}
            className={`px-2 py-1 rounded text-[11px] font-medium transition-colors flex items-center gap-1 ${
              viewMode === 'editor' ? 'bg-neutral-800 text-white' : 'hover:text-neutral-200'
            }`}
          >
            <Edit3 className="w-3 h-3" />
            <span>Редактор</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('preview')}
            className={`px-2 py-1 rounded text-[11px] font-medium transition-colors flex items-center gap-1 ${
              viewMode === 'preview' ? 'bg-neutral-800 text-white' : 'hover:text-neutral-200'
            }`}
          >
            <Eye className="w-3 h-3" />
            <span>Превью</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('split')}
            className={`hidden md:flex px-2 py-1 rounded text-[11px] font-medium transition-colors items-center gap-1 ${
              viewMode === 'split' ? 'bg-neutral-800 text-white' : 'hover:text-neutral-200'
            }`}
          >
            <Columns className="w-3 h-3" />
            <span>Сплит</span>
          </button>
        </div>
      </div>

      {/* Editor & Preview Area */}
      <div className="flex-1 min-h-[220px] overflow-hidden flex">
        {(viewMode === 'editor' || viewMode === 'split') && (
          <div className={`flex-1 p-3 ${viewMode === 'split' ? 'border-r border-neutral-800' : ''}`}>
            <textarea
              id="task-markdown-input"
              value={content}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Введите заметки, чек-лист (- [ ] пункт), рецепт или ссылки..."
              className="w-full h-full bg-transparent resize-none border-0 text-sm font-mono text-neutral-200 focus:outline-none focus:ring-0 placeholder:text-neutral-600 leading-relaxed"
            />
          </div>
        )}

        {(viewMode === 'preview' || viewMode === 'split') && (
          <div className="flex-1 p-3.5 overflow-y-auto bg-neutral-950/40">
            {renderMarkdown(content)}
          </div>
        )}
      </div>

      <div className="px-3 py-1.5 bg-neutral-950/60 border-t border-neutral-800 text-[11px] text-neutral-500 flex items-center justify-between">
        <span>Поддерживает: **жирный**, - [ ] чекбоксы, # заголовки</span>
        <span>Символов: {content.length}</span>
      </div>
    </div>
  );
};
