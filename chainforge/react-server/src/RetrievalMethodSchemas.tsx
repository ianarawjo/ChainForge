import { ModelSettingsDict } from "./backend/typing";

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
 * Cosine Similarity Schema
 */
export const CosineSimilaritySchema: ModelSettingsDict = {
  fullName: "Cosine Similarity",
  description: "Retrieves documents using cosine similarity between embeddings",
  schema: {
    type: "object",
    required: ["top_k", "similarity_threshold"],
    properties: {
      shortName: {
        type: "string",
        default: "Cosine Similarity",
        title: "Nickname",
        description:
          "Unique identifier to appear in ChainForge. Keep it short.",
      },
      top_k: {
        type: "number",
        default: 5,
        title: "Top K Results",
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
      embeddingModel: {
        type: "string",
        title: "Embedding Model",
        default: "",
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
    similarity_threshold: {
      "ui:widget": "range",
      "ui:options": {
        min: 0,
        max: 1,
        step: 0.05,
      },
    },
    embeddingModel: {
      "ui:widget": "select",
    },
  },
  postprocessors: {},
};

/**
 * Manhattan Distance Schema
 */
export const ManhattanDistanceSchema: ModelSettingsDict = {
  fullName: "Manhattan distance",
  description:
    "Retrieves documents using manhattan distance between embeddings",
  schema: {
    type: "object",
    required: ["top_k", "similarity_threshold", "pooling_strategy"],
    properties: {
      shortName: {
        type: "string",
        default: "Manhattan distance",
        title: "Nickname",
        description:
          "Unique identifier to appear in ChainForge. Keep it short.",
      },
      top_k: {
        type: "number",
        default: 5,
        title: "Top K Results",
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
      pooling_strategy: {
        type: "string",
        default: "mean",
        title: "Pooling Strategy",
        enum: ["mean", "max", "cls"],
      },
      embeddingModel: {
        type: "string",
        title: "Embedding Model",
        default: "",
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
    similarity_threshold: {
      "ui:widget": "range",
      "ui:options": {
        min: 0,
        max: 1,
        step: 0.05,
      },
    },
    pooling_strategy: {
      "ui:widget": "select",
    },
    embeddingModel: {
      "ui:widget": "select",
    },
  },
  postprocessors: {},
};

/**
 * Euclidean Distance Schema
 */
export const EuclideanDistanceSchema: ModelSettingsDict = {
  fullName: "Euclidean distance",
  description:
    "Retrieves documents using euclidean distance between embeddings",
  schema: {
    type: "object",
    required: ["top_k", "similarity_threshold", "vector_dimension"],
    properties: {
      shortName: {
        type: "string",
        default: "Euclidean distance",
        title: "Nickname",
        description:
          "Unique identifier to appear in ChainForge. Keep it short.",
      },
      top_k: {
        type: "number",
        default: 5,
        title: "Top K Results",
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
      vector_dimension: {
        type: "number",
        default: 768,
        title: "Vector Dimension",
      },
      embeddingModel: {
        type: "string",
        title: "Embedding Model",
        default: "",
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
    similarity_threshold: {
      "ui:widget": "range",
      "ui:options": {
        min: 0,
        max: 1,
        step: 0.05,
      },
    },
    vector_dimension: {
      "ui:widget": "range",
      "ui:options": {
        min: 64,
        max: 1536,
        step: 64,
      },
    },
    embeddingModel: {
      "ui:widget": "select",
    },
  },
  postprocessors: {},
};

/**
 * Clustered Embedding Schema
 */
export const ClusteredEmbeddingSchema: ModelSettingsDict = {
  fullName: "Clustered Embedding",
  description:
    "Retrieves documents using cosine similarity between a hybrid of sentence and topic embeddings",
  schema: {
    type: "object",
    required: ["top_k", "similarity_threshold", "n_clusters"],
    properties: {
      shortName: {
        type: "string",
        default: "Clustered Embedding",
        title: "Nickname",
        description:
          "Unique identifier to appear in ChainForge. Keep it short.",
      },
      top_k: {
        type: "number",
        default: 5,
        title: "Top K Results",
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
      n_clusters: {
        type: "number",
        default: 5,
        title: "Number of Clusters",
      },
      embeddingModel: {
        type: "string",
        title: "Embedding Model",
        default: "",
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
    similarity_threshold: {
      "ui:widget": "range",
      "ui:options": {
        min: 0,
        max: 1,
        step: 0.05,
      },
    },
    n_clusters: {
      "ui:widget": "range",
      "ui:options": {
        min: 2,
        max: 20,
        step: 1,
      },
    },
    embeddingModel: {
      "ui:widget": "select",
    },
  },
  postprocessors: {},
};

/**
 * LanceDB Vectorstore
 */
export const LANCEDBSchema: ModelSettingsDict = {
  fullName: "LanceDB Vectorstore",
  description:
    "Persistent vector storage using LanceDB for efficient local similarity search.",
  schema: {
    type: "object",
    required: [
      "top_k",
      "distance_metric",
      "dbPath",
      "tableName",
      "search_method",
    ],
    properties: {
      shortName: {
        type: "string",
        default: "LanceDB Vectorstore",
        title: "Nickname",
        description:
          "Unique identifier to appear in ChainForge. Keep it short.",
      },
      top_k: {
        type: "number",
        default: 10,
        title: "Top K Results",
        description:
          "The number of top matching results to retrieve from the LanceDB index.",
      },
      distance_metric: {
        type: "string",
        default: "l2",
        title: "Distance Metric",
        enum: ["l2", "cosine", "dot"],
        description:
          "Select the similarity measure used in LanceDB: L2 (Euclidean), Cosine, or Dot Product.",
      },
      dbPath: {
        type: "string",
        default: "",
        title: "LanceDB Path",
        description:
          "The file path where the LanceDB database will be saved or loaded from.",
      },
      tableName: {
        type: "string",
        default: "embeddings",
        title: "Table Name",
        description:
          "Name of the table to use for vector storage within the LanceDB database.",
      },
      search_method: {
        type: "string",
        default: "similarity",
        title: "Search Method",
        enum: ["similarity", "mmr", "hybrid"],
        description:
          "Choose the search method: standard similarity, Maximum Marginal Relevance (mmr), or hybrid (vector + keyword).",
      },
      lambda_param: {
        type: "number",
        default: 0.5,
        minimum: 0,
        maximum: 1,
        step: 0.01,
        title: "MMR Lambda Parameter",
        description:
          "Balance between relevance and diversity for MMR search (only used if search_method is 'mmr').",
      },
      keyword: {
        type: "string",
        default: "",
        title: "Hybrid Search Keyword",
        description:
          "Keyword to use for hybrid search (only used if search_method is 'hybrid').",
      },
      blend: {
        type: "number",
        default: 0.5,
        minimum: 0,
        maximum: 1,
        step: 0.01,
        title: "Hybrid Blend Parameter",
        description:
          "Balance between vector and keyword scores for hybrid search (only used if search_method is 'hybrid').",
      },
      filters: {
        type: "string",
        default: "",
        title: "LanceDB Filters",
        description:
          "Optional LanceDB filter expression to restrict the search.",
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
    distance_metric: {
      "ui:widget": "select",
      "ui:options": {
        enumOptions: [
          { label: "L2 (Euclidean Distance)", value: "l2" },
          { label: "Cosine Similarity", value: "cosine" },
          { label: "Dot Product", value: "dot" },
        ],
      },
    },
    dbPath: {
      "ui:widget": "text",
      "ui:options": {
        placeholder: "Enter the path to the LanceDB database",
      },
    },
    tableName: {
      "ui:widget": "text",
      "ui:options": {
        placeholder: "Table name (default: embeddings)",
      },
    },
    search_method: {
      "ui:widget": "select",
      "ui:options": {
        enumOptions: [
          { label: "Similarity", value: "similarity" },
          { label: "Maximum Marginal Relevance (MMR)", value: "mmr" },
          { label: "Hybrid (vector + keyword)", value: "hybrid" },
        ],
      },
    },
    lambda_param: {
      "ui:widget": "range",
      "ui:options": {
        min: 0,
        max: 1,
        step: 0.01,
      },
    },
    keyword: {
      "ui:widget": "text",
      "ui:options": {
        placeholder: "Keyword for hybrid search",
      },
    },
    blend: {
      "ui:widget": "range",
      "ui:options": {
        min: 0,
        max: 1,
        step: 0.01,
      },
    },
    filters: {
      "ui:widget": "text",
      "ui:options": {
        placeholder: "Optional LanceDB filter expression",
      },
    },
  },
  postprocessors: {},
};

/**
 * FAISS Vectorstore
 */
export const FAISSSchema: ModelSettingsDict = {
  fullName: "FAISS Vectorstore",
  description:
    "Persistent vector storage using FAISS for efficient similarity search.",
  schema: {
    type: "object",
    required: [
      "top_k",
      "similarity_threshold",
      "faissMode",
      "faissPath",
      "metric",
    ],
    properties: {
      shortName: {
        type: "string",
        default: "FAISS Vectorstore",
        title: "Nickname",
        description:
          "Unique identifier to appear in ChainForge. Keep it short.",
      },
      top_k: {
        type: "number",
        default: 10,
        title: "Top K Results",
        description:
          "The number of top matching results to retrieve from the FAISS index.",
      },
      similarity_threshold: {
        type: "number",
        default: 0,
        title: "Similarity Threshold (%)",
        minimum: 0,
        maximum: 100,
        step: 1,
        description:
          "Minimum similarity percentage (0-100) required for a result to be considered relevant.",
      },
      faissMode: {
        type: "string",
        default: "create",
        title: "FAISS Mode",
        enum: ["create", "load"],
        description:
          "Select whether to create a new FAISS index or load an existing one.",
      },
      faissPath: {
        type: "string",
        default: "",
        title: "FAISS Index Path",
        description:
          "The file path where the FAISS index will be saved or loaded from.",
      },
      metric: {
        type: "string",
        default: "l2",
        title: "FAISS Distance Metric",
        enum: ["l2", "ip"],
        description:
          "Select the similarity measure used in FAISS: L2 (Euclidean Distance) or IP (Inner Product).",
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
    similarity_threshold: {
      "ui:widget": "range",
      "ui:options": {
        min: 0,
        max: 100,
        step: 1,
      },
    },
    faissMode: {
      "ui:widget": "select",
      "ui:options": {
        enumOptions: [
          { label: "Create a new FAISS index", value: "create" },
          { label: "Load an existing FAISS index", value: "load" },
        ],
      },
    },
    faissPath: {
      "ui:widget": "text",
      "ui:options": {
        placeholder: "Enter the path to the FAISS index file",
      },
    },
    metric: {
      "ui:widget": "select",
      "ui:options": {
        enumOptions: [
          { label: "L2 (Euclidean Distance)", value: "l2" },
          { label: "IP (Inner Product / Cosine Similarity)", value: "ip" },
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

// Combined schema object for all retrieval methods
export const RetrievalMethodSchemas: {
  [baseMethod: string]: ModelSettingsDict;
} = {
  bm25: BM25Schema,
  tfidf: TFIDFSchema,
  boolean: BooleanSearchSchema,
  overlap: KeywordOverlapSchema,
  cosine: CosineSimilaritySchema,
  manhattan: ManhattanDistanceSchema,
  euclidean: EuclideanDistanceSchema,
  clustered: ClusteredEmbeddingSchema,
  faiss_vector_store: FAISSSchema,
  lancedb_vector_store: LANCEDBSchema,
};

// Method groupings for the menu
export const retrievalMethodGroups = [
  {
    label: "Keyword-based Retrieval",
    items: [
      {
        baseMethod: "bm25",
        methodName: "BM25",
        library: "BM25",
        emoji: "📊",
        group: "Keyword-based Retrieval",
        needsEmbeddingModel: false,
      },
      {
        baseMethod: "tfidf",
        methodName: "TF-IDF",
        library: "TF-IDF",
        emoji: "📈",
        group: "Keyword-based Retrieval",
        needsEmbeddingModel: false,
      },
      {
        baseMethod: "boolean",
        methodName: "Boolean Search",
        library: "Boolean Search",
        emoji: "🔍",
        group: "Keyword-based Retrieval",
        needsEmbeddingModel: false,
      },
      {
        baseMethod: "overlap",
        methodName: "Keyword Overlap",
        library: "KeywordOverlap",
        emoji: "🎯",
        group: "Keyword-based Retrieval",
        needsEmbeddingModel: false,
      },
    ],
  },
  {
    label: "Embedding-based Retrieval",
    items: [
      {
        baseMethod: "cosine",
        methodName: "Cosine Similarity",
        library: "Cosine",
        emoji: "📐",
        group: "Embedding-based Retrieval",
        needsEmbeddingModel: true,
      },
      {
        baseMethod: "manhattan",
        methodName: "Manhattan distance",
        library: "Manhattan",
        emoji: "🔤",
        group: "Embedding-based Retrieval",
        needsEmbeddingModel: true,
      },
      {
        baseMethod: "euclidean",
        methodName: "Euclidean distance",
        library: "Euclidean",
        emoji: "🎯",
        group: "Embedding-based Retrieval",
        needsEmbeddingModel: true,
      },
      {
        baseMethod: "clustered",
        methodName: "Clustered Embedding",
        library: "Clustered",
        emoji: "🎲",
        group: "Embedding-based Retrieval",
        needsEmbeddingModel: true,
      },
    ],
  },
  {
    label: "Vector Stores",
    items: [
      {
        baseMethod: "lancedb_vector_store",
        methodName: "LanceDB Vectorstore",
        library: "LanceDB",
        emoji: "🗄️",
        group: "Vector Stores",
        needsEmbeddingModel: true,
      },
      // Requires FAISS to be installed, which is not always available by default,
      // since it requires 'swig' to be installed which can only be done outside pip.
      {
        baseMethod: "faiss_vector_store",
        methodName: "FAISS Vectorstore",
        library: "FAISS",
        emoji: "💾",
        group: "Vector Stores",
        needsEmbeddingModel: true,
      },
    ],
  },
];
