# Compare prompts using web evidence

The optional [Parallel Web Search provider](custom_provider_parallel.py) returns
web source excerpts and URLs that you can pass into a second Prompt node. Use it
to compare how different prompts or models answer from the same retrieved
evidence. It uses [Parallel Search MCP](https://docs.parallel.ai/integrations/mcp/search-mcp)
over Streamable HTTP. Anonymous search uses Fast mode and needs no Parallel
account or API key; free usage has rate limits.

## Setup

1. Install and run ChainForge locally. Python custom providers are unavailable in
   the hosted playground.
2. Install the example's dependencies in the **same Python environment** as
   ChainForge. From the root of this repository:

   ```bash
   python -m pip install -r chainforge/examples/requirements-parallel-search.txt
   chainforge serve
   ```

3. Open ChainForge's global Settings, select **Custom Providers**, and drop in
   `custom_provider_parallel.py`. As with any custom provider, review the script
   before loading it: ChainForge executes it and caches it for later sessions.

This adds an opt-in entry to the model menu; it does not change existing providers
or flows. No API key is read or sent by this example.

## Build a grounded comparison

1. Add a Prompt node and select **Parallel Web Search** as its only provider.
   Use a focused keyword query, for example `Python latest stable release features`,
   and request one response. This node returns search evidence, not a generated
   answer. Attach an Inspect node to check the source URLs and excerpts.
2. Add a second Prompt node with this template:

   ```text
   Using only the web evidence below, summarize the latest stable Python release.
   Cite source URLs for your claims. Say when the evidence is insufficient.

   Evidence:
   {evidence}
   ```

3. Connect the search node's output to the second node's `evidence` input. Select
   the LLMs you want to compare in the second node and run it. Those LLMs use their
   normal credentials. You can connect the same search output to additional
   Prompt nodes with different instructions to compare prompts against the same
   evidence. Use Inspect or evaluation nodes to compare the answers and citations.

Keep the retrieved evidence fixed during a comparison. Search results can change
when you run the search again. Check the linked pages when verifying an answer;
an excerpt is evidence to inspect, not a guarantee that a claim is correct.

The search provider accepts text queries only and rejects chat history and image
inputs. It does not execute model tool calls or fetch full pages. Requests time
out after 60 seconds and failures are reported as provider errors, rather than
being passed downstream as evidence. ChainForge's cancellation stops subsequent
custom-provider calls; an in-flight server request can continue until it finishes
or times out.
