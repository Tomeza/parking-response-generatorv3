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
exports.generateEmbedding = generateEmbedding;
exports.generateAllKnowledgeEmbeddings = generateAllKnowledgeEmbeddings;
exports.searchSimilarKnowledge = searchSimilarKnowledge;
console.log('****** src/lib/embeddings.ts LOADED - LATEST VERSION CHECK ******');
var openai_1 = require("openai");
var db_1 = require("./db");
// OpenAI クライアント初期化
var openai = new openai_1.default({
    apiKey: process.env.OPENAI_API_KEY,
});
// ベクトル埋め込みのキャッシュ
var embeddingCache = {};
/**
 * テキストの埋め込みベクトルを生成する
 * @param text テキスト
 * @param targetDimensions オプションで次元数を受け取る
 * @returns 埋め込みベクトル
 */
function generateEmbedding(text, targetDimensions) {
    return __awaiter(this, void 0, void 0, function () {
        var cacheKey, createParams, response, embedding, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    // テキストが空の場合、空の配列を返す
                    if (!text || text.trim() === '') {
                        return [2 /*return*/, []];
                    }
                    cacheKey = "".concat(text.trim().toLowerCase(), "_dim:").concat(targetDimensions || 'default');
                    if (embeddingCache[cacheKey]) {
                        return [2 /*return*/, embeddingCache[cacheKey]];
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    createParams = {
                        model: 'text-embedding-3-small',
                        input: text.trim(),
                    };
                    if (targetDimensions) {
                        createParams.dimensions = targetDimensions;
                    }
                    return [4 /*yield*/, openai.embeddings.create(createParams)];
                case 2:
                    response = _a.sent();
                    embedding = response.data[0].embedding;
                    // キャッシュに保存
                    embeddingCache[cacheKey] = embedding;
                    return [2 /*return*/, embedding];
                case 3:
                    error_1 = _a.sent();
                    console.error('Embedding generation error:', error_1);
                    throw new Error('Failed to generate embedding');
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * Knowledgeテーブルの全レコードに埋め込みベクトルを生成して保存する
 * @param targetDimensions 生成する次元数 (未指定なら1536)
 * @param targetColumnName 保存先のカラム名 (未指定なら 'embedding_vector')
 * @returns 処理されたレコード数
 */
function generateAllKnowledgeEmbeddings(targetDimensions, targetColumnName) {
    return __awaiter(this, void 0, void 0, function () {
        var knowledgeItems_1, processedCount_1, _loop_1, i, error_2;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 6, , 7]);
                    return [4 /*yield*/, db_1.prisma.knowledge.findMany({
                            select: {
                                id: true,
                                question: true,
                                answer: true,
                            },
                        })];
                case 1:
                    knowledgeItems_1 = _a.sent();
                    console.log("Generating embeddings for ".concat(knowledgeItems_1.length, " knowledge items. Target Dims: ").concat(targetDimensions || 'default (1536)', ", Target Column: ").concat(targetColumnName || 'embedding_vector'));
                    processedCount_1 = 0;
                    _loop_1 = function (i) {
                        var batch;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    batch = knowledgeItems_1.slice(i, i + 10);
                                    return [4 /*yield*/, Promise.all(batch.map(function (item) { return __awaiter(_this, void 0, void 0, function () {
                                            var text, embedding, columnToUpdate, error_3;
                                            return __generator(this, function (_a) {
                                                switch (_a.label) {
                                                    case 0:
                                                        text = "".concat(item.question || '', " ").concat(item.answer || '').trim();
                                                        if (!text)
                                                            return [2 /*return*/];
                                                        _a.label = 1;
                                                    case 1:
                                                        _a.trys.push([1, 6, , 7]);
                                                        return [4 /*yield*/, generateEmbedding(text, targetDimensions)];
                                                    case 2:
                                                        embedding = _a.sent();
                                                        columnToUpdate = targetColumnName || "embedding_vector";
                                                        if (!(embedding && embedding.length > 0)) return [3 /*break*/, 4];
                                                        return [4 /*yield*/, db_1.prisma.$executeRawUnsafe("UPDATE \"Knowledge\" SET \"".concat(columnToUpdate, "\" = $1::vector, \"updatedAt\" = NOW() WHERE id = $2"), embedding, item.id)];
                                                    case 3:
                                                        _a.sent();
                                                        processedCount_1++;
                                                        return [3 /*break*/, 5];
                                                    case 4:
                                                        console.warn("Skipping update for item ".concat(item.id, " due to empty embedding or generation failure."));
                                                        _a.label = 5;
                                                    case 5:
                                                        if (processedCount_1 % 50 === 0 || processedCount_1 === knowledgeItems_1.length || processedCount_1 === batch.length) {
                                                            console.log("Processed ".concat(processedCount_1, "/").concat(knowledgeItems_1.length, " items."));
                                                        }
                                                        return [3 /*break*/, 7];
                                                    case 6:
                                                        error_3 = _a.sent();
                                                        console.error("Error processing item ".concat(item.id, " for column ").concat(targetColumnName || 'embedding_vector', ":"), error_3);
                                                        return [3 /*break*/, 7];
                                                    case 7: return [2 /*return*/];
                                                }
                                            });
                                        }); }))];
                                case 1:
                                    _b.sent();
                                    return [2 /*return*/];
                            }
                        });
                    };
                    i = 0;
                    _a.label = 2;
                case 2:
                    if (!(i < knowledgeItems_1.length)) return [3 /*break*/, 5];
                    return [5 /*yield**/, _loop_1(i)];
                case 3:
                    _a.sent();
                    _a.label = 4;
                case 4:
                    i += 10;
                    return [3 /*break*/, 2];
                case 5:
                    console.log("Completed embedding generation for ".concat(processedCount_1, " items for column ").concat(targetColumnName || 'embedding_vector', "."));
                    return [2 /*return*/, processedCount_1];
                case 6:
                    error_2 = _a.sent();
                    console.error("Error in generateAllKnowledgeEmbeddings for column ".concat(targetColumnName || 'embedding_vector', ":"), error_2);
                    throw error_2;
                case 7: return [2 /*return*/];
            }
        });
    });
}
/**
 * テキストに最も関連する知識エントリを検索する
 * @param query 検索クエリ
 * @param limit 取得する最大件数
 * @param efSearchValue オプションで hnsw.ef_search の値を受け取る
 * @param targetDimensions 検索対象の次元数を指定
 * @returns 関連度スコア付きの知識エントリ配列
 */
function searchSimilarKnowledge(query_1) {
    return __awaiter(this, arguments, void 0, function (query, limit, efSearchValue, targetDimensions // 512 or 1536
    ) {
        var dims, queryEmbedding, columnName, columnCastDimension, queryEmbeddingVector, sql, results, error_4;
        if (limit === void 0) { limit = 10; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.time('SSK_Total');
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 7, , 8]);
                    if (!query || query.trim() === '') {
                        console.timeEnd('SSK_Total');
                        return [2 /*return*/, []];
                    }
                    console.log("SSK received efSearchValue: ".concat(efSearchValue, ", type: ").concat(typeof efSearchValue, ", targetDimensions: ").concat(targetDimensions));
                    if (!(efSearchValue && efSearchValue > 0)) return [3 /*break*/, 3];
                    console.log("SSK condition (efSearchValue && efSearchValue > 0) is TRUE. Attempting SET LOCAL.");
                    console.time('SSK_setEfSearch');
                    return [4 /*yield*/, db_1.prisma.$executeRawUnsafe("SET LOCAL hnsw.ef_search = ".concat(Number(efSearchValue), ";"))];
                case 2:
                    _a.sent();
                    console.log("Executed: SET LOCAL hnsw.ef_search = ".concat(Number(efSearchValue)));
                    console.timeEnd('SSK_setEfSearch');
                    return [3 /*break*/, 4];
                case 3:
                    console.log("SSK condition (efSearchValue && efSearchValue > 0) is FALSE. Skipping SET LOCAL.");
                    _a.label = 4;
                case 4:
                    dims = (targetDimensions === 1536 ? 1536 : 512);
                    console.time('SSK_generateEmbedding');
                    return [4 /*yield*/, generateEmbedding(query, dims)];
                case 5:
                    queryEmbedding = _a.sent();
                    console.timeEnd('SSK_generateEmbedding');
                    if (!queryEmbedding || queryEmbedding.length === 0) {
                        console.warn('Failed to generate query embedding or got empty embedding.');
                        console.timeEnd('SSK_Total');
                        return [2 /*return*/, []];
                    }
                    console.time('SSK_prismaQueryRaw');
                    columnName = dims === 1536
                        ? 'embedding_vector_1536'
                        : 'embedding_vector';
                    columnCastDimension = dims;
                    queryEmbeddingVector = queryEmbedding;
                    sql = "\n    SELECT\n      id,\n      1 - (".concat(columnName, " <=> $1::vector(").concat(columnCastDimension, ")) AS similarity\n    FROM \"Knowledge\"\n    WHERE ").concat(columnName, " IS NOT NULL\n    ORDER BY similarity DESC\n    LIMIT $2\n  ");
                    console.debug("searchSimilarKnowledge \u2192 using column=".concat(columnName, ", dimension=").concat(columnCastDimension));
                    return [4 /*yield*/, db_1.prisma.$queryRawUnsafe(sql, // SQL文字列を直接埋め込むのではなく、変数sqlを使用
                        queryEmbeddingVector, // $1
                        limit // $2
                        )];
                case 6:
                    results = _a.sent();
                    console.timeEnd('SSK_prismaQueryRaw');
                    console.timeEnd('SSK_Total');
                    return [2 /*return*/, results];
                case 7:
                    error_4 = _a.sent();
                    console.error('Error in searchSimilarKnowledge:', error_4);
                    console.timeEnd('SSK_Total');
                    return [2 /*return*/, []];
                case 8: return [2 /*return*/];
            }
        });
    });
}
