import { ModelSettingsDict } from "./backend/typing";

/**
 * Cross-encoder Reranking
 */
export const CrossEncoderRerankSchema: ModelSettingsDict = {
  fullName: "Cross-encoder Reranker",
  description:
    "Rerank documents using a cross-encoder model for query-document pairs",
  schema: {
    type: "object",
    required: ["model", "top_k"],
    properties: {
      shortName: {
        type: "string",
        default: "Cross-encoder Reranker",
        title: "Nickname",
        description:
          "Unique identifier to appear in ChainForge. Keep it short.",
      },
      model: {
        type: "string",
        default: "cross-encoder/ms-marco-MiniLM-L-6-v2",
        title: "Cross-encoder Model",
        enum: [
          "cross-encoder/ms-marco-MiniLM-L-6-v2",
          "cross-encoder/ms-marco-MiniLM-L-12-v2",
          "cross-encoder/ms-marco-TinyBERT-L-2-v2",
          "cross-encoder/ms-marco-electra-base",
        ],
        description: "Pre-trained cross-encoder model for reranking",
      },
      top_k: {
        type: "number",
        default: 5,
        title: "Top K Results",
        minimum: 1,
        maximum: 50,
        description: "Number of top documents to return after reranking",
      },
      batch_size: {
        type: "number",
        default: 32,
        title: "Batch Size",
        minimum: 1,
        maximum: 128,
        description: "Batch size for model inference",
      },
    },
  },
  uiSchema: {
    shortName: {
      "ui:widget": "text",
      "ui:options": {
        placeholder: "Custom name for your reranking method",
      },
    },
    model: {
      "ui:widget": "select",
    },
    top_k: {
      "ui:widget": "range",
      "ui:options": {
        min: 1,
        max: 50,
        step: 1,
      },
    },
    batch_size: {
      "ui:widget": "range",
      "ui:options": {
        min: 1,
        max: 128,
        step: 1,
      },
    },
  },
  postprocessors: {},
};

/**
 * Cohere Rerank API
 */
export const CohereRerankSchema: ModelSettingsDict = {
  fullName: "Cohere Rerank API",
  description: "Rerank documents using Cohere's reranking API",
  schema: {
    type: "object",
    required: ["model", "top_k"],
    properties: {
      shortName: {
        type: "string",
        default: "Cohere Rerank",
        title: "Nickname",
        description:
          "Unique identifier to appear in ChainForge. Keep it short.",
      },
      model: {
        type: "string",
        default: "rerank-english-v3.0",
        title: "Cohere Model",
        enum: [
          "rerank-english-v3.0",
          "rerank-multilingual-v3.0",
          "rerank-english-v2.0",
          "rerank-multilingual-v2.0",
        ],
        description: "Cohere reranking model to use",
      },
      top_k: {
        type: "number",
        default: 5,
        title: "Top K Results",
        minimum: 1,
        maximum: 1000,
        description: "Number of top documents to return after reranking",
      },
      max_chunks_per_doc: {
        type: "number",
        default: 10,
        title: "Max Chunks per Document",
        minimum: 1,
        maximum: 100,
        description: "Maximum number of chunks to consider per document",
      },
    },
  },
  uiSchema: {
    shortName: {
      "ui:widget": "text",
      "ui:options": {
        placeholder: "Custom name for your reranking method",
      },
    },
    model: {
      "ui:widget": "select",
    },
    top_k: {
      "ui:widget": "range",
      "ui:options": {
        min: 1,
        max: 100,
        step: 1,
      },
    },
    max_chunks_per_doc: {
      "ui:widget": "range",
      "ui:options": {
        min: 1,
        max: 100,
        step: 1,
      },
    },
  },
  postprocessors: {},
};

/**
 * MMR (Maximal Marginal Relevance) Reranking
 */
export const MMRRerankSchema: ModelSettingsDict = {
  fullName: "MMR Reranking",
  description:
    "Rerank documents using Maximal Marginal Relevance to reduce redundancy",
  schema: {
    type: "object",
    required: ["lambda_param", "top_k"],
    properties: {
      shortName: {
        type: "string",
        default: "MMR Reranker",
        title: "Nickname",
        description:
          "Unique identifier to appear in ChainForge. Keep it short.",
      },
      lambda_param: {
        type: "number",
        default: 0.5,
        title: "Lambda Parameter",
        minimum: 0,
        maximum: 1,
        step: 0.01,
        description: "Balance between relevance (1) and diversity (0)",
      },
      top_k: {
        type: "number",
        default: 5,
        title: "Top K Results",
        minimum: 1,
        maximum: 50,
        description: "Number of top documents to return after reranking",
      },
      diversity_threshold: {
        type: "number",
        default: 0.7,
        title: "Diversity Threshold",
        minimum: 0,
        maximum: 1,
        step: 0.01,
        description: "Minimum similarity threshold for diversity filtering",
      },
    },
  },
  uiSchema: {
    shortName: {
      "ui:widget": "text",
      "ui:options": {
        placeholder: "Custom name for your reranking method",
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
    top_k: {
      "ui:widget": "range",
      "ui:options": {
        min: 1,
        max: 50,
        step: 1,
      },
    },
    diversity_threshold: {
      "ui:widget": "range",
      "ui:options": {
        min: 0,
        max: 1,
        step: 0.01,
      },
    },
  },
  postprocessors: {},
};

/**
 * LostInTheMiddle Reranking
 */
export const LostInTheMiddleRerankSchema: ModelSettingsDict = {
  fullName: "Lost-in-the-Middle Reranking",
  description:
    "Reorder documents to avoid the 'lost in the middle' effect by placing relevant docs at beginning and end",
  schema: {
    type: "object",
    required: ["strategy"],
    properties: {
      shortName: {
        type: "string",
        default: "Lost-in-Middle Reranker",
        title: "Nickname",
        description:
          "Unique identifier to appear in ChainForge. Keep it short.",
      },
      strategy: {
        type: "string",
        default: "alternate",
        title: "Positioning Strategy",
        enum: ["alternate", "top_bottom", "reverse_middle"],
        description: "How to reorder documents to avoid middle positions",
      },
      preserve_top_k: {
        type: "number",
        default: 2,
        title: "Preserve Top K",
        minimum: 0,
        maximum: 10,
        description: "Number of top documents to always keep at the beginning",
      },
    },
  },
  uiSchema: {
    shortName: {
      "ui:widget": "text",
      "ui:options": {
        placeholder: "Custom name for your reranking method",
      },
    },
    strategy: {
      "ui:widget": "select",
    },
    preserve_top_k: {
      "ui:widget": "range",
      "ui:options": {
        min: 0,
        max: 10,
        step: 1,
      },
    },
  },
  postprocessors: {},
};

/**
 * Reciprocal Rank Fusion (RRF) Reranking
 */
export const RRFRerankSchema: ModelSettingsDict = {
  fullName: "Reciprocal Rank Fusion",
  description: "Combine multiple ranking lists using Reciprocal Rank Fusion",
  schema: {
    type: "object",
    required: ["k_param", "top_k"],
    properties: {
      shortName: {
        type: "string",
        default: "RRF Reranker",
        title: "Nickname",
        description:
          "Unique identifier to appear in ChainForge. Keep it short.",
      },
      k_param: {
        type: "number",
        default: 60,
        title: "K Parameter",
        minimum: 1,
        maximum: 200,
        description: "Parameter for RRF formula (higher = more democratic)",
      },
      top_k: {
        type: "number",
        default: 5,
        title: "Top K Results",
        minimum: 1,
        maximum: 50,
        description: "Number of top documents to return after fusion",
      },
      normalize_scores: {
        type: "boolean",
        default: true,
        title: "Normalize Scores",
        description: "Whether to normalize scores before fusion",
      },
    },
  },
  uiSchema: {
    shortName: {
      "ui:widget": "text",
      "ui:options": {
        placeholder: "Custom name for your reranking method",
      },
    },
    k_param: {
      "ui:widget": "range",
      "ui:options": {
        min: 1,
        max: 200,
        step: 1,
      },
    },
    top_k: {
      "ui:widget": "range",
      "ui:options": {
        min: 1,
        max: 50,
        step: 1,
      },
    },
    normalize_scores: {
      "ui:widget": "radio",
    },
  },
  postprocessors: {},
};

// Combined schema object for all reranking methods
export const RerankMethodSchemas: {
  [baseMethod: string]: ModelSettingsDict;
} = {
  cross_encoder: CrossEncoderRerankSchema,
  cohere_rerank: CohereRerankSchema,
  mmr: MMRRerankSchema,
  lost_in_middle: LostInTheMiddleRerankSchema,
  rrf: RRFRerankSchema,
};

// Method groupings for the menu
export const rerankMethodGroups = [
  {
    label: "Neural Reranking",
    items: [
      {
        baseMethod: "cross_encoder",
        methodName: "Cross-encoder",
        library: "CrossEncoder",
        emoji: "🧠",
        group: "Neural Reranking",
        needsEmbeddingModel: false,
      },
      {
        baseMethod: "cohere_rerank",
        methodName: "Cohere Rerank API",
        library: "Cohere",
        emoji: "💬",
        group: "Neural Reranking",
        needsEmbeddingModel: false,
      },
    ],
  },
  {
    label: "Diversity-based Reranking",
    items: [
      {
        baseMethod: "mmr",
        methodName: "MMR (Maximal Marginal Relevance)",
        library: "MMR",
        emoji: "🎯",
        group: "Diversity-based Reranking",
        needsEmbeddingModel: true,
      },
      {
        baseMethod: "lost_in_middle",
        methodName: "Lost-in-the-Middle",
        library: "LostInMiddle",
        emoji: "🔄",
        group: "Diversity-based Reranking",
        needsEmbeddingModel: false,
      },
    ],
  },
  {
    label: "Fusion Methods",
    items: [
      {
        baseMethod: "rrf",
        methodName: "Reciprocal Rank Fusion",
        library: "RRF",
        emoji: "🔗",
        group: "Fusion Methods",
        needsEmbeddingModel: false,
      },
    ],
  },
];
