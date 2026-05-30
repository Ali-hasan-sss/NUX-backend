import http from 'http';
import app from './app';
import { initSocket } from './services/socket.service';

const PORT = Number(process.env.PORT) || 5000;
const HOST = process.env.HOST || '0.0.0.0';
const httpServer = http.createServer(app);

initSocket(httpServer);

httpServer.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT} (LAN: use your PC IP, e.g. http://192.168.x.x:${PORT}/api)`);
});
