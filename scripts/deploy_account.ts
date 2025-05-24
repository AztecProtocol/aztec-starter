import { createLogger, Logger } from "@aztec/aztec.js";
import { setupPXE } from "../src/utils/setup_pxe.js";
import { deploySchnorrAccount } from "../src/utils/deploy_account.js";

export async function deployAccount() {
    let logger: Logger;
    logger = createLogger('aztec:aztec-starter');
    const pxe = await setupPXE();
    await deploySchnorrAccount(pxe);
}

deployAccount();
