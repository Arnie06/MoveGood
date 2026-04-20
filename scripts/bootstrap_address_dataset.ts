import { bootstrapAddressDataset } from "@/lib/address-dataset-bootstrap";

async function main() {
  const result = await bootstrapAddressDataset();
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
