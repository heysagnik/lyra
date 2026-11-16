const FILLER_OPENER = /^(sure|okay|ok|let me|i will|i'll)\b/i;

export interface AnswerCheck {
  text: string;
  problems: string[];
}

const FULLWIDTH_CITATION = /[【\[]?(\d+)†[^】\]]*[】\]]|【(\d+)】/g;

export function checkAnswer(raw: string, sourceCount: number, truncated = false): AnswerCheck {
  let text = raw.replace(FULLWIDTH_CITATION, (_m, a, b) => `[${a ?? b}]`);

  if (sourceCount === 0) {
    text = text.replace(/\s?\[\d+\]/g, "");
  } else {
    text = text.replace(/\s?\[(\d+)\]/g, (m, n) =>
      Number(n) >= 1 && Number(n) <= sourceCount ? m : ""
    );
  }

  const problems: string[] = [];
  const trimmed = text.trim();
  if (!trimmed) {
    problems.push("The answer was empty.");
  } else {
    if (trimmed.length < 400 && /\b(let me|i will|i'll) (search|check|look|find)/i.test(trimmed)) {
      problems.push("The reply described what you would do instead of answering.");
    } else if (FILLER_OPENER.test(trimmed) && trimmed.length < 80) {
      problems.push("The reply was filler, not an answer.");
    }
    if (sourceCount > 0 && !/\[\d+\]/.test(trimmed)) {
      problems.push("No claim cites the numbered evidence with [n].");
    }
    if (truncated) {
      problems.push("The answer was cut off; give a shorter complete answer.");
    }
  }
  return { text, problems };
}
