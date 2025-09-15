// server.js

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000; 
app.use(express.static('public'));

const PLAYER_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6'];
const MAX_PLAYERS = 5;
let lobby = { players: {} };
let gameState = {};

// --- LOBBY MANAGEMENT ---
function getLobbyState() {
    return Object.values(lobby.players);
}

function checkIfAllReady() {
    const players = Object.values(lobby.players);
    if (players.length >= 2 && players.every(p => p.isReady)) {
        startGame();
    }
}

// --- GAME LOGIC (Mostly unchanged) ---
function startGame() {
    console.log(`Starting game with ${Object.keys(lobby.players).length} players!`);
    const playerIds = Object.keys(lobby.players);
    setupGameState(playerIds);
    startNewRound();
    io.emit('gameStarted'); // Signal to clients to switch screens
    io.emit('gameStateUpdate', gameState);
}
// ... (All other game logic functions: setupGameState, startNewRound, dealMoney, etc. are below)

io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    socket.on('joinLobby', (playerName) => {
        if (Object.keys(lobby.players).length < MAX_PLAYERS) {
            lobby.players[socket.id] = {
                id: socket.id,
                name: playerName,
                isReady: false
            };
            io.emit('lobbyUpdate', getLobbyState());
        } else {
            socket.emit('lobbyFull'); // Optional: Tell the player the lobby is full
        }
    });

    socket.on('playerReady', () => {
        if (lobby.players[socket.id]) {
            lobby.players[socket.id].isReady = !lobby.players[socket.id].isReady;
            io.emit('lobbyUpdate', getLobbyState());
            checkIfAllReady();
        }
    });

    socket.on('rollDice', () => { /* ... same as previous version ... */ });
    socket.on('placeDice', (dieValue) => { /* ... same as previous version ... */ });
    socket.on('playAgain', () => { /* ... we'll replace this with lobby logic ... */ });

    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        delete lobby.players[socket.id];
        // If a player disconnects, we need to handle game state reset if game was in progress
        // For now, let's focus on the lobby disconnect
        io.emit('lobbyUpdate', getLobbyState());
    });
});

// Full game logic functions from before
function setupGameState(playerIds) {
    const playersFromLobby = playerIds.map((id, index) => ({
        id: id,
        name: lobby.players[id].name,
        score: 0,
        color: PLAYER_COLORS[index]
    }));
    gameState = { players: playersFromLobby, roundNumber: 0, isGameOver: false, /* etc */ };
}
// ... [rest of the game logic functions - a full copy is below for clarity]

// --- FULL SERVER CODE ---
function endRound() { /* identical to previous version */ }
function calculateRoundWinners() { /* identical to previous version */ }
function nextTurn() { /* identical to previous version */ }
function placeDiceForCurrentPlayer(dieValue) { /* identical to previous version */ }
function rollDiceForCurrentPlayer() { /* identical to previous version */ }
function dealMoney() { /* identical to previous version */ }
function startNewRound() { /* identical to previous version */ }

server.listen(PORT, () => {
    console.log(`Server is running! Open http://localhost:${PORT}`);
});

// Full code for clarity (copy from here)
function placeDiceForCurrentPlayer(dieValue){const player=gameState.players[gameState.currentPlayerIndex];const targetCasino=gameState.casinos.find(c=>c.id===dieValue);const diceToPlace=gameState.currentRoll.filter(d=>d===dieValue);if(!targetCasino.placedDice[player.id]){targetCasino.placedDice[player.id]=0}targetCasino.placedDice[player.id]+=diceToPlace.length;player.dice-=diceToPlace.length;gameState.currentRoll=[]}
function nextTurn(){if(gameState.players.reduce((sum,p)=>sum+p.dice,0)===0){endRound();return}do{gameState.currentPlayerIndex=(gameState.currentPlayerIndex+1)%gameState.players.length}while(gameState.players[gameState.currentPlayerIndex].dice===0)}
function calculateRoundWinners(){gameState.casinos.forEach(casino=>{const contenders=Object.entries(casino.placedDice).map(([playerId,diceCount])=>({playerId,diceCount})).sort((a,b)=>b.diceCount-a.diceCount);while(contenders.length>0&&casino.money.length>0){const tiedPlayers=contenders.filter(p=>p.diceCount===contenders[0].diceCount);if(tiedPlayers.length>1){contenders.splice(0,tiedPlayers.length)}else{const winner=contenders.shift();const prize=casino.money.shift();const winningPlayer=gameState.players.find(p=>p.id===winner.playerId);if(winningPlayer){winningPlayer.score+=prize}}}})}
function endRound(){calculateRoundWinners();gameState.roundOver=true;io.emit('gameStateUpdate',gameState);setTimeout(()=>{if(gameState.roundNumber>=4){gameState.isGameOver=true;const finalScores=gameState.players.slice().sort((a,b)=>b.score-a.score);const winner=finalScores[0];io.emit('gameOver',winner)}else{io.emit('roundOver',gameState.roundNumber);setTimeout(()=>{startNewRound();io.emit('gameStateUpdate',gameState)},2000)}},4000)}
function rollDiceForCurrentPlayer(){const player=gameState.players[gameState.currentPlayerIndex];gameState.currentRoll=[];for(let i=0;i<player.dice;i++){gameState.currentRoll.push(Math.floor(Math.random()*6)+1)}}
function dealMoney(){const moneyDeck=[90000,80000,70000,60000,50000,50000,40000,30000,20000,10000];gameState.casinos.forEach(casino=>{while(casino.money.reduce((sum,val)=>sum+val,0)<50000){if(moneyDeck.length===0)break;const randomIndex=Math.floor(Math.random()*moneyDeck.length);const card=moneyDeck.splice(randomIndex,1)[0];casino.money.push(card)}casino.money.sort((a,b)=>b-a)})}
function startNewRound(){gameState.roundNumber++;gameState.isGameOver=false;gameState.roundOver=false;gameState.players.forEach(p=>p.dice=8);gameState.casinos=Array(6).fill(null).map((_,i)=>({id:i+1,money:[],placedDice:{}}));gameState.currentRoll=[];gameState.currentPlayerIndex=0;dealMoney()}