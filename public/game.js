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

    // --- SERVER COMMUNICATION & EVENT LISTENERS ---
    socket.on('connect', () => { myPlayerId = socket.id; });

    joinGameButton.addEventListener('click', () => {
        const playerName = playerNameInput.value.trim();
        if (playerName) {
            socket.emit('joinLobby', playerName);
            joinForm.style.display = 'none';
            lobbyInfo.style.display = 'block';
        }
    });

    readyButton.addEventListener('click', () => { socket.emit('playerReady'); });

    socket.on('lobbyUpdate', (players) => {
        lobbyPlayersList.innerHTML = '';
        let me = null;
        players.forEach(player => {
            if (player.id === myPlayerId) me = player;
            const playerItem = document.createElement('div');
            playerItem.className = 'lobby-player-item';
            playerItem.innerHTML = `<span>${player.name} ${player.id === myPlayerId ? '(You)' : ''}</span><div class="status-indicator ${player.isReady ? 'ready' : ''}"></div>`;
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

    socket.on('gameStateUpdate', (gameState) => {
        if (gameState && gameState.players && gameState.players.length > 0) {
            updateGameUI(gameState);
        }
    });

    rollButton.addEventListener('click', () => { socket.emit('rollDice'); });

    playerDiceContainer.addEventListener('click', (event) => {
        const group = event.target.closest('.dice-group');
        if (group && group.dataset.value) {
            socket.emit('placeDice', parseInt(group.dataset.value));
        }
    });

    playAgainButton.addEventListener('click', () => { socket.emit('playAgain'); });

    socket.on('roundOver', (roundNumber) => { alert(`Round ${roundNumber} is over!`); });
    socket.on('gameOver', (winner) => { alert(`GAME OVER!\nWinner: ${winner.name} with $${winner.score.toLocaleString()}!`); });

    socket.on('backToLobby', () => {
        gameContainer.style.display = 'none';
        lobbyContainer.style.display = 'block';
    });

    socket.on('gameReset', () => {
        alert("A player disconnected. The game has been reset.");
        gameContainer.style.display = 'none';
        lobbyContainer.style.display = 'block';
        joinForm.style.display = 'block';
        lobbyInfo.style.display = 'none';
        lobbyPlayersList.innerHTML = '';
    });

    // --- UI RENDERER ---
    function updateGameUI(gameState) {
        if (!myPlayerId) return; // Don't render if we don't know who we are yet

        playAgainButton.style.display = gameState.isGameOver ? 'inline-block' : 'none';
        rollButton.style.display = gameState.isGameOver ? 'none' : 'inline-flex';

        const me = gameState.players.find(p => p.id === myPlayerId);
        const currentPlayer = gameState.players[gameState.currentPlayerIndex];
        const isMyTurn = me && currentPlayer && me.id === currentPlayer.id;
        
        // Update Scoreboard
        scoreboardContainer.innerHTML = '';
        gameState.players.forEach((player, index) => {
            const scoreDiv = document.createElement('div');
            scoreDiv.className = 'player-score';
            if (index === gameState.currentPlayerIndex && !gameState.isGameOver && !gameState.roundOver) {
                scoreDiv.style.border = `3px solid #fff`;
            }
            scoreDiv.innerHTML = `<div class="name">${player.id === myPlayerId ? 'You' : player.name} (${player.dice} dice)</div><div class="score">$${player.score.toLocaleString()}</div>`;
            scoreDiv.style.backgroundColor = player.color;
            scoreboardContainer.appendChild(scoreDiv);
        });

        // Update Casinos
        gameState.casinos.forEach(casino => {
            const casinoEl = document.getElementById(`casino-${casino.id}`);
            casinoEl.querySelector('.money-cards').innerHTML = casino.money.map(amount => `<div class="money-card">$${amount/1000}k</div>`).join('');
            const placedDiceContainer = casinoEl.querySelector('.placed-dice');
            placedDiceContainer.innerHTML = '';
            for (const [playerId, count] of Object.entries(casino.placedDice)) {
                const player = gameState.players.find(p => p.id === playerId);
                if (player) {
                    for (let i = 0; i < count; i++) {
                        const dieElement = createDieVisual(casino.id, player.color);
                        placedDiceContainer.appendChild(dieElement);
                    }
                }
            }
        });

        // Player's dice area and button
        playerDiceContainer.innerHTML = '';
        if (isMyTurn && gameState.currentRoll.length > 0) {
            const groupedDice = gameState.currentRoll.reduce((acc, val) => ({ ...acc, [val]: (acc[val] || 0) + 1 }), {});
            for (const [value, count] of Object.entries(groupedDice)) {
                const groupContainer = document.createElement('div');
                groupContainer.className = 'dice-group';
                groupContainer.dataset.value = value;
                for (let i = 0; i < count; i++) {
                    groupContainer.appendChild(createDieVisual(parseInt(value)));
                }
                playerDiceContainer.appendChild(groupContainer);
            }
        }
        
        rollButton.disabled = !isMyTurn || gameState.currentRoll.length > 0 || gameState.roundOver;
        rollButtonText.textContent = gameState.currentRoll.length > 0 ? "Place Your Dice" : "Roll Dice";
    }
    
    function createDieVisual(value, color) {
        const die = document.createElement('div');
        die.className = `die-visual face-${value}`;
        if(color) { die.style.backgroundColor = color; }
        for (let i = 0; i < value; i++) { die.innerHTML += '<div class="dot"></div>'; }
        return die;
    }
});