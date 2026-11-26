window.__ModuleLoader__.load({
  id: 'dsh-call-panel',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const POLL_URL = '/call-panel/pending';
    const ACK_URL = '/call-panel/ack';
    const POLL_MS = 2000;

    const CHIP = 34;
    const GAP = 6;
    const PAD = 8;
    const BOX_COLS = 4;
    const BOX_ROWS_MIN = 2;
    const LAYOUT_KEY = 'dsh.call-panel.layout.v2';
    const LAMP = '#d9a441';       // 亮灯：暖灯黄
    const LAMP_OFF = '#8c826b';   // 熄灭：灰暖色

    const PARTNERS = [
    ];

    const overlayStyle = {
      position: 'fixed',
      inset: 0,
      zIndex: 2147483000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0,0,0,0.42)',
      backdropFilter: 'blur(2px)',
    };

    const cardStyle = {
      width: 'min(440px, 88vw)',
      boxSizing: 'border-box',
      background: 'var(--dsw-alias-bg-elevated, var(--dsw-alias-bg-base, #ffffff))',
      color: 'var(--dsw-alias-label-primary, #1a1a1a)',
      border: '1px solid var(--dsw-alias-separator, rgba(0,0,0,0.12))',
      borderRadius: 16,
      padding: '20px 22px 18px',
      boxShadow: '0 24px 64px rgba(0,0,0,0.42)',
      fontFamily: 'inherit',
      lineHeight: 1.55,
    };

    const fromStyle = {
      fontSize: 12,
      letterSpacing: '0.02em',
      color: 'var(--dsw-alias-label-secondary, #6b6b6b)',
      marginBottom: 6,
    };

    const titleStyle = { fontSize: 17, fontWeight: 600, margin: 0, whiteSpace: 'pre-wrap' };

    const bodyStyle = {
      fontSize: 13.5,
      marginTop: 8,
      color: 'var(--dsw-alias-label-secondary, #6b6b6b)',
      whiteSpace: 'pre-wrap',
    };

    const actionsStyle = { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 };

    const baseButton = {
      font: 'inherit',
      fontSize: 13.5,
      padding: '7px 16px',
      borderRadius: 9,
      cursor: 'pointer',
      border: '1px solid transparent',
    };

    const quietButton = {
      ...baseButton,
      background: 'transparent',
      color: 'var(--dsw-alias-label-primary, #1a1a1a)',
      border: '1px solid var(--dsw-alias-separator, rgba(0,0,0,0.16))',
    };

    const loudButton = {
      ...baseButton,
      background: 'var(--dsw-alias-brand-primary, #4d6bfe)',
      color: '#fff',
    };

    const DOCK_VISIBLE_KEY = 'dsh.call-panel.dock.visible.v1';
    const dockStore = {
      visible: (() => {
        try {
          return window.localStorage.getItem(DOCK_VISIBLE_KEY) !== '0';
        } catch {
          return true;
        }
      })(),
      listeners: new Set(),
    };

    function setDockVisible(next) {
      dockStore.visible = next;
      try {
        window.localStorage.setItem(DOCK_VISIBLE_KEY, next ? '1' : '0');
      } catch {
        // Storage blocked; the toggle still works for this page.
      }
      for (const listener of dockStore.listeners) listener();
    }

    function useDockVisible() {
      const [, force] = React.useState(0);
      React.useEffect(() => {
        const listener = () => force((count) => count + 1);
        dockStore.listeners.add(listener);
        return () => dockStore.listeners.delete(listener);
      }, []);
      return dockStore.visible;
    }

    function loadLayout() {
      try {
        const raw = window.localStorage.getItem(LAYOUT_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            const box =
              parsed.box && Number.isFinite(parsed.box.x) && Number.isFinite(parsed.box.y)
                ? parsed.box
                : { x: 14, y: 96 };
            const order = Array.isArray(parsed.order)
              ? parsed.order.filter((name) => typeof name === 'string')
              : [];
            const free =
              parsed.free && typeof parsed.free === 'object' && !Array.isArray(parsed.free)
                ? parsed.free
                : {};
            return { box, order, free };
          }
        }
      } catch {
        // Fall through to the default layout.
      }
      return { box: { x: 14, y: 96 }, order: [], free: {} };
    }

    function saveLayout(layout) {
      try {
        window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
      } catch {
        // Storage blocked; layout resets on reload.
      }
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        // ---------- 呼叫弹窗 ----------
        let chimeCtx = null;
        function playChime() {
          try {
            const Ctor = window.AudioContext || window.webkitAudioContext;
            if (!Ctor) return;
            if (!chimeCtx) chimeCtx = new Ctor();
            if (chimeCtx.state === 'suspended') void chimeCtx.resume().catch(() => {});
            const start = chimeCtx.currentTime;
            const notes = [
              [880.0, 0],
              [1174.66, 0.11],
              [1567.98, 0.22],
            ];
            for (const [freq, offset] of notes) {
              const osc = chimeCtx.createOscillator();
              const gain = chimeCtx.createGain();
              osc.type = 'sine';
              osc.frequency.value = freq;
              gain.gain.setValueAtTime(0.0001, start + offset);
              gain.gain.linearRampToValueAtTime(0.09, start + offset + 0.02);
              gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.42);
              osc.connect(gain);
              gain.connect(chimeCtx.destination);
              osc.start(start + offset);
              osc.stop(start + offset + 0.45);
            }
          } catch {
            // No audio available: the popup still shows.
          }
        }

        function CallOverlay() {
          const [item, setItem] = React.useState(null);
          const lastId = React.useRef(null);

          React.useEffect(() => {
            let alive = true;
            const tick = async () => {
              try {
                const response = await fetch(POLL_URL, { cache: 'no-store' });
                if (!response.ok) return;
                const data = await response.json();
                const list = Array.isArray(data && data.items) ? data.items : [];
                const first = list[0];
                if (alive && first && first.id !== lastId.current) {
                  lastId.current = first.id;
                  setItem(first);
                  playChime();
                }
              } catch {
                // Host not ready: try again next tick.
              }
            };
            tick();
            const timer = window.setInterval(tick, POLL_MS);
            return () => {
              alive = false;
              window.clearInterval(timer);
            };
          }, []);

          const ack = async (id) => {
            try {
              await fetch(ACK_URL, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ id }),
              });
            } catch {
              // Stays pending on the host; it returns on the next poll.
            }
          };

          const close = () => {
            const current = item;
            setItem(null);
            if (current) void ack(current.id);
          };

          const jump = () => {
            const current = item;
            setItem(null);
            if (!current) return;
            try {
              const workspace = ctx.get('uiWorkspace');
              if (workspace && typeof workspace.openSession === 'function' && current.session) {
                void workspace.openSession(current.session);
              }
            } catch {
              // No workspace service on this surface.
            }
            void ack(current.id);
          };

          React.useEffect(() => {
            if (!item) return undefined;
            const onKey = (event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                close();
              }
            };
            window.addEventListener('keydown', onKey);
            return () => window.removeEventListener('keydown', onKey);
          });

          if (!item) return null;

          return h(
            'div',
            { style: overlayStyle, role: 'presentation' },
            h(
              'div',
              { style: cardStyle, role: 'dialog', 'aria-modal': 'true', 'aria-label': item.title },
              h('div', { style: fromStyle }, String(item.from || '伙伴')),
              h('p', { style: titleStyle }, String(item.title || '有事找你')),
              item.body ? h('div', { style: bodyStyle }, String(item.body)) : null,
              h(
                'div',
                { style: actionsStyle },
                h('button', { type: 'button', style: quietButton, onClick: close }, '确认'),
                item.session
                  ? h('button', { type: 'button', style: loudButton, onClick: jump }, '跳转')
                  : null,
              ),
            ),
          );
        }

        // ---------- 伙伴头像：独立可拖 + 一个透明盒子 ----------
        function readPartners() {
          try {
            const sessions = ctx.get('sessions');
            const list =
              sessions && sessions.list && sessions.list.getSnapshot
                ? sessions.list.getSnapshot()
                : null;
            const statuses = ctx.get('uiSession')?.sessionStatus?.getSnapshot?.() ?? null;
            if (!list || !Array.isArray(list.ids)) return [];
            const found = [];
            for (const id of list.ids) {
              const session = list.byId ? list.byId[id] : null;
              if (!session || session.blank === true) continue;
              if (session.origin === 'subagent' || session.parentId != null) continue;
              const title = String(session.displayTitle || session.title || '').trim();
              const who = PARTNERS.find((person) => title.includes(person.name));
              if (!who) continue;
              const status =
                statuses && typeof statuses.get === 'function' ? statuses.get(id) : null;
              found.push({
                ...who,
                id,
                title,
                running: status?.running === true,
                unread: status?.completionUnread === true || status?.pendingInteraction != null,
              });
            }
            if (found.length === 0) {
              // 别人装的版本：不认识这几个名字，就把当前工作区的顶层会话都列出来，
              // 用标题首字 + 自动配色。这样换一台机器也不会是空的一大块。
              const AUTO = [
                '#5b8def', '#4aa3a2', '#b07de0', '#d98b4a',
                '#7f8a99', '#c96f8e', '#5aa469', '#c9a227',
                '#7d6bd6', '#3f8f7a', '#b5543a', '#4f7f8a',
              ];
              let index = 0;
              for (const id of list.ids) {
                const session = list.byId ? list.byId[id] : null;
                if (!session || session.blank === true) continue;
                if (session.origin === 'subagent' || session.parentId != null) continue;
                const title = String(session.displayTitle || session.title || '').trim();
                if (!title) continue;
                const status =
                  statuses && typeof statuses.get === 'function' ? statuses.get(id) : null;
                found.push({
                  name: title,
                  color: AUTO[index % AUTO.length],
                  id,
                  title,
                  running: status?.running === true,
                  unread:
                    status?.completionUnread === true || status?.pendingInteraction != null,
                });
                index += 1;
                if (index >= 12) break;
              }
            }
            return found;
          } catch {
            return [];
          }
        }

        function PartnerChip({ person, pos, onDrop, onOpen }) {
          const [dragging, setDragging] = React.useState(null);
          const drag = React.useRef(null);
          const latest = React.useRef(null);
          const moved = React.useRef(0);
          const [hover, setHover] = React.useState(false);

          const onPointerDown = (event) => {
            if (event.button !== 0) return;
            event.stopPropagation();
            drag.current = { dx: event.clientX - pos.x, dy: event.clientY - pos.y };
            moved.current = 0;
            if (typeof event.currentTarget.setPointerCapture === 'function') {
              event.currentTarget.setPointerCapture(event.pointerId);
            }
          };

          const onPointerMove = (event) => {
            const current = drag.current;
            if (!current) return;
            const next = {
              x: Math.max(0, event.clientX - current.dx),
              y: Math.max(0, event.clientY - current.dy),
            };
            moved.current += Math.abs(next.x - pos.x) + Math.abs(next.y - pos.y);
            latest.current = next;
            setDragging(next);
          };

          const onPointerUp = () => {
            const current = drag.current;
            drag.current = null;
            const landed = latest.current;
            latest.current = null;
            setDragging(null);
            if (!current) return;
            if (moved.current <= 6) {
              onOpen(person.id);
              return;
            }
            if (landed) onDrop(person.name, landed);
          };

          const shown = dragging ?? pos;
          const filled = person.unread;

          return h(
            'div',
            {
              title: person.unread ? `${person.name}（有未读）` : person.name,
              onPointerDown,
              onPointerMove,
              onPointerUp,
              onPointerCancel: onPointerUp,
              onMouseEnter: () => setHover(true),
              onMouseLeave: () => setHover(false),
              style: {
                position: 'fixed',
                left: shown.x,
                top: shown.y,
                zIndex: dragging ? 2147482500 : 2147482000,
                width: CHIP,
                height: CHIP,
                boxSizing: 'border-box',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 9,
                border: `2px solid ${person.color}`,
                background: filled ? person.color : 'transparent',
                color: filled ? '#fff' : person.color,
                fontSize: 13,
                fontWeight: 600,
                lineHeight: 1,
                cursor: dragging ? 'grabbing' : 'pointer',
                userSelect: 'none',
                touchAction: 'none',
                boxShadow: hover || dragging ? '0 6px 18px rgba(0,0,0,0.3)' : 'none',
                transform: hover && !dragging ? 'scale(1.08)' : 'scale(1)',
                transition: dragging
                  ? 'none'
                  : 'transform 120ms ease, box-shadow 120ms ease, background 120ms ease, left 120ms ease, top 120ms ease',
              },
            },
            person.name.slice(0, 1),
          );
        }

        function PartnerDock() {
          const [rows, setRows] = React.useState([]);
          const [layout, setLayout] = React.useState(loadLayout);
          const [notice, setNotice] = React.useState('');
          const [canOpen, setCanOpen] = React.useState(false);
          const boxDrag = React.useRef(null);

          React.useEffect(() => {
            let alive = true;
            const check = async () => {
              try {
                const response = await fetch('/call-panel/available', { cache: 'no-store' });
                if (!response.ok) return;
                const data = await response.json();
                if (alive) setCanOpen(data && data.liuyanben === true);
              } catch {
                // Host without the route (old build): keep the shortcut hidden.
              }
            };
            check();
            return () => {
              alive = false;
            };
          }, []);
          const visible = useDockVisible();

          const openLiuyanben = async () => {
            try {
              const response = await fetch('/call-panel/open?key=liuyanben', {
                cache: 'no-store',
              });
              if (!response.ok) {
                let detail = '';
                try {
                  const data = await response.json();
                  detail = typeof data.error === 'string' ? data.error : '';
                } catch {
                  detail = '';
                }
                setNotice(detail === 'no such route' ? '宿主还是旧版' : `打不开(${response.status})`);
                window.setTimeout(() => setNotice(''), 4000);
              }
            } catch {
              setNotice('连不上宿主');
              window.setTimeout(() => setNotice(''), 4000);
            }
          };

          React.useEffect(() => {
            saveLayout(layout);
          }, [layout]);

          React.useEffect(() => {
            let alive = true;
            const tick = () => {
              if (alive) setRows(readPartners());
            };
            tick();
            const timer = window.setInterval(tick, POLL_MS);
            return () => {
              alive = false;
              window.clearInterval(timer);
            };
          }, []);

          const boxWidth = PAD * 2 + BOX_COLS * (CHIP + GAP) - GAP;
          const rowsInBox = Math.max(
            BOX_ROWS_MIN,
            Math.ceil(layout.order.length / BOX_COLS),
          );
          const boxHeight = PAD * 2 + rowsInBox * (CHIP + GAP) - GAP;

          const slotOf = (index) => ({
            x: layout.box.x + PAD + (index % BOX_COLS) * (CHIP + GAP),
            y: layout.box.y + PAD + Math.floor(index / BOX_COLS) * (CHIP + GAP),
          });

          const posOf = (name, index) => {
            const orderIndex = layout.order.indexOf(name);
            if (orderIndex >= 0) return slotOf(orderIndex);
            const saved = layout.free[name];
            if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) return saved;
            return { x: 14, y: 230 + index * (CHIP + GAP) };
          };

          const drop = (name, point) => {
            const inside =
              point.x + CHIP / 2 >= layout.box.x &&
              point.x + CHIP / 2 <= layout.box.x + boxWidth &&
              point.y + CHIP / 2 >= layout.box.y &&
              point.y + CHIP / 2 <= layout.box.y + boxHeight;

            setLayout((current) => {
              const others = current.order.filter((entry) => entry !== name);
              if (!inside) {
                const free = { ...current.free, [name]: point };
                return { ...current, order: others, free };
              }
              const centerX = point.x + CHIP / 2;
              const centerY = point.y + CHIP / 2;
              const col = Math.max(
                0,
                Math.min(BOX_COLS - 1, Math.floor((centerX - current.box.x - PAD) / (CHIP + GAP))),
              );
              const row = Math.max(
                0,
                Math.floor((centerY - current.box.y - PAD) / (CHIP + GAP)),
              );
              const index = Math.min(others.length, row * BOX_COLS + col);
              const order = [...others.slice(0, index), name, ...others.slice(index)];
              const free = { ...current.free };
              delete free[name];
              return { ...current, order, free };
            });
          };

          const onBoxPointerDown = (event) => {
            if (event.button !== 0) return;
            event.stopPropagation();
            boxDrag.current = {
              dx: event.clientX - layout.box.x,
              dy: event.clientY - layout.box.y,
            };
            if (typeof event.currentTarget.setPointerCapture === 'function') {
              event.currentTarget.setPointerCapture(event.pointerId);
            }
          };

          const onBoxPointerMove = (event) => {
            const current = boxDrag.current;
            if (!current) return;
            setLayout((state) => ({
              ...state,
              box: {
                x: Math.max(0, event.clientX - current.dx),
                y: Math.max(0, event.clientY - current.dy),
              },
            }));
          };

          const onBoxPointerUp = () => {
            boxDrag.current = null;
          };

          const open = (sessionId) => {
            if (!sessionId) return;
            try {
              const workspace = ctx.get('uiWorkspace');
              if (workspace && typeof workspace.openSession === 'function') {
                void workspace.openSession(sessionId);
              }
            } catch {
              // No workspace service on this surface.
            }
          };

          if (!visible) return null;

          return h(
            'div',
            null,
            h('div', {
              onPointerDown: onBoxPointerDown,
              onPointerMove: onBoxPointerMove,
              onPointerUp: onBoxPointerUp,
              onPointerCancel: onBoxPointerUp,
              title: '把小方块拖进来排队',
              style: {
                position: 'fixed',
                left: layout.box.x,
                top: layout.box.y,
                width: boxWidth,
                height: boxHeight,
                boxSizing: 'border-box',
                borderRadius: 12,
                border: '1px dashed rgba(128,128,128,0.4)',
                background: 'transparent',
                cursor: 'grab',
                touchAction: 'none',
                userSelect: 'none',
                zIndex: 2147481900,
                transition: 'width 160ms ease',
              },
            }),
            h(
              'button',
              {
                key: 'liuyanben',
                type: 'button',
                title: canOpen ? notice || '打开留言本' : '这个工作区没有留言本',
                onClick: canOpen ? openLiuyanben : undefined,
                style: {
                  position: 'fixed',
                  left: layout.box.x + boxWidth + 6,
                  top: layout.box.y + 10,
                  width: 22,
                  padding: '6px 3px',
                  borderRadius: '0 8px 8px 0',
                  border: '1px dashed rgba(128,128,128,0.4)',
                  borderLeft: 'none',
                  background: 'transparent',
                  color: 'var(--dsw-alias-label-secondary, #6b6b6b)',
                  fontSize: 11,
                  lineHeight: 1.15,
                  writingMode: 'vertical-rl',
                  textOrientation: 'upright',
                  letterSpacing: '1px',
                  cursor: canOpen ? 'pointer' : 'default',
                  opacity: canOpen ? 1 : 0.35,
                  whiteSpace: 'nowrap',
                  font: 'inherit',
                  zIndex: 2147481900,
                },
              },
              notice || '留言本',
            ),
            rows.map((person, index) =>
              h(PartnerChip, {
                key: person.name,
                person,
                pos: posOf(person.name, index),
                onDrop: drop,
                onOpen: open,
              }),
            ),
          );
        }

        function LiangdengButton() {
          const visible = useDockVisible();
          return h(
            'button',
            {
              type: 'button',
              title: visible ? '收起灯牌' : '亮出灯牌',
              'aria-pressed': visible,
              onClick: () => setDockVisible(!visible),
              style: {
                width: CHIP,
                height: CHIP,
                boxSizing: 'border-box',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                margin: '8px 8px 10px 0',
                borderRadius: 9,
                border: `2px solid ${visible ? LAMP : LAMP_OFF}`,
                background: visible ? LAMP : 'transparent',
                color: visible ? '#fff' : LAMP_OFF,
                font: 'inherit',
                fontSize: 13,
                fontWeight: 600,
                lineHeight: 1,
                opacity: visible ? 1 : 0.6,
                cursor: 'pointer',
                userSelect: 'none',
                textShadow: visible ? '0 1px 1px rgba(0,0,0,0.35)' : 'none',
                boxShadow: visible ? '0 0 10px rgba(217,164,65,0.45)' : 'none',
                transition:
                  'background 120ms ease, color 120ms ease, border-color 120ms ease, opacity 120ms ease, box-shadow 120ms ease',
              },
            },
            '灯',
          );
        }

        ctx.slots.inject('sidebar.footer.action', () =>
          ctx.slots.register(
            {
              name: 'sidebar.footer.action',
              id: 'liangdeng-button',
              order: 4,
              label: () => '亮灯',
            },
            LiangdengButton,
          ),
        );

        ctx.slots.inject('shell.overlay', () =>
          ctx.slots.register(
            { name: 'shell.overlay', id: 'partner-dock', order: 970, label: () => '伙伴' },
            PartnerDock,
          ),
        );

        ctx.slots.inject('shell.overlay', () =>
          ctx.slots.register(
            { name: 'shell.overlay', id: 'call-panel-overlay', order: 980, label: () => '呼叫' },
            CallOverlay,
          ),
        );
      },
    };
  },
});
