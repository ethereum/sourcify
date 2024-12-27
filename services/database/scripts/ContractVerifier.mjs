import { logger } from "./logger.js";
import fetch from "node-fetch";

export class ContractVerifier {
  constructor(pool, options) {
    if (options.concurrent > options.batchSize) {
      logger.warn(
        `⚠️ Concurrent verifications (${options.concurrent}) should not be greater than batch size (${options.batchSize}). This may cause suboptimal performance.`,
      );
    }

    this.pool = pool;
    this.options = options;
    this.verifiedCount = 0;
    this.offset = 0;
    this.batchCount = 0;
    this.activeVerifications = 0;
    this.currentContractsBatch = [];
    this.nextContractsBatch = [];
    this.fetchedNextContractsSize = -1;
    this.isFetching = false;
    this.chainIds = options.chains;
    this.currentConcurrency = 3; // for cold start
    this.concurrencyExponent = 1.2;
  }

  async fetchContractsToVerify() {
    const query = `
    -- Version 1: Materialized CTE for better performance 
      WITH missing_contracts AS (
        SELECT chain_id, address
        FROM missing_transaction_hash
        WHERE reverified = false
        ${this.chainIds ? "AND chain_id = ANY($3)" : ""}
        LIMIT $1
        OFFSET $2
      )
      SELECT 
        mc.chain_id,
        encode(mc.address, 'hex') as address,
        false as reverified,  -- We know it's false from the WHERE clause
        sm.metadata::text as sourcify_metadata,
        (  -- Subquery for sources aggregation
          SELECT jsonb_agg(
            jsonb_build_object(
              'path', ccs.path,
              'content', s.content
            )
          )
          FROM compiled_contracts_sources ccs
          JOIN sources s ON s.source_hash = ccs.source_hash
          WHERE ccs.compilation_id = vc.compilation_id
        ) as sources
      FROM missing_contracts mc
      JOIN contract_deployments cd ON cd.chain_id = mc.chain_id AND cd.address = mc.address
      JOIN verified_contracts vc ON vc.deployment_id = cd.id
      LEFT JOIN sourcify_matches sm ON sm.verified_contract_id = vc.id;
    `;

    const params = [this.options.batchSize, this.offset];
    if (this.chainIds) {
      params.push(this.chainIds);
    }

    logger.debug("Fetching contracts to verify", {
      offset: this.offset,
      batchCount: this.batchCount,
      batchSize: this.options.batchSize,
      chainIds: this.chainIds,
    });
    const now = Date.now();

    const result = await this.pool.query(query, params);
    const duration = Date.now() - now;
    logger.info("Fetched contracts to verify", {
      rows: result.rows.length,
      offset: this.offset,
      batchCount: this.batchCount,
      batchSize: this.options.batchSize,
      duration: (duration / 1000).toFixed(2),
    });
    this.batchCount++;
    this.offset += result.rows.length;

    return result.rows;
  }

  async markContractAsVerified(chainId, address) {
    const query = `
      UPDATE missing_transaction_hash 
      SET reverified = true, updated_at = NOW()
      WHERE chain_id = $1 AND address = $2
    `;
    await this.pool.query(query, [chainId, address]);
  }

  async verifyContract(contract) {
    const files = contract.sources.reduce((acc, source) => {
      acc[source.path] = source.content;
      return acc;
    }, {});
    files["metadata.json"] = contract.sourcify_metadata;

    const body = {
      chainId: contract.chain_id.toString(),
      address: `0x${contract.address}`,
      metadata: JSON.parse(contract.sourcify_metadata),
      files,
    };

    return fetch(`${this.options.server}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async verifyAndMarkContract() {
    const contract = this.currentContractsBatch.pop();
    this.activeVerifications++;
    const verifyStartTime = Date.now();

    try {
      logger.debug("⌛ Verifying contract", {
        chainId: contract.chain_id,
        address: `0x${contract.address}`,
        activeVerifications: this.activeVerifications,
        inVerificationCurrentBatch: `${this.options.batchSize - this.currentContractsBatch.length}/${this.options.batchSize}`,
      });

      const response = await this.verifyContract(contract);
      await this.handleVerificationResponse(
        response,
        contract,
        verifyStartTime,
      );
    } catch (err) {
      logger.error("❌ Verification failed", {
        chainId: contract.chain_id,
        address: `0x${contract.address}`,
        error: err.message,
        durationSeconds: ((Date.now() - verifyStartTime) / 1000).toFixed(2),
      });
    } finally {
      this.activeVerifications--;
    }
  }

  async handleVerificationResponse(response, contract, verifyStartTime) {
    if (response.ok) {
      await this.handleSuccessfulVerification(contract, verifyStartTime);
    } else if (response.status === 409) {
      await this.handleAlreadyVerified(contract);
    } else {
      await this.handleFailedVerification(response, contract, verifyStartTime);
    }
  }

  async handleSuccessfulVerification(contract, verifyStartTime) {
    logger.debug("✅ Verified contract", {
      chainId: contract.chain_id,
      address: `0x${contract.address}`,
      durationSeconds: ((Date.now() - verifyStartTime) / 1000).toFixed(2),
      rateSinceStart: (
        this.verifiedCount /
        ((Date.now() - this.startTime) / 1000)
      ).toFixed(2),
    });
    await this.markContractAsVerified(
      contract.chain_id,
      Buffer.from(contract.address, "hex"),
    );
    this.verifiedCount++;
  }

  async handleAlreadyVerified(contract) {
    logger.debug(
      "🔄 Contract already verified or failed to get the creation tx, skipping",
      {
        chainId: contract.chain_id,
        address: `0x${contract.address}`,
      },
    );
    await this.markContractAsVerified(
      contract.chain_id,
      Buffer.from(contract.address, "hex"),
    );
    this.verifiedCount++;
  }

  async handleFailedVerification(response, contract, verifyStartTime) {
    logger.error("❌ Verification failed", {
      chainId: contract.chain_id,
      address: `0x${contract.address}`,
      status: response.status,
      error: await response.text(),
      durationSeconds: ((Date.now() - verifyStartTime) / 1000).toFixed(2),
    });
  }

  async fetchNextBatch() {
    // If the previous fetchedNextContractsSize is 0, it means no more contracts to fetch so don't fetch again.
    // If we are already fetching, don't fetch again.
    if (!this.isFetching) {
      this.isFetching = true;
      try {
        this.nextContractsBatch = await this.fetchContractsToVerify();
        this.fetchedNextContractsSize = this.nextContractsBatch.length;
        if (this.fetchedNextContractsSize === 0) {
          logger.warn(
            "fetchedNextContractsSize=0 - ⚠️ No more contracts to verify!",
          );
        }
      } catch (err) {
        logger.error("Error fetching next batch of contracts", {
          error: err.message,
          offset: this.offset,
          batchSize: this.options.batchSize,
          batchCount: this.batchCount,
        });
      }
      this.isFetching = false;
    }
  }

  logProgress() {
    const elapsedSecondsSinceStart = (Date.now() - this.startTime) / 1000;
    const rateSinceStart = this.verifiedCount / elapsedSecondsSinceStart;
    const elapsedSecondsSincePrevBatch =
      (Date.now() - this.prevBatchTime) / 1000;
    const rateSincePrevBatch =
      this.options.batchSize / elapsedSecondsSincePrevBatch;

    logger.info(`📊 Verification progress`, {
      chainIds: this.chainIds,
      verified: this.verifiedCount,
      rateSinceStart: rateSinceStart.toFixed(2),
      rateSincePrevBatch: rateSincePrevBatch.toFixed(2),
      activeVerifications: this.activeVerifications,
      currentContractsBatch: this.currentContractsBatch.length,
      options: this.options,
    });

    this.prevBatchTime = Date.now();
  }

  async run() {
    this.startTime = Date.now();
    this.prevBatchTime = Date.now();
    logger.info("Starting verification", { options: this.options });
    try {
      // Fetch first batch
      this.currentContractsBatch = await this.fetchContractsToVerify();
      this.nextContractsBatch = await this.fetchContractsToVerify();

      while (this.verifiedCount < this.options.limit) {
        if (this.currentContractsBatch.length === 0) {
          // If next batch is also empty, we are done
          // It could be that we are out of new contracts to verify but we are still fetching the next batch.
          if (this.nextContractsBatch.length === 0) {
            if (this.isFetching) {
              logger.warn(
                "⚠️ All contracts are verified but we are still fetching the next batch. The queries are taking a long time. You should increase the batch size or reduce concurrency.",
              );
              await new Promise((resolve) => setTimeout(resolve, 2 * 1000));
            } else {
              break;
            }
          } else {
            // If next batch is not empty, we need to switch to the next batch
            this.currentContractsBatch = this.nextContractsBatch;
            this.nextContractsBatch = [];
            // Then fetch the next batch
            // Don't await this.fetchNextBatchIfNeeded() since it will block the event loop
            this.fetchNextBatch();
            this.logProgress();
          }
        } else {
          // Wait until we have space for a new verification
          if (this.activeVerifications >= this.currentConcurrency) {
            await new Promise((resolve) =>
              setTimeout(resolve, this.options.interval),
            );
            continue;
          }

          // Gradually increase concurrency up to the maximum
          if (
            this.currentConcurrency < this.options.concurrent &&
            this.verifiedCount >= this.currentConcurrency
          ) {
            this.currentConcurrency = Math.min(
              this.currentConcurrency * this.concurrencyExponent,
              this.options.concurrent,
            );
            logger.info("Increasing concurrency", {
              newConcurrency: this.currentConcurrency,
            });
          }

          // Also don't await this one
          this.verifyAndMarkContract();
        }
      }

      const totalTime = (Date.now() - this.startTime) / 1000;
      logger.info("✅ ✅ ✅ Verification completed ✅ ✅ ✅", {
        totalVerified: this.verifiedCount,
        totalTimeSeconds: totalTime.toFixed(2),
        averageSpeed: (this.verifiedCount / totalTime).toFixed(2),
      });
      // All contracts are sent to verification but there will be unresolved promises since we aren't awaiting `verifyAndMarkContract`.
      // You will still see "✅ Verified Contract" in the logs after the message above

      // We need to wait 2 minutes before closing the pool to be able to mark the verified contracts as reverified in the DB
      logger.info("Waiting 2 minutes before closing the pool");
      for (let i = 0; i < 12; i++) {
        await new Promise((resolve) => setTimeout(resolve, 10 * 1000));
        logger.info(
          `${120 - (i + 1) * 10} seconds remaining before closing the pool`,
        );
      }
      logger.info("Closing the pool");
    } catch (err) {
      logger.error("Verification process failed", { error: err.message });
      throw err;
    }
  }
}
