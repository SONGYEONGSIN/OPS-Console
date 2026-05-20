"use server";

import { searchAll, type SearchResults } from "./queries";

export async function searchAllAction(query: string): Promise<SearchResults> {
  return searchAll(query);
}
