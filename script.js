// 手書き風フォントシステム - メインスクリプト

// 設定
const FONT_VARIATIONS_COUNT = 6; // 利用可能なフォントバリエーションの数

// 状態管理: 確定されたテキストと各位置のバリエーションを保存
let currentText = '';
let currentVariations = [];

// DOM要素の取得
const textInput = document.getElementById('text-input');
const outputArea = document.getElementById('output');
const debugDisplay = document.getElementById('debug-display');

// デバッグログ履歴
const debugLogs = [];

/**
 * ランダムなフォントバリエーション番号を取得
 * @returns {number} 1からFONT_VARIATIONS_COUNTの間のランダムな整数
 */
function getRandomVariation() {
    return Math.floor(Math.random() * FONT_VARIATIONS_COUNT) + 1;
}

/**
 * テキストに対してランダムにバリエーションを割り当てる
 * @param {string} text - 処理するテキスト
 * @returns {number[]} 各文字位置に対応するバリエーション番号の配列
 */
function assignRandomVariations(text) {
    const characters = Array.from(text);
    return characters.map(char => {
        // 改行やスペースにはバリエーションを割り当てない
        if (char === '\n' || char === ' ') {
            return 0;
        }
        // 各文字位置に完全にランダムでバリエーションを割り当て
        return getRandomVariation();
    });
}

/**
 * テキストを処理して、各文字にフォントバリエーションを適用
 * @param {string} text - 処理するテキスト
 * @param {number[]} variations - 各文字位置のバリエーション番号
 * @returns {string} HTML文字列
 */
function processText(text, variations) {
    if (!text || text.trim() === '') {
        return '<p class="placeholder">ここに結果が表示されます</p>';
    }

    // テキストを1文字ずつ分解（Unicodeサロゲートペアにも対応）
    const characters = Array.from(text);

    // 各文字をspanでラップし、対応するフォントバリエーションクラスを適用
    const processedChars = characters.map((char, index) => {
        // 改行やスペースの処理
        if (char === '\n') {
            return '<br>';
        }
        if (char === ' ') {
            return ' ';
        }

        // この位置のバリエーションを取得
        const variation = variations[index];

        // spanでラップしてクラスを適用
        return `<span class="char-span font-variation-${variation}">${char}</span>`;
    });

    return `<div class="output-text">${processedChars.join('')}</div>`;
}

/**
 * 出力エリアを更新
 * @param {string} text - 表示するテキスト
 */
function updateOutput(text) {
    console.log('🔄 updateOutput が呼ばれました - 新しいランダム割り当てを実行');

    // 新しいテキストに対してランダムにバリエーションを割り当て
    currentText = text;
    currentVariations = assignRandomVariations(text);

    console.log('✅ ランダム割り当て完了:', currentVariations);

    // HTMLを生成して表示
    const processedHTML = processText(currentText, currentVariations);
    outputArea.innerHTML = processedHTML;

    // has-contentクラスを追加してスタイルを変更
    if (text && text.trim() !== '') {
        outputArea.classList.add('has-content');
    } else {
        outputArea.classList.remove('has-content');
    }
}

/**
 * デバッグ情報を画面に表示
 * @param {string} eventName - イベント名
 * @param {object} data - 表示するデータ
 */
function addDebugLog(eventName, data = {}) {
    const timestamp = new Date().toLocaleTimeString('ja-JP');
    const logEntry = { eventName, timestamp, data };
    debugLogs.unshift(logEntry); // 新しいログを先頭に追加

    // 最大10件まで保持
    if (debugLogs.length > 10) {
        debugLogs.pop();
    }

    updateDebugDisplay();
}

/**
 * デバッグ表示エリアを更新
 */
function updateDebugDisplay() {
    if (!debugDisplay) return;

    if (debugLogs.length === 0) {
        debugDisplay.innerHTML = '<p class="debug-placeholder">イベント情報がここに表示されます</p>';
        return;
    }

    const logsHTML = debugLogs.map(log => {
        let dataHTML = '';
        if (log.data.text !== undefined) {
            dataHTML += `<div class="debug-data">テキスト: "${log.data.text}"</div>`;
        }
        if (log.data.variations) {
            dataHTML += `<div class="debug-data">バリエーション: [${log.data.variations.filter(v => v !== 0).join(', ')}]</div>`;
        }
        if (log.data.key) {
            dataHTML += `<div class="debug-data">キー: ${log.data.key}</div>`;
        }
        if (log.data.isComposing !== undefined) {
            dataHTML += `<div class="debug-data">IME変換中: ${log.data.isComposing ? 'はい' : 'いいえ'}</div>`;
        }

        return `
            <div class="debug-event">
                <div class="debug-event-name">${log.eventName}</div>
                <div class="debug-timestamp">${log.timestamp}</div>
                ${dataHTML}
            </div>
        `;
    }).join('');

    debugDisplay.innerHTML = logsHTML;
}

/**
 * デバッグ用: 現在の文字バリエーション情報をコンソールに表示
 */
function debugShowVariations() {
    console.log('=== 文字バリエーション情報 ===');
    console.log(`テキスト: "${currentText}"`);

    const characters = Array.from(currentText);
    characters.forEach((char, index) => {
        if (char !== '\n' && char !== ' ') {
            console.log(`位置${index}: "${char}" → バリエーション ${currentVariations[index]}`);
        }
    });
    console.log('============================');
}

// イベントリスナーの設定

// IME変換中フラグ
let isComposing = false;

/**
 * IME変換開始イベント
 */
textInput.addEventListener('compositionstart', () => {
    isComposing = true;
    console.log('📝 [compositionstart] IME変換開始');
    addDebugLog('📝 IME変換開始', { isComposing: true });
});

/**
 * IME変換確定イベント - これがスマホで変換確定した瞬間
 */
textInput.addEventListener('compositionend', (event) => {
    isComposing = false;
    console.log('✅ [compositionend] IME変換確定:', event.data);

    // 変換確定時に自動的にバリエーション割り当て
    const text = textInput.value;
    updateOutput(text);
    debugShowVariations();

    addDebugLog('✅ IME変換確定 → バリエーション割り当て実行', {
        text: text,
        variations: currentVariations
    });
});

/**
 * キーボードイベント処理
 * Enterキーで入力を確定（Shift+Enterは改行）
 */
textInput.addEventListener('keydown', (event) => {
    console.log('⌨️ [keydown] キー:', event.key, 'isComposing:', isComposing);

    addDebugLog('⌨️ キー入力', {
        key: event.key,
        isComposing: isComposing
    });

    if (event.key === 'Enter' && !event.shiftKey && !isComposing) {
        // Shift+Enterでない、かつIME変換中でない場合のみ処理
        event.preventDefault();
        console.log('🔄 [keydown Enter] テキスト更新を実行');

        const text = textInput.value;
        updateOutput(text);

        // デバッグ情報を表示
        debugShowVariations();

        addDebugLog('🔄 Enter押下 → バリエーション割り当て実行', {
            text: text,
            variations: currentVariations
        });
    }
});

/**
 * リアルタイム更新（オプション）
 * コメントアウトを外すと、入力中もリアルタイムで表示が更新されます
 */
/*
textInput.addEventListener('input', (event) => {
    const text = event.target.value;
    updateOutput(text);
});
*/

// 初期化処理
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎨 手書き風フォントシステム v2.0 - 初期化完了');
    console.log(`📊 利用可能なフォントバリエーション: ${FONT_VARIATIONS_COUNT}種類`);
    console.log('✨ 各文字の出現位置ごとに独立してランダム割り当てを行います');
    console.log('💡 デバッグ情報: Enterキーを押すたびにコンソールに詳細情報が表示されます');

    // デモ用: ページ読み込み時に「ワクワクする」を自動表示（オプション）
    // updateOutput('ワクワクする');
});

// グローバルスコープに公開（デバッグ用）
window.yuragiFontSystem = {
    processText,
    updateOutput,
    debugShowVariations,
    getCurrentText: () => currentText,
    getCurrentVariations: () => currentVariations
};
