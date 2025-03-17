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
      responses that are aligned with your preferences. You`&apos;ll look at
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
      , and is inspired by similar inductive processes in grounded theory and
      heuristic evaluation. Currently, Evalgen:
    </Text>
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
        Requires access to the GenAI features of ChainForge. Set up the Provider
        you wish to use for this in your Global Settings view. The Provider must
        be powerful enough to generate code. (By default, it is OpenAI.)
      </List.Item>
      <List.Item>
        Should be run on the outputs of <b>already-run</b> Prompt Nodes (LLM
        responses).
      </List.Item>
      <List.Item>
        EvalGen will send off many requests during usage. 🔔{" "}
        <b>By using Evalgen, you take full responsibility for credit usage.</b>
      </List.Item>
    </List>
    <Text>Currently, EvalGen does NOT:</Text>
    <List>
      <List.Item>
        Work on imported spreadsheets of data (although if you are interested in
        this, raise a Pull Request).
      </List.Item>
      <List.Item>
        Generate code that uses third-party libraries. For safety, LLM-generated
        Python code is run sandboxed in the browser with pyodide. (If your eval
        criteria implementation must use a third-party library, we suggest you
        use ChainForge’s genAI features on the specific eval node, outside this
        wizard.)
      </List.Item>
    </List>
    {/* <Text>We have captured the following about your context:</Text>
    <ul>
      <li>…</li>
      <li>[x] Use this info when helping me think of evaluation criteria</li>
    </ul> */}
    <Text>
      After EvalGen finishes, the chosen evaluators appear in the MultiEval
      node. You can export evaluator details by right-clicking the node and
      selecting Copy Eval Specs.
    </Text>
    <Text>
      EvalGen is in Beta. To improve it, provide feedback on our Github Issues
      or Discussion pages, or raise a Pull Request with the changes.
    </Text>
  </Stack>
);

export default WelcomeStep;
