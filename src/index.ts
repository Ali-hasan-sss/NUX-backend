import app from './app';
import fs from 'fs';
import https from 'https';

const PORT = parseInt(process.env.PORT || '5000', 10);
const HOST = '0.0.0.0'; // للسماح بالوصول من جميع الأجهزة على الشبكة

// استخدم الشهادة الجديدة التي تضم myapi.local
const options = {
  key: fs.readFileSync('C:/mkcert/myapi.local+4-key.pem'),
  cert: fs.readFileSync('C:/mkcert/myapi.local+4.pem'),
};

// تشغيل السيرفر باستخدام HTTPS فقط
https.createServer(options, app).listen(PORT, HOST, () => {
  console.log(`🚀 Backend running on https://myapi.local:${PORT}`);
  console.log(`📱 Network access: https://myapi.local:${PORT}`);
  console.log(`🌐 Local access: https://localhost:${PORT}`);
  console.log('✅ Accessible from all devices on the network!');
});
