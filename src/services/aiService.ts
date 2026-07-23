// AI Service - Chat with LLM that understands your Aura app
import { Task, Goal, Habit, Note, Idea, AppState } from '../types';

export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AIConfig {
  provider: 'openai' | 'anthropic' | 'openrouter' | 'custom';
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface AIToolCall {
  type: 'add_task' | 'add_tasks_batch' | 'add_goal' | 'add_habit' | 'add_note' | 'complete_task' | 'uncomplete_task' | 'delete_task' | 'delete_habit' | 'ask_question';
  data: any;
}

const DEFAULT_CONFIGS: Record<string, { baseUrl: string; model: string }> = {
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  anthropic: { baseUrl: 'https://api.anthropic.com', model: 'claude-3-haiku-20240307' },
  openrouter: { baseUrl: 'https://openrouter.ai/api/v1', model: 'nvidia/nemotron-3-ultra-550b-a55b:free' },
  custom: { baseUrl: '', model: '' }
};

export function getAIConfig(): AIConfig {
  const saved = localStorage.getItem('aura-ai-config');
  if (saved) {
    try { return JSON.parse(saved); } catch {}
  }
  return { provider: 'openrouter', apiKey: '', baseUrl: DEFAULT_CONFIGS.openrouter.baseUrl, model: DEFAULT_CONFIGS.openrouter.model };
}

export function saveAIConfig(config: AIConfig): void {
  localStorage.setItem('aura-ai-config', JSON.stringify(config));
}

function buildSystemPrompt(state: AppState): string {
  const tasksSummary = state.tasks.slice(0, 30).map(t => 
    `- [${t.status === 'completed' ? '✓' : '○'}] ${t.title} (приоритет: ${t.priority}, категория: ${t.category}${t.dueDate ? ', срок: ' + t.dueDate : ''})`
  ).join('\n');

  const goalsSummary = state.goals.slice(0, 15).map(g => {
    const progress = g.taskIds?.length ? ` (${g.taskIds.length} задач)` : '';
    return `- ${g.title}${progress}${g.targetDate ? ' (дедлайн: ' + g.targetDate + ')' : ''}`;
  }).join('\n');

  const habitsSummary = state.habits.slice(0, 15).map(h => 
    `- ${h.title} (${h.frequency === 'daily' ? 'ежедневно' : 'еженедельно'}, серия: ${h.streak} дней)`
  ).join('\n');

  return `Ты — AI-ассистент Aura, персональный умный помощник для управления задачами, целями и привычками.

## Твои возможности:
1. **Создавать задачи** — когда пользователь просит добавить задачу
2. **Отмечать задачи выполнеными** — когда пользователь говорит что-то вроде "я выполнил X", "сделал X", "выполнил X"
3. **Создавать цели** — когда пользователь ставит перед собой цель
4. **Создавать привычки** — когда пользователь хочет начать регулярное действие
5. **Создавать заметки** — когда пользователь хочет записать мысль
6. **Задавать уточняющие вопросы** — если информации недостаточно
7. **Давать советы** по продуктивности и организации

## Текущее состояние пользователя:

### Задачи (первые 30):
${tasksSummary || 'Нет задач'}

### Цели:
${goalsSummary || 'Нет целей'}

### Привычки:
${habitsSummary || 'Нет привычек'}

## Формат ответа:
Когда пользователь просит создать/выполнить/удалить элемент, ты ДОЛЖЕН в самом конце ответа добавить JSON-блок с инструкцией для приложения:

\`\`\`action
{"type": "add_task", "data": {"title": "...", "category": "...", "priority": "medium", "dueDate": "YYYY-MM-DD"}}
\`\`\`

Доступные типы действий:
- add_task: {title, category, priority, dueDate, estimatedTime}
- add_tasks_batch: [{title, category, priority, dueDate, estimatedTime}, ...]
- add_goal: {title, description, targetDate}
- add_habit: {title, frequency: "daily"|"weekly"}
- add_note: {title, content}
- complete_task: {title} — найти задачу по названию и отметить выполненной
- uncomplete_task: {title} — снять статус выполнения
- delete_task: {title} — удалить задачу
- delete_habit: {title} — удалить привычку

## Важные правила:
- Всегда отвечай на русском языке
- Будь дружелюбным и supportive
- Если пользователь говорит "сделал тренировку" — найди соответствующую задачу/привычку и отметь выполненной
- Если информации мало — спроси уточнение (но не создавай элемент пока)
- Можно создавать несколько элементов за раз
- Дедлайны и даты формата YYYY-MM-DD
- Приоритеты: low, medium, high`;
}

export async function sendAIMessage(
  messages: AIMessage[],
  state: AppState,
  config?: AIConfig
): Promise<{ content: string; actions: AIToolCall[] }> {
  const aiConfig = config || getAIConfig();
  
  if (!aiConfig.apiKey) {
    return {
      content: 'Для работы AI-ассистента нужно настроить API-ключ. Откройте настройки и вставьте ключ от OpenAI, Claude или другой совместимой нейросети.',
      actions: []
    };
  }

  const systemPrompt = buildSystemPrompt(state);
  const fullMessages: AIMessage[] = [
    { role: 'system', content: systemPrompt },
    ...messages
  ];

  try {
    if (aiConfig.provider === 'anthropic') {
      return await callAnthropic(fullMessages, aiConfig);
    } else {
      return await callOpenAICompatible(fullMessages, aiConfig);
    }
  } catch (error: any) {
    console.error('AI API Error:', error);
    return {
      content: `Ошибка при обращении к нейросети: ${error.message || 'Неизвестная ошибка'}. Проверьте API-ключ и настройки.`,
      actions: []
    };
  }
}

async function callOpenAICompatible(messages: AIMessage[], config: AIConfig): Promise<{ content: string; actions: AIToolCall[] }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${config.apiKey}`
  };

  // Add OpenRouter-specific headers
  if (config.provider === 'openrouter') {
    headers['HTTP-Referer'] = window.location.origin;
    headers['X-Title'] = 'Aura App';
  }

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: 0.7,
      max_tokens: 1500
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content || '';

  return { content, actions: extractActions(content) };
}

async function callAnthropic(messages: AIMessage[], config: AIConfig): Promise<{ content: string; actions: AIToolCall[] }> {
  const systemMsg = messages.find(m => m.role === 'system')?.content || '';
  const chatMessages = messages.filter(m => m.role !== 'system');

  const response = await fetch(`${config.baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 1500,
      system: systemMsg,
      messages: chatMessages
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  const data = await response.json();
  const content = data.content?.[0]?.text || '';
  
  return { content, actions: extractActions(content) };
}

function extractActions(content: string): AIToolCall[] {
  const actions: AIToolCall[] = [];
  const actionRegex = /```action\n([\s\S]*?)\n```/g;
  let match;

  while ((match = actionRegex.exec(content)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed.type && parsed.data) {
        actions.push(parsed as AIToolCall);
      }
    } catch (e) {
      console.warn('Failed to parse AI action:', e);
    }
  }

  return actions;
}
