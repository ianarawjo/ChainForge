import React from "react";
import { describe, expect, test } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import Form from "@rjsf/core";
import { RJSFSchema } from "@rjsf/utils";
import validator from "@rjsf/validator-ajv8";
import { EmbeddingSimilaritySchema } from "../../RetrievalMethodSchemas";

// The node's own "datalist" widget isn't registered in a bare form.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { embeddingModel, ...uiSchema } = EmbeddingSimilaritySchema.uiSchema;

function renderForBackend(storageBackend: string) {
  render(
    <Form
      schema={EmbeddingSimilaritySchema.schema as RJSFSchema}
      uiSchema={uiSchema}
      validator={validator}
      formData={{ storage_backend: storageBackend }}
    />,
  );
}

const LANCEDB_FIELDS = ["LanceDB Path", "LanceDB Table Name"];
const FAISS_FIELDS = ["FAISS Index Path"];

describe("the embedding settings form shows each backend's own fields", () => {
  test("LanceDB", () => {
    renderForBackend("lancedb");
    for (const label of LANCEDB_FIELDS)
      expect(screen.queryByText(label)).not.toBeNull();
    for (const label of FAISS_FIELDS)
      expect(screen.queryByText(label)).toBeNull();
    expect(screen.queryAllByText("Index")).toHaveLength(1);
  });

  test("FAISS", () => {
    renderForBackend("faiss");
    for (const label of FAISS_FIELDS)
      expect(screen.queryByText(label)).not.toBeNull();
    for (const label of LANCEDB_FIELDS)
      expect(screen.queryByText(label)).toBeNull();
    expect(screen.queryAllByText("Index")).toHaveLength(1);
  });

  test("in-memory has no index fields", () => {
    renderForBackend("memory");
    for (const label of [...LANCEDB_FIELDS, ...FAISS_FIELDS])
      expect(screen.queryByText(label)).toBeNull();
    expect(screen.queryAllByText("Index")).toHaveLength(0);
  });

  test("search method offers similarity and MMR, not hybrid", () => {
    renderForBackend("lancedb");
    expect(screen.queryByText("Search Method")).not.toBeNull();
    expect(screen.queryByText(/Maximal Marginal Relevance/)).not.toBeNull();
    expect(screen.queryByText(/Hybrid/)).toBeNull();
  });
});

describe("the similarity threshold", () => {
  const renderWithMetric = (metric: string) =>
    render(
      <Form
        schema={EmbeddingSimilaritySchema.schema as RJSFSchema}
        uiSchema={uiSchema}
        validator={validator}
        formData={{ storage_backend: "memory", similarity_metric: metric }}
      />,
    );

  test("is offered for cosine", () => {
    renderWithMetric("cosine");
    expect(screen.queryByText("Similarity Threshold (%)")).not.toBeNull();
  });

  // Their scores have no fixed range, so a percentage means nothing.
  test.each(["euclidean", "dot_product"])("is not offered for %s", (metric) => {
    renderWithMetric(metric);
    expect(screen.queryByText("Similarity Threshold (%)")).toBeNull();
  });
});
