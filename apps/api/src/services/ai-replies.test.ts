import { describe, expect, it } from 'vitest';
import { parseRepliesAnswers, fallbackReplies } from './smart-replies.js';

describe('smart replies parsing', () => {
  it('parses a JSON array from the LLM', () => {
    const out = '["Sounds good", "Tell me more", "Let me check"]';
    expect(parseRepliesAnswers(out)).toEqual(['Sounds good', 'Tell me more', 'Let me check']);
  });

  it('parses newline-separated bullets', () => {
    const out = '- Yes please\n• No thanks\n2) Maybe later';
    expect(parseRepliesAnswers(out)).toEqual(['Yes please', 'No thanks', 'Maybe later']);
  });

  it('trims and drops empties, caps nothing', () => {
    const out = '  one  \n\n  two  ';
    expect(parseRepliesAnswers(out)).toEqual(['one', 'two']);
  });

  it('parses a json array containing apostrophes', () => {
    const out = '["It\'s a deal", "Ok, thank you"]';
    expect(parseRepliesAnswers(out)).toEqual(["It's a deal", 'Ok, thank you']);
  });
});
