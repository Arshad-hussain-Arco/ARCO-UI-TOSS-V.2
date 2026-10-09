// Runtime configuration. Edit this file in the deployed build (dist/config.js) -
// no rebuild needed. Reload the page after changing it.
//
// API_BASE_URL  Where the backend API lives.
//   ""                         use the value baked in at build time (default "/api")
//   "/api"                     same host as the app; your web server proxies /api to the backend
//   "http://10.0.0.5:8003/api" direct to the backend (the backend must allow CORS + credentials)
//
// WS_BASE_URL   Where the WebSocket server lives, e.g. "ws://10.0.0.5:8004/ws".
//   ""                         derive it from API_BASE_URL (http -> ws, https -> wss)
window.__TOSS_CONFIG__ = {
  API_BASE_URL: "",
  WS_BASE_URL: "",
};
