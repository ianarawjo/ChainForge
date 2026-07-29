import * as yaml from "js-yaml";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { createJSEvalCodeFor } from "../SimpleEvalNode";
import {
  OUTPUT_FORMAT_PROMPTS,
  OUTPUT_FORMAT_PROMPTS_REASONING,
} from "../LLMEvalNode";

function cleanText(text: string): string {
  return '"' + text.replace(/\s*\n\s*/g, " ").trim() + '"';
}

function multievalChildToNodeFormat(child: any) {
  if (child.type === "llm") {
    return {
      id: child.uid,
      type: "llmeval",
      data: {
        prompt: child.state.prompt,
        reasonBeforeScoring: child.state.reasonBeforeScoring,
        format: child.state.format,
        grader: child.state.grader,
      },
    };
  } else {
    return {
      id: child.uid,
      type: "evaluator",
      data: {
        language: child.type,
        code: child.state.code,
      },
    };
  }
}

function getPromptTemplate(llmEvalData: any): string {
  // Accept either the LLMEvalNode component shape
  // ({ promptText, useReasoning, expectedFormat }) or the serialized
  // evaluator shape used elsewhere ({ prompt, reasonBeforeScoring, format })
  const promptText = llmEvalData?.prompt ?? "";
  const useReasoning = llmEvalData?.reasonBeforeScoring ?? false;
  const expectedFormat = llmEvalData?.format ?? "bin";

  const formatting_instr = useReasoning
    ? OUTPUT_FORMAT_PROMPTS_REASONING[
        expectedFormat as keyof typeof OUTPUT_FORMAT_PROMPTS_REASONING
      ] ?? ""
    : OUTPUT_FORMAT_PROMPTS[
        expectedFormat as keyof typeof OUTPUT_FORMAT_PROMPTS
      ] ?? "";

  return (
    "You are evaluating text that will be pasted below. " +
    promptText +
    " " +
    "\n```\n{response}\n```\n\n" +
    formatting_instr
  );
}

function buildPythonNode(node: any): any {
  const yml_node = {
    evaluator: {
      type: "python",
      name: node.id,
      return_type: "string",
      file: `../files/${node.id}.py`,
    },
  };
  return yml_node;
}

function buildJavascriptNode(node: any): any {
  const yml_node = {
    evaluator: {
      type: "javascript",
      name: node.id,
      return_type: "string",
      file: `../files/${node.id}.js`,
    },
  };
  return yml_node;
}

function buildLLMNode(node: any): any | undefined {
  if (!node) return undefined;
  const yml_llm: { [key: string]: any } = {
    key: node.key,
    name: node.name,
    model: node.model,
    emoji: node.emoji,
    base_model: node.base_model,
    temp: node.temp,
  };
  const settings = node.settings ?? {};
  for (const key of Object.keys(settings)) {
    if (key === "response_format") continue;
    const val = settings[key];
    // Skip explicit empty arrays for tools/stop
    if (
      (key === "tools" || key === "stop") &&
      Array.isArray(val) &&
      val.length === 0
    )
      continue;
    // Skip undefined/null values but preserve falsy values like false, 0, ""
    if (val === undefined || val === null) continue;
    yml_llm[key] = val;
  }
  return yml_llm;
}

type BuildYmlNodeResult = {
  ymlNode?: any;
  files: Array<{ name: string; content: string }>;
  skipped: boolean;
  error: boolean;
  error_message?: string;
};

type BuildYmlNodeContext = {
  nodeById: Map<string, any>;
  incomingSourceIdsByTarget: Map<string, string[]>;
};

function isDataNodeType(type: string): boolean {
  return type === "textfields" || type === "table";
}

function shouldExportJoinNode(
  node: any,
  context: BuildYmlNodeContext,
): boolean {
  const incomingSourceIds =
    context.incomingSourceIdsByTarget.get(node.id) ?? [];
  if (incomingSourceIds.length === 0) return true;

  return incomingSourceIds.every((sourceId) => {
    const sourceNode = context.nodeById.get(sourceId);
    return sourceNode && isDataNodeType(sourceNode.type);
  });
}

function buildYmlNode(
  node: any,
  context?: BuildYmlNodeContext,
): BuildYmlNodeResult {
  const files: Array<{ name: string; content: string }> = [];

  if (node.type === "prompt") {
    const llms = [];
    for (const llm of node.data.llms) {
      const yml_llm = buildLLMNode(llm);
      llms.push(yml_llm);
    }
    let iterations: number;
    if (isNaN(Number(node.data.n))) {
      iterations = 1;
    } else {
      iterations = Number(node.data.n);
    }
    const yml_node = {
      template: {
        name: node.id,
        value: node.data.prompt,
        iterations,
        llms,
      },
    };
    return { ymlNode: yml_node, files, skipped: false, error: false };
  }
  // We need to create a csv file for each dataset node
  else if (node.type === "textfields") {
    const yml_node = {
      dataset: {
        name: node.id,
        path: `../files/${node.id}.csv`,
      },
    };
    // Create the csv file with the text fields
    let csv = "output\n";
    for (const key of Object.keys(node.data.fields)) {
      const value = cleanText(node.data.fields[key]);
      csv += `${value}\n`;
    }
    files.push({ name: `${node.id}.csv`, content: csv });
    return { ymlNode: yml_node, files, skipped: false, error: false };
  } else if (node.type === "evaluator") {
    if (node.data.language === "javascript") {
      const yml_node = buildJavascriptNode(node);
      // Create the javascript file
      const js_code = node.data.code;
      files.push({ name: `${node.id}.js`, content: js_code });
      return { ymlNode: yml_node, files, skipped: false, error: false };
    } else if (node.data.language === "python") {
      const yml_node = buildPythonNode(node);
      // Create the python file
      const py_code = node.data.code;
      files.push({ name: `${node.id}.py`, content: py_code });
      return { ymlNode: yml_node, files, skipped: false, error: false };
    }
  } else if (node.type === "processor") {
    if (node.data.language === "javascript") {
      const yml_node = {
        processor: {
          type: "javascript",
          name: node.id,
          file: `../files/${node.id}.js`,
        },
      };
      // Create the javascript file
      const js_code = node.data.code;
      files.push({ name: `${node.id}.js`, content: js_code });
      return { ymlNode: yml_node, files, skipped: false, error: false };
    } else if (node.data.language === "python") {
      const yml_node = {
        processor: {
          type: "python",
          name: node.id,
          file: `../files/${node.id}.py`,
        },
      };
      // Create the python file
      const py_code = node.data.code;
      files.push({ name: `${node.id}.py`, content: py_code });
      return { ymlNode: yml_node, files, skipped: false, error: false };
    }
  } else if (node.type === "table") {
    const yml_node = {
      dataset: {
        name: node.id,
        path: `../files/${node.id}.csv`,
      },
    };
    // Create the csv file with the table data
    const columns = node.data.columns;

    const csvHeaders = columns.map((col: { header: string }) =>
      cleanText(col.header),
    );
    const csvKeys = columns.map((col: { key: any }) => col.key);

    let csv = csvHeaders.join(",") + "\n";

    for (const row of node.data.rows) {
      const values = csvKeys.map((key: string | number) =>
        cleanText(row[key] ?? ""),
      );
      csv += values.join(",") + "\n";
    }

    files.push({ name: `${node.id}.csv`, content: csv });
    return { ymlNode: yml_node, files, skipped: false, error: false };
  } else if (node.type === "csv") {
    const yml_node = {
      dataset: {
        name: node.id,
        path: `../files/${node.id}.csv`,
      },
    };
    // Create the csv file with the csv data
    const csv_data: string[] = node.data.fields;
    let csv = "output\n";
    for (const value of csv_data) {
      csv += `${cleanText(value)}\n`;
    }
    files.push({ name: `${node.id}.csv`, content: csv });
    return { ymlNode: yml_node, files, skipped: false, error: false };
  } else if (node.type === "simpleval") {
    const yml_node = {
      evaluator: {
        type: "simple",
        name: node.id,
        return_type: "string",
        text_value: node.data.textValue ?? "",
        var_value: node.data.varValue ?? "",
        var_type: node.data.varValueType ?? "var",
        var_selected: node.data.varSelected ?? false,
        file: `../files/${node.id}.js`,
      },
    };
    const js_code = createJSEvalCodeFor(
      node.data.responseFormat ?? "response",
      node.data.operation ?? "contains",
      node.data.varSelected ? node.data.varValue : node.data.textValue,
      node.data.varValueType ?? "var",
    );
    files.push({ name: `${node.id}.js`, content: js_code });
    return { ymlNode: yml_node, files, skipped: false, error: false };
  } else if (node.type === "join") {
    if (!context || !shouldExportJoinNode(node, context)) {
      return {
        files,
        skipped: true,
        error: true,
        error_message: `Cannot export join node because it does not have any data node inputs/it is preceded by a non-data node.`,
      };
    }
    const yml_node = {
      processor: {
        type: "join",
        name: node.id,
        format: (node.data.formatting ?? "\n\n").replace(/\n/g, "\\n"),
        selected_group_vars: node.data.selectedGroupVars ?? [],
      },
    };
    return { ymlNode: yml_node, files, skipped: false, error: false };
  } else if (node.type === "split") {
    const yml_node = {
      processor: {
        type: "split",
        name: node.id,
        format: (node.data.splitFormat ?? "list").replace(/\n/g, "\\n"),
      },
    };
    return { ymlNode: yml_node, files, skipped: false, error: false };
  } else if (node.type === "multieval") {
    // Build a single multieval evaluator with nested evaluators inside
    const yml_node: any = {
      evaluator: {
        type: "multieval",
        name: node.id,
        return_type: "string",
        evaluators: [],
      },
    };
    for (const childEval of node.data.evaluators) {
      const evalNode = buildYmlNode(
        multievalChildToNodeFormat(childEval),
        context,
      );
      if (evalNode.ymlNode) {
        yml_node.evaluator.evaluators.push(evalNode.ymlNode);
        files.push(...evalNode.files);
      }
    }
    return { ymlNode: yml_node, files, skipped: false, error: false };
  } else if (node.type === "llmeval") {
    const graderSpec = node.data.grader;
    const graderObj = buildLLMNode(graderSpec);
    const template = getPromptTemplate(node.data);

    const yml_node: any = {
      evaluator: {
        type: "llm",
        name: node.id,
        return_type: "string",
        prompt: template,
        format: node.data.format ?? "bin",
        reason_before_scoring: node.data.reasonBeforeScoring ?? false,
      },
    };
    if (graderObj) yml_node.evaluator.grader = graderObj;
    return { ymlNode: yml_node, files, skipped: false, error: false };
  } else if (node.type === "chat") {
    return {
      files,
      skipped: true,
      error: true,
      error_message: `Chat nodes are not supported in the YAML export.`,
    };
  }

  return {
    files,
    skipped: true,
    error: false,
  };
}

export async function jsontoYml(
  json_data: string,
  title: string,
  max_retry = 0,
  threads = 1,
  onError: (err: Error | string) => void,
) {
  try {
    const non_used_nodes = new Set<string>();
    const json = JSON.parse(json_data);
    const nodes = json.nodes;
    const links = json.edges;
    const nodeById = new Map<string, any>();
    const incomingSourceIdsByTarget = new Map<string, string[]>();
    for (const node of nodes) {
      nodeById.set(node.id, node);
    }
    for (const link of links) {
      const incomingSourceIds =
        incomingSourceIdsByTarget.get(link.target) ?? [];
      incomingSourceIds.push(link.source);
      incomingSourceIdsByTarget.set(link.target, incomingSourceIds);
    }
    const context: BuildYmlNodeContext = {
      nodeById,
      incomingSourceIdsByTarget,
    };
    const yml_nodes: any[] = [];
    const zip = new JSZip();
    for (const node of nodes) {
      const result = buildYmlNode(node, context);
      if (result.error) {
        onError(`Error exporting node: ${result.error_message ?? ""}`);
        return;
      }
      for (const file of result.files) {
        zip.file(file.name, file.content);
      }
      if (result.skipped || !result.ymlNode) {
        non_used_nodes.add(node.id);
        continue;
      }
      yml_nodes.push(result.ymlNode);
    }
    const yml_links: any[] = [];
    for (const link of links) {
      // If the source or target node is not used, skip the link
      if (non_used_nodes.has(link.source) || non_used_nodes.has(link.target)) {
        continue;
      }
      const yml_link = {
        source: link.source,
        target: link.target,
        source_var: link.sourceHandle,
        target_var: link.targetHandle,
      };
      yml_links.push(yml_link);
    }
    // Create the YAML file
    const yml_data = {
      experiment: {
        title,
        max_retry,
        threads,
      },
      nodes: yml_nodes,
      links: yml_links,
    };
    const yml_string = yaml.dump(yml_data, { lineWidth: -1 });
    zip.file(`${title}.yml`, yml_string);
    const blob = await zip.generateAsync({ type: "blob" });
    saveAs(blob, `${title}.zip`);
  } catch (error) {
    if (onError) onError(error as Error);
    else console.error("Error parsing JSON data:", error);
  }
}
