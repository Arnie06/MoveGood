import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  mergeCrimeIncidents,
  normalizeLasdCrimeCsv,
  writePersistedCrimeIncidents
} from "@/lib/crime-data";

const defaultInputs = [
  "/Users/alang/Downloads/2025-PART_I_AND_II_CRIMES.csv",
  "/Users/alang/Downloads/PART_I_AND_II_CRIMES-YTD.csv"
];

async function main() {
  const inputPaths = process.argv.slice(2);
  const sourcePaths = inputPaths.length > 0 ? inputPaths : defaultInputs;

  const allIncidents = [];
  for (const sourcePath of sourcePaths) {
    const content = await readFile(sourcePath, "utf8");
    const incidents = normalizeLasdCrimeCsv({
      content,
      sourceName: "LASD Part I/II Crime CSV",
      sourceFile: sourcePath
    });
    allIncidents.push(incidents);
  }

  const merged = mergeCrimeIncidents(allIncidents);
  await writePersistedCrimeIncidents(merged);

  const outputPath = path.join(process.cwd(), "data", "crime", "local-incidents.json");
  console.log(
    JSON.stringify(
      {
        importedFiles: sourcePaths.map((sourcePath) => path.basename(sourcePath)),
        incidentCount: merged.length,
        outputPath
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
