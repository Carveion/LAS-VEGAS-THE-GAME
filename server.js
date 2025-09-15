// server.js

// --- 1. SETUP ---
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server);
// IMPORTANT for Deployment: Use the port provided by the host, or 3000 for local development
const PORT = process.env.PORT || 3000; 
app.use(express.static('public'));

// --- 2. GAME STATE & CONSTANTS ---
const PLAYER_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22'];
const MIN_PLAYERS = 2;
let gameState = createInitialGameState();

// --- 3. GAME LOGIC FUNCTIONS (The Game's Rulebook) ---
function createInitialGameState() {
    return {
        players: [],
        roundNumber: 0,
        roundOver: false,
        isGameOver: false,
        casinos: [],
        currentRoll: [],
        currentPlayerIndex: 0,
    };
}

function setupPlayers(playerIds) {
    gameState.players = [];
    playerIds.forEach((id, index) => {
        gameState.players.push({ 
            id: id, 
            name: `Player ${index + 1}`, 
            score: 0,
            color: PLAYER_COLORS[index]
        });
    });
}

function startNewRound() {
    gameState.roundNumber++;
    gameState.isGameOver = false;
    gameState.roundOver = false;
    gameState.players.forEach(p => p.dice = 8);
    gameState.casinos = Array(6).fill(null).map((_, i) => ({ id: i + 1, money: [], placedDice: {} }));
    gameState.currentRoll = [];
    gameState.currentPlayerIndex = 0;
    dealMoney();
}

function dealMoney() {
    const moneyDeck = [90000, 80000, 70000, 60000, 50000, 50000, 40000, 30000, 20000, 10000];
    gameState.casinos.forEach(casino => {
        while (casino.money.reduce((sum, val) => sum + val, 0) < 50000) {
            if (moneyDeck.length === 0) break;
            const randomIndex = Math.floor(Math.random() * moneyDeck.length);
            const card = moneyDeck.splice(randomIndex, 1)[0];
            casino.money.push(card);
        }
        casino.money.sort((a, b) => b - a);
    });
}

function rollDiceForCurrentPlayer() {
    const player = gameState.players[gameState.currentPlayerIndex];
    gameState.currentRoll = [];
    for (let i = 0; i < player.dice; i++) {
        gameState.currentRoll.push(Math.floor(Math.random() * 6) + 1);
    }
}

function placeDiceForCurrentPlayer(dieValue) {
    const player = gameState.players[gameState.currentPlayerIndex];
    const targetCasino = gameState.casinos.find(c => c.id === dieValue);
    const diceToPlace = gameState.currentRoll.filter(d => d === dieValue);

    if (!targetCasino.placedDice[player.id]) {
        targetCasino.placedDice[player.id] = 0;
    }
    targetCasino.placedDice[player.id] += diceToPlace.length;
    player.dice -= diceToPlace.length;
    gameState.currentRoll = [];
}

function nextTurn() {
    if (gameState.players.reduce((sum, p) => sum + p.dice, 0) === 0) {
        endRound();
        return;
    }
    do {
        gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
    } while (gameState.players[gameState.currentPlayerIndex].dice === 0);
}

function calculateRoundWinners() {
    gameState.casinos.forEach(casino => {
        const contenders = Object.entries(casino.placedDice)
            .map(([playerId, diceCount]) => ({ playerId, diceCount }))
            .sort((a, b) => b.diceCount - a.diceCount);

        while (contenders.length > 0 && casino.money.length > 0) {
            const tiedPlayers = contenders.filter(p => p.diceCount === contenders[0].diceCount);
            if (tiedPlayers.length > 1) {
                contenders.splice(0, tiedPlayers.length);
            } else {
                const winner = contenders.shift();
                const prize = casino.money.shift();
                const winningPlayer = gameState.players.find(p => p.id === winner.playerId);
                if (winningPlayer) {
                    winningPlayer.score += prize;
                }
            }
        }
    });
}

function endRound() {
    calculateRoundWinners();
    gameState.roundOver = true;
    io.emit('gameStateUpdate', gameState);

    setTimeout(() => {
        if (gameState.roundNumber >= 4) {
            gameState.isGameOver = true;
            const finalScores = gameState.players.slice().sort((a, b) => b.score - a.score);
            const winner = finalScores[0];
            io.emit('gameOver', winner);
        } else {
            io.emit('roundOver', gameState.roundNumber);
            setTimeout(() => {
                startNewRound();
                io.emit('gameStateUpdate', gameState);
            }, 2000);
        }
    }, 4000);
}

// --- 4. MULTIPLAYER COMMUNICATION ---
const connectedPlayers = {};

function startGame() {
    console.log(`Starting game with ${Object.keys(connectedPlayers).length} players!`);
    gameState = createInitialGameState();
    setupPlayers(Object.keys(connectedPlayers));
    startNewRound();
    io.emit('gameStateUpdate', gameState);
}

io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);
    connectedPlayers[socket.id] = true;

    if (Object.keys(connectedPlayers).length >= MIN_PLAYERS && gameState.players.length === 0) {
        startGame();
    } else {
        socket.emit('gameStateUpdate', gameState);
    }

    socket.on('rollDice', () => {
        const currentPlayer = gameState.players[gameState.currentPlayerIndex];
        if (currentPlayer && currentPlayer.id === socket.id && gameState.currentRoll.length === 0) {
            rollDiceForCurrentPlayer();
            io.emit('gameStateUpdate', gameState);
        }
    });

    socket.on('placeDice', (dieValue) => {
        const currentPlayer = gameState.players[gameState.currentPlayerIndex];
        if (currentPlayer && currentPlayer.id === socket.id && gameState.currentRoll.length > 0) {
            placeDiceForCurrentPlayer(dieValue);
            nextTurn();
            io.emit('gameStateUpdate', gameState);
        }
    });

    socket.on('playAgain', () => {
        if (gameState.isGameOver) {
            startGame();
        }
    });

    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        delete connectedPlayers[socket.id];
        if (Object.keys(connectedPlayers).length < MIN_PLAYERS && gameState.players.length > 0) {
            gameState = createInitialGameState();
            io.emit('gameStateUpdate', gameState);
            console.log("Not enough players, game reset.");
        }
    });
});

// --- 5. START SERVER ---
server.listen(PORT, () => {
    console.log(`Server is running! Open http://localhost:${PORT}`);
});