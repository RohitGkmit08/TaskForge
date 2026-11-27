const fs = require("fs");
const csv = require("csv-parser");

const { validateAndTransformRecord } = require("../validator/csvValidator.js");
const ImportedRecord = require("../models/ImportedRecord.js");

/*
 ============================================================================
  MENTAL MODEL: UNDERSTANDING GENERATOR FUNCTIONS (function* and yield)
 ============================================================================
 
 If generator functions feel confusing, think of it this way:
 
 1. NORMAL FUNCTION vs GENERATOR FUNCTION:
    - Normal Function: Like a chef who refuses to serve anything until they
      cook all 1,000 meals. They put all 1,000 meals on one gigantic table
      (your computer's RAM). If the table isn't big enough, it collapses (CRASH!).
    
    - Generator Function (function*): Like a chef who cooks ONE meal, taps
      you on the shoulder ("yield meal"), and FREEZES in place. 
      You eat that meal. When you say "Next please!", the chef UNFREEZES,
      remembers exactly where they stopped, cooks the next meal, and pauses again.
 
 2. WHAT DOES `yield` DO?
    - Think of `yield` as a "PAUSE & HAND OVER" button.
    - Unlike `return` (which ends the function forever), `yield` pauses the
      function, hands a value to the caller, and saves its exact position.
 
 3. WHAT IS `async function*`?
    - An async generator is just a generator where items arrive over time
      (like reading a huge file from a hard drive in chunks).
    - It lets us say: "Wait for the next piece of data from disk, process it,
      yield it, and pause."
 
 4. WHO PULLS THE STRINGS?
    - The loop: `for await (const item of myGenerator())`
    - In every iteration of this loop:
      a) It unpauses the generator.
      b) The generator runs until it hits `yield`.
      c) The loop gets the yielded value (`item`).
      d) The generator goes to sleep until the next loop iteration!
 ============================================================================
*/



// 1. BATCHING GENERATOR

/**
 * createBatches(records, batchSize)
 *
 * PURPOSE:
 * Group individual items into smaller "boxes" (batches) of size `batchSize`.
 * E.g., if items come in one by one [1, 2, 3, 4, 5] and batchSize = 2:
 * Yields: [1, 2], then [3, 4], then [5].
 *
 * WHY A GENERATOR?
 * We do NOT want an array of all batches in memory!
 * Instead, we fill ONE small box, pause, hand it to MongoDB to save,
 * and only then start filling the next box.
 */
async function* createBatches(records, batchSize = 2) {
  // Our temporary box/cart to hold items for the current batch.
  let batch = [];

  // "for await": Ask the incoming stream/generator for the next record.
  for await (const record of records) {
    // Put the record into our current box.
    batch.push(record);

    // Is our box full?
    if (batch.length === batchSize) {
      // PAUSE & HAND OVER:
      // We hand this full box to whoever called us, and FREEZE here.
      yield batch;

      // When the caller is done (e.g. saved the box to MongoDB) and asks for the next batch, we wake up right here
      // Empty the box so we can start collecting the next batch.
      batch = [];
    }
  }

  // After the incoming records finish completely, do we have any leftovers?
  // (E.g., 7 records total with batchSize 3 -> [1,2,3], [4,5,6], leftover [7])
  if (batch.length > 0) {
    yield batch;
  }
}

// 2. VALIDATION GENERATOR

/**
 * validateRecords(records, onInvalidRecord)
 *
 * PURPOSE:
 * Acts like a filter / quality-check on a factory conveyor belt.
 * Records come in one by one:
 * - If VALID: clean it up and yield it down the conveyor belt.
 * - If INVALID: sound the alarm (call onInvalidRecord) and skip it.
 *
 * WHY A GENERATOR?
 * It doesn't validate the whole file at once. It only validates the NEXT record when the batcher downstream asks for one
 */
async function* validateRecords(records, onInvalidRecord) {
  let recordNumber = 0;

  // Pull one raw record at a time from the CSV parser stream.
  for await (const record of records) {
    recordNumber++;

    // Validate and clean up data types (e.g. string "25" -> number 25)
    const result = validateAndTransformRecord(record);

    // Case A: The record is BAD (missing fields, invalid age, etc.)
    if (!result.valid) {
      // If a callback was provided, notify it about the bad row.
      if (typeof onInvalidRecord === "function") {
        await onInvalidRecord({
          recordNumber,
          record,
          errors: result.errors,
        });
      }

      // "continue" jumps straight to the next loop iteration.
      // Notice: we DO NOT call "yield"!
      // Because we never yield this bad record, downstream batching/MongoDB
      // will never see it. It is safely skipped.
      continue;
    }

    // Case B: The record is GOOD.
    // PAUSE & HAND OVER:
    // Yield the clean, transformed data to the downstream consumer.
    yield result.data;
  }
}

// 3. DATABASE PERSISTENCE

/**
 * persistBatch(batch, jobId)
 *
 * PURPOSE:
 * Takes one batch (array of clean records), stamps each one with `jobId`,
 * and inserts them into MongoDB in a single bulk operation.
 *
 * (This is a normal async function because it just does one database call
 * and returns the inserted documents).
 */
async function persistBatch(batch, jobId) {
  // Add the parent jobId to every record in this batch so we know which
  // import job these records belong to.
  const documents = batch.map((record) => ({
    ...record,
    jobId,
  }));

  // Bulk insert all records in this batch into MongoDB at once.
  const insertedRecords = await ImportedRecord.insertMany(documents);

  return insertedRecords;
}

// 4. CSV IMPORT ORCHESTRATION

/**
 * processCsvImport(filePath, jobId, batchSize)
 *
 * PURPOSE:
 * Connects all the streaming pieces together into a memory-efficient pipeline:
 *
 *   [Disk: File Stream]
 *           | (emits raw text chunks)
 *           v
 *   [CSV Parser]
 *           | (emits raw row objects: { name: "Alice", age: "25" })
 *           v
 *   [validateRecords] -> (generator: skips bad rows, yields clean rows)
 *           | (yields clean objects: { name: "Alice", age: 25 })
 *           v
 *   [createBatches]   -> (generator: collects rows, yields batch array of size 2)
 *           | (yields batch arrays: [ {...}, {...} ])
 *           v
 *   [persistBatch]    -> (inserts batch into MongoDB)
 */
async function processCsvImport(filePath, jobId, batchSize = 2) {
  // Step 1: Open a readable file stream.
  // Node reads the file in small chunks from disk (does NOT load entire file).
  const readable = fs.createReadStream(filePath);

  // Step 2: Pipe chunks into csv-parser to turn comma-separated text into JS objects.
  const parser = readable.pipe(csv());

  // CRITICAL STREAM SAFETY:
  // Node's .pipe() does not forward errors automatically
  // If the file doesn't exist or disk read fails, forwarding the error to
  // `parser` ensures our async loop catches it instead of crashing Node.
  readable.on("error", (error) => {
    parser.destroy(error);
  });

  let invalidRecords = 0;
  let validRecords = 0;
  let batchesProcessed = 0;

  // Step 3: Set up the validation generator.
  // Note: Calling validateRecords() does NOT run the code yet!
  // It only creates the generator object (the pipeline stage).
  const validatedRecords = validateRecords(
    parser,
    async ({ recordNumber, record, errors }) => {
      invalidRecords++;
      console.log("Invalid record:", {
        recordNumber,
        record,
        errors,
      });
    }
  );

  // Step 4: Set up the batching generator.
  // Again, this doesn't run yet. It just connects to the validatedRecords generator.
  const batches = createBatches(validatedRecords, batchSize);

  // Step 5: Start the engine - 
  // The "for await" loop below is what actually pulls data through the entire pipeline:
  //
  // 1. The loop asks `batches` for the next batch.
  // 2. `batches` asks `validatedRecords` for records one by one.
  // 3. `validatedRecords` asks `parser` for rows one by one.
  // 4. `parser` pulls bytes from `readable`.
  // 5. As soon as `batches` collects `batchSize` records, it yields.
  // 6. The loop pauses the stream, saves the batch to MongoDB, and then asks for the next!
  for await (const batch of batches) {
    await persistBatch(batch, jobId);

    validRecords += batch.length;
    batchesProcessed++;

    console.log(`Batch ${batchesProcessed} persisted (${batch.length} records)`);
  }

  // Return a summary of the import operation (useful for BullMQ job results).
  return {
    totalRecords: validRecords + invalidRecords,
    validRecords,
    invalidRecords,
    batchesProcessed,
  };
}

module.exports = {createBatches,validateRecords, persistBatch,processCsvImport};
