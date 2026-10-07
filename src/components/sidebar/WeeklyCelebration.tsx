import React, { useMemo, useState } from 'react';

const PRAISES = [
  'Неделя закрыта. Можно официально считать себя легендой.',
  'Все задачи выполнены. Даже дедлайны в шоке.',
  '100%. Это было красиво.',
  'Ни одного хвоста. Продуктивность уровня «босс».',
  'Вот это темп! Календарь аплодирует стоя.',
  'Список пуст, а ты на коне. Заслуженный отдых активирован.',
];

// Положи свои мемы в public/memes/ (jpg/png/gif/webp) и перечисли их тут.
// Если файла нет — просто покажется эмодзи, ничего не сломается.
const MEME_IMAGES: string[] = [
  '/memes/win-1.jpg',
  '/memes/win-2.jpg',
  '/memes/win-3.jpg',
];

const FALLBACK_EMOJIS = ['🏆', '🎉', '😎', '🚀', '👑'];
const CONFETTI = ['🎉', '✨', '🎊', '⭐', '💚'];

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function shuffled<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}

export const WeeklyCelebration: React.FC = () => {
  // Компонент монтируется заново при каждом открытии окна — выбор каждый раз новый
  const [praise] = useState(() => pick(PRAISES));
  const [emoji] = useState(() => pick(FALLBACK_EMOJIS));
  const [queue, setQueue] = useState<string[]>(() => shuffled(MEME_IMAGES));

  const confetti = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => ({
        id: i,
        left: `${(i * 100) / 16 + Math.random() * 4}%`,
        delay: `${Math.random() * 0.8}s`,
        duration: `${2 + Math.random() * 1.6}s`,
        symbol: CONFETTI[i % CONFETTI.length],
      })),
    []
  );

  const currentImage = queue[0];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 px-4 py-5 text-center">
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none">
        {confetti.map(piece => (
          <span
            key={piece.id}
            className="confetti-piece text-base"
            style={
              {
                left: piece.left,
                '--delay': piece.delay,
                '--dur': piece.duration,
              } as React.CSSProperties
            }
          >
            {piece.symbol}
          </span>
        ))}
      </div>

      {currentImage ? (
        <img
          src={currentImage}
          alt=""
          onError={() => setQueue(prev => prev.slice(1))}
          className="relative mx-auto mb-3 max-h-40 rounded-xl object-contain shadow-lg"
        />
      ) : (
        <div className="relative mb-2 text-5xl" aria-hidden="true">
          {emoji}
        </div>
      )}

      <p className="relative font-serif text-lg leading-snug text-[var(--color-text-primary)]">
        {praise}
      </p>
    </div>
  );
};

export function getMotivation(percent: number, total: number): string {
  if (total === 0) return 'На этой неделе задач пока нет';
  if (percent === 100) return 'Всё сделано!';
  if (percent >= 75) return 'Почти у цели, осталось чуть-чуть';
  if (percent >= 40) return 'Хороший темп, так держать';
  if (percent > 0) return 'Начало положено';
  return 'Неделя только начинается';
}
