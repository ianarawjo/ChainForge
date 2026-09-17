# TODO

## AI support

- **Undo for AI "Replace".** Replace in the sparkle popovers (TextFields, Items and Tabular Data nodes, code evaluators and processors, LLM Scorer rubrics) overwrites what's there with no way back. Keep a snapshot so it can be undone.
- **Revise a prompt from feedback.** A Prompt Node tool that drafts a revision of the prompt from the user's description of what isn't working (required), optionally showing the model a few of the node's recent responses with their ratings and notes. Add the result as a new prompt variant with a note on what changed, rather than overwriting, and avoid wording that promises an improvement.
