// 手書き風フォントシステム - メインスクリプト
'use strict';

// 設定
const FONT_VARIATIONS_COUNT = 6; // 利用可能なフォントバリエーションの数

// 状態管理: 文字インスタンスの配列（MutableList<ImmutableInstance>）
// 各要素は Object.freeze() された { id: number, char: string, variation: number }
// インスタンス自体は不変、配列は可変（削除・挿入可能）
let characterInstances = [];
let nextId = 1; // 次に割り当てるID

// 前回のテキスト状態（カーソル位置検出用）
let previousText = '';
let previousCursorPos = 0;

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
 * 不変な文字インスタンスを作成
 * @param {string} char - 文字
 * @param {number|null} variation - フォントバリエーション（nullの場合は自動割り当て）
 * @returns {Object} freeze済みインスタンス
 */
function createInstance(char, variation = null) {
    return Object.freeze({
        id: nextId++,
        char: char,
        variation: variation !== null ? variation : (char === '\n' || char === ' ' ? 0 : getRandomVariation())
    });
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
 * 文字インスタンス配列からHTMLを生成
 * @param {Array} instances - 文字インスタンスの配列
 * @returns {string} HTML文字列
 */
function processText(instances) {
    if (!instances || instances.length === 0) {
        return '<p class="placeholder">ここに結果が表示されます</p>';
    }

    // 各文字インスタンスをspanでラップ
    const processedChars = instances.map(instance => {
        const { char, variation } = instance;

        // 改行やスペースの処理
        if (char === '\n') {
            return '<br>';
        }
        if (char === ' ') {
            return ' ';
        }

        // spanでラップしてクラスを適用
        return `<span class="char-span font-variation-${variation}">${char}</span>`;
    });

    return `<div class="output-text">${processedChars.join('')}</div>`;
}

/**
 * カーソル位置から削除された文字を検出
 * @param {string} oldText - 前のテキスト
 * @param {string} newText - 新しいテキスト
 * @param {number} cursorPos - カーソル位置
 * @returns {object|null} 削除情報 { position, char, instance } または null
 */
function detectDeletion(oldText, newText, cursorPos) {
    // 削除でない場合
    if (oldText.length <= newText.length) {
        return null;
    }

    const deletedCount = oldText.length - newText.length;

    // 削除位置を特定（カーソル位置から推測）
    let deletePos = cursorPos;

    // 前方一致する部分を見つける
    let matchStart = 0;
    while (matchStart < cursorPos && matchStart < newText.length &&
           oldText[matchStart] === newText[matchStart]) {
        matchStart++;
    }

    deletePos = matchStart;

    // 削除された文字列を取得
    const deletedChars = oldText.substring(deletePos, deletePos + deletedCount);

    // characterInstancesから該当する文字を探す
    const oldCharsFiltered = characterInstances.filter(inst => inst.char !== '\n' && inst.char !== ' ');
    const oldTextFiltered = oldCharsFiltered.map(inst => inst.char).join('');

    // oldTextFiltered内での位置を計算
    let posInFiltered = 0;
    let posInOriginal = 0;
    while (posInOriginal < deletePos && posInFiltered < oldTextFiltered.length) {
        if (oldText[posInOriginal] !== '\n' && oldText[posInOriginal] !== ' ') {
            posInFiltered++;
        }
        posInOriginal++;
    }

    const deletedInstances = [];
    for (let i = 0; i < deletedCount; i++) {
        const char = deletedChars[i];
        if (char !== '\n' && char !== ' ' && posInFiltered + i < oldCharsFiltered.length) {
            deletedInstances.push(oldCharsFiltered[posInFiltered + i]);
        }
    }

    return {
        position: deletePos,
        chars: deletedChars,
        instances: deletedInstances
    };
}

/**
 * 出力エリアを更新（シンプル版）
 * @param {string} text - 表示するテキスト
 */
function updateOutput(text) {
    console.log('🔄 updateOutput が呼ばれました');

    // 1. カーソル位置から削除を検出
    const cursorPos = textInput.selectionStart;
    const deletion = detectDeletion(previousText, text, cursorPos);

    if (deletion && deletion.instances.length > 0) {
        console.log('🗑️ 削除を検出:');
        deletion.instances.forEach(inst => {
            console.log(`  削除: ID=${inst.id}, char="${inst.char}", variation=${inst.variation}`);
        });

        addDebugLog('🗑️ 削除検出', {
            position: deletion.position,
            chars: deletion.chars,
            instances: deletion.instances.map(inst => `ID:${inst.id} "${inst.char}" var:${inst.variation}`).join(', ')
        });
    }

    // 2. 削除されたIDをセットに格納
    const deletedIds = new Set();
    if (deletion && deletion.instances.length > 0) {
        deletion.instances.forEach(inst => deletedIds.add(inst.id));
    }

    // 3. 削除されたインスタンスを除外してavailable poolを作成
    let availableInstances = characterInstances.filter(inst => !deletedIds.has(inst.id));
    console.log(`💡 利用可能インスタンス: ${availableInstances.length}個`);

    // 4. 新テキストの各文字に対してマッチング
    const newInstances = [];
    const newCharacters = Array.from(text);
    let reuseCount = 0;
    let newCount = 0;

    for (const char of newCharacters) {
        // 改行やスペースは常に新規作成（variation 0）
        if (char === '\n' || char === ' ') {
            newInstances.push(createInstance(char, 0));
            continue;
        }

        // availableから同じ文字を前から検索
        const matchIndex = availableInstances.findIndex(inst => inst.char === char);

        if (matchIndex !== -1) {
            // 見つかった → 再利用
            const reusedInstance = availableInstances.splice(matchIndex, 1)[0];
            newInstances.push(reusedInstance);
            console.log(`📌 "${char}" (ID:${reusedInstance.id}) 再利用, var:${reusedInstance.variation}`);
            reuseCount++;
        } else {
            // 見つからない → 新規作成
            const newInstance = createInstance(char);
            newInstances.push(newInstance);
            console.log(`✨ "${char}" (ID:${newInstance.id}) 新規作成, var:${newInstance.variation}`);
            newCount++;
        }
    }

    const deletedCount = deletedIds.size;
    console.log(`✅ 完了: 再利用 ${reuseCount}個, 新規 ${newCount}個, 削除 ${deletedCount}個`);

    // 5. 状態を更新
    characterInstances = newInstances;
    previousText = text;
    previousCursorPos = cursorPos;

    // 6. デバッグログ
    const instancesDebug = characterInstances
        .filter(inst => inst.char !== '\n' && inst.char !== ' ')
        .map(inst => `[ID:${inst.id} "${inst.char}" var:${inst.variation}]`)
        .join(' ');

    addDebugLog('✅ 更新完了', {
        text: text,
        instances: instancesDebug,
        reused: reuseCount,
        created: newCount,
        deleted: deletedCount
    });

    // 7. HTMLを生成して表示
    const processedHTML = processText(characterInstances);
    outputArea.innerHTML = processedHTML;

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
        if (log.data.unchanged !== undefined) {
            dataHTML += `<div class="debug-data">変更なし: ${log.data.unchanged ? 'はい（スキップ）' : 'いいえ'}</div>`;
        }
        if (log.data.kept !== undefined) {
            dataHTML += `<div class="debug-data">保持: ${log.data.kept}文字, 新規: ${log.data.newChars}文字</div>`;
        }
        if (log.data.deleted !== undefined) {
            dataHTML += `<div class="debug-data">削除: ${log.data.deleted}文字</div>`;
        }
        if (log.data.added !== undefined) {
            dataHTML += `<div class="debug-data">追加: ${log.data.added}文字</div>`;
        }
        if (log.data.position !== undefined) {
            dataHTML += `<div class="debug-data">削除位置: ${log.data.position}</div>`;
        }
        if (log.data.chars !== undefined) {
            dataHTML += `<div class="debug-data">削除文字: "${log.data.chars}"</div>`;
        }
        if (log.data.instances !== undefined) {
            // instancesフィールドは2つの意味で使われる：削除インスタンス or 現在のインスタンス一覧
            if (log.eventName.includes('削除')) {
                dataHTML += `<div class="debug-data">削除インスタンス: ${log.data.instances}</div>`;
            } else {
                dataHTML += `<div class="debug-data" style="font-size: 0.85em; word-break: break-all;">インスタンス: ${log.data.instances}</div>`;
            }
        }
        if (log.data.reused !== undefined) {
            dataHTML += `<div class="debug-data">再利用: ${log.data.reused}個</div>`;
        }
        if (log.data.created !== undefined) {
            dataHTML += `<div class="debug-data">新規作成: ${log.data.created}個</div>`;
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
    console.log('=== 文字インスタンス情報 ===');
    console.log(`インスタンス数: ${characterInstances.length}`);

    characterInstances.forEach((inst, index) => {
        if (inst.char !== '\n' && inst.char !== ' ') {
            console.log(`位置${index}: "${inst.char}" (ID:${inst.id}) → バリエーション ${inst.variation}`);
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

    const text = textInput.value;
    const oldInstanceCount = characterInstances.length;

    updateOutput(text);
    debugShowVariations();

    const newInstanceCount = characterInstances.length;
    const variations = characterInstances.map(inst => inst.variation).filter(v => v !== 0);

    addDebugLog('✅ IME変換確定 → 更新完了', {
        text: text,
        variations: variations
    });
});

/**
 * キーボードイベント処理
 * Enterキーで入力を確定（Shift+Enterは改行）
 */
textInput.addEventListener('keydown', (event) => {
    console.log('⌨️ [keydown] キー:', event.key, 'isComposing:', isComposing);

    if (event.key === 'Enter') {
        addDebugLog('⌨️ Enter入力', {
            key: event.key,
            isComposing: isComposing
        });
    }

    if (event.key === 'Enter' && !event.shiftKey && !isComposing) {
        // Shift+Enterでない、かつIME変換中でない場合のみ処理
        event.preventDefault();
        console.log('🔄 [keydown Enter] テキスト更新を実行');

        const text = textInput.value;
        updateOutput(text);
        debugShowVariations();
    }
});

/**
 * 入力変更イベント
 * 文字削除やペースト時にも対応
 */
textInput.addEventListener('input', (event) => {
    // IME変換中は処理しない（compositionendで処理される）
    if (isComposing) {
        console.log('⏭️ [input] IME変換中のためスキップ');
        return;
    }

    console.log('📝 [input] テキスト変更検知（削除・ペーストなど）');

    const oldLength = characterInstances.length;
    const text = event.target.value;
    const newLength = Array.from(text).length;

    updateOutput(text);

    const variations = characterInstances.map(inst => inst.variation).filter(v => v !== 0);

    if (newLength < oldLength) {
        addDebugLog('🗑️ 文字削除 → 更新完了', {
            text: text,
            variations: variations,
            deleted: oldLength - newLength
        });
    } else if (newLength > oldLength) {
        addDebugLog('📝 文字追加 → 更新完了', {
            text: text,
            variations: variations,
            added: newLength - oldLength
        });
    }
});

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
    getInstances: () => characterInstances,
    getInstanceCount: () => characterInstances.length,
    createInstance, // 不変インスタンス作成

    // 不変性テスト
    testImmutability: () => {
        console.log('🧪 不変性テスト開始');
        const instance = createInstance('テ');
        console.log('✅ インスタンス作成:', instance);

        try {
            instance.variation = 999;
            console.log('❌ 失敗: variationが変更できてしまった', instance.variation);
            return false;
        } catch (e) {
            console.log('✅ 成功: variationは変更不可（strict modeでエラー）');
        }

        if (instance.variation === 999) {
            console.log('⚠️  警告: variationが変更されている（non-strict mode）');
            return false;
        }

        console.log('✅ インスタンスは不変です', instance);
        return true;
    }
};
