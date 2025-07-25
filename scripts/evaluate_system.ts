// scripts/evaluate_system.ts

const fs = require('fs').promises;
const path = require('path');
// Note: Install necessary dependencies: npm install axios csv-parser csv-writer
// Or: yarn add axios csv-parser csv-writer
// Also ensure you have typescript and node types: npm install -D typescript @types/node
// Or: yarn add -D typescript @types/node
const axiosInstance = require('axios'); // Renamed to avoid conflict with global type
const csv = require('csv-parser'); // Placeholder for CSV parsing
const { createObjectCsvWriter } = require('csv-writer'); // Placeholder for CSV writing
const { Readable } = require('stream');

// --- Interfaces ---
interface TestQuery {
  query_id: string;
  variation_of_query_id: string;
  query_type: string;
  persona: string;
  query_text: string;
  context: string;
  expected_knowledge_ids: string;
  expected_intents: string;
  ideal_answer_summary: string;
  tags: string;
  notes: string;
}

interface ApiResponse {
  response: string;
  knowledge_id?: number; // API might return number or null/undefined
  score?: number;
  score_details?: any;
  performance?: { total_time_ms: number };
  // Add other potential fields from your actual API response
}

// Combined structure for results, including calculated metrics
interface EvaluationResult extends TestQuery {
  // Fields from API Response
  api_response_text: string;
  api_knowledge_id: string; // Store as string for consistency (might be multiple, or null)
  api_score?: number;
  api_score_details?: any;
  api_total_time_ms?: number;
  // Calculated Metrics
  accuracy: number; // 0 or 1 for simple match, could be extended
  // Fields for manual evaluation (added later)
  relevance?: number;
  comprehensiveness?: number;
  naturalness?: number;
  intent_understanding?: number;
  complex_query_handling?: number;
}

// --- Configuration ---
const PROJECT_ROOT = path.resolve(__dirname, '..'); // scripts -> project root
const TEST_QUERIES_PATH = path.join(PROJECT_ROOT, 'data/test_queries.csv');
const RESULTS_DIR = path.join(PROJECT_ROOT, 'evaluation_results');
const API_ENDPOINT = 'http://localhost:3000/api/query'; // Adjust if your API runs elsewhere

// --- Helper Functions (Stubs) ---

async function loadTestQueries(filePath: string): Promise<TestQuery[]> {
  console.log(`Loading test queries from ${filePath}...`);
  const results: TestQuery[] = [];
  // Basic implementation using csv-parser (requires installation)
  try {
    const fileContent = await fs.readFile(filePath, { encoding: 'utf8' });
    const stream = Readable.from(fileContent);

    await new Promise<void>((resolve, reject) => {
      stream
        .pipe(csv())
        .on('data', (data: any) => {
          // Basic validation or transformation if needed
          const query: TestQuery = {
            query_id: data.query_id || '',
            variation_of_query_id: data.variation_of_query_id || '',
            query_type: data.query_type || '',
            persona: data.persona || '',
            query_text: data.query_text || '',
            context: data.context || '',
            expected_knowledge_ids: data.expected_knowledge_ids || '',
            expected_intents: data.expected_intents || '',
            ideal_answer_summary: data.ideal_answer_summary || '',
            tags: data.tags || '',
            notes: data.notes || ''
          };
          results.push(query);
        })
        .on('end', () => {
          console.log(`Loaded ${results.length} test queries.`);
          resolve();
        })
        .on('error', (error) => {
          console.error('Error parsing CSV:', error);
          reject(error);
        });
    });
  } catch (error) {
    console.error(`Error reading or parsing file ${filePath}:`, error);
    throw error; // Rethrow to stop execution if file loading fails
  }
  return results;
}

async function queryAPI(query: TestQuery): Promise<ApiResponse> {
  console.log(`  Querying API for [${query.query_id}] (${query.persona}): "${query.query_text.substring(0, 50)}..."`);
  try {
    const response = await axiosInstance.get(API_ENDPOINT, {
      params: {
        q: query.query_text,
        // Add other potential params like tags if needed
        // tags: query.tags 
      },
      timeout: 10000 // 10 second timeout
    });
    // Basic validation of response structure
    if (response.data && typeof response.data.response === 'string'){
        return response.data as ApiResponse;
    } else {
        console.warn(`  [${query.query_id}] Received unexpected API response structure:`, response.data);
        return { response: 'Error: Unexpected API response structure' }; // Return error structure
    }
  } catch (error: any) {
    console.error(`  [${query.query_id}] API query failed:`, error.message);
    // Return a consistent error structure
    return {
        response: `Error: API query failed - ${error.message}`,
    };
  }
}

function calculateAccuracy(expectedStr: string, actualId?: number): number {
    if (actualId === undefined || actualId === null) return 0; // No match if API didn't return an ID
    if (!expectedStr) return 0; // Cannot calculate if expectation is empty (though maybe should be 1 if actual is also empty? Decide later)

    const expectedIds = expectedStr.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id));
    if (expectedIds.length === 0) return 0; // Cannot calculate if expected IDs are invalid

    // Simple accuracy: is the returned ID among the expected IDs?
    return expectedIds.includes(actualId) ? 1 : 0;
}

async function saveResults(results: EvaluationResult[], resultsDir: string): Promise<void> {
  if (results.length === 0) {
    console.log("No results to save.");
    return;
  }
  await fs.mkdir(resultsDir, { recursive: true }); // Ensure directory exists
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = path.join(resultsDir, `evaluation_results_${timestamp}.csv`);
  console.log(`Saving ${results.length} results to ${filePath}...`);

  const header = Object.keys(results[0]).map(key => ({ id: key, title: key }));

  const csvWriter = createObjectCsvWriter({
    path: filePath,
    header: header,
    alwaysQuote: true,
  });

  try {
    await csvWriter.writeRecords(results);
    console.log('Results saved successfully.');
  } catch (error) {
    console.error(`Error writing results to CSV file ${filePath}:`, error);
  }
}

function calculateOverallStats(results: EvaluationResult[]): any {
  if (results.length === 0) return { count: 0 };

  const totalCount = results.length;
  const sumAccuracy = results.reduce((sum, r) => sum + r.accuracy, 0);
  const avgAccuracy = totalCount > 0 ? sumAccuracy / totalCount : 0;

  const validTimes = results.map(r => r.api_total_time_ms).filter(t => t !== undefined && t !== null) as number[];
  const sumTime = validTimes.reduce((sum, t) => sum + t, 0);
  const avgTime = validTimes.length > 0 ? sumTime / validTimes.length : 0;

  const stats = {
    total_queries: totalCount,
    average_accuracy: avgAccuracy.toFixed(3),
    average_response_time_ms: avgTime.toFixed(2),
    // Add more stats as needed (e.g., success rate, error count)
  };
  console.log("--- Overall Statistics ---");
  console.table(stats);
  return stats;
}

function calculatePersonaStats(results: EvaluationResult[]): any {
  if (results.length === 0) return {};

  const statsByPersona: { [persona: string]: any } = {};
  const personas = [...new Set(results.map(r => r.persona))];

  personas.forEach(persona => {
    const personaResults = results.filter(r => r.persona === persona);
    const totalCount = personaResults.length;
    if (totalCount === 0) return;

    const sumAccuracy = personaResults.reduce((sum, r) => sum + r.accuracy, 0);
    const avgAccuracy = sumAccuracy / totalCount;

    const validTimes = personaResults.map(r => r.api_total_time_ms).filter(t => t !== undefined && t !== null) as number[];
    const sumTime = validTimes.reduce((sum, t) => sum + t, 0);
    const avgTime = validTimes.length > 0 ? sumTime / validTimes.length : 0;

    statsByPersona[persona] = {
      total_queries: totalCount,
      average_accuracy: avgAccuracy.toFixed(3),
      average_response_time_ms: avgTime.toFixed(2),
    };
  });

  console.log("--- Statistics by Persona ---");
  console.table(statsByPersona);
  return statsByPersona;
}

// --- Main Execution ---
async function runEvaluation() {
  console.log('Starting evaluation run...');

  // 1. Load Test Queries
  let allTestQueries: TestQuery[]; // Renamed from testQueries
  try {
    allTestQueries = await loadTestQueries(TEST_QUERIES_PATH);
    if (allTestQueries.length === 0) {
        console.error('No test queries loaded. Exiting.');
        return;
    }
  } catch (error) {
    console.error('Failed to load test queries. Exiting.');
    return;
  }

  // Limit the number of queries to run for faster testing
  // const MAX_QUERIES_TO_RUN = 10; // Set to 10 (from 20)
  // const testQueries = allTestQueries.slice(0, MAX_QUERIES_TO_RUN);
  // console.log(`Running evaluation for the first ${testQueries.length} queries out of ${allTestQueries.length} total.`);
  console.log(`Running evaluation for all ${allTestQueries.length} queries.`);
  
  // 2. Execute Queries and Collect Results
  const results: EvaluationResult[] = [];
  // Using a sequential loop to avoid overwhelming the API endpoint
  for (const query of allTestQueries) { // Changed from testQueries to allTestQueries
    const apiResponse = await queryAPI(query);
    const accuracy = calculateAccuracy(query.expected_knowledge_ids, apiResponse.knowledge_id);
    
    const result: EvaluationResult = {
      ...query,
      api_response_text: apiResponse.response,
      api_knowledge_id: apiResponse.knowledge_id !== undefined && apiResponse.knowledge_id !== null ? String(apiResponse.knowledge_id) : '',
      api_score: apiResponse.score,
      api_score_details: apiResponse.score_details,
      api_total_time_ms: apiResponse.performance?.total_time_ms,
      accuracy
    };
    results.push(result);
    // Optional: Add a small delay between requests if needed
    await new Promise(resolve => setTimeout(resolve, 200)); 
  }
  
  // 3. Save Results
  await saveResults(results, RESULTS_DIR);
  
  // 4. Calculate and Print Stats
  calculateOverallStats(results);
  calculatePersonaStats(results);

  console.log('Evaluation run finished.');
}

// Run the main function
runEvaluation().catch(error => {
  console.error("Evaluation script failed:", error);
  process.exit(1);
}); 