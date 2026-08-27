import React from 'react';

export type CaptionSegment =
  | { type: 'text'; value: string }
  | { type: 'hashtag'; value: string }
  | { type: 'mention'; value: string };

const TOKEN_RE = /(#[\p{L}\p{N}_]+|@[\p{N}\p{L}_]+)/gu;

export function parseCaption(text: string): CaptionSegment[] {
  if (!text) return [];

  const segments: CaptionSegment[] = [];
  let last = 0;

  for (const match of text.matchAll(TOKEN_RE)) {
    const idx = match.index ?? 0;

    if (idx > last) {
      segments.push({ type: 'text', value: text.slice(last, idx) });
    }

    const token = match[0];
    segments.push(
      token.startsWith('#')
        ? { type: 'hashtag', value: token }
        : { type: 'mention', value: token }
    );

    last = idx + token.length;
  }

  if (last < text.length) {
    segments.push({ type: 'text', value: text.slice(last) });
  }

  return segments;
}

export const CaptionText: React.FC<{
  text?: string;
  onHashtag?: (tag: string) => void;
  onMention?: (name: string) => void;
}> = ({ text, onHashtag, onMention }) => {
  const segments = parseCaption(text || '');

  if (segments.length === 0) return null;

  return (
    <>
      {segments.map((seg, i) => {
        if (seg.type === 'text') {
          return <span key={i}>{seg.value}</span>;
        }

        const isHashtag = seg.type === 'hashtag';

        return (
          <span
            key={i}
            onClick={(e) => {
              e.stopPropagation();
              if (isHashtag) onHashtag?.(seg.value.replace('#', ''));
              else onMention?.(seg.value.replace('@', ''));
            }}
            className={`cursor-pointer font-semibold hover:underline ${
              isHashtag ? 'text-[#D4AF37]' : 'text-sky-400'
            }`}
          >
            {seg.value}
          </span>
        );
      })}
    </>
  );
};
