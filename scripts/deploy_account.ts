import { Logger, createLogger } from "@aztec/aztec.js/log";
import { deploySchnorrAccount } from "../src/utils/deploy_account.js";

export async function deployAccount() {
    let logger: Logger;
    logger = createLogger('aztec:aztec-starter');
    await deploySchnorrAccount();
}

deployAccount()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
