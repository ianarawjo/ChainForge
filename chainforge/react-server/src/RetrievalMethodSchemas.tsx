import { RunsIn } from "./backend/ragCapabilities";
import { ModelSettingsDict } from "./backend/typing";
import {
  BROWSER_EMBEDDING_MODELS,
  DEFAULT_BROWSER_EMBEDDING_MODEL,
} from "./backend/browserEmbeddings";

// Available embedding models
export const embeddingProviders = [
  {
    label: "🤗 HuggingFace Transformers",
    value: "huggingface",
    models: [
      "sentence-transformers/all-MiniLM-L6-v2",
      "sentence-transformers/all-mpnet-base-v2",
      "thenlper/gte-large",
      "BAAI/bge-large-en-v1.5",
    ],
  },
  {
    label: "🤖 OpenAI Embeddings",
    value: "openai",
    models: [
      "text-embedding-ada-002",
      "text-embedding-3-small",
      "text-embedding-3-large",
    ],
  },
  {
    label: "🔷 Azure OpenAI Embeddings",
    value: "azure-openai",
    models: [],
  },
  {
    label: "💬 Cohere Embeddings",
    value: "cohere",
    models: [
      "embed-english-v2.0",
      "embed-multilingual-v2.0",
      "embed-english-light-v2.0",
    ],
  },
  {
    label: "🧠 Sentence Transformers",
    value: "sentence-transformers",
    models: [
      "all-MiniLM-L6-v2",
      "all-mpnet-base-v2",
      "paraphrase-MiniLM-L3-v2",
      "all-distilroberta-v1",
    ],
  },
];

/**
 * BM25 Retrieval
 */
export const BM25Schema: ModelSettingsDict = {
  fullName: "BM25 Retrieval",
  description: "Retrieves documents using the BM25 ranking algorithm",
  schema: {
    type: "object",
    required: ["top_k", "bm25_k1", "bm25_b"],
    properties: {
      shortName: {
        type: "string",
        default: "BM25 Retrieval",
        title: "Nickname",
        description:
          "Unique identifier to appear in ChainForge. Keep it short.",
      },
      top_k: {
        type: "number",
        default: 5,
        title: "Top K Results",
      },
      bm25_k1: {
        type: "number",
        default: 1.5,
        title: "k1 Parameter",
      },
      bm25_b: {
        type: "number",
        default: 0.75,
        title: "b Parameter",
      },
    },
  },
  uiSchema: {
    shortName: {
      "ui:widget": "text",
      "ui:options": {
        placeholder: "Custom name for your retrieval method",
      },
    },
    top_k: {
      "ui:widget": "range",
      "ui:options": {
        min: 1,
        max: 20,
        step: 1,
      },
    },
    bm25_k1: {
      "ui:widget": "range",
      "ui:options": {
        min: 0.5,
        max: 3.0,
        step: 0.1,
      },
    },
    bm25_b: {
      "ui:widget": "range",
      "ui:options": {
        min: 0,
        max: 1,
        step: 0.05,
      },
    },
  },
  postprocessors: {},
};

/**
 * TF-IDF Retrieval
 */
export const TFIDFSchema: ModelSettingsDict = {
  fullName: "TF-IDF Retrieval",
  description: "Retrieves documents using TF-IDF scoring",
  schema: {
    type: "object",
    required: ["top_k", "max_features"],
    properties: {
      shortName: {
        type: "string",
        default: "TF-IDF Retrieval",
        title: "Nickname",
        description:
          "Unique identifier to appear in ChainForge. Keep it short.",
      },
      top_k: {
        type: "number",
        title: "Top K Results",
      },
      max_features: {
        type: "number",
        title: "Max Features (Vocabulary Size)", // Clarified title
        default: 500,
      },
    },
  },
  uiSchema: {
    shortName: {
      "ui:widget": "text",
      "ui:options": {
        placeholder: "Custom name for your retrieval method",
      },
    },
    top_k: {
      "ui:widget": "range",
      "ui:options": {
        min: 1,
        max: 50, // Increased max slightly? Adjust as needed
        step: 1,
      },
    },
    max_features: {
      "ui:widget": "range",
      "ui:options": {
        min: 100,
        max: 10000, // Increased max? Adjust as needed
        step: 100,
      },
    },
  },
  postprocessors: {},
};

/**
 * Boolean Search
 */
export const BooleanSearchSchema: ModelSettingsDict = {
  fullName: "Boolean Search",
  description: "Simple boolean keyword matching",
  schema: {
    type: "object",
    required: ["top_k", "required_match_count"],
    properties: {
      shortName: {
        type: "string",
        default: "Boolean Search",
        title: "Nickname",
        description:
          "Unique identifier to appear in ChainForge. Keep it short.",
      },
      top_k: {
        type: "number",
        default: 5,
        title: "Top K Results",
      },
      required_match_count: {
        type: "number",
        default: 1,
        title: "Required Matches",
      },
    },
  },
  uiSchema: {
    shortName: {
      "ui:widget": "text",
      "ui:options": {
        placeholder: "Custom name for your retrieval method",
      },
    },
    top_k: {
      "ui:widget": "range",
      "ui:options": {
        min: 1,
        max: 20,
        step: 1,
      },
    },
    required_match_count: {
      "ui:widget": "range",
      "ui:options": {
        min: 1,
        max: 10,
        step: 1,
      },
    },
  },
  postprocessors: {},
};

/**
 * Keyword Overlap
 */
export const KeywordOverlapSchema: ModelSettingsDict = {
  fullName: "Keyword Overlap",
  description: "Retrieves documents based on keyword overlap ratio",
  schema: {
    type: "object",
    required: ["top_k", "normalization_factor"],
    properties: {
      shortName: {
        type: "string",
        default: "Keyword Overlap",
        title: "Nickname",
        description:
          "Unique identifier to appear in ChainForge. Keep it short.",
      },
      top_k: {
        type: "number",
        default: 5,
        title: "Top K Results",
      },
      normalization_factor: {
        type: "number",
        default: 0.75,
        title: "Normalization Factor",
      },
    },
  },
  uiSchema: {
    shortName: {
      "ui:widget": "text",
      "ui:options": {
        placeholder: "Custom name for your retrieval method",
      },
    },
    top_k: {
      "ui:widget": "range",
      "ui:options": {
        min: 1,
        max: 20,
        step: 1,
      },
    },
    normalization_factor: {
      "ui:widget": "range",
      "ui:options": {
        min: 0,
        max: 1,
        step: 0.05,
      },
    },
  },
  postprocessors: {},
};

/**
 * Unified Embedding-based Similarity Schema
 * Consolidates cosine, manhattan, euclidean, and vector store approaches
 */
export const EmbeddingSimilaritySchema: ModelSettingsDict = {
  fullName: "Embedding-based Similarity",
  description:
    "Retrieves documents using semantic similarity between embeddings",
  schema: {
    type: "object",
    required: [
      "top_k",
      "similarity_threshold",
      "similarity_metric",
      "storage_backend",
    ],
    properties: {
      shortName: {
        type: "string",
        default: "Embedding Similarity",
        title: "Nickname",
        description:
          "Unique identifier to appear in ChainForge. Keep it short.",
      },
      embeddingProvider: {
        type: "string",
        title: "Embedding Provider",
        enum: embeddingProviders.map((p) => p.value),
        default: "huggingface",
        description: "Select the embedding provider to use",
      },
      embeddingModel: {
        type: "string",
        title: "Embedding Model",
        default: "sentence-transformers/all-MiniLM-L6-v2",
        description: "Select or enter a custom embedding model name",
      },
      embeddingLocalPath: {
        type: "string",
        title: "Local Model Path (optional)",
        default: "",
        description:
          "Only needed if you prefer local files instead of downloading the model automatically.",
      },
      top_k: {
        type: "number",
        default: 5,
        title: "Top K Results",
        description: "Number of most similar documents to retrieve",
      },
      similarity_threshold: {
        type: "number",
        default: 50,
        title: "Similarity Threshold (%)",
        minimum: 0,
        maximum: 100,
        step: 1,
        description:
          "Minimum similarity percentage (0-100) required for a result to be considered relevant.",
      },
      similarity_metric: {
        type: "string",
        default: "cosine",
        title: "Similarity Metric",
        enum: ["cosine", "euclidean", "dot_product"],
        description: "How to measure similarity between embeddings",
      },
      storage_backend: {
        type: "string",
        default: "lancedb",
        title: "Storage Backend",
        enum: ["lancedb", "faiss"],
        description:
          "Where to store and search embeddings. LanceDB is simplest for persistence; FAISS for large-scale (requires separate installation) and possibly connecting to a pre-computed FAISS vector store on your local disk.",
      },
      // Disable clustering method for now, too complex
      // use_clustering: {
      //   type: "boolean",
      //   default: false,
      //   title: "Enable Clustering",
      //   description: "Pre-cluster documents to improve retrieval on large, diverse corpora",
      // },
      // n_clusters: {
      //   type: "number",
      //   default: 5,
      //   title: "Number of Clusters",
      //   description: "How many clusters to create (only used if clustering is enabled)",
      // },
      // LanceDB-specific settings
      lancedb_path: {
        type: "string",
        default: "",
        title: "LanceDB Path",
        description:
          "File path for LanceDB database (required if using LanceDB backend)",
      },
      lancedb_table: {
        type: "string",
        default: "embeddings",
        title: "LanceDB Table Name",
        description: "Table name within LanceDB",
      },
      lancedb_search_method: {
        type: "string",
        default: "similarity",
        title: "LanceDB Search Method",
        enum: ["similarity", "mmr", "hybrid"],
        description:
          "Search strategy: standard similarity, MMR (diverse results), or hybrid (vector + keyword)",
      },
      // FAISS-specific settings
      faiss_path: {
        type: "string",
        default: "",
        title: "FAISS Index Path",
        description:
          "File path to save/load FAISS index (required if using FAISS backend)",
      },
      faiss_mode: {
        type: "string",
        default: "create",
        title: "FAISS Mode",
        enum: ["create", "load"],
        description: "Create new FAISS index or load existing one",
      },
    },
  },
  uiSchema: {
    shortName: {
      "ui:widget": "text",
      "ui:options": {
        placeholder: "Custom name for your retrieval method",
      },
    },
    embeddingProvider: {
      "ui:widget": "select",
      "ui:options": {
        enumOptions: embeddingProviders.map((p) => ({
          label: p.label,
          value: p.value,
        })),
      },
      "ui:help": "Choose the embedding provider",
    },
    embeddingModel: {
      "ui:widget": "datalist",
      "ui:help": "Select a model or enter a custom model name",
    },
    embeddingLocalPath: {
      "ui:widget": "text",
      "ui:options": {
        placeholder: "e.g., ./my_model_directory",
      },
    },
    top_k: {
      "ui:widget": "range",
      "ui:options": {
        min: 1,
        max: 20,
        step: 1,
      },
    },
    similarity_threshold: {
      "ui:widget": "range",
      "ui:options": {
        min: 0,
        max: 100,
        step: 1,
      },
    },
    similarity_metric: {
      "ui:widget": "select",
      "ui:options": {
        enumOptions: [
          { label: "Cosine Similarity (standard for RAG)", value: "cosine" },
          { label: "Euclidean Distance (L2)", value: "euclidean" },
          { label: "Dot Product (Inner Product)", value: "dot_product" },
        ],
      },
    },
    storage_backend: {
      "ui:widget": "select",
      "ui:options": {
        enumOptions: [
          { label: "In-Memory (simple, no persistence)", value: "memory" },
          { label: "LanceDB (persistent, recommended)", value: "lancedb" },
          {
            label: "FAISS (high-performance, requires installation)",
            value: "faiss",
          },
        ],
      },
    },
    // use_clustering: {
    //   "ui:widget": "checkbox",
    // },
    // n_clusters: {
    //   "ui:widget": "range",
    //   "ui:options": {
    //     min: 2,
    //     max: 20,
    //     step: 1,
    //   },
    // },
    lancedb_path: {
      "ui:widget": "text",
      "ui:options": {
        placeholder: "e.g., ./my_lancedb",
      },
    },
    lancedb_table: {
      "ui:widget": "text",
      "ui:options": {
        placeholder: "embeddings",
      },
    },
    lancedb_search_method: {
      "ui:widget": "select",
      "ui:options": {
        enumOptions: [
          { label: "Standard Similarity", value: "similarity" },
          {
            label: "Maximum Marginal Relevance (diverse results)",
            value: "mmr",
          },
          { label: "Hybrid (vector + keyword)", value: "hybrid" },
        ],
      },
    },
    faiss_path: {
      "ui:widget": "text",
      "ui:options": {
        placeholder: "e.g., ./my_index.faiss",
      },
    },
    faiss_mode: {
      "ui:widget": "select",
      "ui:options": {
        enumOptions: [
          { label: "Create New Index", value: "create" },
          { label: "Load Existing Index", value: "load" },
        ],
      },
    },
  },
  postprocessors: {},
};

// Add rank fusion methods
export const rankFusionMethods = [
  {
    value: "reciprocal_rank_fusion",
    label: "Reciprocal Rank Fusion (RRF)",
    description: "Combines rankings using reciprocal rank formula",
    schema: {
      type: "object",
      properties: {
        k: {
          type: "number",
          title: "K Parameter",
          default: 60,
          description: "Parameter for RRF formula (higher = more democratic)",
        },
        weights: {
          type: "array",
          title: "Method Weights",
          items: { type: "number" },
          description:
            "Optional weights for each method (leave empty for equal weights)",
        },
      },
    },
  },
  {
    value: "weighted_average",
    label: "Weighted Average",
    description: "Simple weighted average of scores",
    schema: {
      type: "object",
      properties: {
        normalize_scores: {
          type: "boolean",
          title: "Normalize Scores",
          default: true,
          description: "Normalize scores before combining",
        },
      },
    },
  },
];

/**
 * Semantic retrieval that runs client-side, on a small ONNX model.
 *
 * Separate from EmbeddingSimilaritySchema on purpose: that one picks a
 * provider and a vector store on the server, while this one has exactly one
 * real decision -- which model to download.
 */
export const BrowserEmbeddingSchema: ModelSettingsDict = {
  fullName: "Semantic Search (in-browser)",
  description:
    "Retrieves documents by meaning using a small embedding model that runs " +
    "in your browser. No server needed. The model downloads once on first use.",
  schema: {
    type: "object",
    required: ["top_k", "browserEmbeddingModel"],
    properties: {
      shortName: {
        type: "string",
        default: "Semantic Search",
        title: "Nickname",
        description:
          "Unique identifier to appear in ChainForge. Keep it short.",
      },
      browserEmbeddingModel: {
        type: "string",
        title: "Embedding Model",
        default: DEFAULT_BROWSER_EMBEDDING_MODEL,
        enum: Object.keys(BROWSER_EMBEDDING_MODELS),
        description:
          "Downloaded once and cached by your browser. Larger models rank " +
          "better; smaller ones start faster.",
      },
      top_k: {
        type: "number",
        default: 5,
        title: "Top K Results",
      },
    },
  },
  uiSchema: {
    shortName: {
      "ui:widget": "text",
      "ui:options": {
        placeholder: "Custom name for your retrieval method",
      },
    },
    browserEmbeddingModel: {
      "ui:widget": "select",
      "ui:options": {
        enumOptions: Object.values(BROWSER_EMBEDDING_MODELS).map((m) => ({
          value: m.id,
          label: `${m.label} (~${m.sizeMB}MB) -- ${m.note}`,
        })),
      },
      "ui:help": "The first run downloads the model; later runs reuse it.",
    },
    top_k: {
      "ui:widget": "range",
      "ui:options": {
        min: 1,
        max: 20,
        step: 1,
      },
    },
  },
  postprocessors: {},
};

// Combined schema object for all retrieval methods
export const RetrievalMethodSchemas: {
  [baseMethod: string]: ModelSettingsDict;
} = {
  bm25: BM25Schema,
  tfidf: TFIDFSchema,
  boolean: BooleanSearchSchema,
  overlap: KeywordOverlapSchema,
  embedding: EmbeddingSimilaritySchema,
  browser_embedding: BrowserEmbeddingSchema,
  // Deprecated methods (kept for backwards compatibility)
  cosine: EmbeddingSimilaritySchema,
  euclidean: EmbeddingSimilaritySchema,
  clustered: EmbeddingSimilaritySchema,
};

/** One selectable retrieval method in the Retrieval node's menu. */
export interface RetrievalMethodGroupItem {
  baseMethod: string;
  methodName: string;
  library: string;
  emoji?: string;
  group?: string;
  needsEmbeddingModel?: boolean;
  embeddingProvider?: string;
  description?: string;
  /** Where this method can execute. Defaults to backend-only when omitted. */
  runsIn?: RunsIn;
}

export interface RetrievalMethodGroup {
  label: string;
  items: RetrievalMethodGroupItem[];
}

// Method groupings for the menu
export const retrievalMethodGroups: RetrievalMethodGroup[] = [
  {
    label: "Keyword-based Retrieval",
    items: [
      {
        baseMethod: "bm25",
        runsIn: "both" as RunsIn,
        methodName: "BM25 Retrieval",
        library: "BM25",
        emoji: "📊",
        group: "Keyword-based Retrieval",
        needsEmbeddingModel: false,
        embeddingProvider: undefined,
        description:
          "Classic keyword ranking using term frequency and document length normalization. Great default for keyword-heavy queries.",
      },
      {
        baseMethod: "tfidf",
        runsIn: "backend" as RunsIn,
        methodName: "TF-IDF Retrieval",
        library: "TF-IDF",
        emoji: "📈",
        group: "Keyword-based Retrieval",
        needsEmbeddingModel: false,
        embeddingProvider: undefined,
        description:
          "Vector-space retrieval based on term frequency–inverse document frequency. Good for exact words and rare terms.",
      },
      {
        baseMethod: "boolean",
        runsIn: "both" as RunsIn,
        methodName: "Boolean Search",
        library: "Boolean Search",
        emoji: "🔍",
        group: "Keyword-based Retrieval",
        needsEmbeddingModel: false,
        embeddingProvider: undefined,
        description:
          "Keyword retrieval based on minimum token overlap with the query, ranked by how many words they share.",
      },
      {
        baseMethod: "overlap",
        runsIn: "both" as RunsIn,
        methodName: "Keyword Overlap",
        library: "KeywordOverlap",
        emoji: "🎯",
        group: "Keyword-based Retrieval",
        needsEmbeddingModel: false,
        embeddingProvider: undefined,
        description:
          "Score documents by how many query keywords they share. Simple and fast when term overlap is what matters.",
      },
    ],
  },
  {
    label: "Embedding-based Retrieval",
    items: [
      {
        baseMethod: "browser_embedding",
        runsIn: "browser" as RunsIn,
        methodName: "Semantic Search (in-browser)",
        library: "Transformers.js",
        emoji: "\u2728",
        group: "Embedding-based Retrieval",
        needsEmbeddingModel: false,
        embeddingProvider: undefined,
        description:
          "Retrieve by meaning rather than shared words, using a small model that runs in your browser. No server or API key needed; the model downloads once on first use.",
      },
      {
        baseMethod: "embedding",
        runsIn: "backend" as RunsIn,
        methodName: "HuggingFace Embedding",
        library: "EmbeddingSimilarity",
        emoji: "🤗",
        group: "Embedding-based Retrieval",
        needsEmbeddingModel: true,
        embeddingProvider: "huggingface",
        description:
          "Retrieve documents using HuggingFace transformer embeddings. Fast, open-source, and runs locally.",
      },
      {
        baseMethod: "embedding",
        runsIn: "backend" as RunsIn,
        methodName: "OpenAI Embedding",
        library: "EmbeddingSimilarity",
        emoji: "🤖",
        group: "Embedding-based Retrieval",
        needsEmbeddingModel: true,
        embeddingProvider: "openai",
        description:
          "Retrieve documents using OpenAI embeddings (ada-002, text-embedding-3). High quality, requires API key.",
      },
      {
        baseMethod: "embedding",
        runsIn: "backend" as RunsIn,
        methodName: "Azure OpenAI Embedding",
        library: "EmbeddingSimilarity",
        emoji: "🔷",
        group: "Embedding-based Retrieval",
        needsEmbeddingModel: true,
        embeddingProvider: "azure-openai",
        description:
          "Retrieve documents using Azure OpenAI embeddings. Enterprise-ready with Azure compliance.",
      },
      {
        baseMethod: "embedding",
        runsIn: "backend" as RunsIn,
        methodName: "Cohere Embedding",
        library: "EmbeddingSimilarity",
        emoji: "💬",
        group: "Embedding-based Retrieval",
        needsEmbeddingModel: true,
        embeddingProvider: "cohere",
        description:
          "Retrieve documents using Cohere embeddings. Multilingual support and optimized for search.",
      },
      {
        baseMethod: "embedding",
        runsIn: "backend" as RunsIn,
        methodName: "Sentence Transformers Embedding",
        library: "EmbeddingSimilarity",
        emoji: "🧠",
        group: "Embedding-based Retrieval",
        needsEmbeddingModel: true,
        embeddingProvider: "sentence-transformers",
        description:
          "Retrieve documents using Sentence Transformers. Optimized for semantic similarity tasks.",
      },
      // {
      //   baseMethod: "clustered",
      //   methodName: "Clustered Embedding",
      //   library: "Clustered",
      //   emoji: "🎲",
      //   group: "Embedding-based Retrieval",
      //   needsEmbeddingModel: true,
      //   description:
      //     "Cluster documents in embedding space, then retrieve from the most relevant clusters. Good for large, heterogeneous corpora.",
      // },
    ],
  },
];
