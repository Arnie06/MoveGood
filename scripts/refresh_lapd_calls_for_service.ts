import {
  LAPD_CALLS_METADATA_PATH,
  LAPD_CALLS_SNAPSHOT_PATH,
  writeLapdCallsSnapshot
} from "@/lib/crime-data";

const LOOKBACK_DAYS = Number(process.env.LAPD_CALLS_LOOKBACK_DAYS ?? 30);

function buildCallsUrl() {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - LOOKBACK_DAYS);
  const startDateText = startDate.toISOString().slice(0, 10);

  const params = new URLSearchParams({
    $select:
      "incident_number,area_occ,rpt_dist,dispatch_date,dispatch_time,call_type_code,call_type_text",
    $where: `dispatch_date >= '${startDateText}'`,
    $order: "dispatch_date DESC",
    $limit: "25000"
  });

  return `https://data.lacity.org/resource/xjgu-z4ju.json?${params.toString()}`;
}

async function main() {
  const sourceUrl = buildCallsUrl();
  const response = await fetch(sourceUrl, {
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to refresh LAPD calls for service: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as unknown;
  await writeLapdCallsSnapshot({
    payload,
    metadata: {
      refreshedAt: new Date().toISOString(),
      lookbackDays: LOOKBACK_DAYS,
      sourceUrl,
      note:
        "The official LAPD calls-for-service dataset is refreshed for recent context, but it is not currently used for map pins/heatmap because the published dataset metadata indicates it has no location column.",
      outputFiles: [LAPD_CALLS_SNAPSHOT_PATH, LAPD_CALLS_METADATA_PATH]
    }
  });

  console.log(
    JSON.stringify(
      {
        refreshedAt: new Date().toISOString(),
        sourceUrl,
        outputSnapshot: LAPD_CALLS_SNAPSHOT_PATH,
        outputMetadata: LAPD_CALLS_METADATA_PATH
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
