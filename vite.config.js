var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
function manageMerchantAccessDevApi() {
    return {
        name: 'manage-merchant-access-dev-api',
        apply: 'serve',
        configureServer: function (server) {
            var _this = this;
            server.middlewares.use(function (req, res, next) { return __awaiter(_this, void 0, void 0, function () {
                var requestUrl, method, requestHeaders_1, requestBody, _a, request, handler, response, responseBody, _b, _c, error_1, message;
                var _d;
                return __generator(this, function (_e) {
                    switch (_e.label) {
                        case 0:
                            requestUrl = req.url ? new URL(req.url, 'http://127.0.0.1') : null;
                            if (!requestUrl || requestUrl.pathname !== '/api/manage-merchant-access') {
                                next();
                                return [2 /*return*/];
                            }
                            _e.label = 1;
                        case 1:
                            _e.trys.push([1, 8, , 9]);
                            method = ((_d = req.method) !== null && _d !== void 0 ? _d : 'GET').toUpperCase();
                            requestHeaders_1 = new Headers();
                            Object.entries(req.headers).forEach(function (_a) {
                                var headerName = _a[0], headerValue = _a[1];
                                if (Array.isArray(headerValue)) {
                                    headerValue.forEach(function (value) { return requestHeaders_1.append(headerName, value); });
                                    return;
                                }
                                if (typeof headerValue === 'string') {
                                    requestHeaders_1.set(headerName, headerValue);
                                }
                            });
                            if (!(method === 'GET' || method === 'HEAD')) return [3 /*break*/, 2];
                            _a = undefined;
                            return [3 /*break*/, 4];
                        case 2: return [4 /*yield*/, new Promise(function (resolve, reject) {
                                var chunks = [];
                                req.on('data', function (chunk) {
                                    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
                                });
                                req.on('end', function () { return resolve(Buffer.concat(chunks)); });
                                req.on('error', reject);
                            })];
                        case 3:
                            _a = _e.sent();
                            _e.label = 4;
                        case 4:
                            requestBody = _a;
                            request = new Request(requestUrl.toString(), {
                                method: method,
                                headers: requestHeaders_1,
                                body: requestBody && requestBody.length > 0 ? requestBody : undefined,
                            });
                            return [4 /*yield*/, server.ssrLoadModule('/api/manage-merchant-access.ts')];
                        case 5:
                            handler = (_e.sent()).default;
                            return [4 /*yield*/, handler(request)];
                        case 6:
                            response = _e.sent();
                            res.statusCode = response.status;
                            response.headers.forEach(function (value, key) {
                                res.setHeader(key, value);
                            });
                            _c = (_b = Buffer).from;
                            return [4 /*yield*/, response.arrayBuffer()];
                        case 7:
                            responseBody = _c.apply(_b, [_e.sent()]);
                            res.end(responseBody);
                            return [3 /*break*/, 9];
                        case 8:
                            error_1 = _e.sent();
                            message = error_1 instanceof Error ? error_1.message : 'Internal Server Error';
                            res.statusCode = 500;
                            res.setHeader('Content-Type', 'application/json');
                            res.end(JSON.stringify({ error: message }));
                            return [3 /*break*/, 9];
                        case 9: return [2 /*return*/];
                    }
                });
            }); });
        },
    };
}
export default defineConfig(function (_a) {
    var mode = _a.mode;
    var loadedEnv = loadEnv(mode, process.cwd(), '');
    Object.assign(process.env, loadedEnv);
    var publicSupabaseUrl = loadedEnv.VITE_SUPABASE_URL || loadedEnv.SUPABASE_URL || '';
    var publicSupabaseAnonKey = loadedEnv.VITE_SUPABASE_ANON_KEY || loadedEnv.SUPABASE_ANON_KEY || '';
    return {
        plugins: [react(), manageMerchantAccessDevApi()],
        define: {
            'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(publicSupabaseUrl),
            'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(publicSupabaseAnonKey),
        },
    };
});
