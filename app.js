// --- Data Structure & State ---
let folders = JSON.parse(localStorage.getItem('pw_folders')) || [];
let items = JSON.parse(localStorage.getItem('pw_items')) || [];
let currentFolderId = null;

// --- DOM Elements ---
const listView = document.getElementById('listView');
const headerTitle = document.getElementById('headerTitle');
const backBtn = document.getElementById('backBtn');

// Modals
const folderModal = document.getElementById('folderModal');
const itemModal = document.getElementById('itemModal');
const menuModal = document.getElementById('menuModal');

// Inputs
const folderNameInput = document.getElementById('folderNameInput');
const itemTitleInput = document.getElementById('itemTitleInput');
const itemBodyInput = document.getElementById('itemBodyInput');
const itemFolderSelect = document.getElementById('itemFolderSelect');

// Toast
const toast = document.getElementById('toast');

// --- Initialization ---
function init() {
    renderView();
    setupEventListeners();
}

// --- Render Logic ---
function renderView() {
    listView.innerHTML = '';

    if (currentFolderId === null) {
        // Home View (Show folders)
        headerTitle.textContent = 'ホーム /';
        backBtn.classList.add('hidden');

        if (folders.length === 0) {
            listView.innerHTML = '<div class="empty-state">フォルダがありません。下部のフォルダボタンから追加してください。</div>';
        } else {
            // Sort folders by createdAt desc
            const sortedFolders = [...folders].sort((a, b) => b.createdAt - a.createdAt);
            sortedFolders.forEach(folder => {
                const li = document.createElement('li');
                li.className = 'list-item';
                li.innerHTML = `
                    <div class="item-icon"><i class="fas fa-folder"></i></div>
                    <div class="item-details">
                        <div class="item-title">${escapeHTML(folder.name)}</div>
                        <div class="item-date">${formatDate(folder.createdAt)}</div>
                    </div>
                    <div class="item-action"><i class="fas fa-chevron-right"></i></div>
                `;
                li.addEventListener('click', () => {
                    currentFolderId = folder.id;
                    renderView();
                });
                listView.appendChild(li);
            });
        }
    } else {
        // Folder View (Show items)
        const folder = folders.find(f => f.id === currentFolderId);
        if (!folder) {
            currentFolderId = null;
            renderView();
            return;
        }

        headerTitle.textContent = `ホーム / ${folder.name}`;
        backBtn.classList.remove('hidden');

        const folderItems = items.filter(i => i.folderId === currentFolderId);
        if (folderItems.length === 0) {
            listView.innerHTML = '<div class="empty-state">メモがありません。下部のクリップボタンから追加してください。</div>';
        } else {
            const sortedItems = [...folderItems].sort((a, b) => b.createdAt - a.createdAt);
            sortedItems.forEach(item => {
                const li = document.createElement('li');
                li.className = 'list-item';
                li.innerHTML = `
                    <div class="item-icon note"><i class="fas fa-file-alt"></i></div>
                    <div class="item-details">
                        <div class="item-title">${escapeHTML(item.title)}</div>
                        <div class="item-date">${formatDate(item.createdAt)}</div>
                    </div>
                `;
                li.addEventListener('click', () => {
                    copyToClipboard(item.content);
                });
                // Long press to delete item
                let pressTimer;
                li.addEventListener('touchstart', () => {
                    pressTimer = setTimeout(() => deleteItem(item.id), 1000);
                });
                li.addEventListener('touchend', () => clearTimeout(pressTimer));
                li.addEventListener('mousedown', () => {
                    pressTimer = setTimeout(() => deleteItem(item.id), 1000);
                });
                li.addEventListener('mouseup', () => clearTimeout(pressTimer));
                li.addEventListener('mouseleave', () => clearTimeout(pressTimer));

                listView.appendChild(li);
            });
        }
    }
}

// --- Event Listeners ---
function setupEventListeners() {
    // Back button
    backBtn.addEventListener('click', () => {
        currentFolderId = null;
        renderView();
    });

    // Nav buttons
    document.getElementById('navFolderBtn').addEventListener('click', () => openModal(folderModal));
    document.getElementById('navClipBtn').addEventListener('click', () => {
        updateFolderSelect();
        itemTitleInput.value = '';
        itemBodyInput.value = '';
        openModal(itemModal);
    });
    document.getElementById('navMenuBtn').addEventListener('click', () => openModal(menuModal));

    // Folder Modal
    document.getElementById('cancelFolderBtn').addEventListener('click', () => closeModal(folderModal));
    document.getElementById('saveFolderBtn').addEventListener('click', createFolder);

    // Item Modal
    document.getElementById('cancelItemBtn').addEventListener('click', () => closeModal(itemModal));
    document.getElementById('saveItemBtn').addEventListener('click', createItem);

    // Menu Modal
    document.getElementById('closeMenuBtn').addEventListener('click', () => closeModal(menuModal));
    document.getElementById('menuExportBtn').addEventListener('click', () => {
        closeModal(menuModal);
        exportToJson();
    });
    document.getElementById('menuExportCsvBtn').addEventListener('click', () => {
        closeModal(menuModal);
        exportToCsv();
    });
    document.getElementById('menuImportBtn').addEventListener('click', () => {
        closeModal(menuModal);
        document.getElementById('importFileInput').click();
    });

    document.getElementById('importFileInput').addEventListener('change', importFromFile);

    document.getElementById('menuClearDataBtn').addEventListener('click', () => {
        if (confirm('全てのデータを削除しますか？\n（復元できません）')) {
            clearAllData();
            closeModal(menuModal);
        }
    });

    // Close modals when clicking outside
    [folderModal, itemModal, menuModal].forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal(modal);
        });
    });
}

// --- Actions ---
function createFolder() {
    const name = folderNameInput.value.trim();
    if (!name) return;

    const newFolder = {
        id: 'f_' + Date.now(),
        name: name,
        createdAt: Date.now()
    };
    folders.push(newFolder);
    saveData();
    closeModal(folderModal);
    folderNameInput.value = '';
    renderView();
}

function updateFolderSelect() {
    itemFolderSelect.innerHTML = '<option value="">フォルダを選択</option>';
    folders.forEach(f => {
        const option = document.createElement('option');
        option.value = f.id;
        option.textContent = f.name;
        if (currentFolderId === f.id) {
            option.selected = true;
        }
        itemFolderSelect.appendChild(option);
    });
    if (folders.length > 0 && currentFolderId === null) {
        itemFolderSelect.value = folders[0].id;
    }
}

function createItem() {
    const folderId = itemFolderSelect.value;
    const title = itemTitleInput.value.trim();
    const content = itemBodyInput.value.trim();

    if (!folderId || !title || !content) {
        alert('フォルダ、タイトル、本文をすべて入力してください。');
        return;
    }

    const newItem = {
        id: 'i_' + Date.now(),
        folderId: folderId,
        title: title,
        content: content,
        createdAt: Date.now()
    };
    items.push(newItem);
    saveData();
    closeModal(itemModal);

    // Automatically navigate to the folder where it was added
    currentFolderId = folderId;
    renderView();
}

function deleteItem(id) {
    if (confirm('このメモを削除しますか？')) {
        items = items.filter(i => i.id !== id);
        saveData();
        renderView();
    }
}

function clearAllData() {
    folders = [];
    items = [];
    currentFolderId = null;
    saveData();
    renderView();
}

function saveData() {
    localStorage.setItem('pw_folders', JSON.stringify(folders));
    localStorage.setItem('pw_items', JSON.stringify(items));
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast();
    }).catch(err => {
        console.error('Could not copy text: ', err);
        // Fallback
        const textArea = document.createElement("textarea");
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
            showToast();
        } catch (err) {
            alert("コピーに失敗しました。");
        }
        document.body.removeChild(textArea);
    });
}

function showToast() {
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 2000);
}

// --- Utils ---
function openModal(modal) {
    modal.classList.remove('hidden');
}

function closeModal(modal) {
    modal.classList.add('hidden');
}

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g,
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag]));
}

function formatDate(ts) {
    const d = new Date(ts);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${yyyy}/${mm}/${dd} ${hh}:${min}:${ss}`;
}

// --- Local File Import / Export ---

function exportToJson() {
    const dataStr = JSON.stringify({ folders: folders, items: items }, null, 2);
    downloadFile(dataStr, 'pw_memo_backup.json', 'application/json');
}

function exportToCsv() {
    // Escape CSV cell value
    const escapeCsv = (str) => {
        let result = str.replace(/"/g, '""'); // double any quotes
        if (result.search(/("|,|\n)/g) >= 0) {
            result = `"${result}"`; // wrap in quotes if contains comma, quote, or newline
        }
        return result;
    };

    let csvContent = 'Folder,Title,Content,Created At\n';

    items.forEach(item => {
        const folder = folders.find(f => f.id === item.folderId);
        const folderName = folder ? folder.name : 'Unknown';
        const dateStr = formatDate(item.createdAt);
        csvContent += `${escapeCsv(folderName)},${escapeCsv(item.title)},${escapeCsv(item.content)},${escapeCsv(dateStr)}\n`;
    });

    downloadFile(csvContent, 'pw_memo_data.csv', 'text/csv;charset=utf-8;');
}

function downloadFile(content, fileName, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = fileName;

    document.body.appendChild(a);
    a.click();

    // Cleanup
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
}

function importFromFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (e) => {
        const content = e.target.result;
        try {
            if (file.name.endsWith('.json')) {
                const data = JSON.parse(content);
                if (data && data.folders && data.items) {
                    if (confirm('現在のデータを上書きしてJSONからリストアしますか？')) {
                        folders = data.folders || [];
                        items = data.items || [];
                        saveData();
                        currentFolderId = null;
                        renderView();
                        alert('JSONからのインポートが完了しました。');
                    }
                } else {
                    alert('無効なJSONバックアップファイルです。');
                }
            } else if (file.name.endsWith('.csv')) {
                // Parse CSV and append to existing, or map nicely.
                parseCsvAndImport(content);
            } else {
                alert('対応していないファイル形式です。');
            }
        } catch (err) {
            console.error(err);
            alert('ファイルの読み込みに失敗しました: ' + err.message);
        }
    };

    reader.readAsText(file);
    event.target.value = ''; // Reset input to allow re-selecting same file
}

function parseCsvAndImport(csvText) {
    // Simple CSV parser for standard CSV format.
    const rows = [];
    let currentRow = [];
    let currentCell = '';
    let inQuotes = false;

    for (let i = 0; i < csvText.length; i++) {
        const char = csvText[i];
        const nextChar = csvText[i + 1];

        if (inQuotes) {
            if (char === '"' && nextChar === '"') {
                currentCell += '"';
                i++; // Skip next quote
            } else if (char === '"') {
                inQuotes = false;
            } else {
                currentCell += char;
            }
        } else {
            if (char === '"') {
                inQuotes = true;
            } else if (char === ',') {
                currentRow.push(currentCell);
                currentCell = '';
            } else if (char === '\\n' || char === '\\r') {
                currentRow.push(currentCell);
                if (currentRow.length > 1 || currentRow[0] !== '') {
                    rows.push(currentRow);
                }
                currentRow = [];
                currentCell = '';
                if (char === '\\r' && nextChar === '\\n') i++; // Skip \\n
            } else {
                currentCell += char;
            }
        }
    }
    // Push the very last cell and row
    if (currentCell !== '' || currentRow.length > 0) {
        currentRow.push(currentCell);
        rows.push(currentRow);
    }

    if (rows.length < 2) {
        alert('CSVデータが空か不正な形式です。');
        return;
    }

    // Check header
    const headers = rows[0].map(h => h.trim().toLowerCase());
    // Folder, Title, Content, Created At

    if (!confirm('CSVのデータを現在のデータに追加しますか？')) return;

    let importedItemsCount = 0;

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length < 3) continue; // Skip incomplete relative to basic requirements

        let folderName = row[0] ? row[0].trim() : 'CSVインポート';
        let title = row[1] ? row[1].trim() : '無題メモ';
        let content = row[2] ? row[2].trim() : '';

        if (!content && !title) continue;

        // Find or create folder
        let folder = folders.find(f => f.name === folderName);
        if (!folder) {
            folder = {
                id: 'f_' + Date.now() + Math.random(),
                name: folderName,
                createdAt: Date.now()
            };
            folders.push(folder);
        }

        const newItem = {
            id: 'i_' + Date.now() + Math.random(),
            folderId: folder.id,
            title: title,
            content: content,
            createdAt: Date.now()
        };
        items.push(newItem);
        importedItemsCount++;
    }

    saveData();
    currentFolderId = null;
    renderView();
    alert(importedItemsCount + '件のメモをCSVからインポートしました。');
}

// Start app
init();
