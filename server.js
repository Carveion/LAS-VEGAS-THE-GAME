// server.js

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000; 
app.use(express.static('public'));

// --- CONSTANTS ---
const PLAYER_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6'];
const MAX_PLAYERS = 5;
const CASINO_NAMES = ["Bellagio", "Caesars Palace", "MGM Grand", "The Venetian", "Luxor", "Wynn"];
const EVENT_CARD_TEMPLATES = [
    { type: 'Market Up', title: 'Market Up', text: 'Bull market! All casinos gain +$10k on each money card.' }, { type: 'Market Up', title: 'Market Up', text: 'Bull market! All casinos gain +$10k on each money card.' },
    { type: 'Market Down', title: 'Market Down', text: 'Bear market! All casinos lose -$10k on each money card.' }, { type: 'Market Down', title: 'Market Down', text: 'Bear market! All casinos lose -$10k on each money card.' },
    { type: 'Casino Acquired', title: 'Casino Acquired', text: 'A mystery buyer acquires {casino}! It is closed for the round.' }, { type: 'Casino Acquired', title: 'Casino Acquired', text: 'A mystery buyer acquires {casino}! It is closed for the round.' },
    { type: 'Casino Renovated', title: 'Renovation!', text: '{casino} is renovated! Its total value is DOUBLED.' }, { type: 'Casino Renovated', title: 'Renovation!', text: '{casino} is renovated! Its total value is DOUBLED.' },
    { type: 'Casino Auctioned', title: 'Auction!', text: '{casino} is auctioned off! Its total value is HALVED.' }, { type: 'Casino Auctioned', title: 'Auction!', text: '{casino} is auctioned off! Its total value is HALVED.' },
    { type: 'Event Day!', title: 'Event Day!', text: 'It\'s showtime! {casino}\'s value is multiplied by 5!' },
    { type: 'Golden Die', title: 'Golden Die', text: 'Lady Luck smiles! You get a Golden Die on your next roll.' },
];

let lobby = { players: {}, hostId: null };
let gameState = {};
let gameMode = 'classic';

function getLobbyState() { return Object.values(lobby.players); }
function checkIfAllReady() { const players = Object.values(lobby.players); if (players.length >= 2 && players.every(p => p.isReady)) { io.emit('showModeSelection', lobby.hostId); } }

function startGame(selectedMode) {
    gameMode = selectedMode;
    console.log(`Starting ${gameMode} game with ${Object.keys(lobby.players).length} players!`);
    setupGameState(Object.keys(lobby.players));
    startNewRound();
    io.emit('gameStarted');
    io.emit('gameStateUpdate', { ...gameState, gameMode });
}

function setupGameState(playerIds) {
    const playersFromLobby = playerIds.map((id, index) => ({ id, name: lobby.players[id].name, score: 0, color: PLAYER_COLORS[index], powers: { hasImmunity: false, canShiftBet: false, hasGoldenDie: false } }));
    gameState = { players: playersFromLobby, roundNumber: 0, isGameOver: false, roundOver: false, casinos: [], currentRoll: [], currentPlayerIndex: 0, turnNumber: 0, lastEvent: null, eventDrawnThisTurn: false };
}

function startNewRound() {
    gameState.roundNumber++;
    gameState.isGameOver = false;
    gameState.roundOver = false;
    gameState.players.forEach(p => { p.dice = 8; p.powers = { hasImmunity: false, canShiftBet: false, hasGoldenDie: false }; });
    gameState.casinos = Array(6).fill(null).map((_, i) => ({ id: i + 1, name: CASINO_NAMES[i], money: [], placedDice: {}, isClosed: false }));
    gameState.currentRoll = [];
    gameState.currentPlayerIndex = 0;
    gameState.turnNumber = 0;
    gameState.lastEvent = null;
    gameState.eventDrawnThisTurn = false;
    if (gameMode === 'highStakes') {
        let deck = [...EVENT_CARD_TEMPLATES];
        for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[deck[i], deck[j]] = [deck[j], deck[i]]; }
        gameState.eventDeck = deck;
    }
    dealMoney();
}

function dealMoney(){const moneyDeck=[90000,80000,70000,60000,50000,50000,40000,30000,20000,10000];gameState.casinos.forEach(casino=>{while(casino.money.reduce((sum,val)=>sum+val,0)<50000){if(moneyDeck.length===0)break;const card=moneyDeck.splice(Math.floor(Math.random()*moneyDeck.length),1)[0];casino.money.push(card)}casino.money.sort((a,b)=>b-a)})}
function rollDiceForCurrentPlayer(){const player=gameState.players[gameState.currentPlayerIndex];gameState.currentRoll=[];for(let i=0;i<player.dice;i++){gameState.currentRoll.push(Math.floor(Math.random()*6)+1)}if(player.powers.hasGoldenDie){if(player.dice>0){gameState.currentRoll[player.dice-1]='G'}player.powers.hasGoldenDie=false}}
function placeDiceForCurrentPlayer(dieValue){const player=gameState.players[gameState.currentPlayerIndex];const targetCasino=gameState.casinos.find(c=>c.id===dieValue);const diceToPlace=gameState.currentRoll.filter(d=>d===dieValue);if(!targetCasino.placedDice[player.id]){targetCasino.placedDice[player.id]=0}targetCasino.placedDice[player.id]+=diceToPlace.length;player.dice-=diceToPlace.length;gameState.currentRoll=[]}
function calculateRoundWinners(){gameState.casinos.forEach(casino=>{const contenders=Object.entries(casino.placedDice).map(([playerId,diceCount])=>({playerId,diceCount})).sort((a,b)=>b.diceCount-a.diceCount);while(contenders.length>0&&casino.money.length>0){const tiedPlayers=contenders.filter(p=>p.diceCount===contenders[0].diceCount);if(tiedPlayers.length>1){contenders.splice(0,tiedPlayers.length)}else{const winner=contenders.shift();const prize=casino.money.shift();const winningPlayer=gameState.players.find(p=>p.id===winner.playerId);if(winningPlayer)winningPlayer.score+=prize}}})}
function endRound(){
    if(gameMode === 'highStakes') {
        // Here you would add the logic for players to use their "Shift Bet" power if they have it
    }
    calculateRoundWinners();
    gameState.roundOver=true;io.emit('gameStateUpdate',{...gameState,gameMode});setTimeout(()=>{if(gameState.roundNumber>=4){gameState.isGameOver=true;const winner=gameState.players.slice().sort((a,b)=>b.score-a.score)[0];io.emit('gameOver',winner)}else{io.emit('roundOver',gameState.roundNumber);setTimeout(()=>{startNewRound();io.emit('gameStateUpdate',{...gameState,gameMode})},3000)}},5000)
}

function nextTurn() {
    if (gameState.players.reduce((sum, p) => sum + p.dice, 0) === 0) { endRound(); return; }
    do { gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length; } while (gameState.players[gameState.currentPlayerIndex].dice === 0);
    gameState.eventDrawnThisTurn = false;
}

function drawEventCard() {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (!gameState.eventDeck || gameState.eventDeck.length === 0 || gameState.eventDrawnThisTurn) return;
    const card = gameState.eventDeck.pop();
    gameState.eventDrawnThisTurn = true;
    if (currentPlayer.powers.hasImmunity) {
        gameState.lastEvent = { ...card, drawnBy: currentPlayer.name, text: card.text.replace('{casino}', 'a casino') + " But you were IMMUNE!" };
        currentPlayer.powers.hasImmunity = false; return;
    }
    applyEventEffect(card, currentPlayer);
}

function applyEventEffect(card, drawer) {
    const activeCasinos = gameState.casinos.filter(c => !c.isClosed);
    let randomCasino = activeCasinos.length > 0 ? activeCasinos[Math.floor(Math.random() * activeCasinos.length)] : null;
    let eventText = card.text;
    if (card.text.includes('{casino}') && randomCasino) { eventText = card.text.replace('{casino}', `the ${randomCasino.name}`); }
    gameState.lastEvent = { ...card, text: eventText, drawnBy: drawer.name };
    switch (card.type) {
        case 'Market Up': gameState.casinos.forEach(c => { c.money = c.money.map(m => m + 10000); }); break;
        case 'Market Down': gameState.casinos.forEach(c => { c.money = c.money.map(m => Math.max(10000, m - 10000)); }); break;
        case 'Casino Acquired': if (randomCasino) { randomCasino.isClosed = true; for (const playerId in randomCasino.placedDice) { const player = gameState.players.find(p => p.id === playerId); if (player) player.dice += randomCasino.placedDice[playerId]; } randomCasino.placedDice = {}; } break;
        case 'Casino Renovated': if(randomCasino) randomCasino.money = randomCasino.money.map(m => m * 2); break;
        case 'Casino Auctioned': if(randomCasino) randomCasino.money = randomCasino.money.map(m => Math.floor(m / 2)); break;
        case 'Event Day!': if(randomCasino) randomCasino.money = randomCasino.money.map(m => m * 5); break;
        case 'Golden Die': drawer.powers.hasGoldenDie = true; break;
    }
}

io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);
    socket.on('joinLobby', (playerName) => { if (Object.keys(lobby.players).length === 0) { lobby.hostId = socket.id; } if (Object.keys(lobby.players).length < MAX_PLAYERS) { lobby.players[socket.id] = { id: socket.id, name: playerName, isReady: false }; io.emit('lobbyUpdate', getLobbyState()); } });
    socket.on('playerReady', () => { if (lobby.players[socket.id]) { lobby.players[socket.id].isReady = !lobby.players[socket.id].isReady; io.emit('lobbyUpdate', getLobbyState()); checkIfAllReady(); } });
    socket.on('modeSelected', (selectedMode) => { if (socket.id === lobby.hostId) { startGame(selectedMode); } });
    
    socket.on('rollDice', () => {
        if (!gameState.players) return;
        const currentPlayer = gameState.players[gameState.currentPlayerIndex];
        if (currentPlayer && currentPlayer.id === socket.id && gameState.currentRoll.length === 0) {
            if (gameMode === 'highStakes' && gameState.turnNumber > 0) { drawEventCard(); }
            gameState.turnNumber++;
            rollDiceForCurrentPlayer();
            io.emit('gameStateUpdate', { ...gameState, gameMode });
        }
    });

    socket.on('placeDice', (dieValue) => {
        if (!gameState.players) return;
        const currentPlayer = gameState.players[gameState.currentPlayerIndex];
        if (currentPlayer && currentPlayer.id === socket.id && gameState.currentRoll.length > 0 && !gameState.currentRoll.includes('G')) {
            placeDiceForCurrentPlayer(dieValue);
            nextTurn();
            io.emit('gameStateUpdate', { ...gameState, gameMode });
        }
    });

    socket.on('activatePower', (powerName) => {
        if (!gameState.players || gameMode !== 'highStakes') return;
        const currentPlayer = gameState.players[gameState.currentPlayerIndex];
        if (currentPlayer.id !== socket.id || gameState.currentRoll.length === 0) return;
        
        const numericRoll = gameState.currentRoll.filter(d => d !== 'G');
        const counts = numericRoll.reduce((acc, val) => ({ ...acc, [val]: (acc[val] || 0) + 1 }), {});
        const rollSum = numericRoll.reduce((a, b) => a + b, 0);

        let powerActivated = false;
        let endTurn = false;
        switch (powerName) {
            case 'director':
                if (counts[5] >= 3) {
                    currentPlayer.powers.hasImmunity = true;
                    gameState.lastEvent = { title: 'Director!', text: `${currentPlayer.name} rolled three 5s and gained Immunity!`, drawnBy: "Power" };
                    powerActivated = true;
                    endTurn = true;
                }
                break;
            case 'shiftBet':
                if (counts[1] >= 4) {
                    currentPlayer.powers.canShiftBet = true;
                    gameState.lastEvent = { title: 'Shift Bet!', text: `${currentPlayer.name} rolled four 1s and can shift a bet at the end of the round!`, drawnBy: "Power" };
                    powerActivated = true;
                    endTurn = true;
                }
                break;
            case 'buyCasino':
                if (rollSum >= 30) {
                    const availableCasinos = gameState.casinos.filter(c => !c.isClosed && c.money.length > 0);
                    socket.emit('showBuyCasinoModal', availableCasinos);
                    return; // Don't end turn yet, wait for player's choice
                }
                break;
            case 'diceHeist':
                if (counts[5] >= 4) {
                    let maxDice = -1, targetPlayer = null;
                    gameState.players.forEach(p => { if(p.id !== currentPlayer.id && p.dice > maxDice) { maxDice = p.dice; targetPlayer = p; } });
                    
                    if(targetPlayer) {
                        targetPlayer.dice -= 1;
                        currentPlayer.dice += 1;
                        gameState.lastEvent = { title: 'Dice Heist!', text: `${currentPlayer.name} rolled four 5s and stole a future die from ${targetPlayer.name}!`, drawnBy: "Power" };
                        powerActivated = true;
                        endTurn = true;
                    }
                }
                break;
        }
        if (powerActivated) {
            if (endTurn) {
                currentPlayer.dice -= gameState.currentRoll.length;
                gameState.currentRoll = [];
                nextTurn();
            }
            io.emit('gameStateUpdate', { ...gameState, gameMode });
        }
    });

    socket.on('buyCasino', (casinoId) => {
        if (!gameState.players) return;
        const currentPlayer = gameState.players[gameState.currentPlayerIndex];
        const casino = gameState.casinos.find(c => c.id === casinoId);
        if (currentPlayer.id === socket.id && casino && casino.money.length > 0) {
            const prize = casino.money.shift();
            currentPlayer.score += prize;
            gameState.lastEvent = { title: 'Casino Bought!', text: `${currentPlayer.name} bought out the ${casino.name} for $${prize/1000}k!`, drawnBy: "Power" };
            currentPlayer.dice -= gameState.currentRoll.length;
            gameState.currentRoll = [];
            nextTurn();
            io.emit('gameStateUpdate', { ...gameState, gameMode });
        }
    });

    socket.on('setGoldenDie', (value) => {
        if (!gameState.players) return;
        const player = gameState.players[gameState.currentPlayerIndex];
        if (player.id === socket.id) {
            const goldenDieIndex = gameState.currentRoll.findIndex(d => d === 'G');
            if (goldenDieIndex !== -1) {
                gameState.currentRoll[goldenDieIndex] = parseInt(value, 10);
            }
            io.emit('gameStateUpdate', { ...gameState, gameMode });
        }
    });

    socket.on('playAgain', () => { if (gameState.isGameOver) { Object.values(lobby.players).forEach(p => p.isReady = false); gameState = {}; io.emit('backToLobby'); io.emit('lobbyUpdate', getLobbyState()); } });
    socket.on('disconnect', () => { console.log('Player disconnected:', socket.id); const playerWasInGame = gameState.players && gameState.players.find(p => p.id === socket.id); delete lobby.players[socket.id]; if (playerWasInGame) { lobby = { players: {} }; gameState = {}; io.emit('gameReset'); } else { if (lobby.players && Object.keys(lobby.players).length > 0) { lobby.hostId = Object.keys(lobby.players)[0]; } else { lobby.hostId = null; } io.emit('lobbyUpdate', getLobbyState()); } });
});

server.listen(PORT, () => {
    console.log(`Server is running! Open http://localhost:${PORT}`);
});