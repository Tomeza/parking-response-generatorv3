"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
// tests/testSearchDimensions.ts
var client_1 = require("@prisma/client");
var embeddings_1 = require("../src/lib/embeddings"); // パスが正しいか確認
function runTest() {
    return __awaiter(this, void 0, void 0, function () {
        var prisma, testQuery, testLimit, defaultEfSearch, res, efValue;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    prisma = new client_1.PrismaClient();
                    testQuery = '駐車場の予約方法を教えて';
                    testLimit = 3;
                    defaultEfSearch = undefined;
                    console.log('--- １．デフォルト (512次元になるはず) ---');
                    return [4 /*yield*/, (0, embeddings_1.searchSimilarKnowledge)(testQuery, testLimit, defaultEfSearch, undefined)];
                case 1:
                    res = _a.sent();
                    console.log(res);
                    console.log('--- ２．明示的に512次元 ---');
                    return [4 /*yield*/, (0, embeddings_1.searchSimilarKnowledge)(testQuery, testLimit, defaultEfSearch, 512)];
                case 2:
                    res = _a.sent();
                    console.log(res);
                    console.log('--- ３．1536次元指定 ---');
                    return [4 /*yield*/, (0, embeddings_1.searchSimilarKnowledge)(testQuery, testLimit, defaultEfSearch, 1536)];
                case 3:
                    res = _a.sent();
                    console.log(res);
                    efValue = 100;
                    console.log("--- \uFF14\uFF0EefSearchValue: ".concat(efValue, " (512\u6B21\u5143) ---"));
                    return [4 /*yield*/, (0, embeddings_1.searchSimilarKnowledge)(testQuery, testLimit, efValue, 512)];
                case 4:
                    res = _a.sent();
                    console.log(res);
                    // --- ５．efSearchValue を指定した場合のテスト (1536次元) ---
                    console.log("--- \uFF15\uFF0EefSearchValue: ".concat(efValue, " (1536\u6B21\u5143) ---"));
                    return [4 /*yield*/, (0, embeddings_1.searchSimilarKnowledge)(testQuery, testLimit, efValue, 1536)];
                case 5:
                    res = _a.sent();
                    console.log(res);
                    return [4 /*yield*/, prisma.$disconnect()];
                case 6:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
runTest().catch(function (err) {
    console.error(err);
    process.exit(1);
});
