const vn = new VNEngine();

// =============================================
// 立绘注册表 —— 加新角色只需在这里加一行
// registerChar(名字, 立绘路径, 颜色, 打字速度ms)
// =============================================
vn.registerChar('小菲', 'img-char/fei-smile.webp', '#ff69b4', null, '小菲');
vn.registerChar('小菲哭', 'img-char/fei-cry.webp', '#ff69b4', null, '小菲');
vn.registerChar('小宇', 'img-char/yu-smile.webp', '#87ceeb', null, '小宇');
vn.registerChar('小宇哭', 'img-char/yu-cry.webp', '#87ceeb', null, '小宇');
vn.registerChar('妈妈', 'img-char/mom.webp', '#ffa500', null, '妈妈');
vn.registerChar('阿婆', 'img-char/granny.webp', '#b8860b', null, '阿婆');
vn.registerChar('小猫', 'img-char/cat.webp', '#ff8c00', null, '小猫');
// 以后加新角色示例：
// vn.registerChar('小菲少女', 'img-char/小菲少女-笑.webp', '#ff69b4', 30, '小菲');
// vn.registerChar('妈妈中年', 'img-char/妈妈-中年.webp', '#ffa500', 40, '妈妈');
// vn.registerChar('爸爸', 'img-char/爸爸.webp', '#4682b4', null, '爸爸');

// =============================================
// 音效注册表 —— 加新音效只需在这里加一行
// =============================================
vn.registerSfx('item', 'music/item.mp3');
// 以后加新音效示例：
// vn.registerSfx('door', 'music/开门.mp3');
// vn.registerSfx('cry', 'music/哭泣.mp3');
// vn.registerSfx('laugh', 'music/笑声.mp3');

// =============================================
// 剧本 —— 颜色已由注册表管理，不用重复写
// =============================================

const STORY_MOVE = [
    { type: 'dialog', speaker: '', text: '搬家那天，菲趴在卡车的车窗上往外看。' },
    { type: 'dialog', speaker: '', text: '小巷越来越远，越来越小。' },
    { type: 'char', name: '小菲', src: 'img-char/fei-cry.webp' },
    { type: 'dialog', speaker: '', text: '她好像看到小宇站在楼下，又好像没有。' },
    { type: 'dialog', speaker: '', text: '她想挥手，可是车子已经转过了街角。' },
    { type: 'dialog', speaker: '小宇哭', text: '......再见了，小菲。' },
    { type: 'clearChar' },
    { type: 'dialog', speaker: '', text: '......' },
    { type: 'dialog', speaker: '', text: '后来菲才知道，' },
    { type: 'dialog', speaker: '', text: '有些人，走着走着就散了。' },
    { type: 'dialog', speaker: '', text: '连一句再见，都没来得及说。' },
    { type: 'chapter', title: '第一章 · 完', subtitle: '' },
    { type: 'starScene', lines: [
        { text: '那些回不去的时光', y: 180, size: 26 },
        { text: '都变成了星星', y: 260, size: 26 },
        { text: '照亮我们前行的路', y: 340, size: 26 },
        { text: '', y: 420, size: 18 },
        { text: '【未完待续...】', y: 480, size: 18 },
    ]},
];

const STORY_AFTER_PLAY = [
    { type: 'dialog', speaker: '', text: '那年的夏天特别长，长到小菲以为日子会一直这样过下去。' },
    { type: 'dialog', speaker: '小宇', text: '小菲，这个送给你。' },
    { type: 'dialog', speaker: '', text: '小宇从口袋里掏出一颗蓝色的弹珠，像大海的颜色。' },
    { type: 'dialog', speaker: '小宇', text: '这是我最喜欢的弹珠，送给你。这样你就能一直记得我了。' },
    { type: 'dialog', speaker: '小菲', text: '傻瓜，我们又不会分开，干嘛要记得。' },
    { type: 'dialog', speaker: '', text: '小菲笑着接过弹珠，小心地放进口袋里。' },
    { type: 'item', name: '弹珠', icon: '🔵', desc: '一颗蓝色的弹珠，像大海的颜色', from: '小宇赠送' },
    { type: 'dialog', speaker: '', text: '她不知道，这颗弹珠会成为最珍贵的回忆。' },
    { type: 'chapter', title: '第一章 第二幕', subtitle: '说不出口的再见' },
    { type: 'bg', src: 'img-bg/ch1/moving.webp' },
    { type: 'dialog', speaker: '', text: '那是2003年的秋天。' },
    { type: 'dialog', speaker: '', text: '小菲发现家里多了很多纸箱，妈妈在忙着收拾东西。' },
    { type: 'dialog', speaker: '小菲哭', text: '妈妈，我们在干什么呀？' },
    { type: 'dialog', speaker: '妈妈', text: '我们要搬家了，搬到新房子去。' },
    { type: 'dialog', speaker: '小菲哭', text: '新房子在哪里？小宇也去吗？' },
    { type: 'dialog', speaker: '妈妈', text: '...小宇不去，他住在这里。' },
    { type: 'choice', options: [
        { text: '那我不走！我要跟小宇玩！', script: [
            { type: 'dialog', speaker: '小菲哭', text: '那我不走！我要跟小宇玩！' },
            { type: 'dialog', speaker: '妈妈', text: '菲菲乖，以后还可以回来找他玩的。' },
            { type: 'dialog', speaker: '', text: '小菲不知道，大人们说的"以后"，有时候就是永远。' },
            ...STORY_MOVE
        ]},
        { text: '...好吧。（沉默）', script: [
            { type: 'dialog', speaker: '小菲哭', text: '...' },
            { type: 'dialog', speaker: '', text: '小菲没有说话，只是默默地低下了头。' },
            { type: 'dialog', speaker: '', text: '她想去找小宇告别，可是不知道该怎么开口。' },
            ...STORY_MOVE
        ]}
    ]}
];

const STORY = {
    intro: [
        { type: 'bg', src: 'img-bg/ch1/hospital.webp', fade: 600 },
        { type: 'dialog', speaker: '', text: '1999年的夏天，一个小女孩来到了这个世界。' },
        { type: 'dialog', speaker: '', text: '她的名字叫小菲。因为计划生育，家里只有她一个孩子。' },
        { type: 'dialog', speaker: '', text: '没有兄弟姐妹的童年，却并不孤单。' },
        { type: 'chapter', title: '第一章', subtitle: '隔壁的夏天' },
        { type: 'bg', src: 'img-bg/ch1/alley.webp', fade: 600 },
        { type: 'dialog', speaker: '小菲', text: '小宇！出来玩呀！今天天气好好！' },
        { type: 'dialog', speaker: '小宇', text: '来啦来啦！今天玩什么？' },
        { type: 'dialog', speaker: '', text: '老城区的小巷子里，住着小菲和邻居家的小男孩——小宇。' },
        { type: 'dialog', speaker: '', text: '因为计划生育，家里只有小菲一个孩子。但有小宇在，她从不觉得孤单。' },
        { type: 'choice', options: [
            { text: '捉迷藏吧！我最喜欢捉迷藏了！', script: [
                { type: 'dialog', speaker: '小菲', text: '捉迷藏吧！我最喜欢捉迷藏了！' },
                { type: 'dialog', speaker: '小宇', text: '好！你来找，我去藏！' },
                { type: 'dialog', speaker: '', text: '（小游戏：三轮递进捉迷藏！第1轮有提示，第2轮有干扰，第3轮小宇会跑！用 WASD / 方向键移动，靠近小宇就能找到他！）' },
                { type: 'minigame', name: 'hideAndSeek', flag: 'hideSeek',
                  data: { girl: 'img-char/fei-smile.webp', boy: 'img-char/yu-smile.webp' } },
                { type: 'ifFlag', key: 'hideSeek', value: 'found',
                  then: [
                      { type: 'dialog', speaker: '小菲', text: '哈哈，三轮都找到你啦！' },
                      { type: 'dialog', speaker: '小宇', text: '你太厉害了...我藏得那么好都被你找到！' },
                  ],
                  else: [
                      { type: 'ifFlag', key: 'hideSeek', value: 'partial',
                        then: [
                            { type: 'dialog', speaker: '小菲', text: '找到你两轮了！有一轮被你跑掉了！' },
                            { type: 'dialog', speaker: '小宇', text: '嘿嘿，有一轮你没找到我吧！' },
                        ],
                        else: [
                            { type: 'dialog', speaker: '小宇', text: '哈哈，好多轮你都没找到我！' },
                            { type: 'dialog', speaker: '小菲哭', text: '哼...下次我一定能全部找到你！' },
                        ]
                      }
                  ]
                },
                ...STORY_AFTER_PLAY
            ]},
            { text: '跳房子！看谁跳得远！', script: [
                { type: 'dialog', speaker: '小菲', text: '跳房子！看谁跳得远！' },
                { type: 'dialog', speaker: '小宇', text: '来就来，我可不怕你！' },
                { type: 'dialog', speaker: '', text: '（小游戏：记住亮起的格子，2秒后熄灭，然后按对应数字键！每局10秒，6关，得60分以上小菲赢！）' },
                { type: 'minigame', name: 'hopscotch', flag: 'hopscotch',
                  data: { girl: 'img-char/fei-smile.webp', boy: 'img-char/yu-smile.webp' } },
                { type: 'ifFlag', key: 'hopscotch', value: 'success',
                  then: [
                      { type: 'dialog', speaker: '小菲', text: '哈哈，我赢了！' },
                      { type: 'dialog', speaker: '小宇', text: '哼，下次我一定赢你！' },
                  ],
                  else: [
                      { type: 'dialog', speaker: '小宇', text: '哈哈，我赢了！你不行啊！' },
                      { type: 'dialog', speaker: '小菲哭', text: '呜...下次我一定赢你！' },
                  ]
                },
                ...STORY_AFTER_PLAY
            ]}
        ]}
    ]
};

window.addEventListener('load', () => {
    console.log('页面加载完成');
    
    vn.bg.src = 'img-bg/ch1/title-bg.webp';
    vn.bg.style.filter = 'brightness(1.3)';
    vn.textBox.style.display = 'none';
    
    vn.chapterTitle.style.display = 'flex';
    vn.chapterTitle.querySelector('h2').textContent = '菲的心事';
    vn.chapterTitle.querySelector('p').textContent = '点击任意处开始';
    
    console.log('标题已显示');
    
    const startGame = () => {
        document.removeEventListener('click', startGame);
        vn.chapterTitle.style.display = 'none';
        vn.playBgm('music/bgm.mp3');
        vn.runScript(STORY.intro);
    };
    document.addEventListener('click', startGame);
});
