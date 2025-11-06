import { truncateTable } from "./truncateTable";
import insert20Data from "./insert20Data";

async function automationTest() {
  await truncateTable();
  await insert20Data();
  await new Promise(resolve => setTimeout(resolve, 1000));
  console.log('running worker');

  // worker 1
  const { exec } = require('child_process');
  const child1 = exec('npm run worker');
  child1.stdout.on('data', (data: string) => {
    console.log(`stdout worker1: ${data}`);
  });
  child1.stderr.on('data', (data: string) => {
    console.log(`stderr worker1: ${data}`);
  });

  // worker 2
  const child2 = exec('npm run worker');
  child2.stdout.on('data', (data: string) => {
    console.log(`stdout worker2: ${data}`);
  });
  child2.stderr.on('data', (data: string) => {
    console.log(`stderr worker2: ${data}`);
  });
}

automationTest().catch(err => console.error(err));
