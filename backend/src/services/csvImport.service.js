const {validateAndTransformRecord,} = require("../validator/csvValidator.js");
const ImportedRecord = require("../models/ImportedRecord.js");     

async function* createBatches(records, batchSize) {
    // Start with an empty array.
  let batch = [];

  //Go through the records one by one, "for await" because "records" might arrive slowly
  for await (const record of records) {

    // push the record in the array.
    batch.push(record);

    // if the array is full, return the yeild and start a new empty array.
    if (batch.length === batchSize) {
      yield batch;
      batch = [];
    }
  }

  // Emit the remaining records, if any.
  if (batch.length > 0) {
    yield batch;
  }
}

/** So, if we wrote this function in normal function - 
 * 
  function createBatches(records, batchSize) {
  const allBatches = [];
  let batch = [];

  for (const record of records) {
    batch.push(record);

    if (batch.length === batchSize) {
      allBatches.push(batch);
      batch = [];
    }
  }

  if (batch.length > 0) {
    allBatches.push(batch);
  }

  return allBatches;
}

const batches = createBatches([1, 2, 3, 4, 5, 6, 7], 3);
console.log(batches);  -> [[1, 2, 3], [4, 5, 6], [7]]

- for small data, this example would work
- async function* when the data is big or arrives slowly, which is common in backend and IoT work.
 * 
 */

async function* validateRecords(records, onInvalidRecord){
  let recordNumber = 0;

  for await (const record of records){
    recordNumber++;

    const result = validateAndTransformRecord(record);

    if(!result.valid){
/**
 * 1. Call onInvalidRecord with the details: which number it was, the original record and what was wrong. 
 * It’s awaited in case reporting takes time, like writing to a database.
 * 
 * 2. continue means skip the rest of this loop iteration and go straight to the next record. 
 * So the yield below never runs for a bad record.
 */
      await onInvalidRecord({
        recordNumber,
        record,
        errors: result.errors
      });
      continue;

    }
    yield result.data;
  }
}

/**
ex - 1: { temp: "25" }  ALLOWED
2: { temp: "abc" }   NOT ALLOWED
3: { temp: "30" }    ALLOWED

record 1 → valid   → yield { temp: 25 }
record 2 → invalid → onInvalidRecord({ recordNumber: 2, record: { temp: "abc" }, errors: ... })
                   → continue (skip)
record 3 → valid   → yield { temp: 30 }
 */

async function persistBatch(batch, jobId) {
  // .map() creates a new array, Copies each record's existing properties using spread syntax.
  // Adds the same jobId to every record.
  const documents = batch.map((record) => ({
    ...record,
    jobId,
  }));

  const insertedRecords = await ImportedRecord.insertMany(documents);
  return insertedRecords;
}
module.exports = {createBatches, validateRecords, persistBatch};