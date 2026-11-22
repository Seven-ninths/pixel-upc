(() => {
  'use strict';

  const DAY_MINUTES = 1440;
  const peers = [
    { id: 'lin', npcId: 'student-1', name: '林同学', description: '喜欢沿光华大道散步，认路很快。', greeting: '嗨，我是林同学。刚才还在想要不要去光华大道转一圈。', warm: '好呀，下次一起走。校园很大，多走几趟就熟了。', casual: '地图我也看了好几回，我们一起慢慢摸索。', food: '唐岛湾餐厅', study: '图书馆总馆', help: 'wayfinding' },
    { id: 'yanxi', npcId: 'student-8', name: '言溪', description: '喜欢安静的自习角，常去东馆。', greeting: '你好，我叫言溪。我正准备给自习找个安静座位。', warm: '那我们下次在东馆碰面吧。那边安静，窗外也很开阔。', casual: '可以呀，坐久了就出去吹会儿风。', food: '唐岛湾餐厅', study: '图书馆东馆', help: 'library' },
    { id: 'xiaoqi', npcId: 'student-15', name: '晓齐', description: '上课前习惯提前到教室，对实验很上心。', greeting: '你好，我是晓齐。今天这节课的楼我终于找对了。', warm: '谢谢！下次我带你去认一认西环和东环。', casual: '哈哈，我上次还在讲堂群绕了整整一圈。', food: '荟萃苑餐厅', study: '图书馆总馆', help: 'classroom' },
    { id: 'xiaoyu', npcId: 'student-22', name: '小郁', description: '喜欢拍照，会记住校园里好看的角落。', greeting: '嗨，我是小郁。我在收集校园里适合拍照的地方。', warm: '好，有遇到喜欢的地方就告诉我。下回我也去看看。', casual: '只要光线好，平时走的楼梯也能拍得很像样。', food: '荟萃苑餐厅', study: '图书馆东馆', help: 'plaza' },
    { id: 'zhou', npcId: 'student-29', name: '周同学', description: '喜欢把事情先排好，再一件件完成。', greeting: '你好，我姓周。等下想先把这周的小组任务分一分。', warm: '好啊，有空我们把各自的安排对一对，做起来就顺多了。', casual: '可以，先写下最急的那件，剩下的就好办了。', food: '荟萃苑餐厅', study: '图书馆总馆', help: 'classroom' },
  ];
  const byId = new Map(peers.map(peer => [peer.id, peer]));
  const byNpc = new Map(peers.map(peer => [peer.npcId, peer]));
  const planTypes = {
    meal: { label: '一起吃饭', start: 710, end: 800, minutes: 25, energy: 14, venue: 'food' },
    study: { label: '一起自习', start: 1020, end: 1260, minutes: 40, energy: -12, venue: 'study' },
  };
  const helpTypes = {
    wayfinding: { title: '确认校园方向', place: '创造太阳', prompt: '有人问我从南门进来往哪边走。能去「创造太阳」附近替我确认一下方向吗？', finished: '谢谢，这样我给新同学指路就说得清楚了。' },
    library: { title: '看一眼东馆入口', place: '图书馆东馆', prompt: '我想约小组去东馆碰面，能帮我先确认一下入口附近适不适合等人吗？', finished: '收到，我把碰面的位置跟大家说一下。' },
    classroom: { title: '确认讲堂群集合点', place: '讲堂群', prompt: '我们准备在讲堂群门口先集合。你经过时能帮忙确认一下集合点吗？', finished: '辛苦！这下大家下课后就知道在哪儿碰面了。' },
    plaza: { title: '在广场找拍照角度', place: '子元广场', prompt: '我想找个能拍到子元广场的角度。你顺路去看一下，告诉我从哪里看比较开阔好吗？', finished: '我记下了，下次带相机去。谢谢你特地走一趟。' },
  };
  const dailyPosts = [
    { author: '林同学', text: '光华大道好找路，第一次去教学区可以先认「创造太阳」。' },
    { author: '晓齐', text: '去讲堂群之前看一眼教室分区，东环和东廊是两片地方。' },
    { author: '言溪', text: '想安静坐一会儿，可以去图书馆自习。约人碰面时记得确认是总馆还是东馆。' },
    { author: '小郁', text: '傍晚在子元广场散步时，记得抬头看看树梢。' },
    { author: '周同学', text: '小组作业可以先把分工讲清楚。各自做完，碰面时再一起检查。' },
  ];

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const option = (id, label) => ({ id, label });
  const clock = minute => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
  const relationship = (score, met) => score >= 5 ? '朋友' : met ? '熟人' : '未认识';
  const atPlace = (place, target) => place === target || Boolean(place && place.startsWith(target));
  const validObject = value => value && typeof value === 'object' && !Array.isArray(value);

  function create({ state = {}, save = () => {}, now = () => 0, getEnergy = () => 100,
    changeEnergy = () => {}, advance = () => {}, completePlan, random = Math.random } = {}) {
    const social = validObject(state.social) ? state.social : {};
    state.social = social;
    social.peers = validObject(social.peers) ? social.peers : {};
    social.plans = Array.isArray(social.plans) ? social.plans.filter(plan =>
      byId.has(plan?.peerId) && Object.hasOwn(planTypes, plan.kind) && Number.isFinite(plan.day) &&
      Number.isFinite(plan.minute) && Number.isFinite(plan.end)) : [];
    social.requests = Array.isArray(social.requests) ? social.requests.filter(request =>
      byId.has(request?.peerId) && Number.isFinite(request.day)) : [];
    social.reputation = Number.isFinite(social.reputation) ? social.reputation : 0;
    if (!byId.has(social.roommateId)) {
      social.roommateId = peers[clamp(Math.floor(random() * peers.length), 0, peers.length - 1)].id;
      save();
    }

    function time(context) {
      const absolute = now();
      const current = Number.isFinite(absolute) ? Math.max(0, Math.floor(absolute)) : 0;
      return {
        day: Number.isFinite(context.day) ? Math.max(1, Math.floor(context.day)) : Math.floor(current / DAY_MINUTES) + 1,
        minute: Number.isFinite(context.minute) ? clamp(Math.floor(context.minute), 0, DAY_MINUTES - 1) : current % DAY_MINUTES,
        place: typeof context.place === 'string' ? context.place : '',
        inClass: context.inClass === true || context.phase === '上课' || context.phase === '课堂中',
      };
    }

    function profile(peer) {
      return social.peers[peer.id] || { affinity: 0, met: false };
    }

    function remember(peer) {
      if (!validObject(social.peers[peer.id])) social.peers[peer.id] = { affinity: 0, met: false, events: {} };
      const person = social.peers[peer.id];
      if (!validObject(person.events)) person.events = {};
      if (!Number.isFinite(person.affinity)) person.affinity = 0;
      return person;
    }

    function record(peer, action, day, affinity, reputation = 0) {
      const person = remember(peer);
      if (person.events[action] === day) return false;
      person.events[action] = day;
      person.affinity = clamp(person.affinity + affinity, -4, 12);
      person.met = true;
      social.reputation = clamp(social.reputation + reputation, -10, 30);
      save();
      return true;
    }

    function peerFor(npc) {
      if (typeof npc === 'string') return byId.get(npc) || byNpc.get(npc) || peers.find(peer => peer.name === npc) || null;
      return byId.get(npc?.socialId) || byNpc.get(npc?.id) || (!npc?.id && peers.find(peer => peer.name === npc?.name)) || null;
    }

    function planStatus(plan, current) {
      if (plan.complete) return '已完成';
      const latestStart = plan.end - planTypes[plan.kind].minutes;
      if (current.day > plan.day || (current.day === plan.day && current.minute > latestStart)) return '已过时';
      return '待赴约';
    }

    function presentPlan(plan, current) {
      const status = planStatus(plan, current);
      const name = byId.get(plan.peerId)?.name || '';
      const activity = planTypes[plan.kind];
      return { id: plan.id, peerId: plan.peerId, name, kind: plan.kind, place: plan.place, day: plan.day, minute: plan.minute,
        status, label: activity.label, text: `第 ${plan.day} 天 ${clock(plan.minute)}–${clock(plan.end - activity.minutes)} · ${plan.place}` };
    }

    function activePlan(peer, kind, current) {
      return social.plans.find(plan => plan.peerId === peer.id && plan.kind === kind && planStatus(plan, current) === '待赴约');
    }

    function makePlan(peer, kind, current) {
      const idea = planTypes[kind];
      const metToday = social.plans.some(plan => plan.peerId === peer.id && plan.kind === kind && plan.day === current.day && plan.complete);
      const day = metToday || current.minute > idea.end - idea.minutes ? current.day + 1 : current.day;
      const minute = day === current.day ? Math.max(idea.start, current.minute) : idea.start;
      const plan = { id: `${peer.id}-${kind}-${day}`, peerId: peer.id, kind, day, minute, end: idea.end, place: peer[idea.venue], complete: false };
      social.plans = social.plans.filter(item => item.day >= current.day - 1);
      social.plans.push(plan);
      save();
      return plan;
    }

    function helpRequest(peer) {
      return social.requests.find(request => request.peerId === peer.id && !request.complete);
    }

    function respond(peer, text, context, notice) {
      const menu = dialogue(peer.id, context);
      return { ...menu, text, notice };
    }

    function openPlan(peer, kind, context, roommateOffer = false) {
      const current = time(context);
      const plan = activePlan(peer, kind, current) || makePlan(peer, kind, current);
      const description = presentPlan(plan, current);
      const prefix = roommateOffer ? '说定了，我在那儿等你。' : '好呀，我们到时候见。';
      return respond(peer, `${prefix} ${description.text}。`, context, '已记下约定');
    }

    function joinPlan(id, context = {}) {
      const plan = social.plans.find(item => item.id === id);
      const peer = byId.get(plan?.peerId);
      if (!peer) return null;
      const current = time(context);
      const activity = planTypes[plan.kind];
      const description = presentPlan(plan, current);
      if (description.status === '已完成') return respond(peer, '我们已经见过面啦。下次有空再约。', context);
      if (description.status === '已过时') return respond(peer, '这次约定的时间过了。我们可以再找个时间。', context);
      if (current.inClass || !atPlace(current.place, plan.place) || current.day !== plan.day || current.minute < plan.minute || current.minute + activity.minutes > plan.end) {
        return respond(peer, `按约定的时间到${plan.place}吧。${description.text}。`, context);
      }
      if (getEnergy() + activity.energy < 0) return respond(peer, '你看起来有点累。先休息，缓过来再一起自习。', context);
      let result;
      if (completePlan) {
        result = completePlan(plan.kind, activity);
        if (!result.ok) return respond(peer, result.message, context);
      } else {
        changeEnergy(activity.energy);
        advance(activity.minutes);
      }
      plan.complete = true;
      if (!record(peer, plan.kind, current.day, 2, 1)) save();
      const text = plan.kind === 'meal' ? '和你一起吃饭挺开心的。吃饱了，再去做接下来的事吧。' : '这一会儿自习很专心。我们各自理清了手头的内容。';
      const refreshed = { ...context, day: undefined, minute: undefined };
      return respond(peer, text, refreshed, result?.message || `用时 ${activity.minutes} 分钟，精力 ${activity.energy > 0 ? '+' : ''}${activity.energy}`);
    }

    function presentHelp(request) {
      const peer = byId.get(request.peerId);
      const help = helpTypes[peer.help];
      return { id: request.id, peerId: peer.id, name: peer.name, title: help.title, place: help.place, day: request.day,
        status: request.complete ? '已完成' : '待帮忙', label: help.title, text: `${peer.name} · ${help.place}` };
    }

    function finishHelp(id, context = {}) {
      const request = social.requests.find(item => item.id === id);
      const peer = byId.get(request?.peerId);
      if (!peer) return null;
      const help = helpTypes[peer.help];
      const current = time(context);
      if (request.complete) return respond(peer, '谢谢，刚才的事已经办好啦。', context);
      if (current.inClass || !atPlace(current.place, help.place)) return respond(peer, `这件事需要到${help.place}才能办。`, context);
      request.complete = true;
      advance(8);
      if (!record(peer, 'help', current.day, 2, 2)) save();
      return respond(peer, help.finished, context, '帮忙完成，耗时 8 分钟');
    }

    function roommateOffer(peer, current) {
      const kind = current.minute < 800 ? 'meal' : 'study';
      if (profile(peer).events?.roommate === current.day || activePlan(peer, kind, current)) return null;
      return kind;
    }

    function dialogue(id, context = {}) {
      const peer = byId.get(id);
      if (!peer) return null;
      const current = time(context);
      const person = profile(peer);
      const isRoommate = peer.id === social.roommateId;
      const status = relationship(person.affinity || 0, person.met || isRoommate);
      const choices = [];
      let text = person.met ? `嗨，又见面了。${peer.description}` : peer.greeting;
      if (status === '朋友') text = '是你啊！今天安排得怎么样，要不要一起做点什么？';
      const offer = isRoommate && !current.inClass && roommateOffer(peer, current);
      if (offer) {
        text = offer === 'meal' ? '今天哪会儿有空？我想约你一起去吃饭。' : '我想找个安静地方把明天的内容理一理。要不要一起自习？';
        choices.push(option('roommate-accept', `答应室友${planTypes[offer].label}`), option('roommate-later', '今天先各忙各的'));
      }
      if (current.inClass) return { name: peer.name, text: '这会儿先听课吧。下课后我们再聊。', choices: [] };
      if (!person.met) {
        choices.push(option('warm', '热情介绍自己'), option('casual', '轻松地聊两句'), option('brief', '冷淡地应一声'));
      } else if (person.events?.catchup !== current.day) {
        choices.push(option('catchup', '聊聊今天的校园生活'));
      }
      if (person.met || isRoommate) {
        for (const [kind, idea] of Object.entries(planTypes)) {
          const plan = activePlan(peer, kind, current);
          if (plan) choices.push(option(`plan:${plan.id}`, `${idea.label} · 查看／赴约`));
          else if (kind !== offer) choices.push(option(kind, `约${idea.label}`));
        }
        if (context.course?.title) choices.push(option('catch-up-class', '问问错过的课堂重点'));
        if (status === '朋友' || isRoommate) choices.push(option('homework', '小组作业分工 · 45 分钟，体力 −16'));
        const request = helpRequest(peer);
        if (request) choices.push(option(`help-finish:${request.id}`, '交代帮忙的结果'));
        else if (!social.requests.some(item => item.peerId === peer.id && item.day === current.day)) choices.push(option('help-offer', '问问有需要帮忙的吗？'));
      }
      return { name: peer.name, text, choices };
    }

    function choose(id, choice, context = {}) {
      const peer = byId.get(id);
      const scene = dialogue(id, context);
      if (!peer || !scene || typeof choice !== 'string') return scene;
      if (choice.startsWith('plan:') && scene.choices.some(item => item.id === choice)) return joinPlan(choice.slice(5), context);
      if (choice.startsWith('help-finish:') && scene.choices.some(item => item.id === choice)) return finishHelp(choice.slice(12), context);
      const current = time(context);
      if (choice === 'help-accept' && !current.inClass && (profile(peer).met || peer.id === social.roommateId) &&
        !helpRequest(peer) && !social.requests.some(item => item.peerId === peer.id && item.day === current.day)) {
        social.requests = social.requests.filter(item => !item.complete || item.day >= current.day - 2);
        social.requests.push({ id: `${peer.id}-help-${current.day}`, peerId: peer.id, day: current.day, complete: false });
        save();
        return respond(peer, `谢谢！到${helpTypes[peer.help].place}时再处理这件事就好。`, context, '已记下帮忙的事');
      }
      if (!scene.choices.some(item => item.id === choice)) return scene;
      switch (choice) {
        case 'warm':
        case 'casual':
        case 'brief': {
          const affinity = choice === 'warm' ? 2 : choice === 'casual' ? 1 : -1;
          record(peer, 'greeting', current.day, affinity, choice === 'brief' ? -1 : 0);
          return respond(peer, peer[choice] || '好，认识你了。有空再聊。', context);
        }
        case 'catchup':
          record(peer, 'catchup', current.day, 1);
          return respond(peer, peer.casual, context);
        case 'meal':
        case 'study':
          return openPlan(peer, choice, context);
        case 'roommate-accept': {
          const kind = roommateOffer(peer, current);
          record(peer, 'roommate', current.day, 1);
          return openPlan(peer, kind, context, true);
        }
        case 'roommate-later':
          record(peer, 'roommate', current.day, 0);
          return respond(peer, '没事，等我们都得空再说。', context);
        case 'catch-up-class':
          return respond(peer, context.course.lesson
            ? `《${context.course.title}》上一段讲的是「${context.course.lesson.title}」。${context.course.lesson.text}`
            : `《${context.course.title}》可以先回顾课上的主要概念，再把例题的解法顺一遍。`, context);
        case 'homework':
          if (!/图书馆|讲堂|教楼|宿舍|公寓|文理楼/.test(current.place)) return respond(peer, '我们找个能坐下来的地方再分工吧，图书馆、教学楼或宿舍都可以。', context);
          if (getEnergy() < 16) return respond(peer, '你看起来有点累，休息够了我们再一起做。', context);
          if (profile(peer).events?.homework === current.day) return respond(peer, '今天的分工已经定好了。把手头那部分先做好吧。', context);
          changeEnergy(-16);
          advance(45);
          record(peer, 'homework', current.day, 2, 1);
          return respond(peer, '我们对齐了题目要求，也各自分好了要做的部分。到时候再一起检查。', context, '用时 45 分钟，体力 −16');
        case 'help-offer':
          return { name: peer.name, text: helpTypes[peer.help].prompt, choices: [option('help-accept', '可以，我帮你看看'), option('back', '我先听听别的')] };
        default:
          return scene;
      }
    }

    function contacts() {
      return peers.filter(peer => profile(peer).met || social.roommateId === peer.id).map(peer => {
        const affinity = profile(peer).affinity || 0;
        const isRoommate = peer.id === social.roommateId;
        return { id: peer.id, name: peer.name, relationship: relationship(affinity, true), affinity, description: peer.description, isRoommate };
      });
    }

    function feed(context = {}) {
      const { day } = time(context);
      return dailyPosts.map((post, index) => ({ id: `class-feed-${index}`, day: Math.max(1, day - (index > 2 ? 1 : 0)), ...post }));
    }

    function reputation() {
      const score = social.reputation;
      const label = score >= 9 ? '同学们信得过' : score >= 3 ? '乐于帮忙' : score < 0 ? '还在磨合' : '互相认识中';
      return { score, label };
    }

    return {
      peers,
      peerFor,
      dialogue,
      choose,
      contacts,
      feed,
      reputation,
      roommate: () => byId.get(social.roommateId),
      inviteRoommate: (context = {}) => dialogue(social.roommateId, context),
      plans: (context = {}) => social.plans.map(plan => presentPlan(plan, time(context))),
      joinPlan,
      requests: () => social.requests.map(presentHelp),
      finishHelp,
    };
  }

  window.PixelStudentSocial = { create };
})();
