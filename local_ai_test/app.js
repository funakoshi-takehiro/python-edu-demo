import { pipeline, TextStreamer, env } from
  'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3';

// ── 環境設定 ────────────────────────────────────────────────────────────────
env.allowLocalModels  = false;
env.useBrowserCache   = true;   // IndexedDB にキャッシュ（再起動高速化）

// ── システムプロンプト ────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a supportive learning assistant for high school students (ages 15–18).
Your mission is to help students THINK for themselves — never to do the work for them.

CORE RULES:
1. NEVER give direct answers to homework, assignments, tests, or exam questions.
2. Instead, use the Socratic method: guide students with hints and questions.
   - Ask: "What have you tried so far?" / "What do you already know about this topic?"
   - Break the problem into smaller steps and guide through each one.
   - Give hints, not solutions. Point to concepts, not answers.
3. For mistakes: acknowledge the effort first ("Good thinking! Let's look at this part together..."),
   then guide toward the correct reasoning.
4. Encourage a growth mindset — praise effort and persistence.
5. Keep explanations appropriate for high school level (clear, not overly technical).

WHAT YOU MUST NOT DO:
- Provide direct solutions to any assignments or exam questions.
- Help with academic dishonesty or cheating in any form.
- Generate violent, discriminatory, adult, or otherwise inappropriate content.
- Engage deeply with topics unrelated to learning (e.g., games, celebrity gossip).

LANGUAGE RULE:
Respond in the same language the student uses.
If the student writes in Japanese → reply in Japanese.
If in English → reply in English.
Always match the student's language.`;

// ── モデル一覧 ──────────────────────────────────────────────────────────────
const MODELS = [
  {
    id:          'smollm3',
    name:        'SmolLM3-3B',
    hfId:        'HuggingFaceTB/SmolLM3-3B-Instruct',
    label:       '🌐 多言語対応（日本語 OK）',
    description: '日本語・英語など多言語に対応。高品質な回答が得られます。',
    sizeNote:    '約1.7GB（初回DL: Wi-Fi環境で約3〜5分）',
    badge:       { text: '日本語OK', cls: 'badge-green' },
    dtype:       'q4',
    device:      'auto',
    warning:     null,
  },
  {
    id:          'bonsai17b',
    name:        'Bonsai-1.7B',
    hfId:        'onnx-community/Bonsai-1.7B-ONNX',
    label:       '🧠 賢さ重視',
    description: '1-bit量子化モデルで高品質な推論が得意。WebGPU(GPU)が必要。',
    sizeNote:    '約290MB（初回DL: 約1〜2分）※WebGPU初期化に数分かかる場合あり',
    badge:       { text: '英語のみ', cls: 'badge-orange' },
    dtype:       'q1',
    device:      'webgpu',
    warning:     'WebGPU（GPU）が必要です。GPUなしのPCでは起動しません。',
  },
  {
    id:          'smollm2-360m',
    name:        'SmolLM2-360M',
    hfId:        'HuggingFaceTB/SmolLM2-360M-Instruct',
    label:       '⚡ バランス型',
    description: '速度と品質のバランスが良く、ほぼ全ての端末で動作します。',
    sizeNote:    '約200MB（初回DL: 約1分）',
    badge:       { text: '英語のみ', cls: 'badge-orange' },
    dtype:       'q4',
    device:      'auto',
    warning:     null,
  },
  {
    id:          'smollm2-135m',
    name:        'SmolLM2-135M',
    hfId:        'HuggingFaceTB/SmolLM2-135M-Instruct',
    label:       '🚀 最軽量',
    description: '最も軽量で高速。古い低スペックPCや実験・デモ向け。',
    sizeNote:    '約100MB（初回DL: 約30秒）',
    badge:       { text: '英語のみ', cls: 'badge-orange' },
    dtype:       'q4',
    device:      'auto',
    warning:     null,
  },
];

// ── 状態 ────────────────────────────────────────────────────────────────────
let selectedModel  = null;
let pipe           = null;
let chatHistory    = [];   // { role, content }[] — タブを閉じるとリセット
let isGenerating   = false;

// ── DOM 参照 ────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const screens = {
  select: $('screen-select'),
  load:   $('screen-load'),
  chat:   $('screen-chat'),
};

// ── 画面切替 ─────────────────────────────────────────────────────────────────
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
}

// ── モデルカード描画 ────────────────────────────────────────────────────────
function renderModelCards() {
  const grid = $('model-grid');
  grid.innerHTML = MODELS.map(m => `
    <button class="model-card" data-id="${m.id}" type="button">
      <div class="card-top">
        <span class="card-label">${m.label}</span>
        <span class="badge ${m.badge.cls}">${m.badge.text}</span>
      </div>
      <h3 class="card-name">${m.name}</h3>
      <p class="card-desc">${m.description}</p>
      <p class="card-size">📦 ${m.sizeNote}</p>
      ${m.warning ? `<p class="card-warn">⚠️ ${m.warning}</p>` : ''}
    </button>
  `).join('');

  grid.querySelectorAll('.model-card').forEach(card => {
    card.addEventListener('click', () => {
      grid.querySelectorAll('.model-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      selectedModel = MODELS.find(m => m.id === card.dataset.id);
      $('btn-start').disabled = false;
    });
  });
}

// ── モデル読み込み ────────────────────────────────────────────────────────────
async function loadModel(model) {
  showScreen('load');
  $('load-title').textContent = `${model.name} を準備しています...`;
  $('progress-fill').style.width = '0%';
  $('progress-label').textContent = '0%';

  const fileProgress = {};

  try {
    pipe = await pipeline('text-generation', model.hfId, {
      dtype:  model.dtype,
      device: model.device,
      progress_callback: ({ status, file, loaded, total, progress }) => {
        if (status === 'initiate') {
          fileProgress[file] = { loaded: 0, total: total || 0 };
        } else if (status === 'progress') {
          fileProgress[file] = { loaded: loaded || 0, total: total || 1 };
          const sumLoaded = Object.values(fileProgress).reduce((s, f) => s + f.loaded, 0);
          const sumTotal  = Object.values(fileProgress).reduce((s, f) => s + f.total,  0);
          const pct = sumTotal > 0
            ? Math.min(Math.round(sumLoaded / sumTotal * 100), 99)
            : Math.round(progress ?? 0);
          $('progress-fill').style.width = `${pct}%`;
          $('progress-label').textContent = `${pct}%`;
          $('load-file').textContent = file ?? '';
        } else if (status === 'done') {
          $('progress-fill').style.width = '99%';
          if (model.device === 'webgpu') {
            $('load-title').textContent = 'WebGPU シェーダーを初期化中...';
            $('load-file').textContent = '初回のみ数分かかる場合があります。このまましばらくお待ちください。';
            $('progress-label').textContent = 'コンパイル中...';
          }
        } else if (status === 'ready') {
          $('progress-fill').style.width = '100%';
          $('progress-label').textContent = '起動完了！';
        }
      },
    });

    initChat(model);
    showScreen('chat');

  } catch (err) {
    console.error(err);
    const msg = err.message ?? String(err);
    const hint = model.device === 'webgpu'
      ? '\n\nヒント: このモデルはWebGPU(GPU)が必要です。他のモデルをお試しください。'
      : '\n\nブラウザのキャッシュをクリアして再試行するか、別のモデルをお試しください。';
    alert(`モデルの読み込みに失敗しました。\n\n${msg}${hint}`);
    showScreen('select');
  }
}

// ── チャット初期化 ─────────────────────────────────────────────────────────
function initChat(model) {
  $('header-model-name').textContent = model.name;
  const badge = $('header-badge');
  badge.textContent  = model.badge.text;
  badge.className    = `badge ${model.badge.cls}`;

  $('messages').innerHTML = '';
  chatHistory = [];
  $('btn-send').disabled  = false;

  const langNote = model.badge.cls === 'badge-orange'
    ? '\n\n⚠️ このモデルは英語専用です。英語（English）で質問してください。'
    : '';
  appendMessage('ai',
    `こんにちは！ **${model.name}** を使って学習をサポートします。\n` +
    `分からないことがあれば、何でも聞いてみてください。${langNote}`
  );
}

// ── メッセージ表示 ─────────────────────────────────────────────────────────
function appendMessage(role, content) {
  const wrap = document.createElement('div');
  wrap.className = `message message-${role}`;
  wrap.innerHTML = `
    <div class="bubble">
      <span class="role-label">${role === 'user' ? '生徒' : 'AI'}</span>
      <div class="bubble-text">${renderContent(content)}</div>
    </div>`;
  $('messages').appendChild(wrap);
  $('messages').scrollTop = $('messages').scrollHeight;
  return wrap;
}

function updateBubbleText(msgEl, content, streaming = false) {
  msgEl.querySelector('.bubble-text').innerHTML = renderContent(content);
  msgEl.classList.toggle('streaming', streaming);
  $('messages').scrollTop = $('messages').scrollHeight;
}

function renderContent(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
}

// ── メッセージ送信 ─────────────────────────────────────────────────────────
async function sendMessage() {
  if (isGenerating || !pipe) return;

  const inputEl = $('input-box');
  const text = inputEl.value.trim();
  if (!text) return;

  inputEl.value = '';
  inputEl.style.height = 'auto';
  $('btn-send').disabled = true;
  isGenerating = true;

  appendMessage('user', text);
  chatHistory.push({ role: 'user', content: text });

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...chatHistory,
  ];

  const aiEl = appendMessage('ai', '');
  aiEl.classList.add('streaming');
  let aiContent = '';

  try {
    const streamer = new TextStreamer(pipe.tokenizer, {
      skip_prompt:        true,
      skip_special_tokens: true,
      callback_function: token => {
        aiContent += token;
        updateBubbleText(aiEl, aiContent, true);
      },
    });

    await pipe(messages, {
      max_new_tokens: 512,
      do_sample:      false,
      streamer,
    });

    updateBubbleText(aiEl, aiContent, false);
    chatHistory.push({ role: 'assistant', content: aiContent });

  } catch (err) {
    console.error(err);
    updateBubbleText(aiEl, `⚠️ エラーが発生しました: ${err.message}`, false);
  } finally {
    isGenerating = false;
    $('btn-send').disabled = false;
    inputEl.focus();
  }
}

// ── Word 出力（.doc HTML Blob方式） ──────────────────────────────────────────
function downloadAsWord() {
  const displayHistory = chatHistory.filter(m => m.role !== 'system');
  if (displayHistory.length === 0) {
    alert('まだ会話がありません。');
    return;
  }

  const date     = new Date().toLocaleDateString('ja-JP', { year:'numeric', month:'2-digit', day:'2-digit' });
  const modelName = selectedModel?.name ?? '';

  const rows = displayHistory.map(m => `
    <tr>
      <td style="width:70px;font-weight:bold;color:${m.role==='user'?'#3b5bdb':'#2f9e44'};
                 padding:8px 10px;border:1px solid #dee2e6;vertical-align:top;white-space:nowrap;">
        ${m.role === 'user' ? '生徒' : 'AI'}
      </td>
      <td style="padding:8px 10px;border:1px solid #dee2e6;line-height:1.7;">
        ${escHtml(m.content).replace(/\n/g, '<br>')}
      </td>
    </tr>`).join('');

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:w="urn:schemas-microsoft-com:office:word"
          xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8">
      <title>AI学習アシスタント 会話履歴</title>
      <style>
        body  { font-family:'Yu Gothic','Hiragino Kaku Gothic Pro',sans-serif; font-size:11pt; margin:25mm; }
        h1    { font-size:16pt; color:#3b5bdb; border-bottom:2px solid #3b5bdb; padding-bottom:6px; }
        .meta { font-size:9pt; color:#868e96; margin:4px 0 20px; }
        table { width:100%; border-collapse:collapse; }
      </style>
    </head>
    <body>
      <h1>🎓 AI学習アシスタント — 会話履歴</h1>
      <p class="meta">記録日: ${date}　／　モデル: ${modelName}</p>
      <table>${rows}</table>
    </body>
    </html>`;

  const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), {
    href:     url,
    download: `AI学習記録_${date.replace(/\//g,'')}.doc`,
  });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── イベントリスナー ──────────────────────────────────────────────────────
$('btn-start').addEventListener('click', () => {
  if (selectedModel) loadModel(selectedModel);
});

$('btn-back').addEventListener('click', () => {
  if (isGenerating) return;
  if (chatHistory.length > 0 &&
      !confirm('モデル選択に戻りますか？（会話履歴は消えます）')) return;
  if (pipe) { pipe.dispose?.(); pipe = null; }
  chatHistory = [];
  showScreen('select');
});

$('btn-export').addEventListener('click', downloadAsWord);

$('btn-send').addEventListener('click', sendMessage);

$('input-box').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

$('input-box').addEventListener('input', function () {
  this.style.height = 'auto';
  this.style.height = Math.min(this.scrollHeight, 120) + 'px';
});

// ── 起動 ──────────────────────────────────────────────────────────────────
renderModelCards();
