import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
  forwardRef,
  useImperativeHandle,
  useContext,
} from "react";
import { Handle, Position } from "reactflow";
import { Code, Modal, Tooltip, Box, Text, Skeleton } from "@mantine/core";
import { Prism } from "@mantine/prism";
import { useDisclosure } from "@mantine/hooks";
import useStore from "./store";
import BaseNode from "./BaseNode";
import NodeLabel from "./NodeLabelComponent";
import {
  IconTerminal,
  IconSearch,
  IconInfoCircle,
  IconBox,
} from "@tabler/icons-react";
import LLMResponseInspectorModal, {
  LLMResponseInspectorModalRef,
} from "./LLMResponseInspectorModal";

// Ace code editor
import AceEditor from "react-ace";
import "ace-builds/src-noconflict/mode-python";
import "ace-builds/src-noconflict/mode-javascript";
import "ace-builds/src-noconflict/theme-xcode";
import "ace-builds/src-noconflict/ext-language_tools";
import {
  APP_IS_RUNNING_LOCALLY,
  genDebounceFunc,
  getVarsAndMetavars,
  stripLLMDetailsFromResponses,
  toStandardResponseFormat,
} from "./backend/utils";
import InspectFooter from "./InspectFooter";
import { escapeBraces } from "./backend/template";
import LLMResponseInspectorDrawer from "./LLMResponseInspectorDrawer";
import { AIGenCodeEvaluatorPopover } from "./AiPopover";
import {
  Dict,
  EvaluatedResponsesResults,
  PythonInterpreter,
  LLMResponse,
  TemplateVarInfo,
  VarsContext,
} from "./backend/typing";
import { Status } from "./StatusIndicatorComponent";
import { executejs, executepy, grabResponses } from "./backend/backend";
import { AlertModalContext } from "./AlertModal";

// Whether we are running on localhost or not, and hence whether
// we have access to the Flask backend for, e.g., Python code evaluation.
const IS_RUNNING_LOCALLY = APP_IS_RUNNING_LOCALLY();

const INFO_CODEBLOCK_JS_PROPS = `
  text: string;  // The text of the LLM response
  prompt: string  // The text of the prompt using to query the LLM
  llm: string | LLM  // The name of the LLM queried (the nickname in ChainForge)
  var: Dict  // A dictionary of arguments that filled in the prompt template used to generate the final prompt
  meta: Dict  // A dictionary of metadata ('metavars') that is 'carried alongside' data used to generate the prompt`;
const INFO_CODEBLOCK_JS_EXTS = `
  // Methods
  toString(): string // returns this.text
  asMarkdownAST(): Tokens[]  // runs markdown-it .parse; returns list of markdown nodes`;

export const INFO_CODEBLOCK_JS = `
class ResponseInfo {
${INFO_CODEBLOCK_JS_PROPS}
}`;

export const INFO_CODEBLOCK_JS_FULL = `
class ResponseInfo {${INFO_CODEBLOCK_JS_PROPS}
${INFO_CODEBLOCK_JS_EXTS}
}`;

const INFO_CODEBLOCK_PY_PROPS = `
  text: str  # The text of the LLM response
  prompt: str  # The text of the prompt using to query the LLM
  llm: str  # The name of the LLM queried (the nickname in ChainForge)
  var: dict  # A dictionary of arguments that filled in the prompt template used to generate the final prompt
  meta: dict  # A dictionary of metadata ('metavars') that is 'carried alongside' data used to generate the prompt`;

const INFO_CODEBLOCK_PY_EXTS = `
  # Methods
  def __str__(self):
    return self.text
  
  def asMarkdownAST(self):
    # Returns markdown AST parsed with mistune
    ...`;

export const INFO_CODEBLOCK_PY = `
class ResponseInfo:
${INFO_CODEBLOCK_PY_PROPS}
`;

export const INFO_CODEBLOCK_PY_FULL = `
class ResponseInfo:${INFO_CODEBLOCK_PY_PROPS}
${INFO_CODEBLOCK_PY_EXTS}  
`;

// Code evaluator examples for info modal
export const INFO_EXAMPLE_PY = `
def evaluate(response):
  # Return the length of the response (num of characters)
  return len(response.text);
`;
export const INFO_EXAMPLE_JS = `
function evaluate(response) {
  // Return the length of the response (num of characters)
  return response.text.length;
}`;
export const INFO_EXAMPLE_VAR_PY = `
def evaluate(response):
  country = response.var['country'];
  # do something with country here, such as lookup whether 
  # the correct capital is in response.text
  return ... # for instance, True or False
`;
export const INFO_EXAMPLE_VAR_JS = `
function evaluate(response) {
  let country = response.var['country'];
  // do something with country here, such as lookup whether 
  // the correct capital is in response.text
  return ... // for instance, true or false
}`;

// Code processor examples for info modal
const INFO_PROC_EXAMPLE_PY = `
def process(response):
  # Return the first 12 characters
  return response.text[:12]
`;
const INFO_PROC_EXAMPLE_JS = `
function process(response) {
  // Return the first 12 characters
  return response.text.slice(0, 12);
}`;
const INFO_PROC_EXAMPLE_VAR_PY = `
def process(response):
  # Find the index of the substring "ANSWER:"
  answer_index = response.text.find("ANSWER:")

  # If "ANSWER:" is in the text, return everything after it
  if answer_index != -1:
    return response.text[answer_index + len("ANSWER:"):]
  else: # return error message
    return "NOT FOUND"
`;
const INFO_PROC_EXAMPLE_VAR_JS = `
function process(response) {
  // Find the index of the substring "ANSWER:"
  const answerIndex = response.text.indexOf("ANSWER:");

  // If "ANSWER:" is in the text, return everything after it
  if (answerIndex !== -1)
    return response.text.substring(answerIndex + "ANSWER:".length);
  else  // return error message
    return "NOT FOUND";
}`;

export interface CodeEvaluatorComponentRef {
  run: (
    inputs: LLMResponse[],
    script_paths?: string[],
    runInSandbox?: boolean,
  ) => Promise<{
    code: string;
    responses?: LLMResponse[];
    error?: string | undefined;
    logs?: string[];
  }>;
  serialize: () => { code: string };
  setCodeText: (code: string) => void;
}

export interface CodeEvaluatorComponentProps {
  code: string;
  id: string;
  type: "evaluator" | "processor";
  progLang: "python" | "javascript";
  showUserInstruction: boolean;
  onCodeEdit?: (code: string) => void;
  onCodeChangedFromLastRun?: () => void;
  onCodeEqualToLastRun?: () => void;
  sandbox?: boolean;
}

/**
 * Inner component for code evaluators/processors, storing the body of the UI (outside of the header and footers).
 */
export const CodeEvaluatorComponent = forwardRef<
  CodeEvaluatorComponentRef,
  CodeEvaluatorComponentProps
>(function CodeEvaluatorComponent(
  {
    code,
    id,
    type: node_type,
    progLang,
    showUserInstruction,
    onCodeEdit,
    onCodeChangedFromLastRun,
    onCodeEqualToLastRun,
    sandbox,
  },
  ref,
) {
  // Code in the editor
  const [codeText, setCodeText] = useState(code ?? "");
  const [codeTextOnLastRun, setCodeTextOnLastRun] = useState<boolean | string>(
    false,
  );

  // Debounce helpers
  const debounceTimeoutRef = useRef(null);
  const debounce = genDebounceFunc(debounceTimeoutRef);

  // Controlled handle when user edits code
  const handleCodeEdit = (code: string) => {
    if (codeTextOnLastRun !== false) {
      const code_changed = code !== codeTextOnLastRun;
      if (code_changed && onCodeChangedFromLastRun) onCodeChangedFromLastRun();
      else if (!code_changed && onCodeEqualToLastRun) onCodeEqualToLastRun();
    }
    setCodeText(code);

    // Debounce to control number of re-renders to parent, when user is editing/typing:
    if (onCodeEdit) debounce(() => onCodeEdit(code), 200)();
  };

  // Runs the code evaluator/processor over the inputs, returning the results as a Promise.
  // Errors are raised as a rejected Promise.
  const run = (
    inputs: LLMResponse[],
    script_paths?: string[],
    runInSandbox?: boolean,
  ) => {
    if (runInSandbox === undefined) runInSandbox = sandbox;

    // Double-check that the code includes an 'evaluate' or 'process' function, whichever is needed:
    const find_func_regex =
      node_type === "evaluator"
        ? progLang === "python"
          ? /def\s+evaluate\s*(.*):/
          : /function\s+evaluate\s*(.*)/
        : progLang === "python"
          ? /def\s+process\s*(.*):/
          : /function\s+process\s*(.*)/;
    if (codeText.search(find_func_regex) === -1) {
      const req_func_name = node_type === "evaluator" ? "evaluate" : "process";
      const err_msg = `Could not find required function '${req_func_name}'. Make sure you have defined an '${req_func_name}' function.`;
      return Promise.reject(new Error(err_msg)); // hard fail
    }

    const codeTextOnRun = codeText + "";
    const execute_route = progLang === "python" ? executepy : executejs;
    let executor: PythonInterpreter | undefined =
      progLang === "python" ? "pyodide" : undefined;

    // Enable running Python in Flask backend (unsafe) if running locally and the user has turned off the sandbox:
    if (progLang === "python" && IS_RUNNING_LOCALLY && !runInSandbox)
      executor = "flask";

    return execute_route(
      id,
      codeTextOnRun,
      inputs,
      "response",
      node_type,
      script_paths,
      executor,
    ).then(function (json) {
      json = json as EvaluatedResponsesResults;
      // Check if there's an error; if so, bubble it up to user and exit:
      if (json.error) {
        if (json.logs) json.logs.push(json.error);
      } else {
        setCodeTextOnLastRun(codeTextOnRun);
      }

      return {
        code, // string
        responses: json?.responses, // array of ResponseInfo Objects
        error: json?.error, // undefined or, if present, a string of the error message
        logs: json?.logs, // an array of strings representing console.logs/prints made during execution
      };
    });
  };

  // Export the current internal state as JSON
  const serialize = () => ({ code: codeText });

  // Define functions accessible from the parent component
  useImperativeHandle(ref, () => ({
    run,
    serialize,
    setCodeText,
  }));

  // Helpful instruction for user
  const code_instruct_header = useMemo(() => {
    if (node_type === "evaluator")
      return (
        <div className="code-mirror-field-header">
          Define an <Code>evaluate</Code> func to map over each response:
        </div>
      );
    else
      return (
        <div className="code-mirror-field-header">
          Define a <Code>process</Code> func to map over each response:
        </div>
      );
  }, [node_type]);

  return (
    <div className="core-mirror-field">
      {showUserInstruction ? code_instruct_header : <></>}
      <div className="ace-editor-container nodrag">
        <AceEditor
          mode={progLang}
          theme="xcode"
          onChange={handleCodeEdit}
          value={codeText}
          name={"aceeditor_" + id}
          editorProps={{ $blockScrolling: true }}
          width="100%"
          height="100px"
          style={{ minWidth: "310px" }}
          setOptions={{ useWorker: false }}
          tabSize={2}
          onLoad={(editorInstance) => {
            // Make Ace Editor div resizeable.
            editorInstance.container.style.resize = "both";
            document.addEventListener("mouseup", () => editorInstance.resize());
          }}
        />
      </div>
    </div>
  );
});

export interface CodeEvaluatorNodeProps {
  data: {
    title: string;
    code: string;
    language: "python" | "javascript";
    sandbox: boolean;
    refresh: boolean;
  };
  id: string;
  type: "evaluator" | "processor";
}

/**
 *  The Code Evaluator node supports users in writing JavaScript and Python functions that map across LLM responses.
 *  It has two possible node_types: 'evaluator' and 'processor' mode.
 *  Evaluators annotate responses with scores; processors transform response objects themselves.
 */
const CodeEvaluatorNode: React.FC<CodeEvaluatorNodeProps> = ({
  data,
  id,
  type: node_type,
}) => {
  // The inner component storing the code UI and providing an interface to run the code over inputs
  const codeEvaluatorRef = useRef<CodeEvaluatorComponentRef>(null);
  const currentCode = useMemo(() => data.code, [data.code]);

  // Whether to sandbox the code execution. Currently this option only displays for Python running locally,
  // where the user is given two options ---running unsandboxed (in Flask) and running sandboxed with Pyodide (in browser).
  // When ChainForge is running nonlocally (i.e. the website) Python code is always run sandboxed.
  const [runInSandbox, setRunInSandbox] = useState(data.sandbox ?? true);

  const pullInputData = useStore((state) => state.pullInputData);
  const pingOutputNodes = useStore((state) => state.pingOutputNodes);
  const setDataPropsForNode = useStore((state) => state.setDataPropsForNode);
  const bringNodeToFront = useStore((state) => state.bringNodeToFront);
  const [status, setStatus] = useState<Status>(Status.NONE);
  const nodes = useStore((state) => state.nodes);

  // For genAI features
  const flags = useStore((state) => state.flags);
  const [isEvalCodeGenerating, setIsEvalCodeGenerating] = useState(false);
  const [lastContext, setLastContext] = useState<VarsContext>({
    vars: [],
    metavars: [],
  });

  // For displaying error messages to user
  const showAlert = useContext(AlertModalContext);

  // For an info pop-up that explains the type of ResponseInfo
  const [infoModalOpened, { open: openInfoModal, close: closeInfoModal }] =
    useDisclosure(false);

  // For a way to inspect responses without having to attach a dedicated node
  const inspectModal = useRef<LLMResponseInspectorModalRef>(null);
  // eslint-disable-next-line
  const [uninspectedResponses, setUninspectedResponses] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);

  // The programming language for the editor. Also determines what 'execute'
  // function will ultimately be called.
  // eslint-disable-next-line
  const [progLang, setProgLang] = useState(data.language ?? "python");

  const [lastRunLogs, setLastRunLogs] = useState("");
  const [lastResponses, setLastResponses] = useState<LLMResponse[]>([]);
  const [lastRunSuccess, setLastRunSuccess] = useState(true);

  const handleError = useCallback(
    (err: string | Error) => {
      setStatus(Status.ERROR);
      setLastRunSuccess(false);
      if (typeof err !== "string") console.error(err);
      if (showAlert) showAlert(typeof err === "string" ? err : err?.message);
    },
    [showAlert],
  );

  const pullInputs = useCallback(() => {
    // Pull input data
    const pulled_inputs: Dict | LLMResponse[] = pullInputData(
      ["responseBatch"],
      id,
    );
    if (!pulled_inputs || !pulled_inputs.responseBatch) {
      console.warn(`No inputs for code ${node_type} node.`);
      return null;
    }
    // Convert to standard response format (StandardLLMResponseFormat)
    return pulled_inputs.responseBatch.map(
      toStandardResponseFormat,
    ) as LLMResponse[];
  }, [id, pullInputData]);

  // On initialization
  useEffect(() => {
    if (!IS_RUNNING_LOCALLY && progLang === "python") {
      // The user has loaded a Python evaluator node
      // without access to the Flask backend on localhost.
      // Warn them the evaluator won't function:
      console.warn(
        `This flow contains a Python evaluator node, yet ChainForge does not appear to be running locally on your machine. 
The Python interpeter in the browser is Pyodide. You may not be able to run some Python code in this evaluator (e.g., if it imports external packages).`,
      );
    }

    // Attempt to grab cache'd responses
    grabResponses([id])
      .then(function (resps) {
        // Store responses and set status to green checkmark
        setLastResponses(stripLLMDetailsFromResponses(resps));
        setStatus(Status.READY);
      })
      .catch(() => {
        // soft fail
      });
  }, []);

  // On upstream changes
  useEffect(() => {
    if (data.refresh && data.refresh === true) {
      setDataPropsForNode(id, { refresh: false });
      setStatus(Status.WARNING);
      const pulled_inputs = pullInputs();
      if (pulled_inputs) setLastContext(getVarsAndMetavars(pulled_inputs));
    }
  }, [data]);

  // Callbacks for inner code eval component
  const handleCodeEdit = (code: string) => {
    setDataPropsForNode(id, { code });
  };
  const handleCodeChangedFromLastRun = useCallback(() => {
    if (status === Status.WARNING) setStatus(Status.READY);
  }, [status, setStatus]);
  const handleCodeEqualToLastRun = useCallback(() => {
    if (status !== Status.WARNING) setStatus(Status.WARNING);
  }, [status, setStatus]);

  const handleRunClick = () => {
    // Pull input data
    const pulled_inputs = pullInputs();
    if (!pulled_inputs) return;

    setStatus(Status.LOADING);
    setLastRunLogs("");
    setLastResponses([]);

    // Get all the Python script nodes, and get all the folder paths
    // NOTE: Python only!
    let script_paths: string[] = [];
    if (progLang === "python") {
      const script_nodes = nodes.filter((n) => n.type === "script");
      script_paths = script_nodes
        .map((n) =>
          Object.values(n.data.scriptFiles as Dict<string>).filter(
            (f: string) => f !== "",
          ),
        )
        .flat();
    }

    // Run evaluator in backend
    codeEvaluatorRef.current
      ?.run(pulled_inputs, script_paths, runInSandbox)
      .then((json) => {
        if (json?.logs) setLastRunLogs(json.logs.join("\n   > "));

        // Check if there's an error; if so, bubble it up to user and exit:
        if (!json || json.error || json.responses === undefined)
          throw new Error(
            typeof json.error === "string"
              ? json.error
              : "Unknown error when running code evaluator.",
          );

        console.log(json.responses);

        // Ping any vis + inspect nodes attached to this node to refresh their contents:
        pingOutputNodes(id);
        setLastResponses(stripLLMDetailsFromResponses(json.responses));
        setLastContext(getVarsAndMetavars(json.responses));
        setLastRunSuccess(true);

        if (status !== Status.READY && !showDrawer)
          setUninspectedResponses(true);

        setDataPropsForNode(id, {
          fields: json.responses
            .map((resp_obj) =>
              resp_obj.responses.map((r) => {
                // Carry over the response text, prompt, prompt fill history (vars), and llm data
                const o: TemplateVarInfo = {
                  text: typeof r === "string" ? escapeBraces(r) : undefined,
                  image:
                    typeof r === "object" && r.t === "img" ? r.d : undefined,
                  prompt: resp_obj.prompt,
                  fill_history: resp_obj.vars,
                  metavars: resp_obj.metavars || {},
                  llm: resp_obj.llm,
                  uid: resp_obj.uid,
                };

                // Carry over any chat history
                if (resp_obj.chat_history)
                  o.chat_history = resp_obj.chat_history;

                return o;
              }),
            )
            .flat(),
        });

        if (status !== Status.READY && !showDrawer)
          setUninspectedResponses(true);

        setStatus(Status.READY);
      })
      .catch(handleError);
  };

  const hideStatusIndicator = () => {
    if (status !== Status.NONE) {
      setStatus(Status.NONE);
    }
  };

  const showResponseInspector = useCallback(() => {
    if (inspectModal && inspectModal.current && lastResponses) {
      setUninspectedResponses(false);
      inspectModal.current.trigger();
    }
  }, [inspectModal, lastResponses]);

  /* Memoized variables for displaying the UI that depend on the node type (evaluator or processor) and the programming language. */
  const default_header = useMemo(() => {
    const capitalized_type =
      node_type.charAt(0).toUpperCase() + node_type.slice(1);
    if (progLang === "python") return `Python ${capitalized_type}`;
    else return `JavaScript ${capitalized_type}`;
  }, [progLang, node_type]);
  const node_header = data.title || default_header;
  const run_tooltip = useMemo(
    () => `Run ${node_type} over inputs`,
    [node_type],
  );
  const code_info_modal = useMemo(() => {
    if (node_type === "evaluator")
      return (
        <Box m="lg" mt="xl">
          <Text mb="sm">
            To use a {default_header}, write a function <Code>evaluate</Code>{" "}
            that takes a single argument of class <Code>ResponseInfo</Code>. The
            function should return a &apos;score&apos; for that response, which
            usually is a number or a boolean value (strings as categoricals are
            supported, but experimental).
          </Text>
          <Text mt="sm" mb="sm">
            For instance, here is an evaluator that returns the length of a
            response:
          </Text>
          <Prism language={progLang}>
            {progLang === "python" ? INFO_EXAMPLE_PY : INFO_EXAMPLE_JS}
          </Prism>
          <Text mt="md" mb="sm">
            This function gets the text of the response via{" "}
            <Code>response.text</Code>, then calculates its length in
            characters. The full <Code>ResponseInfo</Code> class has the
            following properties and methods:
          </Text>
          <Prism language={progLang}>
            {progLang === "python"
              ? IS_RUNNING_LOCALLY
                ? INFO_CODEBLOCK_PY_FULL
                : INFO_CODEBLOCK_PY
              : INFO_CODEBLOCK_JS_FULL}
          </Prism>
          <Text mt="md" mb="sm">
            For instance, say you have a prompt template{" "}
            <Code>What is the capital of &#123;country&#125;?</Code> on a Prompt
            Node. You want to get the input variable &apos;country&apos;, which
            filled the prompt that led to the current response. You can use
            <Code>response.var</Code>:
          </Text>
          <Prism language={progLang}>
            {progLang === "python" ? INFO_EXAMPLE_VAR_PY : INFO_EXAMPLE_VAR_JS}
          </Prism>
          <Text mt="md">
            Note that you are allowed to define variables outside of the
            function, or define more functions, as long as a function called{" "}
            <Code>evaluate</Code> is defined. For more information on
            what&apos;s possible, see the{" "}
            <a
              href="https://chainforge.ai/docs/"
              target="_blank"
              rel="noreferrer"
            >
              documentation
            </a>{" "}
            or load some Example Flows.
          </Text>
        </Box>
      );
    else
      return (
        <Box m="lg" mt="xl">
          <Text mb="sm">
            To use a {default_header}, write a function <Code>process</Code>{" "}
            that takes a single argument of class <Code>ResponseInfo</Code>. The
            function should returned the{" "}
            <strong>transformed response text</strong>, as a string or number.
          </Text>
          <Text mt="sm" mb="sm">
            For instance, here is a processor that simply returns the first 12
            characters of the response:
          </Text>
          <Prism language={progLang}>
            {progLang === "python"
              ? INFO_PROC_EXAMPLE_PY
              : INFO_PROC_EXAMPLE_JS}
          </Prism>
          <Text mt="md" mb="sm">
            This function gets the text of the response via{" "}
            <Code>response.text</Code>, then slices it until the 12th-indexed
            character. The full <Code>ResponseInfo</Code> class has the
            following properties and methods:
          </Text>
          <Prism language={progLang}>
            {progLang === "python"
              ? IS_RUNNING_LOCALLY
                ? INFO_CODEBLOCK_PY_FULL
                : INFO_CODEBLOCK_PY
              : INFO_CODEBLOCK_JS_FULL}
          </Prism>
          <Text mt="md" mb="sm">
            For another example, say you have a prompt that requests the LLM
            output in a consistent format, with &quot;ANSWER:&quot; at the end
            like Chain-of-Thought. You want to get just the part after
            &apos;ANSWER:&apos; Here&apos;s how you can do this:
          </Text>
          <Prism language={progLang}>
            {progLang === "python"
              ? INFO_PROC_EXAMPLE_VAR_PY
              : INFO_PROC_EXAMPLE_VAR_JS}
          </Prism>
          <Text mt="md">
            Note that you are allowed to define variables outside of the
            function, or define more functions, as long as a function called{" "}
            <Code>process</Code> is defined. For more information on what&apos;s
            possible, see the{" "}
            <a
              href="https://chainforge.ai/docs/"
              target="_blank"
              rel="noreferrer"
            >
              documentation
            </a>
            . Finally, note that currently you cannot change the response
            metadata itself (i.e., var, meta dictionaries); if you have a use
            case for that feature, raise an Issue on our GitHub.
          </Text>
        </Box>
      );
  }, [progLang, node_type]);

  // Custom buttons for the node label
  const customButtons = useMemo(() => {
    const btns: React.ReactNode[] = [];

    // If this is Python and we are running locally, the user has
    // two options ---whether to run code in sandbox with pyodide, or from Flask (unsafe):
    if (progLang === "python" && IS_RUNNING_LOCALLY)
      btns.push(
        <Tooltip
          label={
            runInSandbox
              ? "Running in sandbox (pyodide)"
              : "Running unsandboxed (Python)"
          }
          key="sandbox"
          withArrow
        >
          <button
            onClick={() => {
              setDataPropsForNode(id, { sandbox: !runInSandbox });
              setRunInSandbox(!runInSandbox);
            }}
            className="custom-button"
            style={{ border: "none", padding: "0px" }}
          >
            <IconBox
              size="12pt"
              color={runInSandbox ? "orange" : "#999"}
              style={{ marginBottom: "-4px" }}
            />
          </button>
        </Tooltip>,
      );

    btns.push(
      <Tooltip label="Info" key="eval-info">
        <button
          onClick={openInfoModal}
          className="custom-button"
          style={{ border: "none" }}
        >
          <IconInfoCircle
            size="12pt"
            color="gray"
            style={{ marginBottom: "-4px" }}
          />
        </button>
      </Tooltip>,
    );

    // If AI support is available, add gen code with AI button:
    if (flags.aiSupport && node_type === "evaluator")
      btns.push(
        <AIGenCodeEvaluatorPopover
          key="ai-popover"
          progLang={progLang}
          context={lastContext}
          onGeneratedCode={(code) => {
            codeEvaluatorRef?.current?.setCodeText(code);
            handleCodeEdit(code);
          }}
          onLoadingChange={(isLoading) => setIsEvalCodeGenerating(isLoading)}
          currentEvalCode={currentCode}
        />,
      );

    return btns;
  }, [
    openInfoModal,
    flags,
    codeEvaluatorRef,
    progLang,
    runInSandbox,
    node_type,
    currentCode,
    lastContext,
  ]);

  return (
    <BaseNode classNames="evaluator-node" nodeId={id}>
      <NodeLabel
        title={node_header}
        nodeId={id}
        onEdit={hideStatusIndicator}
        icon={<IconTerminal size="16px" />}
        status={status}
        handleRunClick={handleRunClick}
        runButtonTooltip={run_tooltip}
        customButtons={customButtons}
      />
      <LLMResponseInspectorModal
        ref={inspectModal}
        jsonResponses={lastResponses}
      />
      <Modal
        title={default_header}
        size="60%"
        opened={infoModalOpened}
        onClose={closeInfoModal}
        styles={{
          header: { backgroundColor: "#FFD700" },
          root: { position: "relative", left: "-5%" },
        }}
      >
        {code_info_modal}
      </Modal>
      <iframe style={{ display: "none" }} id={`${id}-iframe`}></iframe>
      <Handle
        type="target"
        position={Position.Left}
        id="responseBatch"
        className="grouped-handle"
        style={{ top: "50%" }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        className="grouped-handle"
        style={{ top: "50%" }}
      />

      <Skeleton visible={isEvalCodeGenerating}>
        <CodeEvaluatorComponent
          ref={codeEvaluatorRef}
          code={data.code}
          id={id}
          type={node_type}
          progLang={progLang}
          showUserInstruction
          onCodeEdit={handleCodeEdit}
          onCodeChangedFromLastRun={handleCodeChangedFromLastRun}
          onCodeEqualToLastRun={handleCodeEqualToLastRun}
        />
      </Skeleton>

      {lastRunLogs && lastRunLogs.length > 0 ? (
        <div
          className="eval-output-footer nowheel"
          style={{ backgroundColor: lastRunSuccess ? "#eee" : "#f19e9eb1" }}
        >
          <p style={{ color: lastRunSuccess ? "#999" : "#a10f0f" }}>
            <strong>out:</strong> {lastRunLogs}
          </p>
        </div>
      ) : (
        <></>
      )}

      {lastRunSuccess && lastResponses && lastResponses.length > 0 ? (
        <InspectFooter
          label={
            <>
              Inspect results&nbsp;
              <IconSearch size="12pt" />
            </>
          }
          onClick={showResponseInspector}
          isDrawerOpen={showDrawer}
          showDrawerButton={true}
          onDrawerClick={() => {
            setShowDrawer(!showDrawer);
            setUninspectedResponses(false);
            bringNodeToFront(id);
          }}
        />
      ) : (
        <></>
      )}

      <LLMResponseInspectorDrawer
        jsonResponses={lastResponses}
        showDrawer={showDrawer}
      />
    </BaseNode>
  );
};

export default CodeEvaluatorNode;
