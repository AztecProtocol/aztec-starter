to run the test

1. `aztec start --sandbox` in one terminal
2. in a new terminal run `aztec start --pxe --port 8081 --pxe.nodeUrl=http://localhost:8080 --pxe.proverEnabled false`
3. in 3rd terminal run `node --loader ts-node/esm scripts/test.ts`