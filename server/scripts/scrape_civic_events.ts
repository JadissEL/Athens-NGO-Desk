import { PrismaClient } from "@prisma/client";
import { runAllScrapeSources } from "../src/scrape/runScrape.js";

const prisma = new PrismaClient();

async function main() {
  const results = await runAllScrapeSources();
  console.log(JSON.stringify(results, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
