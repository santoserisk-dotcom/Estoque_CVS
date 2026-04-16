const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = 3001;

// Middleware para responder OPTIONS imediatamente e adicionar CORS
app.use((req, res, next) => {
  // Adiciona headers CORS em todas as respostas
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Se for uma requisição OPTIONS, responde com 200 e para aqui
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

// Proxy reverso
app.use('/', createProxyMiddleware({
  target: 'https://script.google.com',
  changeOrigin: true,
  onProxyRes: (proxyRes, req, res) => {
    // Garante o header CORS também na resposta do proxy
    proxyRes.headers['access-control-allow-origin'] = '*';
  }
}));

app.listen(PORT, () => {
  console.log(`Proxy CORS rodando em http://localhost:${PORT}`);
});