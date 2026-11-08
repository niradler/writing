import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export default {
  async paths() {
    const file = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "../.vitepress/series.json",
    );
    const series = JSON.parse(await readFile(file, "utf8"));
    return series.map((item) => ({
      params: { series: item.slug, seriesName: item.name },
    }));
  },
};
