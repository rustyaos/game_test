const { WebSocketServer } = require('ws');

const wss = new WebSocketServer({ port: 8080 });

console.log('✅ WebSocket server is running on ws://localhost:8080');

wss.on('connection', function connection(ws) {
  console.log('[Server] Client connected');

  ws.on('error', console.error);

  ws.on('message', function message(data) {
    console.log('[Server] Received:', data.toString());
    
    try {
        const parsed = JSON.parse(data);
        
        // 简单的自动回复逻辑用于测试
        if (parsed.type === 'ENTITY_SPAWN') {
            console.log(`[Server] Spawning entity: ${parsed.payload.id}`);
            // 模拟服务器下发指令
            ws.send(JSON.stringify({
                type: 'UPDATE_SPEED',
                payload: 0.02 // 设置一个旋转速度
            }));
        }
    } catch (e) {
        console.log('[Server] Non-JSON message received');
    }
  });

  // 发送欢迎消息
  ws.send(JSON.stringify({ type: 'INFO', payload: 'Welcome to Game Server' }));
});