#!/usr/bin/env node

const app = require('./rest');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);
const io = new Server(server);

// ========== ЛОГИКА ЧАТ-ИГРЫ "СЛОВАРНАЯ ЦЕПОЧКА" ==========

let players = [];
let currentPlayerIndex = 0;
let gameActive = false;
let lastLetter = null;
let lastWord = null;
let lastPlayerName = null;
let wordHistory = [];
let turnTimer = null;
let countdownInterval = null;
let timeLeft = 20;

const TURN_TIME = 20;

function getLastLetter(word) {
  if (!word || word.length === 0) return null;
  let lastChar = word[word.length - 1].toLowerCase();
  const hardLetters = ['ы', 'ъ', 'ь'];
  if (hardLetters.includes(lastChar) && word.length > 1) {
    return word[word.length - 2].toLowerCase();
  }
  return lastChar;
}

function isValidWord(word, requiredLetter, history) {
  if (!word || word.length < 2) return false;
  if (requiredLetter !== null) {
    if (word[0].toLowerCase() !== requiredLetter) return false;
  }
  if (history.includes(word.toLowerCase())) return false;
  return true;
}

function stopTimer() {
  if (turnTimer) clearTimeout(turnTimer);
  if (countdownInterval) clearInterval(countdownInterval);
  turnTimer = null;
  countdownInterval = null;
}

function startTimer() {
  stopTimer();
  if (!gameActive || players.length === 0) return;
  
  timeLeft = TURN_TIME;
  broadcastTimer();
  
  countdownInterval = setInterval(() => {
    if (!gameActive) {
      clearInterval(countdownInterval);
      return;
    }
    timeLeft--;
    broadcastTimer();
    
    if (timeLeft <= 0) {
      clearInterval(countdownInterval);
      endGameWithWinner();
    }
  }, 1000);
  
  turnTimer = setTimeout(() => {
    if (gameActive && timeLeft > 0) {
      endGameWithWinner();
    }
  }, TURN_TIME * 1000);
}

function broadcastTimer() {
  io.emit('timer_update', { timeLeft, currentPlayer: players[currentPlayerIndex]?.name || null });
}

function broadcastGameState() {
  io.emit('game_state', {
    players: players.map(p => ({ name: p.name, score: p.score })),
    currentPlayer: players[currentPlayerIndex]?.name || null,
    lastWord,
    lastLetter,
    wordHistory,
    gameActive,
    lastPlayerName
  });
}

function endGameWithWinner() {
  if (!gameActive) return;
  
  gameActive = false;
  stopTimer();
  
  let winner = lastPlayerName || (players.length > 0 ? players[0].name : null);
  io.emit('game_over', { winner, lastWord, reason: 'timeout' });
  io.emit('system_message', `⏰ Время вышло! Игра завершена. Победитель: ${winner || 'никто'}`);
}

function nextTurn() {
  if (!gameActive || players.length === 0) {
    if (players.length < 2 && gameActive) {
      endGameWithWinner();
    }
    return;
  }
  
  currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
  broadcastGameState();
  startTimer();
}

function startGame() {
  if (players.length < 2) return;
  gameActive = true;
  wordHistory = [];
  lastWord = null;
  lastLetter = null;
  lastPlayerName = null;
  currentPlayerIndex = 0;
  
  players.forEach(p => p.score = 0);
  
  io.emit('system_message', '🎮 ИГРА НАЧАЛАСЬ! Первый игрок пишет ЛЮБОЕ слово.');
  broadcastGameState();
  startTimer();
}

// Socket.IO обработчики
io.on('connection', (socket) => {
  console.log('🔌 Игрок подключился:', socket.id);
  
  socket.on('join_game', (name) => {
    if (players.find(p => p.name === name)) {
      socket.emit('error', 'Такое имя уже есть');
      return;
    }
    players.push({ id: socket.id, name, score: 0 });
    socket.emit('joined', { name });
    io.emit('players_list', players.map(p => ({ name: p.name, score: p.score })));
    io.emit('system_message', `✨ ${name} присоединился к игре`);
    
    if (!gameActive && players.length >= 2) {
      startGame();
    } else if (gameActive) {
      broadcastGameState();
    }
  });
  
  socket.on('send_word', ({ word, playerName }) => {
    if (!gameActive) {
      socket.emit('error', 'Игра не активна');
      return;
    }
    
    const playerIndex = players.findIndex(p => p.name === playerName);
    if (playerIndex === -1) return;
    
    if (players[currentPlayerIndex]?.name !== playerName) {
      socket.emit('error', 'Сейчас не твой ход!');
      return;
    }
    
    let requiredLetter = lastLetter;
    if (lastWord === null) requiredLetter = null;
    
    if (!isValidWord(word, requiredLetter, wordHistory)) {
      socket.emit('error', `Неверное слово! Должно начинаться на "${requiredLetter || 'любую'}" и не повторяться`);
      return;
    }
    
    players[playerIndex].score += 1;
    lastWord = word;
    lastLetter = getLastLetter(word);
    lastPlayerName = playerName;
    wordHistory.push(word.toLowerCase());
    
    io.emit('new_word', { word, player: playerName, lastLetter, lastWord: word });
    io.emit('players_list', players.map(p => ({ name: p.name, score: p.score })));
    io.emit('system_message', `📖 ${playerName} написал: "${word}" → следующая буква: ${lastLetter?.toUpperCase() || '—'}`);
    
    broadcastGameState();
    nextTurn();
  });
  
  socket.on('disconnect', () => {
    const index = players.findIndex(p => p.id === socket.id);
    if (index !== -1) {
      const name = players[index].name;
      players.splice(index, 1);
      io.emit('players_list', players.map(p => ({ name: p.name, score: p.score })));
      io.emit('system_message', `👋 ${name} покинул игру`);
      
      if (players.length < 2 && gameActive) {
        endGameWithWinner();
      } else if (gameActive && players.length > 0) {
        if (currentPlayerIndex >= players.length) currentPlayerIndex = 0;
        broadcastGameState();
        if (players[currentPlayerIndex]?.name === name) {
          nextTurn();
        }
      }
    }
  });
});

// Запуск сервера
server.listen(PORT, () => {
    console.log('========================================');
    console.log('ЗООПАРК + ЧАТ-ИГРА "СЛОВАРНАЯ ЦЕПОЧКА"');
    console.log('========================================');
    console.log(`Сервер запущен на http://localhost:${PORT}`);
    console.log('----------------------------------------');
    console.log('Доступные страницы:');
    console.log(`  Зоопарк (главная)  -> http://localhost:${PORT}/`);
    console.log(`  Чат-игра           -> http://localhost:${PORT}/game`);
    console.log(`  Добавить животное  -> http://localhost:${PORT}/add`);
    console.log(`  API (список)       -> http://localhost:${PORT}/api/items`);
    console.log('========================================');
});

server.on('error', (error) => {
    if (error.syscall !== 'listen') throw error;
    
    switch (error.code) {
        case 'EACCES':
            console.error('Порт ' + PORT + ' требует повышенных привилегий');
            process.exit(1);
            break;
        case 'EADDRINUSE':
            console.error('Порт ' + PORT + ' уже используется');
            process.exit(1);
            break;
        default:
            throw error;
    }
});