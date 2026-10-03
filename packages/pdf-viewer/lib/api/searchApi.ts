import type { Kernel } from "@embedpdf/react";
import { SearchToken } from "@embedpdf/plugin-search";
import type { SearchHit } from "@embedpdf/plugin-search";
import type { PDFViewerRef } from "../types/public";

// What consumers of the 2.x API read from a result: the page, and the match with
// its surrounding text.
const toResult = (hit: SearchHit) => {
  const snippet = hit.snippet;
  const context = snippet
    ? {
        before: snippet.text.slice(0, snippet.matchStart),
        match: snippet.text.slice(snippet.matchStart, snippet.matchStart + snippet.matchLength),
        after: snippet.text.slice(snippet.matchStart + snippet.matchLength),
      }
    : { before: "", match: "", after: "" };
  return { pageIndex: hit.pageIndex, charStart: hit.charStart, charCount: hit.charCount, context };
};

type SearchApi = PDFViewerRef["search"];

export const createSearchApi = (kernel: Kernel, documentId: string): SearchApi => {
  const search = () => kernel.capability(SearchToken, documentId);

  // The search runs page by page in the background; resolve once it has finished.
  const whenSettled = () =>
    new Promise<void>((resolve) => {
      const done = () => ["complete", "error", "idle"].includes(search().status());
      if (done()) return resolve();
      const off = kernel.subscribe(() => {
        if (!done()) return;
        off();
        resolve();
      });
    });

  return {
    searchText: async (keyword) => {
      if (!keyword.trim()) {
        search().clear();
        return { results: [], total: 0 };
      }
      search().search({ text: keyword });
      // `search()` starts asynchronously, so yield once before reading the status.
      await new Promise((resolve) => setTimeout(resolve, 0));
      await whenSettled();
      const results = search().hits().map(toResult);
      return { results, total: results.length };
    },
    nextResult: () => (search().next() ? search().activeIndex() : -1),
    previousResult: () => (search().prev() ? search().activeIndex() : -1),
    goToResult: (index) => (search().goTo(index) ? search().activeIndex() : -1),
    stopSearch: () => search().clear(),
    startSearch: () => search().rerun(),
    getSearchState: () => {
      const s = search();
      return {
        query: s.query(),
        status: s.status(),
        hitCount: s.hitCount(),
        activeIndex: s.activeIndex(),
        progress: s.progress(),
        error: s.errorMessage(),
      };
    },
    // Every hit is always highlighted in 3.x.
    setShowAllResults: () => undefined,
  };
};
