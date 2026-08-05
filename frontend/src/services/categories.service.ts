import { api } from "./api";
import type { Category } from "../types/place";

type CategoryPage = {
  next: string | null;
  results: Category[];
};

export const categoriesService = {
  listAll: async () => {
    const categories: Category[] = [];
    let page = 1;
    let next = true;

    while (next) {
      const data = await api.get<CategoryPage>("/categories/", { params: { page, page_size: 1000 } }).then((response) => response.data);
      categories.push(...data.results);
      next = Boolean(data.next);
      page += 1;
    }

    return categories;
  },
};
