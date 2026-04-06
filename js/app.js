/* ==================================================
   Pythonノートブック - アプリケーション本体
   高校生向けプログラミング環境
   ================================================== */

'use strict';

// ============================================================
// グローバル状態
// ============================================================
let pyodide = null;          // Pyodideインスタンス
let cells   = [];            // セルデータの配列
let nextId  = 0;             // セルIDカウンター
let editors = {};            // CodeMirrorインスタンス { id: editor }
let outputs = {};            // 実行結果キャッシュ    { id: result }
let isRunning = false;       // 実行中フラグ

// ============================================================
// 初期化
// ============================================================
window.addEventListener('DOMContentLoaded', () => {
  initApp();
});

async function initApp() {
  setProgress(5, 'Pyodideを読み込んでいます...');

  try {
    // Pyodide本体の読み込み
    pyodide = await loadPyodide({
      indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/'
    });
    setProgress(40, '基本ライブラリ（numpy, pandas, matplotlib）を読み込んでいます...');

    // よく使うパッケージを先読み
    await pyodide.loadPackage(['numpy', 'pandas', 'matplotlib']);
    setProgress(80, 'Python実行環境を準備しています...');

    // Python実行環境のセットアップ
    await pyodide.runPythonAsync(PYTHON_SETUP_CODE);
    setProgress(100, '準備完了！');

    // 少し待ってからロード画面を消す
    await sleep(400);
    document.getElementById('loading-overlay').classList.add('hidden');

    // デフォルトのノートブックを表示
    buildDefaultNotebook();

  } catch (err) {
    setProgress(0, `⚠ 読み込みエラー: ${err.message}`);
    console.error(err);
  }
}

function setProgress(pct, msg) {
  const bar = document.getElementById('loading-bar');
  const status = document.getElementById('loading-status');
  if (bar)    bar.style.width = pct + '%';
  if (status) status.textContent = msg;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ============================================================
// Pythonセットアップコード
// ============================================================
const PYTHON_SETUP_CODE = `
import sys, io, base64, traceback, builtins

# matplotlibを設定（画像として出力できるようにする）
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

# 日本語フォントの設定（利用可能な場合）
try:
    from matplotlib import rcParams
    rcParams['font.family'] = 'DejaVu Sans'
    rcParams['axes.unicode_minus'] = False
except:
    pass

# 標準出力をキャプチャするクラス
class _CapIO:
    def __init__(self):
        self._buf = []
    def write(self, s):
        if s:
            self._buf.append(str(s))
    def flush(self):
        pass
    def getvalue(self):
        return ''.join(self._buf)

# ノートブック全体で共有される変数空間
_nb_globals = {}
exec("", _nb_globals)

print("✅ Python環境の準備ができました！")
`;

// ============================================================
// デフォルトノートブック
// ============================================================
function buildDefaultNotebook() {
  // ── セル1: ウェルカムテキスト ──
  addCell({
    type: 'text',
    content: `# 🐍 Pythonノートブックへようこそ！

ここでPythonプログラミングを練習することができます。

## 📌 基本的な使い方
- **コードセル**にPythonコードを書いて、**▶ 実行**ボタン（または **Shift+Enter**）で実行します
- 上のセルで作った変数は、**下のセルでも使えます**
- グラフはセルのすぐ下に自動で表示されます

## ⌨️ キーボードショートカット
| 操作 | キー |
|------|------|
| セルを実行 | **Shift + Enter** |
| インデント（字下げ） | **Tab** |

下のサンプルコードを **▶ 実行** して動かしてみよう！`
  });

  // ── セル2: Pythonの基本 ──
  addCell({
    type: 'code',
    content: `# ===== Pythonの基本 =====
# 「#」から始まる行はコメントです（実行されません）

# 変数に値を入れる
name = "山田太郎"
age  = 16
score = 85.5

# 画面に表示する
print("こんにちは、" + name + "さん！")
print(f"年齢: {age} 歳、点数: {score} 点")

# 計算
result = (100 - score) / 100 * age
print(f"計算結果: {result:.2f}")

# 繰り返し（for文）
print("\\n1から5まで：")
for i in range(1, 6):
    print(f"  {i} の 2乗 = {i ** 2}")`
  });

  // ── セル3: NumPy ──
  addCell({
    type: 'code',
    content: `# ===== NumPy: 数値計算ライブラリ =====
import numpy as np

# 配列を作る
points = np.array([70, 85, 92, 60, 78, 95, 88])
print("テストの点数:", points)

# 統計計算
print(f"\\n平均: {np.mean(points):.1f} 点")
print(f"最高: {np.max(points)} 点")
print(f"最低: {np.min(points)} 点")
print(f"標準偏差: {np.std(points):.1f}")

# 条件で絞り込む
passed = points[points >= 80]
print(f"\\n80点以上: {passed}")
print(f"合格者数: {len(passed)} 人")`
  });

  // ── セル4: Matplotlib ──
  addCell({
    type: 'code',
    content: `# ===== Matplotlib: グラフ描画ライブラリ =====
import matplotlib.pyplot as plt
import numpy as np

# データを作る
x = np.linspace(0, 2 * np.pi, 200)  # 0から2πまで200点
y_sin = np.sin(x)
y_cos = np.cos(x)

# グラフを描く
fig, ax = plt.subplots(figsize=(8, 4))
ax.plot(x, y_sin, label='sin(x)',  color='royalblue', linewidth=2)
ax.plot(x, y_cos, label='cos(x)',  color='tomato',    linewidth=2)

ax.set_xlabel('x')
ax.set_ylabel('y')
ax.set_title('Sine and Cosine Waves')
ax.legend()
ax.grid(True, alpha=0.3)
plt.tight_layout()
plt.show()  # グラフを表示`
  });

  // ── セル5: Pandas ──
  addCell({
    type: 'code',
    content: `# ===== Pandas: データ処理ライブラリ =====
import pandas as pd
import matplotlib.pyplot as plt

# 表形式のデータを作る
data = {
    'name':  ['Tanaka', 'Suzuki', 'Sato', 'Takahashi', 'Watanabe'],
    'math':  [85, 92, 70, 96, 78],
    'english': [72, 88, 95, 80, 65],
    'grade': [2, 3, 1, 3, 2]
}
df = pd.DataFrame(data)

print("=== 成績表 ===")
print(df)

# 平均点を計算して列を追加
df['average'] = (df['math'] + df['english']) / 2
print("\\n=== 平均点を追加 ===")
print(df[['name', 'math', 'english', 'average']])

# 棒グラフで比較
fig, ax = plt.subplots(figsize=(8, 4))
x = range(len(df))
ax.bar([i - 0.2 for i in x], df['math'],    width=0.35, label='Math',    color='steelblue')
ax.bar([i + 0.2 for i in x], df['english'], width=0.35, label='English', color='coral')
ax.set_xticks(list(x))
ax.set_xticklabels(df['name'])
ax.set_title('Score Comparison')
ax.set_ylabel('Score')
ax.legend()
ax.grid(axis='y', alpha=0.3)
plt.tight_layout()
plt.show()`
  });

  // ── セル6: 自由に書いてみよう ──
  addCell({
    type: 'text',
    content: `## ✏️ 自由に試してみよう！

下のセルに、自分のコードを書いてみましょう。

**アイデア例：**
- 自分の好きな数を使った計算
- カラフルなグラフを描いてみる
- クラスの人のデータを表にまとめる`
  });

  addCell({ type: 'code', content: '# ここに自由にコードを書いてみよう！\n\n' });
}

// ============================================================
// セル管理
// ============================================================

/**
 * セルを追加する
 * @param {Object} opts - { type, content, afterId }
 * afterId が指定されたセルの下に挿入。なければ末尾に追加。
 */
function addCell(opts = {}) {
  const cell = {
    id:      nextId++,
    type:    opts.type    || 'code',
    content: opts.content || ''
  };

  if (opts.afterId != null) {
    const idx = cells.findIndex(c => c.id === opts.afterId);
    cells.splice(idx + 1, 0, cell);
  } else {
    cells.push(cell);
  }

  renderAll();
  focusCell(cell.id);
  return cell.id;
}

/** 画面下の「追加」ボタン用 */
function appendCell(type) {
  addCell({ type });
}

/** セルを削除する */
function deleteCell(id) {
  if (cells.length <= 1) {
    alert('最後のセルは削除できません。');
    return;
  }
  // 削除確認（中身があるときだけ）
  const cell = cells.find(c => c.id === id);
  if (cell && cell.content.trim().length > 20) {
    if (!confirm('このセルを削除しますか？')) return;
  }
  cells = cells.filter(c => c.id !== id);
  delete editors[id];
  delete outputs[id];
  renderAll();
}

/** セルを上に移動 */
function moveCellUp(id) {
  const idx = cells.findIndex(c => c.id === id);
  if (idx > 0) {
    [cells[idx - 1], cells[idx]] = [cells[idx], cells[idx - 1]];
    renderAll();
  }
}

/** セルを下に移動 */
function moveCellDown(id) {
  const idx = cells.findIndex(c => c.id === id);
  if (idx < cells.length - 1) {
    [cells[idx], cells[idx + 1]] = [cells[idx + 1], cells[idx]];
    renderAll();
  }
}

/** セルのタイプを変更 */
function changeCellType(id, newType) {
  saveEditorContent(id);
  const cell = cells.find(c => c.id === id);
  if (cell) { cell.type = newType; }
  renderAll();
}

/** 現在のエディタ内容をcells配列に保存 */
function saveEditorContent(id) {
  if (editors[id]) {
    const cell = cells.find(c => c.id === id);
    if (cell) cell.content = editors[id].getValue();
  }
}

/** 全エディタ内容を保存 */
function saveAllEditors() {
  cells.forEach(c => saveEditorContent(c.id));
}

/** 指定セルにフォーカスを当てる */
function focusCell(id) {
  setTimeout(() => {
    if (editors[id]) {
      editors[id].focus();
    }
  }, 80);
}

// ============================================================
// レンダリング
// ============================================================
function renderAll() {
  // エディタ内容を先に保存
  saveAllEditors();

  // 古いエディタインスタンスをクリア
  Object.keys(editors).forEach(id => { delete editors[id]; });

  const container = document.getElementById('notebook-container');
  container.innerHTML = '';

  cells.forEach((cell, idx) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'cell-wrapper';
    wrapper.innerHTML = buildCellHTML(cell, idx);
    container.appendChild(wrapper);

    // コードセルのエディタ初期化
    if (cell.type === 'code') {
      const textarea = wrapper.querySelector(`.cell-code-ta[data-id="${cell.id}"]`);
      if (textarea) {
        const editor = CodeMirror.fromTextArea(textarea, {
          mode: 'python',
          lineNumbers: true,
          indentUnit: 4,
          tabSize: 4,
          lineWrapping: true,
          autofocus: false,
          // コード補完は無効（要件より）
          extraKeys: {
            'Shift-Enter': () => runCell(cell.id),
            'Tab': cm => {
              if (cm.somethingSelected()) {
                cm.indentSelection('add');
              } else {
                cm.replaceSelection('    ');
              }
            }
          }
        });
        editors[cell.id] = editor;

        // フォーカス時にセルをハイライト
        editor.on('focus', () => {
          wrapper.querySelector('.cell').classList.add('cell-focused');
        });
        editor.on('blur', () => {
          wrapper.querySelector('.cell').classList.remove('cell-focused');
        });
      }
    }

    // 保存済み出力を復元
    if (outputs[cell.id]) {
      renderOutput(cell.id, outputs[cell.id]);
    }
  });
}

/** セルのHTMLを構築する */
function buildCellHTML(cell, idx) {
  const isFirst = idx === 0;
  const isLast  = idx === cells.length - 1;

  let typeLabel, toolbarClass, contentHTML;

  if (cell.type === 'code') {
    typeLabel    = '🐍 コード';
    toolbarClass = 'cell-code';
    contentHTML  = buildCodeContent(cell);
  } else if (cell.type === 'text') {
    typeLabel    = '📝 テキスト';
    toolbarClass = 'cell-text';
    contentHTML  = buildTextContent(cell);
  } else if (cell.type === 'image') {
    typeLabel    = '🖼 画像';
    toolbarClass = 'cell-image';
    contentHTML  = buildImageContent(cell);
  }

  return `
    <div class="cell ${toolbarClass}" data-cell-id="${cell.id}">
      <div class="cell-toolbar">
        <div class="cell-toolbar-left">
          <span class="cell-number">[${idx + 1}]</span>
          <select class="cell-type-select" onchange="changeCellType(${cell.id}, this.value)" title="セルの種類を変更">
            <option value="code"  ${cell.type === 'code'  ? 'selected' : ''}>🐍 コード</option>
            <option value="text"  ${cell.type === 'text'  ? 'selected' : ''}>📝 テキスト</option>
            <option value="image" ${cell.type === 'image' ? 'selected' : ''}>🖼 画像</option>
          </select>
        </div>
        <div class="cell-toolbar-right">
          ${cell.type === 'code' ? `
            <button class="btn-run" onclick="runCell(${cell.id})" title="コードを実行 (Shift+Enter)" id="run-btn-${cell.id}">
              ▶ 実行
            </button>` : `
            <button class="btn-edit-text" onclick="toggleTextEdit(${cell.id})" title="テキストを編集">
              ✏️ 編集
            </button>`}
          <button class="btn-icon" onclick="moveCellUp(${cell.id})"   ${isFirst ? 'disabled' : ''} title="上に移動">↑</button>
          <button class="btn-icon" onclick="moveCellDown(${cell.id})" ${isLast  ? 'disabled' : ''} title="下に移動">↓</button>
          <button class="btn-icon" onclick="addCell({afterId:${cell.id},type:'code'})" title="下にコードセルを追加">＋</button>
          <button class="btn-icon btn-delete" onclick="deleteCell(${cell.id})" title="このセルを削除">✕</button>
        </div>
      </div>
      ${contentHTML}
    </div>`;
}

function buildCodeContent(cell) {
  return `
    <div class="cell-editor">
      <textarea class="cell-code-ta" data-id="${cell.id}">${escHtml(cell.content)}</textarea>
    </div>
    <div class="cell-output" id="output-${cell.id}"></div>`;
}

function buildTextContent(cell) {
  const rendered = cell.content
    ? marked.parse(cell.content)
    : '<p class="placeholder">ここをクリックして編集... (Markdownが使えます)</p>';
  return `
    <div class="cell-text-display" id="text-disp-${cell.id}" onclick="startTextEdit(${cell.id})">
      ${rendered}
    </div>
    <div class="cell-text-editor hidden" id="text-edit-${cell.id}">
      <textarea
        onblur="finishTextEdit(${cell.id})"
        onkeydown="onTextKeydown(event, ${cell.id})"
      >${escHtml(cell.content)}</textarea>
      <div class="text-editor-hint">Shift+Enter または Esc で確定</div>
    </div>`;
}

function buildImageContent(cell) {
  if (cell.content) {
    return `
      <div class="cell-image-area">
        <div class="cell-image-display">
          <img src="${cell.content}" alt="画像">
        </div>
        <button class="btn-icon" onclick="clearImage(${cell.id})" style="margin-top:8px;">
          ✕ 画像を削除
        </button>
      </div>`;
  }
  return `
    <div class="cell-image-area">
      <div class="image-drop-zone" id="drop-zone-${cell.id}"
        onclick="document.getElementById('img-input-${cell.id}').click()"
        ondragover="event.preventDefault(); this.classList.add('drag-over')"
        ondragleave="this.classList.remove('drag-over')"
        ondrop="onImageDrop(event, ${cell.id})">
        <div class="drop-icon">🖼</div>
        <p>クリックして画像を選択</p>
        <small>または ここにドラッグ&ドロップ（PNG, JPG, GIF, SVG）</small>
      </div>
      <input type="file" id="img-input-${cell.id}" accept="image/*" style="display:none"
        onchange="onImageSelect(event, ${cell.id})">
    </div>`;
}

// ============================================================
// テキストセル編集
// ============================================================
function startTextEdit(id) {
  const disp = document.getElementById(`text-disp-${id}`);
  const edit = document.getElementById(`text-edit-${id}`);
  if (!disp || !edit) return;
  disp.classList.add('hidden');
  edit.classList.remove('hidden');
  const ta = edit.querySelector('textarea');
  if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
}

function finishTextEdit(id) {
  const disp = document.getElementById(`text-disp-${id}`);
  const edit = document.getElementById(`text-edit-${id}`);
  if (!disp || !edit) return;
  const ta = edit.querySelector('textarea');
  const cell = cells.find(c => c.id === id);
  if (cell && ta) cell.content = ta.value;
  disp.innerHTML = cell && cell.content
    ? marked.parse(cell.content)
    : '<p class="placeholder">ここをクリックして編集... (Markdownが使えます)</p>';
  edit.classList.add('hidden');
  disp.classList.remove('hidden');
}

function toggleTextEdit(id) {
  const edit = document.getElementById(`text-edit-${id}`);
  if (edit && edit.classList.contains('hidden')) {
    startTextEdit(id);
  } else {
    finishTextEdit(id);
  }
}

function onTextKeydown(e, id) {
  if (e.key === 'Escape' || (e.key === 'Enter' && e.shiftKey)) {
    e.preventDefault();
    finishTextEdit(id);
  }
}

// ============================================================
// 画像セル
// ============================================================
function onImageSelect(event, id) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const cell = cells.find(c => c.id === id);
    if (cell) { cell.content = e.target.result; }
    renderAll();
  };
  reader.readAsDataURL(file);
}

function onImageDrop(event, id) {
  event.preventDefault();
  document.getElementById(`drop-zone-${id}`)?.classList.remove('drag-over');
  const file = event.dataTransfer.files[0];
  if (!file || !file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = e => {
    const cell = cells.find(c => c.id === id);
    if (cell) { cell.content = e.target.result; }
    renderAll();
  };
  reader.readAsDataURL(file);
}

function clearImage(id) {
  const cell = cells.find(c => c.id === id);
  if (cell) { cell.content = ''; }
  renderAll();
}

// ============================================================
// Python実行
// ============================================================

/** セル単体を実行 */
async function runCell(id) {
  if (!pyodide) {
    alert('Python環境がまだ準備できていません。しばらくお待ちください。');
    return;
  }
  if (isRunning) return;

  const cell = cells.find(c => c.id === id);
  if (!cell || cell.type !== 'code') return;

  // エディタの現在の内容を取得
  const code = editors[id] ? editors[id].getValue() : cell.content;
  if (!code.trim()) return;

  isRunning = true;

  // UI：実行中状態に切り替え
  const cellEl = document.querySelector(`[data-cell-id="${id}"]`);
  if (cellEl) cellEl.classList.add('running');
  const runBtn = document.getElementById(`run-btn-${id}`);
  if (runBtn) { runBtn.textContent = '⏳ 実行中'; runBtn.disabled = true; }

  renderOutput(id, { status: 'running' });

  try {
    // import文を解析してパッケージを自動インストール
    try {
      await pyodide.loadPackagesFromImports(code);
    } catch (_) { /* 失敗してもコード実行は試みる */ }

    // コードをPythonに渡す
    pyodide.globals.set('_cell_code', code);

    // 実行
    await pyodide.runPythonAsync(PYTHON_EXEC_CODE);

    // 結果を取得
    const stdout  = pyodide.globals.get('_out_text')   || '';
    const stderr  = pyodide.globals.get('_err_text')   || '';
    const errType = pyodide.globals.get('_err_type');
    const errMsg  = pyodide.globals.get('_err_msg');
    const errTb   = pyodide.globals.get('_err_tb');
    const figsProxy = pyodide.globals.get('_figures');
    const figs = figsProxy ? figsProxy.toJs() : [];
    if (figsProxy?.destroy) figsProxy.destroy();

    const result = { status: 'done', stdout, stderr, errType, errMsg, errTb, figs };
    outputs[id] = result;
    renderOutput(id, result);

  } catch (err) {
    const result = {
      status: 'done', stdout: '', stderr: '',
      errType: 'SystemError', errMsg: err.message,
      errTb: null, figs: []
    };
    outputs[id] = result;
    renderOutput(id, result);
  } finally {
    isRunning = false;
    if (cellEl) cellEl.classList.remove('running');
    if (runBtn) { runBtn.textContent = '▶ 実行'; runBtn.disabled = false; }
  }
}

/** すべてのコードセルを順番に実行 */
async function runAllCells() {
  for (const cell of cells) {
    if (cell.type === 'code') {
      await runCell(cell.id);
      await sleep(50);
    }
  }
}

/** すべての出力をクリア */
function clearAllOutputs() {
  cells.forEach(c => { delete outputs[c.id]; });
  document.querySelectorAll('.cell-output').forEach(el => { el.innerHTML = ''; });
}

// ============================================================
// Python実行コード（各セル実行時に呼ぶ）
// ============================================================
const PYTHON_EXEC_CODE = `
_out_cap = _CapIO()
_err_cap = _CapIO()
_old_out = sys.stdout
_old_err = sys.stderr
sys.stdout = _out_cap
sys.stderr = _err_cap

_err_type = None
_err_msg  = None
_err_tb   = None

# 前のグラフをクリア
plt.close('all')

try:
    exec(compile(_cell_code, '<セル>', 'exec'), _nb_globals)
except SystemExit:
    pass
except Exception as _e:
    _err_type = type(_e).__name__
    _err_msg  = str(_e)
    _err_tb   = traceback.format_exc()
finally:
    sys.stdout = _old_out
    sys.stderr = _old_err

_out_text = _out_cap.getvalue()
_err_text = _err_cap.getvalue()

# matplotlibのグラフをPNG画像として取得
_figures = []
for _fn in plt.get_fignums():
    try:
        _fig = plt.figure(_fn)
        _buf = io.BytesIO()
        _fig.savefig(_buf, format='png', bbox_inches='tight', dpi=110)
        _buf.seek(0)
        _figures.append(base64.b64encode(_buf.read()).decode('utf-8'))
    except Exception:
        pass

plt.close('all')
`;

// ============================================================
// 出力表示
// ============================================================
function renderOutput(id, result) {
  const el = document.getElementById(`output-${id}`);
  if (!el) return;

  if (result.status === 'running') {
    el.innerHTML = `
      <div class="output-running">
        <span class="spinner">⚙</span> 実行中...
      </div>`;
    return;
  }

  let html = '';

  // 標準出力
  if (result.stdout) {
    html += `<div class="output-text"><pre>${escHtml(result.stdout)}</pre></div>`;
  }

  // 警告（stderr）
  if (result.stderr) {
    html += `<div class="output-warning"><pre>${escHtml(result.stderr)}</pre></div>`;
  }

  // エラー
  if (result.errMsg) {
    const jaMsg = translateError(result.errType, result.errMsg);
    html += `
      <div class="output-error">
        <div class="error-title">❌ エラー: ${escHtml(result.errType || 'エラー')}</div>
        <div class="error-message">${escHtml(result.errMsg)}</div>
        <div class="error-japanese">${jaMsg}</div>
        ${result.errTb ? `
          <details class="error-details">
            <summary>詳しいエラー情報を見る</summary>
            <pre>${escHtml(result.errTb)}</pre>
          </details>` : ''}
      </div>`;
  }

  // グラフ画像
  if (result.figs && result.figs.length > 0) {
    result.figs.forEach((b64, i) => {
      html += `
        <div class="output-figure">
          <img src="data:image/png;base64,${b64}" alt="グラフ ${i + 1}">
        </div>`;
    });
  }

  // 何も出力がない場合
  if (!html) {
    html = '<div class="output-empty">（出力なし）</div>';
  }

  el.innerHTML = html;
}

// ============================================================
// エラーメッセージの日本語化
// ============================================================
function translateError(type, msg) {
  const rules = [
    // NameError
    { types: ['NameError'],
      pattern: /name '(.+?)' is not defined/,
      build: m => `変数・関数「${m[1]}」が定義されていません。スペルミスがないか確認してください。先にそのセルを実行しましたか？` },

    // SyntaxError
    { types: ['SyntaxError'],
      pattern: /invalid syntax/,
      build: () => '文法（syntax）が間違っています。括弧 () [] {} の対応、コロン「:」の付け忘れ、クォート「\'」「"」の対応を確認してください。' },
    { types: ['SyntaxError'],
      pattern: /EOL while scanning string literal/,
      build: () => '文字列が閉じられていません。クォート「\'」または「"」が対応しているか確認してください。' },
    { types: ['SyntaxError'],
      pattern: /unexpected EOF/,
      build: () => 'コードが途中で終わっています。括弧や文字列が閉じられているか確認してください。' },

    // IndentationError
    { types: ['IndentationError', 'TabError'],
      pattern: /.*/,
      build: () => 'インデント（字下げ）が正しくありません。if・for・def などの次の行は、スペース4つで字下げしてください。TabキーまたはSpaceキーが混在していませんか？' },

    // TypeError
    { types: ['TypeError'],
      pattern: /unsupported operand type\(s\) for (.+?): '(.+?)' and '(.+?)'/,
      build: m => `型が違います。「${m[2]}」型と「${m[3]}」型の計算はできません。数値と文字列を混在させていませんか？int() や str() で変換してみましょう。` },
    { types: ['TypeError'],
      pattern: /can only concatenate str \(not "(.+?)"\) to str/,
      build: m => `文字列（str）と「${m[1]}」型は結合できません。str() で文字列に変換してください。例: str(数値)` },
    { types: ['TypeError'],
      pattern: /'(.+?)' object is not subscriptable/,
      build: m => `「${m[1]}」型には [ ] でアクセスできません。` },
    { types: ['TypeError'],
      pattern: /'(.+?)' object is not callable/,
      build: m => `「${m[1]}」は関数ではないため、() で呼び出すことはできません。` },
    { types: ['TypeError'],
      pattern: /.*/,
      build: () => 'データの型（種類）が合っていません。数値・文字列・リストなどの型を確認してください。' },

    // IndexError
    { types: ['IndexError'],
      pattern: /list index out of range/,
      build: () => 'リストの範囲外にアクセスしようとしました。インデックス（番号）はリストの長さより小さくする必要があります（最初の要素は [0] です）。' },
    { types: ['IndexError'],
      pattern: /.*/,
      build: () => '配列・リストの範囲外を指定しました。インデックスの数値を確認してください。' },

    // KeyError
    { types: ['KeyError'],
      pattern: /(.+)/,
      build: m => `辞書（dict）にキー ${m[1]} が存在しません。キーのスペルを確認してください。` },

    // ZeroDivisionError
    { types: ['ZeroDivisionError'],
      pattern: /.*/,
      build: () => '0（ゼロ）で割り算しようとしました。分母が 0 になっていないか確認してください。' },

    // ImportError / ModuleNotFoundError
    { types: ['ImportError', 'ModuleNotFoundError'],
      pattern: /No module named '(.+?)'/,
      build: m => `ライブラリ「${m[1]}」が見つかりません。このノートブックで使えるライブラリか確認してください。使える主なもの: numpy, pandas, matplotlib, sklearn, PIL, math, random` },

    // AttributeError
    { types: ['AttributeError'],
      pattern: /'(.+?)' object has no attribute '(.+?)'/,
      build: m => `「${m[1]}」型のオブジェクトに「${m[2]}」という属性・メソッドはありません。スペルを確認してください。` },
    { types: ['AttributeError'],
      pattern: /module '(.+?)' has no attribute '(.+?)'/,
      build: m => `モジュール「${m[1]}」に「${m[2]}」という関数・属性はありません。スペルを確認してください。` },

    // ValueError
    { types: ['ValueError'],
      pattern: /invalid literal for int\(\)/,
      build: () => '文字列を整数に変換できません。数字だけからなる文字列か確認してください。例: int("abc") はエラーになります。' },
    { types: ['ValueError'],
      pattern: /could not convert string to float/,
      build: () => '文字列を小数に変換できません。数値のみの文字列か確認してください。' },
    { types: ['ValueError'],
      pattern: /.*/,
      build: () => '値が正しくありません。データの内容や形式を確認してください。' },

    // RecursionError
    { types: ['RecursionError'],
      pattern: /.*/,
      build: () => '関数が深く呼び出されすぎました（再帰が無限ループになっている可能性があります）。再帰処理の終了条件を確認してください。' },

    // MemoryError
    { types: ['MemoryError'],
      pattern: /.*/,
      build: () => 'メモリが不足しています。より小さなデータで試してみてください。' },

    // FileNotFoundError
    { types: ['FileNotFoundError'],
      pattern: /.*/,
      build: () => 'ファイルが見つかりません。このノートブックではファイルの読み書きはできません。' },

    // SystemExit
    { types: ['SystemExit'],
      pattern: /.*/,
      build: () => 'プログラムが終了しました（sys.exit() が呼ばれました）。' },

    // StopIteration
    { types: ['StopIteration'],
      pattern: /.*/,
      build: () => 'イテレータの要素がなくなりました。next() の使い方を確認してください。' },

    // RuntimeError
    { types: ['RuntimeError'],
      pattern: /.*/,
      build: () => '実行時エラーが発生しました。コードを見直してみてください。' },
  ];

  for (const rule of rules) {
    if (rule.types.includes(type)) {
      const m = msg ? msg.match(rule.pattern) : null;
      if (m) return rule.build(m);
    }
  }

  return 'エラーが発生しました。エラーメッセージをよく読んで、コードを確認してみましょう。わからなければ先生や友達に聞いてみよう！';
}

// ============================================================
// ヘルプパネル
// ============================================================
function toggleHelp() {
  document.getElementById('help-panel').classList.toggle('hidden');
}

// ============================================================
// ユーティリティ
// ============================================================
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
