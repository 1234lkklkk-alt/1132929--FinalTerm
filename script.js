class GoGame {
    constructor(size = 9) {
        this.size = size;
        this.board = [];
        this.currentTurn = 1; // 1 = 黑, 2 = 白
        this.captures = { black: 0, white: 0 };
        this.history = [];
        this.lastMove = null;
        this.isAiMode = true;
        this.isGameOver = false;
        this.passCount = 0;
        this.stepCount = 0;
        this.gridCreated = false;

        this.initBoard();
    }

    initBoard() {
        this.board = Array.from({ length: this.size }, () => Array(this.size).fill(0));
        this.currentTurn = 1;
        this.captures = { black: 0, white: 0 };
        this.history = [];
        this.lastMove = null;
        this.isGameOver = false;
        this.passCount = 0;
        this.stepCount = 0;

        if (!this.gridCreated) {
            this.createGridDOM();
            this.gridCreated = true;
        }

        // 清空碗裡的視覺堆疊
        document.getElementById('pile-white').innerHTML = '';
        document.getElementById('pile-black').innerHTML = '';

        this.render();
        this.updateUI();
        this.closeModal();
    }

    createGridDOM() {
        const boardEl = document.getElementById('board');
        if (!boardEl) return;
        boardEl.innerHTML = '';
        for (let y = 0; y < this.size; y++) {
            for (let x = 0; x < this.size; x++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.id = `cell-${x}-${y}`;
                cell.onclick = () => this.play(x, y);
                cell.onmouseenter = () => this.handleHover(x, y, cell);
                cell.onmouseleave = () => this.handleMouseLeave(cell);
                if ((x === 4 && y === 4) || (x === 2 && y === 2) || (x === 6 && y === 2) || (x === 2 && y === 6) || (x === 6 && y === 6)) {
                    cell.classList.add('star-point');
                }
                boardEl.appendChild(cell);
            }
        }
    }

    pass(isAuto = false) {
        if (this.isGameOver) return;
        this.saveState();
        this.passCount++;
        if (this.passCount >= 2) {
            this.endGame("雙方虛手，遊戲結束");
            return;
        }
        this.switchTurn();
    }

    play(x, y) {
        if (this.isGameOver) return;
        if (this.stepCount >= 200) { this.endGame("回合數過多"); return; }

        const check = this.checkMoveRule(x, y, this.currentTurn);
        if (!check.valid) return;

        this.saveState();
        this.board[y][x] = this.currentTurn;
        this.passCount = 0;
        this.stepCount++;
        this.lastMove = { x, y };
        this.render();

        const opponent = this.currentTurn === 1 ? 2 : 1;
        const deadStones = this.findDeadStones(opponent);

        if (deadStones.length > 0) {
            // 執行動畫，並傳入一個回調函數 (callback)，在動畫結束後執行
            this.animateCapture(deadStones, opponent, () => {
                // --- 以下邏輯在動畫結束後才執行 ---
                this.removeStonesData(deadStones);

                // 更新提子數據
                if (this.currentTurn === 1) this.captures.black += deadStones.length;
                else this.captures.white += deadStones.length;

                this.render();
                this.updateUI(); // 更新碗上的數字

                if (deadStones.length >= 15) {
                    const winner = this.currentTurn === 1 ? "黑棋" : "白棋";
                    setTimeout(() => {
                        this.endGame(`大屠殺! ${winner} 一口氣吃了 ${deadStones.length} 子!`);
                    }, 500);
                    return;
                }
                this.switchTurn();
            });
        } else {
            this.switchTurn();
        }
    }

    // --- 吃子動畫與堆疊視覺 ---
    animateCapture(stones, stoneColor, onComplete) {
        // 左碗(bowl-white)裝黑子(1)，右碗(bowl-black)裝白子(2)
        const targetId = stoneColor === 1 ? 'bowl-white' : 'bowl-black';
        const pileId = stoneColor === 1 ? 'pile-white' : 'pile-black';
        const targetEl = document.getElementById(targetId);
        if (!targetEl) { if (onComplete) onComplete(); return; }

        const targetRect = targetEl.getBoundingClientRect();
        const targetX = targetRect.left + targetRect.width / 2;
        const targetY = targetRect.top + targetRect.height / 2;

        let completedAnimations = 0;

        stones.forEach(stone => {
            const cellId = `cell-${stone.x}-${stone.y}`;
            const cellEl = document.getElementById(cellId);
            if (!cellEl) return;
            const stoneRect = cellEl.getBoundingClientRect();

            const flyer = document.createElement('div');
            flyer.className = `flying-stone ${stoneColor === 1 ? 'black' : 'white'}`;
            flyer.style.background = stoneColor === 1 ? '#2d3436' : '#fff';
            flyer.style.left = `${stoneRect.left}px`;
            flyer.style.top = `${stoneRect.top}px`;
            document.getElementById('animation-layer').appendChild(flyer);

            flyer.getBoundingClientRect(); // trigger reflow

            flyer.style.left = `${targetX - 15}px`;
            flyer.style.top = `${targetY - 15}px`;
            flyer.style.transform = 'scale(0.4)';

            setTimeout(() => {
                flyer.remove();
                // 動畫結束，在碗裡增加一個靜態棋子
                this.addStoneToBowlPile(pileId, stoneColor);

                completedAnimations++;
                // 當所有棋子都飛完了，執行回調更新數據
                if (completedAnimations === stones.length) {
                    if (onComplete) onComplete();
                }
            }, 600);
        });
    }

    // --- 新增：在碗裡堆疊棋子 ---
    addStoneToBowlPile(pileId, stoneColor) {
        const pile = document.getElementById(pileId);
        if (!pile) return;
        const stone = document.createElement('div');
        stone.className = `captured-stone-in-bowl ${stoneColor === 1 ? 'black' : 'white'}`;
        // 隨機旋轉角度，讓堆疊看起來更自然
        const randomRot = Math.floor(Math.random() * 360);
        stone.style.setProperty('--random-rotate', `${randomRot}deg`);
        pile.appendChild(stone);
    }

    switchTurn() {
        this.currentTurn = this.currentTurn === 1 ? 2 : 1;
        this.updateUI();
        const hasMoves = this.checkAnyValidMove(this.currentTurn);
        if (!hasMoves) {
            setTimeout(() => this.pass(true), 300);
            return;
        }
        // 增加一點 AI 延遲，配合動畫節奏
        if (this.isAiMode && this.currentTurn === 2) {
            setTimeout(() => this.aiMove(), 800);
        }
    }

    isValidXY(x, y) { return x >= 0 && x < this.size && y >= 0 && y < this.size; }

    checkMoveRule(x, y, color) {
        if (!this.isValidXY(x, y)) return { valid: false };
        if (this.board[y][x] !== 0) return { valid: false };
        const simBoard = JSON.parse(JSON.stringify(this.board));
        simBoard[y][x] = color;
        const opponent = color === 1 ? 2 : 1;
        const captured = this.simulateCaptures(simBoard, opponent);
        if (captured === 0) {
            const libs = this.getLibertiesOnBoard(simBoard, x, y, color);
            if (libs === 0) return { valid: false };
        }
        if (captured === 0 && this.isSimpleEye(x, y, color)) {
            return { valid: false };
        }
        return { valid: true };
    }

    isSimpleEye(x, y, color) {
        const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
        for (let [dx, dy] of dirs) {
            const nx = x + dx, ny = y + dy;
            if (this.isValidXY(nx, ny)) {
                const neighbor = this.board[ny][nx];
                if (neighbor === 0 || neighbor !== color) return false;
            }
        }
        return true;
    }

    checkAnyValidMove(color) {
        for (let y = 0; y < this.size; y++) {
            for (let x = 0; x < this.size; x++) {
                if (this.checkMoveRule(x, y, color).valid) return true;
            }
        }
        return false;
    }

    endGame(reason) {
        this.isGameOver = true;
        let blackCount = 0, whiteCount = 0;
        for (let y = 0; y < this.size; y++) {
            for (let x = 0; x < this.size; x++) {
                if (this.board[y][x] === 1) blackCount++;
                else if (this.board[y][x] === 2) whiteCount++;
            }
        }
        const komi = 3.75;
        const whiteTotal = whiteCount + komi;
        let winnerText = blackCount > whiteTotal ? "黑棋獲勝!" : "白棋獲勝!";

        document.getElementById('final-score-black').innerText = `黑方盤面: ${blackCount}`;
        document.getElementById('final-score-white').innerText = `白方盤面: ${whiteCount} + ${komi}(貼)`;
        document.getElementById('final-winner').innerHTML = `${winnerText}<br><small>(${reason})</small>`;
        document.getElementById('endGameModal').classList.add('show');
        this.updateUI();
    }
    closeModal() { document.getElementById('endGameModal').classList.remove('show'); }

    aiMove() {
        if (this.isGameOver) return;
        let bestMoves = [], safeMoves = [];
        for (let y = 0; y < this.size; y++) {
            for (let x = 0; x < this.size; x++) {
                const check = this.checkMoveRule(x, y, 2);
                if (check.valid) {
                    if (check.capturedCount > 0) bestMoves.push({ x, y });
                    else safeMoves.push({ x, y });
                }
            }
        }
        if (bestMoves.length > 0) {
            const m = bestMoves[Math.floor(Math.random() * bestMoves.length)];
            this.play(m.x, m.y);
        } else if (safeMoves.length > 0) {
            const m = safeMoves[Math.floor(Math.random() * safeMoves.length)];
            this.play(m.x, m.y);
        } else {
            this.pass(true);
        }
    }

    findDeadStones(colorCheck) {
        const visited = Array.from({ length: this.size }, () => Array(this.size).fill(false));
        const deadStones = [];
        for (let y = 0; y < this.size; y++) {
            for (let x = 0; x < this.size; x++) {
                if (this.board[y][x] === colorCheck && !visited[y][x]) {
                    const group = this.getGroupOnBoard(this.board, x, y, colorCheck);
                    group.stones.forEach(s => visited[s.y][s.x] = true);
                    if (group.liberties === 0) deadStones.push(...group.stones);
                }
            }
        }
        return deadStones;
    }
    removeStonesData(stones) { stones.forEach(s => { this.board[s.y][s.x] = 0; }); }
    simulateCaptures(board, colorCheck) {
        let count = 0;
        const visited = Array.from({ length: this.size }, () => Array(this.size).fill(false));
        for (let y = 0; y < this.size; y++) {
            for (let x = 0; x < this.size; x++) {
                if (board[y][x] === colorCheck && !visited[y][x]) {
                    const group = this.getGroupOnBoard(board, x, y, colorCheck);
                    group.stones.forEach(s => visited[s.y][s.x] = true);
                    if (group.liberties === 0) count += group.stones.length;
                }
            }
        }
        return count;
    }
    getLibertiesOnBoard(board, x, y, color) { return this.getGroupOnBoard(board, x, y, color).liberties; }
    getGroupOnBoard(board, startX, startY, color) {
        const stack = [{ x: startX, y: startY }];
        const stones = [];
        const libs = new Set();
        const visited = new Set();
        visited.add(`${startX},${startY}`);
        while (stack.length > 0) {
            const { x, y } = stack.pop();
            stones.push({ x, y });
            const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
            for (let [dx, dy] of dirs) {
                const nx = x + dx, ny = y + dy;
                if (this.isValidXY(nx, ny)) {
                    const val = board[ny][nx];
                    const key = `${nx},${ny}`;
                    if (val === 0) libs.add(key);
                    else if (val === color && !visited.has(key)) {
                        visited.add(key);
                        stack.push({ x: nx, y: ny });
                    }
                }
            }
        }
        return { stones, liberties: libs.size };
    }

    updateUI() {
        const tText = this.currentTurn === 1 ? "黑棋回合" : "白棋回合";
        const el = document.getElementById('turn-indicator');
        if (el) {
            el.innerText = this.isGameOver ? "遊戲結束" : tText;
            el.style.backgroundColor = this.currentTurn === 1 ? '#000' : '#fff';
            el.style.color = this.currentTurn === 1 ? '#fff' : '#000';
        }
        document.getElementById('score-black-display').innerText = this.captures.white;
        document.getElementById('score-white-display').innerText = this.captures.black;
        const hInfo = document.getElementById('handicap-info');
        if (hInfo) hInfo.innerText = `步數: ${this.stepCount}`;
        const btnAi = document.getElementById('btn-ai');
        btnAi.innerText = this.isAiMode ? "AI: 開啟" : "AI: 關閉";
    }

    handleHover(x, y, cell) {
        if (this.board[y][x] !== 0 || this.isGameOver) return;
        if (this.isAiMode && this.currentTurn === 2) return;
        this.clearHover(cell);
        const check = this.checkMoveRule(x, y, this.currentTurn);
        const dot = document.createElement('div');
        dot.className = 'preview-dot';
        if (check.valid) dot.classList.add('preview-valid');
        else dot.classList.add('preview-invalid');
        cell.appendChild(dot);
    }
    handleMouseLeave(cell) { this.clearHover(cell); }
    clearHover(cell) {
        const dots = cell.getElementsByClassName('preview-dot');
        while (dots.length > 0) dots[0].remove();
    }

    render() {
        for (let y = 0; y < this.size; y++) {
            for (let x = 0; x < this.size; x++) {
                const cell = document.getElementById(`cell-${x}-${y}`);
                if (!cell) continue;
                cell.innerHTML = '';
                const stoneState = this.board[y][x];
                if (stoneState === 1) {
                    const s = document.createElement('div'); s.className = 'stone black'; cell.appendChild(s);
                } else if (stoneState === 2) {
                    const s = document.createElement('div'); s.className = 'stone white'; cell.appendChild(s);
                }
                if (this.lastMove && this.lastMove.x === x && this.lastMove.y === y && stoneState !== 0) {
                    const m = document.createElement('div'); m.className = 'last-move-marker'; cell.appendChild(m);
                }
            }
        }
    }

    saveState() {
        this.history.push({
            board: JSON.parse(JSON.stringify(this.board)),
            turn: this.currentTurn,
            captures: { ...this.captures },
            lastMove: this.lastMove,
            passCount: this.passCount,
            stepCount: this.stepCount,
            // 需要保存碗裡的狀態，這裡簡化處理，悔棋時清空碗
        });
    }
    undo() {
        if (this.history.length === 0) return;
        const state = this.history.pop();
        this.board = state.board;
        this.currentTurn = state.turn;
        this.captures = state.captures;
        this.lastMove = state.lastMove;
        this.passCount = state.passCount || 0;
        this.stepCount = state.stepCount || 0;
        this.isGameOver = false;

        // 悔棋時簡單清空碗裡的視覺堆疊 (要完美還原需要更複雜的狀態紀錄)
        document.getElementById('pile-white').innerHTML = '';
        document.getElementById('pile-black').innerHTML = '';
        // 根據回復的分數重新填滿碗 (簡化版)
        for (let i = 0; i < this.captures.black; i++) this.addStoneToBowlPile('pile-white', 1);
        for (let i = 0; i < this.captures.white; i++) this.addStoneToBowlPile('pile-black', 2);

        this.render();
        this.updateUI();
        this.closeModal();
    }
    reset() { if (confirm("確定重置遊戲?")) this.initBoard(); }
}
const game = new GoGame(9);
function toggleAI() {
    game.isAiMode = !game.isAiMode;
    game.updateUI();
    if (game.isAiMode && game.currentTurn === 2) game.aiMove();
}