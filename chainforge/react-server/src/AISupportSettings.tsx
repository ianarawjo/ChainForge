import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
  Select,
  Stack,
  Switch,
  Text,
} from "@mantine/core";
import { IconAlertCircle, IconSparkles } from "@tabler/icons-react";
import useStore from "./store";
import {
  AIModelOverrides,
  AIProvider,
  AITier,
  aiModelName,
  aiModelSuggestions,
  aiSetupProblem,
  autoPickAIProvider,
  getAIProvider,
  getAIProviders,
} from "./backend/aiModels";
import { APP_IS_RUNNING_LOCALLY } from "./backend/utils";
import { JSONCompatible } from "./backend/typing";

const IS_RUNNING_LOCALLY = APP_IS_RUNNING_LOCALLY();

const TIER_INFO: Record<AITier, { label: string; description: string }> = {
  fast: {
    label: "Fast model",
    description: "Generates input data, like items and table rows.",
  },
  smart: {
    label: "Smart model",
    description: "Writes evaluation code, and powers EvalGen.",
  },
};

/** A model name field, saved when the user leaves it or picks a suggestion. */
function ModelField({
  tier,
  provider,
  value,
  ollamaModels,
  onCommit,
}: {
  tier: AITier;
  provider: AIProvider;
  value: string;
  ollamaModels: string[];
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value, provider.name]);

  const recommended = aiModelName(provider, tier, undefined, ollamaModels);
  const suggestions = useMemo(
    () => aiModelSuggestions(provider, ollamaModels),
    [provider, ollamaModels],
  );

  return (
    <Autocomplete
      label={TIER_INFO[tier].label}
      description={`${TIER_INFO[tier].description} Leave blank for the recommended model.`}
      placeholder={recommended ? `${recommended} (recommended)` : ""}
      data={suggestions}
      limit={50}
      maxDropdownHeight={220}
      withinPortal
      value={draft}
      onChange={setDraft}
      onItemSubmit={(item) => onCommit(item.value)}
      onBlur={() => {
        if (draft.trim() !== value) onCommit(draft.trim());
      }}
    />
  );
}

export interface AISupportSettingsProps {
  enabled: boolean;
  /** The provider the user picked, or blank to pick one from their API keys. */
  provider: string;
  models: AIModelOverrides;
  onChange: (key: string, value: JSONCompatible) => void;
}

/** The AI Support tab of the settings. */
export default function AISupportSettings({
  enabled,
  provider: providerName,
  models,
  onChange,
}: AISupportSettingsProps) {
  const apiKeys = useStore((state) => state.apiKeys);
  const ollamaModels = useStore((state) => state.ollamaModels);

  const providers = getAIProviders(IS_RUNNING_LOCALLY);
  const chosen = getAIProvider(providerName, IS_RUNNING_LOCALLY);
  const provider =
    chosen ?? autoPickAIProvider(apiKeys, ollamaModels, IS_RUNNING_LOCALLY);
  const setupProblem = aiSetupProblem(provider, apiKeys, ollamaModels, models);

  const setModel = (tier: AITier, value: string) => {
    const forProvider = { ...models?.[provider.name], [tier]: value };
    if (!value) delete forProvider[tier];
    onChange("aiModels", {
      ...models,
      [provider.name]: forProvider,
    } as JSONCompatible);
  };

  return (
    <Stack spacing="sm">
      <Text fz="sm" lh={1.3}>
        AI support features add purple sparkle buttons{" "}
        <IconSparkles size="10pt" /> to some nodes, which generate input data
        and evaluation code, and power EvalGen. They query the provider you pick
        below, with your API key for it, and so may cost you credits.
      </Text>
      <Switch
        label="AI Support Features"
        size="sm"
        description="Adds purple sparkle AI buttons to nodes."
        checked={enabled}
        onChange={(e) => onChange("aiSupport", e.currentTarget.checked)}
      />
      {enabled && (
        <>
          <Select
            label="Provider"
            description={
              chosen
                ? "The model provider AI features use."
                : "Picked automatically from the API keys you've set. Choose one to keep it."
            }
            withinPortal
            data={providers.map((p) => ({
              value: p.name,
              label: `${p.emoji} ${p.name}`,
            }))}
            value={provider.name}
            onChange={(value) => onChange("aiProvider", value ?? "")}
          />
          {setupProblem && (
            <Alert
              variant="light"
              color="grape"
              icon={<IconAlertCircle />}
              fz="xs"
            >
              {setupProblem}
            </Alert>
          )}
          {(["fast", "smart"] as AITier[]).map((tier) => (
            <ModelField
              key={tier}
              tier={tier}
              provider={provider}
              value={models?.[provider.name]?.[tier] ?? ""}
              ollamaModels={ollamaModels}
              onCommit={(value) => setModel(tier, value)}
            />
          ))}
        </>
      )}
    </Stack>
  );
}
