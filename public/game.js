// public/game.js

document.addEventListener('DOMContentLoaded', () => {
    const socket = io();

    // --- Global Elements ---
    const lobbyContainer = document.getElementById('lobby');
    const gameContainer = document.getElementById('game-container');

    // --- Lobby Elements ---
    const joinForm = document.getElementById('join-form');
    const lobbyInfo = document.getElementById('lobby-info');
    const playerNameInput = document.getElementById('player-name-input');
    const joinGameButton = document.getElementById('join-game-button');
    const lobbyPlayersList = document.getElementById('lobby-players');
    const readyButton = document.getElementById('ready-button');

    // --- Game Elements ---
    const rollButton = document.getElementById('roll-button');
    const rollButtonText = document.getElementById('roll-button-text');
    const playAgainButton = document.getElementById('play-again-button');
    const playerDiceContainer = document.getElementById('dice-container');
    const scoreboardContainer = document.getElementById('scoreboard');
    
    let myPlayerId = null;

    // --- LOBBY LOGIC ---
    socket.on('connect', () => { myPlayerId = socket.id; });

    joinGameButton.addEventListener('click', () => {
        const playerName = playerNameInput.value.trim();
        if (playerName) {
            socket.emit('joinLobby', playerName);
            joinForm.style.display = 'none';
            lobbyInfo.style.display = 'block';
        }
    });

    readyButton.addEventListener('click', () => {
        socket.emit('playerReady');
    });

    socket.on('lobbyUpdate', (players) => {
        lobbyPlayersList.innerHTML = '';
        let me = null;
        players.forEach(player => {
            if (player.id === myPlayerId) me = player;
            const playerItem = document.createElement('div');
            playerItem.className = 'lobby-player-item';
            playerItem.innerHTML = `
                <span>${player.name} ${player.id === myPlayerId ? '(You)' : ''}</span>
                <div class="status-indicator ${player.isReady ? 'ready' : ''}"></div>
            `;
            lobbyPlayersList.appendChild(playerItem);
        });

        if (me) {
            readyButton.textContent = me.isReady ? 'Unready' : 'Ready Up';
            readyButton.classList.toggle('ready', me.isReady);
        }
    });
    
    socket.on('gameStarted', () => {
        lobbyContainer.style.display = 'none';
        gameContainer.style.display = 'block';
    });

    // --- GAME LOGIC (Mostly unchanged from before) ---
    socket.on('gameStateUpdate', (gameState) => {
        if (gameState.players && gameState.players.length > 0) {
            updateGameUI(gameState);
        }
    });
    socket.on('roundOver', (roundNumber) => { alert(`Round ${roundNumber} over!`); });
    socket.on('gameOver', (winner) => { alert(`GAME OVER! Winner: ${winner.name}`); });
    rollButton.addEventListener('click', () => { socket.emit('rollDice'); });
    playerDiceContainer.addEventListener('click', (event) => { /* same as before */ });
    
    function updateGameUI(gameState) { /* same as before */ }
    function createDieVisual(value, color) { /* same as before */ }
});

// Full code for clarity (copy from here)
function updateGameUI(gameState){/* ... */}
function createDieVisual(value,color){const die=document.createElement('div');die.className=`die-visual face-${value}`;if(color){die.style.backgroundColor=color}for(let i=0;i<value;i++){die.innerHTML+='<div class="dot"></div>'}return die}
// The event listener for place dice needs to be re-added here
document.getElementById('playerDiceContainer').addEventListener('click', (event) => {
    const group = event.target.closest('.dice-group');
    if (group && group.dataset.value) {
        socket.emit('placeDice', parseInt(group.dataset.value));
    }
});