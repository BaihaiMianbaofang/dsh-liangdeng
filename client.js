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

    const PARTNERS = [];
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
        ctx.slots.inject('shell.overlay', () =>
          ctx.slots.register(
            { name: 'shell.overlay', id: 'light-settings', order: 990, label: () => '亮灯设置' },
            LightSettingsModal,
          ),
        );
        // ---------- 呼叫弹窗 ----------
        let chimeCtx = null;

        // ---------- 亮灯设置（颜色 / 文字 / 提示音） ----------
        const LIGHT_KEY = 'dsh.light.settings.v1';
        const LIGHT_DEFAULT = { sound: true, volume: 60, audioPath: '', colors: {}, labels: {} };
        const lightStore = {
          value: (() => {
            try {
              const raw = window.localStorage.getItem(LIGHT_KEY);
              const parsed = raw ? JSON.parse(raw) : null;
              return { ...LIGHT_DEFAULT, ...(parsed && typeof parsed === 'object' ? parsed : {}) };
            } catch {
              return { ...LIGHT_DEFAULT };
            }
          })(),
          open: false,
          listeners: new Set(),
        };
        function setLightSettings(patch) {
          lightStore.value = { ...lightStore.value, ...patch };
          try {
            window.localStorage.setItem(LIGHT_KEY, JSON.stringify(lightStore.value));
          } catch {
            // 存不了也不影响本次使用
          }
          for (const listener of lightStore.listeners) listener();
        }
        function setSettingsOpen(next) {
          lightStore.open = next;
          for (const listener of lightStore.listeners) listener();
        }
        function useLightStore() {
          const [, force] = React.useState(0);
          React.useEffect(() => {
            const listener = () => force((count) => count + 1);
            lightStore.listeners.add(listener);
            return () => lightStore.listeners.delete(listener);
          }, []);
          return { settings: lightStore.value, open: lightStore.open };
        }

        let cueAudio = null;
        let defaultAudioPath = '';
        function playChime(volume) {
          try {
            const Ctor = window.AudioContext || window.webkitAudioContext;
            if (!Ctor) return;
            if (!chimeCtx) chimeCtx = new Ctor();
            if (chimeCtx.state === 'suspended') void chimeCtx.resume().catch(() => {});
            const level = Math.max(0.0001, Math.min(1, volume)) * 0.09;
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
              gain.gain.linearRampToValueAtTime(level, start + offset + 0.02);
              gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.42);
              osc.connect(gain);
              gain.connect(chimeCtx.destination);
              osc.start(start + offset);
              osc.stop(start + offset + 0.45);
            }
          } catch {
            // 没声音也不影响弹窗
          }
        }

        /** 有自定义音频就播它，播不了/没设置就退回默认三音。 */
        function playCue() {
          const settings = lightStore.value;
          if (!settings.sound) return;
          const volume = Math.max(0, Math.min(100, Number(settings.volume) || 0)) / 100;
          const path = String(settings.audioPath || '').trim() || defaultAudioPath;
          if (path) {
            try {
              const url = `/call-panel/audio?path=${encodeURIComponent(path)}`;
              if (!cueAudio) cueAudio = new Audio();
              if (cueAudio.getAttribute('data-src') !== url) {
                cueAudio.setAttribute('data-src', url);
                cueAudio.src = url;
              }
              cueAudio.volume = volume;
              cueAudio.currentTime = 0;
              const playing = cueAudio.play();
              if (playing && typeof playing.catch === 'function') {
                playing.catch(() => playChime(volume));
              }
              return;
            } catch {
              // 落到默认音
            }
          }
          playChime(volume);
        }

        function LightSettingsModal() {
          const { settings, open } = useLightStore();
          const [path, setPath] = React.useState(settings.audioPath || '');
          React.useEffect(() => {
            if (open) setPath(settings.audioPath || '');
          }, [open]);

          React.useEffect(() => {
            if (!open) return undefined;
            const onKey = (event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                setSettingsOpen(false);
              }
            };
            window.addEventListener('keydown', onKey);
            return () => window.removeEventListener('keydown', onKey);
          }, [open]);

          if (!open) return null;

          const overlay = {
            position: 'fixed',
            inset: 0,
            zIndex: 2147482800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.4)',
          };
          const card = {
            width: 'min(430px, 90vw)',
            maxHeight: '80vh',
            overflowY: 'auto',
            boxSizing: 'border-box',
            borderRadius: 16,
            padding: '18px 20px',
            background: 'var(--dsw-alias-bg-elevated, var(--dsw-alias-bg-base, #ffffff))',
            color: 'var(--dsw-alias-label-primary, #1a1a1a)',
            border: '1px solid var(--dsw-alias-separator, rgba(0,0,0,0.12))',
            boxShadow: '0 24px 64px rgba(0,0,0,0.42)',
            fontFamily: 'inherit',
            fontSize: 13,
          };
          const labelStyle = { fontSize: 12, color: 'var(--dsw-alias-label-secondary, #6b6b6b)', marginBottom: 4 };
          const rowStyle = { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 };
          const inputStyle = {
            flex: 1,
            minWidth: 0,
            font: 'inherit',
            fontSize: 12.5,
            padding: '5px 8px',
            borderRadius: 7,
            border: '1px solid var(--dsw-alias-separator, rgba(0,0,0,0.18))',
            background: 'transparent',
            color: 'inherit',
          };

          const persons = (readPartners().length ? readPartners() : PARTNERS.map((p) => ({ ...p })));

          return h(
            'div',
            {
              style: overlay,
              role: 'presentation',
              onClick: (event) => {
                if (event.target === event.currentTarget) setSettingsOpen(false);
              },
            },
            h(
              'div',
              { style: card, role: 'dialog', 'aria-modal': 'true', 'aria-label': '亮灯设置' },
              h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 } },
                h('span', { style: { fontSize: 15, fontWeight: 600 } }, '亮灯 · 设置'),
                h('button', {
                  type: 'button',
                  onClick: () => setSettingsOpen(false),
                  style: { border: 'none', background: 'transparent', color: 'inherit', cursor: 'pointer', fontSize: 16, lineHeight: 1 },
                }, '×'),
              ),
              h('div', { style: { ...labelStyle, fontWeight: 600 } }, '提示音'),
              h('div', { style: rowStyle },
                h('label', { style: { display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' } },
                  h('input', {
                    type: 'checkbox',
                    checked: settings.sound !== false,
                    onChange: (event) => setLightSettings({ sound: event.target.checked }),
                  }),
                  '开启提示音',
                ),
                h('span', { style: { ...labelStyle, margin: 0 } }, '音量'),
                h('input', {
                  type: 'range',
                  min: 0,
                  max: 100,
                  value: Number(settings.volume) || 0,
                  onChange: (event) => setLightSettings({ volume: Number(event.target.value) }),
                  style: { width: 120 },
                }),
                h('span', { style: { fontSize: 12 } }, `${Number(settings.volume) || 0}`),
              ),
              h('div', { style: labelStyle }, '音频文件（相对工作区；留空 = 默认三音）'),
              h('div', { style: rowStyle },
                h('input', {
                  type: 'text',
                  value: path,
                  placeholder: '声音/提示音.mp3',
                  onChange: (event) => setPath(event.target.value),
                  onBlur: () => setLightSettings({ audioPath: path.trim() }),
                  style: inputStyle,
                }),
                h('button', {
                  type: 'button',
                  onClick: () => setLightSettings({ audioPath: path.trim() }),
                  style: { font: 'inherit', fontSize: 12, padding: '5px 10px', borderRadius: 7, cursor: 'pointer', border: '1px solid var(--dsw-alias-separator, rgba(0,0,0,0.18))', background: 'transparent', color: 'inherit' },
                }, '应用'),
                h('button', {
                  type: 'button',
                  onClick: () => playCue(),
                  style: { font: 'inherit', fontSize: 12, padding: '5px 10px', borderRadius: 7, cursor: 'pointer', border: '1px solid var(--dsw-alias-separator, rgba(0,0,0,0.18))', background: 'transparent', color: 'inherit' },
                }, '试听'),
              ),
              h('div', { style: { ...labelStyle, marginTop: 8, fontWeight: 600 } }, '颜色 / 文字'),
              ...persons.map((person) => {
                const name = person.name;
                const color = lightStore.value.colors[name] || person.color;
                const label = lightStore.value.labels[name] || name.slice(0, 1);
                return h(
                  'div',
                  { key: name, style: rowStyle },
                  h('span', { style: { width: 46, fontSize: 12.5 } }, name),
                  h('input', {
                    type: 'color',
                    value: color,
                    onChange: (event) => setLightSettings({ colors: { ...lightStore.value.colors, [name]: event.target.value } }),
                    style: { width: 34, height: 26, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' },
                  }),
                  h('input', {
                    type: 'text',
                    value: label,
                    maxLength: 2,
                    onChange: (event) => setLightSettings({ labels: { ...lightStore.value.labels, [name]: event.target.value } }),
                    style: { ...inputStyle, width: 40, flex: 'none', textAlign: 'center' },
                  }),
                  h('button', {
                    type: 'button',
                    title: '恢复默认',
                    onClick: () => {
                      const colors = { ...lightStore.value.colors };
                      const labels = { ...lightStore.value.labels };
                      delete colors[name];
                      delete labels[name];
                      setLightSettings({ colors, labels });
                    },
                    style: { font: 'inherit', fontSize: 11, padding: '3px 7px', borderRadius: 6, cursor: 'pointer', border: '1px solid var(--dsw-alias-separator, rgba(0,0,0,0.18))', background: 'transparent', color: 'inherit' },
                  }, '默认'),
                );
              }),
              h('div', { style: { ...labelStyle, marginTop: 10, lineHeight: 1.5 } },
                '音频只认工作区里的 .mp3 / .wav / .ogg / .m4a；放好文件、把路径填进来即可。设置存在这台电脑的浏览器里。'),
            ),
          );
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
                  playCue();
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
            person.label || person.name.slice(0, 1),
          );
        }

        function PartnerDock() {
          const { settings: light } = useLightStore();
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
                if (alive) {
                  setCanOpen(data && data.liuyanben === true);
                  defaultAudioPath = (data && data.sound) || '';
                }
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
                  display: canOpen ? 'block' : 'none',
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
                person: {
                  ...person,
                  color: light.colors[person.name] || person.color,
                  label: light.labels[person.name] || person.name.slice(0, 1),
                },
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
            'div',
            {
              style: {
                position: 'relative',
                width: CHIP,
                height: CHIP,
                minWidth: CHIP,
                minHeight: CHIP,
                flex: 'none',
                flexShrink: 0,
                flexGrow: 0,
                margin: '8px 6px 10px 0',
              },
            },
            h(
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
                  margin: 0,
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
            ),
            h(
              'button',
              {
                type: 'button',
                title: '亮灯设置',
                onClick: (event) => {
                  event.stopPropagation();
                  event.preventDefault();
                  setSettingsOpen(true);
                },
                style: {
                  position: 'absolute',
                  right: -5,
                  top: -5,
                  width: 14,
                  height: 14,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                  borderRadius: 7,
                  border: `1px solid ${visible ? LAMP : LAMP_OFF}`,
                  background: 'var(--dsw-alias-bg-elevated, #ffffff)',
                  color: visible ? LAMP : LAMP_OFF,
                  fontSize: 8,
                  lineHeight: 1,
                  cursor: 'pointer',
                  zIndex: 2,
                  userSelect: 'none',
                },
              },
              '⚙',
            ),
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
