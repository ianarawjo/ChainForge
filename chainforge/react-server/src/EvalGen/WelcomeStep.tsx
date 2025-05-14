import React from "react";
import { Anchor, Button, List, Stack, Text, Title } from "@mantine/core";

interface WelcomeStepProps {
  setOnNextCallback: React.Dispatch<React.SetStateAction<() => unknown>>;
}

const WelcomeStep: React.FC<WelcomeStepProps> = ({ setOnNextCallback }) => (
  <Stack spacing="md" m="lg" p="lg" mb={120}>
    <Title order={2}>Welcome to the EvalGen Wizard</Title>
    <Text>
      This wizard will guide you through creating automated evaluators for LLM
      responses that are aligned with your preferences. You&apos;ll look at
      data, define what you care about, apply those criteria to grade data, and
      refine your criteria as you see more outputs. EvalGen then generates
      automated evaluators that implement each criteria, chooses implementations
      most aligned with your grades, and reports how aligned they are.
    </Text>
    <Text>
      EvalGen is backed up by our{" "}
      <Anchor
        href="https://dl.acm.org/doi/abs/10.1145/3654777.3676450"
        target="_blank"
      >
        empirical research at UIST 2024
      </Anchor>
      , and is inspired by inductive processes in UX research (heuristic
      evaluation and grounded theory).
    </Text>
    <Text>Currently, Evalgen is in a public beta. It:</Text>
    <List>
      <List.Item>
        Only generates <b>assertions (pass/fail tests)</b>. Numeric and
        categorical evaluators are not included.
      </List.Item>
      <List.Item>
        Asks for grades on a <b>per-criteria</b> basis on the main grading
        screen. This is the chief difference from our paper.
      </List.Item>
      <List.Item>
        Requires access to the GenAI features of ChainForge, which (currently)
        requires an OpenAI API key. (If you&apos;d like to use other models,
        more general access to GenAI features is coming soon.)
      </List.Item>
      <List.Item>
        Should be run on the outputs of <b>already-run</b> Prompt Nodes
        (you&apos;ve already collected some LLM responses).
      </List.Item>
      <List.Item>EvalGen will send off many requests during usage.</List.Item>
    </List>
    <Text>
      🔔 <b>By using Evalgen, you take full responsibility for credit usage.</b>{" "}
      Currently, EvalGen does NOT:
    </Text>
    <List>
      <List.Item>
        Work on imported spreadsheets of data (although if you are interested in
        this, raise a Pull Request).
      </List.Item>
      <List.Item>
        Generate code that uses third-party libraries. For safety, LLM-generated
        Python code is run sandboxed in the browser with pyodide. Pyodide does
        not have access to many libraries out-of-the-box. (If your eval criteria
        implementation must use a third-party library, we suggest you use
        ChainForge&apos;s genAI features on an individual code eval node,
        outside this wizard.)
      </List.Item>
    </List>
    {/* <Text>We have captured the following about your context:</Text>
    <ul>
      <li>…</li>
      <li>[x] Use this info when helping me think of evaluation criteria</li>
    </ul> */}
    <Text>
      After EvalGen finishes, the chosen evaluators appear in the MultiEval
      node.
    </Text>
    <Text>
      EvalGen is in beta. To improve it, provide feedback on our Github Issues
      or Discussion pages, or raise a Pull Request with the changes.
    </Text>
  </Stack>
);

export default WelcomeStep;
