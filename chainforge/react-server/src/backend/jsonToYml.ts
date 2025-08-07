import * as yaml from "js-yaml";
import JSZip from "jszip";
import { saveAs } from "file-saver";

function cleanText(text: string): string {
  return '"' + text.replace(/\s*\n\s*/g, " ").trim() + '"';
}

export async function jsontoYml(
  json_data: string,
  title: string,
  max_retry = 0,
  threads = 1,
) {
  try {
    const non_used_nodes = new Set<string>();
    const json = JSON.parse(json_data);
    const nodes = json.nodes;
    const links = json.edges;
    const yml_nodes: any[] = [];
    const zip = new JSZip();
    for (const node of nodes) {
      if (node.type === "prompt") {
        const llms = [];
        for (const llm of node.data.llms) {
          const yml_llm: { [key: string]: any } = {
            key: llm.key,
            name: llm.name,
            model: llm.model,
            emoji: llm.emoji,
            base_model: llm.base_model,
            temp: llm.temp,
          };
          for (const key of Object.keys(llm.settings)) {
            if (key !== "response_format") {
              yml_llm[key] = llm.settings[key];
            }
          }
          llms.push(yml_llm);
        }
        const yml_node = {
          template: {
            name: node.id,
            value: node.data.prompt,
            iterations: node.data.n,
            llms,
          },
        };
        yml_nodes.push(yml_node);
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
        // Save the csv file
        zip.file(`${node.id}.csv`, csv);
        yml_nodes.push(yml_node);
      } else if (node.type === "evaluator") {
        if (node.data.language === "javascript") {
          const yml_node = {
            evaluator: {
              type: "javascript",
              name: node.id,
              return_type: "string",
              file: `../files/${node.id}.js`,
            },
          };
          // Create the javascript file
          const js_code = node.data.code;
          zip.file(`${node.id}.js`, js_code);
          yml_nodes.push(yml_node);
        } else if (node.type === "python") {
          const yml_node = {
            evaluator: {
              type: "python",
              name: node.id,
              return_type: "string",
              file: `../files/${node.id}.py`,
            },
          };
          // Create the python file
          const py_code = node.data.code;
          zip.file(`${node.id}.py`, py_code);
          yml_nodes.push(yml_node);
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
          zip.file(`${node.id}.js`, js_code);
          yml_nodes.push(yml_node);
        } else if (node.type === "python") {
          const yml_node = {
            processor: {
              type: "python",
              name: node.id,
              file: `../files/${node.id}.py`,
            },
          };
          // Create the python file
          const py_code = node.data.code;
          zip.file(`${node.id}.py`, py_code);
          yml_nodes.push(yml_node);
        }
      } else if (node.type === "table") {
        const yml_node = {
          dataset: {
            name: node.id,
            path: `../files/${node.id}.csv`,
          },
        };
        // Create the csv file with the table data
        const row = node.data.rows[0];
        let headers = Object.keys(row);
        // remove the key '__uid' from headers
        headers = headers.filter((header) => header !== "__uid");
        let csv = headers.join(",") + "\n";
        for (const row of node.data.rows) {
          const values = headers.map((header) => cleanText(row[header]));
          csv += values.join(",") + "\n";
        }
        // Save the csv file
        zip.file(`${node.id}.csv`, csv);
        yml_nodes.push(yml_node);
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
        // Save the csv file
        zip.file(`${node.id}.csv`, csv);
        yml_nodes.push(yml_node);
      }
      // else if(node.type === 'simpleval'){}
      // else if(node.type === 'join'){}
      // else if(node.type === 'split'){}
      else {
        non_used_nodes.add(node.id);
      }
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
    const yml_string = yaml.dump(yml_data);
    zip.file(`${title}.yml`, yml_string);
    const blob = await zip.generateAsync({ type: "blob" });
    saveAs(blob, `${title}.zip`);
  } catch (error) {
    console.error("Error parsing JSON data:", error);
  }
}
