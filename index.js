// dsh-call-panel · 宿主半边
// 只做三件事：给 agent 一个 call_user 工具；给界面一个「有没有人要叫主人」的接口；
// 给界面一个「打开留言本」的接口（白名单，只认这一个文件）。
// 不读写任何文件，不碰配置。

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROUTE_PREFIX = '/call-panel';
const MAX_PENDING = 20;
/** 只允许打开这几个；键是界面传的 key，值是相对工作区的路径。 */
const OPENABLE = { liuyanben: path.join('留言本', '留言本.md') };

/**
 * 找工作区根目录。不能只信 process.cwd()——Electron 的 cwd 常常是安装目录，
 * 不是工作区。所以：环境变量、cwd 及上级、再兜一个已知路径，谁先命中用谁。
 */
function findWorkspaceRoot() {
  const looksRight = (dir) => {
    try {
      return fs.existsSync(path.join(dir, '留言本', '留言本.md'));
    } catch {
      return false;
    }
  };
  const seeds = [process.env.DSH_WORKSPACE, process.cwd()].filter(Boolean);
  for (const seed of seeds) {
    let dir = path.resolve(seed);
    for (let depth = 0; depth < 6; depth += 1) {
      if (looksRight(dir)) return dir;
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  const fallback = 'D:\\Documents\\deepseek-harness\\default-workspace';
  return looksRight(fallback) ? fallback : null;
}

let seq = 0;
/** 还没被确认的呼叫。进程内内存，重启就清空——这是叫人的，不是存档。 */
const pending = [];

function sendJson(response, code, value) {
  const body = JSON.stringify(value);
  response.statusCode = code;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.setHeader('cache-control', 'no-store');
  response.end(body);
}

function sameOrigin(request) {
  const origin = request.headers.origin;
  if (typeof origin !== 'string' || origin === '') return true;
  try {
    return new URL(origin).host === request.headers.host;
  } catch {
    return false;
  }
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let data = '';
    request.on('data', (chunk) => {
      data += chunk;
      if (data.length > 65536) {
        reject(new Error('body too large'));
        request.destroy();
      }
    });
    request.on('end', () => resolve(data));
    request.on('error', reject);
  });
}

export function apply(ctx) {
  ctx.inject(['webServer'], (webCtx) => {
    webCtx.effect(() =>
      webCtx.webServer.register({
        kind: 'prefix',
        path: ROUTE_PREFIX,
        handler: async (request, response) => {
          const method = request.method ?? 'GET';
          let routePath;
          try {
            routePath = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`)
              .pathname;
          } catch {
            sendJson(response, 400, { error: 'bad url' });
            return;
          }

          if (routePath === `${ROUTE_PREFIX}/pending` && method === 'GET') {
            sendJson(response, 200, { items: pending.filter((item) => !item.ack) });
            return;
          }

          if (routePath === `${ROUTE_PREFIX}/ack` && method === 'POST') {
            if (!sameOrigin(request)) {
              sendJson(response, 403, { error: 'cross-origin request refused' });
              return;
            }
            let payload;
            try {
              payload = JSON.parse(await readBody(request));
            } catch {
              sendJson(response, 400, { error: 'expected JSON' });
              return;
            }
            const id = payload && payload.id;
            const item = pending.find((entry) => entry.id === id);
            if (item) item.ack = true;
            sendJson(response, 200, { ok: true });
            return;
          }

          if (routePath === `${ROUTE_PREFIX}/available` && method === 'GET') {
            const root = findWorkspaceRoot();
            const target = root
              ? path.resolve(root, path.join('留言本', '留言本.md'))
              : null;
            sendJson(response, 200, {
              liuyanben: Boolean(target && fs.existsSync(target)),
            });
            return;
          }

          if (routePath === `${ROUTE_PREFIX}/open` && method === 'GET') {
            let key = '';
            try {
              key = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`)
                .searchParams.get('key') ?? '';
            } catch {
              key = '';
            }
            const relative = OPENABLE[key];
            if (!relative) {
              sendJson(response, 404, { error: 'not openable' });
              return;
            }
            const root = findWorkspaceRoot();
            if (!root) {
              sendJson(response, 500, { error: 'workspace not found', cwd: process.cwd() });
              return;
            }
            const absolute = path.resolve(root, relative);
            if (!absolute.startsWith(path.resolve(root)) || !fs.existsSync(absolute)) {
              sendJson(response, 404, { error: 'missing', root, absolute });
              return;
            }
            try {
              spawn('explorer.exe', [absolute], { detached: true, stdio: 'ignore' }).unref();
              sendJson(response, 200, { ok: true, path: absolute });
            } catch (error) {
              sendJson(response, 500, { error: String((error && error.message) || error) });
            }
            return;
          }

          sendJson(response, 404, { error: 'no such route' });
        },
      }),
    );
  });

  ctx.inject(['tools'], (toolCtx) => {
    toolCtx.effect(() =>
      toolCtx.tools.register({
        name: 'call_user',
        description:
          '给主人弹一个屏幕中间的窗口：一句话摘要，带【确认】和【跳转】。用在“弄好了叫我”这类约定上——任务收尾时调用，主人不管在哪个会话都能看见。title 和 body 要用人话：说清“什么好了”，不要放文件路径、sha、参数名或英文关键词列表；主人是普通人类，不是工程师。',
        parameters: {
          type: 'object',
          additionalProperties: false,
          required: ['from', 'title'],
          properties: {
            from: { type: 'string', description: '谁在叫：伙伴名，例如 打样、知微' },
            title: { type: 'string', description: '一句话摘要，显示成大标题' },
            body: { type: 'string', description: '可选：第二行细节' },
            session: {
              type: 'string',
              description: '可选：点【跳转】时打开的会话 id；不填则只显示【确认】',
            },
          },
        },
        output: {
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['ok', 'id'],
            properties: { ok: { type: 'boolean' }, id: { type: 'string' } },
          },
          render: (args, value) => [
            { type: 'text', text: `已经在主人屏幕上弹了一个窗口（${value.id}）。` },
          ],
        },
        async execute(args) {
          const from = String(args.from ?? '').trim() || '伙伴';
          const title = String(args.title ?? '').trim() || '有事找你';
          const body = String(args.body ?? '').trim();
          const session = String(args.session ?? '').trim();
          if (pending.length >= MAX_PENDING) {
            pending.splice(0, pending.length - MAX_PENDING + 1);
          }
          const id = `call_${Date.now().toString(36)}_${++seq}`;
          pending.push({ id, from, title, body, session, at: Date.now(), ack: false });
          return { ok: true, id };
        },
      }),
    );
  });
}
