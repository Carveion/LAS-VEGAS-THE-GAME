document.addEventListener('DOMContentLoaded', () => {
    const socket = io();
    const lobbyContainer = document.getElementById('lobby');
    const modeSelectionContainer = document.getElementById('mode-selection');
    const gameContainer = document.getElementById('game-container');
    const joinForm = document.getElementById('join-form');
    const lobbyInfo = document.getElementById('lobby-info');
    const playerNameInput = document.getElementById('player-name-input');
    const joinGameButton = document.getElementById('join-game-button');
    const lobbyPlayersList = document.getElementById('lobby-players');
    const readyButton = document.getElementById('ready-button');
    const rollButton = document.getElementById('roll-button');
    const rollButtonText = document.getElementById('roll-button-text');
    const playAgainButton = document.getElementById('play-again-button');
    const playerDiceContainer = document.getElementById('dice-container');
    const scoreboardContainer = document.getElementById('scoreboard');
    const turnPrompt = document.getElementById('turn-prompt');
    const highStakesUI = document.getElementById('high-stakes-ui');
    const eventCardTitle = document.getElementById('event-card-title');
    const eventCardText = document.getElementById('event-card-text');
    const powerShop = document.getElementById('power-shop');
    const activePowersList = document.getElementById('active-powers-list');
    const goldenDieModal = document.getElementById('golden-die-modal');
    const buyCasinoModal = document.getElementById('buy-casino-modal');
    const casinoChooser = document.getElementById('casino-chooser');
    
    let myPlayerId = null;

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

    socket.on('showModeSelection', (hostId) => {
        lobbyContainer.style.display = 'none';
        modeSelectionContainer.style.display = 'block';
        const isHost = myPlayerId === hostId;
        document.querySelectorAll('.mode-button').forEach(button => {
            button.disabled = !isHost;
            if(!isHost) { button.style.cursor = 'not-allowed'; button.style.opacity = 0.7; }
        });
        if (!isHost) { modeSelectionContainer.querySelector('h2').textContent = "Waiting for the host to choose a game mode..."; }
    });

    document.querySelectorAll('.mode-button').forEach(button => {
        button.addEventListener('click', () => {
            const selectedMode = button.dataset.mode;
            socket.emit('modeSelected', selectedMode);
        });
    });
    
    socket.on('gameStarted', () => {
        modeSelectionContainer.style.display = 'none';
        gameContainer.style.display = 'flex';
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
    
    powerShop.addEventListener('click', (e) => {
        const button = e.target.closest('.power-button');
        if (button && !button.disabled) {
            socket.emit('activatePower', button.dataset.power);
        }
    });

    goldenDieModal.addEventListener('click', (e) => {
        const button = e.target.closest('button');
        if (button && button.dataset.value) {
            socket.emit('setGoldenDie', button.dataset.value);
            goldenDieModal.style.display = 'none';
        }
    });

    buyCasinoModal.addEventListener('click', (e) => {
        const button = e.target.closest('button');
        if (button && button.dataset.casinoId) {
            socket.emit('buyCasino', parseInt(button.dataset.casinoId));
            buyCasinoModal.style.display = 'none';
        }
    });

    playAgainButton.addEventListener('click', () => { socket.emit('playAgain'); });
    socket.on('roundOver', (roundNumber) => { alert(`Round ${roundNumber} is over!`); });
    socket.on('gameOver', (winner) => { alert(`GAME OVER!\nWinner: ${winner.name} with $${winner.score.toLocaleString()}!`); });

    socket.on('backToLobby', () => {
        gameContainer.style.display = 'none';
        lobbyContainer.style.display = 'block';
        modeSelectionContainer.style.display = 'none';
    });

    socket.on('gameReset', () => {
        alert("A player disconnected. The game has been reset.");
        window.location.reload();
    });

    socket.on('showBuyCasinoModal', (casinos) => {
        casinoChooser.innerHTML = '';
        casinos.forEach(casino => {
            const button = document.createElement('button');
            button.dataset.casinoId = casino.id;
            button.textContent = `${casino.name} ($${casino.money[0]/1000}k)`;
            casinoChooser.appendChild(button);
        });
        buyCasinoModal.style.display = 'grid';
    });

    function updateGameUI(gameState) {
        if (!myPlayerId) return;
        highStakesUI.style.display = gameState.gameMode === 'highStakes' ? 'block' : 'none';
        if (gameState.gameMode === 'highStakes') { updateHighStakesInfo(gameState); }
        playAgainButton.style.display = gameState.isGameOver ? 'inline-block' : 'none';
        rollButton.style.display = gameState.isGameOver ? 'none' : 'inline-flex';
        const me = gameState.players.find(p => p.id === myPlayerId);
        const currentPlayer = gameState.players[gameState.currentPlayerIndex];
        const isMyTurn = me && currentPlayer && me.id === currentPlayer.id;
        turnPrompt.textContent = isMyTurn && !gameState.roundOver && !gameState.isGameOver ? "It's Your Turn!" : "";
        scoreboardContainer.innerHTML = '';
        gameState.players.forEach((player, index) => {
            const scoreDiv = document.createElement('div');
            scoreDiv.className = 'player-score';
            if (index === gameState.currentPlayerIndex && !gameState.isGameOver && !gameState.roundOver) { scoreDiv.style.border = `3px solid #fff`; }
            scoreDiv.innerHTML = `<div class="name">${player.id === myPlayerId ? 'You' : player.name} (${player.dice} dice)</div><div class="score">$${player.score.toLocaleString()}</div>`;
            scoreDiv.style.backgroundColor = player.color;
            scoreboardContainer.appendChild(scoreDiv);
        });
        gameState.casinos.forEach(casino => {
            const casinoEl = document.getElementById(`casino-${casino.id}`);
            casinoEl.style.opacity = casino.isClosed ? 0.5 : 1;
            casinoEl.querySelector('.money-cards').innerHTML = casino.money.map(amount => `<div class="money-card">$${amount/1000}k</div>`).join('');
            const placedDiceContainer = casinoEl.querySelector('.placed-dice');
            placedDiceContainer.innerHTML = '';
            for (const [playerId, count] of Object.entries(casino.placedDice)) {
                const player = gameState.players.find(p => p.id === playerId);
                if (player) { for (let i = 0; i < count; i++) { const dieElement = createDieVisual(casino.id, player.color); placedDiceContainer.appendChild(dieElement); } }
            }
        });
        playerDiceContainer.innerHTML = '';
        if (isMyTurn && gameState.currentRoll.length > 0) {
            const numericRoll = gameState.currentRoll.filter(d => d !== 'G');
            const groupedDice = numericRoll.reduce((acc, val) => ({ ...acc, [val]: (acc[val] || 0) + 1 }), {});
            for (const [value, count] of Object.entries(groupedDice)) {
                const groupContainer = document.createElement('div');
                groupContainer.className = 'dice-group';
                groupContainer.dataset.value = value;
                for (let i = 0; i < count; i++) { groupContainer.appendChild(createDieVisual(parseInt(value))); }
                playerDiceContainer.appendChild(groupContainer);
            }
            if (gameState.currentRoll.includes('G')) {
                const goldenDieElement = document.createElement('div');
                goldenDieElement.className = 'dice-group';
                goldenDieElement.innerHTML = `<div class="die-visual" style="background: gold; color: black; font-weight: bold; align-items: center; justify-content: center; font-size: 2em;">?</div>`;
                playerDiceContainer.appendChild(goldenDieElement);
            }
        }
        rollButton.disabled = !isMyTurn || gameState.currentRoll.length > 0 || gameState.roundOver || gameState.currentRoll.includes('G');
        rollButtonText.textContent = gameState.currentRoll.length > 0 ? "Place Your Dice" : "Roll Dice";
    }

    function updateHighStakesInfo(gameState) {
        const me = gameState.players.find(p => p.id === myPlayerId);
        const isMyTurn = gameState.players[gameState.currentPlayerIndex]?.id === myPlayerId;
        if (gameState.lastEvent) {
            eventCardTitle.textContent = gameState.lastEvent.title;
            eventCardText.textContent = `${gameState.lastEvent.text} (Drawn by ${gameState.lastEvent.drawnBy})`;
        } else {
            eventCardTitle.textContent = 'Event';
            eventCardText.textContent = 'Waiting for the first turn...';
        }
        activePowersList.innerHTML = '';
        if (me && me.powers.hasImmunity) {
            activePowersList.innerHTML += `<div class="active-power-item">Immunity Active</div>`;
        }
        if (me && me.powers.canShiftBet) {
            activePowersList.innerHTML += `<div class="active-power-item">Shift Bet Unlocked</div>`;
        }
        
        const numericRoll = gameState.currentRoll.filter(d => d !== 'G');
        const counts = numericRoll.reduce((acc, val) => ({ ...acc, [val]: (acc[val] || 0) + 1 }), {});
        const rollSum = numericRoll.reduce((a, b) => a + b, 0);

        powerShop.querySelectorAll('.power-button').forEach(button => {
            const power = button.dataset.power;
            let canActivate = false;
            if (isMyTurn && gameState.currentRoll.length > 0 && !gameState.currentRoll.includes('G')) {
                if (power === 'buyCasino' && rollSum >= 30) canActivate = true;
                if (power === 'diceHeist' && counts[5] >= 4 && gameState.turnNumber > gameState.players.length) canActivate = true;
                if (power === 'director' && counts[5] >= 3) canActivate = true;
                if (power === 'shiftBet' && counts[1] >= 4) canActivate = true;
            }
            button.disabled = !canActivate;
        });

        goldenDieModal.style.display = isMyTurn && gameState.currentRoll.includes('G') ? 'grid' : 'none';
    }

    function createDieVisual(value, color) {
        const die = document.createElement('div');
        die.className = `die-visual face-${value}`;
        if(color) { die.style.backgroundColor = color; }
        for (let i = 0; i < value; i++) { die.innerHTML += '<div class="dot"></div>'; }
        return die;
    }
});