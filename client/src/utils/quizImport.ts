// src/utils/quizImport.ts
import type { QuizItemType } from '../types/lms';

export interface QuizImportDraft {
  text: string;
  type: QuizItemType;
  options: string[];
  correctAnswer: string;
  points: number;
}

export interface ExtractedQuizText {
  text: string;
  truncated: boolean;
}

export const QUIZ_IMPORT_MAX_BYTES = 10 * 1024 * 1024;
export const QUIZ_IMPORT_TEXT_LIMIT = 200_000;

export function isQuizImportTooLarge(sizeBytes: number): boolean {
  return sizeBytes > QUIZ_IMPORT_MAX_BYTES;
}

export function applyQuizTextLimit(text: string): ExtractedQuizText {
  if (text.length <= QUIZ_IMPORT_TEXT_LIMIT) return { text, truncated: false };
  return { text: text.slice(0, QUIZ_IMPORT_TEXT_LIMIT), truncated: true };
}

export function classifyQuizImportFile(fileName: string): 'pdf' | 'docx' | 'text' | 'unsupported' {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.pdf')) return 'pdf';
  if (lower.endsWith('.docx')) return 'docx';
  if (lower.endsWith('.txt') || lower.endsWith('.md') || lower.endsWith('.json') || lower.endsWith('.csv')) return 'text';
  return 'unsupported';
}

interface Builder {
  type: QuizItemType;
  text: string;
  options: string[];
  correctAnswer: string;
  points: number;
  sawOptions: boolean;
  sawKey: boolean;
}

function freshBuilder(): Builder {
  return { type: 'multiple_choice', text: '', options: [], correctAnswer: 'A', points: 5, sawOptions: false, sawKey: false };
}

function finalizeBuilder(b: Builder): QuizImportDraft {
  const cleanText = b.text.replace(/^(?:Q(?:uestion)?\s*\d+[:.]|\d+[\.\)])\s*/i, '').trim() || 'Untitled Question';
  if (b.type === 'multiple_choice' && !b.sawOptions && !b.sawKey) {
    return { text: cleanText, type: 'identification', options: [], correctAnswer: '', points: b.points };
  }
  if (b.type === 'multiple_choice') {
    const options = b.options.length > 0 ? b.options : ['Option A', 'Option B', 'Option C', 'Option D'];
    const correctAnswer = ['A', 'B', 'C', 'D', 'E', 'F'].includes(b.correctAnswer) ? b.correctAnswer : 'A';
    return { text: cleanText, type: 'multiple_choice', options, correctAnswer, points: b.points };
  }
  return { text: cleanText, type: 'true_false', options: ['True', 'False'], correctAnswer: b.correctAnswer === 'False' ? 'False' : 'True', points: b.points };
}

function tryParseJson(text: string): QuizImportDraft[] | null {
  try {
    const parsed: any = JSON.parse(text);
    const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.questions) ? parsed.questions : Array.isArray(parsed?.items) ? parsed.items : null;
    if (!list || list.length === 0) return null;
    return list.map((item: any) => {
      const type = (item.type as QuizItemType) || 'multiple_choice';
      return {
        text: String(item.text ?? item.question ?? item.prompt ?? 'Untitled Question').trim(),
        type,
        options: Array.isArray(item.options) ? item.options.map(String) : type === 'multiple_choice' ? ['Option A', 'Option B', 'Option C', 'Option D'] : type === 'true_false' ? ['True', 'False'] : [],
        correctAnswer: String(item.correctAnswer ?? (type === 'multiple_choice' ? 'A' : type === 'true_false' ? 'True' : '')),
        points: Number(item.points) || 5,
      } as QuizImportDraft;
    });
  } catch {
    return null;
  }
}

export function parseQuizText(text: string): QuizImportDraft[] {
  const fromJson = tryParseJson(text);
  if (fromJson) return fromJson;

  const drafts: QuizImportDraft[] = [];
  let cur = freshBuilder();
  const push = () => {
    if (!cur.text.trim()) return;
    drafts.push(finalizeBuilder(cur));
    cur = freshBuilder();
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      // Blank line ends a question only once an answer key was seen: DOCX
      // extraction (mammoth) emits blank lines between every paragraph,
      // including between a question's own options — pushing there would
      // split the question before its key arrives.
      if (cur.text.trim() && cur.options.length >= 2 && cur.sawKey) push();
      continue;
    }
    const qNum = trimmed.match(/^(?:Q(?:uestion)?\s*\d+[:.]|\d+[\.\)])\s*(.*)/i);
    if (qNum) {
      push();
      const prompt = qNum[1].trim() || trimmed;
      const numPts = prompt.match(/(?:(?:Points?|Pts?)\s*[:=]\s*|[\(\[])\s*(\d+)\s*(?:pts|points?)?\s*[\)\]]?/i);
      if (numPts) cur.points = parseInt(numPts[1], 10) || 5;
      cur.text = prompt;
      continue;
    }
    if (/^(?:True\s*[\/\-]\s*False|T\s*\/\s*F)\b/i.test(trimmed)) {
      cur.type = 'true_false';
      cur.sawKey = true;
      cur.correctAnswer = /true/i.test(trimmed) ? 'True' : 'False';
      continue;
    }
    const opt = trimmed.match(/^(?:[\(\[]?([A-Fa-f])[\)\]\.\:]\s*)(.*)/);
    if (opt) {
      cur.type = 'multiple_choice';
      cur.sawOptions = true;
      cur.options.push(opt[2].trim());
      continue;
    }
    const ans = trimmed.match(/^(?:Answer|Ans|Key|Correct(?:\s*Answer)?)\s*[:=-]\s*(.*)/i);
    if (ans) {
      const val = ans[1].trim();
      cur.sawKey = true;
      if (/^(?:True|False)$/i.test(val)) {
        cur.type = 'true_false';
        cur.correctAnswer = val.toLowerCase() === 'false' ? 'False' : 'True';
      } else if (/^[A-Fa-f]$/.test(val)) {
        cur.correctAnswer = val.toUpperCase();
      } else {
        cur.correctAnswer = val;
      }
      continue;
    }
    const pts = trimmed.match(/(?:(?:Points?|Pts?)\s*[:=]\s*|[\(\[])\s*(\d+)\s*(?:pts|points?)?\s*[\)\]]?/i);
    if (pts) cur.points = parseInt(pts[1], 10) || 5;
    cur.text = cur.text ? `${cur.text} ${trimmed}` : trimmed;
  }
  push();

  if (drafts.length === 0 && text.trim()) {
    return [{ text: text.trim().slice(0, 150), type: 'identification', options: [], correctAnswer: '', points: 5 }];
  }
  return drafts;
}
