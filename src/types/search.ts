export interface SearchResult {
  id: number;
  question: string;
  answer: string;
  main_category: string;
  sub_category: string;
  detail_category: string | null;
  rank: number;
  text_rank: number;
  category_weight: number;
  tag_weight: number;
  final_score: number;
  tags: string[];
}

export interface SearchAnalysis {
  alerts: string[];
  dates: string[];
  categories: string[];
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  query: string;
  tsQuery: string;
  analysis: SearchAnalysis;
} 