// public/game.js

document.addEventListener('DOMContentLoaded', () => {
    const socket = io();

    // --- 1. HTML ELEMENTS ---
    const rollButton = document.getElementById('roll-button');
    const rollButtonText = document.getElementById('roll-button-text');
    const playAgainButton = document.getElementById('play-again-button');
    const playerDiceContainer = document.getElementById('dice-container');
    const scoreboardContainer = document.getElementById('scoreboard');
    
    // --- 2. CLIENT STATE ---
    let myPlayerId = null;

    // --- 3. SERVER COMMUNICATION ---
    socket.on('connect', () => { myPlayerId = socket.id; });

    socket.on('gameStateUpdate', (newState) => {
        updateUI(newState);
    });
    
    socket.on('roundOver', (roundNumber) => {
        alert(`Round ${roundNumber} is over! Final scores for this round are on the board.`);
    });
    
    socket.on('gameOver', (winner) => {
        alert(`GAME OVER!\nWinner: ${winner.name} with $${winner.score.toLocaleString()}!`);
    });

    // --- 4. EVENT LISTENERS ---
    rollButton.addEventListener('click', () => { socket.emit('rollDice'); });
    playAgainButton.addEventListener('click', () => { socket.emit('playAgain'); });

    playerDiceContainer.addEventListener('click', (event) => {
        const group = event.target.closest('.dice-group');
        if (group && group.dataset.value) {
            socket.emit('placeDice', parseInt(group.dataset.value));
        }
    });

    // --- 5. UI RENDERER ---
    function updateUI(gameState) {
        if (!gameState.players || gameState.players.length === 0) {
            scoreboardContainer.innerHTML = '<h2>Waiting for players...</h2>';
            playerDiceContainer.innerHTML = '';
            rollButton.style.display = 'none';
            playAgainButton.style.display = 'none';
            return;
        }

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