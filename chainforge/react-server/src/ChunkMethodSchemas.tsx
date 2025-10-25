import { ModelSettingsDict } from "./backend/typing";

/**
 * Overlapping + LangChain
 */
export const OverlappingLangChainSchema: ModelSettingsDict = {
  fullName: "Overlapping + LangChain",
  description: "Chunk text via LangChain's RecursiveCharacterTextSplitter.",
  schema: {
    type: "object",
    required: ["chunk_size", "chunk_overlap"],
    properties: {
      chunk_size: { type: "number", default: 2000, title: "Chunk Size" },
      chunk_overlap: { type: "number", default: 300, title: "Overlap" },
    },
  },
  uiSchema: {
    chunk_size: {
      "ui:widget": "updown", // HTML range input
      "ui:options": {
        min: 100,
        max: 5000,
        step: 50,
      },
    },
    chunk_overlap: {
      "ui:widget": "updown",
      "ui:options": {
        min: 0,
        max: 500,
        step: 10,
      },
    },
  },
  postprocessors: {},
};

/**
 * Overlapping + OpenAI tiktoken
 */
export const OverlappingOpenAITiktokenSchema: ModelSettingsDict = {
  fullName: "Overlapping + OpenAI tiktoken",
  description: "Chunk text using the OpenAI tiktoken library with overlap.",
  schema: {
    type: "object",
    required: ["max_tokens", "overlap_tokens"],
    properties: {
      model: {
        type: "string",
        default: "gpt-3.5-turbo",
        title: "Model",
        description:
          "Model to use for tokenizing. See tiktoken API docs for options.",
      },
      chunk_size: {
        type: "number",
        default: 200,
        title: "Max tokens per chunk",
      },
      chunk_overlap: {
        type: "number",
        default: 50,
        title: "Overlap tokens",
      },
    },
  },
  uiSchema: {},
  postprocessors: {},
};

/**
 * Overlapping + HuggingFace Tokenizers
 */
export const OverlappingHuggingfaceTokenizerSchema: ModelSettingsDict = {
  fullName: "Overlapping + HuggingFace Tokenizers",
  description: "Chunk text using HuggingFace tokenizer-based segmentation.",
  schema: {
    type: "object",
    required: ["tokenizer", "chunk_size", "chunk_overlap"],
    properties: {
      tokenizer: {
        type: "string",
        default: "bert-base-uncased",
        title: "Tokenizer Model",
        description:
          "Tokenizer model to use for chunking. See HuggingFace AutoTokenizer docs for options.",
      },
      chunk_size: {
        type: "number",
        default: 200,
        title: "Tokens per chunk",
      },
      chunk_overlap: {
        type: "number",
        default: 50,
        title: "Overlap tokens",
      },
    },
  },
  uiSchema: {
    tokenizer_model: {
      "ui:widget": "select", // display as a dropdown
    },
    chunk_size: {
      "ui:widget": "updown",
      "ui:options": {
        min: 100,
        max: 5000,
        step: 50,
      },
    },
  },
  postprocessors: {},
};

/**
 * Markdown chunker
 */

export const MarkdownHeaderSchema: ModelSettingsDict = {
  fullName: "Markdown Chunker",
  description:
    "Splits markdown text at #/##/### headings; each section keeps its heading.",
  schema: { type: "object", required: [], properties: {} },
  uiSchema: {},
  postprocessors: {},
};

/**
 * Syntax-based spaCy
 */
export const SyntaxSpacySchema: ModelSettingsDict = {
  fullName: "Syntax-based spaCy",
  description: "Splits text into sentences using spaCy.",
  schema: { type: "object", required: [], properties: {} },
  uiSchema: {},
  postprocessors: {},
};

/**
 * Syntax-based TextTiling
 */
export const SyntaxTextTilingSchema: ModelSettingsDict = {
  fullName: "Syntax-based TextTiling",
  description: "Splits text into multi-sentence segments using TextTiling.",
  schema: {
    type: "object",
    required: ["w", "k"],
    properties: {
      w: { type: "number", default: 20, title: "Window size (w)" },
      k: { type: "number", default: 10, title: "Block comparison size (k)" },
    },
  },
  uiSchema: {
    w: {
      "ui:widget": "range",
      "ui:options": {
        min: 5,
        max: 50,
        step: 5,
      },
    },
    k: {
      "ui:widget": "range",
      "ui:options": {
        min: 5,
        max: 50,
        step: 5,
      },
    },
  },
  postprocessors: {},
};

/**
 * Hybrid: TextTiling + spaCy
 */
export const HybridTextTilingSpacySchema: ModelSettingsDict = {
  fullName: "Hybrid: TextTiling + spaCy",
  description:
    "Combines TextTiling for broad segmentation, then spaCy for finer splits.",
  schema: {
    type: "object",
    required: ["w", "k"],
    properties: {
      w: { type: "number", default: 20, title: "Window size (w)" },
      k: { type: "number", default: 10, title: "Block comparison size (k)" },
    },
  },
  uiSchema: {
    w: {
      "ui:widget": "range",
      "ui:options": {
        min: 5,
        max: 50,
        step: 5,
      },
    },
    k: {
      "ui:widget": "range",
      "ui:options": {
        min: 5,
        max: 50,
        step: 5,
      },
    },
  },
  postprocessors: {},
};

/**
 * Hybrid: BERTopic + spaCy
 */
export const HybridBERTopicSchema: ModelSettingsDict = {
  fullName: "BERTopic + spaCy",
  description: "Splits text using a hybrid approach with BERTopic + spaCy.",
  schema: {
    type: "object",
    required: ["min_topic_size"],
    properties: {
      min_topic_size: {
        type: "number",
        default: 2,
        title: "Min Topic Size",
      },
    },
  },
  uiSchema: {
    min_topic_size: {
      "ui:widget": "range",
      "ui:options": {
        min: 2,
        max: 20,
        step: 1,
      },
    },
  },
  postprocessors: {},
};

/**
 * Hybrid: Recursive + Gensim
 */
export const HybridRecursiveGensimSchema: ModelSettingsDict = {
  fullName: "Hybrid: Recursive TextSplitter + Gensim",
  description: "Combines a recursive approach with Gensim's text modeling.",
  schema: {
    type: "object",
    required: ["max_words"],
    properties: {
      max_words: {
        type: "number",
        default: 300,
        title: "Words per chunk",
      },
    },
  },
  uiSchema: {
    max_words: {
      "ui:widget": "updown",
      "ui:options": {
        min: 50,
        max: 5000,
        step: 50,
      },
    },
  },
  postprocessors: {},
};

/**
 * Hybrid: Recursive + Cohere
 */
export const HybridRecursiveCohereSchema: ModelSettingsDict = {
  fullName: "Hybrid: Recursive TextSplitter + Cohere",
  description: "Uses Cohere's embeddings to guide recursive chunking.",
  schema: {
    type: "object",
    required: ["max_tokens"],
    properties: {
      max_tokens: {
        type: "number",
        default: 512,
        title: "Max tokens per chunk",
      },
      threshold: {
        type: "number",
        default: 0.75,
        title: "Embedding similarity threshold",
      },
    },
  },
  uiSchema: {
    max_tokens: {
      "ui:widget": "range",
      "ui:options": {
        min: 128,
        max: 2048,
        step: 128,
      },
    },
    threshold: {
      "ui:widget": "range",
      "ui:options": {
        min: 0.0,
        max: 1.0,
        step: 0.05,
      },
    },
  },
  postprocessors: {},
};

/**
 * Hybrid: Recursive + BERTopic
 */
export const HybridRecursiveBERTopicSchema: ModelSettingsDict = {
  fullName: "Hybrid: Recursive TextSplitter + BERTopic",
  description:
    "Uses a recursive approach combined with BERTopic for semantic grouping.",
  schema: {
    type: "object",
    required: ["min_topic_size", "chunk_size"],
    properties: {
      min_topic_size: {
        type: "number",
        default: 2,
        title: "Min Topic Size",
      },
      chunk_size: {
        type: "number",
        default: 300,
        title: "Base chunk size",
      },
    },
  },
  uiSchema: {
    min_topic_size: {
      "ui:widget": "range",
      "ui:options": {
        min: 2,
        max: 20,
        step: 1,
      },
    },
    chunk_size: {
      "ui:widget": "updown",
      "ui:options": {
        min: 50,
        max: 2000,
        step: 50,
      },
    },
  },
  postprocessors: {},
};

/**
 * Chonkie Token Chunker
 */
export const ChonkieTokenSchema: ModelSettingsDict = {
  fullName: "Chonkie Token Chunker",
  description: "Chunk text using token-based chunking via Chonkie library.",
  schema: {
    type: "object",
    required: ["tokenizer", "chunk_size", "chunk_overlap"],
    properties: {
      tokenizer: {
        type: "string",
        default: "gpt2",
        title: "Tokenizer",
        description:
          "Tokenizer or token counter to use. See Chonkie docs for options.",
      },
      chunk_size: {
        type: "number",
        default: 512,
        title: "Chunk Size (tokens)",
      },
      chunk_overlap: {
        type: "number",
        default: 0,
        title: "Overlap (tokens)",
      },
    },
  },
  uiSchema: {},
  postprocessors: {},
};

/**
 * Chonkie Sentence Chunker
 */
export const ChonkieSentenceSchema: ModelSettingsDict = {
  fullName: "Chonkie Sentence Chunker",
  description:
    "Chunk text by sentences with token count awareness via Chonkie library.",
  schema: {
    type: "object",
    required: ["tokenizer_or_token_counter", "chunk_size", "chunk_overlap"],
    properties: {
      tokenizer_or_token_counter: {
        type: "string",
        default: "gpt2",
        title: "Tokenizer",
        description:
          "Tokenizer or token counter to use. See Chonkie docs for options.",
      },
      chunk_size: {
        type: "number",
        default: 512,
        title: "Max tokens per chunk",
      },
      chunk_overlap: {
        type: "number",
        default: 0,
        title: "Overlap (tokens)",
      },
      min_sentences_per_chunk: {
        type: "number",
        default: 1,
        title: "Min sentences per chunk",
      },
      min_characters_per_sentence: {
        type: "number",
        default: 12,
        title: "Min characters per sentence",
      },
      delim: {
        type: "string",
        default: '[".", "!", "?"]',
        title: "Sentence delimiters (JSON array)",
      },
      include_delim: {
        type: "string",
        default: "prev",
        title:
          "Include delimiters in chunks (prev, next, or leave blank for none)",
      },
    },
  },
  uiSchema: {
    delim: {
      "ui:help": "JSON array of delimiter characters",
    },
  },
  postprocessors: {
    include_delim: (value: string | number | boolean): string | null => {
      if (typeof value !== "string") return null;
      if (value !== "prev" && value !== "next") {
        return null;
      } else {
        return value;
      }
    },
  },
};

/**
 * Chonkie Recursive Chunker
 */
export const ChonkieRecursiveSchema: ModelSettingsDict = {
  fullName: "Chonkie Recursive Chunker",
  description:
    "Chunk text recursively with hierarchical splitting via Chonkie library.",
  schema: {
    type: "object",
    required: [
      "tokenizer_or_token_counter",
      "chunk_size",
      "min_characters_per_chunk",
    ],
    properties: {
      tokenizer_or_token_counter: {
        type: "string",
        default: "gpt2",
        title: "Tokenizer",
        description:
          "Tokenizer or token counter to use. See Chonkie docs for options.",
      },
      chunk_size: {
        type: "number",
        default: 512,
        title: "Max tokens per chunk",
      },
      min_characters_per_chunk: {
        type: "number",
        default: 12,
        title: "Min characters per chunk",
      },
      use_premade_recipe: {
        type: "string",
        default: "markdown-en",
        title: "Premade recipe (optional)",
        description:
          "Format: 'name-language' (e.g., 'markdown-en') or just 'language' (e.g., 'en'). Defaults to markdown-en, since ChainForge parses documents by default into markdown. See Chonkie Recipes for available options: https://huggingface.co/datasets/chonkie-ai/recipes/viewer/recipes/train?row=5&views%5B%5D=recipes",
      },
      custom_recipe: {
        type: "string",
        default: "",
        title: "Custom recipe JSON (optional)",
        description:
          "JSON array of recursive chunking rules (RecursiveLevel in the Chonkie API). Overrides premade recipe if provided.",
      },
    },
  },
  uiSchema: {
    custom_recipe: {
      "ui:widget": "textarea",
      "ui:help": "JSON array of recursive chunking rules",
    },
  },
  postprocessors: {},
};

/**
 * Chonkie Semantic Chunker
 */
export const ChonkieSemanticSchema: ModelSettingsDict = {
  fullName: "Chonkie Semantic Chunker",
  description:
    "Chunk text by semantic similarity with embedding-based segmentation via Chonkie library.",
  schema: {
    type: "object",
    required: ["embedding_model", "chunk_size", "threshold"],
    properties: {
      embedding_model: {
        type: "string",
        default: "minishlab/potion-base-8M",
        title: "Embedding Model",
        description:
          "Model to use for embeddings. See Chonkie docs for options.",
      },
      embedding_local_path: {
        type: "string",
        default: "",
        title: "Embedding Local Path",
        description:
          "Local path for model to use for embeddings (only needed if cant download through Chonkie).",
      },
      chunk_size: {
        type: "number",
        default: 512,
        title: "Max tokens per chunk",
      },
      threshold: {
        type: "string",
        default: "auto",
        title: "Similarity threshold",
        description:
          "When in the range [0,1], denotes the similarity threshold to consider sentences similar. When in the range (1,100], interprets the given value as a percentile threshold. When set to 'auto', the threshold is automatically calculated.",
      },
      mode: {
        type: "string",
        default: "window",
        title: "Chunking mode",
        description:
          "Mode for grouping sentences, either “cumulative” or “window",
        enum: ["window", "cumulative"],
      },
      similarity_window: {
        type: "number",
        default: 1,
        title: "Similarity window",
        description:
          "Number of sentences to consider for similarity threshold calculation",
      },
      min_sentences: {
        type: "number",
        default: 1,
        title: "Min sentences per chunk",
      },
      min_chunk_size: {
        type: "number",
        default: 0,
        title: "Min chunk size (optional)",
        description: "Leave as 0 to use default behavior",
      },
      min_characters_per_sentence: {
        type: "number",
        default: 12,
        title: "Min characters per sentence",
      },
      threshold_step: {
        type: "number",
        default: 0.01,
        title: "Threshold step size",
      },
      delim: {
        type: "string",
        default: '[".", "!", "?", "\\n\\n"]',
        title: "Sentence delimiters (JSON array)",
      },
    },
  },
  uiSchema: {
    mode: {
      "ui:widget": "select",
    },
    threshold: {
      "ui:help": "Use 'auto' for automatic threshold detection.",
    },
    delim: {
      "ui:help": "JSON array of delimiter characters",
    },
  },
  postprocessors: {
    threshold: (value: string | number | boolean): string | number => {
      if (value === "auto") return "auto";
      if (typeof value === "number") return value;
      if (typeof value === "string") {
        try {
          const num = parseFloat(value);
          if (!isNaN(num)) return num;
        } catch (e) {}
      }
      return "auto";
    },
    min_chunk_size: (value: string | number | boolean): number | null => {
      if (typeof value === "number") {
        return value > 0 ? value : null;
      }
      return null;
    },
  },
};

/**
 * Chonkie SDPM Chunker
 */
export const ChonkieSDPMSchema: ModelSettingsDict = {
  fullName: "Chonkie SDPM Chunker",
  description:
    "Chunk text using Sentence-level Divergence-based Progressive Merging via Chonkie library.",
  schema: {
    type: "object",
    required: ["embedding_model", "chunk_size", "threshold"],
    properties: {
      embedding_model: {
        type: "string",
        default: "minishlab/potion-base-8M",
        title: "Embedding Model",
        description:
          "Model to use for embeddings. See Chonkie docs for options.",
      },
      embedding_local_path: {
        type: "string",
        default: "",
        title: "Embedding Local Path",
        description:
          "Local path for model to use for embeddings (only needed if cant download through Chonkie).",
      },
      chunk_size: {
        type: "number",
        default: 512,
        title: "Max tokens per chunk",
      },
      threshold: {
        type: "string",
        default: "auto",
        title: "Similarity threshold",
        description:
          "When in the range [0,1], denotes the similarity threshold to consider sentences similar. When in the range (1,100], interprets the given value as a percentile threshold. When set to “auto”, the threshold is automatically calculated.",
      },
      mode: {
        type: "string",
        default: "window",
        title: "Chunking mode",
        description:
          "Mode for grouping sentences, either 'cumulative' or 'window'",
        enum: ["window", "cumulative"],
      },
      similarity_window: {
        type: "number",
        default: 1,
        title: "Similarity window",
        description:
          "Number of sentences to consider for similarity threshold calculation",
      },
      min_sentences: {
        type: "number",
        default: 1,
        title: "Min sentences per chunk",
      },
      min_chunk_size: {
        type: "number",
        default: 2,
        title: "Min chunk size",
      },
      min_characters_per_sentence: {
        type: "number",
        default: 12,
        title: "Min characters per sentence",
      },
      threshold_step: {
        type: "number",
        default: 0.01,
        title: "Threshold step size",
      },
      skip_window: {
        type: "number",
        default: 1,
        title: "Skip window",
        description: "Window size for skipping in SDPM algorithm",
      },
      delim: {
        type: "string",
        default: '[".", "!", "?", "\\n\\n"]',
        title: "Sentence delimiters (JSON array)",
      },
      include_delim: {
        type: "string",
        default: "",
        title: "Include delimiters in chunks (prev, next, or none), optional",
      },
    },
  },
  uiSchema: {
    mode: {
      "ui:widget": "select",
    },
    threshold: {
      "ui:help": "Use 'auto' for automatic threshold detection",
    },
    delim: {
      "ui:help": "JSON array of delimiter characters",
    },
  },
  postprocessors: {
    threshold: (value: string | number | boolean): string | number => {
      if (value === "auto") return "auto";
      if (typeof value === "number") return value;
      if (typeof value === "string") {
        try {
          const num = parseFloat(value);
          if (!isNaN(num)) return num;
        } catch (e) {}
      }
      return "auto";
    },
    include_delim: (value: string | number | boolean): string | null => {
      if (typeof value !== "string") return null;
      if (value !== "prev" && value !== "next") {
        return null;
      } else {
        return value;
      }
    },
  },
};

/**
 * Chonkie Late Chunker
 */
export const ChonkieLateSchema: ModelSettingsDict = {
  fullName: "Chonkie Late Chunker",
  description:
    "Chunk text with embedding-guided hierarchical splitting via Chonkie library.",
  schema: {
    type: "object",
    required: ["embedding_model", "chunk_size", "min_characters_per_chunk"],
    properties: {
      embedding_model: {
        type: "string",
        default: "sentence-transformers/all-MiniLM-L6-v2",
        title: "Embedding Model",
        description:
          "Model to use for embeddings. See Chonkie docs for options.",
      },
      embedding_local_path: {
        type: "string",
        default: "",
        title: "Embedding Local Path",
        description:
          "Local path for model to use for embeddings (only needed if cant download through Chonkie).",
      },
      chunk_size: {
        type: "number",
        default: 512,
        title: "Max tokens per chunk",
      },
      min_characters_per_chunk: {
        type: "number",
        default: 24,
        title: "Min characters per chunk",
      },
      use_premade_recipe: {
        type: "string",
        default: "markdown-en",
        title: "Premade recipe (optional)",
        description:
          "Format: 'name-language' (e.g., 'markdown-en') or just 'language' (e.g., 'en'). Defaults to markdown-en, since ChainForge parses documents by default into markdown. See Chonkie Recipes for available options: https://huggingface.co/datasets/chonkie-ai/recipes/viewer/recipes/train?row=5&views%5B%5D=recipes",
      },
      custom_recipe: {
        type: "string",
        default: "",
        title: "Custom recipe JSON (optional)",
        description:
          "JSON array of recursive chunking rules. Overrides premade recipe if provided.",
      },
    },
  },
  uiSchema: {
    custom_recipe: {
      "ui:widget": "textarea",
      "ui:help": "JSON array of recursive chunking rules",
    },
  },
  postprocessors: {},
};

export const ChunkMethodSchemas: { [baseMethod: string]: ModelSettingsDict } = {
  overlapping_langchain: OverlappingLangChainSchema,
  overlapping_openai_tiktoken: OverlappingOpenAITiktokenSchema,
  overlapping_huggingface_tokenizers: OverlappingHuggingfaceTokenizerSchema,
  markdown_header: MarkdownHeaderSchema,
  syntax_spacy: SyntaxSpacySchema,
  syntax_texttiling: SyntaxTextTilingSchema,
  hybrid_texttiling_spacy: HybridTextTilingSpacySchema,
  hybrid_bertopic_spacy: HybridBERTopicSchema,
  hybrid_recursive_gensim: HybridRecursiveGensimSchema,
  hybrid_recursive_cohere: HybridRecursiveCohereSchema,
  hybrid_recursive_bertopic: HybridRecursiveBERTopicSchema,
  chonkie_token: ChonkieTokenSchema,
  chonkie_sentence: ChonkieSentenceSchema,
  chonkie_recursive: ChonkieRecursiveSchema,
  chonkie_semantic: ChonkieSemanticSchema,
  chonkie_sdpm: ChonkieSDPMSchema,
  chonkie_late: ChonkieLateSchema,
};

export const ChunkMethodGroups = [
  {
    label: "Chonkie 🐿️",
    items: [
      {
        baseMethod: "chonkie_token",
        methodType: "Chonkie",
        name: "Token Chunker",
        emoji: "🐿️",
      },
      {
        baseMethod: "chonkie_sentence",
        methodType: "Chonkie",
        name: "Sentence Chunker",
        emoji: "✂️",
      },
      {
        baseMethod: "chonkie_recursive",
        methodType: "Chonkie",
        name: "Recursive Chunker",
        emoji: "🔄",
      },
      {
        baseMethod: "chonkie_semantic",
        methodType: "Chonkie",
        name: "Semantic Chunker",
        emoji: "🤖",
      },
      {
        baseMethod: "chonkie_sdpm",
        methodType: "Chonkie",
        name: "SDPM Chunker",
        emoji: "🧬",
      },
      {
        baseMethod: "chonkie_late",
        methodType: "Chonkie",
        name: "Late Chunker",
        emoji: "⏳",
      },
    ],
  },
  {
    label: "Overlapping Chunking",
    items: [
      {
        baseMethod: "overlapping_langchain",
        methodType: "Overlapping Chunking",
        name: "LangChain TextSplitter",
        emoji: "🌐",
      },
      {
        baseMethod: "overlapping_openai_tiktoken",
        methodType: "Overlapping Chunking",
        name: "OpenAI tiktoken",
        emoji: "🤖",
      },
      {
        baseMethod: "overlapping_huggingface_tokenizers",
        methodType: "Overlapping Chunking",
        name: "HuggingFace Tokenizers",
        emoji: "🤗",
      },
    ],
  },
  {
    label: "Syntax-Based Chunking",
    items: [
      {
        baseMethod: "markdown_header",
        methodType: "Markdown",
        name: "Markdown Chunker",
        emoji: "📝",
      },
      {
        baseMethod: "syntax_spacy",
        methodType: "Syntax-Based Chunking",
        name: "spaCy Sentence Splitter",
        emoji: "🐍",
      },
      {
        baseMethod: "syntax_texttiling",
        methodType: "Syntax-Based Chunking",
        name: "Stopword Chunker",
        emoji: "📑",
      },
    ],
  },
];
