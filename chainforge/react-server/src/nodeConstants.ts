// Shared constants for node tooltips and documentation
// This is the single source of truth for node descriptions

export const NODE_TOOLTIPS: Record<string, string> = {
  prompt:
    "Prompt one or multiple LLMs. Specify prompt variables in brackets {}.",
  chat: "Start or continue a conversation with chat models. Attach Prompt Node output as past context to continue chatting past the first turn.",
  textfields:
    "Specify input text to prompt or chat nodes. You can also declare variables in brackets {} to chain TextFields together.",
  csv: "Specify inputs as a comma-separated list of items. Good for specifying lots of short text values. An alternative to TextFields node.",
  table:
    "Import or create a spreadsheet of data to use as input to prompt or chat nodes. Import accepts xlsx, csv, and jsonl.",
  chunk:
    "Chunk texts into smaller pieces. Compare different chunking methods. Typically used after the Upload Node.",
  retrieval:
    "Given chunks and queries, retrieve relevant chunks for the given query. Compare retrieval methods across queries. Retrieval methods include both classical methods like BM25, and vector stores.",
  rerank: "Reranks retrieval outputs.",
  upload: "Upload documents to the flow, such as text files or PDFs.",
  simpleval: "Evaluate responses with a simple check (no coding required).",
  "evaluator-javascript": "Evaluate responses by writing JavaScript code.",
  "evaluator-python": "Evaluate responses by writing Python code.",
  evaluator: "Evaluate responses by writing JavaScript or Python code.",
  "processor-javascript":
    "Transform responses by mapping a JavaScript function over them.",
  "processor-python":
    "Transform responses by mapping a Python function over them.",
  processor: "Transform responses by mapping a function over them.",
  llmeval:
    "Evaluate responses with an LLM. (Note that LLM evaluators should be used with caution and always double-checked.)",
  multieval:
    "Evaluate responses across multiple criteria (multiple code and/or LLM evaluators).",
  vis: "Plot evaluation results. (Attach an evaluator or scorer node as input.)",
  inspect:
    "Used to inspect responses from prompter or evaluation nodes, without opening up the pop-up view.",
  script:
    "Specify directories to load as local packages, so they can be imported in your Python evaluator nodes (add to sys path).",
  join: "Concatenate responses or input data together before passing into later nodes, within or across variables and LLMs.",
  split:
    "Split responses or input data by some format. For instance, you can split a markdown list into separate items.",
  comment: "Make a comment about your flow.",
  media: "Add image data with corresponding metadata.",
  selectvars:
    "Filter which variables and metavariables to keep for the next steps.",
};

export const NODE_DOC_PATHS: Record<string, string> = {
  prompt: "prompt-node",
  chat: "chat-turn-node",
  textfields: "textfields-node",
  csv: "random-sampling-from-a-spreadsheet",
  table: "tabular-data-node",
  chunk: "chunker-node",
  retrieval: "retrieval-node",
  rerank: "rerank-node",
  upload: "upload-node",
  simpleval: "simple-evaluator-node",
  evaluator: "code-evaluator-node",
  processor: "code-processor-nodes",
  llmeval: "llm-scorer-node",
  multieval: "multi-evaluator-node",
  vis: "vis-node",
  inspect: "inspect-node",
  script: "global-python-scripts",
  join: "join-node",
  split: "split-node",
  comment: "comment-node",
  media: "",
  selectvars: "",
};
