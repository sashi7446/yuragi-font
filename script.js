// 手書き風フォントシステム - メインスクリプト

// 設定
const FONT_VARIATIONS_COUNT = 6; // 利用可能なフォントバリエーションの数

// 状態管理: 文字インスタンスの配列
// 各要素は { id: number, char: string, variation: number }
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
 * 出力エリアを更新
 * @param {string} text - 表示するテキスト
 */
function updateOutput(text) {
    console.log('🔄 updateOutput が呼ばれました');

    // 削除検出
    const cursorPos = textInput.selectionStart;
    const deletion = detectDeletion(previousText, text, cursorPos);

    if (deletion && deletion.instances.length > 0) {
        console.log('🗑️ 削除を検出:');
        console.log(`  位置: ${deletion.position}`);
        console.log(`  文字: "${deletion.chars}"`);
        deletion.instances.forEach(inst => {
            console.log(`  削除されたインスタンス: ID=${inst.id}, char="${inst.char}", variation=${inst.variation}`);
        });

        addDebugLog('🗑️ 削除検出', {
            position: deletion.position,
            chars: deletion.chars,
            instances: deletion.instances.map(inst => `ID:${inst.id} "${inst.char}" var:${inst.variation}`).join(', ')
        });
    }

    // 前回の状態を更新
    previousText = text;
    previousCursorPos = cursorPos;

    const newCharacters = Array.from(text);
    const oldText = characterInstances.map(inst => inst.char).join('');

    // 改行・スペース以外の文字インスタンスのみ抽出
    const oldCharsFiltered = characterInstances.filter(inst => inst.char !== '\n' && inst.char !== ' ');
    const oldTextFiltered = oldCharsFiltered.map(inst => inst.char).join('');

    let reuseCount = 0;
    let newCount = 0;
    const newInstances = [];

    // 戦略1: 既存テキストが新テキストに部分文字列として含まれているか確認
    const oldTextIndex = text.indexOf(oldTextFiltered);

    if (oldTextIndex !== -1 && oldTextFiltered.length > 0) {
        // 既存テキストが見つかった場合 - 位置ベースで保持
        console.log(`📍 既存テキスト「${oldTextFiltered}」を位置${oldTextIndex}で発見 - 位置ベース保持を実行`);

        let oldCharIndexInFiltered = 0; // oldCharsFiltered内のインデックス

        for (let i = 0; i < newCharacters.length; i++) {
            const char = newCharacters[i];

            // 改行やスペースの場合
            if (char === '\n' || char === ' ') {
                newInstances.push({
                    id: nextId++,
                    char: char,
                    variation: 0
                });
                continue;
            }

            // この位置が既存テキストの範囲内かチェック
            if (i >= oldTextIndex && oldCharIndexInFiltered < oldCharsFiltered.length) {
                const oldInstance = oldCharsFiltered[oldCharIndexInFiltered];
                if (oldInstance.char === char) {
                    // 既存インスタンスを再利用
                    newInstances.push(oldInstance);
                    console.log(`📌 位置${i}: "${char}" (ID:${oldInstance.id}) を再利用、バリエーション${oldInstance.variation}を保持`);
                    reuseCount++;
                    oldCharIndexInFiltered++;
                } else {
                    // 文字が一致しない場合は新規作成
                    const newInstance = {
                        id: nextId++,
                        char: char,
                        variation: getRandomVariation()
                    };
                    newInstances.push(newInstance);
                    console.log(`✨ 位置${i}: "${char}" (ID:${newInstance.id}) を新規作成（不一致）、バリエーション${newInstance.variation}`);
                    newCount++;
                }
            } else {
                // 既存テキスト範囲外 - 新規インスタンス作成
                const newInstance = {
                    id: nextId++,
                    char: char,
                    variation: getRandomVariation()
                };
                newInstances.push(newInstance);
                console.log(`✨ 位置${i}: "${char}" (ID:${newInstance.id}) を新規作成、バリエーション${newInstance.variation}`);
                newCount++;
            }
        }
    } else {
        // 戦略2: 既存テキストが見つからない場合 - グリーディマッチング
        console.log('🔍 既存テキストが見つからない - グリーディマッチングを実行');

        const availableInstances = [...oldCharsFiltered];

        // 削除検出: 古いテキストより新しいテキストの方が短い場合
        const isDeletion = oldCharsFiltered.length > newCharacters.filter(c => c !== '\n' && c !== ' ').length;

        if (isDeletion) {
            console.log('🗑️ 削除を検出 - 後ろからマッチング戦略を使用');
        }

        for (const char of newCharacters) {
            // 改行やスペースの場合
            if (char === '\n' || char === ' ') {
                newInstances.push({
                    id: nextId++,
                    char: char,
                    variation: 0
                });
                continue;
            }

            // プールから同じ文字のインスタンスを探す
            // 削除の場合は後ろから、追加の場合は前から探す
            let matchIndex = -1;
            if (isDeletion) {
                // 後ろから検索 (最後に見つかったインデックスを取得)
                for (let i = availableInstances.length - 1; i >= 0; i--) {
                    if (availableInstances[i].char === char) {
                        matchIndex = i;
                        break;
                    }
                }
            } else {
                // 前から検索
                matchIndex = availableInstances.findIndex(inst => inst.char === char);
            }

            if (matchIndex !== -1) {
                // 既存のインスタンスを再利用
                const reusedInstance = availableInstances.splice(matchIndex, 1)[0];
                newInstances.push(reusedInstance);
                console.log(`📌 "${char}" (ID:${reusedInstance.id}) を再利用、バリエーション${reusedInstance.variation}を保持`);
                reuseCount++;
            } else {
                // 新しいインスタンスを作成
                const newInstance = {
                    id: nextId++,
                    char: char,
                    variation: getRandomVariation()
                };
                newInstances.push(newInstance);
                console.log(`✨ "${char}" (ID:${newInstance.id}) を新規作成、バリエーション${newInstance.variation}を割り当て`);
                newCount++;
            }
        }
    }

    const deletedCount = oldCharsFiltered.length - reuseCount;
    console.log(`✅ 完了: 再利用 ${reuseCount}個, 新規 ${newCount}個, 削除 ${deletedCount}個`);

    // 状態を更新
    characterInstances = newInstances;

    // デバッグログに現在のcharacterInstancesを追加
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

    // HTMLを生成して表示
    const processedHTML = processText(characterInstances);
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
    getInstanceCount: () => characterInstances.length
};
