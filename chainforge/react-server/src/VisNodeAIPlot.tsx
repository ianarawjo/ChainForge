/**
 * AI-suggested plots in the Vis Node: the sparkle popover that suggests and
 * makes plots, and the view that shows one, with its code.
 */
import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ActionIcon,
  Button,
  Flex,
  Loader,
  Modal,
  Stack,
  Text,
  TextInput,
  Tooltip,
  UnstyledButton,
  useMantineColorScheme,
} from "@mantine/core";
import { IconArrowRight, IconCode } from "@tabler/icons-react";
import Plot from "react-plotly.js";
import AceEditor from "react-ace";
import "ace-builds/src-noconflict/mode-javascript";
import "ace-builds/src-noconflict/theme-xcode";
import "ace-builds/src-noconflict/theme-monokai";
import { AIPopover } from "./AiPopover";
import { AlertModalContext } from "./AlertModal";
import useAIFeatures from "./useAIFeatures";
import useStore from "./store";
import ResizeHandle from "./ResizeHandle";
import {
  AIPlot,
  buildPlotRows,
  PlotContext,
  PlotRow,
  suggestPlots,
  writePlotCode,
} from "./backend/aiPlots";
import { PlotFigure, runPlotCode } from "./backend/plotSandbox";
import { Dict, LLMResponse } from "./backend/typing";

const errorMessage = (err: unknown) =>
  err instanceof Error ? err.message : String(err);

/** The context plot code gets: LLM colors as ChainForge shows them, and the theme. */
function usePlotContext() {
  const { colorScheme } = useMantineColorScheme();
  const getColorForLLM = useStore(
    (state) => state.getColorForLLMAndSetIfNotFound,
  );
  return useCallback(
    (rows: PlotRow[]): PlotContext => ({
      llmColors: Object.fromEntries(
        Array.from(new Set(rows.map((r) => r.llm))).map((llm) => [
          llm,
          getColorForLLM(llm),
        ]),
      ),
      theme: colorScheme === "dark" ? "dark" : "light",
    }),
    [colorScheme, getColorForLLM],
  );
}

export interface AIGenPlotPopoverProps {
  // The responses to plot
  responses: LLMResponse[];
  // Called with a plot the AI made, and the code for it
  onPlotReady: (plot: AIPlot) => void;
}

/**
 * AI Popover UI for Vis Nodes: suggests plots that suit the data, or makes one
 * the user describes.
 */
export function AIGenPlotPopover({
  responses,
  onPlotReady,
}: AIGenPlotPopoverProps) {
  const { smartModel, apiKeys } = useAIFeatures();
  const showAlert = useContext(AlertModalContext);
  const getContext = usePlotContext();

  const [suggestions, setSuggestions] = useState<AIPlot[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [description, setDescription] = useState("");
  // The plot being made, if any
  const [making, setMaking] = useState<AIPlot | undefined>(undefined);

  const handleError = (err: unknown) => {
    console.error(err);
    if (showAlert) showAlert(errorMessage(err));
  };

  const handleSuggest = () => {
    setIsSuggesting(true);
    suggestPlots(buildPlotRows(responses), smartModel, apiKeys)
      .then(setSuggestions)
      .catch(handleError)
      .finally(() => setIsSuggesting(false));
  };

  // Writes the plot's code and checks it runs, asking the model to fix it once if not
  const makePlot = async (plot: AIPlot, close: () => void) => {
    setMaking(plot);
    try {
      const rows = buildPlotRows(responses);
      const context = getContext(rows);
      let code = await writePlotCode(plot, rows, smartModel, apiKeys);
      try {
        await runPlotCode(code, rows, context);
      } catch (err) {
        code = await writePlotCode(plot, rows, smartModel, apiKeys, {
          code,
          error: errorMessage(err),
        });
        await runPlotCode(code, rows, context);
      }
      onPlotReady({ ...plot, code });
      close();
    } catch (err) {
      handleError(err);
    } finally {
      setMaking(undefined);
    }
  };

  return (
    <AIPopover model={smartModel}>
      {(close) =>
        responses.length === 0 ? (
          <Text size="xs" c="dimmed" mt="xs">
            Connect this node to responses to plot first.
          </Text>
        ) : (
          <Stack spacing={6} mt="xs">
            {suggestions.map((s) => (
              <UnstyledButton
                key={s.title}
                className="ai-plot-suggestion"
                disabled={making !== undefined}
                onClick={() => makePlot(s, close)}
              >
                <Flex gap={6} align="center">
                  <Text size="xs" fw={500}>
                    {s.title}
                  </Text>
                  {making === s && <Loader size="xs" color="grape" />}
                </Flex>
                <Text size="xs" c="dimmed" lineClamp={2}>
                  {s.description}
                </Text>
              </UnstyledButton>
            ))}
            <Button
              size="xs"
              variant="light"
              color="grape"
              fullWidth
              onClick={handleSuggest}
              loading={isSuggesting}
              disabled={making !== undefined}
            >
              {suggestions.length > 0 ? "Suggest Others" : "Suggest Plots"}
            </Button>
            <TextInput
              size="xs"
              placeholder="Or describe a plot"
              value={description}
              onChange={(e) => setDescription(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && description.trim() && !making)
                  makePlot(
                    { title: description.trim(), description: "" },
                    close,
                  );
              }}
              rightSection={
                making !== undefined && making.description === "" ? (
                  <Loader size="xs" color="grape" />
                ) : (
                  <ActionIcon
                    size="xs"
                    color="grape"
                    disabled={!description.trim() || making !== undefined}
                    onClick={() =>
                      makePlot(
                        { title: description.trim(), description: "" },
                        close,
                      )
                    }
                  >
                    <IconArrowRight size={12} />
                  </ActionIcon>
                )
              }
            />
          </Stack>
        )
      }
    </AIPopover>
  );
}

export interface AIPlotHeaderButtonsProps {
  plot: AIPlot;
  // Called when the user edits the plot's code
  onCodeChange: (code: string) => void;
  // Called to go back to the default plot
  onBack: () => void;
}

/** Buttons for a Vis Node's header while it shows an AI plot: its code, and back. */
export function AIPlotHeaderButtons({
  plot,
  onCodeChange,
  onBack,
}: AIPlotHeaderButtonsProps) {
  const { colorScheme } = useMantineColorScheme();
  const [codeOpened, setCodeOpened] = useState(false);
  const [draftCode, setDraftCode] = useState(plot.code ?? "");

  return (
    <>
      <Tooltip label="View and edit the plot's code" withinPortal>
        <button
          className="custom-button nodrag"
          onClick={() => {
            setDraftCode(plot.code ?? "");
            setCodeOpened(true);
          }}
        >
          <IconCode size={11} style={{ verticalAlign: "-1px" }} />
        </button>
      </Tooltip>
      <Tooltip label="Back to the default plot" withinPortal>
        <button className="custom-button nodrag" onClick={onBack}>
          Back
        </button>
      </Tooltip>
      <Modal
        opened={codeOpened}
        onClose={() => setCodeOpened(false)}
        title={`Code for "${plot.title}"`}
        size="xl"
      >
        <Text size="xs" c="dimmed" mb="xs">
          <code>plot(rows, context)</code> returns a Plotly figure. It runs in a
          sandbox, with no access to the network or the rest of ChainForge.
        </Text>
        <AceEditor
          mode="javascript"
          theme={colorScheme === "light" ? "xcode" : "monokai"}
          value={draftCode}
          onChange={setDraftCode}
          name="ai-plot-code"
          width="100%"
          height="400px"
          tabSize={2}
          setOptions={{ useWorker: false }}
        />
        <Flex justify="end" mt="sm" gap="xs">
          <Button variant="default" onClick={() => setCodeOpened(false)}>
            Cancel
          </Button>
          <Button
            color="grape"
            onClick={() => {
              onCodeChange(draftCode);
              setCodeOpened(false);
            }}
          >
            Save and Run
          </Button>
        </Flex>
      </Modal>
    </>
  );
}

export interface AIPlotViewProps {
  plot: AIPlot;
  responses: LLMResponse[];
}

/** Shows a plot the AI made, by running its code over the responses. */
export function AIPlotView({ plot, responses }: AIPlotViewProps) {
  const { colorScheme } = useMantineColorScheme();
  const getContext = usePlotContext();
  const [figure, setFigure] = useState<PlotFigure | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const plotDivRef = useRef<HTMLDivElement | null>(null);

  // Rerun the code whenever it or the data changes
  useEffect(() => {
    if (!plot.code) return;
    let cancelled = false;
    const rows = buildPlotRows(responses);
    runPlotCode(plot.code, rows, getContext(rows))
      .then((fig) => {
        if (cancelled) return;
        setFigure(fig);
        setError(undefined);
      })
      .catch((err) => {
        if (cancelled) return;
        setFigure(undefined);
        setError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [plot.code, responses, getContext]);

  const axisColor = colorScheme === "light" ? "#444" : "#ddd";
  const figLayout: Dict = figure?.layout ?? {};
  const layout: Dict = {
    autosize: true,
    dragmode: "pan",
    margin: { l: 60, r: 10, b: 50, t: figLayout.title ? 40 : 20, pad: 4 },
    ...figLayout,
    // ChainForge's background and text colors, whatever the code set
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: { ...figLayout.font, color: axisColor },
    xaxis: { ...figLayout.xaxis, color: axisColor },
    yaxis: { ...figLayout.yaxis, color: axisColor },
  };

  return (
    <div
      className="nodrag"
      ref={plotDivRef}
      style={{
        minWidth: "150px",
        minHeight: "100px",
        width: "450px",
        height: "300px",
        position: "relative",
      }}
    >
      {error ? (
        <Text size="xs" c="red" p="xs">
          The plot&apos;s code failed: {error}
        </Text>
      ) : figure ? (
        <Plot
          data={figure.data}
          layout={layout}
          useResizeHandler
          style={{ width: "100%", height: "100%" }}
        />
      ) : (
        <Flex justify="center" align="center" h="100%">
          <Loader size="sm" color="grape" />
        </Flex>
      )}
      <ResizeHandle targetRef={plotDivRef} minWidth={150} minHeight={100} />
    </div>
  );
}
