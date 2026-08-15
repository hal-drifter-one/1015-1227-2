const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// ミドルウェア設定
app.use(cors());
app.use(express.static(path.join(__dirname)));

// 動画同期状態を管理
let videoState = {
  state: 0, // YT.PlayerState（未初期化、再生中など）
  currentTime: 0,
  lastUpdate: Date.now()
};

// ルート
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Socket.io接続管理
io.on('connection', (socket) => {
  console.log(`クライアント接続: ${socket.id}`);

  // 新しいクライアントに現在の動画状態を送信
  socket.emit('sync_video', videoState);

  // クライアントからの同期情報を受け取る
  socket.on('sync_video', (data) => {
    console.log(`動画同期受信 (${socket.id}):`, data);
    
    // 動画状態を更新
    videoState = {
      state: data.state,
      currentTime: data.currentTime,
      lastUpdate: Date.now()
    };

    // 他のすべてのクライアントに同期情報をブロードキャスト
    socket.broadcast.emit('sync_video', videoState);
  });

  // クライアント切断時
  socket.on('disconnect', () => {
    console.log(`クライアント切断: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`サーバーがポート ${PORT} で起動しました`);
  console.log(`http://localhost:${PORT} にアクセスしてください`);
});
