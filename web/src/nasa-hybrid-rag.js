/**
 * NASA HYBRID RAG (RETRIEVAL-AUGMENTED GENERATION) ENGINE
 * Combines Lexical BM25 Ranking + Semantic N-Gram Cosine Vector Search
 * with Reciprocal Rank Fusion (RRF) and Maximal Marginal Relevance (MMR).
 * 100% client-side, offline-capable, and grounded strictly in NASA ground truth.
 */

import { NASA_KNOWLEDGE_CORPUS } from './nasa-knowledge-corpus.js';

const STOPWORDS = new Set([
 'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren',
 'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
 'can', 'could', 'did', 'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from',
 'further', 'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself',
 'his', 'how', 'i', 'if', 'in', 'into', 'is', 'isn', 'it', 'its', 'itself', 'just', 'me', 'more',
 'most', 'my', 'myself', 'no', 'nor', 'not', 'now', 'of', 'off', 'on', 'once', 'only', 'or', 'other',
 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'she', 'should', 'so', 'some', 'such',
 'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these', 'they',
 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'we', 'were',
 'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'with', 'would', 'you', 'your'
]);

function tokenize(text) {
 if (!text) return [];
 return text
  .toLowerCase()
  .replace(/[^a-z0-9_°\-]/g, ' ')
  .split(/\s+/)
  .filter(term => term.length >= 2 && !STOPWORDS.has(term));
}

function extractNgrams(text, n = 3) {
 const clean = (text || '').toLowerCase().replace(/[^a-z0-9]/g, ' ');
 const ngrams = new Map();
 for (let i = 0; i <= clean.length - n; i++) {
  const gram = clean.slice(i, i + n);
  ngrams.set(gram, (ngrams.get(gram) || 0) + 1);
 }
 return ngrams;
}

function cosineSimilarity(mapA, mapB) {
 let dotProduct = 0;
 let normA = 0;
 let normB = 0;
 for (const [k, v] of mapA) {
  normA += v * v;
  if (mapB.has(k)) {
   dotProduct += v * mapB.get(k);
  }
 }
 for (const [, v] of mapB) {
  normB += v * v;
 }
 if (!normA || !normB) return 0;
 return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export class NASA_Hybrid_RAG {
 constructor(corpus = NASA_KNOWLEDGE_CORPUS) {
  this.corpus = corpus;
  this.docTokens = [];
  this.docNgrams = [];
  this.invertedIndex = new Map(); // term -> Set of doc indices
  this.docLengths = [];
  this.avgDocLength = 0;

  this.buildIndex();
 }

 buildIndex() {
  let totalLength = 0;
  this.corpus.forEach((doc, idx) => {
   const fullText = `${doc.title} ${doc.content} ${(doc.keywords || []).join(' ')}`;
   const tokens = tokenize(fullText);
   this.docTokens.push(tokens);
   this.docNgrams.push(extractNgrams(fullText));
   this.docLengths.push(tokens.length);
   totalLength += tokens.length;

   tokens.forEach(t => {
    if (!this.invertedIndex.has(t)) {
     this.invertedIndex.set(t, new Set());
    }
    this.invertedIndex.get(t).add(idx);
   });
  });

  this.avgDocLength = totalLength / Math.max(1, this.corpus.length);
 }

 scoreBM25(queryTokens, k1 = 1.2, b = 0.75) {
  const N = this.corpus.length;
  const scores = new Array(N).fill(0);

  queryTokens.forEach(term => {
   const matchingDocs = this.invertedIndex.get(term);
   if (!matchingDocs) return;

   const df = matchingDocs.size;
   const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));

   matchingDocs.forEach(docIdx => {
    const docLen = this.docLengths[docIdx];
    const tf = this.docTokens[docIdx].filter(t => t === term).length;
    const numerator = tf * (k1 + 1);
    const denominator = tf + k1 * (1 - b + b * (docLen / this.avgDocLength));
    scores[docIdx] += idf * (numerator / denominator);
   });
  });

  return scores;
 }

 scoreSemantic(query) {
  const queryNgrams = extractNgrams(query);
  return this.docNgrams.map(docGram => cosineSimilarity(queryNgrams, docGram));
 }

 retrieve(query, { topK = 3, threshold = 0.012 } = {}) {
  const tokens = tokenize(query);
  if (!tokens.length) {
   return {
    gated: true,
    refusal: 'Evidence Gate: Query contains no searchable scientific or geographical terms.',
    passages: [],
    citations: []
   };
  }

  // 1. Lexical BM25 Ranking
  const bm25Scores = this.scoreBM25(tokens);
  const bm25Ranked = bm25Scores
   .map((score, idx) => ({ idx, score }))
   .sort((a, b) => b.score - a.score);

  const bm25RankMap = new Map();
  bm25Ranked.forEach((item, rank) => bm25RankMap.set(item.idx, rank + 1));

  // 2. Semantic N-Gram Cosine Ranking
  const semanticScores = this.scoreSemantic(query);
  const semanticRanked = semanticScores
   .map((score, idx) => ({ idx, score }))
   .sort((a, b) => b.score - a.score);

  const semanticRankMap = new Map();
  semanticRanked.forEach((item, rank) => semanticRankMap.set(item.idx, rank + 1));

  // 3. Reciprocal Rank Fusion (RRF, constant k = 60)
  const rrfScores = this.corpus.map((_, idx) => {
   const rBM25 = bm25RankMap.get(idx) || 999;
   const rSem = semanticRankMap.get(idx) || 999;
   const rrf = (1 / (60 + rBM25)) + (1 / (60 + rSem));
   return { idx, rrf, bm25: bm25Scores[idx], semantic: semanticScores[idx] };
  });

  rrfScores.sort((a, b) => b.rrf - a.rrf);

  // 4. Evidence Gating: Reject if no authentic NASA passage meets threshold
  const bestCandidate = rrfScores[0];
  if (!bestCandidate || bestCandidate.bm25 === 0 && bestCandidate.semantic < 0.15 || bestCandidate.rrf < threshold) {
   return {
    gated: true,
    refusal: 'Evidence Gate: No authentic NASA PDS, USGS, or HLS2 planetary records match this query.',
    passages: [],
    citations: [],
    trace: {
     bm25Top: bm25Ranked[0]?.score || 0,
     semanticTop: semanticRanked[0]?.score || 0,
     rrfTop: bestCandidate?.rrf || 0
    }
   };
  }

  // 5. Maximal Marginal Relevance (MMR) Diversification
  const selected = [];
  const candidates = rrfScores.slice(0, Math.min(8, rrfScores.length));

  while (selected.length < topK && candidates.length > 0) {
   let bestIdxInCandidates = 0;
   let bestMMRScore = -Infinity;

   for (let i = 0; i < candidates.length; i++) {
    const cand = candidates[i];
    const relevance = cand.rrf;

    // Redundancy penalty with already chosen passages
    let maxSimWithSelected = 0;
    for (const sel of selected) {
     const sim = cosineSimilarity(this.docNgrams[cand.idx], this.docNgrams[sel.idx]);
     if (sim > maxSimWithSelected) maxSimWithSelected = sim;
    }

    const mmrScore = 0.75 * relevance - 0.25 * maxSimWithSelected;
    if (mmrScore > bestMMRScore) {
     bestMMRScore = mmrScore;
     bestIdxInCandidates = i;
    }
   }

   selected.push(candidates[bestIdxInCandidates]);
   candidates.splice(bestIdxInCandidates, 1);
  }

  // Format retrieved passages & citations
  const passages = selected.map((item, index) => {
   const doc = this.corpus[item.idx];
   return {
    citationNumber: index + 1,
    id: doc.id,
    title: doc.title,
    domain: doc.domain,
    content: doc.content,
    provenance: doc.provenance,
    score: item.rrf.toFixed(4)
   };
  });

  const citations = passages.map(p => `[${p.citationNumber}] ${p.provenance.source}: ${p.provenance.reference}`);

  return {
   gated: false,
   passages,
   citations,
   contextSnippet: passages.map(p => `[${p.citationNumber}] ${p.title} (${p.provenance.source}): ${p.content}`).join('\n\n'),
   trace: {
    retrievedCount: passages.length,
    topProvenance: passages[0]?.provenance?.source,
    topScore: bestCandidate.rrf.toFixed(4)
   }
  };
 }
}

export const nasaHybridRAG = new NASA_Hybrid_RAG();
