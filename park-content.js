(function () {
  'use strict';

  /* ============================================================
     洛颖的主题乐园 · 内容层
     结构沿用 Idea Wonderpark（anonymous public demo），
     内容全部重写为刘洛颖的个人版本，支持中英双语（?lang=zh / en）。
     ============================================================ */

  const qs = new URLSearchParams(location.search);
  const LANG = qs.get('lang') === 'en' ? 'en' : 'zh';
  window.PARK_LANG = LANG;

  window.parkSetLang = function (l) {
    const u = new URL(location.href);
    u.searchParams.set('lang', l === 'en' ? 'en' : 'zh');
    location.href = u.toString();
  };

  const PARK_NAME = LANG === 'zh' ? '洛颖的主题乐园' : 'Luoying’s Theme Park';

  /* ---------- 静态界面文案（DOM chrome） ---------- */
  function setText(sel, txt) { const el = document.querySelector(sel); if (el) el.textContent = txt; }
  function setHTML(sel, txt) { const el = document.querySelector(sel); if (el) el.innerHTML = txt; }

  function applyDom() {
    document.documentElement.lang = LANG === 'zh' ? 'zh-CN' : 'en';
    document.title = LANG === 'zh'
      ? '洛颖的主题乐园 · Luoying’s Theme Park'
      : 'Luoying’s Theme Park · 洛颖的主题乐园';

    setText('.parkmark .n', PARK_NAME);
    setText('.parkmark .sub', LANG === 'zh' ? '刘洛颖 · 用内容造梦，用 AI 让梦更快成真' : 'Liu Luoying · I dream in content, and let AI bring it true');

    setText('#sw-day .lbl', LANG === 'zh' ? '白昼' : 'Day');
    setText('#sw-sunset .lbl', LANG === 'zh' ? '黄昏' : 'Sunset');
    setText('#sw-night .lbl', LANG === 'zh' ? '夜晚' : 'Night');
    setText('#btn-lights .lbl', LANG === 'zh' ? '灯光' : 'Lights');
    setText('#btn-sound .lbl', LANG === 'zh' ? '声音' : 'Sound');
    setText('#btn-map .lbl', LANG === 'zh' ? '地图' : 'Map');
    setText('#btn-tools .lbl', LANG === 'zh' ? '场景' : 'Scene');

    setText('#mapcard h4', LANG === 'zh' ? '园区地图' : 'Park Plan');
    setText('#mapcard .fine', LANG === 'zh' ? '十二个目的地 · 一座个人奇想乐园' : 'Twelve destinations · one personal wonderpark');
    setHTML('#mapcard .legend', LANG === 'zh'
      ? '<b>拖拽</b>环视 · <b>滚轮</b>推近<br/><b>点击</b>亮起的东西 · 或在下方选一个目的地。'
      : '<b>Drag</b> to look around · <b>Scroll</b> to lean in<br/><b>Click</b> anything lit · or choose a destination below.');
    const mapLabels = {
      'Start here': '从这里开始', 'Experience': '经历', 'Projects': '项目',
      'AI Lab': 'AI 实验室', 'Learning': '学习花园', 'Footprints': '足迹',
      'Photography': '摄影', 'Skills': '技能', 'Proof': '成果',
      'Interests': '生活之外', 'Now': '正在发生', 'Ask Dolly': '问 Dolly',
      'About this demo': '关于这座乐园'
    };
    document.querySelectorAll('#mapcard .map-links .plan-hit').forEach(b => {
      if (LANG === 'zh' && mapLabels[b.textContent.trim()]) b.textContent = mapLabels[b.textContent.trim()];
    });
    if (LANG === 'zh') {
      const svgMap = { 'GATE': '入口', 'FERRIS WHEEL': '摩天轮', 'COASTER': '过山车', 'IDEA CIRCUS': '创意马戏团', 'DOLLY': 'DOLLY', 'POND': '池塘' };
      document.querySelectorAll('#mapcard svg text').forEach(t => {
        const k = t.textContent.trim();
        if (svgMap[k]) t.textContent = svgMap[k];
      });
    }

    setText('#hint', LANG === 'zh' ? '拖拽环视 · 点击让你眼前一亮的东西' : 'Drag to look around · click what catches your eye');

    setText('#titlecard .l1', LANG === 'zh' ? '欢迎来到' : 'Welcome to');
    setText('#titlecard .l2', PARK_NAME);

    setText('#intro .one', LANG === 'zh' ? '凭票入园' : 'Admit One');
    setText('#intro .wp', PARK_NAME);
    setText('#intro .tag', LANG === 'zh' ? '用内容造梦，用 AI 让梦更快成真' : 'I dream in content, and let AI bring it true, faster');
    setText('#intro .no span:last-child', LANG === 'zh' ? '永久有效' : 'Valid Always');
    setText('#intro .enter', LANG === 'zh' ? '进 园' : 'Enter the Park');
    setText('#skip', LANG === 'zh' ? '跳过开场' : 'Skip intro');

    setText('#loading .stitle', PARK_NAME);
    setText('#loading .ssub', LANG === 'zh' ? '正在印票…' : 'Printing your ticket…');
    setText('#loading .srow span:first-child', LANG === 'zh' ? '凭票入园' : 'Admit One');
    setText('#loading .perf span:first-child', LANG === 'zh' ? 'A 门 · 风雨无阻' : 'Gate A · Any Weather');
    setText('#loading .perf span:last-child', LANG === 'zh' ? '永久有效' : 'Valid Always');

    const dollyKickers = document.querySelectorAll('#dolly .kicker span');
    if (dollyKickers[0]) dollyKickers[0].textContent = LANG === 'zh' ? '咨询处' : 'Information';
    if (dollyKickers[1]) dollyKickers[1].textContent = LANG === 'zh' ? '1 号亭' : 'Booth No. 1';
    setText('#dolly .name', LANG === 'zh' ? '问问 Dolly' : 'Ask Dolly');
    setText('#dolly .foot', LANG === 'zh' ? '乐园的小小向导' : 'A small guide to the park');

    setText('#lightbox .lb-x', LANG === 'zh' ? '✕ 关闭' : '✕ Close');
    setText('#lightbox [data-lb-prev]', LANG === 'zh' ? '‹ 上一张' : '‹ Previous');
    setText('#lightbox [data-lb-next]', LANG === 'zh' ? '下一张 ›' : 'Next ›');
    setText('#lightbox .lb-hint', LANG === 'zh' ? '← → 浏览 · Esc 关闭' : '← → to browse · Esc to close');
    setHTML('#lightbox .lb-cap .kicker', LANG === 'zh' ? '美术馆 · 展签' : 'The Gallery · exhibition print');
    const lbMeta = document.querySelector('#lightbox .metarow span:last-child');
    if (lbMeta) lbMeta.textContent = LANG === 'zh' ? '图片待替换' : 'placeholder images';

    setText('#fallback h1', PARK_NAME);
    setText('#fallback p', LANG === 'zh'
      ? '这座乐园用 WebGL 建成，你的浏览器没能打开大门。试试较新的桌面版 Chrome、Safari 或 Firefox，并开启硬件加速--乐园值得跑一趟。'
      : 'This park is built with WebGL, and your browser could not open the gate. Try a recent desktop Chrome, Safari or Firefox with hardware acceleration enabled - the park is worth the trip.');

    /* 语言切换按钮 */
    const bank = document.querySelectorAll('#hud-right .switchbank')[1];
    if (bank && !document.getElementById('btn-lang')) {
      const b = document.createElement('button');
      b.className = 'sw keep-lbl';
      b.id = 'btn-lang';
      b.title = 'Language / 语言';
      b.innerHTML = '<span class="g" style="font-weight:600;letter-spacing:.5px">' + (LANG === 'zh' ? 'EN' : '中') + '</span>'
        + '<span class="lbl">' + (LANG === 'zh' ? 'EN' : '中文') + '</span>';
      b.onclick = () => window.parkSetLang(LANG === 'zh' ? 'en' : 'zh');
      bank.appendChild(b);
    }
  }
  applyDom();

  /* ---------- 印票步骤 ---------- */
  window.PARK_LOADSTEPS = LANG === 'zh'
    ? ['升起大门', '铺好小径', '种下树木', '上紧旋转木马', '挂起灯串', '测试过山车', '唤醒摩天轮', '打扫园中小径']
    : ['Raising the gate', 'Laying the paths', 'Planting the trees', 'Winding the carousel', 'Hanging the lamps', 'Testing the coaster', 'Waking the ferris wheel', 'Sweeping the midway'];
  window.PARK_STUB_DONE = LANG === 'zh' ? '祝你逛得开心' : 'Enjoy the park';

  /* ---------- Dolly 对话剧本 ---------- */
  window.PARK_DOLLY = LANG === 'zh'
    ? { root: [
        { q: '我只有 3 分钟。', a: '那这样：坐摩天轮看五段实习经历，再坐过山车看几个项目。AI 建造工坊里有这些作品背后的方法与证据。', go: 'ferris',
          next: ['看看我做过什么。', '看看我的方法。', '这个乐园是怎么做的？'] },
        { q: '看看我做过什么。', a: '项目过山车上有四个项目：三维星际简历、这座乐园本身、HR × AI 工作流，还有作品部署链路。', go: 'coaster',
          next: ['看看我的方法。', '地球仪是什么？', '我只有 3 分钟。'] },
        { q: '看看我的方法。', a: 'AI 建造工坊把灵感、施工和出厂证据放在一起，也保留动手中学、让 AI 当思考对手等方法笔记。', go: 'garden',
          next: ['看看我做过什么。', '看看 AI 实验室。', '这个乐园是怎么做的？'] },
        { q: '地球仪是什么？', a: '韩国交换站集中保存这段交换生活：语言与朋友、第一次尝试、咖啡、五个地区 Solo Trip 和食堂吐槽。', go: 'globe',
          next: ['看看照片。', '看看我做过什么。', '我只有 3 分钟。'] },
        { q: '看看 AI 实验室。', a: 'AI 建造工坊的实验档案里有生成式视觉练习和 AI 产品点子。', go: 'circus',
          next: ['看看我的方法。', '看看照片。', '我只有 3 分钟。'] },
        { q: '看看照片。', a: '美术馆挂着十四张照片。目前是占位图，等真正的照片冲好就换上。', go: 'gallery',
          next: ['地球仪是什么？', '看看我做过什么。', '这个乐园是怎么做的？'] },
        { q: '这个乐园是怎么做的？', a: '结构致敬一个开源的匿名作品集 Idea Wonderpark；内容层全部重写为主人的真实经历，并做了中英双语改造。整站单文件、零构建，由 AI 协助搭建。', go: 'gate',
          next: ['看看我做过什么。', '看看我的方法。', '我只有 3 分钟。'] }
      ] }
    : { root: [
        { q: 'I only have 3 minutes.', a: 'Take the Ferris Wheel for five internships, then the Project Coaster for a few projects. The AI Making Workshop keeps the methods and evidence behind the work.', go: 'ferris',
          next: ['Show me the work.', 'Show me the methods.', 'How was this park made?'] },
        { q: 'Show me the work.', a: 'The Project Coaster holds four projects: a 3D interactive resume, this park itself, an HR × AI workflow, and a deployment toolchain.', go: 'coaster',
          next: ['Show me the methods.', 'What is the globe showing?', 'I only have 3 minutes.'] },
        { q: 'Show me the methods.', a: 'The AI Making Workshop brings sparks, building and dispatch evidence together, alongside methods such as learning by doing and AI as a thinking opponent.', go: 'garden',
          next: ['Show me the work.', 'Show me the AI Lab.', 'How was this park made?'] },
        { q: 'What is the globe showing?', a: 'The Korea Exchange Station keeps the whole chapter together: language, first attempts, coffee, five solo-trip areas and the cafeteria complaint desk.', go: 'globe',
          next: ['Show me the photographs.', 'Show me the work.', 'I only have 3 minutes.'] },
        { q: 'Show me the AI Lab.', a: 'The AI Making Workshop archive keeps generative visual studies and AI product ideas.', go: 'circus',
          next: ['Show me the methods.', 'Show me the photographs.', 'I only have 3 minutes.'] },
        { q: 'Show me the photographs.', a: 'The Gallery hangs fourteen photographs. They are placeholders until the real prints are ready.', go: 'gallery',
          next: ['What is the globe showing?', 'Show me the work.', 'How was this park made?'] },
        { q: 'How was this park made?', a: 'The structure honors an open-source anonymous portfolio called Idea Wonderpark; the content layer was fully rewritten with real stories and made bilingual. One file, no build, built with AI.', go: 'gate',
          next: ['Show me the work.', 'Show me the methods.', 'I only have 3 minutes.'] }
      ] };

  /* ============================================================
     内容主体（按语言构建）
     ============================================================ */
  const C = LANG === 'zh' ? {
    profile: {
      name: '刘洛颖',
      role: '中国传媒大学 · 汉语言 · 本科在读',
      intro: '这是一个造梦世界——我用内容造梦，用 AI 让梦更快成真。',
      story: '这里收录我做过的事、相信的方法，和还在学的东西。四年汉语言的训练，让我习惯在语言里找结构；这些年从内容、教育走到人力与 AI，我更想把对人的理解，做成可以运转的东西。',
      locations: ['北京', '福建']
    },
    timeline: [
      { year: '实习', title: '少年得到 · 企业文化实习', kind: '企业文化 · 活动策划', role: '活动全案策划 · 视觉物料 · 数据复盘', text: '独立策划千人级线上线下活动，从流程、预算到人员分工一手搭建，并用 Canva/PS 完成全套视觉物料；活动后沉淀成可复用的执行 SOP。', note: '好的活动是设计出来的，不是临场撑出来的。' },
      { year: '实习', title: '洋葱学园 · 媒介实习', kind: '媒介投放 · 达人运营', role: '达人挖掘 · 达人库搭建 · 投放复盘', text: '在抖音、小红书、B 站筛选教育垂类达人，搭建标准化达人资源库；统筹合作全流程，把控内容质量与品牌露出，整理投放报表支撑复盘。', note: '把一次性的合作，变成可复用的资源库。' },
      { year: '实习', title: '凤凰网 · 商业项目实习', kind: '内容传播 · 项目统筹', role: '站内传播排期 · 宣传文案 · 跨部门协同', text: '独立负责 S 级商业访谈节目《君品谈》第五季的站内整体传播：排期、文案、资源位与上线测试，联动采编、视频、首页与商务多方对齐，保障整季按时上线。', note: '在真实的发布节奏里，要快、要准、对读者诚实。' },
      { year: '实习', title: '北京环球度假区 · HRBP 实习', kind: '人力资源 · HRBP', role: '人力全流程 · 绩效落地 · 人力报表', text: '对接多个业务部门，支撑入离职、编制盘点与绩效全流程，用 Excel 汇总输出标准化人力月报与年报，并配合落地企业文化与员工关怀活动。', note: '规则保证底线，人的温度决定体验。' },
      { year: '现在', title: '小红书 · 文化与人才发展实习', kind: '人才发展 · 企业文化 · AI 提效', role: '人才项目运营 · 员工体验 · AI 结对开发', text: '支持技术校招营期运营、科技新秀奖寄送与游学文化内容生产；同时用 AI 结对开发把重复流程自动化、把活动做成工具--从"做项目"走到"搭流程"。', note: '这座乐园，就是用 AI 做出来的。' }
    ],
    projects: [
      {
        slug: 'voyage', title: 'Voyage · 三维星际简历',
        oneLiner: '用 Three.js 做的交互式 3D 简历：把个人经历放进一个可以拖拽环视的星际空间。',
        role: '概念 · 交互 · 全部搭建', time: '个人项目 · 持续迭代',
        outcome: '验证了一件事：个人叙事可以被做成空间，而不是一页纸。电影开场、五星域、点击即达的细节面板。',
        coverImage: 'assets/projects/luoying-cover.png',
        tags: ['Three.js', '交互叙事', '个人项目'], links: {}
      },
      {
        slug: 'wonderpark', title: '洛颖的主题乐园 · 本站',
        oneLiner: '你现在所在的这座 3D 作品集：以一座游乐园的结构，收纳经历、项目、方法与足迹。',
        role: '结构复刻 · 内容重建 · 双语化', time: '2026 · 进行中',
        outcome: '对开源结构做内容层重建与中英双语改造，保持单文件、零构建的部署方式--你现在就在项目里。',
        coverImage: 'assets/projects/luoying-cover.png',
        tags: ['作品集', '双语', '3D'], links: {}
      },
      {
        slug: 'hr-ai', title: 'HR × AI 工作流',
        oneLiner: '在 HR 日常里引入 AI 助手：知识检索、制度问答、材料起草与流程自动化。',
        role: '场景设计 · 提示词 · 验证', time: '2026 · 现在',
        outcome: '让重复性事务交给助手，把时间留给需要判断的部分--并验证哪些环节真的被省下来了。',
        coverImage: 'assets/projects/luoying-cover.png',
        tags: ['AI 工作流', '人力资源', '效率'], links: {}
      },
      {
        slug: 'cowork', title: 'Cowork 作品集 · 部署链路',
        oneLiner: '一组静态小作品的发布体系：压缩、内联、CDN 固定地址与版本覆盖。',
        role: '工程化 · 部署', time: '2026',
        outcome: '多资源站点的部署踩坑记录：GLB 压缩、IIFE 内联与缓存策略，让每个作品都有一个稳定可访问的家。',
        coverImage: 'assets/projects/luoying-cover.png',
        tags: ['部署', 'CDN', '工程化'], links: {}
      }
    ],
    learning: {
      prompts: [
        { title: '第一性原理的作品自检', useCase: '在动手之前把想法压一遍', fullContent: '问这个想法替代了什么行为、它会在哪里断掉、什么早期证据能证明它错了。' },
        { title: '做完之后的复盘', useCase: '从一个原型里榨出可迁移的教训', fullContent: '分清做了什么、哪个假设错了、什么让人意外、下次改什么。' }
      ],
      methods: [
        { title: '动手中学', kind: '方法 · Method', appliesTo: '新工具、陌生领域、产品直觉', summary: '选一个真问题，做最小的学习载体，观察哪里坏掉，把教训带走。' },
        { title: '让 AI 当思考对手', kind: '方法 · Method', appliesTo: '研究综合与不确定的决策', summary: '让 AI 反驳你的立场、举反例、比视角--而不是帮你把答案磨得更光滑。' }
      ],
      notes: [
        { title: '自我验证的陷阱', kind: '随手记 · Working note', source: '工作笔记', summary: '更流畅的复述容易被当成新洞察。结构化的反对意见，才能区分"顺"和"对"。' },
        { title: '品味的瓶颈', kind: '随手记 · Working note', source: '工作笔记', summary: '当执行越来越便宜，判断什么值得做，就成了更贵的能力。' }
      ],
      readings: [
        { title: '经验与学习', author: '读书笔记', summary: '复杂的技能在行动、反思、再行动的循环里长出来。' },
        { title: '技术与共同演化', author: '读书笔记', summary: '工具不只服务人；重复使用会重塑人注意、决定和创造的方式。' }
      ],
      tools: []
    },
    workshop: {
      title: 'AI 建造工坊',
      intro: '这里不单独陈列"会什么"，而是展示一个想法如何经过观察、试做、推翻和验证，最后成为可以使用的东西。',
      zones: [
        { id: 'spark', title: '灵感台', subtitle: '先收集值得解决的问题', text: '问题、提示词、观察和奇怪但值得尝试的念头都先留在这里。重点不是立刻得到答案，而是把问题问得更准确。' },
        { id: 'bench', title: '施工台', subtitle: '让想法经历真实摩擦', text: '草图、工作流、失败版本与 AI 对话会在这里反复拆装。每次推翻都要留下理由，而不是只保留看起来顺利的结果。' },
        { id: 'dispatch', title: '出厂区', subtitle: '只保留能够运行的证据', text: '上线作品、性能变化、使用反馈和可复用模板从这里离开工坊。技能不再做成清单，而由这些结果自己说明。' }
      ]
    },
    futureExit: {
      title: '未来出口站',
      intro: '乐园在这里暂时结束，但"正在进行"不会被包装成已经完成。站台上的目的地，是我接下来愿意继续投入时间的方向。',
      departures: [
        ['人与组织', '继续寻找更适合自己的 HR、人才发展与组织场景。'],
        ['AI 与工作', '继续研究 AI 如何进入真实工作流，而不只是停在一次演示。'],
        ['空间叙事', '继续把个人经历、内容与交互做成可以进入的空间。'],
        ['第一次徒步', '把旋转木马里仍在施工的愿望，真正变成一次出发。']
      ],
      ticket: '今日看见：一个从语言出发，走向人与组织，并不断用 AI 把想法做出来的人。'
    },
    aiLab: {
      gallery: [
        { title: '小行星文明', model: '生成式视觉练习', goal: '宇宙尺度下的温柔。', prompt: '一颗悬浮在寂静太空里的小小世界，上面住着人。', image: 'assets/ai-lab/asteroid-civilization.webp', thumbnail: 'assets/ai-lab/asteroid-civilization.webp' },
        { title: '石头里的咖啡馆', model: '生成式视觉练习', goal: '藏在平凡里的暖。', prompt: '一座凿进巨石的小咖啡馆，暖光对着 muted 的风景。', image: 'assets/ai-lab/stone-cafe.webp', thumbnail: 'assets/ai-lab/stone-cafe.webp' },
        { title: '鲸骨图书馆', model: '生成式视觉练习', goal: '用记忆搭出的阅读空间。', prompt: '一座藏在巨大有机结构下的安静图书馆，柔光与纸的纹理。', image: 'assets/ai-lab/whale-library.webp', thumbnail: 'assets/ai-lab/whale-library.webp' },
        { title: '云上的房子', model: '生成式视觉练习', goal: '轻盈的家，安在沉重的世界上。', prompt: '一座停在云上的小房子，克制的颜色，大量留白，手工感。', image: 'assets/ai-lab/cloud-house.webp', thumbnail: 'assets/ai-lab/cloud-house.webp' }
      ],
      ideas: [
        { title: '员工旅程的渐进式披露', content: '先给新人三件能上手的事，再随信心增长逐步开放更复杂的信息与权限。', tags: ['HR', '入职'] },
        { title: '给 AI 操作加撤销', content: '可逆的步骤先预览，不可逆的操作必须确认--对 AI 助手和人，都一样。', tags: ['Agent', '安全'] },
        { title: '把确定性做成界面材料', content: '让"确定程度"改变呈现方式：直接回答、给出选项，或坦白说不知道。', tags: ['信任', 'UX'] },
        { title: '对话即线框', content: '在画界面之前，先用一段对话把流程和结构走通。', tags: ['原型', '流程'] }
      ]
    },
    buildingNow: [
      { name: '人才发展 AI 助手', kind: '人才发展 · 进行中', sign: 'BUILDING', text: 'seal + hi work + ChatGPT，是我最优秀的三个实习生——把项目运营、活动流程和常见答疑，交给它们做成可复用、能自助的工具。', note: '内部使用中。' },
      { name: '游学内容流水线', kind: '内容生产 · 迭代中', sign: 'WORKFLOW', text: '主题四件套的模板化生产线：新主题按表填充，一次成型。', note: '模板持续演进。' },
      { name: '本站 · 主题乐园', kind: '交互作品集 · 进行中', sign: 'IN ITERATION', text: '你现在逛的这座乐园：内容层重建与中英双语化进行中。', note: '欢迎常来。' },
      { name: 'Three.js 练习场', kind: '视觉实验 · 持续', sign: 'LAB', text: '小场景、粒子、相机运动--为下一个更大的空间叙事攒手感。', note: '作品陆续上架。' }
    ],
    travel: {
      countries: ['中国', '韩国'],
      cities: [
        { id: 'beijing', name: '北京', country: '中国', lat: 39.9, lon: 116.4 },
        { id: 'shanghai', name: '上海', country: '中国', lat: 31.2, lon: 121.5 },
        { id: 'hangzhou', name: '杭州', country: '中国', lat: 30.3, lon: 120.2 },
        { id: 'chengdu', name: '成都', country: '中国', lat: 30.6, lon: 104.1 },
        { id: 'guangzhou', name: '广州', country: '中国', lat: 23.1, lon: 113.3 },
        { id: 'xian', name: '西安', country: '中国', lat: 34.3, lon: 108.9 },
        { id: 'changsha', name: '长沙', country: '中国', lat: 28.2, lon: 113.0 },
        { id: 'dali', name: '大理', country: '中国', lat: 25.7, lon: 100.2 },
        {
          id: 'korea-exchange', name: '大三韩国交换', country: '韩国', lat: 36.5, lon: 127.8,
          feature: {
            eyebrow: '交换生活 · 压力值 50%',
            intro: '我没有把交换过成另一张成绩单，而是给自己一段可以随意探索、允许踩雷、也能独自出发的时间。',
            chapters: [
              ['语言与朋友', '学韩语，也和来自不同国家的同学交流。语言不够流利的时候，表情、手势和一起吃饭也能完成沟通。'],
              ['第一次尝试', '第一次上高尔夫和网球课。并没有立刻成为运动达人，但很喜欢身体重新学习一件事时那种笨拙又具体的感觉。'],
              ['咖啡探索', '认真探索韩国咖啡，也认真接受"看起来很美、喝起来很甜"的随机考验。踩雷逐渐成了旅行的一部分。'],
              ['五个地区 Solo Trip', '一个人探索五个地区：自己决定方向、错过车、改路线，也慢慢确认独处不等于无聊。具体地点会随着照片继续补进来。'],
              ['食堂吐槽大会', '韩国食堂是这段交换生活里稳定出现的反派角色。持续吐槽，也持续去吃，最后反而成了最容易想起的日常。']
            ],
            takeaway: '放松不是停滞，而是重新让好奇心接管生活。'
          }
        }
      ],
      routes: [
        ['beijing', 'shanghai'], ['beijing', 'xian'], ['beijing', 'chengdu'],
        ['shanghai', 'hangzhou'], ['shanghai', 'guangzhou'], ['guangzhou', 'changsha'],
        ['chengdu', 'dali'], ['beijing', 'korea-exchange']
      ],
      summary: '一张示意性的足迹图——城市先占位，等确认后就是真实的旅行记录',
      moreLink: { label: '想看完整的世界足迹？跟我去另一张地图 →', href: 'https://cowork.xiaohongshu.com/s/world-footprint/' }
    },
    photos: [
      ['01', '室内光'], ['02', '夜之纪念碑'], ['03', '作家纪念牌'], ['04', '蓝色渡口'],
      ['05', '彩色光'], ['06', '冬日旋转木马'], ['07', '舷窗研究'], ['08', '冬日暖阳'],
      ['09', '美术馆的人群'], ['10', '海岸清晨'], ['11', '街角路牌'], ['12', '开阔水域'],
      ['13', '吊灯研究'], ['14', '夜的风景']
    ].map(([n, t]) => ({
      id: `photo-${n}`, title: t,
      src: `assets/travel/photo-${n}.webp`, thumb: `assets/travel/photo-${n}-thumb.webp`,
      alt: `${t}（占位图）`, caption: '占位图片--等我把自己的照片冲出来就换上。',
      location: '待替换', cityId: undefined
    })),
    skills: [
      { name: '人力 · People', items: ['招聘支持', '员工体验', '文化活动', '制度与流程', '人才发展'] },
      { name: 'AI 应用 · AI', items: ['提示词设计', 'AI 工作流', '知识检索', 'miniapp 搭建', '效果验证'] },
      { name: '内容 · Content', items: ['文案写作', '课程与脚本', '选题策划', '跨部门沟通', '中英表达'] },
      { name: '制作 · Build', items: ['Three.js 场景', '静态站部署', 'Python 脚本', '数据整理', '快速原型'] }
    ],
    awards: [
      { title: '可运转的 AI 工作流', meta: '效率的证据', detail: '知识检索、起草与自动化真的进了日常流程，不止停在演示。' },
      { title: '模板化的内容生产', meta: '可复用的证据', detail: '一次性的内容工作被做成模板和清单，新主题可以按表填充。' },
      { title: '空间化的个人叙事', meta: '作品集的证据', detail: '把经历做成可以逛的空间--你现在就在里面。' },
      { title: '跨域的翻译能力', meta: '成长的证据', detail: '在人力、内容与工程之间来回翻译，把一方的语言讲给另一方听。' }
    ],
    interests: [
      {
        id: 'sunrise', icon: '☀', title: '追日出的人',
        hook: '闹钟响的时候怀疑人生，太阳升起来的时候原谅一切。',
        story: '我喜欢早起看日出，也喜欢爬山去看日出。天还没亮就出门、一路犯困或气喘吁吁，都只是前奏。真正看到天空从深蓝变亮、太阳一点点越过地平线时，前面的挣扎会自动变成故事。日出对我来说不是景点，而是一种"今天真的开始了"的仪式。',
        detail: '想收藏：凌晨闹钟、山顶剪影，以及看完日出后的第一顿早餐。'
      },
      {
        id: 'hiking', icon: '△', title: '尚未开始的徒步旅行',
        hook: '第一次真正的徒步旅行还在施工，但已经正式写进人生待办。',
        story: '我喜欢做有挑战的事情，belike 徒步旅行--虽然目前还没有真正实现。吸引我的并不是累计多少公里，而是在一段时间里只处理最简单的问题：往哪里走、在哪里停、今天看到了什么。它现在还是愿望清单里的"建造中项目"，但总有一天会正式开工。',
        detail: '当前状态：🚧 建造中。下一块砖是选一条适合第一次出发的路线。'
      },
      {
        id: 'roommate-live', icon: '◉', title: '我有一个自媒体圣体舍友',
        hook: '和她住在一起，每天都可能旁观一条内容从日常变成镜头。',
        story: '我的舍友拥有某种天然的"自媒体圣体"。她能把普通日常迅速变成镜头前的内容，所以我会参与舞蹈视频制作，也常围观直播准备、设备调试和正式开播。看她工作让我第一次近距离理解：自然的镜头感背后，也有对节奏、互动和观众情绪的持续判断。',
        detail: '宿舍常驻设备：补光灯、手机支架，以及随时可能被征用的背景墙。'
      },
      {
        id: 'outbound', icon: '✈', title: '爱出门，尤其爱出国门',
        hook: '别人旅行先找景点，我更想知道当地人今天怎么过日子。',
        story: '旅行对我来说不是完成打卡，而是进入另一套日常系统：那里的人怎么说话、吃饭、通勤、使用公共空间。比起著名景点，我更喜欢在陌生城市里过几天"当地人的普通生活"，从细节里理解一个地方是怎么运转的。',
        detail: '旅行原则：路线可以临时改，但想去的菜市场、街区和小店会提前标好。'
      },
      {
        id: 'taiwan-food', icon: '🍜', title: '一个很难糊弄的台湾胃',
        hook: '别人先找景点，我通常先研究下一顿吃什么。',
        story: '我尤其喜欢台湾美食。作为福建人，它很多味道都熟悉得很自然，又总有新的东西可以继续探索。吃对我来说是了解一个地方最快的入口--味道里藏着当地人的日常。需要台湾美食攻略的可以直接 call 我，这一部分我愿意认真负责。',
        detail: '台湾美食对福建胃几乎无障碍适配；愿意为一家店特地绕路。'
      }
    ],
    failures: [],
    contact: { email: 'liuluoying@xiaohongshu.com' },
    sourceState: 'personal-edition'
  } : {
    profile: {
      name: 'Liu Luoying',
      role: 'Communication University of China · Chinese Language · Undergraduate',
      intro: 'This is a dream-built world — I dream in content, and let AI bring those dreams true, faster.',
      story: 'It collects what I have made, the methods I trust, and what I am still learning. Four years of Chinese language taught me to find structure in language; from content and education into people and AI, I want to turn an understanding of people into things that actually run.',
      locations: ['Beijing', 'Fujian']
    },
    timeline: [
      { year: 'Internship', title: 'Shaonian Dedao · Culture Intern', kind: 'Culture · Events', role: 'Event planning · visual assets · review', text: 'Independently planned thousand-person online and offline events — flow, budget and staffing — and produced the full set of visuals in Canva/PS, distilling each one into a reusable playbook afterward.', note: 'A good event is designed, not improvised on the day.' },
      { year: 'Internship', title: 'Onion Academy · Media Intern', kind: 'Media buying · Creator ops', role: 'Creator sourcing · creator library · review', text: 'Sourced education-vertical creators across Douyin, Xiaohongshu and Bilibili and built a standardized creator library; ran the full collaboration flow, kept content and brand exposure on-spec, and organized data for review.', note: 'Turn one-off collaborations into a reusable library.' },
      { year: 'Internship', title: 'ifeng.com · Commercial Project Intern', kind: 'Content · Coordination', role: 'On-site scheduling · copy · cross-team', text: 'Owned the on-site distribution of a flagship commercial talk show — scheduling, copy, placements and launch testing — aligning editorial, video, homepage and business teams to keep the whole season on time.', note: 'In a real publishing rhythm: fast, accurate, honest to the reader.' },
      { year: 'Internship', title: 'Universal Beijing Resort · HRBP Intern', kind: 'Human Resources · HRBP', role: 'HR operations · performance · reporting', text: 'Partnered with several business departments on onboarding/offboarding, headcount reviews and the full performance cycle; produced standardized monthly and annual HR reports in Excel and helped run culture and employee-care activities.', note: 'Rules secure the baseline, human warmth makes the experience.' },
      { year: 'Now', title: 'Xiaohongshu · Culture & Talent Development Intern', kind: 'Talent · Culture · AI making', role: 'Program ops · employee experience · AI pairing', text: 'Support campus-recruit program operations, award logistics and study-tour culture content; and pair with AI to automate repetitive flows and turn events into tools — moving from running projects to building the process.', note: 'This park itself was built with AI.' }
    ],
    projects: [
      {
        slug: 'voyage', title: 'Voyage · A 3D Resume in Space',
        oneLiner: 'An interactive 3D resume built with Three.js: a personal story placed inside a navigable starfield.',
        role: 'Concept · interaction · build', time: 'Personal · ongoing',
        outcome: 'Proved that a personal narrative can be a space rather than a page: cinematic opening, five star domains, click-to-open detail panels.',
        coverImage: 'assets/projects/luoying-cover.png',
        tags: ['Three.js', 'Interactive narrative', 'Personal'], links: {}
      },
      {
        slug: 'wonderpark', title: 'Luoying’s Theme Park · This Site',
        oneLiner: 'The 3D portfolio you are walking through: an amusement-park structure holding experience, projects, methods and footprints.',
        role: 'Structure fork · content rewrite · bilingual', time: '2026 · ongoing',
        outcome: 'Rebuilt the content layer of an open-source structure, added a bilingual layer, and kept it single-file with zero build - you are inside the project right now.',
        coverImage: 'assets/projects/luoying-cover.png',
        tags: ['Portfolio', 'Bilingual', '3D'], links: {}
      },
      {
        slug: 'hr-ai', title: 'HR × AI Workflow',
        oneLiner: 'Bringing AI assistants into daily HR work: knowledge retrieval, policy Q&A, drafting and workflow automation.',
        role: 'Scenario design · prompting · validation', time: '2026 · now',
        outcome: 'Give repetitive tasks to the assistant and keep judgment for yourself - then verify which steps actually got faster.',
        coverImage: 'assets/projects/luoying-cover.png',
        tags: ['AI workflow', 'Human resources', 'Efficiency'], links: {}
      },
      {
        slug: 'cowork', title: 'Cowork Portfolio · Deployment Toolchain',
        oneLiner: 'A release system for a set of small static works: compression, inlining, a fixed CDN address and version overwrites.',
        role: 'Engineering · deployment', time: '2026',
        outcome: 'Field notes from deploying multi-asset sites: GLB compression, IIFE inlining and cache strategy - every work gets a stable, reachable home.',
        coverImage: 'assets/projects/luoying-cover.png',
        tags: ['Deployment', 'CDN', 'Engineering'], links: {}
      }
    ],
    learning: {
      prompts: [
        { title: 'First-principles self-critique', useCase: 'Stress-test an idea before building it', fullContent: 'Ask what behavior the idea replaces, where it breaks, and what early evidence would prove it wrong.' },
        { title: 'Post-build reflection', useCase: 'Extract transferable lessons from a prototype', fullContent: 'Separate what was built, which assumption failed, what surprised you, and what changes next time.' }
      ],
      methods: [
        { title: 'Learning by doing', kind: 'Method', appliesTo: 'New tools, unfamiliar domains, product intuition', summary: 'Pick a real problem, ship the smallest learning vehicle, observe what breaks, and take the lesson with you.' },
        { title: 'AI as a thinking opponent', kind: 'Method', appliesTo: 'Research synthesis and uncertain decisions', summary: 'Make AI argue against your position, surface counterexamples, compare perspectives - not merely polish your answer.' }
      ],
      notes: [
        { title: 'The self-validation trap', kind: 'Working note', source: 'Working note', summary: 'A smoother restatement can feel like a new insight. Structured disagreement separates fluency from correctness.' },
        { title: 'The taste bottleneck', kind: 'Working note', source: 'Working note', summary: 'As execution gets cheaper, judging what deserves to exist becomes the expensive capability.' }
      ],
      readings: [
        { title: 'Experience and learning', author: 'Reading note', summary: 'Complex skills grow through action, reflection, and another round of action.' },
        { title: 'Technology and co-evolution', author: 'Reading note', summary: 'Tools do not merely serve people; repeated use reshapes how people notice, decide, and create.' }
      ],
      tools: []
    },
    workshop: {
      title: 'AI Making Workshop',
      intro: 'This space does not list isolated skills. It shows how an idea moves through observation, prototyping, rejection and validation until it becomes something people can actually use.',
      zones: [
        { id: 'spark', title: 'Spark Table', subtitle: 'Collect problems worth solving', text: 'Questions, prompts, observations and strange-but-promising ideas begin here. The goal is not an instant answer, but a sharper question.' },
        { id: 'bench', title: 'Build Bench', subtitle: 'Let the idea meet real friction', text: 'Sketches, workflows, failed versions and conversations with AI are repeatedly taken apart here. Every rejected version should leave behind a reason.' },
        { id: 'dispatch', title: 'Dispatch Bay', subtitle: 'Keep evidence that actually runs', text: 'Live work, performance changes, user feedback and reusable templates leave from here. Skills are shown through results instead of a separate list.' }
      ]
    },
    futureExit: {
      title: 'Future Exit Station',
      intro: 'The park pauses here, but work in progress is not presented as finished. The departures board holds directions I am willing to keep investing in.',
      departures: [
        ['People and organisations', 'Keep looking for the HR, talent and organisation work where I can contribute best.'],
        ['AI and real work', 'Keep exploring how AI enters real workflows rather than stopping at a demonstration.'],
        ['Spatial storytelling', 'Keep turning experience, content and interaction into spaces people can enter.'],
        ['A first real hike', 'Turn the wish still under construction on the carousel into an actual departure.']
      ],
      ticket: 'Seen today: someone who began with language, moved toward people and organisations, and keeps using AI to make ideas real.'
    },
    aiLab: {
      gallery: [
        { title: 'Asteroid Civilization', model: 'Generative visual study', goal: 'Tenderness at cosmic scale.', prompt: 'A tiny inhabited world suspended in a wide field of quiet space.', image: 'assets/ai-lab/asteroid-civilization.webp', thumbnail: 'assets/ai-lab/asteroid-civilization.webp' },
        { title: 'Coffee Shop in a Stone', model: 'Generative visual study', goal: 'Warmth hidden inside the ordinary.', prompt: 'A small café carved into a monumental stone, warm light against a muted landscape.', image: 'assets/ai-lab/stone-cafe.webp', thumbnail: 'assets/ai-lab/stone-cafe.webp' },
        { title: 'Whale-rib Library', model: 'Generative visual study', goal: 'A reading space built from memory.', prompt: 'A quiet library sheltered by an enormous organic structure, soft light and paper textures.', image: 'assets/ai-lab/whale-library.webp', thumbnail: 'assets/ai-lab/whale-library.webp' },
        { title: 'Floating Cloud House', model: 'Generative visual study', goal: 'A light home above a heavy world.', prompt: 'A small house resting on a cloud, restrained color, generous negative space, a hand-made feeling.', image: 'assets/ai-lab/cloud-house.webp', thumbnail: 'assets/ai-lab/cloud-house.webp' }
      ],
      ideas: [
        { title: 'Progressive disclosure for onboarding', content: 'Give a newcomer three things they can do on day one, then unlock richer information as confidence grows.', tags: ['HR', 'Onboarding'] },
        { title: 'Undo for AI actions', content: 'Preview reversible steps; require confirmation before irreversible ones - for AI assistants and for people alike.', tags: ['Agents', 'Safety'] },
        { title: 'Certainty as interface material', content: 'Let confidence change the presentation: a direct answer, options, or an honest “I don’t know”.', tags: ['Trust', 'UX'] },
        { title: 'Conversation as a wireframe', content: 'Walk the flow and structure through dialogue before drawing any screens.', tags: ['Prototype', 'Workflow'] }
      ]
    },
    buildingNow: [
      { name: 'Talent Development AI Assistant', kind: 'Talent development · building', sign: 'BUILDING', text: 'seal + hi work + ChatGPT are my three best interns — I hand them project operations, event flows and common questions, and they turn them into reusable, self-serve tools.', note: 'In internal use.' },
      { name: 'Study-tour content pipeline', kind: 'Content production · iterating', sign: 'WORKFLOW', text: 'The template-driven production line for topic kits: a new topic is a fill-in exercise.', note: 'Templates keep evolving.' },
      { name: 'This park', kind: 'Interactive portfolio · building', sign: 'IN ITERATION', text: 'The park you are walking through: content rewrite and bilingual layer in progress.', note: 'Come back often.' },
      { name: 'Three.js playground', kind: 'Visual experiments · ongoing', sign: 'LAB', text: 'Small scenes, particles, camera moves - building up touch for the next, larger spatial narrative.', note: 'Works landing soon.' }
    ],
    travel: {
      countries: ['China', 'South Korea'],
      cities: [
        { id: 'beijing', name: 'Beijing', country: 'China', lat: 39.9, lon: 116.4 },
        { id: 'shanghai', name: 'Shanghai', country: 'China', lat: 31.2, lon: 121.5 },
        { id: 'hangzhou', name: 'Hangzhou', country: 'China', lat: 30.3, lon: 120.2 },
        { id: 'chengdu', name: 'Chengdu', country: 'China', lat: 30.6, lon: 104.1 },
        { id: 'guangzhou', name: 'Guangzhou', country: 'China', lat: 23.1, lon: 113.3 },
        { id: 'xian', name: 'Xi’an', country: 'China', lat: 34.3, lon: 108.9 },
        { id: 'changsha', name: 'Changsha', country: 'China', lat: 28.2, lon: 113.0 },
        { id: 'dali', name: 'Dali', country: 'China', lat: 25.7, lon: 100.2 },
        {
          id: 'korea-exchange', name: 'Junior-year Exchange in South Korea', country: 'South Korea', lat: 36.5, lon: 127.8,
          feature: {
            eyebrow: 'Exchange life · pressure level 50%',
            intro: 'I did not turn the exchange into another scorecard. I gave myself time to explore, make harmless mistakes and travel alone.',
            chapters: [
              ['Language and friendships', 'I studied Korean and met students from different countries. When words ran short, expressions, gestures and meals together still carried the conversation.'],
              ['First attempts', 'I took golf and tennis classes for the first time. I did not become an athlete overnight, but I loved the awkward, tangible feeling of the body learning something new.'],
              ['Coffee fieldwork', 'I explored Korean cafés seriously, accepting the recurring surprise that beautiful drinks could also be spectacularly sweet.'],
              ['Five-area solo trip', 'I explored five areas alone: choosing directions, missing transport, changing plans, and learning that solitude does not have to mean boredom. The exact stops will be added with photographs.'],
              ['The cafeteria complaint desk', 'The cafeteria became the dependable villain of the exchange. I complained, kept eating there, and somehow made it one of the most memorable parts of daily life.']
            ],
            takeaway: 'Slowing down was not standing still; it gave curiosity room to take over.'
          }
        }
      ],
      routes: [
        ['beijing', 'shanghai'], ['beijing', 'xian'], ['beijing', 'chengdu'],
        ['shanghai', 'hangzhou'], ['shanghai', 'guangzhou'], ['guangzhou', 'changsha'],
        ['chengdu', 'dali'], ['beijing', 'korea-exchange']
      ],
      summary: 'An illustrative footprint map - cities are placeholders until confirmed into a real travel record',
      moreLink: { label: 'Want the full world footprint? Follow me to another map →', href: 'https://cowork.xiaohongshu.com/s/world-footprint/' }
    },
    photos: [
      ['01', 'Interior Light'], ['02', 'Night Monument'], ['03', 'Writers’ Memorial'], ['04', 'Blue Crossing'],
      ['05', 'Colored Light'], ['06', 'Winter Carousel'], ['07', 'Porthole Study'], ['08', 'Winter Sun'],
      ['09', 'Museum Crowd'], ['10', 'Coastal Morning'], ['11', 'Street Sign'], ['12', 'Open Water'],
      ['13', 'Chandelier Study'], ['14', 'Night Landscape']
    ].map(([n, t]) => ({
      id: `photo-${n}`, title: t,
      src: `assets/travel/photo-${n}.webp`, thumb: `assets/travel/photo-${n}-thumb.webp`,
      alt: `${t} (placeholder)`, caption: 'Placeholder image - to be replaced with my own photographs.',
      location: 'Placeholder', cityId: undefined
    })),
    skills: [
      { name: 'People', items: ['Recruiting support', 'Employee experience', 'Culture programs', 'Policy & process', 'Talent development'] },
      { name: 'AI', items: ['Prompt design', 'AI workflows', 'Knowledge retrieval', 'Miniapp building', 'Effect validation'] },
      { name: 'Content', items: ['Copywriting', 'Course & script', 'Topic planning', 'Cross-team communication', 'Bilingual writing'] },
      { name: 'Build', items: ['Three.js scenes', 'Static site deployment', 'Python scripts', 'Data wrangling', 'Rapid prototyping'] }
    ],
    awards: [
      { title: 'AI workflows that actually run', meta: 'Evidence of efficiency', detail: 'Retrieval, drafting and automation entered the daily routine - they did not stop at a demo.' },
      { title: 'Templated content production', meta: 'Evidence of reuse', detail: 'One-off content work became templates and checklists; a new topic is a fill-in exercise.' },
      { title: 'A spatial personal narrative', meta: 'Evidence of making', detail: 'Experience turned into a walkable space - you are inside it right now.' },
      { title: 'Translation across domains', meta: 'Evidence of growth', detail: 'Moving between people, content and engineering, speaking one side’s language to the other.' }
    ],
    interests: [
      {
        id: 'sunrise', icon: '☀', title: 'Chasing the sunrise',
        hook: 'I question every early alarm, then forgive it the moment the sun appears.',
        story: 'I love waking early for sunrises, and sometimes climbing a mountain just to watch one from the top. Leaving before dawn and arriving sleepy or breathless is only the opening scene. When the sky turns from deep blue to light and the sun crosses the horizon, the struggle becomes part of the story. A sunrise is not a sight for me; it is a small ceremony that says the day has truly begun.',
        detail: 'Things worth keeping: the alarm screenshot, the mountain silhouette, and the first breakfast afterwards.'
      },
      {
        id: 'hiking', icon: '△', title: 'The hiking trip not yet taken',
        hook: 'My first real hiking journey is still under construction, but it is officially on the life backlog.',
        story: 'I like doing things that feel challenging - a long hiking journey, for example, although I have not completed one yet. What attracts me is not the number of kilometres. It is the idea of living for a while with only simple questions: where to walk, where to stop, and what I noticed today. The project is still on the wish list, but it will open one day.',
        detail: 'Status: under construction. Next brick: choosing a first route that is difficult enough to feel real.'
      },
      {
        id: 'roommate-live', icon: '◉', title: 'My roommate was born for content',
        hook: 'Living with her means watching ordinary life turn into something made for the camera every day.',
        story: 'My roommate has what I can only describe as a natural content-creator constitution. She can turn an ordinary moment into something camera-ready, so I join the dance shoots and often watch the preparation, equipment checks and live broadcast itself. Seeing the process up close taught me that effortless presence on camera still rests on constant judgment about rhythm, interaction and audience emotion.',
        detail: 'Permanent dorm equipment: a ring light, phone stand, and whichever wall is currently available as a background.'
      },
      {
        id: 'outbound', icon: '✈', title: 'I love going out — especially abroad',
        hook: 'Other people mark the sights first; I would rather know how locals spend an ordinary day.',
        story: 'Travel is not a checklist for me. It is a way to enter another everyday system: how people speak, eat, commute and use public space. More than famous sights, I like spending a few days living an ordinary local life in an unfamiliar city, understanding how a place actually runs from its small details.',
        detail: 'Travel rule: routes may change at any time, but the markets, neighbourhoods and small shops I want are marked in advance.'
      },
      {
        id: 'taiwan-food', icon: '🍜', title: 'A Fujian appetite that is hard to fool',
        hook: 'Before the sights, I usually research what the next meal will be.',
        story: 'I especially love Taiwanese food. As someone from Fujian, many flavours feel naturally familiar while still leaving plenty to discover. Food is my fastest way into a place — the taste holds the everyday life of the people there. If you need a Taiwanese food guide, just call me; I take that responsibility seriously.',
        detail: 'Taiwanese food is almost perfectly compatible with a Fujian palate — and I will happily detour for one good shop.'
      }
    ],
    failures: [],
    contact: { email: 'liuluoying@xiaohongshu.com' },
    sourceState: 'personal-edition'
  };

  const PARK_CONTENT = C;
  PARK_CONTENT.interestStories = Array.isArray(PARK_CONTENT.interests) ? PARK_CONTENT.interests.slice() : [];
  if (PARK_CONTENT.interestStories.length && !Array.isArray(PARK_CONTENT.interestStories[0])) {
    PARK_CONTENT.interests = PARK_CONTENT.interestStories.map(item => [item.title, item.hook]);
  }
  if (Array.isArray(PARK_CONTENT.projects)) {
    const arr = PARK_CONTENT.projects;
    PARK_CONTENT.projects = { featuredIds: arr.map(p => p.slug), items: arr };
  }
  PARK_CONTENT.ready = Promise.resolve(PARK_CONTENT);
  window.PARK_CONTENT = PARK_CONTENT;
})();
