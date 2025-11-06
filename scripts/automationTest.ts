import { truncateTable } from "./truncateTable";
import insert20Data from "./insert20Data";

async function automationTest() {
  await truncateTable();
  await insert20Data();
  await new Promise(resolve => setTimeout(resolve, 1000));
  console.log('running worker');
  const { exec } = require('child_process');
  const child = exec('npm run worker');
  child.stdout.on('data', (data: string) => {
    console.log(`stdout: ${data}`);
  });
  child.stderr.on('data', (data: string) => {
    console.log(`stderr: ${data}`);
  });
}

automationTest().catch(err => console.error(err));
