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
var client_1 = require("@prisma/client");
var fs_1 = require("fs");
var path_1 = require("path");
// ESM関連の import や定義は不要
var prisma = new client_1.PrismaClient();
// 関数が csvPath を引数で受け取るように変更
function importKnowledgeData(csvPath) {
    return __awaiter(this, void 0, void 0, function () {
        var absoluteCsvPath, csvData, lines, headers, _loop_1, i, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!csvPath) {
                        console.error('エラー: CSVファイルのパスをコマンドライン引数として指定してください。');
                        process.exit(1);
                    }
                    absoluteCsvPath = path_1.default.resolve(csvPath);
                    if (!fs_1.default.existsSync(absoluteCsvPath)) {
                        console.error("\u30A8\u30E9\u30FC: \u6307\u5B9A\u3055\u308C\u305FCSV\u30D5\u30A1\u30A4\u30EB\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093: ".concat(absoluteCsvPath));
                        process.exit(1);
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 10, 11, 13]);
                    console.log("\u30C7\u30FC\u30BF\u30A4\u30F3\u30DD\u30FC\u30C8\u958B\u59CB: ".concat(absoluteCsvPath));
                    if (!path_1.default.basename(absoluteCsvPath).includes('knowledge.csv')) return [3 /*break*/, 4];
                    console.warn('警告: knowledge.csv が指定されたため、既存のKnowledgeおよびKnowledgeTagデータを削除します。');
                    // 既存のデータを削除
                    return [4 /*yield*/, prisma.knowledgeTag.deleteMany({})];
                case 2:
                    // 既存のデータを削除
                    _a.sent(); // deleteMany を実行
                    return [4 /*yield*/, prisma.knowledge.deleteMany({})];
                case 3:
                    _a.sent(); // deleteMany を実行
                    return [3 /*break*/, 5];
                case 4:
                    console.log('追加入力モード: 既存データは削除しません。');
                    _a.label = 5;
                case 5:
                    csvData = fs_1.default.readFileSync(absoluteCsvPath, 'utf8');
                    lines = csvData.split('\n');
                    if (lines.length < 2) {
                        console.log('CSVにヘッダー行またはデータ行がありません。');
                        return [2 /*return*/];
                    }
                    headers = lines[0].split(',').map(function (h) { return h.trim(); });
                    _loop_1 = function (i) {
                        var values, data, isTemplateBoolean;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    if (!lines[i].trim())
                                        return [2 /*return*/, "continue"];
                                    values = lines[i].split(',');
                                    data = {};
                                    headers.forEach(function (header, index) {
                                        if (values[index] !== undefined) {
                                            var value = values[index].trim();
                                            // Remove surrounding double quotes
                                            if (value.startsWith('"') && value.endsWith('"')) {
                                                value = value.substring(1, value.length - 1);
                                                // Handle escaped double quotes inside if necessary: value = value.replace(/""/g, '"');
                                            }
                                            // Assign value to data object based on header key
                                            // Ensure header matches a key in KnowledgeData
                                            if (header in { main_category: 0, sub_category: 0, detail_category: 0, question: 0, answer: 0, is_template: 0, usage: 0, note: 0, issue: 0 }) { // Basic check
                                                data[header] = value;
                                            }
                                        }
                                    });
                                    isTemplateBoolean = (data.is_template || '').toLowerCase() === 'true';
                                    // Insert into Knowledge table
                                    return [4 /*yield*/, prisma.knowledge.create({
                                            data: {
                                                main_category: data.main_category || null,
                                                sub_category: data.sub_category || null,
                                                detail_category: data.detail_category || null,
                                                question: data.question || null,
                                                answer: data.answer || '', // Default to empty string if null/undefined
                                                is_template: isTemplateBoolean, // Use the converted boolean value
                                                usage: data.usage || null,
                                                note: data.note || null,
                                                issue: data.issue || null
                                            }
                                        })];
                                case 1:
                                    // Insert into Knowledge table
                                    _b.sent();
                                    return [2 /*return*/];
                            }
                        });
                    };
                    i = 1;
                    _a.label = 6;
                case 6:
                    if (!(i < lines.length)) return [3 /*break*/, 9];
                    return [5 /*yield**/, _loop_1(i)];
                case 7:
                    _a.sent();
                    _a.label = 8;
                case 8:
                    i++;
                    return [3 /*break*/, 6];
                case 9:
                    console.log('データインポート完了');
                    return [3 /*break*/, 13];
                case 10:
                    error_1 = _a.sent();
                    console.error('データインポートエラー:', error_1);
                    return [3 /*break*/, 13];
                case 11: return [4 /*yield*/, prisma.$disconnect()];
                case 12:
                    _a.sent();
                    return [7 /*endfinally*/];
                case 13: return [2 /*return*/];
            }
        });
    });
}
// --- 引数処理 --- (スクリプトの最後)
var csvFilePath = process.argv[2];
if (!csvFilePath) {
    console.error('エラー: インポートするCSVファイルのパスをコマンドライン引数として指定してください。');
    console.log('例: npm run import-data src/data/csv/production/knowledge.csv');
    process.exit(1);
}
importKnowledgeData(csvFilePath); // 引数を渡して呼び出し
// --- ここまで --- 
