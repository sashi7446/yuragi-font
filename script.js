// 手書き風フォントシステム - メインスクリプト
'use strict';

// 設定
const FONT_VARIATIONS_COUNT = 6; // 利用可能なフォントバリエーションの数

// 状態管理: 文字インスタンスの配列（MutableList<ImmutableInstance>）
// 各要素は Object.freeze() された { id: number, char: string, variation: number }
// インスタンス自体は不変、配列は可変（削除・挿入可能）
let characterInstances = [];
let nextId = 1; // 次に割り当てるID

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
 * HTMLの特殊文字をエスケープ
 * @param {string} str - エスケープする文字列
 * @returns {string} エスケープ済み文字列
 */
function escapeHTML(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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

        if (char === '\n') return '<br>';
        if (char === ' ') return ' ';

        return `<span class="char-span font-variation-${variation}">${escapeHTML(char)}</span>`;
    });

    return `<div class="output-text">${processedChars.join('')}</div>`;
}

/**
 * textareaをcharacterInstancesに同期
 * @param {number} cursorPos - カーソル位置
 */
function syncTextarea(cursorPos) {
    const text = characterInstances.map(inst => inst.char).join('');
    textInput.value = text;
    textInput.setSelectionRange(cursorPos, cursorPos);
}

/**
 * characterInstancesをHTMLにレンダリング
 */
function render() {
    const processedHTML = processText(characterInstances);
    outputArea.innerHTML = processedHTML;

    const text = characterInstances.map(inst => inst.char).join('');
    if (text && text.trim() !== '') {
        outputArea.classList.add('has-content');
    } else {
        outputArea.classList.remove('has-content');
    }

    console.log(`🎨 レンダリング完了: ${characterInstances.length}個のインスタンス`);
    console.log(`   ${formatInstancesDebug(characterInstances)}`);
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

// デバッグ表示のフィールド定義
const DEBUG_FIELDS = [
    { key: 'text',         label: d => `テキスト: "${d.text}"` },
    { key: 'variations',   label: d => `バリエーション: [${d.variations.filter(v => v !== 0).join(', ')}]` },
    { key: 'unchanged',    label: d => `変更なし: ${d.unchanged ? 'はい（スキップ）' : 'いいえ'}` },
    { key: 'kept',         label: d => `保持: ${d.kept}文字, 新規: ${d.newChars}文字` },
    { key: 'position',     label: d => `位置: ${d.position}` },
    { key: 'deleted',      label: d => `削除: ${d.deleted}`,       small: true },
    { key: 'deletedCount', label: d => `削除数: ${d.deletedCount}個` },
    { key: 'remaining',    label: d => `残存: ${d.remaining}`,     small: true, breakAll: true },
    { key: 'chars',        label: d => `削除文字: "${d.chars}"` },
    { key: 'instances',    label: d => `インスタンス: ${d.instances}`, small: true, breakAll: true },
    { key: 'reused',       label: d => `再利用: ${d.reused}個` },
    { key: 'created',      label: d => `新規作成: ${d.created}個` },
    { key: 'key',          label: d => `キー: ${d.key}` },
    { key: 'isComposing',  label: d => `IME変換中: ${d.isComposing ? 'はい' : 'いいえ'}` },
];

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
        const dataHTML = DEBUG_FIELDS
            .filter(f => log.data[f.key] !== undefined && log.data[f.key] !== null)
            .map(f => {
                const style = [
                    f.small ? 'font-size: 0.85em' : '',
                    f.breakAll ? 'word-break: break-all' : '',
                ].filter(Boolean).join('; ');
                const attr = style ? ` style="${style}"` : '';
                return `<div class="debug-data"${attr}>${f.label(log.data)}</div>`;
            })
            .join('');

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

/**
 * インスタンスのデバッグ用文字列を生成
 * @param {Array} instances - 対象インスタンス配列
 * @returns {string} デバッグ文字列
 */
function formatInstancesDebug(instances) {
    return instances
        .filter(inst => inst.char !== '\n' && inst.char !== ' ')
        .map(inst => `[ID:${inst.id} "${inst.char}" var:${inst.variation}]`)
        .join(' ');
}

// イベントリスナーの設定

// IME変換中フラグ
let isComposing = false;

/**
 * beforeinput - 入力前に処理（削除・挿入を直接制御）
 */
textInput.addEventListener('beforeinput', (event) => {
    const inputType = event.inputType;
    console.log(`⚡ [beforeinput] ${inputType}`);

    // 直接入力（半角英数）やペースト
    if ((inputType === 'insertText' || inputType === 'insertFromPaste') && !isComposing) {
        event.preventDefault();

        const inserted = event.data || '';
        if (!inserted) return;

        const cursorPos = textInput.selectionStart;
        const selectionEnd = textInput.selectionEnd;

        // 選択範囲があれば先に削除
        if (cursorPos !== selectionEnd) {
            characterInstances.splice(cursorPos, selectionEnd - cursorPos);
        }

        const newInstances = Array.from(inserted).map(char => createInstance(char));
        characterInstances.splice(cursorPos, 0, ...newInstances);

        syncTextarea(cursorPos + newInstances.length);
        render();

        addDebugLog(`📋 ${inputType === 'insertFromPaste' ? 'ペースト' : '直接入力'}`, {
            text: inserted,
            instances: newInstances.map(inst => `ID:${inst.id} "${inst.char}" var:${inst.variation}`).join(', '),
            created: newInstances.length
        });
        return;
    }

    // 削除系の操作
    if (inputType === 'deleteContentBackward' || inputType === 'deleteContentForward') {
        event.preventDefault(); // デフォルト動作を止める

        const cursorPos = textInput.selectionStart;
        const selectionEnd = textInput.selectionEnd;

        // 範囲選択されている場合
        if (cursorPos !== selectionEnd) {
            console.log(`🗑️ 範囲削除: 位置${cursorPos}～${selectionEnd}`);
            // 範囲内のインスタンスを削除
            const deleteCount = selectionEnd - cursorPos;
            const deleted = characterInstances.splice(cursorPos, deleteCount);
            console.log(`🗑️ ${deleteCount}個削除`);

            syncTextarea(cursorPos);
            render();

            addDebugLog('🗑️ 範囲削除', {
                position: `${cursorPos}～${selectionEnd}`,
                deleted: deleted.map(inst => `ID:${inst.id} "${inst.char}" var:${inst.variation}`).join(', '),
                remaining: formatInstancesDebug(characterInstances),
                deletedCount: deleteCount
            });

            return;
        }

        // 単一文字削除
        let deletePos = -1;
        if (inputType === 'deleteContentBackward' && cursorPos > 0) {
            deletePos = cursorPos - 1; // Backspace
        } else if (inputType === 'deleteContentForward' && cursorPos < characterInstances.length) {
            deletePos = cursorPos; // Delete
        }

        if (deletePos >= 0 && deletePos < characterInstances.length) {
            const deleted = characterInstances[deletePos];
            characterInstances.splice(deletePos, 1);
            console.log(`🗑️ 削除: ID=${deleted.id} "${deleted.char}" var=${deleted.variation} at pos=${deletePos}`);

            syncTextarea(deletePos);
            render();

            addDebugLog('🗑️ 文字削除', {
                position: deletePos,
                deleted: `ID:${deleted.id} "${deleted.char}" var:${deleted.variation}`,
                remaining: formatInstancesDebug(characterInstances)
            });
        }

        return;
    }
});

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
    const insertedText = event.data;
    console.log('✅ [compositionend] IME変換確定:', insertedText);

    if (!insertedText) {
        console.log('⚠️ 挿入テキストなし');
        return;
    }

    // カーソル位置を取得
    const cursorPos = textInput.selectionStart;
    const insertPos = cursorPos - insertedText.length; // 挿入開始位置

    console.log(`📝 挿入位置: ${insertPos}, 挿入テキスト: "${insertedText}"`);

    // 挿入された文字ごとにインスタンスを作成
    const insertedChars = Array.from(insertedText);
    const newInstances = insertedChars.map(char => createInstance(char));

    // characterInstancesに挿入
    characterInstances.splice(insertPos, 0, ...newInstances);

    console.log(`✨ ${newInstances.length}個のインスタンスを作成して挿入:`);
    newInstances.forEach(inst => {
        console.log(`   ID=${inst.id} "${inst.char}" var=${inst.variation}`);
    });

    syncTextarea(cursorPos);
    render();

    const instancesDebug = newInstances.map(inst => `ID:${inst.id} "${inst.char}" var:${inst.variation}`).join(', ');
    addDebugLog('✅ IME変換確定', {
        text: insertedText,
        instances: instancesDebug,
        created: newInstances.length
    });
});

/**
 * キーボードイベント処理
 * Enterキーで改行挿入
 */
textInput.addEventListener('keydown', (event) => {
    console.log('⌨️ [keydown] キー:', event.key, 'isComposing:', isComposing);

    if (event.key === 'Enter' && !event.shiftKey && !isComposing) {
        // Shift+Enterでない、かつIME変換中でない場合
        event.preventDefault();
        console.log('↵ [Enter] 改行を挿入');

        // カーソル位置に改行インスタンスを挿入
        const cursorPos = textInput.selectionStart;
        const newlineInstance = createInstance('\n', 0);
        characterInstances.splice(cursorPos, 0, newlineInstance);

        syncTextarea(cursorPos + 1); // 改行後はカーソルを1つ進める
        render();

        addDebugLog('↵ 改行挿入', {
            position: cursorPos
        });
    }
});

// 初期化処理
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎨 手書き風フォントシステム v3.0 - 初期化完了');
    console.log(`📊 利用可能なフォントバリエーション: ${FONT_VARIATIONS_COUNT}種類`);
    console.log('✨ イベント駆動アーキテクチャで動作します');
    console.log('💡 各文字インスタンスは不変（Object.freeze）です');
});

// グローバルスコープに公開（デバッグ用）
window.yuragiFontSystem = {
    processText,
    render,
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
