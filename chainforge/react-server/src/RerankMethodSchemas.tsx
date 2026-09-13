import { ModelSettingsDict } from "./backend/typing";
import { RunsIn } from "./backend/ragCapabilities";
import {
  BROWSER_RERANK_MODELS,
  DEFAULT_BROWSER_RERANK_MODEL,
  rerankModelDownloadLabel,
} from "./backend/browserRerankers";

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

/**
 * Cross-encoder reranking that runs client-side.
 *
 * Separate from CrossEncoderRerankSchema because the models differ: these are
 * quantized ONNX conversions small enough to fetch on demand, where the
 * server-side list includes ones that are not.
 */
export const BrowserCrossEncoderRerankSchema: ModelSettingsDict = {
  fullName: "Cross-encoder Reranker (in-browser)",
  description:
    "Reorder retrieved documents by reading each one together with the " +
    "query, using a small cross-encoder that runs in your browser. No " +
    "server needed. The model downloads once on first use.",
  schema: {
    type: "object",
    required: ["browserRerankModel", "top_k"],
    properties: {
      shortName: {
        type: "string",
        default: "Reranker",
        title: "Nickname",
        description:
          "Unique identifier to appear in ChainForge. Keep it short.",
      },
      browserRerankModel: {
        type: "string",
        title: "Cross-encoder Model",
        default: DEFAULT_BROWSER_RERANK_MODEL,
        enum: Object.keys(BROWSER_RERANK_MODELS),
        description:
          "Downloaded once and cached by your browser. Larger models order " +
          "a little better and take longer per document.",
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
        placeholder: "Custom name for your reranking method",
      },
    },
    browserRerankModel: {
      "ui:widget": "select",
      "ui:options": {
        enumOptions: Object.values(BROWSER_RERANK_MODELS).map((m) => ({
          value: m.id,
          label: `${m.label} (${rerankModelDownloadLabel(m)}) -- ${m.note}`,
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

// Combined schema object for all reranking methods
export const RerankMethodSchemas: {
  [baseMethod: string]: ModelSettingsDict;
} = {
  cross_encoder: CrossEncoderRerankSchema,
  browser_cross_encoder: BrowserCrossEncoderRerankSchema,
  cohere_rerank: CohereRerankSchema,
};

// Method groupings for the menu
export const rerankMethodGroups = [
  {
    label: "Basic (no server needed)",
    items: [
      {
        baseMethod: "browser_cross_encoder",
        runsIn: "browser" as RunsIn,
        name: "Cross-encoder (in-browser)",
        library: "Transformers.js",
        emoji: "\u2728",
        group: "Basic (no server needed)",
        needsEmbeddingModel: false,
        defaultSettings: {
          browserRerankModel: DEFAULT_BROWSER_RERANK_MODEL,
          shortName: "Reranker",
          top_k: 5,
        },
      },
    ],
  },
  {
    label: "Cross Encoder",
    items: [
      {
        baseMethod: "cross_encoder",
        runsIn: "backend" as RunsIn,
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
        runsIn: "backend" as RunsIn,
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
        runsIn: "backend" as RunsIn,
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
        runsIn: "backend" as RunsIn,
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
        runsIn: "backend" as RunsIn,
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
        runsIn: "backend" as RunsIn,
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
        runsIn: "backend" as RunsIn,
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
        runsIn: "backend" as RunsIn,
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
        runsIn: "backend" as RunsIn,
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
