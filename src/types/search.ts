export interface SearchResult {
  id: number;
  question: string;
  answer: string;
  main_category: string;
  sub_category: string;
  detail_category: string | null;
  rank: number;
  tags: string[];
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  query: string;
  tsQuery: string;
} 