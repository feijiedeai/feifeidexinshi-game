class VNEngine {
    constructor() {
        this.bg = document.getElementById('bg');
        this.charLayer = document.getElementById('charLayer');
        this.textBox = document.getElementById('textBox');
        this.speakerEl = document.getElementById('speaker');
        this.dialogEl = document.getElementById('dialog');
        this.hintEl = document.getElementById('hint');
        this.choiceBox = document.getElementById('choiceBox');
        this.chapterTitle = document.getElementById('chapterTitle');
        this.itemPopup = document.getElementById('itemPopup');
        this.overlay = document.getElementById('overlay');
        this.minigameDiv = document.getElementById('minigame');
        this.mgCanvas = document.getElementById('mgCanvas');
        this.mgCtx = this.mgCanvas.getContext('2d');

        this.settingsPanel = document.getElementById('settingsPanel');
        this.bagList = document.getElementById('bagList');
        this.saveSlots = document.getElementById('saveSlots');
        this.starCanvas = document.getElementById('starCanvas');
        this.starCtx = this.starCanvas.getContext('2d');
        this.floatTextDiv = document.getElementById('floatText');

        this.isTyping = false;
        this.typeTimer = null;
        this.canAdvance = false;
        this.currentScript = [];
        this.scriptIndex = 0;
        this.items = [];
        this.flags = {};
        this.charRequestId = 0;
        this.charGen = 0;

        this.charRegistry = {};  // 立绘注册表：name → {src, color, speed}
        this.sfxRegistry = {};   // 音效注册表：name → src
        this.backlog = [];        // 对话回顾

        this.bgm = new Audio();
        this.bgm.loop = true;
        this.bgm.volume = 0.3;

        this.sfx = new Audio();
        this.sfx.volume = 0.5;

        this.textBox.addEventListener('click', () => this.advance());
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' || e.code === 'Enter') {
                e.preventDefault();
                this.advance();
            }
            // Tab 查看对话回顾
            if (e.code === 'Tab') {
                e.preventDefault();
                this.toggleBacklog();
            }
        });

        this.initSettings();
        this.initSaveSlots();
    }

    playBgm(src) {
        if (this.bgm.src === location.origin + '/' + src || this.bgm.src.endsWith(src)) return;
        this.bgm.src = src;
        this.bgm.play().catch(() => {});
    }

    stopBgm() {
        this.bgm.pause();
        this.bgm.currentTime = 0;
    }

    initSettings() {
        const btn = document.getElementById('btnSettings');
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.settingsPanel.style.display =
                this.settingsPanel.style.display === 'block' ? 'none' : 'block';
        });

        const tabs = this.settingsPanel.querySelectorAll('.sp-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.settingsPanel.querySelectorAll('.sp-page').forEach(p => p.classList.remove('active'));
                document.getElementById(tab.dataset.page).classList.add('active');
            });
        });

        document.addEventListener('click', (e) => {
            if (!this.settingsPanel.contains(e.target) && e.target !== btn) {
                this.settingsPanel.style.display = 'none';
            }
        });
    }

    // ========== 存档系统 ==========
    initSaveSlots() {
        this.saveSlots.innerHTML = '';
        for (let i = 1; i <= 3; i++) {
            const slot = document.createElement('div');
            slot.className = 'save-slot';
            const data = localStorage.getItem('fei_save_' + i);
            const info = data ? JSON.parse(data).time : '空';
            slot.innerHTML = `
                <span class="slot-info">存档 ${i}：${info}</span>
                <div class="slot-btns">
                    <button class="slot-btn" onclick="vn.saveGame(${i})">存</button>
                    <button class="slot-btn" onclick="vn.loadGame(${i})">读</button>
                </div>`;
            this.saveSlots.appendChild(slot);
        }
    }

    saveGame(slot) {
        const data = {
            time: new Date().toLocaleString('zh-CN'),
            scriptIndex: this.scriptIndex,
            items: this.items,
            flags: this.flags,
            bgSrc: this.bg.src
        };
        localStorage.setItem('fei_save_' + slot, JSON.stringify(data));
        this.initSaveSlots();
        alert('存档成功！');
    }

    loadGame(slot) {
        const raw = localStorage.getItem('fei_save_' + slot);
        if (!raw) { alert('该存档为空'); return; }
        const data = JSON.parse(raw);
        this.items = data.items || [];
        this.flags = data.flags || {};
        this.scriptIndex = data.scriptIndex || 0;
        this.bg.src = data.bgSrc || '';
        this.updateBag();
        this.settingsPanel.style.display = 'none';
        this.textBox.style.display = 'block';
        this.charLayer.style.display = 'block';
        this.executeNext();
        alert('读档成功！');
    }

    // ========== 背包 ==========
    updateBag() {
        if (this.items.length === 0) {
            this.bagList.innerHTML = '<div class="bag-empty">暂无物品</div>';
        } else {
            this.bagList.innerHTML = '';
            this.items.forEach(item => {
                const div = document.createElement('div');
                div.className = 'bag-item';
                div.style.cursor = 'pointer';
                div.innerHTML = `<span class="bi-icon">${item.icon}</span><span class="bi-name">${item.name}</span>`;
                div.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.showItemDetail(item);
                });
                this.bagList.appendChild(div);
            });
        }
    }

    showItemDetail(item) {
        this.itemPopup.style.display = 'block';
        this.itemPopup.querySelector('h3').textContent = item.name;
        this.itemPopup.querySelector('.icon').textContent = item.icon;
        this.itemPopup.querySelector('.desc').textContent = item.desc || '';
        this.itemPopup.querySelector('.from').textContent = item.from ? ('—— ' + item.from) : '';
        clearTimeout(this._itemTimer);
        this._itemTimer = setTimeout(() => { this.itemPopup.style.display = 'none'; }, 3000);
    }

    // ========== 图片预加载 ==========
    preload(src) {
        return new Promise((resolve) => {
            if (!src) { resolve(); return; }
            const img = new Image();
            img.onload = () => { console.log('loaded:', src); resolve(img); };
            img.onerror = (e) => { console.error('FAIL:', src); resolve(null); };
            img.src = src;
        });
    }

    // 去除白色背景
    removeWhiteBg(img) {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth || img.width;
        c.height = img.naturalHeight || img.height;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, c.width, c.height);
        const d = imageData.data;
        for (let i = 0; i < d.length; i += 4) {
            if (d[i] > 220 && d[i+1] > 220 && d[i+2] > 220) {
                d[i+3] = 0;
            }
        }
        ctx.putImageData(imageData, 0, 0);
        const result = new Image();
        result.src = c.toDataURL();
        return result;
    }

    // ========== 背景 ==========
    setBg(src, fade = true) {
        console.log('setBg:', src, 'fade:', fade);
        if (fade) {
            this.overlay.style.transition = 'opacity 0.4s';
            this.overlay.style.opacity = '1';
            setTimeout(() => {
                this.bg.src = src + (src.includes('?') ? '&' : '?') + 'v=' + Date.now();
                this.bg.style.filter = '';
                this.overlay.style.opacity = '0';
            }, 400);
        } else {
            this.bg.src = src + (src.includes('?') ? '&' : '?') + 'v=' + Date.now();
            this.bg.style.filter = '';
        }
    }

    // ========== 人物立绘 ==========
    showChar(name, src, position = 'center') {
        const gen = ++this.charGen;
        const img = document.createElement('img');
        img.className = `char-img char-${position}`;
        img.alt = name;
        img.dataset.src = src;
        img.style.opacity = '0';

        img.onload = () => {
            if (gen !== this.charGen) return;
            this.charLayer.appendChild(img);
            requestAnimationFrame(() => { img.style.opacity = '1'; });
        };

        img.onerror = () => {
            if (gen !== this.charGen) return;
            console.error('角色图片加载失败:', src);
            this.charLayer.appendChild(img);
            requestAnimationFrame(() => { img.style.opacity = '1'; });
        };

        img.src = src + '?v=' + Date.now();
    }

    clearChars() {
        this.charLayer.innerHTML = '';
    }

    // ========== 对话 ==========
    runScript(script) {
        this.currentScript = script;
        this.scriptIndex = 0;
        this.executeNext();
    }

    executeNext() {
        if (this.scriptIndex >= this.currentScript.length) return;

        const cmd = this.currentScript[this.scriptIndex];
        this.scriptIndex++;

        switch (cmd.type) {
            case 'bg':
                this.setBg(cmd.src);
                setTimeout(() => this.executeNext(), cmd.fade || 500);
                break;

            case 'char':
                this.charLayer.innerHTML = '';
                this.showChar(cmd.name, cmd.src, cmd.pos || 'right');
                this.executeNext();
                break;

            case 'clearChar':
                this.clearChars();
                this.executeNext();
                break;

            case 'dialog':
                this.showDialog(cmd.speaker, cmd.text, cmd.color);
                break;

            case 'ifFlag': {
                const val = this.flags[cmd.key];
                const branchScript = (val === cmd.value) ? cmd.then : (cmd.else || []);
                if (branchScript.length > 0) {
                    this.currentScript.splice(this.scriptIndex, 0, ...branchScript);
                }
                this.executeNext();
                break;
            }

            case 'branch':
                // 条件分支：根据 flag 值选择不同剧本
                const flagVal = this.flags[cmd.flag];
                const branchScript = cmd.branches[flagVal] || cmd.branches['default'] || [];
                if (branchScript.length > 0) {
                    this.runScript(branchScript);
                } else {
                    this.executeNext();
                }
                break;

            case 'choice':
                this.showChoices(cmd.options);
                break;

            case 'chapter':
                this.showChapterTitle(cmd.title, cmd.subtitle, () => {
                    this.executeNext();
                });
                break;

            case 'starScene':
                this.startStarScene(cmd.lines, () => {
                    this.executeNext();
                });
                break;

            case 'item':
                this.getItem(cmd.name, cmd.icon, cmd.desc, cmd.from, () => {
                    this.executeNext();
                });
                break;

            case 'minigame':
                this.startMinigame(cmd.name, cmd.data, (result) => {
                    this.flags[cmd.flag || cmd.name] = result;
                    this.executeNext();
                });
                break;

            case 'setFlag':
                this.flags[cmd.key] = cmd.value;
                this.executeNext();
                break;

            case 'setChar':
                this.registerChar(cmd.name, cmd.src);
                this.executeNext();
                break;

            case 'sfx':
                this.playSfx(cmd.name);
                this.executeNext();
                break;

            case 'bgm':
                if (cmd.src) this.playBgm(cmd.src);
                else this.stopBgm();
                this.executeNext();
                break;

            case 'wait':
                setTimeout(() => this.executeNext(), cmd.ms);
                break;

            case 'hideText':
                this.textBox.style.display = 'none';
                this.charLayer.style.display = 'none';
                this.executeNext();
                break;

            case 'showText':
                this.textBox.style.display = 'block';
                this.charLayer.style.display = 'block';
                this.executeNext();
                break;

            default:
                this.executeNext();
        }
    }

    showDialog(speaker, text, color) {
        this.textBox.style.display = 'block';
        this.charLayer.style.display = 'block';

        // 颜色优先级：命令参数 > 角色注册 > 默认
        const resolvedColor = color || this.findCharColor(speaker) || '#e75480';
        this.speakerEl.style.color = resolvedColor;

        // 显示名称（如 '小菲哭' → 显示 '小菲'）
        this.speakerEl.textContent = speaker ? this.findCharDisplayName(speaker) : '';

        // 旁白样式：无说话人时隐藏名字、用不同样式
        if (!speaker) {
            this.speakerEl.style.display = 'none';
            this.dialogEl.classList.add('narrator');
        } else {
            this.speakerEl.style.display = 'block';
            this.dialogEl.classList.remove('narrator');
        }

        this.dialogEl.textContent = '';
        this.hintEl.style.display = 'none';
        this.canAdvance = false;

        // 记录到对话回顾
        this.backlog.push({ speaker: speaker ? this.findCharDisplayName(speaker) : '旁白', text });

        // 根据说话人显示立绘
        this.charLayer.innerHTML = '';
        if (speaker) {
            const charSrc = this.findCharSrc(speaker);
            if (charSrc) {
                this.showChar(speaker, charSrc, 'right');
            }
        }

        // 打字速度：命令参数 > 角色注册 > 默认
        const speed = this.findCharSpeed(speaker) || 35;
        this.typeText(text, speed, () => {
            this.canAdvance = true;
            this.hintEl.style.display = 'block';
        });
    }

    // ========== 立绘注册 ==========
    registerChar(name, src, color, speed, displayName) {
        this.charRegistry[name] = { src, color: color || null, speed: speed || null, displayName: displayName || null };
    }

    findCharSrc(speaker) {
        if (!speaker) return null;
        const entry = this._findCharEntry(speaker);
        return entry ? entry.src : null;
    }

    findCharColor(speaker) {
        if (!speaker) return null;
        const entry = this._findCharEntry(speaker);
        return entry ? entry.color : null;
    }

    findCharSpeed(speaker) {
        if (!speaker) return null;
        const entry = this._findCharEntry(speaker);
        return entry ? entry.speed : null;
    }

    findCharDisplayName(speaker) {
        if (!speaker) return '';
        const entry = this._findCharEntry(speaker);
        return (entry && entry.displayName) ? entry.displayName : speaker;
    }

    _findCharEntry(speaker) {
        if (!speaker) return null;
        // 1. 精确匹配
        if (this.charRegistry[speaker]) return this.charRegistry[speaker];
        // 2. 前缀匹配
        for (const name of Object.keys(this.charRegistry).sort((a,b) => b.length - a.length)) {
            if (speaker.startsWith(name)) return this.charRegistry[name];
        }
        // 3. 包含匹配
        for (const name of Object.keys(this.charRegistry).sort((a,b) => b.length - a.length)) {
            if (speaker.includes(name) || name.includes(speaker)) return this.charRegistry[name];
        }
        return null;
    }

    // ========== 音效注册 ==========
    registerSfx(name, src) {
        this.sfxRegistry[name] = src;
    }

    playSfx(name) {
        const src = this.sfxRegistry[name];
        if (!src) { console.warn('未注册的音效:', name); return; }
        this.sfx.src = src;
        this.sfx.play().catch(() => {});
    }

    // ========== 对话回顾 ==========
    toggleBacklog() {
        const existing = document.getElementById('backlogPanel');
        if (existing) { existing.remove(); return; }

        const panel = document.createElement('div');
        panel.id = 'backlogPanel';
        panel.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:90;overflow-y:auto;padding:20px 40px;font-family:inherit;';

        const title = document.createElement('div');
        title.textContent = '— 对话回顾（Tab 关闭）—';
        title.style.cssText = 'text-align:center;color:#ffb6c1;font-size:18px;margin-bottom:16px;font-weight:bold;';
        panel.appendChild(title);

        this.backlog.forEach(item => {
            const line = document.createElement('div');
            line.style.cssText = 'margin-bottom:10px;line-height:1.8;';
            if (item.speaker === '旁白') {
                line.innerHTML = `<span style="color:#999;font-style:italic;">${item.text}</span>`;
            } else {
                line.innerHTML = `<span style="color:#e75480;font-weight:bold;">${item.speaker}：</span><span style="color:#ddd;">${item.text}</span>`;
            }
            panel.appendChild(line);
        });

        // 滚动到底部
        panel.appendChild(document.createElement('div')).style.height = '20px';
        document.getElementById('game').appendChild(panel);
        panel.scrollTop = panel.scrollHeight;
    }

    typeText(text, speed, callback) {
        this.isTyping = true;
        let i = 0;
        const charSpeed = speed || 35;
        const type = () => {
            if (i < text.length) {
                this.dialogEl.textContent += text[i];
                i++;
                this.typeTimer = setTimeout(type, charSpeed);
            } else {
                this.isTyping = false;
                if (callback) callback();
            }
        };
        type();
    }

    advance() {
        if (this.isTyping) {
            clearTimeout(this.typeTimer);
            const cmd = this.currentScript[this.scriptIndex - 1];
            if (cmd && cmd.text) {
                this.dialogEl.textContent = cmd.text;
            }
            this.isTyping = false;
            this.canAdvance = true;
            this.hintEl.style.display = 'block';
            return;
        }
        if (this.canAdvance) {
            this.canAdvance = false;
            this.executeNext();
        }
    }

    // ========== 选项 ==========
    showChoices(options) {
        this.choiceBox.style.display = 'flex';
        this.choiceBox.innerHTML = '';
        
        const inner = document.createElement('div');
        inner.id = 'choiceInner';

        options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'choice-btn';
            btn.textContent = opt.text;
            btn.addEventListener('click', () => {
                this.choiceBox.style.display = 'none';
                if (opt.setFlag) {
                    this.flags[opt.setFlag] = opt.setValue || true;
                }
                if (opt.script) {
                    this.runScript(opt.script);
                } else {
                    this.executeNext();
                }
            });
            inner.appendChild(btn);
        });
        
        this.choiceBox.appendChild(inner);
    }

    // ========== 章节标题 ==========
    showChapterTitle(title, subtitle, callback) {
        this.chapterTitle.style.display = 'flex';
        this.textBox.style.display = 'none';
        this.charLayer.style.display = 'none';
        this.chapterTitle.querySelector('h2').textContent = title;
        this.chapterTitle.querySelector('p').textContent = subtitle || '';
        setTimeout(() => {
            this.chapterTitle.style.display = 'none';
            if (callback) callback();
        }, 2500);
    }

    // ========== 物品 ==========
    getItem(name, icon, desc, from, callback) {
        this.items.push({ name, icon, desc, from });
        this.playSfx('item');

        this.itemPopup.style.display = 'block';
        this.textBox.style.display = 'none';
        const iconEl = this.itemPopup.querySelector('.icon');
        if (icon.includes('<')) {
            iconEl.innerHTML = icon;
        } else {
            iconEl.textContent = icon;
        }
        this.itemPopup.querySelector('.desc').textContent = desc;
        this.itemPopup.querySelector('.from').textContent = from ? ('—— ' + from) : '';
        this.updateBag();

        setTimeout(() => {
            this.itemPopup.style.display = 'none';
            if (callback) callback();
        }, 2000);
    }

    // ========== 星空场景 ==========
    startStarScene(lines, callback) {
        this.textBox.style.display = 'none';
        this.charLayer.innerHTML = '';
        this.bg.style.display = 'none';
        this.starCanvas.style.display = 'block';
        this.floatTextDiv.style.display = 'block';
        this.floatTextDiv.innerHTML = '';

        const ctx = this.starCtx;
        const W = 960, H = 640;
        this.starCanvas.width = W;
        this.starCanvas.height = H;

        // 生成星星
        const stars = [];
        for (let i = 0; i < 150; i++) {
            stars.push({
                x: Math.random() * W,
                y: Math.random() * H,
                r: Math.random() * 2 + 0.5,
                speed: Math.random() * 0.3 + 0.1,
                phase: Math.random() * Math.PI * 2
            });
        }

        let frame = 0;
        let textIndex = 0;
        const lineDelay = 2000;

        const drawStars = () => {
            frame++;
            ctx.fillStyle = '#0a0a2e';
            ctx.fillRect(0, 0, W, H);

            // 月亮
            ctx.fillStyle = '#fffacd';
            ctx.beginPath(); ctx.arc(750, 100, 35, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#0a0a2e';
            ctx.beginPath(); ctx.arc(768, 90, 30, 0, Math.PI * 2); ctx.fill();

            stars.forEach(s => {
                const twinkle = Math.sin(frame * 0.05 + s.phase) * 0.4 + 0.6;
                ctx.fillStyle = `rgba(255,255,255,${twinkle})`;
                ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
                s.y += s.speed;
                if (s.y > H) { s.y = 0; s.x = Math.random() * W; }
            });

            this._starRAF = requestAnimationFrame(drawStars);
        };
        drawStars();

        // 逐行显示文字
        const showNextLine = () => {
            if (textIndex >= lines.length) {
                // 全部显示完，等3秒后结束
                setTimeout(() => {
                    this.stopStarScene();
                    callback();
                }, 3000);
                return;
            }

            const line = lines[textIndex];
            const el = document.createElement('div');
            el.className = 'float-line';
            el.textContent = line.text;
            el.style.top = (line.y || (150 + textIndex * 60)) + 'px';
            el.style.fontSize = (line.size || 20) + 'px';
            this.floatTextDiv.appendChild(el);

            requestAnimationFrame(() => {
                el.style.opacity = '1';
            });

            textIndex++;
            this._starTimer = setTimeout(showNextLine, lineDelay);
        };
        setTimeout(showNextLine, 500);
    }

    stopStarScene() {
        cancelAnimationFrame(this._starRAF);
        clearTimeout(this._starTimer);
        this.starCanvas.style.display = 'none';
        this.floatTextDiv.style.display = 'none';
        this.floatTextDiv.innerHTML = '';
        this.bg.style.display = 'block';
    }

    // ========== 小游戏 ==========
    startMinigame(name, data, callback) {
        this.textBox.style.display = 'none';
        this.charLayer.style.display = 'none';
        this.minigameDiv.style.display = 'block';

        if (name === 'hideAndSeek') {
            this.minigameHideAndSeek(data, callback);
        } else if (name === 'hopscotch') {
            this.minigameHopscotch(data, callback);
        }
    }

    endMinigame(callback, result) {
        this.minigameDiv.style.display = 'none';
        this.textBox.style.display = 'block';
        this.charLayer.style.display = 'block';
        callback(result);
    }

    // ---------- 捉迷藏（多轮递进） ----------
    minigameHideAndSeek(data, callback) {
        const ctx = this.mgCtx;
        const W = 960, H = 640;

        const _girlRaw = new Image(); _girlRaw.src = data.girl;
        const _boyRaw = new Image(); _boyRaw.src = data.boy;
        let girlImg = _girlRaw, boyImg = _boyRaw;
        _girlRaw.onload = () => { girlImg = this.removeWhiteBg(_girlRaw); };
        _boyRaw.onload = () => { boyImg = this.removeWhiteBg(_boyRaw); };

        // 干扰NPC图片
        const _grannyRaw = new Image(); _grannyRaw.src = 'img-char/granny.webp';
        const _catRaw = new Image(); _catRaw.src = 'img-char/cat.webp';
        let grannyImg = _grannyRaw, catImg = _catRaw;
        _grannyRaw.onload = () => { grannyImg = this.removeWhiteBg(_grannyRaw); };
        _catRaw.onload = () => { catImg = this.removeWhiteBg(_catRaw); };

        // 四个场景
        const scenes = [
            { name: '老巷子', bg: 'img-bg/ch1/alley.webp', spots: [
                { x: 150, y: 480 }, { x: 400, y: 480 }, { x: 700, y: 480 }
            ]},
            { name: '捉迷藏场景', bg: 'img-bg/ch1/hide.webp', spots: [
                { x: 120, y: 480 }, { x: 450, y: 480 }, { x: 780, y: 480 }
            ]},
            { name: '搬家场景', bg: 'img-bg/ch1/moving.webp', spots: [
                { x: 200, y: 480 }, { x: 500, y: 480 }, { x: 750, y: 480 }
            ]},
            { name: '小卖部', bg: 'img-bg/ch1/shop.webp', spots: [
                { x: 180, y: 480 }, { x: 480, y: 480 }, { x: 760, y: 480 }
            ]}
        ];

        // 三轮递进配置
        const rounds = [
            { sceneCount: 3, timeLimit: 1800, showGlow: true,  showHint: true,  boyMoves: false, hasNpc: false },
            { sceneCount: 3, timeLimit: 1200, showGlow: false, showHint: false, boyMoves: false, hasNpc: true },
            { sceneCount: 4, timeLimit: 900,  showGlow: false, showHint: false, boyMoves: true,  hasNpc: true }
        ];

        let roundIdx = 0;
        let totalScore = 0;  // 找到+100，超时+0
        let hideScene, boyPos;
        let currentScene = 0;
        let bgImg = new Image();
        let px = 480, py = 520;
        let found = false, endFrame = 0, timedOut = false;
        let frame = 0;
        let timeLeft = 0;
        const speed = 6;
        let switching = false;
        let switchAlpha = 0;
        let switchDir = 0;
        let showRoundTitle = false;
        let roundTitleTimer = 0;
        let boyMoveCooldown = 0;  // 小宇逃跑冷却

        // 干扰NPC状态
        let npcs = []; // [{scene, x, y, type, triggered, triggerFrame}]
        let npcFrozen = false;  // 被NPC挡住不能动
        let npcFreezeEnd = 0;
        let npcDialog = '';  // 当前NPC对话文本

        // 初始化当前轮次
        const initRound = () => {
            const r = rounds[roundIdx];
            const sceneCount = r.sceneCount;
            hideScene = Math.floor(Math.random() * sceneCount);
            const hideSpots = scenes[hideScene].spots;
            const hideSpotIdx = Math.floor(Math.random() * hideSpots.length);
            boyPos = { ...hideSpots[hideSpotIdx] };

            currentScene = 0;
            px = 480; py = 520;
            found = false; endFrame = 0; timedOut = false;
            frame = 0;
            timeLeft = r.timeLimit;
            switching = false; switchAlpha = 0;
            boyMoveCooldown = 0;
            npcFrozen = false;
            npcDialog = '';

            // 生成干扰NPC（第2、3轮）
            npcs = [];
            if (r.hasNpc) {
                for (let si = 0; si < sceneCount; si++) {
                    if (si === hideScene) continue; // 小宇所在的场景不放NPC
                    const types = ['granny', 'cat'];
                    const type = types[Math.floor(Math.random() * types.length)];
                    const spot = scenes[si].spots[Math.floor(Math.random() * scenes[si].spots.length)];
                    npcs.push({ scene: si, x: spot.x + (Math.random() * 60 - 30), y: spot.y, type, triggered: false, triggerFrame: 0 });
                }
            }

            showRoundTitle = true;
            roundTitleTimer = 0;
            loadScene(0);
        };

        const loadScene = (idx) => {
            const r = rounds[roundIdx];
            currentScene = ((idx % r.sceneCount) + r.sceneCount) % r.sceneCount;
            bgImg = new Image();
            bgImg.src = scenes[currentScene].bg;
        };

        const keys = {};
        const onDown = (e) => { keys[e.key.toLowerCase()] = true; };
        const onUp = (e) => { keys[e.key.toLowerCase()] = false; };
        document.addEventListener('keydown', onDown);
        document.addEventListener('keyup', onUp);

        const cleanup = () => {
            document.removeEventListener('keydown', onDown);
            document.removeEventListener('keyup', onUp);
        };

        const startSwitch = (dir) => {
            if (switching || found) return;
            switching = true;
            switchDir = dir;
            switchAlpha = 0;
        };

        const loop = () => {
            frame++;
            const r = rounds[roundIdx];

            // 轮次标题显示
            if (showRoundTitle) {
                roundTitleTimer++;
                ctx.fillStyle = '#87ceeb'; ctx.fillRect(0, 0, W, H);
                ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(230, 220, 500, 160);
                ctx.font = 'bold 36px sans-serif'; ctx.textAlign = 'center';
                ctx.fillStyle = '#ffb6c1';
                ctx.fillText(`第 ${roundIdx + 1} 轮`, W / 2, 280);
                ctx.font = '20px sans-serif'; ctx.fillStyle = '#fff';
                const desc = roundIdx === 0 ? '有提示，30秒限时' :
                              roundIdx === 1 ? '无提示，20秒限时，有干扰' :
                              '无提示，15秒限时，小宇会跑！';
                ctx.fillText(desc, W / 2, 320);
                ctx.font = '16px sans-serif'; ctx.fillStyle = '#aaa';
                ctx.fillText('点击任意处开始', W / 2, 360);
                if (roundTitleTimer > 60) {
                    const onClick = () => {
                        showRoundTitle = false;
                        document.removeEventListener('click', onClick);
                    };
                    document.addEventListener('click', onClick);
                }
                requestAnimationFrame(loop);
                return;
            }

            // 场景切换动画
            if (switching) {
                switchAlpha += 0.04;
                if (switchAlpha >= 1) {
                    loadScene(currentScene + switchDir);
                    px = switchDir > 0 ? 80 : W - 80;
                    py = 520;
                    switchAlpha = 1;
                    switching = false;

                    // 小宇逃跑判定（第3轮）
                    if (r.boyMoves && boyMoveCooldown <= 0 && currentScene !== hideScene) {
                        if (Math.random() < 0.35) {
                            const oldScene = hideScene;
                            do { hideScene = Math.floor(Math.random() * r.sceneCount); } while (hideScene === oldScene);
                            const newSpots = scenes[hideScene].spots;
                            boyPos = { ...newSpots[Math.floor(Math.random() * newSpots.length)] };
                            boyMoveCooldown = 300; // 5秒冷却
                        }
                    }
                }
            } else if (switchAlpha > 0) {
                switchAlpha -= 0.04;
                if (switchAlpha < 0) switchAlpha = 0;
            }

            // NPC冻结倒计时
            if (npcFrozen && frame >= npcFreezeEnd) {
                npcFrozen = false;
                npcDialog = '';
            }

            // 移动
            if (!found && !switching && !npcFrozen) {
                if (keys['w'] || keys['arrowup']) py = Math.max(420, py - speed);
                if (keys['s'] || keys['arrowdown']) py = Math.min(560, py + speed);
                if (keys['a'] || keys['arrowleft']) {
                    px -= speed;
                    if (px < 30) startSwitch(-1);
                }
                if (keys['d'] || keys['arrowright']) {
                    px += speed;
                    if (px > W - 30) startSwitch(1);
                }
            }
            if (boyMoveCooldown > 0) boyMoveCooldown--;

            // 背景
            if (bgImg.complete) ctx.drawImage(bgImg, 0, 0, W, H);
            else { ctx.fillStyle = '#87ceeb'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#8b7355'; ctx.fillRect(0, 480, W, 160); }

            // NPC检测和绘制
            if (!found && !switching && r.hasNpc) {
                npcs.forEach(npc => {
                    if (npc.scene !== currentScene) return;
                    if (npc.triggered && frame - npc.triggerFrame > 300) npc.triggered = false; // 5秒后可再次触发

                    // 绘制NPC
                    const img = npc.type === 'granny' ? grannyImg : catImg;
                    if (img.complete) {
                        const nh = npc.type === 'granny' ? 120 : 60;
                        const nw = nh * (img.width / img.height);
                        ctx.drawImage(img, npc.x - nw/2, npc.y - nh, nw, nh);
                    }

                    // 碰撞检测
                    if (!npc.triggered && !npcFrozen) {
                        const dist = Math.hypot(px - npc.x, py - npc.y);
                        if (dist < 60) {
                            npc.triggered = true;
                            npc.triggerFrame = frame;
                            npcFrozen = true;
                            npcFreezeEnd = frame + 120; // 冻结2秒
                            npcDialog = npc.type === 'granny'
                                ? '阿婆：小朋友，你有没有看到一只猫跑过去呀？'
                                : '小猫：喵～喵喵～（蹭蹭你的腿）';
                        }
                    }
                });
            }

            // 藏身点标记（仅第1轮显示发光）
            const sc = scenes[currentScene];
            if (!found && !switching && !timedOut) {
                if (r.showGlow) {
                    sc.spots.forEach((s, i) => {
                        const glow = Math.sin(frame * 0.08 + i) * 0.3 + 0.5;
                        ctx.fillStyle = `rgba(255,220,100,${glow})`;
                        ctx.beginPath(); ctx.arc(s.x, s.y, 35, 0, Math.PI * 2); ctx.fill();
                        if (frame % 60 < 30) {
                            ctx.font = 'bold 26px sans-serif'; ctx.textAlign = 'center';
                            ctx.fillStyle = '#ffcc00';
                            ctx.fillText('?', s.x, s.y - 40);
                        }
                    });
                }

                // 距离检测
                if (currentScene === hideScene) {
                    const dist = Math.hypot(px - boyPos.x, py - boyPos.y);
                    if (dist < 70) {
                        found = true;
                        endFrame = frame;
                        totalScore += 100;
                    }
                }

                // 限时倒计时
                if (!npcFrozen) timeLeft--;
                if (timeLeft <= 0 && !found) {
                    timedOut = true;
                    endFrame = frame;
                }

                // HUD
                ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(200, 10, 560, 40);
                ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center';
                ctx.fillStyle = '#fff';
                const sec = Math.ceil(timeLeft / 60);
                const hint = (r.showHint && currentScene === hideScene) ? '  💡感觉在这附近...' : '';
                ctx.fillText(`第${roundIdx+1}/3轮  场景：${sc.name}  剩余${sec}秒${hint}`, W / 2, 36);

                // 小宇逃跑提示（第3轮）
                if (r.boyMoves && boyMoveCooldown > 240) {
                    ctx.fillStyle = 'rgba(255,100,100,0.9)'; ctx.fillRect(330, 60, 300, 30);
                    ctx.font = 'bold 16px sans-serif'; ctx.fillStyle = '#fff';
                    ctx.fillText('🏃 小宇好像换地方了！', W / 2, 82);
                }

                // 左右箭头提示
                ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(10, H/2 - 20, 30, 40);
                ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(W - 40, H/2 - 20, 30, 40);
                ctx.font = 'bold 24px sans-serif'; ctx.fillStyle = '#fff';
                ctx.textAlign = 'center';
                ctx.fillText('◀', 25, H/2 + 8);
                ctx.fillText('▶', W - 25, H/2 + 8);
            }

            // 画小菲
            if (girlImg.complete) {
                const gh = 100;
                const gw = gh * (girlImg.width / girlImg.height);
                ctx.drawImage(girlImg, px - gw/2, py - gh, gw, gh);
            }

            // NPC对话框
            if (npcFrozen && npcDialog) {
                ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(200, 250, 560, 60);
                ctx.font = '18px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffcc00';
                ctx.fillText(npcDialog, W / 2, 285);
            }

            // 找到后显示小宇
            if (found) {
                if (boyImg.complete) {
                    const bh = 100;
                    const bw = bh * (boyImg.width / boyImg.height);
                    ctx.drawImage(boyImg, boyPos.x - bw/2, boyPos.y - bh, bw, bh);
                }
                ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(300, 250, 360, 50);
                ctx.font = 'bold 30px sans-serif'; ctx.textAlign = 'center';
                ctx.fillStyle = '#0f0';
                ctx.fillText('找到你啦！', W / 2, 282);

                if (frame - endFrame > 80) {
                    if (roundIdx < 2) {
                        roundIdx++;
                        initRound();
                    } else {
                        cleanup();
                        this.endMinigame(callback, totalScore >= 300 ? 'found' : 'partial');
                        return;
                    }
                }
            }

            // 超时
            if (timedOut) {
                ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(250, 230, 460, 80);
                ctx.font = 'bold 30px sans-serif'; ctx.textAlign = 'center';
                ctx.fillStyle = '#ff6666';
                ctx.fillText('时间到！', W / 2, 270);
                ctx.font = '18px sans-serif'; ctx.fillStyle = '#aaa';
                ctx.fillText(`小宇藏在${scenes[hideScene].name}`, W / 2, 300);

                if (frame - endFrame > 100) {
                    if (roundIdx < 2) {
                        roundIdx++;
                        initRound();
                    } else {
                        cleanup();
                        this.endMinigame(callback, totalScore >= 300 ? 'found' : 'fail');
                        return;
                    }
                }
            }

            // 场景切换黑幕
            if (switchAlpha > 0) {
                ctx.fillStyle = `rgba(0,0,0,${switchAlpha})`;
                ctx.fillRect(0, 0, W, H);
                ctx.font = 'bold 24px sans-serif'; ctx.textAlign = 'center';
                ctx.fillStyle = `rgba(255,255,255,${switchAlpha})`;
                ctx.fillText('切换场景...', W/2, H/2);
            }

            requestAnimationFrame(loop);
        };

        initRound();
        const start = () => { if (bgImg.complete) loop(); else setTimeout(start, 50); };
        start();
    }

    // ---------- 跳房子 ----------
    minigameHopscotch(data, callback) {
        const ctx = this.mgCtx;
        const W = 960, H = 640;

        // 3x3 格子
        const grid = [
            { x: 280, y: 280, w: 100, h: 80, label: '1' },
            { x: 430, y: 280, w: 100, h: 80, label: '2' },
            { x: 580, y: 280, w: 100, h: 80, label: '3' },
            { x: 280, y: 390, w: 100, h: 80, label: '4' },
            { x: 430, y: 390, w: 100, h: 80, label: '5' },
            { x: 580, y: 390, w: 100, h: 80, label: '6' },
            { x: 280, y: 500, w: 100, h: 80, label: '7' },
            { x: 430, y: 500, w: 100, h: 80, label: '8' },
            { x: 580, y: 500, w: 100, h: 80, label: '9' },
        ];

        let score = 0;
        let lives = 3;
        let round = 0;
        const totalRounds = 6;
        let targets = [];
        let pressed = [];
        let timeLeft = 0;
        let timeLimit = 600; // 10秒答题时间
        let frame = 0;
        let gameOver = false;
        let showResult = false;
        let resultOk = false;
        let resultTimer = 0;
        let combo = 0;
        let maxCombo = 0;
        let glowOff = false;
        let glowTimer = 0;

        const nextTarget = () => {
            round++;
            if (round > totalRounds) {
                gameOver = true;
                resultTimer = frame;
                return;
            }
            // 每局随机1-4个数字
            const count = Math.floor(Math.random() * 4) + 1;
            targets = [];
            pressed = [];
            glowOff = false;
            glowTimer = 0;
            while (targets.length < count) {
                const t = Math.floor(Math.random() * 9);
                if (!targets.includes(t)) targets.push(t);
            }
            timeLeft = timeLimit; // 每局固定10秒
            showResult = false;
        };
        nextTarget();

        const onKey = (e) => {
            if (gameOver || showResult) return;
            const key = parseInt(e.key);
            if (key >= 1 && key <= 9) {
                const chosen = key - 1;
                if (targets.includes(chosen) && !pressed.includes(chosen)) {
                    // 按对了一个
                    pressed.push(chosen);
                    if (pressed.length === targets.length) {
                        // 全部按完
                        combo++;
                        if (combo > maxCombo) maxCombo = combo;
                        score += 10 + combo * 3 + (targets.length - 1) * 5;
                        resultOk = true;
                        showResult = true;
                        resultTimer = frame;
                        setTimeout(() => nextTarget(), 500);
                    }
                } else if (!targets.includes(chosen)) {
                    // 按错了
                    lives--;
                    combo = 0;
                    resultOk = false;
                    showResult = true;
                    resultTimer = frame;
                    if (lives <= 0) { gameOver = true; resultTimer = frame; }
                    else setTimeout(() => nextTarget(), 500);
                }
            }
        };
        document.addEventListener('keydown', onKey);

        const cleanup = () => {
            document.removeEventListener('keydown', onKey);
        };

        const loop = () => {
            frame++;

            // 背景
            ctx.fillStyle = '#87ceeb'; ctx.fillRect(0, 0, W, H);
            ctx.fillStyle = '#8b7355'; ctx.fillRect(0, 560, W, 80);
            // 小草装饰
            ctx.fillStyle = '#228b22';
            for (let i = 0; i < 8; i++) {
                ctx.beginPath(); ctx.arc(40 + i * 125, 555, 15, 0, Math.PI * 2); ctx.fill();
            }

            // 高亮计时2秒后关闭
            if (!glowOff && !showResult && !gameOver) {
                glowTimer++;
                if (glowTimer >= 120) glowOff = true; // 2秒
            }

            // 倒计时
            if (!gameOver && !showResult && glowOff) {
                timeLeft--;
                if (timeLeft <= 0) {
                    lives--;
                    combo = 0;
                    resultOk = false;
                    showResult = true;
                    resultTimer = frame;
                    if (lives <= 0) { gameOver = true; resultTimer = frame; }
                    else setTimeout(() => nextTarget(), 500);
                }
            }

            // 画格子
            grid.forEach((g, i) => {
                const isTarget = targets.includes(i) && !showResult;
                const isPressed = pressed.includes(i);
                const flash = isTarget && !glowOff && frame % 20 < 12;

                ctx.fillStyle = isPressed ? 'rgba(100,255,100,0.7)' : flash ? 'rgba(255,215,0,0.9)' : 'rgba(255,255,255,0.5)';
                ctx.fillRect(g.x - g.w/2, g.y - g.h/2, g.w, g.h);
                ctx.strokeStyle = flash ? '#ff8c00' : isPressed ? '#00aa00' : '#654321';
                ctx.lineWidth = flash ? 4 : 2;
                ctx.strokeRect(g.x - g.w/2, g.y - g.h/2, g.w, g.h);

                ctx.font = 'bold 32px sans-serif'; ctx.textAlign = 'center';
                ctx.fillStyle = flash ? '#000' : isPressed ? '#005500' : '#555';
                ctx.fillText(g.label, g.x, g.y + 12);
            });

            // ---- 顶部信息栏 ----
            ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(200, 10, 560, 55);
            ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'left';
            ctx.fillStyle = '#fff';
            ctx.fillText(`第 ${Math.min(round, totalRounds)}/${totalRounds} 轮`, 220, 35);
            ctx.fillText(`得分: ${score}`, 400, 35);
            let hearts = '';
            for (let i = 0; i < 3; i++) hearts += i < lives ? '❤️' : '🖤';
            ctx.textAlign = 'center'; ctx.fillText(hearts, 580, 38);
            if (combo > 1) {
                ctx.fillStyle = '#ffcc00';
                ctx.fillText(`${combo}连击！`, 700, 38);
            }
            // 倒计时条（高亮关闭后才显示）
            if (!gameOver && !showResult && glowOff) {
                const barW = 400, barH = 10;
                const barX = 280, barY = 55;
                ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(barX, barY, barW, barH);
                const pct = timeLeft / timeLimit;
                ctx.fillStyle = pct > 0.3 ? '#4488ff' : '#ff3333';
                ctx.fillRect(barX, barY, barW * pct, barH);
            }

            // ---- 提示 ----
            if (!gameOver && !showResult) {
                if (!glowOff) {
                    ctx.fillStyle = 'rgba(255,255,200,0.9)'; ctx.fillRect(330, 80, 300, 36);
                    ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center';
                    ctx.fillStyle = '#333';
                    ctx.fillText('👀 记住亮起的格子！', W / 2, 104);
                } else {
                    ctx.fillStyle = 'rgba(255,255,200,0.9)'; ctx.fillRect(330, 80, 300, 36);
                    ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center';
                    ctx.fillStyle = '#cc3333';
                    ctx.fillText('🎮 凭记忆按数字键！', W / 2, 104);
                }
            }

            // ---- 结果反馈 ----
            if (showResult && !gameOver) {
                ctx.font = 'bold 40px sans-serif'; ctx.textAlign = 'center';
                ctx.fillStyle = resultOk ? '#00cc00' : '#cc0000';
                const msg = resultOk
                    ? (combo > 1 ? `${combo}连击！` : (targets.length > 1 ? '双杀！' : '答对了！'))
                    : (lives <= 0 ? '没命了...' : '答错了...');
                ctx.fillText(msg, W / 2, 300);
            }

            // ---- 游戏结束 ----
            if (gameOver) {
                ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(230, 180, 500, 250);
                ctx.font = 'bold 36px sans-serif'; ctx.textAlign = 'center';
                ctx.fillStyle = '#fff';
                ctx.fillText(score >= 60 ? '游戏结束！' : '小宇赢了！', W / 2, 240);
                ctx.font = '26px sans-serif';
                ctx.fillText(`得分: ${score}  最高连击: ${maxCombo}`, W / 2, 290);
                ctx.font = '20px sans-serif'; ctx.fillStyle = '#aaa';
                const grade = score >= 100 ? '太厉害了！小菲是跳房子天才！' :
                              score >= 60 ? '不错！小菲赢了！' :
                              score >= 30 ? '差一点！小宇赢了...' : '小宇赢了！下次加油！';
                ctx.fillText(grade, W / 2, 340);
                ctx.fillStyle = '#888'; ctx.font = '16px sans-serif';
                ctx.fillText('点击任意处继续', W / 2, 390);

                if (frame - resultTimer > 60) {
                    const endClick = () => {
                        cleanup();
                        document.removeEventListener('click', endClick);
                        this.endMinigame(callback, score >= 60 ? 'success' : 'fail');
                    };
                    document.addEventListener('click', endClick);
                    return;
                }
            }

            requestAnimationFrame(loop);
        };

        const start = () => { loop(); };
        start();
    }
}
