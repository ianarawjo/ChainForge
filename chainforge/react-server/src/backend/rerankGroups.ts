/**
 * Which documents a Rerank node ranks together.
 *
 * A reranker keeps the best `top_k` of whatever it is given. Handed every
 * document retrieved for a query at once, it pools the flow's configurations:
 * with two chunkers and two retrievers, the top two might all come from one
 * chunker, and the other would vanish from everything downstream. A flow built
 * to compare configurations would then silently compare nothing. So documents
 * are ranked within their own configuration, and `top_k` applies to each.
 *
 * Kept free of React and the store so it can be tested directly.
 */

import { PIPELINE_CONFIG_KEYS } from "./ragChat";

export interface RerankGroup<D> {
  query: string;
  /**
   * The upstream choices these documents share, such as
   * `{ chunkMethod: "Markdown Headers", retrievalMethod: "BM25 Retrieval" }`.
   * Empty for documents that recorded none.
   */
  config: Record<string, string>;
  /** In input order, so a reranker's result indices map back onto them. */
  documents: D[];
}

export interface GroupForRerankOptions<D> {
  /**
   * Queries wired straight into the node. When there are any, each is ranked
   * against the documents, ignoring whatever query they recorded -- which is
   * what lets the node rerank raw chunks that were never retrieved.
   */
  wiredQueries: string[];
  /** The query a document was retrieved for. */
  queryOf: (doc: D) => string;
  /** A variable the document recorded, as text; undefined if it has none. */
  varOf: (doc: D, name: string) => string | undefined;
}

/**
 * Only the pipeline's own choices define a configuration. Documents record
 * other variables too -- `docTitle` and `chunkId` from chunking, `score` and
 * `originalRank` from an earlier rerank -- but those differ per document, and
 * splitting on them would leave every document ranked on its own.
 */
function configOf<D>(
  doc: D,
  varOf: GroupForRerankOptions<D>["varOf"],
): Record<string, string> {
  const config: Record<string, string> = {};
  for (const key of PIPELINE_CONFIG_KEYS) {
    const value = varOf(doc, key);
    if (value !== undefined) config[key] = value;
  }
  return config;
}

/** Groups documents by a key, keeping first-appearance and input order. */
function groupBy<D, G>(
  documents: D[],
  keyOf: (doc: D) => string,
  create: (doc: D) => G & { documents: D[] },
): (G & { documents: D[] })[] {
  const groups = new Map<string, G & { documents: D[] }>();
  for (const doc of documents) {
    const key = keyOf(doc);
    let group = groups.get(key);
    if (!group) {
      group = create(doc);
      groups.set(key, group);
    }
    group.documents.push(doc);
  }
  return [...groups.values()];
}

/**
 * Splits documents into the sets a reranker should rank separately: one per
 * query and configuration.
 */
export function groupDocumentsForRerank<D>(
  documents: D[],
  { wiredQueries, queryOf, varOf }: GroupForRerankOptions<D>,
): RerankGroup<D>[] {
  // A missing variable is keyed apart from an empty one.
  const configKey = (doc: D) =>
    JSON.stringify(PIPELINE_CONFIG_KEYS.map((k) => varOf(doc, k) ?? null));

  if (wiredQueries.length > 0) {
    const byConfig = groupBy(documents, configKey, (doc) => ({
      config: configOf(doc, varOf),
      documents: [] as D[],
    }));
    return wiredQueries.flatMap((query) =>
      byConfig.map(({ config, documents: docs }) => ({
        query,
        config,
        documents: docs,
      })),
    );
  }

  return groupBy(
    documents,
    (doc) => JSON.stringify([queryOf(doc), configKey(doc)]),
    (doc) => ({
      query: queryOf(doc),
      config: configOf(doc, varOf),
      documents: [] as D[],
    }),
  );
}
