import { spawn } from 'node:child_process';

export function connectMcp(command) {
  const child = spawn(command[0], command.slice(1), { stdio: ['pipe', 'pipe', 'pipe'] });
  const pending = new Map();
  let sequence = 0;
  let buffer = '';
  let stderr = '';
  let terminalError;
  const fail = error => {
    terminalError ||= error;
    for (const request of pending.values()) { clearTimeout(request.timer); request.reject(terminalError); }
    pending.clear();
  };
  child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-4000); });
  child.stdout.on('data', chunk => {
    buffer += chunk;
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      if (!line.trim()) continue;
      let response;
      try { response = JSON.parse(line); } catch {
        fail(new Error('Non-JSON stdout from MCP'));
        child.kill();
        return;
      }
      const request = pending.get(response.id);
      if (request) {
        pending.delete(response.id);
        clearTimeout(request.timer);
        response.error ? request.reject(new Error(JSON.stringify(response.error))) : request.resolve(response.result);
      }
    }
  });
  child.on('error', fail);
  // close follows drained stdout; exit may precede the final response.
  child.on('close', code => fail(new Error(`MCP exited (${code}): ${stderr}`)));
  child.stdin.on('error', fail);
  const request = (method, params) => new Promise((resolve, reject) => {
    if (terminalError) { reject(terminalError); return; }
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Timeout: ${method}`)); }, 20000);
    pending.set(id, { resolve, reject, timer });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
  return {
    request,
    async initialize() {
      const result = await request('initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'excalidraw-live-acceptance', version: '1.0.0' } });
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
      return result;
    },
    async call(name, args = {}) {
      const result = await request('tools/call', { name, arguments: args });
      if (result.isError) throw new Error(JSON.stringify(result));
      return result;
    },
    close() {
      if (!terminalError) fail(new Error('MCP client closed'));
      child.stdin.end();
      child.kill();
    }
  };
}
