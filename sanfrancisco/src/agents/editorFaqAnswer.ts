import type { AIGrant, Env, Usage } from '../types';
import { HttpError, asString, isRecord } from '../http';
import { getGrantMaxTokens, getGrantTimeoutMs } from '../grants';
import { callChatCompletion } from '../ai/chat';

type FaqCopilotAction = 'answer' | 'rewrite_question' | 'add_faqs' | 'new_section';

type AnswerInput = {
  action?: 'answer';
  path: string;
  question: string;
  existingAnswer?: string;
  instruction?: string;
};

type RewriteQuestionInput = {
  action: 'rewrite_question';
  path: string;
  existingQuestion: string;
  sectionTitle?: string;
  instruction?: string;
};

type AddFaqsInput = {
  action: 'add_faqs';
  sectionIndex: number;
  sectionTitle?: string;
  existingQuestions?: string[];
  insertIndex: number;
  count: number;
  instruction?: string;
};

type NewSectionInput = {
  action: 'new_section';
  insertIndex: number;
  sectionsCount: number;
  existingSectionTitles?: string[];
  count: number;
  instruction?: string;
};

type FaqCopilotInput = AnswerInput | RewriteQuestionInput | AddFaqsInput | NewSectionInput;

type FaqCopilotResult = {
  ops: Array<
    | { op: 'set'; path: string; value: string }
    | { op: 'insert'; path: string; index: number; value: unknown }
  >;
};

function parseJsonFromModel(raw: string, provider: string): unknown {
  const trimmed = raw.trim();
  let cleaned = trimmed;

  if (cleaned.startsWith('```')) {
    const lines = cleaned.split('\n');
    lines.shift(); // ``` or ```json
    while (lines.length && lines[lines.length - 1]?.trim() === '```') lines.pop();
    cleaned = lines.join('\n').trim();
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    // try to salvage a JSON object/array embedded in text
    const firstObj = cleaned.indexOf('{');
    const lastObj = cleaned.lastIndexOf('}');
    if (firstObj >= 0 && lastObj > firstObj) {
      const slice = cleaned.slice(firstObj, lastObj + 1);
      try {
        return JSON.parse(slice);
      } catch {
        // continue
      }
    }
    const firstArr = cleaned.indexOf('[');
    const lastArr = cleaned.lastIndexOf(']');
    if (firstArr >= 0 && lastArr > firstArr) {
      const slice = cleaned.slice(firstArr, lastArr + 1);
      try {
        return JSON.parse(slice);
      } catch {
        // continue
      }
    }
    throw new HttpError(502, { code: 'PROVIDER_ERROR', provider, message: 'Model did not return valid JSON' });
  }
}

function parseAction(input: Record<string, unknown>): FaqCopilotAction {
  const action = (asString(input.action) ?? '').trim();
  if (!action) return 'answer';
  if (action === 'answer' || action === 'rewrite_question' || action === 'add_faqs' || action === 'new_section') return action;
  throw new HttpError(400, { code: 'BAD_REQUEST', message: 'Invalid input', issues: [{ path: 'input.action', message: 'Unsupported action' }] });
}

function parseAnswerInput(input: Record<string, unknown>): AnswerInput {
  const path = (asString(input.path) ?? '').trim();
  const question = (asString(input.question) ?? '').trim();
  const existingAnswer = (asString(input.existingAnswer) ?? '').trim();
  const instruction = (asString(input.instruction) ?? '').trim();

  const issues: Array<{ path: string; message: string }> = [];
  if (!path) issues.push({ path: 'input.path', message: 'Missing required value' });
  if (path && !/^sections\.\d+\.faqs\.\d+\.answer$/.test(path)) {
    issues.push({ path: 'input.path', message: 'Path must target an FAQ answer field' });
  }
  if (!question) issues.push({ path: 'input.question', message: 'Missing required value' });
  if (issues.length) throw new HttpError(400, { code: 'BAD_REQUEST', message: 'Invalid input', issues });

  return {
    action: 'answer',
    path,
    question,
    ...(existingAnswer ? { existingAnswer } : {}),
    ...(instruction ? { instruction } : {}),
  };
}

function parseRewriteQuestionInput(input: Record<string, unknown>): RewriteQuestionInput {
  const path = (asString(input.path) ?? '').trim();
  const existingQuestion = (asString(input.existingQuestion) ?? '').trim();
  const sectionTitle = (asString(input.sectionTitle) ?? '').trim();
  const instruction = (asString(input.instruction) ?? '').trim();

  const issues: Array<{ path: string; message: string }> = [];
  if (!path) issues.push({ path: 'input.path', message: 'Missing required value' });
  if (path && !/^sections\.\d+\.faqs\.\d+\.question$/.test(path)) {
    issues.push({ path: 'input.path', message: 'Path must target an FAQ question field' });
  }
  if (!existingQuestion) issues.push({ path: 'input.existingQuestion', message: 'Missing required value' });
  if (issues.length) throw new HttpError(400, { code: 'BAD_REQUEST', message: 'Invalid input', issues });

  return {
    action: 'rewrite_question',
    path,
    existingQuestion,
    ...(sectionTitle ? { sectionTitle } : {}),
    ...(instruction ? { instruction } : {}),
  };
}

function parseAddFaqsInput(input: Record<string, unknown>): AddFaqsInput {
  const sectionIndex = typeof input.sectionIndex === 'number' ? input.sectionIndex : Number.NaN;
  const insertIndex = typeof input.insertIndex === 'number' ? input.insertIndex : Number.NaN;
  const count = typeof input.count === 'number' ? input.count : Number.NaN;
  const sectionTitle = (asString(input.sectionTitle) ?? '').trim();
  const instruction = (asString(input.instruction) ?? '').trim();
  const existingQuestions =
    Array.isArray(input.existingQuestions) && input.existingQuestions.every((q) => typeof q === 'string')
      ? (input.existingQuestions as string[]).map((q) => q.trim()).filter(Boolean)
      : undefined;

  const issues: Array<{ path: string; message: string }> = [];
  if (!Number.isInteger(sectionIndex) || sectionIndex < 0) issues.push({ path: 'input.sectionIndex', message: 'sectionIndex must be an integer >= 0' });
  if (!Number.isInteger(insertIndex) || insertIndex < 0) issues.push({ path: 'input.insertIndex', message: 'insertIndex must be an integer >= 0' });
  if (!Number.isInteger(count) || count <= 0 || count > 10) issues.push({ path: 'input.count', message: 'count must be 1–10' });
  if (issues.length) throw new HttpError(400, { code: 'BAD_REQUEST', message: 'Invalid input', issues });

  return {
    action: 'add_faqs',
    sectionIndex,
    insertIndex,
    count,
    ...(sectionTitle ? { sectionTitle } : {}),
    ...(existingQuestions ? { existingQuestions } : {}),
    ...(instruction ? { instruction } : {}),
  };
}

function parseNewSectionInput(input: Record<string, unknown>): NewSectionInput {
  const insertIndex = typeof input.insertIndex === 'number' ? input.insertIndex : Number.NaN;
  const sectionsCount = typeof input.sectionsCount === 'number' ? input.sectionsCount : Number.NaN;
  const count = typeof input.count === 'number' ? input.count : Number.NaN;
  const instruction = (asString(input.instruction) ?? '').trim();
  const existingSectionTitles =
    Array.isArray(input.existingSectionTitles) && input.existingSectionTitles.every((t) => typeof t === 'string')
      ? (input.existingSectionTitles as string[]).map((t) => t.trim()).filter(Boolean)
      : undefined;

  const issues: Array<{ path: string; message: string }> = [];
  if (!Number.isInteger(insertIndex) || insertIndex < 0) issues.push({ path: 'input.insertIndex', message: 'insertIndex must be an integer >= 0' });
  if (!Number.isInteger(sectionsCount) || sectionsCount < 0) issues.push({ path: 'input.sectionsCount', message: 'sectionsCount must be an integer >= 0' });
  if (!Number.isInteger(count) || count <= 0 || count > 10) issues.push({ path: 'input.count', message: 'count must be 1–10' });
  if (issues.length) throw new HttpError(400, { code: 'BAD_REQUEST', message: 'Invalid input', issues });

  return {
    action: 'new_section',
    insertIndex,
    sectionsCount,
    count,
    ...(existingSectionTitles ? { existingSectionTitles } : {}),
    ...(instruction ? { instruction } : {}),
  };
}

function parseFaqCopilotInput(input: unknown): FaqCopilotInput {
  if (!isRecord(input)) throw new HttpError(400, { code: 'BAD_REQUEST', message: 'Invalid input', issues: [{ path: 'input', message: 'Expected an object' }] });
  const action = parseAction(input);
  if (action === 'answer') return parseAnswerInput(input);
  if (action === 'rewrite_question') return parseRewriteQuestionInput(input);
  if (action === 'add_faqs') return parseAddFaqsInput(input);
  return parseNewSectionInput(input);
}

function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

async function callFaqChat(args: {
  env: Env;
  grant: AIGrant;
  system: string;
  user: string;
  maxTokens: number;
  timeoutMs: number;
}): Promise<{ content: string; usage: Usage }> {
  return callChatCompletion({
    env: args.env,
    grant: args.grant,
    agentId: 'editor.faq.answer.v1',
    messages: [
      { role: 'system', content: args.system },
      { role: 'user', content: args.user },
    ],
    temperature: 0.3,
    maxTokens: args.maxTokens,
    timeoutMs: args.timeoutMs,
  });
}

function faqSystemBase(): string {
  return [
    'You are Copilot for the Clickeen FAQ widget editor.',
    '',
    'Output rules:',
    '- Return ONLY JSON.',
    '- Do not wrap JSON in markdown fences.',
    '- Do not include surrounding text.',
    '',
    'HTML rules for answers:',
    '- Allowed inline tags: <strong>, <b>, <em>, <i>, <u>, <s>, <a>, <br>.',
    '- No other tags.',
    '- Links must be absolute and start with https://.',
  ].join('\n');
}

export async function executeEditorFaqAnswer(params: { grant: AIGrant; input: unknown }, env: Env): Promise<{ result: FaqCopilotResult; usage: Usage }> {
  const input = parseFaqCopilotInput(params.input);
  const maxTokens = getGrantMaxTokens(params.grant);
  const timeoutMs = getGrantTimeoutMs(params.grant);

  if (input.action === 'answer') {
    const system = [
      faqSystemBase(),
      '',
      'Task:',
      'Write a concise, helpful answerHtml to the question.',
      'Keep it scannable: 1–3 short sentences.',
      '',
      'Return JSON: { "answerHtml": string }',
    ].join('\n');

    const user = [
      `Question: ${input.question}`,
      input.existingAnswer ? `Existing answer: ${input.existingAnswer}` : '',
      input.instruction ? `Instruction: ${input.instruction}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const { content, usage } = await callFaqChat({ env, grant: params.grant, system, user, maxTokens, timeoutMs });
    const provider = usage.provider;
    const parsed = parseJsonFromModel(content, provider);
    if (!isRecord(parsed)) throw new HttpError(502, { code: 'PROVIDER_ERROR', provider, message: 'Model output must be an object' });
    const answerHtml = (asString(parsed.answerHtml) ?? asString((parsed as any).answer) ?? '').trim();
    if (!answerHtml) throw new HttpError(502, { code: 'PROVIDER_ERROR', provider, message: 'Model output missing answerHtml' });

    return { result: { ops: [{ op: 'set', path: input.path, value: answerHtml }] }, usage };
  }

  if (input.action === 'rewrite_question') {
    const system = [
      faqSystemBase(),
      '',
      'Task:',
      'Rewrite the question to be clearer and more specific, without changing meaning.',
      'Keep it short (<= 12 words) and in question form.',
      '',
      'Return JSON: { "question": string }',
    ].join('\n');

    const user = [
      input.sectionTitle ? `Section: ${input.sectionTitle}` : '',
      `Existing question: ${input.existingQuestion}`,
      input.instruction ? `Instruction: ${input.instruction}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const { content, usage } = await callFaqChat({ env, grant: params.grant, system, user, maxTokens, timeoutMs });
    const provider = usage.provider;
    const parsed = parseJsonFromModel(content, provider);
    if (!isRecord(parsed)) throw new HttpError(502, { code: 'PROVIDER_ERROR', provider, message: 'Model output must be an object' });
    const question = (asString((parsed as any).question) ?? '').trim();
    if (!question) throw new HttpError(502, { code: 'PROVIDER_ERROR', provider, message: 'Model output missing question' });

    return { result: { ops: [{ op: 'set', path: input.path, value: question }] }, usage };
  }

  if (input.action === 'add_faqs') {
    const system = [
      faqSystemBase(),
      '',
      'Task:',
      `Create ${input.count} new FAQ items (question + answerHtml) for this section.`,
      'Avoid repeating existing questions.',
      'Keep answers scannable: 1–3 short sentences.',
      '',
      'Return JSON:',
      '{ "items": Array<{ "question": string; "answerHtml": string }> }',
    ].join('\n');

    const user = [
      input.sectionTitle ? `Section: ${input.sectionTitle}` : '',
      input.existingQuestions?.length ? `Existing questions:\n- ${input.existingQuestions.join('\n- ')}` : '',
      input.instruction ? `Instruction: ${input.instruction}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const { content, usage } = await callFaqChat({ env, grant: params.grant, system, user, maxTokens, timeoutMs });
    const provider = usage.provider;
    const parsed = parseJsonFromModel(content, provider);
    if (!isRecord(parsed)) throw new HttpError(502, { code: 'PROVIDER_ERROR', provider, message: 'Model output must be an object' });
    const items = Array.isArray((parsed as any).items) ? ((parsed as any).items as any[]) : null;
    if (!items || items.length === 0) throw new HttpError(502, { code: 'PROVIDER_ERROR', provider, message: 'Model output missing items' });

    const ops: FaqCopilotResult['ops'] = [];
    for (let i = 0; i < Math.min(input.count, items.length); i++) {
      const it = items[i];
      const q = (isRecord(it) ? asString(it.question) : null)?.trim() ?? '';
      const a = (isRecord(it) ? asString(it.answerHtml) : null)?.trim() ?? '';
      if (!q || !a) continue;
      ops.push({
        op: 'insert',
        path: `sections.${input.sectionIndex}.faqs`,
        index: input.insertIndex + ops.length,
        value: { id: newId('q'), question: q, answer: a, defaultOpen: false },
      });
    }
    if (ops.length === 0) throw new HttpError(502, { code: 'PROVIDER_ERROR', provider, message: 'Model items were invalid' });

    return { result: { ops }, usage };
  }

  // new_section
  const system = [
    faqSystemBase(),
    '',
    'Task:',
    `Create a new FAQ section with a title and ${input.count} FAQ items (question + answerHtml).`,
    'Do not repeat existing section titles.',
    'Keep answers scannable: 1–3 short sentences.',
    '',
    'Return JSON:',
    '{ "title": string, "items": Array<{ "question": string; "answerHtml": string }> }',
  ].join('\n');

  const user = [
    input.existingSectionTitles?.length ? `Existing section titles:\n- ${input.existingSectionTitles.join('\n- ')}` : '',
    input.instruction ? `Instruction: ${input.instruction}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const { content, usage } = await callFaqChat({ env, grant: params.grant, system, user, maxTokens, timeoutMs });
  const provider = usage.provider;
  const parsed = parseJsonFromModel(content, provider);
  if (!isRecord(parsed)) throw new HttpError(502, { code: 'PROVIDER_ERROR', provider, message: 'Model output must be an object' });
  const title = (asString((parsed as any).title) ?? '').trim();
  const items = Array.isArray((parsed as any).items) ? ((parsed as any).items as any[]) : null;
  if (!title) throw new HttpError(502, { code: 'PROVIDER_ERROR', provider, message: 'Model output missing title' });
  if (!items || items.length === 0) throw new HttpError(502, { code: 'PROVIDER_ERROR', provider, message: 'Model output missing items' });

  const faqs: Array<{ id: string; question: string; answer: string; defaultOpen: boolean }> = [];
  for (let i = 0; i < Math.min(input.count, items.length); i++) {
    const it = items[i];
    const q = (isRecord(it) ? asString(it.question) : null)?.trim() ?? '';
    const a = (isRecord(it) ? asString(it.answerHtml) : null)?.trim() ?? '';
    if (!q || !a) continue;
    faqs.push({ id: newId('q'), question: q, answer: a, defaultOpen: false });
  }
  if (faqs.length === 0) throw new HttpError(502, { code: 'PROVIDER_ERROR', provider, message: 'Model items were invalid' });

  const section = { id: newId('s'), title, faqs };
  const result: FaqCopilotResult = {
    ops: [{ op: 'insert', path: 'sections', index: input.insertIndex, value: section }],
  };
  return { result, usage };
}
