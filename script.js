// 手書き風フォントシステム - メインスクリプト

// 設定
const FONT_VARIATIONS_COUNT = 6; // 利用可能なフォントバリエーションの数

// 状態管理: 確定されたテキストと各位置のバリエーションを保存
let currentText = '';
let currentVariations = [];

// DOM要素の取得
const textInput = document.getElementById('text-input');
const outputArea = document.getElementById('output');

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
    // 新しいテキストに対してランダムにバリエーションを割り当て
    currentText = text;
    currentVariations = assignRandomVariations(text);

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

/**
 * キーボードイベント処理
 * Enterキーで入力を確定（Shift+Enterは改行）
 */
textInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
        // Shift+Enterでない場合のみ処理
        event.preventDefault();

        const text = textInput.value;
        updateOutput(text);

        // デバッグ情報を表示
        debugShowVariations();
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
    console.log('手書き風フォントシステム - 初期化完了');
    console.log(`利用可能なフォントバリエーション: ${FONT_VARIATIONS_COUNT}種類`);

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
