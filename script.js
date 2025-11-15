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
 * contenteditable要素内のカーソル位置を取得（characterInstances配列のインデックス）
 * @returns {number} カーソル位置（文字インデックス）
 */
function getCursorPositionInContentEditable() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return 0;

    const range = selection.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(outputArea);
    preCaretRange.setEnd(range.endContainer, range.endOffset);

    // span要素を数えて位置を計算
    const tempDiv = document.createElement('div');
    tempDiv.appendChild(preCaretRange.cloneContents());

    const spans = tempDiv.querySelectorAll('span[data-instance-id]');
    return spans.length;
}

/**
 * contenteditable要素内の指定位置にカーソルを設定
 * @param {number} position - 文字インデックス
 */
function setCursorPositionInContentEditable(position) {
    const spans = outputArea.querySelectorAll('span[data-instance-id]');

    if (position >= spans.length) {
        // 末尾にカーソル
        const range = document.createRange();
        const selection = window.getSelection();
        range.selectNodeContents(outputArea);
        range.collapse(false); // 末尾
        selection.removeAllRanges();
        selection.addRange(range);
        return;
    }

    if (position < 0) position = 0;

    const targetSpan = spans[position];
    if (targetSpan) {
        const range = document.createRange();
        const selection = window.getSelection();
        range.setStartBefore(targetSpan);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
    }
}

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
        const { id, char, variation } = instance;

        // 改行やスペースの処理
        if (char === '\n') {
            return '<br>';
        }
        if (char === ' ') {
            return ' ';
        }

        // spanでラップしてクラスとdata-instance-idを適用
        return `<span class="char-span font-variation-${variation}" data-instance-id="${id}">${char}</span>`;
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
 * characterInstancesをHTMLにレンダリング（contenteditable対応）
 */
function render() {
    if (characterInstances.length === 0) {
        outputArea.innerHTML = '';
        outputArea.classList.remove('has-content');
        return;
    }

    // 各文字インスタンスをspan要素として直接生成（divで囲まない）
    const htmlFragments = characterInstances.map(instance => {
        const { id, char, variation } = instance;

        if (char === '\n') {
            return '<br>';
        }
        if (char === ' ') {
            return ' ';
        }

        return `<span class="char-span font-variation-${variation}" data-instance-id="${id}">${char}</span>`;
    });

    outputArea.innerHTML = htmlFragments.join('');
    outputArea.classList.add('has-content');

    // デバッグ表示を更新
    const instancesDebug = characterInstances
        .filter(inst => inst.char !== '\n' && inst.char !== ' ')
        .map(inst => `[ID:${inst.id} "${inst.char}" var:${inst.variation}]`)
        .join(' ');

    console.log(`🎨 レンダリング完了: ${characterInstances.length}個のインスタンス`);
    console.log(`   ${instancesDebug}`);
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
        if (log.data.position !== undefined) {
            dataHTML += `<div class="debug-data">位置: ${log.data.position}</div>`;
        }
        if (log.data.deleted !== undefined) {
            // deletedは削除されたインスタンス情報（文字列）
            dataHTML += `<div class="debug-data" style="font-size: 0.85em;">削除: ${log.data.deleted}</div>`;
        }
        if (log.data.deletedCount !== undefined) {
            dataHTML += `<div class="debug-data">削除数: ${log.data.deletedCount}個</div>`;
        }
        if (log.data.remaining !== undefined) {
            // remainingは削除後に残ったインスタンス一覧
            dataHTML += `<div class="debug-data" style="font-size: 0.85em; word-break: break-all;">残存: ${log.data.remaining}</div>`;
        }
        if (log.data.chars !== undefined) {
            dataHTML += `<div class="debug-data">削除文字: "${log.data.chars}"</div>`;
        }
        if (log.data.instances !== undefined) {
            // instancesは挿入/更新時のインスタンス一覧
            dataHTML += `<div class="debug-data" style="font-size: 0.85em; word-break: break-all;">インスタンス: ${log.data.instances}</div>`;
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
 * beforeinput - 入力前に処理（削除・挿入を直接制御）
 */
textInput.addEventListener('beforeinput', (event) => {
    const inputType = event.inputType;
    console.log(`⚡ [beforeinput] ${inputType}`);

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

            // デバッグログ
            const deletedDebug = deleted.map(inst => `ID:${inst.id} "${inst.char}" var:${inst.variation}`).join(', ');
            const remainingDebug = characterInstances
                .filter(inst => inst.char !== '\n' && inst.char !== ' ')
                .map(inst => `[ID:${inst.id} "${inst.char}" var:${inst.variation}]`)
                .join(' ');

            addDebugLog('🗑️ 範囲削除', {
                position: `${cursorPos}～${selectionEnd}`,
                deleted: deletedDebug,
                remaining: remainingDebug,
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

            // デバッグログ（削除後の状態を表示）
            const remainingDebug = characterInstances
                .filter(inst => inst.char !== '\n' && inst.char !== ' ')
                .map(inst => `[ID:${inst.id} "${inst.char}" var:${inst.variation}]`)
                .join(' ');

            addDebugLog('🗑️ 文字削除', {
                position: deletePos,
                deleted: `ID:${deleted.id} "${deleted.char}" var:${deleted.variation}`,
                remaining: remainingDebug
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

/**
 * input イベント - ペースト対応など
 * TODO: ペースト処理を実装
 */
// textInput.addEventListener('input', (event) => {
//     // 現在はbeforeinput/compositionendで処理
//     console.log('⚠️ [input] イベント検出 - 想定外');
// });

// ========================================
// contenteditable用イベントリスナー
// ========================================

let isComposingInEditable = false;

/**
 * compositionstart - IME開始（contenteditable）
 */
outputArea.addEventListener('compositionstart', () => {
    isComposingInEditable = true;
    console.log('🎌 [contenteditable compositionstart] IME変換開始');
    addDebugLog('🎌 IME開始 (editable)', { isComposing: true });
});

/**
 * compositionend - IME確定（contenteditable）
 */
outputArea.addEventListener('compositionend', (event) => {
    isComposingInEditable = false;
    const insertedText = event.data;
    console.log('✅ [contenteditable compositionend] IME確定:', insertedText);

    if (!insertedText) {
        console.log('⚠️ 挿入テキストなし');
        return;
    }

    // カーソル位置を取得
    const cursorPos = getCursorPositionInContentEditable();
    const insertPos = cursorPos - insertedText.length;

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

    render();
    setCursorPositionInContentEditable(cursorPos);

    const instancesDebug = newInstances.map(inst => `ID:${inst.id} "${inst.char}" var:${inst.variation}`).join(', ');
    addDebugLog('✅ IME確定 (editable)', {
        text: insertedText,
        instances: instancesDebug,
        created: newInstances.length
    });
});

/**
 * beforeinput - 削除・挿入等（contenteditable）
 */
outputArea.addEventListener('beforeinput', (event) => {
    const inputType = event.inputType;
    console.log(`⚡ [contenteditable beforeinput] ${inputType}`);

    // IME入力・直接入力をpreventDefaultして自分で処理
    if (inputType === 'insertText' || inputType === 'insertCompositionText') {
        event.preventDefault();
        console.log('⏭️ insertText/insertCompositionText - preventDefault (compositionendで処理)');
        return;
    }

    // 削除系の操作
    if (inputType === 'deleteContentBackward' || inputType === 'deleteContentForward') {
        event.preventDefault();

        const cursorPos = getCursorPositionInContentEditable();

        let deletePos = -1;
        if (inputType === 'deleteContentBackward' && cursorPos > 0) {
            deletePos = cursorPos - 1;
        } else if (inputType === 'deleteContentForward' && cursorPos < characterInstances.length) {
            deletePos = cursorPos;
        }

        if (deletePos >= 0 && deletePos < characterInstances.length) {
            const deleted = characterInstances[deletePos];
            characterInstances.splice(deletePos, 1);
            console.log(`🗑️ 削除: ID=${deleted.id} "${deleted.char}" var=${deleted.variation} at pos=${deletePos}`);

            render();
            setCursorPositionInContentEditable(deletePos);

            const remainingDebug = characterInstances
                .filter(inst => inst.char !== '\n' && inst.char !== ' ')
                .map(inst => `[ID:${inst.id} "${inst.char}" var:${inst.variation}]`)
                .join(' ');

            addDebugLog('🗑️ 削除 (editable)', {
                position: deletePos,
                deleted: `ID:${deleted.id} "${deleted.char}" var:${deleted.variation}`,
                remaining: remainingDebug
            });
        }

        return;
    }
});

// 初期化処理
document.addEventListener('DOMContentLoaded', () => {
    const version = 'v3.0.25';
    console.log(`🎨 手書き風フォントシステム ${version} - 初期化完了`);
    console.log(`📊 利用可能なフォントバリエーション: ${FONT_VARIATIONS_COUNT}種類`);
    console.log('✨ イベント駆動アーキテクチャで動作します');
    console.log('💡 各文字インスタンスは不変（Object.freeze）です');

    // バージョン番号をフッターに表示
    const footer = document.querySelector('footer p');
    if (footer) {
        footer.textContent = `yuragi = trembling/variance (contenteditable prototype) - ${version}`;
    }
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
