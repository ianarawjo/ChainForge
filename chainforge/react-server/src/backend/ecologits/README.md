# EcoLogits energy estimates

ChainForge estimates the energy each response used in the provider's data centre with the method of [EcoLogits](https://github.com/mlco2/ecologits) (GenAI Impact), at EcoLogits **0.11.1**. The estimate appears with a response's other stats as a range in Wh. Evaluators can read it from the metavars `stat_est_energy_wh_min` / `stat_est_energy_wh_max`.

It is an estimate, not a measurement. EcoLogits models each request from:

- the model's size (published, or estimated where the lab hasn't said);
- the output tokens and the request's latency;
- data-centre GPUs (80 GB, 8 to a server);
- the provider's data-centre overhead (PUE).

It ignores input tokens. For how, see [EcoLogits' methodology](https://ecologits.ai/latest/methodology/llm_inference/).

Which responses get an estimate (see `ecologitsModel` in `../responseStats.ts`):

- **Covered:** models EcoLogits lists from its providers, reached through ChainForge's OpenAI, Anthropic, Google Gemini or Hugging Face providers, or through OpenRouter. On OpenRouter these are models from OpenAI, Anthropic, Google, Mistral and Cohere, or models with a Hugging Face ID. Names are matched exactly, allowing only for case and "." for "-" (OpenRouter's "claude-sonnet-4.5" is EcoLogits' "claude-sonnet-4-5").
- **Not covered:**
  - models EcoLogits doesn't list, e.g. ones released after the pinned release;
  - ChainForge's Azure OpenAI, Amazon Bedrock, Together, DeepSeek and MiniMax providers, and custom providers;
  - OpenAI models when the OpenAI base URL setting points at another server, since the estimate would be for OpenAI's data centres;
  - local models (Ollama, LM Studio, llama.cpp, WebLLM, etc.): EcoLogits models data-centre GPUs, and a laptop isn't a data centre.
- **Per response:** a response also needs its output token count and latency. Responses collected before ChainForge estimated energy have no estimate.

Where some responses have no estimate, the Vis Node leaves them out of energy plots and says so under the plot.

## What's here

| File            | What it is                                                                                                                                   | Licence             |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| `models.json`   | EcoLogits' model data, byte for byte                                                                                                         | MPL-2.0 (EcoLogits) |
| `method.json`   | The constants of `ecologits/impacts/llm.py` and each provider's data-centre figures from `ecologits/tracers/utils.py`, read out by `sync.py` | MPL-2.0 (EcoLogits) |
| `ecologits.ts`  | A TypeScript port of EcoLogits' energy formulas                                                                                              | MPL-2.0             |
| `LICENSE`       | EcoLogits' licence, the Mozilla Public License 2.0                                                                                           |                     |
| `upstream.json` | The release and commit these came from, and each source file's SHA-256                                                                       |                     |
| `sync.py`       | Updates this folder to an EcoLogits release                                                                                                  | MIT (ChainForge)    |

The MPL applies to those files only, not to the rest of ChainForge. Changes to them must stay under the MPL, and their source must stay available (it is, here).

## Staying in sync

Only the formulas in `ecologits.ts` are copied by hand; the data and numbers come from EcoLogits itself:

```bash
python sync.py          # the latest EcoLogits release
python sync.py 0.12.0   # a given release
```

`sync.py` refuses data that `ecologits.ts` would misread. For example, EcoLogits' `main` (unreleased, September 2026) gives time to first token in milliseconds where the formulas expect seconds. So pin releases, not `main`.

When EcoLogits' formulas change (`llm.py`), `sync.py` says so. Then check `ecologits.ts` against them, and update the reference values in `__test__/ecologits.test.ts` from EcoLogits' own `llm_impacts`.

A test checks that `models.json` is unchanged from what was synced. Prettier skips these JSON files (see `.prettierignore`).

The GitHub workflow `sync-ecologits.yml` runs `sync.py` monthly and opens a pull request when EcoLogits has a new release.
