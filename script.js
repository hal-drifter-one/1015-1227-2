// YouTube プレイヤー変数
let player;
let isPlayerReady = false;
let isSyncing = false;
let lastUpdateTime = 0;

// Socket.io接続設定
let socket;

// YouTube IFrame API読み込み完了時のコールバック
window.onYouTubeIFrameAPIReady = function() {
  player = new YT.Player('youtubePlayer', {
    height: '390',
    width: '640',
    videoId: 'dQw4w9WgXcQ', // デフォルトのYouTubeビデオID
    events: {
      'onReady': onPlayerReady,
      'onStateChange': onPlayerStateChange
    }
  });
};

function onPlayerReady(event) {
  isPlayerReady = true;
  console.log('YouTube プレイヤーが準備完了しました');
}

function onPlayerStateChange(event) {
  if (!isSyncing && isPlayerReady) {
    const state = event.data;
    const currentTime = player.getCurrentTime();
    
    // 同期情報をサーバーに送信
    if (socket) {
      socket.emit('sync_video', {
        state: state,
        currentTime: currentTime
      });
    }
  }
}

// チャット機能
const chatInput = document.getElementById('chatInput');
const chatSendButton = document.getElementById('chatSendButton');
const chatMessages = document.getElementById('chatMessages');
const stampMenuBtn = document.getElementById('stampMenuBtn');
const stampMenu = document.getElementById('stampMenu');
const clearAllBtn = document.getElementById('clearAllBtn');

// メッセージをLocalStorageに保存
let messages = [];
const STORAGE_KEY = 'chat_messages';
const REACTIONS_STORAGE_KEY = 'message_reactions';

// LocalStorageからメッセージを読み込む
function loadMessages() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    messages = JSON.parse(stored);
    renderMessages();
  }
}

// メッセージをLocalStorageに保存
function saveMessages() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
}

// リアクションを取得
function getReactions(messageId) {
  const reactions = localStorage.getItem(`${REACTIONS_STORAGE_KEY}_${messageId}`);
  return reactions ? JSON.parse(reactions) : {};
}

// リアクションを保存
function saveReaction(messageId, emoji) {
  const reactions = getReactions(messageId);
  if (!reactions[emoji]) {
    reactions[emoji] = 0;
  }
  reactions[emoji]++;
  localStorage.setItem(`${REACTIONS_STORAGE_KEY}_${messageId}`, JSON.stringify(reactions));
  renderMessages();
}

function addMessage(text, isUser) {
  const messageId = Date.now();
  const messageObj = {
    id: messageId,
    text: text,
    isUser: isUser,
    timestamp: new Date().toLocaleTimeString()
  };
  
  messages.push(messageObj);
  saveMessages();
  renderMessages();
}

function deleteMessage(messageId) {
  messages = messages.filter(msg => msg.id !== messageId);
  saveMessages();
  // リアクション情報も削除
  localStorage.removeItem(`${REACTIONS_STORAGE_KEY}_${messageId}`);
  renderMessages();
}

function clearAllMessages() {
  if (confirm('すべてのメッセージを削除しますか？')) {
    messages.forEach(msg => {
      localStorage.removeItem(`${REACTIONS_STORAGE_KEY}_${msg.id}`);
    });
    messages = [];
    saveMessages();
    renderMessages();
  }
}

function renderMessages() {
  chatMessages.innerHTML = '';
  messages.forEach((messageObj) => {
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${messageObj.isUser ? 'user' : 'bot'}`;
    messageDiv.id = `msg-${messageObj.id}`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'chat-message-content';
    contentDiv.textContent = messageObj.text;
    
    // コピー機能
    contentDiv.addEventListener('click', () => {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(messageObj.text).then(() => {
          alert('コピーしました！');
        });
      } else {
        // フォールバック（古いブラウザ対応）
        const textarea = document.createElement('textarea');
        textarea.value = messageObj.text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        alert('コピーしました！');
      }
    });
    
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'chat-message-actions';
    
    const reactionMenuBtn = document.createElement('button');
    reactionMenuBtn.className = 'chat-message-btn';
    reactionMenuBtn.textContent = '👍 リアクション';
    reactionMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      showReactionMenu(messageObj.id, reactionMenuBtn);
    });
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'chat-message-btn';
    deleteBtn.textContent = '🗑️';
    deleteBtn.addEventListener('click', () => {
      deleteMessage(messageObj.id);
    });
    
    actionsDiv.appendChild(reactionMenuBtn);
    actionsDiv.appendChild(deleteBtn);
    messageDiv.appendChild(contentDiv);
    messageDiv.appendChild(actionsDiv);
    
    // リアクション表示
    const reactions = getReactions(messageObj.id);
    if (Object.keys(reactions).length > 0) {
      const reactionsDiv = document.createElement('div');
      reactionsDiv.className = 'message-reactions';
      reactionsDiv.style.marginTop = '0.5rem';
      reactionsDiv.style.fontSize = '0.9rem';
      
      for (const [emoji, count] of Object.entries(reactions)) {
        const reactionSpan = document.createElement('span');
        reactionSpan.className = 'reaction-item';
        reactionSpan.style.marginRight = '0.5rem';
        reactionSpan.style.padding = '0.25rem 0.5rem';
        reactionSpan.style.background = 'rgba(0, 0, 0, 0.1)';
        reactionSpan.style.borderRadius = '4px';
        reactionSpan.style.cursor = 'pointer';
        reactionSpan.textContent = `${emoji} ${count}`;
        reactionSpan.addEventListener('click', () => {
          saveReaction(messageObj.id, emoji);
        });
        reactionsDiv.appendChild(reactionSpan);
      }
      
      messageDiv.appendChild(reactionsDiv);
    }
    
    chatMessages.appendChild(messageDiv);
  });
  
  // 最下部にスクロール
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// リアクションメニューを表示
function showReactionMenu(messageId, button) {
  // 既存のメニューを削除
  const existingMenu = document.querySelector('.reaction-menu.active');
  if (existingMenu) existingMenu.remove();
  
  const reactionMenu = document.createElement('div');
  reactionMenu.className = 'reaction-menu active';
  reactionMenu.style.position = 'fixed';
  reactionMenu.style.background = 'white';
  reactionMenu.style.border = '1px solid #ccc';
  reactionMenu.style.borderRadius = '8px';
  reactionMenu.style.padding = '0.5rem';
  reactionMenu.style.display = 'grid';
  reactionMenu.style.gridTemplateColumns = 'repeat(4, 1fr)';
  reactionMenu.style.gap = '0.25rem';
  reactionMenu.style.zIndex = '10000';
  reactionMenu.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.1)';
  
  const reactionEmojis = ['👍', '❤️', '😂', '😍', '🎉', '🔥', '👏', '🎯', '💯', '🚀', '⭐', '😢'];
  
  reactionEmojis.forEach(emoji => {
    const span = document.createElement('span');
    span.textContent = emoji;
    span.style.fontSize = '1.5rem';
    span.style.cursor = 'pointer';
    span.style.padding = '0.25rem';
    span.style.borderRadius = '4px';
    span.style.transition = 'background 0.2s';
    span.addEventListener('mouseenter', () => {
      span.style.background = '#f0f0f0';
    });
    span.addEventListener('mouseleave', () => {
      span.style.background = 'transparent';
    });
    span.addEventListener('click', () => {
      saveReaction(messageId, emoji);
      reactionMenu.remove();
    });
    reactionMenu.appendChild(span);
  });
  
  document.body.appendChild(reactionMenu);
  
  const rect = button.getBoundingClientRect();
  reactionMenu.style.left = (rect.left - 100) + 'px';
  reactionMenu.style.top = (rect.bottom + 5) + 'px';
  
  // 外をクリックしたら閉じる
  setTimeout(() => {
    document.addEventListener('click', function closeMenu(e) {
      if (!reactionMenu.contains(e.target) && e.target !== button) {
        reactionMenu.remove();
        document.removeEventListener('click', closeMenu);
      }
    });
  }, 0);
}

chatSendButton.addEventListener('click', () => {
  const message = chatInput.value.trim();
  if (message) {
    addMessage(message, true);
    chatInput.value = '';
  }
});

chatInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    chatSendButton.click();
  }
});

// スタンプメニュー機能
stampMenuBtn.addEventListener('click', () => {
  stampMenu.classList.toggle('active');
});

// スタンプの選択
document.querySelectorAll('.stamp-item').forEach(stamp => {
  stamp.addEventListener('click', () => {
    const stampText = stamp.getAttribute('data-stamp');
    addMessage(stampText, true);
    stampMenu.classList.remove('active');
  });
});

// 全削除機能
clearAllBtn.addEventListener('click', () => {
  clearAllMessages();
});

// スタンプメニュー外をクリックしたら閉じる
document.addEventListener('click', (e) => {
  if (!stampMenuBtn.contains(e.target) && !stampMenu.contains(e.target)) {
    stampMenu.classList.remove('active');
  }
});

// ページ読み込み時にメッセージを読み込む
loadMessages();

// ファイルアップロード機能
const fileInput = document.getElementById('fileInput');
const uploadButton = document.getElementById('uploadButton');
const fileList = document.getElementById('fileList');
let uploadedFiles = [];
const FILES_STORAGE_KEY = 'uploaded_files';

// LocalStorageからファイルリストを読み込む
function loadFiles() {
  const stored = localStorage.getItem(FILES_STORAGE_KEY);
  if (stored) {
    uploadedFiles = JSON.parse(stored);
    updateFileList();
  }
}

uploadButton.addEventListener('click', () => {
  const files = fileInput.files;
  if (files.length > 0) {
    for (let file of files) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const fileData = {
          name: file.name,
          size: file.size,
          type: file.type,
          uploadDate: new Date().toLocaleString(),
          data: e.target.result // Base64エンコードされたファイルデータ
        };
        uploadedFiles.push(fileData);
        localStorage.setItem(FILES_STORAGE_KEY, JSON.stringify(uploadedFiles));
        updateFileList();
      };
      reader.readAsDataURL(file);
    }
    fileInput.value = '';
  }
});

function updateFileList() {
  fileList.innerHTML = '';
  uploadedFiles.forEach((fileObj, index) => {
    const fileItem = document.createElement('div');
    fileItem.className = 'file-item';
    
    // ファイルサイズを人間が読める形式に変換
    const sizeKB = (fileObj.size / 1024).toFixed(2);
    
    fileItem.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
        <div style="flex: 1;">
          <div>📄 ${fileObj.name}</div>
          <div style="font-size: 0.8rem; color: #666; margin-top: 0.25rem;">
            ${sizeKB}KB | ${fileObj.uploadDate}
          </div>
        </div>
        <div style="display: flex; gap: 0.25rem;">
          <button style="background: #3498db; color: white; border: none; border-radius: 3px; padding: 0.25rem 0.5rem; cursor: pointer; font-size: 0.8rem;" onclick="downloadFile(${index})">DL</button>
          <button style="background: #e74c3c; color: white; border: none; border-radius: 3px; padding: 0.25rem 0.5rem; cursor: pointer; font-size: 0.8rem;" onclick="removeFile(${index})">削除</button>
        </div>
      </div>
    `;
    fileList.appendChild(fileItem);
  });
}

function removeFile(index) {
  uploadedFiles.splice(index, 1);
  localStorage.setItem(FILES_STORAGE_KEY, JSON.stringify(uploadedFiles));
  updateFileList();
}

function downloadFile(index) {
  const fileObj = uploadedFiles[index];
  const link = document.createElement('a');
  link.href = fileObj.data;
  link.download = fileObj.name;
  link.click();
}

// ページ読み込み時にファイルリストを読み込む
loadFiles();

// Socket.io初期化
function initSocket() {
  try {
    const syncStatus = document.getElementById('syncStatus');
    syncStatus.textContent = '同期状態: サーバー待機中';

    const socketUrl = (() => {
      const origin = window.location.origin;
      const isLocalHost = origin.includes('localhost') || origin.includes('127.0.0.1');
      if (isLocalHost || window.location.port === '3000') {
        return undefined;
      }
      return 'http://localhost:3000';
    })();

    socket = io(socketUrl, {
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      console.log('サーバーに接続しました');
      syncStatus.textContent = '同期状態: 接続済み';
    });

    socket.on('disconnect', () => {
      console.log('サーバーから切断されました');
      syncStatus.textContent = '同期状態: 接続待ち';
    });

    socket.on('connect_error', () => {
      console.warn('サーバーに接続できません。ローカルサーバーを起動してください。');
      syncStatus.textContent = '同期状態: サーバー待機中';
    });

    socket.on('sync_video', (data) => {
      if (isPlayerReady) {
        isSyncing = true;

        const { state, currentTime } = data;

        // 再生状態の同期
        if (state === YT.PlayerState.PLAYING) {
          if (player.getPlayerState() !== YT.PlayerState.PLAYING) {
            player.play();
          }
        } else if (state === YT.PlayerState.PAUSED) {
          if (player.getPlayerState() === YT.PlayerState.PLAYING) {
            player.pause();
          }
        }

        // 再生時間の同期（1秒以上の差がある場合）
        if (Math.abs(player.getCurrentTime() - currentTime) > 1) {
          player.seekTo(currentTime, true);
        }

        setTimeout(() => {
          isSyncing = false;
        }, 500);
      }
    });
  } catch (error) {
    console.error('Socket.ioの初期化に失敗しました:', error);
    document.getElementById('syncStatus').textContent = '同期状態: サーバー待機中';
  }
}

// ページ読み込み時にSocket.ioを初期化
document.addEventListener('DOMContentLoaded', () => {
  initSocket();
});
