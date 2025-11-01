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
          "BAAI/bge-reranker-base",
          "BAAI/bge-reranker-large",
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
      "ui:widget": "datalist",
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
        default: "rerank-v3.5",
        title: "Cohere Model",
        enum: [
          "rerank-v3.5",
          "rerank-english-v3.0",
          "rerank-multilingual-v3.0",
        ],
        description: "Cohere reranking model to use",
      },
      top_k: {
        type: "number",
        default: 5,
        title: "Top K Results",
        minimum: 1,
        maximum: 100,
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
      "ui:widget": "datalist",
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

// Combined schema object for all reranking methods
export const RerankMethodSchemas: {
  [baseMethod: string]: ModelSettingsDict;
} = {
  cross_encoder: CrossEncoderRerankSchema,
  cohere_rerank: CohereRerankSchema,
};

// Method groupings for the menu
export const rerankMethodGroups = [
  {
    label: "Cross Encoder",
    items: [
      {
        baseMethod: "cross_encoder",
        name: "MiniLM-L-6-v2",
        library: "CrossEncoder",
        emoji: "🧠",
        group: "Cross Encoder",
        needsEmbeddingModel: false,
        defaultSettings: {
          model: "cross-encoder/ms-marco-MiniLM-L-6-v2",
          shortName: "MiniLM-L-6-v2",
        },
      },
      {
        baseMethod: "cross_encoder",
        name: "MiniLM-L-12-v2",
        library: "CrossEncoder",
        emoji: "🧠",
        group: "Cross Encoder",
        needsEmbeddingModel: false,
        defaultSettings: {
          model: "cross-encoder/ms-marco-MiniLM-L-12-v2",
          shortName: "MiniLM-L-12-v2",
        },
      },
      {
        baseMethod: "cross_encoder",
        name: "TinyBERT-L-2-v2",
        library: "CrossEncoder",
        emoji: "🧠",
        group: "Cross Encoder",
        needsEmbeddingModel: false,
        defaultSettings: {
          model: "cross-encoder/ms-marco-TinyBERT-L-2-v2",
          shortName: "TinyBERT-L-2-v2",
        },
      },
      {
        baseMethod: "cross_encoder",
        name: "Electra-Base",
        library: "CrossEncoder",
        emoji: "🧠",
        group: "Cross Encoder",
        needsEmbeddingModel: false,
        defaultSettings: {
          model: "cross-encoder/ms-marco-electra-base",
          shortName: "Electra-Base",
        },
      },
      {
        baseMethod: "cross_encoder",
        name: "BGE Reranker Base",
        library: "CrossEncoder",
        emoji: "🧠",
        group: "Cross Encoder",
        needsEmbeddingModel: false,
        defaultSettings: {
          model: "BAAI/bge-reranker-base",
          shortName: "BGE Reranker Base",
        },
      },
      {
        baseMethod: "cross_encoder",
        name: "BGE Reranker Large",
        library: "CrossEncoder",
        emoji: "🧠",
        group: "Cross Encoder",
        needsEmbeddingModel: false,
        defaultSettings: {
          model: "BAAI/bge-reranker-large",
          shortName: "BGE Reranker Large",
        },
      },
    ],
  },
  {
    label: "Cohere API",
    items: [
      {
        baseMethod: "cohere_rerank",
        name: "Rerank v3.5 (Latest)",
        library: "Cohere",
        emoji: "💬",
        group: "Cohere API",
        needsEmbeddingModel: false,
        defaultSettings: {
          model: "rerank-v3.5",
          shortName: "Rerank v3.5",
        },
      },
      {
        baseMethod: "cohere_rerank",
        name: "Rerank English v3.0",
        library: "Cohere",
        emoji: "💬",
        group: "Cohere API",
        needsEmbeddingModel: false,
        defaultSettings: {
          model: "rerank-english-v3.0",
          shortName: "Rerank English v3.0",
        },
      },
      {
        baseMethod: "cohere_rerank",
        name: "Rerank Multilingual v3.0",
        library: "Cohere",
        emoji: "💬",
        group: "Cohere API",
        needsEmbeddingModel: false,
        defaultSettings: {
          model: "rerank-multilingual-v3.0",
          shortName: "Rerank Multilingual v3.0",
        },
      },
    ],
  },
];
